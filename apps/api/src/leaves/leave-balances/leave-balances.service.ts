import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveBalance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { SetLeaveBalanceDto } from '../dto/set-leave-balance.dto';

/**
 * Le solde restant n'est jamais stocké : toujours `totalDays - usedDays`,
 * calculé à la lecture (voir toLeaveBalanceView). `usedDays` n'est modifié
 * que par LeaveRequestsService (à l'approbation/l'annulation) ; ce service
 * gère uniquement le provisionnement de `totalDays` par l'administration.
 */
@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cascade: CascadeService,
  ) {}

  async listForUser(actor: AuthenticatedUser, userId: string) {
    await this.assertCanView(actor, userId);
    const balances = await this.prisma.leaveBalance.findMany({
      where: { userId },
      include: { leaveType: true },
      orderBy: [{ year: 'desc' }, { leaveType: { code: 'asc' } }],
    });
    return balances.map((b) => this.toView(b));
  }

  /** Provisionne/ajuste totalDays pour (userId, leaveTypeId, year) — paramétrage RH, ADMIN_SYSTEME uniquement (cf. controller). */
  async setTotalDays(userId: string, dto: SetLeaveBalanceDto) {
    const [user, leaveType] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!leaveType) throw new NotFoundException('Type de congé introuvable');

    const balance = await this.prisma.leaveBalance.upsert({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId: dto.leaveTypeId, year: dto.year } },
      update: { totalDays: dto.totalDays },
      create: { userId, leaveTypeId: dto.leaveTypeId, year: dto.year, totalDays: dto.totalDays },
      include: { leaveType: true },
    });
    return this.toView(balance);
  }

  private async assertCanView(actor: AuthenticatedUser, userId: string): Promise<void> {
    if (actor.id === userId) return;
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (!this.cascade.hasDirectAuthorityOver(actor, target)) {
      throw new ForbiddenException("Vous n'avez pas accès au solde de congés de cet utilisateur.");
    }
  }

  private toView(balance: LeaveBalance & { leaveType: { code: string; name: string } }) {
    return {
      id: balance.id,
      leaveTypeId: balance.leaveTypeId,
      leaveTypeCode: balance.leaveType.code,
      leaveTypeName: balance.leaveType.name,
      year: balance.year,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      remainingDays: balance.totalDays - balance.usedDays,
    };
  }
}
