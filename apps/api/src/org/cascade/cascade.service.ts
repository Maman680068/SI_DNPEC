import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SystemRole, TaskConfidentiality } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/auth-user.type';

type OrgTarget = {
  id: string;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

type TaskOrgFields = {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

/**
 * Périmètre organisationnel "passif" (hors créateur/assigné) sur lequel un
 * acteur peut voir des tâches — structuré plutôt qu'un simple fragment
 * Prisma générique, pour pouvoir à la fois construire le `where` de
 * `GET /tasks` et vérifier un item déjà chargé (`GET /tasks/:id`) sans
 * dupliquer la logique ni introspecter un objet Prisma.
 */
type TaskScope =
  | { kind: 'all' }
  | { kind: 'division'; divisionId: string }
  | { kind: 'division_section'; divisionId: string; sectionId: string }
  | { kind: 'cellule'; celluleId: string }
  | { kind: 'none' };

/** Rôles à visibilité totale sur la DNPEC pour la gestion des utilisateurs (§2.3). */
const TOP_LEVEL_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.ADMIN_SYSTEME];

/**
 * Rôles de direction, sans ADMIN_SYSTEME : utilisé pour tout ce qui touche
 * au *contenu métier* plutôt qu'à la gestion de compte — tâches (modifier/
 * valider/assigner) et congés (valider). Volontairement différent de
 * TOP_LEVEL_ROLES : ADMIN_SYSTEME (CSID) gère les comptes et
 * l'infrastructure mais "pas d'accès systématique au contenu métier des
 * tâches" (§3.1), et la validation des congés (§3.1) revient à
 * DN/DNA/Chef de Division/Section/Cellule — jamais à l'administrateur
 * système. Un ADMIN_SYSTEME ne voit donc que son propre contenu, comme un
 * Agent.
 */
const LEADERSHIP_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA];

/** Rôles dont le périmètre passif couvre une Division ou une Cellule entière (tous niveaux confidentialité ≤ CONFIDENTIEL_DIVISION). */
const TASK_UPPER_TIER_ROLES: SystemRole[] = [SystemRole.CHEF_DIVISION, SystemRole.CHEF_CELLULE];

/**
 * Logique de délégation en cascade (§2.3) : qui voit / peut agir sur qui,
 * en fonction du rattachement Division/Section/Cellule. Volontairement un
 * service injectable et non un Guard — les décisions dépendent de données
 * de la ressource ciblée (son divisionId/sectionId/celluleId), qu'un Guard
 * ne peut pas charger avant l'appel au service.
 */
@Injectable()
export class CascadeService {
  /** Filtre Prisma à appliquer à User.findMany pour scoper une liste au périmètre de `actor`. */
  getVisibleUserWhere(actor: AuthenticatedUser): Prisma.UserWhereInput {
    return this.getVisibleUserWhereForTopRoles(actor, TOP_LEVEL_ROLES);
  }

  /**
   * Même filtre que getVisibleUserWhere, mais sans ADMIN_SYSTEME dans le
   * périmètre "tout voir" — pour scoper une ressource de *contenu métier*
   * par utilisateur (ex. GET /leaves : `where: { user: ... } }`), pas la
   * gestion des comptes eux-mêmes.
   */
  getVisibleUserWhereForLeadershipScope(actor: AuthenticatedUser): Prisma.UserWhereInput {
    return this.getVisibleUserWhereForTopRoles(actor, LEADERSHIP_ROLES);
  }

  private getVisibleUserWhereForTopRoles(
    actor: AuthenticatedUser,
    topRoles: SystemRole[],
  ): Prisma.UserWhereInput {
    if (topRoles.includes(actor.role)) {
      return {};
    }

    switch (actor.role) {
      case SystemRole.CHEF_DIVISION:
        return { divisionId: actor.divisionId ?? '__none__' };
      case SystemRole.CHEF_SECTION:
        return {
          divisionId: actor.divisionId ?? '__none__',
          sectionId: actor.sectionId ?? '__none__',
        };
      case SystemRole.CHEF_CELLULE:
        return { celluleId: actor.celluleId ?? '__none__' };
      default:
        // AGENT, ASSISTANT_DIRECTION (et ADMIN_SYSTEME hors périmètre leadership) : uniquement soi-même.
        return { id: actor.id };
    }
  }

  /**
   * Cœur de la logique de cascade, factorisé car réutilisé avec deux
   * périmètres "top" différents : la gestion des utilisateurs (ADMIN_SYSTEME
   * inclus) et l'autorité sur le contenu des tâches (ADMIN_SYSTEME exclu,
   * §3.1 — voir hasDirectAuthorityOver).
   *
   * SÉCURITÉ : `actor.id === target.id` renvoie toujours faux, en premier,
   * avant même le raccourci topRoles — donc y compris pour DN/DNA/
   * ADMIN_SYSTEME. Cette méthode sert de garde à des actions de validation/
   * approbation (validation de tâche, congés) : personne ne doit jamais
   * pouvoir s'auto-valider, quel que soit son rôle. Un appelant qui a
   * légitimement besoin d'une action sur soi-même (s'assigner une tâche à
   * soi-même, consulter son propre profil...) doit faire ce contrôle
   * explicitement AVANT d'appeler cette méthode, jamais s'appuyer dessus.
   */
  private hasHierarchicalAuthorityOver(
    actor: AuthenticatedUser,
    target: OrgTarget,
    topRoles: SystemRole[],
  ): boolean {
    if (actor.id === target.id) return false;
    if (topRoles.includes(actor.role)) return true;

    switch (actor.role) {
      case SystemRole.CHEF_DIVISION:
        return !!actor.divisionId && actor.divisionId === target.divisionId;
      case SystemRole.CHEF_SECTION:
        return (
          !!actor.divisionId &&
          actor.divisionId === target.divisionId &&
          !!actor.sectionId &&
          actor.sectionId === target.sectionId
        );
      case SystemRole.CHEF_CELLULE:
        return !!actor.celluleId && actor.celluleId === target.celluleId;
      default:
        return false;
    }
  }

  /** `actor` a-t-il autorité hiérarchique sur `target` (gestion de compte : profil, statut, rattachement) ? */
  canManageUser(actor: AuthenticatedUser, target: OrgTarget): boolean {
    return this.hasHierarchicalAuthorityOver(actor, target, TOP_LEVEL_ROLES);
  }

  assertCanManageUser(actor: AuthenticatedUser, target: OrgTarget): void {
    if (!this.canManageUser(actor, target)) {
      throw new ForbiddenException(
        "Vous n'avez pas l'autorité hiérarchique nécessaire sur cet utilisateur.",
      );
    }
  }

  /**
   * `actor` a-t-il autorité hiérarchique sur `target` pour agir sur du
   * *contenu métier* dont `target` est propriétaire — modifier/valider/
   * rejeter une tâche créée par `target`, lui assigner du travail, ou
   * valider/rejeter une demande de congé qu'il/elle a soumise ? Exclut
   * ADMIN_SYSTEME du périmètre "tout" : ni le contenu des tâches (§3.1),
   * ni la validation des congés (§3.1, réservée à DN/DNA/Chef de Division/
   * Section/Cellule) ne relèvent de l'administrateur système, contrairement
   * à sa visibilité totale sur les comptes utilisateurs.
   */
  hasDirectAuthorityOver(actor: AuthenticatedUser, target: OrgTarget): boolean {
    return this.hasHierarchicalAuthorityOver(actor, target, LEADERSHIP_ROLES);
  }

  assertHasDirectAuthorityOver(actor: AuthenticatedUser, target: OrgTarget): void {
    if (!this.hasDirectAuthorityOver(actor, target)) {
      throw new ForbiddenException(
        "Seuls le créateur (ou la personne assignée/concernée) et son supérieur hiérarchique direct peuvent effectuer cette action.",
      );
    }
  }

  // --------------------------------------------------------------------
  // Tâches (module tasks/) — visibilité passive par périmètre + confidentialité.
  // Le créateur et les assignés voient toujours "leurs" tâches en plus de
  // ce périmètre passif (géré par TasksService, pas ici).
  // --------------------------------------------------------------------

  private getTaskScope(actor: AuthenticatedUser): TaskScope {
    if (LEADERSHIP_ROLES.includes(actor.role)) {
      return { kind: 'all' };
    }
    if (actor.role === SystemRole.CHEF_DIVISION) {
      return actor.divisionId ? { kind: 'division', divisionId: actor.divisionId } : { kind: 'none' };
    }
    if (actor.role === SystemRole.CHEF_CELLULE) {
      return actor.celluleId ? { kind: 'cellule', celluleId: actor.celluleId } : { kind: 'none' };
    }
    if (actor.role === SystemRole.CHEF_SECTION) {
      return actor.divisionId && actor.sectionId
        ? { kind: 'division_section', divisionId: actor.divisionId, sectionId: actor.sectionId }
        : { kind: 'none' };
    }
    if (actor.role === SystemRole.AGENT) {
      // Un Agent voit, en lecture, les tâches de tout son périmètre direct
      // (§3.1 : "tâches de sa section" pour un Agent de Division — étendu
      // par symétrie à "tâches de sa cellule" pour un Agent de cellule).
      if (actor.celluleId) return { kind: 'cellule', celluleId: actor.celluleId };
      if (actor.divisionId && actor.sectionId) {
        return { kind: 'division_section', divisionId: actor.divisionId, sectionId: actor.sectionId };
      }
      return { kind: 'none' };
    }
    // ADMIN_SYSTEME (§3.1 : pas d'accès systématique au contenu des tâches),
    // ASSISTANT_DIRECTION (périmètre non défini — §11) : aucune visibilité
    // passive, seulement les tâches dont ils sont créateur/assigné.
    return { kind: 'none' };
  }

  /** Confidentialités visibles *via le périmètre passif* (le créateur/assigné voit toujours sa tâche, quelle que soit sa confidentialité). */
  private getAllowedConfidentialityTiers(actor: AuthenticatedUser): TaskConfidentiality[] {
    if (LEADERSHIP_ROLES.includes(actor.role)) {
      return [
        TaskConfidentiality.PUBLIC_INTERNE,
        TaskConfidentiality.CONFIDENTIEL_DIVISION,
        TaskConfidentiality.TRES_CONFIDENTIEL_DIRIGEANTS,
      ];
    }
    if (TASK_UPPER_TIER_ROLES.includes(actor.role)) {
      return [TaskConfidentiality.PUBLIC_INTERNE, TaskConfidentiality.CONFIDENTIEL_DIVISION];
    }
    return [TaskConfidentiality.PUBLIC_INTERNE];
  }

  private taskScopeToPrismaWhere(scope: TaskScope): Prisma.TaskWhereInput | null {
    switch (scope.kind) {
      case 'all':
        return {};
      case 'division':
        return { divisionId: scope.divisionId };
      case 'division_section':
        return { divisionId: scope.divisionId, sectionId: scope.sectionId };
      case 'cellule':
        return { celluleId: scope.celluleId };
      case 'none':
        return null;
    }
  }

  private taskScopeMatches(scope: TaskScope, task: TaskOrgFields): boolean {
    switch (scope.kind) {
      case 'all':
        return true;
      case 'division':
        return task.divisionId === scope.divisionId;
      case 'division_section':
        return task.divisionId === scope.divisionId && task.sectionId === scope.sectionId;
      case 'cellule':
        return task.celluleId === scope.celluleId;
      case 'none':
        return false;
    }
  }

  /**
   * Filtre Prisma pour `Task.findMany` : périmètre passif (division/section/
   * cellule + confidentialité autorisée), combiné par TasksService avec
   * "je suis créateur" / "je suis assigné" (toujours visibles).
   */
  getTaskOrgScopeWhere(actor: AuthenticatedUser): Prisma.TaskWhereInput | null {
    const scope = this.taskScopeToPrismaWhere(this.getTaskScope(actor));
    if (!scope) return null;
    return { AND: [scope, { confidentiality: { in: this.getAllowedConfidentialityTiers(actor) } }] };
  }

  /** Équivalent booléen de getTaskOrgScopeWhere, pour un item déjà chargé (hors créateur/assigné, gérés par l'appelant). */
  canViewTaskByOrgScope(actor: AuthenticatedUser, task: TaskOrgFields & { confidentiality: TaskConfidentiality }): boolean {
    if (!this.getAllowedConfidentialityTiers(actor).includes(task.confidentiality)) return false;
    return this.taskScopeMatches(this.getTaskScope(actor), task);
  }

  /**
   * Un acteur ne peut donner à une tâche qu'un niveau de confidentialité
   * qu'il pourrait lui-même voir passivement (même liste de niveaux que
   * getAllowedConfidentialityTiers) : seuls CHEF_DIVISION/CHEF_CELLULE+
   * peuvent créer du CONFIDENTIEL_DIVISION, seuls DN/DNA du
   * TRES_CONFIDENTIEL_DIRIGEANTS. Évite qu'un Agent crée une tâche visible
   * des seuls dirigeants.
   */
  assertCanSetTaskConfidentiality(actor: AuthenticatedUser, confidentiality: TaskConfidentiality): void {
    if (!this.getAllowedConfidentialityTiers(actor).includes(confidentiality)) {
      throw new ForbiddenException(
        'Votre rôle ne permet pas de créer une tâche à ce niveau de confidentialité.',
      );
    }
  }
}
