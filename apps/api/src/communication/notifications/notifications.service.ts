import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email.service';
import { buildEmailContent } from './email-template';

/** Libellé du bouton d'action de l'email, adapté à la ressource concernée
 * par chaque type de notification (voir schema.prisma pour la liste complète). */
const NOTIFICATION_BUTTON_LABELS: Record<NotificationType, string> = {
  TACHE_ASSIGNEE: 'Voir la tâche',
  TACHE_ECHEANCE_PROCHE: 'Voir la tâche',
  TACHE_EN_RETARD: 'Voir la tâche',
  TACHE_SOUMISE_VALIDATION: 'Voir la tâche',
  TACHE_VALIDEE: 'Voir la tâche',
  TACHE_REJETEE: 'Voir la tâche',
  MENTION_COMMENTAIRE: 'Voir le commentaire',
  MESSAGE_DIRECT: 'Lire le message',
  ANNONCE: "Voir l'annonce",
  CONGE_SOUMIS: 'Voir la demande',
  CONGE_VALIDE: 'Voir ma demande de congé',
  CONGE_REJETE: 'Voir la demande',
  DOCUMENT_PUBLIE: 'Voir le document',
  REUNION_PLANIFIEE: 'Voir la réunion',
  REUNION_RAPPEL: 'Voir la réunion',
  REUNION_ANNULEE: 'Voir la réunion',
  SONDAGE_CREE: 'Voir le sondage',
  SUGGESTION_RECUE: 'Voir la suggestion',
  SUGGESTION_STATUT_MAJ: 'Voir ma suggestion',
  DOSSIER_ERREUR_SIGNALEE: 'Voir le dossier',
  DECISION_RELANCE: 'Voir la réunion',
  SUPPLEANCE_DESIGNEE: 'Voir la suppléance',
  SUPPLEANCE_REVOQUEE: 'Voir mes suppléances',
  STAGE_PERIODE_A_ACCEPTER: 'Voir le stage',
  STAGE_PERIODE_REFUSEE: 'Voir le stage',
  STAGE_PERIODE_A_VENIR: 'Voir le stage',
  STAGE_PERIODE_DEBUT: 'Voir le stage',
  STAGE_ALERTE: 'Voir le stage',
  STAGE_PLAN_MODIFIE: 'Voir le stage',
  STAGE_EVALUATION_A_FAIRE: "Rédiger l'évaluation",
  STAGE_EVALUATION_A_VISER: "Voir l'évaluation",
  STAGE_EVALUATION_RENVOYEE: "Voir l'évaluation",
  STAGE_EVALUATION_VISEE: "Voir l'évaluation",
  LOGISTIQUE_DEMANDE_A_VALIDER: 'Voir la demande',
  LOGISTIQUE_DEMANDE_A_TRAITER: 'Voir la demande',
  LOGISTIQUE_DEMANDE_TRAITEE: 'Voir la demande',
  LOGISTIQUE_DEMANDE_REFUSEE: 'Voir la demande',
  LOGISTIQUE_STOCK_BAS: "Voir l'article",
  BIEN_A_RECUPERER: 'Voir le bien',
  RESERVATION_A_VALIDER: 'Voir la réservation',
  RESERVATION_CONFIRMEE: 'Voir la réservation',
  RESERVATION_REFUSEE: 'Voir la réservation',
  RESERVATION_ANNULEE: 'Voir la réservation',
  RESERVATION_ANNULEE_PRIORITE: 'Voir la réservation',
  ROLE_MODIFIE: 'Ouvrir l’espace de travail',
  COURRIER_A_IMPUTER: 'Voir le courrier',
  COURRIER_IMPUTE: 'Voir le courrier',
  PLI_PERSONNEL_RECU: 'Voir le pli',
  COURRIER_ACCES_OUVERT: 'Voir le courrier',
  IMPUTATION_ECHEANCE_PROCHE: 'Voir le courrier',
  IMPUTATION_EN_RETARD: 'Voir le courrier',
  ACTE_A_VISER: 'Voir l’acte',
  ACTE_RENVOYE: 'Voir l’acte',
  ACTE_A_SIGNER: 'Voir l’acte',
  ACTE_SIGNE: 'Voir l’acte',
  ACTE_PRISE_CONNAISSANCE: 'Voir l’acte',
};

/**
 * Point d'entrée unique des notifications (in-app + email — SMS différé,
 * SHOULD, RF-COM-04). Utilisée par messages/annonces de ce module, et par
 * TasksService pour les événements liés aux tâches (assignation, mention,
 * soumission, validation, rejet).
 *
 * Envoi synchrone, y compris pour un grand nombre de destinataires
 * (ex. annonce DNPEC entière) : acceptable pour le volume actuel, mais une
 * vraie file d'attente (BullMQ ou équivalent) serait la solution
 * appropriée si le nombre d'utilisateurs ou d'annonces augmente
 * significativement — hors périmètre de cette passe.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * `subjectDetail` (ex. le titre de la tâche concernée) est ajouté à l'objet
   * de l'email quand fourni — pour que plusieurs notifications du même type
   * reçues le même jour (ex. deux tâches assignées) restent distinguables
   * dans la boîte de réception sans avoir à les ouvrir une par une. Le titre
   * seul (`title`) reste utilisé pour la notification in-app et, sans
   * `subjectDetail`, pour l'objet de l'email.
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
    subjectDetail?: string,
    // Socle NIMBA : libellé du bouton de l'email quand un type existant est
    // réutilisé pour un événement voisin (pas de nouvelle valeur de type de
    // notification tant que l'ancienne API peut encore lire la table).
    options?: { libelleBouton?: string },
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, channel: NotificationChannel.IN_APP, title, body, link, sentAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    await this.prisma.notification.create({
      data: { userId, type, channel: NotificationChannel.EMAIL, title, body, link, sentAt: new Date() },
    });
    if (user) {
      const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3100');
      const subject = subjectDetail ? `${title} : ${subjectDetail}` : title;
      const { html, text } = buildEmailContent({
        recipientFirstName: user.firstName,
        paragraphs: [title, body],
        buttonLabel: link ? options?.libelleBouton ?? NOTIFICATION_BUTTON_LABELS[type] : undefined,
        buttonUrl: link ? `${webAppUrl}${link}` : undefined,
      });
      // Un échec d'envoi (Brevo indisponible, quota, adresse refusée...) ne
      // doit jamais faire échouer la requête métier : notify() est appelé
      // APRÈS le commit de l'action (tâche validée, congé approuvé...), un 500
      // ferait croire à tort qu'elle n'a pas eu lieu. La notification in-app
      // est déjà enregistrée ; l'erreur est journalisée pour diagnostic.
      try {
        await this.email.send(user.email, subject, text, html);
      } catch (error) {
        this.logger.error(
          `Échec d'envoi de l'email de notification ${type} à l'utilisateur ${userId} : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
    subjectDetail?: string,
    options?: { libelleBouton?: string },
  ): Promise<void> {
    await Promise.all(userIds.map((userId) => this.notify(userId, type, title, body, link, subjectDetail, options)));
  }

  /** Cloche in-app : chaque notification est écrite deux fois (IN_APP et
   * EMAIL, voir notify) — seule la ligne IN_APP s'affiche et se compte. Les
   * 50 plus récentes suffisent à la cloche. */
  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, channel: NotificationChannel.IN_APP },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false, channel: NotificationChannel.IN_APP } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable');
    }
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
