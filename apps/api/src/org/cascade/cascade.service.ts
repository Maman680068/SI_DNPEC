import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SystemRole, TaskConfidentiality } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { estDrh } from '../../socle/roles-fonctionnels';

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

/** Rôles à visibilité totale sur la DNPEC pour la gestion des utilisateurs (§2.1).
 * DRH y figure au même titre qu'ADMIN_SYSTEME (fonction transversale, module
 * Dossier du personnel) : ni l'un ni l'autre n'a d'autorité de cascade sur le
 * contenu métier (voir LEADERSHIP_ROLES ci-dessous), mais les deux voient la
 * liste complète des comptes (GET /users) et héritent de canManageUser —
 * déjà le cas d'ADMIN_SYSTEME. Effet de bord accepté (comme pour
 * ADMIN_SYSTEME) : cible aussi le périmètre autorisé pour diffuser une
 * annonce/un sondage (assertCanManageUser, announcements/polls). */
const TOP_LEVEL_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.ADMIN_SYSTEME];

/** Socle NIMBA : la vue « tous les comptes » du DRH vient de son RÔLE fonctionnel
 * DRH (attribution datée), plus de la position `users.role = DRH`. */
const VUE_COMPTES_DRH = TOP_LEVEL_ROLES;

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
 * Logique de délégation en cascade (§2.1) : qui voit / peut agir sur qui,
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
    const effective = this.getVisibilityActor(actor);
    if (topRoles.includes(effective.role)) {
      return {};
    }
    if (topRoles === VUE_COMPTES_DRH && estDrh(actor)) return {};

    switch (effective.role) {
      case SystemRole.CHEF_DIVISION:
        return { divisionId: effective.divisionId ?? '__none__' };
      case SystemRole.CHEF_SECTION:
        return {
          divisionId: effective.divisionId ?? '__none__',
          sectionId: effective.sectionId ?? '__none__',
        };
      case SystemRole.CHEF_CELLULE:
        return { celluleId: effective.celluleId ?? '__none__' };
      default:
        // AGENT, ASSISTANT_DIRECTION sans superviseur (et ADMIN_SYSTEME hors
        // périmètre leadership) : uniquement soi-même.
        return { id: actor.id };
    }
  }

  /**
   * Équivalent booléen de getVisibleUserWhereForLeadershipScope pour une cible
   * déjà chargée : `actor` voit-il `target` dans son périmètre de cascade
   * (contenu métier, ADMIN_SYSTEME exclu) ? Même vue effective (Assistant →
   * superviseur, intérim → titulaire). Utilisé par le module courrier/ pour la
   * visibilité d'un courrier ORDINAIRE par la cascade de ses imputés.
   */
  canSeeUserInLeadershipScope(actor: AuthenticatedUser, target: OrgTarget): boolean {
    const effective = this.getVisibilityActor(actor);
    if (LEADERSHIP_ROLES.includes(effective.role)) return true;
    switch (effective.role) {
      case SystemRole.CHEF_DIVISION:
        return !!effective.divisionId && effective.divisionId === target.divisionId;
      case SystemRole.CHEF_SECTION:
        return (
          !!effective.divisionId &&
          effective.divisionId === target.divisionId &&
          !!effective.sectionId &&
          effective.sectionId === target.sectionId
        );
      case SystemRole.CHEF_CELLULE:
        return !!effective.celluleId && effective.celluleId === target.celluleId;
      default:
        return actor.id === target.id;
    }
  }

  /**
   * Vue effective en lecture seule (rôle/rattachement pour la VISIBILITÉ) —
   * voir getVisibilityActor. Exposée pour les modules qui composent leurs
   * propres règles de visibilité (courrier/) ; jamais pour l'autorité d'action.
   */
  getVisibilityView(actor: AuthenticatedUser): Pick<AuthenticatedUser, 'role' | 'divisionId' | 'sectionId' | 'celluleId'> {
    const { role, divisionId, sectionId, celluleId } = this.getVisibilityActor(actor);
    return { role, divisionId, sectionId, celluleId };
  }

  /**
   * Vue effective de l'acteur pour la visibilité en cascade (getTaskScope et
   * getVisibleUserWhereForTopRoles ci-dessus) UNIQUEMENT : un
   * ASSISTANT_DIRECTION avec un superviseur (User.supervisorId) voit comme
   * le rôle et la celluleId de celui-ci — jamais sa divisionId/sectionId, un
   * superviseur (DN/DNA/CHEF_CELLULE) n'en ayant pas (invariant n°4).
   *
   * Ne jamais réutiliser cette vue pour l'autorité d'action
   * (hasHierarchicalAuthorityOver et ses dérivés : canManageUser,
   * hasDirectAuthorityOver, canBroadcastToDivision) ni pour la confidentialité
   * consultable/assignable (getAllowedConfidentialityTiers,
   * assertCanSetTaskConfidentiality) : ceux-ci continuent de juger sur le
   * rôle propre de l'Assistant, par décision de conception (l'Assistant voit
   * plus, mais n'hérite d'aucun pouvoir d'action ni d'un niveau de
   * confidentialité supérieur).
   */
  private getVisibilityActor(actor: AuthenticatedUser): AuthenticatedUser {
    if (actor.role !== SystemRole.ASSISTANT_DIRECTION || !actor.supervisorRole) {
      return actor;
    }
    return {
      ...actor,
      role: actor.supervisorRole,
      celluleId: actor.supervisorCelluleId,
    };
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
   *
   * Suppléance/intérim (§4.10) : même garde étendue à `interimForId` — un
   * suppléant qui emprunte le rôle du titulaire (JwtAuthGuard) ne doit
   * jamais pouvoir agir sur le titulaire LUI-MÊME sous couvert de ce rôle
   * emprunté (ex. valider le propre congé du titulaire). `interimForId` est
   * optionnel sur le type : les objets "candidats" passés en `actor` par
   * d'autres méthodes (ex. hasCloserAuthorityOver, chefs candidats) n'ont
   * jamais cette propriété et ne sont donc jamais concernés.
   */
  private hasHierarchicalAuthorityOver(
    actor: OrgTarget & { role: SystemRole; interimForId?: string | null },
    target: OrgTarget,
    topRoles: SystemRole[],
  ): boolean {
    if (actor.id === target.id) return false;
    if (actor.interimForId && actor.interimForId === target.id) return false;
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
    if (estDrh(actor) && actor.id !== target.id && actor.interimForId !== target.id) return true;
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

  /**
   * Suppléance/intérim (§4.10) : `actor` est-il `userId`, ou agit-il
   * actuellement en son nom ? Remplace les contrôles par identité littérale
   * (`x.someUserId === actor.id`, ex. "seul l'organisateur de la réunion
   * peut...") là où l'emprunt de rôle de JwtAuthGuard ne s'applique pas
   * (ces contrôles ne passent jamais par hasHierarchicalAuthorityOver).
   * Pour tout ce qui repose déjà sur hasDirectAuthorityOver/canManageUser/
   * etc., l'emprunt de rôle suffit — pas besoin de cette méthode là.
   */
  isActingFor(actor: AuthenticatedUser, userId: string): boolean {
    return actor.id === userId || actor.interimForId === userId;
  }

  /** Vrai si `role` fait partie de LEADERSHIP_ROLES (DN/DNA) — exposé en lecture
   * seule pour les modules qui doivent composer avec cette liste (ex. l'exception
   * "besoin d'en connaître" des congés maladie, voir LeaveMedicalPrivacyService)
   * sans dupliquer la constante ni l'exporter telle quelle. */
  isLeadershipRole(role: SystemRole): boolean {
    return LEADERSHIP_ROLES.includes(role);
  }

  /**
   * Variante de hasDirectAuthorityOver SANS le raccourci LEADERSHIP_ROLES :
   * `actor` a-t-il autorité en tant que chef direct (Division/Section/Cellule) de
   * `target`, quel que soit le rôle de `actor` par ailleurs ? Sert à détecter si un
   * chef PLUS PROCHE que DN/DNA existe pour une ressource donnée — l'exception
   * "besoin d'en connaître" des congés maladie (LeaveMedicalPrivacyService) l'utilise
   * pour décider si DN/DNA sont de simples superviseurs en cascade (un chef plus
   * proche existe : motif masqué) ou le seul validateur réel (aucun chef plus
   * proche : motif visible, pour pouvoir juger).
   */
  hasCloserAuthorityOver(actor: OrgTarget & { role: SystemRole }, target: OrgTarget): boolean {
    return this.hasHierarchicalAuthorityOver(actor, target, []);
  }

  assertHasDirectAuthorityOver(actor: AuthenticatedUser, target: OrgTarget): void {
    if (!this.hasDirectAuthorityOver(actor, target)) {
      throw new ForbiddenException(
        "Seuls le créateur (ou la personne assignée/concernée) et son supérieur hiérarchique direct peuvent effectuer cette action.",
      );
    }
  }

  /**
   * Filtre Prisma inverse de hasDirectAuthorityOver : les utilisateurs ayant
   * une autorité hiérarchique directe *sur* `target` — pour notifier le ou
   * les validateurs d'un événement (ex. soumission d'une demande de congé),
   * jamais pour vérifier une autorisation (utiliser assertHasDirectAuthorityOver
   * pour ça). Mêmes rôles que hasDirectAuthorityOver (LEADERSHIP_ROLES en
   * plus du chef direct de la division/section/cellule de `target`),
   * ADMIN_SYSTEME exclu pour la même raison. `target` lui-même est toujours
   * exclu, y compris s'il est par ailleurs chef de sa propre unité.
   */
  getUsersWithDirectAuthorityOverWhere(target: OrgTarget): Prisma.UserWhereInput {
    return {
      id: { not: target.id },
      OR: [
        { role: { in: LEADERSHIP_ROLES } },
        ...(target.divisionId ? [{ role: SystemRole.CHEF_DIVISION, divisionId: target.divisionId }] : []),
        ...(target.divisionId && target.sectionId
          ? [{ role: SystemRole.CHEF_SECTION, divisionId: target.divisionId, sectionId: target.sectionId }]
          : []),
        ...(target.celluleId ? [{ role: SystemRole.CHEF_CELLULE, celluleId: target.celluleId }] : []),
      ],
    };
  }

  /**
   * Autorité pour diffuser une tâche à toute une division (RF-TAC, diffusion
   * collective/individuelle) : DN/DNA sur n'importe laquelle, un Chef de
   * Division sur la sienne uniquement. Volontairement PAS une boucle
   * "ai-je autorité sur chaque membre" (comme assertCanAssignAll) — une
   * division sans membre rendrait une telle boucle vide de sens (aucune
   * itération = jamais rejeté), ce qui autoriserait n'importe qui à
   * "diffuser" sur une division vide sans autorité réelle. Ici l'autorité se
   * juge sur le rôle/rattachement de l'acteur, indépendamment de l'effectif
   * de la division ciblée — TasksService vérifie séparément que la division
   * a au moins un membre actif avant de créer quoi que ce soit.
   */
  canBroadcastToDivision(actor: AuthenticatedUser, divisionId: string): boolean {
    if (LEADERSHIP_ROLES.includes(actor.role)) return true;
    return actor.role === SystemRole.CHEF_DIVISION && actor.divisionId === divisionId;
  }

  assertCanBroadcastToDivision(actor: AuthenticatedUser, divisionId: string): void {
    if (!this.canBroadcastToDivision(actor, divisionId)) {
      throw new ForbiddenException(
        'Seuls le Chef de la division concernée et la Direction peuvent diffuser une tâche à toute une division.',
      );
    }
  }

  /**
   * Autorité de GESTION sur l'espace de travail d'une division (créer un
   * document/dossier dedans, module documents/) : tout membre de la division, quel
   * que soit son rôle (Chef de Section/Cellule y compris), plus DN/DNA en cascade
   * complète — une décision de conception distincte de la LECTURE du contenu privé
   * (voir isMemberOfDivision) : la cascade hiérarchique reste le bon critère pour
   * "qui peut déposer/gérer du contenu", "besoin d'en connaître" pour "qui peut lire
   * du contenu privé qu'il n'a pas créé" (RF-GED-01). Volontairement sans
   * granularité section/cellule — le cahier des charges définit l'espace privé "par
   * division", pas plus finement.
   */
  canAccessDivisionWorkspace(actor: AuthenticatedUser, divisionId: string): boolean {
    if (LEADERSHIP_ROLES.includes(actor.role)) return true;
    return actor.divisionId === divisionId;
  }

  assertCanAccessDivisionWorkspace(actor: AuthenticatedUser, divisionId: string): void {
    if (!this.canAccessDivisionWorkspace(actor, divisionId)) {
      throw new ForbiddenException("Cette division n'est pas dans votre périmètre.");
    }
  }

  /**
   * Appartenance structurelle à une division — utilisé pour restreindre la LECTURE
   * du contenu privé (Documents/Folders, RF-GED-01) au principe "besoin d'en
   * connaître", jamais à la cascade hiérarchique : contrairement à
   * canAccessDivisionWorkspace, DN/DNA n'ont ICI aucun raccourci. N'étant
   * structurellement rattachés à aucune division (attachmentKind 'none'), cette
   * méthode leur renvoie donc toujours faux — ils ne lisent que les documents
   * PUBLIE_DNPEC en dehors de toute division, jamais le PRIVE_DIVISION d'une
   * division dont ils ne sont pas membres.
   */
  isMemberOfDivision(actor: AuthenticatedUser, divisionId: string): boolean {
    // Stagiaire (D6) : rattaché à une division le temps d'une période, jamais
    // lecteur de son espace privé (le module est de plus fermé par StagiaireGuard).
    if (actor.role === SystemRole.STAGIAIRE) return false;
    return actor.divisionId === divisionId;
  }

  /** Socle N4 — espace documentaire d'une cellule rattachée à la Direction : mêmes règles que
   * pour une division (dépôt : ses membres, le DN et la DNA ; lecture du contenu privé : ses
   * membres seulement, besoin d'en connaître). */
  canAccessCelluleWorkspace(actor: AuthenticatedUser, celluleId: string): boolean {
    if (LEADERSHIP_ROLES.includes(actor.role)) return true;
    return actor.role !== SystemRole.STAGIAIRE && actor.celluleId === celluleId;
  }

  isMemberOfCellule(actor: AuthenticatedUser, celluleId: string): boolean {
    return actor.role !== SystemRole.STAGIAIRE && actor.celluleId === celluleId;
  }

  assertIsMemberOfDivision(actor: AuthenticatedUser, divisionId: string): void {
    if (!this.isMemberOfDivision(actor, divisionId)) {
      throw new ForbiddenException('Cet espace documentaire privé est hors de votre périmètre.');
    }
  }

  // --------------------------------------------------------------------
  // Tâches (module tasks/) — visibilité passive par périmètre + confidentialité.
  // Le créateur et les assignés voient toujours "leurs" tâches en plus de
  // ce périmètre passif (géré par TasksService, pas ici).
  // --------------------------------------------------------------------

  private getTaskScope(actor: AuthenticatedUser): TaskScope {
    const effective = this.getVisibilityActor(actor);
    if (LEADERSHIP_ROLES.includes(effective.role)) {
      return { kind: 'all' };
    }
    if (effective.role === SystemRole.CHEF_DIVISION) {
      return effective.divisionId ? { kind: 'division', divisionId: effective.divisionId } : { kind: 'none' };
    }
    if (effective.role === SystemRole.CHEF_CELLULE) {
      return effective.celluleId ? { kind: 'cellule', celluleId: effective.celluleId } : { kind: 'none' };
    }
    if (effective.role === SystemRole.CHEF_SECTION) {
      return effective.divisionId && effective.sectionId
        ? { kind: 'division_section', divisionId: effective.divisionId, sectionId: effective.sectionId }
        : { kind: 'none' };
    }
    if (effective.role === SystemRole.AGENT) {
      // Un Agent voit, en lecture, les tâches de tout son périmètre direct
      // (§3.1 : "tâches de sa section" pour un Agent de Division — étendu
      // par symétrie à "tâches de sa cellule" pour un Agent de cellule).
      if (effective.celluleId) return { kind: 'cellule', celluleId: effective.celluleId };
      if (effective.divisionId && effective.sectionId) {
        return { kind: 'division_section', divisionId: effective.divisionId, sectionId: effective.sectionId };
      }
      return { kind: 'none' };
    }
    // ADMIN_SYSTEME (§3.1 : pas d'accès systématique au contenu des tâches),
    // ASSISTANT_DIRECTION sans superviseur renseigné : aucune visibilité
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
