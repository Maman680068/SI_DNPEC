import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, NotificationType, Prisma, RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { TachesPlanifieesService } from './taches-planifiees.service';
import { detenteursWhere, estDrh } from './roles-fonctionnels';
import { JourFerieDto, ModifierJourFerieDto } from './dto/jours-feries.dto';

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

  async lister(actor: AuthenticatedUser, annee: number) {
    const jours = await this.prisma.jourFerie.findMany({
      where: { date: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) } },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, libelle: true, nature: true },
    });
    const presentes = new Set(jours.map((j) => jour(j.date).slice(5)));
    return {
      annee,
      jours,
      fixesManquantes: FETES_FIXES.filter(([md]) => !presentes.has(md)).map(([md, libelle]) => ({ date: `${annee}-${md}`, libelle })),
      religieusesSaisies: jours.some((j) => j.nature === 'RELIGIEUX'),
      droits: { gerer: this.peutGerer(actor) },
    };
  }

  async creer(actor: AuthenticatedUser, dto: JourFerieDto) {
    this.exigerGestion(actor);
    const date = new Date(`${jour(dto.date)}T00:00:00Z`);
    try {
      const j = await this.prisma.jourFerie.create({ data: { date, libelle: dto.libelle.trim(), nature: dto.nature, creeParId: actor.id }, select: { id: true, date: true, libelle: true, nature: true } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'JourFerie', entityId: j.id, metadata: { date: jour(date), libelle: j.libelle, nature: j.nature } });
      return j;
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
      return j;
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
    return { supprime: true };
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
