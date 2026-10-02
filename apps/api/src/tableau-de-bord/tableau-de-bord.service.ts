import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus, MeetingStatus, StatutInstruction, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TasksService } from '../tasks/tasks.service';
import { LeaveRequestsService } from '../leaves/leave-requests/leave-requests.service';
import { DecisionsService } from '../meetings/decisions.service';
import { MeetingsService } from '../meetings/meetings.service';
import { InstructionsService } from '../instructions/instructions.service';
import { PlanTravailService } from '../plan-travail/plan-travail.service';
import { EffectifsService } from '../rh/effectifs.service';
import { estDrh } from '../socle/roles-fonctionnels';

const J = 864e5;
export interface ElementBloc {
  libelle: string;
  detail?: string | null;
  lien?: string | null;
}
export interface Bloc {
  cle: string;
  titre: string;
  valeur?: number | null;
  /** Unité ou précision affichée sous la valeur (« en retard », « %»…). */
  sousTitre?: string | null;
  elements?: ElementBloc[];
  lien?: string | null;
  vide?: string;
}
const CHEFS: SystemRole[] = [SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE];
const jourFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const debutJour = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Tableau de bord par rôle (socle N6, cahier NIMBA A6.6, SIG-RF-TDB-01 à 09).
 * Chaque bloc passe par le service de son module (mêmes règles que ses écrans) : jamais plus que ce que
 * le rôle voit ailleurs — absences par type, jamais le motif médical pour qui ne le voit pas ; aucun
 * dossier individuel ni montant. Le rôle effectif (intérim compris) choisit les blocs ; les rôles
 * fonctionnels (DRH) restent personnels.
 */
@Injectable()
export class TableauDeBordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly conges: LeaveRequestsService,
    private readonly decisions: DecisionsService,
    private readonly meetings: MeetingsService,
    private readonly instructions: InstructionsService,
    private readonly plan: PlanTravailService,
    private readonly effectifs: EffectifsService,
  ) {}

  async tableau(actor: AuthenticatedUser, maintenant = new Date()) {
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    const chef = CHEFS.includes(actor.role);
    const drh = estDrh(actor);
    const blocs: Bloc[] = [];
    const t = await this.tasks.dashboard(actor);
    blocs.push({ cle: 'taches', titre: direction || chef ? 'Tâches de mon périmètre' : 'Mes tâches', valeur: t.total, sousTitre: `${t.enCours} en cours · ${t.enRetard} en retard · ${t.enAttenteValidation} à valider`, lien: '/tasks' });

    if (direction) {
      blocs.push(await this.avancementPlan(actor, maintenant));
      const d = await this.decisions.dashboard(actor);
      blocs.push({ cle: 'decisions', titre: 'Décisions de réunion non exécutées', valeur: d.total, sousTitre: `${d.enRetard} en retard · ${d.sansAction} sans action`, lien: '/reunions' });
      blocs.push(await this.instructionsOuvertes(actor, maintenant));
    }
    if (direction || chef || drh) blocs.push(await this.absences(actor, maintenant, direction || drh ? 0 : 7));
    if (chef || direction) blocs.push(await this.congesAAviser(actor));
    if (drh) {
      blocs.push(await this.congesADecider(actor));
      const a = await this.effectifs.resumeAlertes(maintenant);
      blocs.push({
        cle: 'alertes-rh',
        titre: 'Alertes RH',
        valeur: a.total,
        sousTitre: `${a.haute} urgente(s)`,
        elements: [
          { libelle: 'Fins de contrat', detail: String(a.finContrat) },
          { libelle: 'Fins de stage', detail: String(a.finStage) },
          { libelle: 'Avancements à instruire', detail: String(a.avancement) },
          { libelle: 'Dossiers incomplets', detail: String(a.dossierIncomplet) },
        ],
        lien: '/rh?onglet=alertes',
      });
    }
    if (chef) blocs.push(await this.mesActivites(actor));
    const encadrement = await this.encadrement(actor);
    if (encadrement) blocs.push(encadrement);
    if (!direction) {
      blocs.push(await this.monSolde(actor, maintenant));
      blocs.push(await this.mesDemandes(actor));
    }
    blocs.push(await this.reunions(actor, maintenant));
    if (actor.role === SystemRole.ADMIN_SYSTEME) {
      const n = await this.prisma.user.count({ where: { status: UserStatus.EN_ATTENTE } });
      blocs.push({ cle: 'comptes', titre: 'Comptes en attente d’activation', valeur: n, lien: '/users', vide: 'Aucune demande d’accès en attente.' });
    }
    return { profil: direction ? 'DIRECTION' : drh ? 'DRH' : chef ? 'CHEF' : actor.role === SystemRole.ADMIN_SYSTEME ? 'ADMINISTRATEUR' : 'AGENT', blocs };
  }

  private async avancementPlan(actor: AuthenticatedUser, maintenant: Date): Promise<Bloc> {
    const p = await this.plan.plan(actor, { annee: maintenant.getUTCFullYear() } as never);
    const parUnite = new Map<string, number[]>();
    for (const o of p.objectifs) parUnite.set(o.unite, [...(parUnite.get(o.unite) ?? []), o.avancement]);
    const elements = [...parUnite.entries()]
      .map(([unite, v]) => ({ libelle: unite, detail: `${Math.round(v.reduce((s, x) => s + x, 0) / v.length)} %` }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle));
    const tous = p.objectifs.map((o) => o.avancement);
    return { cle: 'plan', titre: 'Avancement du plan de travail', valeur: tous.length ? Math.round(tous.reduce((s, x) => s + x, 0) / tous.length) : null, sousTitre: '% (moyenne des objectifs)', elements, lien: '/plan-travail', vide: 'Aucun objectif pour l’année.' };
  }

  private async instructionsOuvertes(actor: AuthenticatedUser, maintenant: Date): Promise<Bloc> {
    const l = await this.instructions.liste(actor);
    const ouvertes = l.emises.filter((i) => i.statut === StatutInstruction.EMISE || i.statut === StatutInstruction.RECUE || i.statut === StatutInstruction.PRISE_EN_COMPTE);
    return {
      cle: 'instructions',
      titre: 'Instructions non exécutées',
      valeur: ouvertes.length,
      elements: ouvertes.slice(0, 5).map((i) => ({ libelle: i.objet, detail: `depuis ${Math.max(0, Math.floor((maintenant.getTime() - new Date(i.emiseLe).getTime()) / J))} j`, lien: `/instructions?id=${i.id}` })),
      lien: '/instructions',
      vide: 'Toutes les instructions sont exécutées.',
    };
  }

  /** Absences du jour (Direction, DRH) ou des 7 prochains jours (chefs) : type affiché selon les droits de l'écran. */
  private async absences(actor: AuthenticatedUser, maintenant: Date, jours: number): Promise<Bloc> {
    const debut = debutJour(maintenant);
    const fin = new Date(debut.getTime() + jours * J);
    const l = (await this.conges.findAllVisibleTo(actor, { status: LeaveRequestStatus.APPROUVEE } as never)).filter((r) => r.userId !== actor.id && new Date(r.startDate) <= fin && new Date(r.endDate) >= debut);
    return {
      cle: 'absences',
      titre: jours ? 'Absences des 7 prochains jours' : 'Absences du jour',
      valeur: l.length,
      elements: l.slice(0, 8).map((r) => ({ libelle: `${r.user.firstName} ${r.user.lastName}`, detail: `${r.leaveType.name} · ${jourFr(new Date(r.startDate))} → ${jourFr(new Date(r.endDate))}` })),
      lien: '/leaves?onglet=suivi',
      vide: 'Aucune absence.',
    };
  }

  private async congesAAviser(actor: AuthenticatedUser): Promise<Bloc> {
    const l = (await this.conges.findAllVisibleTo(actor, { status: LeaveRequestStatus.EN_ATTENTE } as never)).filter((r) => r.droits.peutDonnerAvis);
    return {
      cle: 'conges-avis',
      titre: 'Demandes de congé en attente de votre avis',
      valeur: l.length,
      elements: l.slice(0, 5).map((r) => ({ libelle: `${r.user.firstName} ${r.user.lastName}`, detail: r.avisEcheance ? `avis avant le ${new Date(r.avisEcheance).toLocaleString('fr-FR', { timeZone: 'Africa/Conakry', dateStyle: 'short', timeStyle: 'short' })}` : null, lien: `/leaves?id=${r.id}` })),
      lien: '/leaves?onglet=validation',
      vide: 'Aucun avis attendu de vous.',
    };
  }

  private async congesADecider(actor: AuthenticatedUser): Promise<Bloc> {
    const l = (await this.conges.findAllVisibleTo(actor, { status: LeaveRequestStatus.EN_ATTENTE } as never)).filter((r) => r.droits.peutDecider);
    return {
      cle: 'conges-decision',
      titre: 'Demandes en attente de votre décision',
      valeur: l.length,
      elements: l.slice(0, 5).map((r) => ({ libelle: `${r.user.firstName} ${r.user.lastName}`, detail: `${r.leaveType.name} · ${r.daysCount} j · avis ${r.avisEtat === 'DEFAVORABLE' ? 'défavorable' : 'favorable'}`, lien: `/leaves?id=${r.id}` })),
      lien: '/leaves?onglet=validation',
      vide: 'Aucune décision attendue.',
    };
  }

  private async mesActivites(actor: AuthenticatedUser): Promise<Bloc> {
    const a = await this.prisma.activite.findMany({ where: { responsableId: actor.id, dateFin: { gte: new Date(Date.now() - 30 * J) } }, select: { id: true, libelle: true, dateFin: true }, orderBy: { dateFin: 'asc' }, take: 5 });
    return { cle: 'activites', titre: 'Activités du plan dont je suis responsable', valeur: a.length, elements: a.map((x) => ({ libelle: x.libelle, detail: `fin ${jourFr(x.dateFin)}`, lien: `/plan-travail?activite=${x.id}` })), lien: '/plan-travail', vide: 'Aucune activité à votre nom.' };
  }

  private async encadrement(actor: AuthenticatedUser): Promise<Bloc | null> {
    const stages = await this.prisma.stage.findMany({ where: { encadrantPrincipalId: actor.id, statut: { not: 'INTERROMPU' } }, select: { id: true, rapportStatut: true, stagiaire: { select: { firstName: true, lastName: true } } } });
    if (!stages.length) return null;
    const aValider = stages.filter((s) => s.rapportStatut === 'DEPOSE');
    return { cle: 'encadrement', titre: 'Stagiaires encadrés', valeur: stages.length, sousTitre: `${aValider.length} rapport(s) à valider`, elements: stages.slice(0, 5).map((s) => ({ libelle: `${s.stagiaire.firstName} ${s.stagiaire.lastName}`, detail: s.rapportStatut === 'DEPOSE' ? 'rapport à valider' : null, lien: `/stages/${s.id}` })), lien: '/stages' };
  }

  private async monSolde(actor: AuthenticatedUser, maintenant: Date): Promise<Bloc> {
    const soldes = await this.prisma.leaveBalance.findMany({ where: { userId: actor.id, year: maintenant.getUTCFullYear() }, select: { totalDays: true, usedDays: true, leaveType: { select: { name: true } } } });
    return { cle: 'solde', titre: 'Mon solde de congés', elements: soldes.map((s) => ({ libelle: s.leaveType.name, detail: `${s.totalDays - s.usedDays} j restants sur ${s.totalDays}` })), lien: '/leaves', vide: 'Aucun solde provisionné pour l’année.' };
  }

  private async mesDemandes(actor: AuthenticatedUser): Promise<Bloc> {
    const l = await this.prisma.leaveRequest.findMany({ where: { userId: actor.id, status: LeaveRequestStatus.EN_ATTENTE }, select: { id: true, startDate: true, endDate: true, avisEtat: true, leaveType: { select: { name: true } } }, orderBy: { startDate: 'asc' } });
    return { cle: 'demandes', titre: 'Mes demandes en cours', valeur: l.length, elements: l.map((r) => ({ libelle: r.leaveType.name, detail: `${jourFr(r.startDate)} → ${jourFr(r.endDate)} · ${r.avisEtat ? 'décision du DRH attendue' : 'avis du chef attendu'}`, lien: `/leaves?id=${r.id}` })), lien: '/leaves', vide: 'Aucune demande en cours.' };
  }

  private async reunions(actor: AuthenticatedUser, maintenant: Date): Promise<Bloc> {
    const m = await this.prisma.meeting.findMany({
      where: { AND: [this.meetings.getMeetingVisibilityWhere(actor), { status: MeetingStatus.PLANIFIEE, startAt: { gte: maintenant, lte: new Date(maintenant.getTime() + 7 * J) } }] },
      select: { id: true, title: true, startAt: true },
      orderBy: { startAt: 'asc' },
      take: 5,
    });
    return { cle: 'reunions', titre: 'Réunions des 7 prochains jours', valeur: m.length, elements: m.map((x) => ({ libelle: x.title, detail: x.startAt.toLocaleString('fr-FR', { timeZone: 'Africa/Conakry', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), lien: `/reunions?id=${x.id}` })), lien: '/reunions', vide: 'Aucune réunion prévue.' };
  }
}
