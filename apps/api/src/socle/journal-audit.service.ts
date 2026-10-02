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
/** Dernière vérification complète de la chaîne d'audit (tâche de nuit). */
export const CLE_VERIFICATION_NOCTURNE = 'audit.verificationNocturne';

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
    // Vérification à la demande : son résultat remplace celui de la nuit dans la supervision.
    await this.verifierEtGarder().catch(() => undefined);
    return this.etat();
  }

  /**
   * Vérification complète de la chaîne d'audit, chaque nuit à 2 h 30 (heure de Conakry, UTC) :
   * parcourir toute la chaîne coûte de plus en plus cher à mesure que le journal grandit, elle ne
   * se fait donc plus à chaque passage de la supervision (exploitation 2026-10). Le résultat est
   * gardé pour la supervision ; une chaîne rompue met la tâche en échec, et la supervision alerte
   * les administrateurs.
   */
  /** Au démarrage du serveur (après un déploiement, appelé par main.ts), une vérification complète si
   * la dernière date de plus de 26 heures ou n'existe pas encore — en arrière-plan, sans retarder le
   * démarrage. Jamais dans un script (démonstration, paramétrage) : il ne modifie aucun paramètre. */
  verifierAuDemarrage(): void {
    void this.etatRapide()
      .then((e) => (e.ancienne ? this.taches.suivre('verification-audit', () => this.verifierEtGarder()) : undefined))
      .catch(() => undefined);
  }

  @Cron('30 2 * * *')
  async verifierNuit(): Promise<void> {
    await this.taches.suivre('verification-audit', () => this.verifierEtGarder()).catch(() => undefined);
  }

  /** Vérifie toute la chaîne et garde le résultat (aussi appelable par les tests). */
  async verifierEtGarder(maintenant = new Date()) {
    const t0 = Date.now();
    const e = await this.etat();
    const resultat = { date: maintenant.toISOString(), intacte: e.intacte, rangRompu: e.rangRompu, lignesVerifiees: e.lignesVerifiees, dureeMs: Date.now() - t0 };
    await this.prisma.parametre.upsert({ where: { cle: CLE_VERIFICATION_NOCTURNE }, create: { cle: CLE_VERIFICATION_NOCTURNE, valeur: resultat }, update: { valeur: resultat } });
    if (!e.intacte) throw new Error(`Chaîne du journal d’audit rompue à l’entrée n° ${e.rangRompu}`);
    return resultat;
  }

  /** État rapide pour la supervision (toutes les 10 min) : dernière vérification complète gardée,
   * et lignes en attente de scellement. */
  async etatRapide(maintenant = new Date()) {
    const ligne = await this.prisma.parametre.findUnique({ where: { cle: CLE_VERIFICATION_NOCTURNE } });
    const derniere = (ligne?.valeur ?? null) as { date: string; intacte: boolean; rangRompu: number | null; lignesVerifiees: number } | null;
    const enRetard = await this.prisma.auditLog.count({ where: { rang: null, createdAt: { lt: new Date(maintenant.getTime() - 10 * 60e3) } } });
    const ancienne = !derniere || maintenant.getTime() - new Date(derniere.date).getTime() > 26 * 3600e3;
    return { derniere, ancienne, scellementEnRetard: enRetard };
  }

  /** État de la chaîne (vérification complète, à la demande de l'administrateur). */
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
