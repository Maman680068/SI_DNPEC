import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, AnnouncementScope, AuditAction, NotificationType, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';

/**
 * Annonces ciblées en cascade (RF-COM-02). L'autorité de CIBLAGE (qui a le
 * droit de diffuser à tel périmètre) est distincte de l'AUDIENCE de lecture
 * (qui voit l'annonce une fois publiée = tout le monde dans le périmètre
 * ciblé, pas seulement le sous-arbre hiérarchique de l'auteur).
 *
 * Le ciblage réutilise CascadeService.canManageUser tel quel, sans rien y
 * ajouter : en construisant une cible synthétique {divisionId, sectionId,
 * celluleId}, la logique déjà écrite pour "un Chef de Division a autorité
 * sur toute sa division" répond exactement à "un Chef de Division peut
 * cibler toute sa division" (son test ignore sectionId), et de même pour
 * Section/Cellule/groupe personnalisé.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateAnnouncementDto): Promise<Announcement> {
    const recipientIds = await this.resolveAudienceAndAuthorize(actor, dto);

    const announcement = await this.prisma.announcement.create({
      data: {
        authorId: actor.id,
        title: dto.title,
        body: dto.body,
        scope: dto.scope,
        divisionId: dto.divisionId,
        sectionId: dto.sectionId,
        celluleId: dto.celluleId,
        recipients:
          dto.scope === AnnouncementScope.GROUPE_PERSONNALISE
            ? { create: recipientIds.map((userId) => ({ userId })) }
            : undefined,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Announcement',
      entityId: announcement.id,
      metadata: { scope: dto.scope, audienceSize: recipientIds.length },
    });

    await this.notifications.notifyMany(
      recipientIds.filter((id) => id !== actor.id),
      NotificationType.ANNONCE,
      dto.title,
      dto.body,
      `/announcements/${announcement.id}`,
    );

    return announcement;
  }

  async findAllVisibleTo(actor: AuthenticatedUser): Promise<Announcement[]> {
    return this.prisma.announcement.findMany({
      where: this.visibilityWhere(actor),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string): Promise<Announcement> {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('Annonce introuvable');
    if (await this.isVisible(actor, announcement)) return announcement;
    throw new ForbiddenException('Annonce hors de votre périmètre');
  }

  async markRead(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.findOneVisibleTo(actor, id);
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: actor.id } },
      update: {},
      create: { announcementId: id, userId: actor.id },
    });
  }

  async listReads(actor: AuthenticatedUser, id: string) {
    const announcement = await this.prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException('Annonce introuvable');
    const isTopLevel = actor.role === SystemRole.DN || actor.role === SystemRole.DNA || actor.role === SystemRole.ADMIN_SYSTEME;
    if (announcement.authorId !== actor.id && !isTopLevel) {
      throw new ForbiddenException("Seul l'auteur de l'annonce (ou un dirigeant) peut consulter son suivi de lecture.");
    }
    return this.prisma.announcementRead.findMany({ where: { announcementId: id }, orderBy: { readAt: 'asc' } });
  }

  // --------------------------------------------------------------------

  private visibilityWhere(actor: AuthenticatedUser): Prisma.AnnouncementWhereInput {
    const clauses: Prisma.AnnouncementWhereInput[] = [
      { authorId: actor.id },
      { recipients: { some: { userId: actor.id } } },
      { scope: AnnouncementScope.DNPEC },
    ];
    if (actor.divisionId) {
      clauses.push({ scope: AnnouncementScope.DIVISION, divisionId: actor.divisionId });
      if (actor.sectionId) {
        clauses.push({
          scope: AnnouncementScope.SECTION,
          divisionId: actor.divisionId,
          sectionId: actor.sectionId,
        });
      }
    }
    if (actor.celluleId) {
      clauses.push({ scope: AnnouncementScope.CELLULE, celluleId: actor.celluleId });
    }
    return { OR: clauses };
  }

  private async isVisible(actor: AuthenticatedUser, announcement: Announcement): Promise<boolean> {
    if (announcement.authorId === actor.id) return true;
    if (announcement.scope === AnnouncementScope.DNPEC) return true;
    if (announcement.scope === AnnouncementScope.DIVISION) {
      return !!actor.divisionId && actor.divisionId === announcement.divisionId;
    }
    if (announcement.scope === AnnouncementScope.SECTION) {
      return (
        !!actor.divisionId &&
        actor.divisionId === announcement.divisionId &&
        !!actor.sectionId &&
        actor.sectionId === announcement.sectionId
      );
    }
    if (announcement.scope === AnnouncementScope.CELLULE) {
      return !!actor.celluleId && actor.celluleId === announcement.celluleId;
    }
    // GROUPE_PERSONNALISE : destinataire explicite, à vérifier en base.
    const recipient = await this.prisma.announcementRecipient.findUnique({
      where: { announcementId_userId: { announcementId: announcement.id, userId: actor.id } },
    });
    return !!recipient;
  }

  /** Vérifie l'autorité de ciblage et renvoie la liste des destinataires effectifs. */
  private async resolveAudienceAndAuthorize(
    actor: AuthenticatedUser,
    dto: CreateAnnouncementDto,
  ): Promise<string[]> {
    switch (dto.scope) {
      case AnnouncementScope.DNPEC: {
        if (actor.role !== SystemRole.DN && actor.role !== SystemRole.DNA) {
          throw new ForbiddenException('Seuls le DN ou la DNA peuvent diffuser une annonce à toute la DNPEC.');
        }
        const users = await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF }, select: { id: true } });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.DIVISION: {
        if (!dto.divisionId) throw new BadRequestException('divisionId requis pour une annonce de portée Division.');
        await this.assertDivisionExists(dto.divisionId);
        this.cascade.assertCanManageUser(actor, {
          id: '__scope__',
          divisionId: dto.divisionId,
          sectionId: null,
          celluleId: null,
        });
        const users = await this.prisma.user.findMany({
          where: { divisionId: dto.divisionId, status: UserStatus.ACTIF },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.SECTION: {
        if (!dto.divisionId || !dto.sectionId) {
          throw new BadRequestException('divisionId et sectionId requis pour une annonce de portée Section.');
        }
        await this.assertSectionExists(dto.divisionId, dto.sectionId);
        this.cascade.assertCanManageUser(actor, {
          id: '__scope__',
          divisionId: dto.divisionId,
          sectionId: dto.sectionId,
          celluleId: null,
        });
        const users = await this.prisma.user.findMany({
          where: { divisionId: dto.divisionId, sectionId: dto.sectionId, status: UserStatus.ACTIF },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.CELLULE: {
        if (!dto.celluleId) throw new BadRequestException('celluleId requis pour une annonce de portée Cellule.');
        await this.assertCelluleExists(dto.celluleId);
        this.cascade.assertCanManageUser(actor, {
          id: '__scope__',
          divisionId: null,
          sectionId: null,
          celluleId: dto.celluleId,
        });
        const users = await this.prisma.user.findMany({
          where: { celluleId: dto.celluleId, status: UserStatus.ACTIF },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }

      case AnnouncementScope.GROUPE_PERSONNALISE: {
        if (!dto.recipientUserIds?.length) {
          throw new BadRequestException(
            'recipientUserIds requis pour une annonce de portée Groupe personnalisé.',
          );
        }
        const users = await this.prisma.user.findMany({
          where: { id: { in: dto.recipientUserIds } },
          select: { id: true, divisionId: true, sectionId: true, celluleId: true },
        });
        if (users.length !== dto.recipientUserIds.length) {
          throw new NotFoundException('Un ou plusieurs destinataires sont introuvables.');
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
      throw new NotFoundException("Section introuvable pour cette division");
    }
  }

  private async assertCelluleExists(id: string): Promise<void> {
    const cellule = await this.prisma.cellule.findUnique({ where: { id } });
    if (!cellule) throw new NotFoundException('Cellule introuvable');
  }
}
