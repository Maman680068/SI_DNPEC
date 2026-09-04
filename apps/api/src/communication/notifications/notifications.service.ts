import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email.service';

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
  ) {}

  async notify(userId: string, type: NotificationType, title: string, body: string, link?: string): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, channel: NotificationChannel.IN_APP, title, body, link, sentAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    await this.prisma.notification.create({
      data: { userId, type, channel: NotificationChannel.EMAIL, title, body, link, sentAt: new Date() },
    });
    if (user) {
      await this.email.send(user.email, title, body);
    }
  }

  async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
  ): Promise<void> {
    await Promise.all(userIds.map((userId) => this.notify(userId, type, title, body, link)));
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
