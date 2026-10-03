import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus, MeetingStatus, StatutChangementRole, StatutInstruction, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TasksService } from '../tasks/tasks.service';
import { LeaveRequestsService } from '../leaves/leave-requests/leave-requests.service';
import { MeetingsService } from '../meetings/meetings.service';
import { InstructionsService } from '../instructions/instructions.service';
import { MessagesService } from '../communication/messages/messages.service';
import { CourrierTableauDeBordService } from '../courrier/tableau-de-bord.service';
import { DemandesLogistiqueService } from '../logistique/demandes.service';
import { ReservationsService } from '../logistique/reservations.service';
import { StagesService } from '../stages/stages.service';

const J = 864e5;
const INSTRUCTIONS_OUVERTES: StatutInstruction[] = [StatutInstruction.EMISE, StatutInstruction.RECUE, StatutInstruction.PRISE_EN_COMPTE];

/** Un élément « À traiter » du tableau de bord : jamais affiché à zéro. */
export interface ATraiter {
  cle: string;
  libelle: string;
  nombre: number;
  lien: string;
}

/**
 * Compteurs du menu, liste « À traiter » du tableau de bord et entrées du menu « Créer »
 * (refonte de l'interface, étapes 1 et 2) — api/v1/navigation.
 * Lecture seule. Chaque compteur passe par le service de son module (mêmes listes et mêmes
 * droits d'action que l'écran) : jamais plus que ce que la personne voit ailleurs (§2.2).
 * Un stagiaire ne reçoit que ses tâches et ses messages (les autres écrans lui sont fermés).
 * `perimetre` : la personne voit d'autres tâches que les siennes (onglet « Mon périmètre »).
 */
@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly conges: LeaveRequestsService,
    private readonly meetings: MeetingsService,
    private readonly instructions: InstructionsService,
    private readonly messages: MessagesService,
    private readonly courrier: CourrierTableauDeBordService,
    private readonly demandes: DemandesLogistiqueService,
    private readonly reservations: ReservationsService,
    private readonly stages: StagesService,
  ) {}

  async navigation(actor: AuthenticatedUser, maintenant = new Date()) {
    const stagiaire = actor.role === SystemRole.STAGIAIRE;
    const [taches, messages] = await Promise.all([this.tasks.compteursNavigation(actor), this.messages.countUnread(actor)]);
    const aTraiter: ATraiter[] = [];
    const ajouter = (cle: string, libelle: string, nombre: number, lien: string) => {
      if (nombre > 0) aTraiter.push({ cle, libelle, nombre, lien });
    };
    ajouter('taches-a-valider', 'Tâches à valider', taches.aValider, '/tasks?onglet=a-valider');

    if (stagiaire) {
      return {
        compteurs: { taches: taches.ouvertes, tachesAValider: taches.aValider, messages, instructions: 0, reunions: 0, conges: 0, courrier: 0, logistique: 0, utilisateurs: 0, stages: 0 },
        aTraiter,
        perimetre: taches.perimetre,
        creer: { tache: false, reunion: false, conge: false, message: true, document: false },
      };
    }

    const [instructions, reunions, enAttente, courrier, logistique, reservationsAValider, stages] = await Promise.all([
      this.instructions.liste(actor),
      this.prisma.meeting.count({
        where: { AND: [this.meetings.getMeetingVisibilityWhere(actor), { status: MeetingStatus.PLANIFIEE, startAt: { gte: maintenant, lte: new Date(maintenant.getTime() + 7 * J) } }] },
      }),
      this.conges.findAllVisibleTo(actor, { status: LeaveRequestStatus.EN_ATTENTE } as never),
      this.courrier.pour(actor),
      this.demandes.tableauDeBord(actor),
      this.reservations.aValiderCount(actor),
      // Même décompte que l'écran Stagiaires (périodes à accepter, évaluations, rapports…).
      this.stages.list(actor).then((l) => l.stages.reduce((n, s) => n + s.aTraiter, 0)),
    ]);

    const instructionsRecues = instructions.recues.filter((i) => INSTRUCTIONS_OUVERTES.includes(i.statut)).length;
    const avis = enAttente.filter((r) => r.droits.peutDonnerAvis).length;
    const decisions = enAttente.filter((r) => r.droits.peutDecider).length;
    ajouter('conges-avis', 'Avis de congé à donner', avis, '/leaves?onglet=validation');
    ajouter('conges-decision', 'Congés à décider', decisions, '/leaves?onglet=validation');
    ajouter('instructions', 'Instructions reçues à traiter', instructionsRecues, '/instructions');
    ajouter('courrier-imputer', 'Courrier à imputer', courrier.aImputer, '/courrier?rubrique=aImputer');
    ajouter('courrier-traiter', 'Courrier à traiter', courrier.aTraiter, '/courrier?rubrique=aTraiter');
    ajouter('courrier-viser', 'Actes à viser', courrier.aViser, '/courrier?rubrique=aViser');
    ajouter('courrier-signer', 'Actes à signer', courrier.aSigner, '/courrier?rubrique=aSigner');
    ajouter('courrier-expedier', 'Actes à expédier', courrier.aExpedier, '/courrier?rubrique=aExpedier');
    ajouter('courrier-connaissance', 'Actes à prendre en connaissance', courrier.priseDeConnaissance, '/courrier?rubrique=priseDeConnaissance');
    ajouter('logistique-valider', 'Demandes logistiques à valider', logistique.aValider, '/logistique?onglet=demandes');
    ajouter('logistique-traiter', 'Demandes logistiques à traiter', logistique.aTraiter, '/logistique?onglet=demandes');
    ajouter('stock-bas', 'Articles sous le seuil d’alerte', logistique.stockBas, '/logistique?onglet=fournitures');
    ajouter('reservations-valider', 'Réservations à valider', reservationsAValider, '/logistique?onglet=reservations');
    ajouter('stages', 'Stages : éléments à traiter', stages, '/stages');

    let utilisateurs = 0;
    if (actor.role === SystemRole.ADMIN_SYSTEME) {
      const [comptes, nominations] = await Promise.all([
        this.prisma.user.count({ where: { status: UserStatus.EN_ATTENTE } }),
        this.prisma.changementRoleNomination.count({ where: { statut: StatutChangementRole.EN_ATTENTE } }),
      ]);
      ajouter('comptes', 'Demandes d’accès à approuver', comptes, '/users');
      ajouter('nominations', 'Nominations à appliquer', nominations, '/users?onglet=nominations');
      utilisateurs = comptes + nominations;
    }

    return {
      compteurs: {
        taches: taches.ouvertes,
        tachesAValider: taches.aValider,
        messages,
        instructions: instructionsRecues,
        reunions,
        conges: avis + decisions,
        courrier: courrier.aImputer + courrier.aTraiter + courrier.aViser + courrier.aSigner + courrier.aExpedier + courrier.priseDeConnaissance,
        logistique: logistique.aValider + logistique.aTraiter + reservationsAValider,
        utilisateurs,
        stages,
      },
      aTraiter,
      perimetre: taches.perimetre,
      creer: { tache: true, reunion: true, conge: true, message: true, document: true },
    };
  }
}
