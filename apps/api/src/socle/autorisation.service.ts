import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleFonctionnel, SystemRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { Arbre, UnitesArbreService } from './unites-arbre.service';

/**
 * Axe 1 de l'habilitation (§5.1) : ce que l'agent voit. Calculé à chaque
 * requête depuis la position (rôle hiérarchique, rattachement, superviseur
 * d'un assistant) — jamais saisi, jamais attribué par un rôle. En intérim, la
 * position est déjà celle du titulaire (JwtAuthGuard).
 */
export type Perimetre =
  | { nature: 'DIRECTION' }
  | { nature: 'BRANCHE'; racineId: string; uniteIds: Set<string> }
  | { nature: 'UNITE'; uniteId: string }
  | { nature: 'DELEGATION_DIRECTION' }
  | { nature: 'RESTREINT' }
  | { nature: 'AUCUN' };

export type EtapeRefus = 'PROTEGE' | 'EXTERNE' | 'PERIMETRE' | 'ROLE';

export interface DemandeAcces {
  /** Code de l'annexe 1 : Créer, Lire, Modifier, Valider, Supprimer. */
  action: 'C' | 'L' | 'M' | 'V' | 'S';
  objet: {
    type: string;
    id?: string;
    /** Unité de rattachement de l'objet (pour le périmètre). */
    uniteId?: string | null;
    /** Personnes pour qui l'objet est « le leur » (portée S). */
    proprietaireIds?: string[];
    /** Objet protégé au sens du §3.2 : seul le besoin d'en connaître décide. */
    protege?: boolean;
    /** Résultat du besoin d'en connaître, calculé par le module (objet protégé). */
    besoinDEnConnaitre?: boolean;
    /** Objet ouvert à la délégation de la Direction (courrier, réunions, suivi). */
    delegable?: boolean;
  };
  /** Rôles fonctionnels dont l'un est requis par l'action (axe 2). */
  rolesRequis?: RoleFonctionnel[];
  /** Positions acceptées à la place d'un rôle fonctionnel (ex. administrateur, socle). */
  positionsAcceptees?: SystemRole[];
  /** 'IGNORE' : le rôle porte sa propre portée « toute la Direction » (DRH, administrateur). */
  perimetre?: 'REQUIS' | 'IGNORE';
}

export interface Decision {
  accorde: boolean;
  etape?: EtapeRefus;
  motif?: string;
}

/**
 * Évaluation d'un accès dans l'ordre NORMATIF du §5.5 — une implémentation
 * qui teste le périmètre avant la protection de l'objet est rejetée en recette :
 *   1. objet protégé → besoin d'en connaître seul, l'évaluation s'arrête ;
 *   2. compte externe → objets diffusables seuls (aucun compte externe dans ce
 *      programme : l'étape est présente et toujours négative) ;
 *   3. périmètre → refus s'il ne couvre pas l'objet ;
 *   4. rôle fonctionnel requis → refus s'il n'est pas détenu.
 * Tout refus levé par `exiger` est journalisé (acces_refuses, via le filtre
 * d'erreurs) avec son étape.
 */
@Injectable()
export class AutorisationService {
  constructor(private readonly arbres: UnitesArbreService) {}

  async perimetre(acteur: AuthenticatedUser): Promise<Perimetre> {
    const arbre = await this.arbres.arbre();
    return this.perimetreDansArbre(acteur, arbre);
  }

  perimetreDansArbre(acteur: AuthenticatedUser, arbre: Arbre): Perimetre {
    const branche = (racineId: string | undefined): Perimetre =>
      racineId ? { nature: 'BRANCHE', racineId, uniteIds: this.arbres.descendants(arbre, racineId) } : { nature: 'AUCUN' };
    switch (acteur.role) {
      case SystemRole.DN:
      case SystemRole.DNA:
        return { nature: 'DIRECTION' };
      case SystemRole.CHEF_DIVISION:
        return branche(acteur.divisionId ? arbre.parDivision.get(acteur.divisionId)?.id : undefined);
      case SystemRole.CHEF_SECTION:
        return branche(acteur.sectionId ? arbre.parSection.get(acteur.sectionId)?.id : undefined);
      case SystemRole.CHEF_CELLULE:
        return branche(acteur.celluleId ? arbre.parCellule.get(acteur.celluleId)?.id : undefined);
      case SystemRole.AGENT: {
        const u = this.arbres.uniteDuRattachement(arbre, acteur);
        return u ? { nature: 'UNITE', uniteId: u.id } : { nature: 'AUCUN' };
      }
      case SystemRole.ASSISTANT_DIRECTION:
        // Comportement conservé : l'assistant voit comme son superviseur
        // (visibilité seulement, jamais son autorité ni les objets protégés).
        if (acteur.supervisorRole === SystemRole.DN || acteur.supervisorRole === SystemRole.DNA) {
          return { nature: 'DELEGATION_DIRECTION' };
        }
        if (acteur.supervisorRole === SystemRole.CHEF_CELLULE && acteur.supervisorCelluleId) {
          return branche(arbre.parCellule.get(acteur.supervisorCelluleId)?.id);
        }
        return { nature: 'AUCUN' };
      case SystemRole.STAGIAIRE:
        return { nature: 'RESTREINT' };
      default:
        // ADMIN_SYSTEME et position DRH : aucun périmètre hiérarchique.
        return { nature: 'AUCUN' };
    }
  }

  /** Le périmètre couvre-t-il une unité ? */
  couvre(p: Perimetre, uniteId: string | null | undefined, delegable = false): boolean {
    switch (p.nature) {
      case 'DIRECTION':
        return true;
      case 'DELEGATION_DIRECTION':
        return delegable;
      case 'BRANCHE':
        return !!uniteId && p.uniteIds.has(uniteId);
      case 'UNITE':
        return !!uniteId && p.uniteId === uniteId;
      default:
        return false;
    }
  }

  async evaluer(acteur: AuthenticatedUser, demande: DemandeAcces): Promise<Decision> {
    const { objet } = demande;

    // 1. Objet protégé : le besoin d'en connaître, et lui seul.
    if (objet.protege) {
      return objet.besoinDEnConnaitre
        ? { accorde: true }
        : { accorde: false, etape: 'PROTEGE', motif: 'Cet objet est protégé : il n’est accessible qu’aux personnes qui ont besoin d’en connaître.' };
    }

    // 2. Compte externe : aucun dans ce programme (hors périmètre).

    // 3. Périmètre (sauf rôle portant sa propre portée « toute la Direction »).
    if (demande.perimetre !== 'IGNORE') {
      const siens = !!objet.proprietaireIds?.some((id) => id === acteur.id || id === acteur.interimForId);
      if (!siens) {
        const p = await this.perimetre(acteur);
        if (!this.couvre(p, objet.uniteId, objet.delegable)) {
          return { accorde: false, etape: 'PERIMETRE', motif: 'Cet élément est hors de votre périmètre.' };
        }
      }
    }

    // 4. Rôle fonctionnel requis (ou position acceptée à sa place).
    const exigeRole = (demande.rolesRequis?.length ?? 0) > 0 || (demande.positionsAcceptees?.length ?? 0) > 0;
    if (exigeRole) {
      const parRole = !!demande.rolesRequis?.some((r) => acteur.rolesFonctionnels.includes(r));
      const parPosition = !!demande.positionsAcceptees?.includes(acteur.role) && !acteur.interimForId;
      if (!parRole && !parPosition) {
        return { accorde: false, etape: 'ROLE', motif: 'Votre rôle ne permet pas cette action.' };
      }
    }
    return { accorde: true };
  }

  /** Comme `evaluer`, mais lève un 403 journalisé (étape, type et identifiant de l'objet). */
  async exiger(acteur: AuthenticatedUser, demande: DemandeAcces): Promise<void> {
    const d = await this.evaluer(acteur, demande);
    if (!d.accorde) {
      throw new ForbiddenException({
        message: d.motif,
        etape: d.etape,
        objetType: demande.objet.type,
        objetId: demande.objet.id,
      });
    }
  }
}
