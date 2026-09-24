import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DirectMessage, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateMessageDto } from '../dto/create-message.dto';

/** Messagerie directe (RF-COM-01) — pas de restriction cascade, point à point entre deux comptes actifs. */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async send(actor: AuthenticatedUser, dto: CreateMessageDto): Promise<DirectMessage> {
    if (dto.recipientId === actor.id) {
      throw new ConflictException('Vous ne pouvez pas vous envoyer un message à vous-même.');
    }
    const recipient = await this.prisma.user.findUnique({ where: { id: dto.recipientId } });
    if (!recipient) throw new NotFoundException('Destinataire introuvable');

    const message = await this.prisma.directMessage.create({
      data: {
        senderId: actor.id,
        recipientId: dto.recipientId,
        body: dto.body,
        attachmentKey: dto.attachmentKey,
        attachmentName: dto.attachmentName,
      },
    });

    await this.notifications.notify(
      dto.recipientId,
      NotificationType.MESSAGE_DIRECT,
      'Nouveau message',
      dto.body.length > 200 ? `${dto.body.slice(0, 200)}…` : dto.body,
      `/communication?with=${actor.id}`,
    );

    return message;
  }

  /**
   * Un message le plus récent par interlocuteur. Chargé en mémoire plutôt
   * qu'une requête SQL "DISTINCT ON" dédiée — volumes attendus faibles pour
   * une messagerie interne, à revoir si ça devient un goulot d'étranglement.
   */
  async listConversations(actor: AuthenticatedUser) {
    const messages = await this.prisma.directMessage.findMany({
      where: { OR: [{ senderId: actor.id }, { recipientId: actor.id }] },
      orderBy: { createdAt: 'desc' },
    });

    const conversations = new Map<string, DirectMessage>();
    for (const message of messages) {
      const otherUserId = message.senderId === actor.id ? message.recipientId : message.senderId;
      if (!conversations.has(otherUserId)) conversations.set(otherUserId, message);
    }

    return Array.from(conversations.entries()).map(([otherUserId, lastMessage]) => ({
      otherUserId,
      lastMessage,
    }));
  }

  listWith(actor: AuthenticatedUser, otherUserId: string) {
    return this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: actor.id, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: actor.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markRead(actor: AuthenticatedUser, id: string): Promise<void> {
    const message = await this.prisma.directMessage.findUnique({ where: { id } });
    if (!message || message.recipientId !== actor.id) {
      throw new NotFoundException('Message introuvable');
    }
    if (!message.readAt) {
      await this.prisma.directMessage.update({ where: { id }, data: { readAt: new Date() } });
    }
  }
}
