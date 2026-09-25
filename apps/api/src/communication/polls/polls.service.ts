import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementScope, AuditAction, NotificationType, Poll, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreatePollDto } from '../dto/create-poll.dto';
import { VotePollDto } from '../dto/vote-poll.dto';

const POLL_SELECT = {
  id: true,
  authorId: true,
  question: true,
  allowMultiple: true,
  scope: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
  closesAt: true,
  closedAt: true,
  createdAt: true,
  options: { select: { id: true, label: true, order: true }, orderBy: { order: 'asc' } },
  votes: { select: { id: true, optionId: true, userId: true, votedAt: true } },
} satisfies Prisma.PollSelect;

type PollWithVotes = Prisma.PollGetPayload<{ select: typeof POLL_SELECT }>;

const TOP_LEVEL_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA, SystemRole.ADMIN_SYSTEME];

/**
 * Sondages à choix simples (RF-CPL-04, §4.7) — décisions rapides. Ciblage
 * (qui peut créer un sondage pour quel périmètre) rigoureusement identique
 * aux annonces (AnnouncementsService) : même enum AnnouncementScope, même
 * astuce de cible synthétique pour CascadeService.assertCanManageUser, même
 * résolution directe de l'audience par requête Prisma — dupliqué ici plutôt
 * que factorisé avec AnnouncementsService pour ne pas toucher un module déjà
 * en production pour cette passe (même choix que SUPERVISOR_ROLES dupliqué
 * entre AuthService et UsersService).
 *
 * Nominatif comme AnnouncementRead : qui a voté quoi n'est visible qu'à
 * l'auteur et à la direction (DN/DNA/ADMIN_SYSTEME) — voir canSeeDetail dans
 * toPollResult. Tout le monde d'autre ne voit que les totaux par option.
 *
 * Pas de notification par vote (bruyant) — seule la création notifie
 * l'audience, comme pour les annonces. Pas de rafraîchissement serveur
 * "temps réel" non plus : le frontend rappelle GET /polls/:id à intervalle
 * (15s) tant que la vue de résultats reste ouverte.
 */
@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreatePollDto) {
    const recipientIds = await this.resolveAudienceAndAuthorize(actor, dto);

    const poll = await this.prisma.poll.create({
      data: {
        authorId: actor.id,
        question: dto.question,
        allowMultiple: dto.allowMultiple ?? false,
        scope: dto.scope,
        divisionId: dto.divisionId,
        sectionId: dto.sectionId,
        celluleId: dto.celluleId,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        options: { create: dto.options.map((label, index) => ({ label, order: index })) },
        recipients:
          dto.scope === AnnouncementScope.GROUPE_PERSONNALISE
            ? { create: recipientIds.map((userId) => ({ userId })) }
            : undefined,
      },
      select: POLL_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Poll',
      entityId: poll.id,
      metadata: { scope: dto.scope, audienceSize: recipientIds.length, optionCount: dto.options.length },
    });

    await this.notifications.notifyMany(
      recipientIds.filter((id) => id !== actor.id),
      NotificationType.SONDAGE_CREE,
      'Nouveau sondage',
      poll.question,
      `/communication?pollId=${poll.id}`,
      poll.question,
    );

    return this.toPollResult(actor, poll);
  }

  async findAllVisibleTo(actor: AuthenticatedUser) {
    const polls = await this.prisma.poll.findMany({
      where: this.visibilityWhere(actor),
      select: POLL_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return polls.map((poll) => this.toPollResult(actor, poll));
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string) {
    const poll = await this.getPollOrThrow(id);
    if (!(await this.isVisible(actor, poll))) {
      throw new ForbiddenException('Sondage hors de votre périmètre');
    }
    return this.toPollResult(actor, poll);
  }

  /** Remplace le(s) vote(s) précédent(s) de la personne, sauf en choix multiple
   * où plusieurs options peuvent coexister — permet de changer d'avis tant que
   * le sondage reste ouvert. */
  async vote(actor: AuthenticatedUser, id: string, dto: VotePollDto) {
    const poll = await this.getPollOrThrow(id);
    if (!(await this.isVisible(actor, poll))) {
      throw new ForbiddenException('Sondage hors de votre périmètre');
    }
    if (this.isClosed(poll)) {
      throw new BadRequestException('Ce sondage est clôturé.');
    }
    if (!poll.allowMultiple && dto.optionIds.length > 1) {
      throw new BadRequestException('Ce sondage n’autorise qu’un seul choix.');
    }
    const validOptionIds = new Set(poll.options.map((o) => o.id));
    if (!dto.optionIds.every((id) => validOptionIds.has(id))) {
      throw new NotFoundException('Option de vote introuvable pour ce sondage.');
    }

    await this.prisma.$transaction([
      this.prisma.pollVote.deleteMany({ where: { pollId: id, userId: actor.id } }),
      this.prisma.pollVote.createMany({
        data: dto.optionIds.map((optionId) => ({ pollId: id, optionId, userId: actor.id })),
      }),
    ]);

    return this.findOneVisibleTo(actor, id);
  }

  async close(actor: AuthenticatedUser, id: string) {
    const poll = await this.getPollOrThrow(id);
    if (poll.authorId !== actor.id) {
      throw new ForbiddenException('Seul l’auteur peut clôturer ce sondage.');
    }
    if (this.isClosed(poll)) {
      throw new BadRequestException('Ce sondage est déjà clôturé.');
    }
    await this.prisma.poll.update({ where: { id }, data: { closedAt: new Date() } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Poll',
      entityId: id,
      metadata: { event: 'poll_closed' },
    });

    return this.findOneVisibleTo(actor, id);
  }

  // --------------------------------------------------------------------

  private isClosed(poll: Pick<Poll, 'closedAt' | 'closesAt'>): boolean {
    if (poll.closedAt) return true;
    if (poll.closesAt && poll.closesAt.getTime() <= Date.now()) return true;
    return false;
  }

  private toPollResult(actor: AuthenticatedUser, poll: PollWithVotes) {
    const canSeeDetail = poll.authorId === actor.id || TOP_LEVEL_ROLES.includes(actor.role);
    const myOptionIds = poll.votes.filter((v) => v.userId === actor.id).map((v) => v.optionId);
    const voterIds = new Set(poll.votes.map((v) => v.userId));

    const options = poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      order: option.order,
      voteCount: poll.votes.filter((v) => v.optionId === option.id).length,
    }));

    return {
      id: poll.id,
      authorId: poll.authorId,
      question: poll.question,
      allowMultiple: poll.allowMultiple,
      scope: poll.scope,
      divisionId: poll.divisionId,
      sectionId: poll.sectionId,
      celluleId: poll.celluleId,
      closesAt: poll.closesAt,
      closedAt: poll.closedAt,
      createdAt: poll.createdAt,
      isClosed: this.isClosed(poll),
      totalVoters: voterIds.size,
      options,
      myOptionIds,
      canSeeDetail,
      voters: canSeeDetail
        ? poll.votes.map((v) => ({ optionId: v.optionId, userId: v.userId, votedAt: v.votedAt }))
        : undefined,
    };
  }

  private async getPollOrThrow(id: string): Promise<PollWithVotes> {
    const poll = await this.prisma.poll.findUnique({ where: { id }, select: POLL_SELECT });
    if (!poll) throw new NotFoundException('Sondage introuvable');
    return poll;
  }

  // Visibilité et autorisation de ciblage : copie conforme d'AnnouncementsService
  // (visibilityWhere / isVisible / resolveAudienceAndAuthorize), adaptée au modèle Poll.

  private visibilityWhere(actor: AuthenticatedUser): Prisma.PollWhereInput {
    const clauses: Prisma.PollWhereInput[] = [
      { authorId: actor.id },
      { recipients: { some: { userId: actor.id } } },
      { scope: AnnouncementScope.DNPEC },
    ];
    if (actor.divisionId) {
      clauses.push({ scope: AnnouncementScope.DIVISION, divisionId: actor.divisionId });
      if (actor.sectionId) {
        clauses.push({ scope: AnnouncementScope.SECTION, divisionId: actor.divisionId, sectionId: actor.sectionId });
      }
    }
    if (actor.celluleId) {
      clauses.push({ scope: AnnouncementScope.CELLULE, celluleId: actor.celluleId });
    }
    return { OR: clauses };
  }

  private async isVisible(actor: AuthenticatedUser, poll: PollWithVotes): Promise<boolean> {
    if (poll.authorId === actor.id) return true;
    if (poll.scope === AnnouncementScope.DNPEC) return true;
    if (poll.scope === AnnouncementScope.DIVISION) {
      return !!actor.divisionId && actor.divisionId === poll.divisionId;
    }
    if (poll.scope === AnnouncementScope.SECTION) {
      return (
        !!actor.divisionId &&
        actor.divisionId === poll.divisionId &&
        !!actor.sectionId &&
        actor.sectionId === poll.sectionId
      );
    }
    if (poll.scope === AnnouncementScope.CELLULE) {
      return !!actor.celluleId && actor.celluleId === poll.celluleId;
    }
    const recipient = await this.prisma.pollRecipient.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: actor.id } },
    });
    return !!recipient;
  }

  private async resolveAudienceAndAuthorize(actor: AuthenticatedUser, dto: CreatePollDto): Promise<string[]> {
    switch (dto.scope) {
      case AnnouncementScope.DNPEC: {
        if (actor.role !== SystemRole.DN && actor.role !== SystemRole.DNA) {
          throw new ForbiddenException('Seuls le DN ou la DNA peuvent lancer un sondage pour toute la DNPEC.');
        }
        const users = await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } }, select: { id: true } });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.DIVISION: {
        if (!dto.divisionId) throw new BadRequestException('divisionId requis pour un sondage de portée Division.');
        await this.assertDivisionExists(dto.divisionId);
        this.cascade.assertCanManageUser(actor, { id: '__scope__', divisionId: dto.divisionId, sectionId: null, celluleId: null });
        const users = await this.prisma.user.findMany({
          where: { divisionId: dto.divisionId, status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.SECTION: {
        if (!dto.divisionId || !dto.sectionId) {
          throw new BadRequestException('divisionId et sectionId requis pour un sondage de portée Section.');
        }
        await this.assertSectionExists(dto.divisionId, dto.sectionId);
        this.cascade.assertCanManageUser(actor, {
          id: '__scope__',
          divisionId: dto.divisionId,
          sectionId: dto.sectionId,
          celluleId: null,
        });
        const users = await this.prisma.user.findMany({
          where: { divisionId: dto.divisionId, sectionId: dto.sectionId, status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.CELLULE: {
        if (!dto.celluleId) throw new BadRequestException('celluleId requis pour un sondage de portée Cellule.');
        await this.assertCelluleExists(dto.celluleId);
        this.cascade.assertCanManageUser(actor, { id: '__scope__', divisionId: null, sectionId: null, celluleId: dto.celluleId });
        const users = await this.prisma.user.findMany({
          where: { celluleId: dto.celluleId, status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.GROUPE_PERSONNALISE: {
        if (!dto.recipientUserIds?.length) {
          throw new BadRequestException('recipientUserIds requis pour un sondage de portée Groupe personnalisé.');
        }
        const users = await this.prisma.user.findMany({
          where: { id: { in: dto.recipientUserIds } },
          select: { id: true, divisionId: true, sectionId: true, celluleId: true, role: true },
        });
        if (users.length !== dto.recipientUserIds.length) {
          throw new NotFoundException('Un ou plusieurs destinataires sont introuvables.');
        }
        if (users.some((u) => u.role === SystemRole.STAGIAIRE)) {
          throw new ForbiddenException('Les sondages ne sont pas ouverts aux stagiaires.');
        }
        for (const user of users) {
          this.cascade.assertCanManageUser(actor, user);
        }
        return users.map((u) => u.id);
      }
    }
  }

  private async assertDivisionExists(id: string): Promise<void> {
    const division = await this.prisma.division.findUnique({ where: { id } });
    if (!division) throw new NotFoundException('Division introuvable');
  }

  private async assertSectionExists(divisionId: string, sectionId: string): Promise<void> {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.divisionId !== divisionId) {
      throw new NotFoundException('Section introuvable pour cette division');
    }
  }

  private async assertCelluleExists(id: string): Promise<void> {
    const cellule = await this.prisma.cellule.findUnique({ where: { id } });
    if (!cellule) throw new NotFoundException('Cellule introuvable');
  }
}
