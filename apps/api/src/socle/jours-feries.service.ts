import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, LeaveRequestStatus, NotificationType, Prisma, RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { TachesPlanifieesService } from './taches-planifiees.service';
import { detenteursWhere, estDrh } from './roles-fonctionnels';
import { JourFerieDto, LotJoursFeriesDto, ModifierJourFerieDto } from './dto/jours-feries.dto';

/** Fêtes fixes nationales de Guinée (mois-jour), reprises d'une année sur l'autre ; les fêtes
 * religieuses (Tabaski, fin du Ramadan, Maouloud, lundi de Pâques…) se saisissent chaque année. */
export const FETES_FIXES: [string, string][] = [
  ['01-01', 'Jour de l’An'],
  ['05-01', 'Fête du Travail'],
  ['05-25', 'Journée de l’Afrique'],
  ['08-15', 'Assomption'],
  ['10-02', 'Fête de l’Indépendance'],
  ['12-25', 'Noël'],
];
export const NATURES_JOUR_FERIE = ['FIXE', 'RELIGIEUX'] as const;

/** Dimanche de Pâques (calendrier grégorien, algorithme dit « anonyme »), au format AAAA-MM-JJ. */
export function dimancheDePaques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jourDuMois = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jourDuMois).padStart(2, '0')}`;
}

/**
 * Fêtes religieuses à date variable : dates ESTIMÉES (calendrier lunaire, à vérifier avec le décret de
 * l'année), table tenue dans le code. Année absente : champs vides, date à saisir.
 */
const FETES_RELIGIEUSES = [
  { cle: 'LAILATOUL_QADR', libelle: 'Lailatoul Qadr' },
  { cle: 'KORITE', libelle: 'Korité (fin du Ramadan)' },
  { cle: 'LUNDI_PAQUES', libelle: 'Lundi de Pâques' },
  { cle: 'TABASKI', libelle: 'Tabaski' },
  { cle: 'LENDEMAIN_TABASKI', libelle: 'Lendemain de la Tabaski (si décrété)' },
  { cle: 'MAOULOUD', libelle: 'Maouloud' },
] as const;
const DATES_ESTIMEES: Record<number, Partial<Record<(typeof FETES_RELIGIEUSES)[number]['cle'], string>>> = {
  2026: { LAILATOUL_QADR: '03-17', KORITE: '03-20', TABASKI: '05-27', LENDEMAIN_TABASKI: '05-28', MAOULOUD: '08-25' },
};
const estWeekEnd = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const J = 864e5;
const jour = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
const CLE_ALERTE = (annee: number) => `jours-feries.alerte.${annee}`;

/**
 * Calendrier des jours fériés (socle N3) : saisi à l'écran année par année par l'administrateur
 * système ou le DRH ; lu par tous. Exclu du délai d'avis en heures ouvrées et du décompte des jours
 * de congé. Tâche quotidienne `jours-feries` : à partir du 1er janvier, alerte unique à
 * l'administrateur et au DRH si l'année suivante n'a aucun jour férié (ou l'année en cours aucune
 * fête religieuse).
 */
@Injectable()
export class JoursFeriesService {
  private readonly logger = new Logger('JoursFeries');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  private peutGerer(actor: AuthenticatedUser) {
    return actor.role === SystemRole.ADMIN_SYSTEME || estDrh(actor);
  }

  private exigerGestion(actor: AuthenticatedUser) {
    if (!this.peutGerer(actor)) throw new ForbiddenException('Le calendrier des jours fériés est tenu par l’administrateur système et le DRH.');
  }

  /** Jours fériés entre deux dates (incluses), au format AAAA-MM-JJ. */
  async ensemble(debut: Date, fin: Date): Promise<Set<string>> {
    const l = await this.prisma.jourFerie.findMany({ where: { date: { gte: new Date(`${jour(debut)}T00:00:00Z`), lte: new Date(`${jour(fin)}T00:00:00Z`) } }, select: { date: true } });
    return new Set(l.map((x) => jour(x.date)));
  }

  /** Jours fériés utiles pour un délai en heures ouvrées partant de `depuis` (horizon de 120 jours). */
  horizon(depuis: Date): Promise<Set<string>> {
    return this.ensemble(new Date(depuis.getTime() - J), new Date(depuis.getTime() + 120 * J));
  }

  /** Jours de congé décomptés : jours calendaires de la période, jours fériés exclus. */
  async joursDecomptes(debut: Date, fin: Date): Promise<{ jours: number; feries: number }> {
    const calendaires = Math.floor((Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate()) - Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate())) / J) + 1;
    const feries = (await this.ensemble(debut, fin)).size;
    return { jours: Math.max(0, calendaires - feries), feries };
  }

  // ------------------------------------------------------------------ écran

  async lister(actor: AuthenticatedUser, annee: number, maintenant = new Date()) {
    const jours = await this.prisma.jourFerie.findMany({
      where: { date: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) } },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, libelle: true, nature: true },
    });
    const presentes = new Set(jours.map((j) => jour(j.date).slice(5)));
    const aujourdhui = jour(maintenant);
    // Prochain jour férié, tous calendriers confondus (pas seulement l'année affichée).
    const prochain = await this.prisma.jourFerie.findFirst({ where: { date: { gte: new Date(`${aujourdhui}T00:00:00Z`) } }, orderBy: { date: 'asc' }, select: { id: true, date: true, libelle: true } });
    const vus = jours.map((j) => ({ ...j, weekEnd: estWeekEnd(j.date), passe: jour(j.date) < aujourdhui, prochain: j.id === prochain?.id }));
    const gerer = this.peutGerer(actor);
    return {
      annee,
      jours: vus,
      prochain: prochain ? { date: jour(prochain.date), libelle: prochain.libelle, dansJours: Math.round((new Date(`${jour(prochain.date)}T00:00:00Z`).getTime() - new Date(`${aujourdhui}T00:00:00Z`).getTime()) / J) } : null,
      chiffres: { saisis: vus.length, enSemaine: vus.filter((j) => !j.weekEnd).length, weekEnd: vus.filter((j) => j.weekEnd).length },
      fixesManquantes: FETES_FIXES.filter(([md]) => !presentes.has(md)).map(([md, libelle]) => ({ date: `${annee}-${md}`, libelle })),
      religieusesSaisies: jours.some((j) => j.nature === 'RELIGIEUX'),
      // « Vérifier et ajouter » : fêtes religieuses proposées, lundi de Pâques calculé, les autres estimées.
      religieusesProposees: gerer ? this.religieusesProposees(annee, jours) : [],
      aRecalculer: await this.aRecalculer(actor, annee),
      droits: { gerer, recalculer: estDrh(actor) },
    };
  }

  private religieusesProposees(annee: number, jours: { date: Date; libelle: string }[]) {
    const pris = new Set(jours.map((j) => jour(j.date)));
    const paques = new Date(`${dimancheDePaques(annee)}T00:00:00Z`);
    const lundi = jour(new Date(paques.getTime() + J));
    return FETES_RELIGIEUSES.map((f) => {
      const md = DATES_ESTIMEES[annee]?.[f.cle];
      const date = f.cle === 'LUNDI_PAQUES' ? lundi : md ? `${annee}-${md}` : null;
      return { cle: f.cle, libelle: f.libelle, date, aVerifier: f.cle !== 'LUNDI_PAQUES', dejaSaisie: !!date && pris.has(date) };
    });
  }

  /**
   * Congés approuvés de l'année dont le nombre de jours enregistré (figé à l'approbation) ne correspond
   * plus au calendrier des jours fériés — à recalculer congé par congé par le DRH. L'administrateur n'en
   * voit que le nombre (aucun nom, aucune période) ; les autres rien.
   */
  async aRecalculer(actor: AuthenticatedUser, annee: number): Promise<{ nombre: number; conges: { id: string; agent: string; debut: string; fin: string; joursEnregistres: number; joursRecalcules: number }[] }> {
    if (!this.peutGerer(actor)) return { nombre: 0, conges: [] };
    const debut = new Date(Date.UTC(annee, 0, 1));
    const fin = new Date(Date.UTC(annee + 1, 0, 1));
    const conges = await this.prisma.leaveRequest.findMany({
      where: { status: LeaveRequestStatus.APPROUVEE, startDate: { lt: fin }, endDate: { gte: debut } },
      select: { id: true, startDate: true, endDate: true, daysCount: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { startDate: 'asc' },
    });
    if (!conges.length) return { nombre: 0, conges: [] };
    const feries = await this.ensemble(new Date(Math.min(...conges.map((c) => c.startDate.getTime()))), new Date(Math.max(...conges.map((c) => c.endDate.getTime()))));
    const ecarts = conges
      .map((c) => {
        const calendaires = Math.floor((Date.UTC(c.endDate.getUTCFullYear(), c.endDate.getUTCMonth(), c.endDate.getUTCDate()) - Date.UTC(c.startDate.getUTCFullYear(), c.startDate.getUTCMonth(), c.startDate.getUTCDate())) / J) + 1;
        let f = 0;
        for (let k = 0; k < calendaires; k++) if (feries.has(jour(new Date(Date.UTC(c.startDate.getUTCFullYear(), c.startDate.getUTCMonth(), c.startDate.getUTCDate()) + k * J)))) f++;
        return { c, recalcule: Math.max(0, calendaires - f) };
      })
      .filter((x) => x.recalcule !== x.c.daysCount);
    if (!estDrh(actor)) return { nombre: ecarts.length, conges: [] };
    return {
      nombre: ecarts.length,
      conges: ecarts.map(({ c, recalcule }) => ({ id: c.id, agent: `${c.user.firstName} ${c.user.lastName}`, debut: jour(c.startDate), fin: jour(c.endDate), joursEnregistres: c.daysCount, joursRecalcules: recalcule })),
    };
  }

  /** Recalcul d'UN congé approuvé selon le calendrier actuel (DRH), solde ajusté d'autant, audité. */
  async recalculerConge(actor: AuthenticatedUser, id: string) {
    if (!estDrh(actor)) throw new ForbiddenException('Le recalcul d’un congé est fait par le DRH.');
    const c = await this.prisma.leaveRequest.findUnique({ where: { id }, select: { id: true, status: true, userId: true, leaveTypeId: true, startDate: true, endDate: true, daysCount: true } });
    if (!c) throw new NotFoundException('Congé introuvable');
    if (c.status !== LeaveRequestStatus.APPROUVEE) throw new ConflictException('Seul un congé approuvé se recalcule.');
    const { jours } = await this.joursDecomptes(c.startDate, c.endDate);
    const apres = Math.max(0, jours);
    if (apres === c.daysCount) throw new ConflictException('Ce congé est déjà à jour du calendrier.');
    const ecart = apres - c.daysCount;
    await this.prisma.$transaction(async (tx) => {
      // Mise à jour conditionnelle : deux recalculs simultanés n'ajustent le solde qu'une fois.
      const r = await tx.leaveRequest.updateMany({ where: { id, daysCount: c.daysCount, status: LeaveRequestStatus.APPROUVEE }, data: { daysCount: apres } });
      if (!r.count) throw new ConflictException('Ce congé vient d’être modifié : rechargez la liste.');
      await tx.leaveBalance.updateMany({ where: { userId: c.userId, leaveTypeId: c.leaveTypeId, year: c.startDate.getFullYear() }, data: { usedDays: { increment: ecart } } });
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'LeaveRequest', entityId: id, metadata: { event: 'recalcul_jours_feries', avant: c.daysCount, apres } });
    return { id, joursAvant: c.daysCount, joursApres: apres };
  }

  /** « Vérifier et ajouter » : plusieurs jours fériés d'un coup (jamais en double). */
  async ajouterLot(actor: AuthenticatedUser, dto: LotJoursFeriesDto) {
    this.exigerGestion(actor);
    let ajoutes = 0;
    for (const j of dto.jours) {
      const r = await this.prisma.jourFerie.createMany({ data: [{ date: new Date(`${jour(j.date)}T00:00:00Z`), libelle: j.libelle.trim(), nature: j.nature, creeParId: actor.id }], skipDuplicates: true });
      ajoutes += r.count;
    }
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'JourFerie', entityId: String(dto.annee), metadata: { event: 'fetes_ajoutees_en_lot', ajoutes } });
    return { ajoutes, calendrier: await this.lister(actor, dto.annee) };
  }

  async creer(actor: AuthenticatedUser, dto: JourFerieDto) {
    this.exigerGestion(actor);
    const date = new Date(`${jour(dto.date)}T00:00:00Z`);
    try {
      const j = await this.prisma.jourFerie.create({ data: { date, libelle: dto.libelle.trim(), nature: dto.nature, creeParId: actor.id }, select: { id: true, date: true, libelle: true, nature: true } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'JourFerie', entityId: j.id, metadata: { date: jour(date), libelle: j.libelle, nature: j.nature } });
      return { ...j, aRecalculer: await this.aRecalculer(actor, date.getUTCFullYear()) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ce jour est déjà férié.');
      throw e;
    }
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierJourFerieDto) {
    this.exigerGestion(actor);
    const avant = await this.prisma.jourFerie.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException('Jour férié introuvable');
    try {
      const j = await this.prisma.jourFerie.update({
        where: { id },
        data: { date: dto.date ? new Date(`${jour(dto.date)}T00:00:00Z`) : undefined, libelle: dto.libelle?.trim(), nature: dto.nature },
        select: { id: true, date: true, libelle: true, nature: true },
      });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'JourFerie', entityId: id, metadata: { avant: { date: jour(avant.date), libelle: avant.libelle }, apres: { date: jour(j.date), libelle: j.libelle } } });
      return { ...j, aRecalculer: await this.aRecalculer(actor, j.date.getUTCFullYear()) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ce jour est déjà férié.');
      throw e;
    }
  }

  async supprimer(actor: AuthenticatedUser, id: string) {
    this.exigerGestion(actor);
    const j = await this.prisma.jourFerie.findUnique({ where: { id } });
    if (!j) throw new NotFoundException('Jour férié introuvable');
    await this.prisma.jourFerie.delete({ where: { id } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'JourFerie', entityId: id, metadata: { date: jour(j.date), libelle: j.libelle } });
    return { supprime: true, aRecalculer: await this.aRecalculer(actor, j.date.getUTCFullYear()) };
  }

  /** Ajoute à l'année les fêtes fixes nationales qui lui manquent (jamais en double). */
  async reprendreFixes(actor: AuthenticatedUser, annee: number) {
    this.exigerGestion(actor);
    if (annee < 2000 || annee > 2100) throw new BadRequestException('Année invalide.');
    const r = await this.prisma.jourFerie.createMany({
      data: FETES_FIXES.map(([md, libelle]) => ({ date: new Date(`${annee}-${md}T00:00:00Z`), libelle, nature: 'FIXE', creeParId: actor.id })),
      skipDuplicates: true,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'JourFerie', entityId: String(annee), metadata: { event: 'fetes_fixes_reprises', ajoutees: r.count } });
    return this.lister(actor, annee);
  }

  // ------------------------------------------------------------------ alerte annuelle

  @Cron('30 6 * * *')
  async quotidien(): Promise<void> {
    await this.taches.suivre('jours-feries', () => this.verifier(new Date())).catch((e) => this.logger.error(`Jours fériés : ${e instanceof Error ? e.message : e}`));
  }

  /** `maintenant` simulable. Alerte une fois par an (marqueur en paramètre). */
  async verifier(maintenant: Date): Promise<{ alerte: boolean; manque: string[] }> {
    const annee = maintenant.getUTCFullYear();
    const suivante = await this.prisma.jourFerie.count({ where: { date: { gte: new Date(Date.UTC(annee + 1, 0, 1)), lt: new Date(Date.UTC(annee + 2, 0, 1)) } } });
    const religieuses = await this.prisma.jourFerie.count({ where: { nature: 'RELIGIEUX', date: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) } } });
    const manque: string[] = [];
    if (!suivante) manque.push(`aucun jour férié n’est saisi pour ${annee + 1}`);
    if (!religieuses) manque.push(`aucune fête religieuse n’est saisie pour ${annee}`);
    if (!manque.length) return { alerte: false, manque };
    const deja = await this.prisma.parametre.findUnique({ where: { cle: CLE_ALERTE(annee) } });
    if (deja) return { alerte: false, manque };
    await this.prisma.parametre.create({ data: { cle: CLE_ALERTE(annee), valeur: { le: maintenant.toISOString(), manque } } });
    const destinataires = await this.prisma.user.findMany({
      where: { OR: [{ role: SystemRole.ADMIN_SYSTEME, status: UserStatus.ACTIF }, detenteursWhere(RoleFonctionnel.DRH)] },
      select: { id: true },
    });
    const anneeLien = suivante ? annee : annee + 1;
    for (const u of destinataires) {
      await this.notifications.notify(
        u.id,
        NotificationType.DOSSIER_ERREUR_SIGNALEE,
        'Calendrier des jours fériés à compléter',
        `${manque.join(' ; ')}. Sans calendrier à jour, les jours fériés comptent dans les délais d’avis et les jours de congé.`,
        `/leaves?onglet=feries&annee=${anneeLien}`,
        undefined,
        { libelleBouton: 'Compléter le calendrier' },
      );
    }
    return { alerte: true, manque };
  }
}
