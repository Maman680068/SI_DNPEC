import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AutorisationService } from './autorisation.service';
import { TachesPlanifieesService } from './taches-planifiees.service';

/** Libellés des événements (metadata.event) montrés dans la lecture du journal. */
const LIBELLE_EVENEMENT: Record<string, string> = {
  acces_objet_protege: 'Consultation d’un élément protégé',
  parametre_modifie: 'Paramètre modifié',
  test_restauration_declare: 'Test de restauration déclaré',
  depart: 'Départ enregistré',
  reprise_n1: 'Reprise automatique du socle',
};
const LIBELLE_ACTION: Record<AuditAction, string> = {
  CREATION: 'Création',
  MODIFICATION: 'Modification',
  SUPPRESSION: 'Suppression',
  VALIDATION: 'Validation',
  REJET: 'Rejet',
  PUBLICATION: 'Publication',
  CONNEXION: 'Connexion',
  DECONNEXION: 'Déconnexion',
};

export type FiltresAudit = { du?: string; au?: string; acteurId?: string; entityType?: string; action?: AuditAction; page?: number; taille?: number };

/**
 * Journal d'audit inaltérable (SOC-SEC-04) : scellement chaîné (fonction SQL audit_sceller, chaque
 * minute), vérification, et lecture selon l'annexe 1 — toute la Direction pour le DN, la DNA et
 * l'administrateur ; les entrées dont l'auteur est dans son périmètre pour un responsable ; ses
 * propres entrées pour les autres. Jamais de métadonnées brutes : aucun contenu d'objet protégé.
 */
@Injectable()
export class JournalAuditService {
  private readonly logger = new Logger('JournalAudit');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cascade: CascadeService,
    private readonly autorisation: AutorisationService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scellementPeriodique(): Promise<void> {
    try {
      await this.sceller();
    } catch (e) {
      // Une erreur est tracée (supervision) ; le prochain passage reprend là où il s'est arrêté.
      await this.taches.suivre('scellement-audit', async () => { throw e; }).catch(() => undefined);
    }
  }

  /** Scelle les lignes de plus d'une minute (ou toutes, délai 0 : tests, vérification). */
  async sceller(delaiSecondes = 60): Promise<number> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>`SELECT "audit_sceller"(make_interval(secs => ${delaiSecondes}::int)) AS n`;
    const n = Number(r[0]?.n ?? 0);
    if (n > 0) await this.taches.suivre('scellement-audit', async () => ({ lignesScellees: n }));
    return n;
  }

  async verifier(actor: AuthenticatedUser) {
    await this.autorisation.exiger(actor, { action: 'L', objet: { type: 'JournalAudit' }, positionsAcceptees: [SystemRole.ADMIN_SYSTEME], perimetre: 'IGNORE' });
    return this.etat();
  }

  /** État de la chaîne (supervision). */
  async etat() {
    const [v] = await this.prisma.$queryRaw<{ rangRompu: number | null; lignesVerifiees: number }[]>`SELECT * FROM "audit_verifier"()`;
    const nonScellees = await this.prisma.auditLog.count({ where: { rang: null } });
    const enRetard = await this.prisma.auditLog.count({ where: { rang: null, createdAt: { lt: new Date(Date.now() - 10 * 60e3) } } });
    return { intacte: v?.rangRompu == null, rangRompu: v?.rangRompu ?? null, lignesVerifiees: Number(v?.lignesVerifiees ?? 0), nonScellees, scellementEnRetard: enRetard };
  }

  private async portee(actor: AuthenticatedUser): Promise<{ where: Prisma.AuditLogWhereInput; libelle: string }> {
    // Identité réelle : la lecture du journal ne s'emprunte pas en intérim (on lit son propre périmètre).
    const reel = actor.interimForId ? { ...actor, interimForId: null } : actor;
    if (([SystemRole.DN, SystemRole.DNA, SystemRole.ADMIN_SYSTEME] as SystemRole[]).includes(actor.role) && !actor.interimForId) {
      return { where: {}, libelle: 'Toute la Direction' };
    }
    const moi = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { role: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true } });
    const chef = ([SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE] as SystemRole[]).includes(moi.role);
    if (chef) {
      const visibles = this.cascade.getVisibleUserWhereForLeadershipScope({ ...reel, role: moi.role, divisionId: moi.divisionId, sectionId: moi.sectionId, celluleId: moi.celluleId } as AuthenticatedUser);
      return { where: { OR: [{ actor: visibles }, { acteurInitial: actor.id }] }, libelle: 'Votre périmètre' };
    }
    return { where: { acteurInitial: actor.id }, libelle: 'Vos propres actions' };
  }

  async lister(actor: AuthenticatedUser, f: FiltresAudit) {
    const { where: portee, libelle } = await this.portee(actor);
    const taille = Math.min(Math.max(f.taille ?? 50, 1), 200);
    const page = Math.max(f.page ?? 1, 1);
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        portee,
        f.du ? { createdAt: { gte: new Date(f.du) } } : {},
        f.au ? { createdAt: { lt: new Date(new Date(f.au).getTime() + 864e5) } } : {},
        f.acteurId ? { acteurInitial: f.acteurId } : {},
        f.entityType ? { entityType: f.entityType } : {},
        f.action ? { action: f.action } : {},
      ],
    };
    const [total, lignes] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { numero: 'desc' },
        skip: (page - 1) * taille,
        take: taille,
        select: {
          id: true, numero: true, createdAt: true, action: true, entityType: true, entityId: true, metadata: true, rang: true,
          acteurInitial: true, auNomDeInitial: true,
        },
      }),
    ]);
    const ids = [...new Set(lignes.flatMap((l) => [l.acteurInitial, l.auNomDeInitial]).filter((x): x is string => !!x))];
    const personnes = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const types = await this.prisma.auditLog.findMany({ where: portee, distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' }, take: 200 });
    return {
      droits: { peutVerifier: actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId },
      portee: libelle,
      total,
      page,
      taille,
      typesObjets: types.map((t) => t.entityType),
      entrees: lignes.map((l) => {
        const event = l.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata) ? (l.metadata as Record<string, unknown>).event : undefined;
        return {
          id: l.id,
          numero: l.numero,
          date: l.createdAt,
          action: l.action,
          libelle: (typeof event === 'string' && LIBELLE_EVENEMENT[event]) || LIBELLE_ACTION[l.action],
          evenement: typeof event === 'string' ? event : null,
          objetType: l.entityType,
          objetId: l.entityId,
          acteur: l.acteurInitial ? { id: l.acteurInitial, nom: personnes.get(l.acteurInitial) ?? 'Compte supprimé' } : null,
          auNomDe: l.auNomDeInitial ? { id: l.auNomDeInitial, nom: personnes.get(l.auNomDeInitial) ?? 'Compte supprimé' } : null,
          scellee: l.rang !== null,
        };
      }),
    };
  }
}
