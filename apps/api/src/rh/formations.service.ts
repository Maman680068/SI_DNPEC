import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, EtatSessionFormation, NotificationType, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { estDrh } from '../socle/roles-fonctionnels';
import { chefsLesPlusProches, chefsLesPlusProchesMemo, type MemoChefs } from '../socle/chefs-proches';
import { ParametresService } from '../socle/parametres.service';
import { TachesPlanifieesService } from '../socle/taches-planifiees.service';
import { ModifierSessionFormationDto, SessionFormationDto } from './dto/rh.dto';

const J = 864e5;
const jour = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const SESSION_SELECT = {
  id: true,
  intitule: true,
  agentId: true,
  agent: { select: { id: true, firstName: true, lastName: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true } },
  besoinId: true,
  besoin: { select: { intitule: true } },
  dateDebut: true,
  dateFin: true,
  dureeJours: true,
  organisme: true,
  etat: true,
  alerteDebutAt: true,
  createdAt: true,
} satisfies Prisma.SessionFormationSelect;
type SessionLue = Prisma.SessionFormationGetPayload<{ select: typeof SESSION_SELECT }>;

/** Transitions permises (DRH) : souhaitée → planifiée → suivie ; annulée depuis souhaitée ou planifiée. */
const SUIVANTS: Record<EtatSessionFormation, EtatSessionFormation[]> = {
  SOUHAITEE: [EtatSessionFormation.PLANIFIEE, EtatSessionFormation.ANNULEE],
  PLANIFIEE: [EtatSessionFormation.SUIVIE, EtatSessionFormation.ANNULEE],
  SUIVIE: [],
  ANNULEE: [],
};

/**
 * Plan de formation individuel (docs/conception_plan_formation.md) : sessions de formation par agent.
 * Le DRH (rôle fonctionnel, jamais emprunté en intérim) crée, planifie, marque « suivie » ou annule ; la
 * Direction lit tout ; le chef le plus proche lit les sessions de ses agents ; l'agent lit les siennes
 * (« Mon profil ») ; tout autre profil reçoit un 403. Alerte 15 jours (paramètre) avant le début d'une
 * session planifiée, à l'agent et à son chef le plus proche, une seule fois.
 */
@Injectable()
export class FormationsService {
  private readonly logger = new Logger('Formations');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly parametres: ParametresService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  private direction(actor: AuthenticatedUser) {
    return actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
  }

  private exigerDrh(actor: AuthenticatedUser) {
    if (!estDrh(actor)) throw new ForbiddenException('Le plan de formation est tenu par le DRH.');
  }

  private vue(s: SessionLue, drh: boolean) {
    const fin = s.dateFin ?? (s.dureeJours ? new Date(s.dateDebut.getTime() + (s.dureeJours - 1) * J) : null);
    const duree = s.dureeJours ?? (s.dateFin ? Math.round((s.dateFin.getTime() - s.dateDebut.getTime()) / J) + 1 : null);
    return {
      id: s.id,
      intitule: s.intitule,
      agent: { id: s.agent.id, nom: `${s.agent.firstName} ${s.agent.lastName}` },
      besoin: s.besoinId ? { id: s.besoinId, intitule: s.besoin?.intitule ?? '' } : null,
      dateDebut: iso(s.dateDebut)!,
      dateFin: iso(fin),
      dureeJours: duree,
      organisme: s.organisme,
      etat: s.etat,
      droits: {
        planifier: drh && s.etat === EtatSessionFormation.SOUHAITEE,
        marquerSuivie: drh && s.etat === EtatSessionFormation.PLANIFIEE,
        annuler: drh && SUIVANTS[s.etat].includes(EtatSessionFormation.ANNULEE),
        modifier: drh && (s.etat === EtatSessionFormation.SOUHAITEE || s.etat === EtatSessionFormation.PLANIFIEE),
      },
    };
  }

  /** Plan visible : DRH et Direction tout ; chef le plus proche les sessions de ses agents ; autres : 403. */
  async plan(actor: AuthenticatedUser) {
    const drh = estDrh(actor);
    const toutes = await this.prisma.sessionFormation.findMany({ select: SESSION_SELECT, orderBy: [{ dateDebut: 'asc' }, { createdAt: 'asc' }] });
    let visibles: SessionLue[];
    if (drh || this.direction(actor)) visibles = toutes;
    else {
      const memo: MemoChefs = new Map();
      visibles = [];
      for (const s of toutes) if ((await chefsLesPlusProchesMemo(this.prisma, s.agent, memo)).includes(actor.id)) visibles.push(s);
      const chef = [SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE].includes(actor.role as never);
      if (!chef && visibles.length === 0) throw new ForbiddenException('Le plan de formation est consulté par le DRH, la Direction et les chefs pour leurs agents.');
    }
    return {
      sessions: visibles.map((s) => this.vue(s, drh)),
      droits: { creer: drh },
      // Listes de choix (DRH) : comptes actifs hors stagiaires, besoins retenus.
      agentsPossibles: drh
        ? (await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })).map((u) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}` }))
        : [],
      besoinsRetenus: drh ? (await this.prisma.besoinFormation.findMany({ where: { statut: 'RETENU' }, select: { id: true, intitule: true, annee: true }, orderBy: [{ annee: 'desc' }, { intitule: 'asc' }] })) : [],
    };
  }

  /** Les sessions de la personne connectée (« Mon profil »). */
  async miennes(actor: AuthenticatedUser) {
    const l = await this.prisma.sessionFormation.findMany({ where: { agentId: actor.id, etat: { not: EtatSessionFormation.ANNULEE } }, select: SESSION_SELECT, orderBy: { dateDebut: 'desc' } });
    return l.map((s) => this.vue(s, false));
  }

  private verifierPeriode(debut: Date, fin: Date | null, duree: number | null | undefined) {
    if (fin && fin < debut) throw new BadRequestException('La fin doit être postérieure ou égale au début.');
    if (!fin && !duree) throw new BadRequestException('Indiquez la date de fin ou la durée.');
  }

  async creer(actor: AuthenticatedUser, dto: SessionFormationDto) {
    this.exigerDrh(actor);
    const agent = await this.prisma.user.findUnique({ where: { id: dto.agentId }, select: { status: true, role: true } });
    if (!agent || agent.status !== UserStatus.ACTIF || agent.role === SystemRole.STAGIAIRE) throw new BadRequestException('Agent introuvable ou inactif.');
    if (dto.besoinId) {
      const b = await this.prisma.besoinFormation.findUnique({ where: { id: dto.besoinId }, select: { statut: true } });
      if (!b) throw new NotFoundException('Besoin introuvable.');
      if (b.statut !== 'RETENU') throw new ConflictException('Seul un besoin retenu peut être planifié.');
    }
    const debut = jour(dto.dateDebut);
    const fin = dto.dateFin ? jour(dto.dateFin) : null;
    this.verifierPeriode(debut, fin, dto.dureeJours);
    const s = await this.prisma.sessionFormation.create({
      data: {
        intitule: dto.intitule.trim(),
        agentId: dto.agentId,
        besoinId: dto.besoinId ?? null,
        dateDebut: debut,
        dateFin: fin,
        dureeJours: dto.dureeJours ?? null,
        organisme: dto.organisme?.trim() || null,
        etat: dto.planifier ? EtatSessionFormation.PLANIFIEE : EtatSessionFormation.SOUHAITEE,
        creeParId: actor.id,
      },
      select: SESSION_SELECT,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'SessionFormation', entityId: s.id, metadata: { agentId: s.agentId, besoinId: s.besoinId, etat: s.etat } });
    return this.vue(s, true);
  }

  private async charger(id: string) {
    const s = await this.prisma.sessionFormation.findUnique({ where: { id }, select: SESSION_SELECT });
    if (!s) throw new NotFoundException('Session de formation introuvable.');
    return s;
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierSessionFormationDto) {
    this.exigerDrh(actor);
    const s = await this.charger(id);
    if (s.etat === EtatSessionFormation.SUIVIE || s.etat === EtatSessionFormation.ANNULEE) throw new ConflictException('Une session suivie ou annulée ne se modifie plus.');
    const debut = dto.dateDebut ? jour(dto.dateDebut) : s.dateDebut;
    const fin = dto.dateFin !== undefined ? (dto.dateFin ? jour(dto.dateFin) : null) : s.dateFin;
    const duree = dto.dureeJours !== undefined ? dto.dureeJours : s.dureeJours;
    this.verifierPeriode(debut, fin, duree);
    const debutChange = debut.getTime() !== s.dateDebut.getTime();
    const m = await this.prisma.sessionFormation.update({
      where: { id },
      // Nouvelle date de début : l'alerte « début proche » sera de nouveau envoyée.
      data: { dateDebut: debut, dateFin: fin, dureeJours: duree, organisme: dto.organisme === undefined ? undefined : dto.organisme.trim() || null, ...(debutChange ? { alerteDebutAt: null } : {}) },
      select: SESSION_SELECT,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'SessionFormation', entityId: id, metadata: { champs: Object.keys(dto) } });
    return this.vue(m, true);
  }

  async changerEtat(actor: AuthenticatedUser, id: string, vers: EtatSessionFormation) {
    this.exigerDrh(actor);
    const s = await this.charger(id);
    if (!SUIVANTS[s.etat].includes(vers)) throw new ConflictException(`Passage impossible : ${s.etat.toLowerCase()} → ${vers.toLowerCase()}.`);
    if (vers === EtatSessionFormation.SUIVIE && s.dateDebut.getTime() > Date.now()) throw new ConflictException('Une session qui n’a pas commencé ne peut pas être marquée suivie.');
    const m = await this.prisma.sessionFormation.update({ where: { id }, data: { etat: vers }, select: SESSION_SELECT });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'SessionFormation', entityId: id, metadata: { event: 'etat_session_formation', de: s.etat, vers } });
    return this.vue(m, true);
  }

  // ------------------------------------------------------------------ alerte « début proche »

  @Cron('20 6 * * *')
  async executerQuotidien(): Promise<void> {
    try {
      await this.taches.suivre('alertes-formation', () => this.executer(new Date()));
    } catch (e) {
      this.logger.error(`Alertes de formation : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Sessions planifiées qui commencent dans le délai du paramètre : agent et chef le plus proche prévenus, une fois. */
  async executer(maintenant: Date): Promise<{ alertes: number }> {
    const delai = await this.parametres.valeur('rh.formationAlerteJours');
    const auj = jour(maintenant.toISOString());
    const sessions = await this.prisma.sessionFormation.findMany({
      where: { etat: EtatSessionFormation.PLANIFIEE, alerteDebutAt: null, dateDebut: { gte: auj, lte: new Date(auj.getTime() + delai * J) } },
      select: SESSION_SELECT,
    });
    let alertes = 0;
    for (const s of sessions) {
      // Marqué d'abord : une seconde exécution concurrente ne renvoie rien.
      const pris = await this.prisma.sessionFormation.updateMany({ where: { id: s.id, alerteDebutAt: null }, data: { alerteDebutAt: maintenant } });
      if (!pris.count) continue;
      const nom = `${s.agent.firstName} ${s.agent.lastName}`;
      const quand = dateFr(s.dateDebut);
      await this.notifications.notify(s.agentId, NotificationType.TACHE_ECHEANCE_PROCHE, 'Votre formation commence bientôt', `« ${s.intitule} » commence le ${quand}.`, '/compte?section=formations', undefined, { libelleBouton: 'Voir mes formations' });
      for (const chef of await chefsLesPlusProches(this.prisma, s.agent)) {
        await this.notifications.notify(chef, NotificationType.TACHE_ECHEANCE_PROCHE, 'Formation d’un agent : début proche', `${nom} commence la formation « ${s.intitule} » le ${quand}.`, '/rh?onglet=formation', nom, { libelleBouton: 'Voir le plan de formation' });
      }
      await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'SessionFormation', entityId: s.id, metadata: { event: 'alerte_debut_formation' } });
      alertes++;
    }
    return { alertes };
  }
}
