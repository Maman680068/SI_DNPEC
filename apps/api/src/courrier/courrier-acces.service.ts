import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AccesDelegueType,
  ActeStatut,
  CourrierConfidentialite,
  RegistrePortee,
  SystemRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { isComparableRank } from '../suppleances/comparable-rank';

/**
 * Niveau d'accès d'une personne à un courrier (matrice validée D7) :
 * - AUCUN : invisible ;
 * - EXISTENCE : pli PERSONNEL — numéro, dates, expéditeur, destinataire, statut ;
 * - METADONNEES : + objet et références, sans pièces ni instructions ;
 * - CONTENU : tout (pièces, imputations et instructions, circuit).
 */
export type NiveauAcces = 'AUCUN' | 'EXISTENCE' | 'METADONNEES' | 'CONTENU';

const RANG: Record<NiveauAcces, number> = { AUCUN: 0, EXISTENCE: 1, METADONNEES: 2, CONTENU: 3 };

export function auMoins(niveau: NiveauAcces, requis: NiveauAcces): boolean {
  return RANG[niveau] >= RANG[requis];
}

type Personne = { id: string; divisionId: string | null; sectionId: string | null; celluleId: string | null };

/** Ce dont la matrice a besoin d'une arrivée. */
export interface ArriveeAcces {
  id: string;
  registreId: string;
  uniteKey: string;
  confidentialite: CourrierConfidentialite;
  destinataireId: string | null;
  registre: { portee: RegistrePortee };
  imputations: { imputeA: Personne }[];
}

/** Ce dont la matrice a besoin d'un acte. */
export interface ActeAcces {
  id: string;
  registreId: string;
  uniteKey: string;
  confidentialite: CourrierConfidentialite;
  statut: ActeStatut;
  sequence: number | null;
  redacteurId: string;
  beneficiaireId: string | null;
  redacteur: Personne;
  registre: { portee: RegistrePortee };
  visas: { viseurAttenduId: string | null }[];
}

export const ARRIVEE_ACCES_SELECT = {
  id: true,
  registreId: true,
  uniteKey: true,
  confidentialite: true,
  destinataireId: true,
  registre: { select: { portee: true } },
  imputations: {
    select: { imputeA: { select: { id: true, divisionId: true, sectionId: true, celluleId: true } } },
  },
} as const;

export const ACTE_ACCES_SELECT = {
  id: true,
  registreId: true,
  uniteKey: true,
  confidentialite: true,
  statut: true,
  sequence: true,
  redacteurId: true,
  beneficiaireId: true,
  redacteur: { select: { id: true, divisionId: true, sectionId: true, celluleId: true } },
  registre: { select: { portee: true } },
  visas: { select: { viseurAttenduId: true } },
} as const;

/**
 * Contexte d'accès d'une personne, chargé une fois par requête : ses
 * habilitations courrier actives et ses accès délégués VALIDES (réévalués à
 * chaque chargement : révocation, fin ou non-conformité de la suppléance,
 * assistant plus rattaché à celui qui a ouvert l'accès).
 */
export interface ContexteAcces {
  actor: AuthenticatedUser;
  habilitations: Set<string>;
  delegationsArrivees: Set<string>;
  delegationsActes: Set<string>;
}

/**
 * Matrice de visibilité du courrier (D7). Principes :
 * - besoin d'en connaître (§2.2) : un CONFIDENTIEL ne s'ouvre jamais par un
 *   rôle EMPRUNTÉ (intérim) ni par la vue héritée d'un Assistant — seulement
 *   par l'identité réelle (DN/DNA, chef de l'unité du registre, imputé
 *   nommément, destinataire) ou par un accès délégué ;
 * - un pli PERSONNEL n'est lisible que par son destinataire (actor.id strict,
 *   jamais isActingFor, jamais délégable) ; DN/DNA, chef d'unité et
 *   secrétariat n'en voient que l'existence, par identité réelle (jamais un
 *   Assistant, jamais en intérim) ;
 * - ORDINAIRE : cascade classique (vue effective : Assistant → superviseur,
 *   intérim → titulaire) ;
 * - l'administrateur système ne voit aucun courrier (sauf comme personne :
 *   destinataire, imputé, rédacteur...).
 * Une seule implémentation pour l'écran, les actions et l'export : un export
 * ne peut jamais contenir une ligne ou un champ que l'écran ne montre pas.
 */
@Injectable()
export class CourrierAccesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cascade: CascadeService,
  ) {}

  async contexte(actor: AuthenticatedUser): Promise<ContexteAcces> {
    const [habilitations, delegations] = await Promise.all([
      this.prisma.habilitationCourrier.findMany({
        where: { userId: actor.id, revoqueeAt: null },
        select: { registreId: true, uniteKey: true },
      }),
      this.prisma.accesDelegueCourrier.findMany({
        where: { beneficiaireId: actor.id, revoqueAt: null },
        select: {
          arriveeId: true,
          acteId: true,
          type: true,
          ouvertParId: true,
          beneficiaire: { select: { supervisorId: true } },
          suppleance: {
            select: {
              revokedAt: true,
              startDate: true,
              endDate: true,
              titulaire: { select: { role: true, divisionId: true } },
              suppleant: { select: { role: true, divisionId: true } },
            },
          },
        },
      }),
    ]);
    const now = new Date();
    const liees = delegations.filter((d) => {
      if (d.type === AccesDelegueType.ASSISTANT) return d.beneficiaire.supervisorId === d.ouvertParId;
      const s = d.suppleance;
      return (
        !!s &&
        !s.revokedAt &&
        s.startDate <= now &&
        s.endDate >= now &&
        isComparableRank(s.titulaire, s.suppleant)
      );
    });
    const valides = await this.ouvreurAToujoursLeDroit(liees);
    return {
      actor,
      habilitations: new Set(habilitations.map((h) => `${h.registreId}|${h.uniteKey}`)),
      delegationsArrivees: new Set(valides.filter((d) => d.arriveeId).map((d) => d.arriveeId!)),
      delegationsActes: new Set(valides.filter((d) => d.acteId).map((d) => d.acteId!)),
    };
  }

  /**
   * Un accès délégué n'est valide que si celui qui l'a ouvert a ENCORE, de son
   * propre droit (hors délégation, identité réelle, compte actif), l'accès au
   * contenu du courrier — réévalué à chaque chargement : un ouvreur qui change
   * de rôle, d'unité ou perd son imputation fait tomber l'accès aussitôt.
   */
  private async ouvreurAToujoursLeDroit<T extends { arriveeId: string | null; acteId: string | null; ouvertParId: string }>(
    delegations: T[],
  ): Promise<T[]> {
    if (delegations.length === 0) return delegations;
    const ouvreurIds = [...new Set(delegations.map((d) => d.ouvertParId))];
    const arriveeIds = delegations.flatMap((d) => (d.arriveeId ? [d.arriveeId] : []));
    const acteIds = delegations.flatMap((d) => (d.acteId ? [d.acteId] : []));
    const [ouvreurs, habs, arrivees, actes] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ouvreurIds } },
        select: { id: true, role: true, status: true, divisionId: true, sectionId: true, celluleId: true, supervisor: { select: { role: true, celluleId: true } } },
      }),
      this.prisma.habilitationCourrier.findMany({
        where: { userId: { in: ouvreurIds }, revoqueeAt: null },
        select: { userId: true, registreId: true, uniteKey: true },
      }),
      arriveeIds.length ? this.prisma.courrierArrivee.findMany({ where: { id: { in: arriveeIds } }, select: ARRIVEE_ACCES_SELECT }) : [],
      acteIds.length ? this.prisma.acteCourrier.findMany({ where: { id: { in: acteIds } }, select: ACTE_ACCES_SELECT }) : [],
    ]);
    const contextes = new Map<string, ContexteAcces>();
    for (const { supervisor, ...o } of ouvreurs) {
      if (o.status !== UserStatus.ACTIF) continue;
      contextes.set(o.id, {
        actor: { ...o, supervisorRole: supervisor?.role ?? null, supervisorCelluleId: supervisor?.celluleId ?? null, interimForId: null },
        habilitations: new Set(habs.filter((h) => h.userId === o.id).map((h) => `${h.registreId}|${h.uniteKey}`)),
        delegationsArrivees: new Set(),
        delegationsActes: new Set(),
      });
    }
    const arr = new Map(arrivees.map((a) => [a.id, a]));
    const act = new Map(actes.map((a) => [a.id, a]));
    return delegations.filter((d) => {
      const ctx = contextes.get(d.ouvertParId);
      if (!ctx) return false;
      if (d.arriveeId) {
        const a = arr.get(d.arriveeId);
        return !!a && this.niveauArrivee(ctx, a, { sansDelegation: true }) === 'CONTENU';
      }
      const a = d.acteId ? act.get(d.acteId) : undefined;
      return !!a && this.niveauActe(ctx, a, { sansDelegation: true }) === 'CONTENU';
    });
  }

  // ------------------------------------------------------------------
  // Briques de la matrice
  // ------------------------------------------------------------------

  /** DN/DNA par identité réelle (jamais un rôle emprunté en intérim). */
  estDirectionReelle(actor: AuthenticatedUser): boolean {
    return !actor.interimForId && this.cascade.isLeadershipRole(actor.role);
  }

  /** Chef de l'unité d'un registre UNITE — rôle/rattachement fournis. */
  estChefUnite(v: { role: SystemRole; divisionId: string | null; celluleId: string | null }, uniteKey: string): boolean {
    if (v.role === SystemRole.CHEF_DIVISION && v.divisionId) return uniteKey === `DIV:${v.divisionId}`;
    if (v.role === SystemRole.CHEF_CELLULE && v.celluleId) return uniteKey === `CEL:${v.celluleId}`;
    return false;
  }

  /** Chef réel (hors intérim) de l'unité d'un registre UNITE. */
  estChefUniteReel(actor: AuthenticatedUser, portee: RegistrePortee, uniteKey: string): boolean {
    return portee === RegistrePortee.UNITE && !actor.interimForId && this.estChefUnite(actor, uniteKey);
  }

  /** « Direction ou chef d'unité » pour la VISIBILITÉ d'un ORDINAIRE : vue
   * effective (Assistant → superviseur, intérim → titulaire). */
  private estResponsableVisibilite(actor: AuthenticatedUser, portee: RegistrePortee, uniteKey: string): boolean {
    const view = this.cascade.getVisibilityView(actor);
    if (this.cascade.isLeadershipRole(view.role)) return true;
    return portee === RegistrePortee.UNITE && this.estChefUnite(view, uniteKey);
  }

  /** Autorité d'ACTION de direction/chef d'unité (imputer, classer, annuler,
   * signer) : rôle propre — emprunté en intérim (P.I.), jamais hérité d'un
   * superviseur par un Assistant. */
  estResponsableAction(actor: AuthenticatedUser, portee: RegistrePortee, uniteKey: string): boolean {
    if (this.cascade.isLeadershipRole(actor.role)) return true;
    return portee === RegistrePortee.UNITE && this.estChefUnite(actor, uniteKey);
  }

  estHabilite(ctx: ContexteAcces, registreId: string, uniteKey: string): boolean {
    return ctx.habilitations.has(`${registreId}|${uniteKey}`);
  }

  // ------------------------------------------------------------------
  // Arrivées
  // ------------------------------------------------------------------

  niveauArrivee(ctx: ContexteAcces, a: ArriveeAcces, opts: { sansDelegation?: boolean } = {}): NiveauAcces {
    const { actor } = ctx;
    if (a.destinataireId === actor.id) return 'CONTENU';
    if (actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId) {
      // Comme personne seulement : ses plis personnels (ci-dessus). Il n'est plus
      // jamais imputé ; une imputation antérieure éventuelle reste lisible.
      return a.imputations.some((i) => i.imputeA.id === actor.id) ? 'CONTENU' : 'AUCUN';
    }
    const habilite = this.estHabilite(ctx, a.registreId, a.uniteKey);
    const portee = a.registre.portee;

    switch (a.confidentialite) {
      case CourrierConfidentialite.PERSONNEL:
        // Existence seulement, et par identité RÉELLE : ni la vue héritée d'un
        // Assistant, ni un rôle emprunté en intérim (plus protégé encore qu'un
        // CONFIDENTIEL, que l'Assistant ne voit pas par défaut).
        return this.estDirectionReelle(actor) || this.estChefUniteReel(actor, portee, a.uniteKey) || habilite
          ? 'EXISTENCE'
          : 'AUCUN';

      case CourrierConfidentialite.CONFIDENTIEL:
        if (
          this.estDirectionReelle(actor) ||
          this.estChefUniteReel(actor, portee, a.uniteKey) ||
          a.imputations.some((i) => i.imputeA.id === actor.id) ||
          (!opts.sansDelegation && ctx.delegationsArrivees.has(a.id))
        ) {
          return 'CONTENU';
        }
        return habilite ? 'METADONNEES' : 'AUCUN';

      case CourrierConfidentialite.ORDINAIRE:
        if (
          this.estResponsableVisibilite(actor, portee, a.uniteKey) ||
          habilite ||
          a.imputations.some(
            (i) => this.cascade.isActingFor(actor, i.imputeA.id) || this.cascade.canSeeUserInLeadershipScope(actor, i.imputeA),
          )
        ) {
          return 'CONTENU';
        }
        return 'AUCUN';
    }
  }

  assertArrivee(ctx: ContexteAcces, a: ArriveeAcces, requis: NiveauAcces): NiveauAcces {
    const niveau = this.niveauArrivee(ctx, a);
    if (!auMoins(niveau, requis)) {
      throw new ForbiddenException(
        niveau === 'AUCUN'
          ? 'Ce courrier est hors de votre périmètre.'
          : 'Le contenu de ce courrier est protégé (besoin d’en connaître).',
      );
    }
    return niveau;
  }

  // ------------------------------------------------------------------
  // Départs et actes (CONTENU ou AUCUN)
  // ------------------------------------------------------------------

  niveauActe(ctx: ContexteAcces, a: ActeAcces, opts: { sansDelegation?: boolean } = {}): NiveauAcces {
    const { actor } = ctx;
    if (a.redacteurId === actor.id) return 'CONTENU';
    // Un brouillon est le travail personnel du rédacteur.
    if (a.statut === ActeStatut.BROUILLON) return 'AUCUN';
    const numerote = a.sequence !== null;
    if (numerote && a.beneficiaireId === actor.id) return 'CONTENU';
    if (actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId) return 'AUCUN';
    // Secrétariat : l'acte signé seulement (expédition), jamais un brouillon
    // ni une version en visa.
    if (numerote && this.estHabilite(ctx, a.registreId, a.uniteKey)) return 'CONTENU';
    const portee = a.registre.portee;

    if (a.confidentialite === CourrierConfidentialite.CONFIDENTIEL) {
      if (
        this.estDirectionReelle(actor) ||
        this.estChefUniteReel(actor, portee, a.uniteKey) ||
        a.visas.some((v) => v.viseurAttenduId === actor.id) ||
        (!opts.sansDelegation && ctx.delegationsActes.has(a.id))
      ) {
        return 'CONTENU';
      }
      return 'AUCUN';
    }

    if (
      this.estResponsableVisibilite(actor, portee, a.uniteKey) ||
      a.visas.some((v) => !!v.viseurAttenduId && this.cascade.isActingFor(actor, v.viseurAttenduId)) ||
      this.cascade.canSeeUserInLeadershipScope(actor, a.redacteur)
    ) {
      return 'CONTENU';
    }
    return 'AUCUN';
  }

  assertActe(ctx: ContexteAcces, a: ActeAcces): void {
    if (this.niveauActe(ctx, a) !== 'CONTENU') {
      throw new ForbiddenException('Cet acte est hors de votre périmètre.');
    }
  }
}
