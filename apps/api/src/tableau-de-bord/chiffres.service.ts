import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus, MeetingStatus, StageStatut, StatutInstruction, StatutTravailCalcul, SystemRole, TaskStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TasksService } from '../tasks/tasks.service';
import { LeaveRequestsService, CODE_CONGE_ANNUEL } from '../leaves/leave-requests/leave-requests.service';
import { DecisionsService } from '../meetings/decisions.service';
import { MeetingsService } from '../meetings/meetings.service';
import { InstructionsService } from '../instructions/instructions.service';
import { PlanTravailService } from '../plan-travail/plan-travail.service';
import { EffectifsService } from '../rh/effectifs.service';
import { CourrierTableauDeBordService } from '../courrier/tableau-de-bord.service';
import { SupervisionService } from '../socle/supervision.service';
import { CLE_VERIFICATION_NOCTURNE } from '../socle/journal-audit.service';
import { estDrh } from '../socle/roles-fonctionnels';

const J = 864e5;
const CHEFS: SystemRole[] = [SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE];
const STATUTS_CLOS: TaskStatus[] = [TaskStatus.TERMINEE, TaskStatus.VALIDEE];
const INSTRUCTIONS_OUVERTES: StatutInstruction[] = [StatutInstruction.EMISE, StatutInstruction.RECUE, StatutInstruction.PRISE_EN_COMPTE];
const jourFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export type ProfilChiffres = 'DIRECTION' | 'DRH' | 'ADMINISTRATEUR' | 'ASSISTANT' | 'CHEF' | 'AGENT';
export interface Chiffre {
  cle: string;
  /** Nombre, ou texte court (« 63 % », une date) ; null si rien à mesurer. */
  valeur: number | string | null;
  libelle: string;
  sous: string;
  /** Ton de la valeur : encre, rouge (retard, échec), ambre (attente), vert (abouti). */
  ton: 'encre' | 'rouge' | 'ambre' | 'vert';
  /** Page concernée ; null quand le profil n'a pas accès à cette page (stagiaire et congés). */
  lien: string | null;
}

/**
 * Bande des quatre chiffres du tableau de bord, selon le profil (rôle effectif, intérim compris ; le DRH
 * reste un rôle fonctionnel personnel). Chaque chiffre est calculé par la requête du module concerné,
 * avec les mêmes règles que son écran : jamais plus que ce que la personne y voit, jamais un objet protégé.
 */
@Injectable()
export class ChiffresTableauService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly conges: LeaveRequestsService,
    private readonly decisions: DecisionsService,
    private readonly meetings: MeetingsService,
    private readonly instructions: InstructionsService,
    private readonly plan: PlanTravailService,
    private readonly effectifs: EffectifsService,
    private readonly courrier: CourrierTableauDeBordService,
    private readonly supervision: SupervisionService,
  ) {}

  profil(actor: AuthenticatedUser): ProfilChiffres {
    if (actor.role === SystemRole.DN || actor.role === SystemRole.DNA) return 'DIRECTION';
    if (estDrh(actor)) return 'DRH';
    if (actor.role === SystemRole.ADMIN_SYSTEME) return 'ADMINISTRATEUR';
    if (actor.role === SystemRole.ASSISTANT_DIRECTION) return 'ASSISTANT';
    if (CHEFS.includes(actor.role)) return 'CHEF';
    return 'AGENT'; // chargé d'études, stagiaire
  }

  async chiffres(actor: AuthenticatedUser, maintenant = new Date()): Promise<{ profil: ProfilChiffres; chiffres: Chiffre[] }> {
    const profil = this.profil(actor);
    const f = {
      DIRECTION: () => this.direction(actor, maintenant),
      DRH: () => this.drh(actor, maintenant),
      ADMINISTRATEUR: () => this.administrateur(),
      ASSISTANT: () => this.assistant(actor, maintenant),
      CHEF: () => this.chef(actor),
      AGENT: () => this.agent(actor, maintenant),
    }[profil];
    return { profil, chiffres: await f() };
  }

  private ouvertes(l: { statut: StatutInstruction; emiseLe: Date | string }[], maintenant: Date) {
    const o = l.filter((i) => INSTRUCTIONS_OUVERTES.includes(i.statut));
    const plusAncienne = o.reduce<number | null>((m, i) => Math.max(m ?? 0, Math.floor((maintenant.getTime() - new Date(i.emiseLe).getTime()) / J)), null);
    return { nombre: o.length, sous: o.length ? `la plus ancienne depuis ${plusAncienne} j` : 'toutes exécutées' };
  }

  private async direction(actor: AuthenticatedUser, maintenant: Date): Promise<Chiffre[]> {
    const [p, t, inst, d] = await Promise.all([
      this.plan.plan(actor, { annee: maintenant.getUTCFullYear() } as never),
      this.tasks.dashboard(actor),
      this.instructions.liste(actor),
      this.decisions.dashboard(actor),
    ]);
    const av = p.objectifs.map((o) => o.avancement);
    const i = this.ouvertes(inst.emises, maintenant);
    return [
      { cle: 'plan', valeur: av.length ? `${Math.round(av.reduce((s, x) => s + x, 0) / av.length)} %` : null, libelle: 'Plan de travail', sous: av.length ? `avancement moyen ${maintenant.getUTCFullYear()}` : 'aucun objectif cette année', ton: 'encre', lien: '/plan-travail' },
      { cle: 'taches-retard', valeur: t.enRetard, libelle: 'Tâches en retard', sous: 'dans le périmètre', ton: 'rouge', lien: '/tasks?onglet=perimetre&echeance=retard' },
      { cle: 'instructions', valeur: i.nombre, libelle: 'Instructions non exécutées', sous: i.sous, ton: 'ambre', lien: '/instructions' },
      { cle: 'decisions', valeur: d.total, libelle: 'Décisions non exécutées', sous: `${d.enRetard} en retard · ${d.sansAction} sans action`, ton: 'ambre', lien: '/reunions' },
    ];
  }

  private async drh(actor: AuthenticatedUser, maintenant: Date): Promise<Chiffre[]> {
    const [e, demandes, a, stagiaires] = await Promise.all([
      this.effectifs.effectifs(actor, maintenant),
      this.conges.findAllVisibleTo(actor, { status: LeaveRequestStatus.EN_ATTENTE } as never),
      this.effectifs.resumeAlertes(maintenant),
      this.prisma.stage.count({ where: { statut: StageStatut.EN_COURS } }),
    ]);
    const aDecider = demandes.filter((r) => r.droits.peutDecider).length;
    return [
      { cle: 'effectif', valeur: e.total, libelle: 'Effectif en fonction', sous: 'agents en activité ou suspendus', ton: 'encre', lien: '/rh?onglet=effectifs' },
      { cle: 'conges-decision', valeur: aDecider, libelle: 'Congés à décider', sous: 'avis du chef rendu', ton: 'ambre', lien: '/leaves?onglet=validation' },
      { cle: 'alertes-rh', valeur: a.total, libelle: 'Alertes RH ouvertes', sous: `${a.haute} urgente(s)`, ton: a.haute ? 'rouge' : 'ambre', lien: '/rh?onglet=alertes' },
      { cle: 'stagiaires', valeur: stagiaires, libelle: 'Stagiaires en cours', sous: 'stages commencés', ton: 'vert', lien: '/stages' },
    ];
  }

  private async administrateur(): Promise<Chiffre[]> {
    const [comptes, points, travaux, echecs, verif] = await Promise.all([
      this.prisma.user.count({ where: { status: UserStatus.EN_ATTENTE } }),
      this.supervision.pointsATraiter(),
      this.prisma.travailCalcul.count({ where: { statut: { in: [StatutTravailCalcul.EN_FILE, StatutTravailCalcul.EN_COURS, StatutTravailCalcul.ECHEC] } } }),
      this.prisma.travailCalcul.count({ where: { statut: StatutTravailCalcul.ECHEC } }),
      this.prisma.parametre.findUnique({ where: { cle: CLE_VERIFICATION_NOCTURNE } }),
    ]);
    const v = verif?.valeur as { date?: string; intacte?: boolean } | null | undefined;
    return [
      { cle: 'comptes', valeur: comptes, libelle: 'Comptes en attente', sous: 'demandes d’accès à activer', ton: 'ambre', lien: '/users' },
      { cle: 'supervision', valeur: points.length, libelle: 'Points de supervision', sous: points.length ? 'à traiter' : 'tout fonctionne', ton: points.length ? 'rouge' : 'vert', lien: '/parametrage?onglet=supervision' },
      { cle: 'calcul', valeur: travaux, libelle: 'Travaux du calcul', sous: `en attente ou en échec · dont ${echecs} en échec`, ton: echecs ? 'rouge' : 'encre', lien: '/parametrage?onglet=supervision' },
      {
        cle: 'audit',
        valeur: v?.date ? jourFr(new Date(v.date)) : null,
        libelle: 'Chaîne d’audit',
        sous: v?.date ? (v.intacte === false ? 'rompue à la dernière vérification' : 'dernière vérification, intacte') : 'jamais vérifiée',
        ton: v?.intacte === false ? 'rouge' : 'vert',
        lien: '/journal-audit',
      },
    ];
  }

  /** Assistant de direction : uniquement ce que ses écrans lui montrent (visibilité héritée de son
   * superviseur pour le courrier et les réunions), jamais d'objet protégé. */
  private async assistant(actor: AuthenticatedUser, maintenant: Date): Promise<Chiffre[]> {
    const sup = (await this.prisma.user.findUnique({ where: { id: actor.interimForId ?? actor.id }, select: { supervisorId: true } }))?.supervisorId ?? null;
    const [c, inst, reunions] = await Promise.all([
      this.courrier.pour(actor),
      this.instructions.liste(actor),
      sup
        ? this.prisma.meeting.count({
            where: { AND: [this.meetings.getMeetingVisibilityWhere(actor), { status: MeetingStatus.PLANIFIEE, startAt: { gte: maintenant } }, { OR: [{ createdById: sup }, { participants: { some: { userId: sup } } }] }] },
          })
        : Promise.resolve(0),
    ]);
    const i = this.ouvertes([...new Map([...inst.emises, ...inst.recues].map((x) => [x.id, x])).values()], maintenant);
    return [
      { cle: 'courrier-imputer', valeur: c.arriveesEnAttente, libelle: 'Courriers à imputer', sous: 'arrivées enregistrées', ton: 'ambre', lien: '/courrier' },
      { cle: 'courrier-traitement', valeur: c.arriveesEnTraitement, libelle: 'Courriers en traitement', sous: 'imputés, non traités', ton: 'encre', lien: '/courrier' },
      { cle: 'reunions-superviseur', valeur: reunions, libelle: 'Réunions à venir', sous: sup ? 'de votre superviseur' : 'aucun superviseur désigné', ton: 'encre', lien: '/reunions' },
      { cle: 'instructions', valeur: i.nombre, libelle: 'Instructions non exécutées', sous: i.sous, ton: 'ambre', lien: '/instructions' },
    ];
  }

  /** Chefs : les quatre chiffres de tâches d'avant (périmètre). */
  private async chef(actor: AuthenticatedUser): Promise<Chiffre[]> {
    const t = await this.tasks.dashboard(actor);
    const mois = new Date().toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Africa/Conakry' });
    const base = '/tasks?onglet=perimetre';
    return [
      { cle: 'en-cours', valeur: t.enCours, libelle: 'En cours', sous: 'dans votre périmètre', ton: 'encre', lien: `${base}&statut=EN_COURS` },
      { cle: 'en-retard', valeur: t.enRetard, libelle: 'En retard', sous: 'à relancer', ton: 'rouge', lien: `${base}&echeance=retard` },
      { cle: 'en-validation', valeur: t.enAttenteValidation, libelle: 'En validation', sous: 'à examiner', ton: 'ambre', lien: `${base}&statut=SOUMISE_VALIDATION` },
      { cle: 'terminees', valeur: t.termineesCeMois, libelle: `Terminées en ${mois}`, sous: 'ce mois-ci', ton: 'vert', lien: '/tasks?onglet=terminees' },
    ];
  }

  /** Chargé d'études et stagiaire : ses propres tâches et congés. Le stagiaire n'a pas l'écran des congés :
   * ses chiffres de congés n'ont pas de lien. */
  private async agent(actor: AuthenticatedUser, maintenant: Date): Promise<Chiffre[]> {
    const stagiaire = actor.role === SystemRole.STAGIAIRE;
    const mien = { parentTaskId: null, status: { notIn: STATUTS_CLOS }, assignees: { some: { userId: actor.id } } };
    const [ouvertes, prochaine, retard, solde, demandes] = await Promise.all([
      this.prisma.task.count({ where: mien }),
      this.prisma.task.findFirst({ where: { ...mien, dueDate: { gte: maintenant } }, orderBy: { dueDate: 'asc' }, select: { dueDate: true } }),
      this.prisma.task.count({ where: { ...mien, dueDate: { lt: maintenant } } }),
      this.prisma.leaveBalance.findFirst({ where: { userId: actor.id, year: maintenant.getUTCFullYear(), leaveType: { code: CODE_CONGE_ANNUEL } }, select: { totalDays: true, usedDays: true } }),
      this.prisma.leaveRequest.count({ where: { userId: actor.id, status: LeaveRequestStatus.EN_ATTENTE } }),
    ]);
    return [
      { cle: 'mes-taches', valeur: ouvertes, libelle: 'Mes tâches ouvertes', sous: prochaine?.dueDate ? `prochaine échéance le ${jourFr(prochaine.dueDate)}` : 'aucune échéance à venir', ton: 'encre', lien: '/tasks?onglet=assignees' },
      { cle: 'solde', valeur: solde ? solde.totalDays - solde.usedDays : null, libelle: 'Mon solde de congés', sous: solde ? `jours restants sur ${solde.totalDays}` : 'aucun solde ouvert', ton: 'vert', lien: stagiaire ? null : '/leaves' },
      { cle: 'mes-demandes', valeur: demandes, libelle: 'Mes demandes de congé', sous: 'en cours', ton: 'ambre', lien: stagiaire ? null : '/leaves' },
      { cle: 'mes-retards', valeur: retard, libelle: 'Mes tâches en retard', sous: 'échéance dépassée', ton: 'rouge', lien: '/tasks?onglet=assignees&echeance=retard' },
    ];
  }
}

