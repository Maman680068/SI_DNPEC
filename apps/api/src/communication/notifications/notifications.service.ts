import { Injectable, NotFoundException } from '@nestjs/common';
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
        buttonLabel: link ? NOTIFICATION_BUTTON_LABELS[type] : undefined,
        buttonUrl: link ? `${webAppUrl}${link}` : undefined,
      });
      await this.email.send(user.email, subject, text, html);
    }
  }

  async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
    subjectDetail?: string,
  ): Promise<void> {
    await Promise.all(userIds.map((userId) => this.notify(userId, type, title, body, link, subjectDetail)));
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
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
