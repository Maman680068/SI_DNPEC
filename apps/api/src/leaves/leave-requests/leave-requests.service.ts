import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, LeaveRequestStatus, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { NotificationsService } from '../../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from '../dto/decide-leave-request.dto';
import { RejectLeaveRequestDto } from '../dto/reject-leave-request.dto';
import { LeaveRequestFiltersDto } from '../dto/leave-request-filters.dto';

const LEAVE_REQUEST_SELECT = {
  id: true,
  userId: true,
  leaveTypeId: true,
  startDate: true,
  endDate: true,
  daysCount: true,
  reason: true,
  status: true,
  approverId: true,
  decisionComment: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
  leaveType: { select: { code: true, name: true } },
  user: { select: { id: true, firstName: true, lastName: true, divisionId: true, sectionId: true, celluleId: true } },
} satisfies Prisma.LeaveRequestSelect;

type LeaveRequestWithUser = Prisma.LeaveRequestGetPayload<{ select: typeof LEAVE_REQUEST_SELECT }>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Congés et absences (RF-CNG-01 à 04). Le solde restant n'est jamais
 * stocké : LeaveBalance.usedDays n'est mis à jour qu'ici, au moment précis
 * où le statut change réellement (approbation = crédit consommé,
 * annulation d'une demande déjà approuvée = crédit rendu) — jamais à la
 * simple soumission.
 */
@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateLeaveRequestDto): Promise<LeaveRequestWithUser> {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Type de congé introuvable');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('La date de fin ne peut pas être antérieure à la date de début.');
    }
    const daysCount = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId: actor.id,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        daysCount,
        reason: dto.reason,
      },
      select: LEAVE_REQUEST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'LeaveRequest',
      entityId: leaveRequest.id,
      metadata: { leaveType: leaveType.code, startDate: dto.startDate, endDate: dto.endDate, daysCount },
    });

    // Le(s) validateur(s) potentiel(s) de cette demande (chef direct de son
    // périmètre + DN/DNA) — jamais un id fixe, voir CascadeService.hasDirectAuthorityOver.
    const validators = await this.prisma.user.findMany({
      where: this.cascade.getUsersWithDirectAuthorityOverWhere(leaveRequest.user),
      select: { id: true },
    });
    if (validators.length > 0) {
      await this.notifications.notifyMany(
        validators.map((v) => v.id),
        NotificationType.CONGE_SOUMIS,
        'Nouvelle demande de congé',
        `${leaveRequest.user.firstName} ${leaveRequest.user.lastName} — ${leaveType.name}, ${daysCount} jour${daysCount > 1 ? 's' : ''}`,
        `/leaves?id=${leaveRequest.id}`,
        `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`,
      );
    }

    return leaveRequest;
  }

  /** Mes propres demandes + celles de mon périmètre si j'ai autorité de validation (DN/DNA/Chef de Division/Section/Cellule). */
  findAllVisibleTo(actor: AuthenticatedUser, filters: LeaveRequestFiltersDto): Promise<LeaveRequestWithUser[]> {
    return this.prisma.leaveRequest.findMany({
      where: {
        user: this.cascade.getVisibleUserWhereForLeadershipScope(actor),
        status: filters.status,
        userId: filters.userId,
        leaveTypeId: filters.leaveTypeId,
        startDate: filters.year ? { gte: new Date(filters.year, 0, 1), lt: new Date(filters.year + 1, 0, 1) } : undefined,
      },
      select: LEAVE_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string): Promise<LeaveRequestWithUser> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    if (leaveRequest.userId !== actor.id && !this.cascade.hasDirectAuthorityOver(actor, leaveRequest.user)) {
      throw new ForbiddenException('Cette demande de congé est hors de votre périmètre.');
    }
    return leaveRequest;
  }

  async approve(actor: AuthenticatedUser, id: string, dto: DecideLeaveRequestDto): Promise<LeaveRequestWithUser> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    this.cascade.assertHasDirectAuthorityOver(actor, leaveRequest.user);
    this.assertPending(leaveRequest);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveRequestStatus.APPROUVEE,
          approverId: actor.id,
          decisionComment: dto.comment,
          decidedAt: new Date(),
        },
        select: LEAVE_REQUEST_SELECT,
      });

      const year = result.startDate.getFullYear();
      await tx.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: { userId: result.userId, leaveTypeId: result.leaveTypeId, year },
        },
        update: { usedDays: { increment: result.daysCount } },
        create: {
          userId: result.userId,
          leaveTypeId: result.leaveTypeId,
          year,
          totalDays: 0,
          usedDays: result.daysCount,
        },
      });

      return result;
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.VALIDATION,
      entityType: 'LeaveRequest',
      entityId: id,
      metadata: { daysCount: updated.daysCount },
    });

    await this.notifications.notify(
      updated.userId,
      NotificationType.CONGE_VALIDE,
      'Demande de congé approuvée',
      `${updated.leaveType.name} — ${updated.daysCount} jour${updated.daysCount > 1 ? 's' : ''}`,
      `/leaves?id=${id}`,
      updated.leaveType.name,
    );

    return updated;
  }

  async reject(actor: AuthenticatedUser, id: string, dto: RejectLeaveRequestDto): Promise<LeaveRequestWithUser> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    this.cascade.assertHasDirectAuthorityOver(actor, leaveRequest.user);
    this.assertPending(leaveRequest);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.REJETEE,
        approverId: actor.id,
        decisionComment: dto.comment,
        decidedAt: new Date(),
      },
      select: LEAVE_REQUEST_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.REJET,
      entityType: 'LeaveRequest',
      entityId: id,
      metadata: { comment: dto.comment },
    });

    await this.notifications.notify(
      updated.userId,
      NotificationType.CONGE_REJETE,
      'Demande de congé rejetée',
      dto.comment,
      `/leaves?id=${id}`,
      updated.leaveType.name,
    );

    return updated;
  }

  /** Par le demandeur ou son supérieur cascade. Recrédite le solde si la demande était déjà approuvée. */
  async cancel(actor: AuthenticatedUser, id: string): Promise<LeaveRequestWithUser> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    const isRequester = leaveRequest.userId === actor.id;
    if (!isRequester && !this.cascade.hasDirectAuthorityOver(actor, leaveRequest.user)) {
      throw new ForbiddenException("Vous n'avez pas l'autorité pour annuler cette demande.");
    }
    if (
      leaveRequest.status !== LeaveRequestStatus.EN_ATTENTE &&
      leaveRequest.status !== LeaveRequestStatus.APPROUVEE
    ) {
      throw new ConflictException('Seule une demande en attente ou approuvée peut être annulée.');
    }

    const wasApproved = leaveRequest.status === LeaveRequestStatus.APPROUVEE;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: { status: LeaveRequestStatus.ANNULEE },
        select: LEAVE_REQUEST_SELECT,
      });

      if (wasApproved) {
        const year = result.startDate.getFullYear();
        await tx.leaveBalance.updateMany({
          where: { userId: result.userId, leaveTypeId: result.leaveTypeId, year },
          data: { usedDays: { decrement: result.daysCount } },
        });
      }

      return result;
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'LeaveRequest',
      entityId: id,
      metadata: { event: 'leave_cancelled', refunded: wasApproved },
    });

    return updated;
  }

  private async getLeaveRequestOrThrow(id: string): Promise<LeaveRequestWithUser> {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({ where: { id }, select: LEAVE_REQUEST_SELECT });
    if (!leaveRequest) throw new NotFoundException('Demande de congé introuvable');
    return leaveRequest;
  }

  private assertPending(leaveRequest: LeaveRequestWithUser): void {
    if (leaveRequest.status !== LeaveRequestStatus.EN_ATTENTE) {
      throw new ConflictException('Seule une demande en attente peut être approuvée ou rejetée.');
    }
  }
}
