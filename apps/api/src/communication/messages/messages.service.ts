import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateMessageDto } from '../dto/create-message.dto';

/** Champs d'un message renvoyés au web : jamais la clé de stockage de la pièce jointe. */
export const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  recipientId: true,
  body: true,
  attachmentName: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.DirectMessageSelect;
export type MessageVu = Prisma.DirectMessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

/** Pièce jointe posée par le serveur (document généré, fichier déposé) — jamais venue du navigateur. */
export interface PieceJointeServeur {
  cle: string;
  nom: string;
}

/** Messagerie directe (RF-COM-01) — pas de restriction cascade, point à point entre deux comptes actifs. */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async send(actor: AuthenticatedUser, dto: CreateMessageDto, piece?: PieceJointeServeur): Promise<MessageVu> {
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
        attachmentKey: piece?.cle ?? null,
        attachmentName: piece?.nom ?? null,
      },
      select: MESSAGE_SELECT,
    });

    await this.notifications.notify(
      dto.recipientId,
      NotificationType.MESSAGE_DIRECT,
      'Nouveau message',
      dto.body ? (dto.body.length > 200 ? `${dto.body.slice(0, 200)}…` : dto.body) : `Pièce jointe : ${piece?.nom ?? 'fichier'}`,
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
      select: MESSAGE_SELECT,
    });

    const conversations = new Map<string, MessageVu>();
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
      select: MESSAGE_SELECT,
    });
  }

  countUnread(actor: AuthenticatedUser): Promise<number> {
    return this.prisma.directMessage.count({ where: { recipientId: actor.id, readAt: null } });
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
