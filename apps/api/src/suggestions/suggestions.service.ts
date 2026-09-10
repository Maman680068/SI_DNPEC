import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, Prisma, SuggestionStatus, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionStatusDto } from './dto/update-suggestion-status.dto';

const SUGGESTION_SELECT = {
  id: true,
  authorId: true,
  isAnonymous: true,
  content: true,
  status: true,
  response: true,
  respondedById: true,
  respondedAt: true,
  createdAt: true,
} satisfies Prisma.SuggestionSelect;

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  RECUE: 'Reçue',
  EN_ETUDE: 'En étude',
  RETENUE: 'Retenue',
  NON_RETENUE: 'Non retenue',
};

/** Statut -> AuditAction le plus proche du vocabulaire déjà utilisé ailleurs
 * (validation/rejet de tâche ou de congé) — RECUE/EN_ETUDE restent de simples
 * modifications, il n'y a pas de décision définitive avant RETENUE/NON_RETENUE. */
const STATUS_AUDIT_ACTION: Record<SuggestionStatus, AuditAction> = {
  RECUE: AuditAction.MODIFICATION,
  EN_ETUDE: AuditAction.MODIFICATION,
  RETENUE: AuditAction.VALIDATION,
  NON_RETENUE: AuditAction.REJET,
};

/**
 * Boîte à suggestions (RF-CPL-05, §4.8) — le plus simple des modules de
 * communication : aucun ciblage cascade, aucune notion de vote. Visibilité
 * fixe et non dérivée de CascadeService : l'auteur voit ses propres
 * suggestions (jamais celles soumises anonymement par d'autres, ni même les
 * siennes propres si elle les a soumises anonymement — voir schema.prisma),
 * DN/DNA voient tout. Changement de statut réservé au DN/DNA.
 */
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateSuggestionDto) {
    const isAnonymous = dto.isAnonymous ?? false;

    const suggestion = await this.prisma.suggestion.create({
      data: {
        authorId: isAnonymous ? null : actor.id,
        isAnonymous,
        content: dto.content,
      },
      select: SUGGESTION_SELECT,
    });

    await this.audit.log({
      // Une suggestion anonyme ne doit laisser aucune trace de son auteur,
      // pas même dans le journal d'audit — voir la même logique pour
      // authorId=null ci-dessus.
      actorId: isAnonymous ? null : actor.id,
      action: AuditAction.CREATION,
      entityType: 'Suggestion',
      entityId: suggestion.id,
      metadata: { isAnonymous },
    });

    const leaders = await this.prisma.user.findMany({
      where: { role: { in: [SystemRole.DN, SystemRole.DNA] }, status: UserStatus.ACTIF },
      select: { id: true },
    });
    await this.notifications.notifyMany(
      leaders.map((l) => l.id),
      NotificationType.SUGGESTION_RECUE,
      'Nouvelle suggestion',
      dto.content,
      '/suggestions',
    );

    return suggestion;
  }

  /** Mes propres suggestions — jamais celles soumises anonymement, y compris les siennes. */
  findMine(actor: AuthenticatedUser) {
    return this.prisma.suggestion.findMany({
      where: { authorId: actor.id },
      select: SUGGESTION_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Boîte de réception complète — réservée au DN/DNA. */
  async findAllForLeadership(actor: AuthenticatedUser) {
    this.assertIsLeadership(actor);
    return this.prisma.suggestion.findMany({ select: SUGGESTION_SELECT, orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(actor: AuthenticatedUser, id: string, dto: UpdateSuggestionStatusDto) {
    this.assertIsLeadership(actor);
    const suggestion = await this.prisma.suggestion.findUnique({ where: { id }, select: SUGGESTION_SELECT });
    if (!suggestion) throw new NotFoundException('Suggestion introuvable');

    const updated = await this.prisma.suggestion.update({
      where: { id },
      data: {
        status: dto.status,
        response: dto.response,
        respondedById: actor.id,
        respondedAt: new Date(),
      },
      select: SUGGESTION_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: STATUS_AUDIT_ACTION[dto.status],
      entityType: 'Suggestion',
      entityId: id,
      metadata: { status: dto.status },
    });

    // Suggestion anonyme : aucun auteur enregistré, donc personne à notifier —
    // le statut reste consultable uniquement via la boîte de réception DN/DNA.
    if (suggestion.authorId) {
      await this.notifications.notify(
        suggestion.authorId,
        NotificationType.SUGGESTION_STATUT_MAJ,
        'Mise à jour de votre suggestion',
        `Nouveau statut : ${STATUS_LABEL[dto.status]}`,
        '/suggestions',
      );
    }

    return updated;
  }

  private assertIsLeadership(actor: AuthenticatedUser): void {
    if (actor.role !== SystemRole.DN && actor.role !== SystemRole.DNA) {
      throw new ForbiddenException('Seuls le DN ou la DNA peuvent traiter les suggestions.');
    }
  }
}
