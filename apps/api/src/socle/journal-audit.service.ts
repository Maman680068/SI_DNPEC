import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, NotificationType, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { motsRecherche, normaliser } from '../common/recherche/texte';
import { Domaine, EVENEMENTS_SENSIBLES, LIBELLE_DOMAINE, nommer, TYPES, typeDe, verbe } from './journal-audit.phrases';
import { PrismaService } from '../prisma/prisma.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AutorisationService } from './autorisation.service';
import { TachesPlanifieesService } from './taches-planifiees.service';

export type FiltresAudit = { du?: string; au?: string; acteurId?: string; entityType?: string; action?: AuditAction; page?: number; taille?: number; domaine?: string; sensibles?: string; q?: string };

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
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
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
    await this.taches.suivre('verification-audit', () => this.verifierEtGarder()).catch((e) => this.alerterRupture(e));
  }

  /** Chaîne rompue la nuit : les administrateurs sont prévenus (S9a), en plus de la supervision. */
  async alerterRupture(e: unknown): Promise<void> {
    const admins = await this.prisma.user.findMany({ where: { role: SystemRole.ADMIN_SYSTEME, status: UserStatus.ACTIF }, select: { id: true } });
    for (const a of admins) {
      await this.notifications.notify(a.id, NotificationType.DOSSIER_ERREUR_SIGNALEE, 'Journal d’audit : chaîne rompue', `La vérification de nuit a trouvé une rupture. ${e instanceof Error ? e.message : ''}`.trim(), '/journal-audit', undefined, { libelleBouton: 'Voir le journal', urgent: true });
    }
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
    const where = await this.filtre(portee, f);
    const [total, lignes] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { numero: 'desc' },
        skip: (page - 1) * taille,
        take: taille,
        select: {
          id: true, numero: true, createdAt: true, action: true, entityType: true, entityId: true, metadata: true, rang: true,
          acteurInitial: true, auNomDeInitial: true, empreinte: true,
        },
      }),
    ]);
    const ids = [...new Set(lignes.flatMap((l) => [l.acteurInitial, l.auNomDeInitial]).filter((x): x is string => !!x))];
    const personnes = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const types = await this.prisma.auditLog.findMany({ where: portee, distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' }, take: 200 });
    const admin = actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId;
    const sceau = await this.etatRapide();
    return {
      droits: { peutVerifier: admin, peutExporter: true },
      portee: libelle,
      total,
      page,
      taille,
      typesObjets: types.map((t) => t.entityType),
      domaines: Object.entries(LIBELLE_DOMAINE).map(([valeur, libelle]) => ({ valeur, libelle })),
      // Le sceau n'apparaît qu'une fois, en tête : état, nombre d'entrées, dernière vérification.
      sceau: { intacte: sceau.derniere ? sceau.derniere.intacte : null, entrees: await this.prisma.auditLog.count(), derniereVerification: sceau.derniere?.date ?? null, scellementEnRetard: sceau.scellementEnRetard },
      entrees: await this.presenter(lignes, personnes),
    };
  }

  /** Filtres : période, auteur, type, action, domaine, « Sensibles seulement », recherche. */
  private async filtre(portee: Prisma.AuditLogWhereInput, f: FiltresAudit): Promise<Prisma.AuditLogWhereInput> {
    const typesDomaine = f.domaine ? Object.entries(TYPES).filter(([, t]) => t.domaine === (f.domaine as Domaine)).map(([k]) => k) : null;
    const sensibles: Prisma.AuditLogWhereInput = {
      OR: [
        { action: AuditAction.SUPPRESSION },
        { entityType: { in: Object.entries(TYPES).filter(([, t]) => t.sensible || t.protege).map(([k]) => k) } },
        ...EVENEMENTS_SENSIBLES.map((e) => ({ metadata: { path: ['event'], equals: e } })),
      ],
    };
    let recherche: Prisma.AuditLogWhereInput = {};
    const mots = motsRecherche(f.q ?? '');
    if (mots.length) {
      // Auteur nommé, type d'objet (par son libellé) ou identifiant exact.
      const auteurs = (await this.prisma.user.findMany({ select: { id: true, firstName: true, lastName: true } })).filter((u) => mots.every((m) => normaliser(`${u.firstName} ${u.lastName}`).includes(m))).map((u) => u.id);
      const types = Object.entries(TYPES).filter(([k, t]) => mots.every((m) => normaliser(`${t.objet} ${k}`).includes(m))).map(([k]) => k);
      recherche = { OR: [{ acteurInitial: { in: auteurs } }, { entityType: { in: types } }, { entityId: (f.q ?? '').trim() }] };
    }
    return {
      AND: [
        portee,
        f.du ? { createdAt: { gte: new Date(f.du) } } : {},
        f.au ? { createdAt: { lt: new Date(new Date(f.au).getTime() + 864e5) } } : {},
        f.acteurId ? { acteurInitial: f.acteurId } : {},
        f.entityType ? { entityType: f.entityType } : {},
        f.action ? { action: f.action } : {},
        typesDomaine ? { entityType: { in: typesDomaine } } : {},
        f.sensibles === '1' || f.sensibles === 'true' ? sensibles : {},
        recherche,
      ],
    };
  }

  /** Une entrée devient une phrase ; objet protégé : libellé générique, sans titre ni contenu ni avant/après. */
  private async presenter(
    lignes: { id: string; numero: number; createdAt: Date; action: AuditAction; entityType: string; entityId: string; metadata: Prisma.JsonValue; rang: number | null; acteurInitial: string | null; auNomDeInitial: string | null; empreinte: string | null }[],
    personnes: Map<string, string>,
  ) {
    const noms = await nommer(this.prisma, lignes.map((l) => ({ type: l.entityType, id: l.entityId })));
    return lignes.map((l) => {
      const meta = l.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata) ? (l.metadata as Record<string, unknown>) : {};
      const event = typeof meta.event === 'string' ? meta.event : null;
      const t = typeDe(l.entityType);
      const n = noms.get(`${l.entityType}:${l.entityId}`);
      const protege = !!t.protege || !!n?.protege || event === 'acces_objet_protege';
      const auteur = l.acteurInitial ? personnes.get(l.acteurInitial) ?? 'Compte supprimé' : 'Le système';
      const objetNomme = protege ? t.objet.replace(/^(le|la|l’|les) /, 'un ').replace(/^un (tâche|réunion|demande|famille|division|section|cellule|unité)/, 'une $1') : n?.nom ? `${t.objet} « ${n.nom} »` : t.objet;
      const objetFinal = protege && /courrier|acte/i.test(t.objet) && n?.protege ? 'un courrier confidentiel' : protege && event === 'acces_objet_protege' ? 'un élément protégé' : objetNomme;
      const avant = !protege && meta.avant && typeof meta.avant === 'object' ? (meta.avant as Record<string, unknown>) : null;
      const apres = !protege && meta.apres && typeof meta.apres === 'object' ? (meta.apres as Record<string, unknown>) : null;
      const champs = [...new Set([...Object.keys(avant ?? {}), ...Object.keys(apres ?? {})])];
      const valeur = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
      // Valeur simple (paramètre…) : une seule ligne « valeur ».
      const simple = !protege && ('avant' in meta || 'apres' in meta) && !avant && !apres && [meta.avant, meta.apres].every((v) => v === null || v === undefined || typeof v !== 'object');
      return {
        id: l.id,
        numero: l.numero,
        date: l.createdAt,
        jour: l.createdAt.toISOString().slice(0, 10),
        action: l.action,
        icone: event === 'acces_objet_protege' ? 'CONSULTATION' : event === 'export' ? 'EXPORT' : l.action,
        phrase: `${auteur}${l.auNomDeInitial ? ` (par intérim de ${personnes.get(l.auNomDeInitial) ?? 'un titulaire'})` : ''} ${verbe(l.action, event)} ${objetFinal}`,
        libelle: verbe(l.action, event),
        evenement: event,
        domaine: LIBELLE_DOMAINE[t.domaine],
        sensible: !!(t.sensible || protege || l.action === AuditAction.SUPPRESSION || (event && EVENEMENTS_SENSIBLES.includes(event))),
        objet: { type: l.entityType, libelle: objetFinal, protege, lien: protege || !t.lien || l.action === AuditAction.SUPPRESSION ? null : t.lien(l.entityId) },
        objetType: l.entityType,
        objetId: protege ? null : l.entityId,
        avantApres: simple ? [{ champ: 'valeur', avant: valeur(meta.avant), apres: valeur(meta.apres) }] : champs.map((c) => ({ champ: c, avant: valeur(avant?.[c]), apres: valeur(apres?.[c]) })),
        acteur: l.acteurInitial ? { id: l.acteurInitial, nom: auteur } : null,
        auNomDe: l.auNomDeInitial ? { id: l.auNomDeInitial, nom: personnes.get(l.auNomDeInitial) ?? 'Compte supprimé' } : null,
        scellee: l.rang !== null,
        empreinte: l.empreinte,
      };
    });
  }

  /** Export CSV ou PDF des entrées filtrées (5 000 au plus) ; l'export est lui-même journalisé. */
  async exporter(actor: AuthenticatedUser, f: FiltresAudit, format: 'csv' | 'pdf'): Promise<{ buffer: Buffer; nom: string; type: string }> {
    const { where: portee } = await this.portee(actor);
    const where = await this.filtre(portee, f);
    const lignes = await this.prisma.auditLog.findMany({
      where,
      orderBy: { numero: 'desc' },
      take: 5000,
      select: { id: true, numero: true, createdAt: true, action: true, entityType: true, entityId: true, metadata: true, rang: true, acteurInitial: true, auNomDeInitial: true, empreinte: true },
    });
    const ids = [...new Set(lignes.flatMap((l) => [l.acteurInitial, l.auNomDeInitial]).filter((x): x is string => !!x))];
    const personnes = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const entrees = await this.presenter(lignes, personnes);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'JournalAudit', entityId: 'export', metadata: { event: 'export', format, lignes: entrees.length } });
    const jour = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      const cel = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const csv = ['Numéro;Date;Phrase;Domaine;Sensible', ...entrees.map((e) => [String(e.numero), e.date.toISOString(), e.phrase, e.domaine, e.sensible ? 'oui' : 'non'].map(cel).join(';'))].join('\r\n');
      return { buffer: Buffer.from('\uFEFF' + csv, 'utf8'), nom: `journal-audit-${jour}.csv`, type: 'text/csv' };
    }
    const pdf = await PDFDocument.create();
    const police = await pdf.embedFont(StandardFonts.Helvetica);
    const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
    // Polices standard : les caractères hors latin-1 (guillemets typographiques…) sont remplacés.
    const sur = (t: string) => t.replace(/[’‘]/g, "'").replace(/[«»]/g, '"').replace(/[^\x00-\xFF]/g, '?');
    let page = pdf.addPage([842, 595]);
    let y = 560;
    page.drawText(sur(`Journal d’audit — export du ${new Date().toLocaleDateString('fr-FR')} (${entrees.length} entrées)`), { x: 30, y, size: 13, font: gras, color: rgb(0.07, 0.11, 0.3) });
    y -= 24;
    for (const e of entrees) {
      if (y < 30) {
        page = pdf.addPage([842, 595]);
        y = 560;
      }
      page.drawText(sur(`${e.numero}  ${e.date.toISOString().slice(0, 16).replace('T', ' ')}  ${e.phrase}`).slice(0, 150), { x: 30, y, size: 8.5, font: police });
      y -= 13;
    }
    return { buffer: Buffer.from(await pdf.save()), nom: `journal-audit-${jour}.pdf`, type: 'application/pdf' };
  }
}
