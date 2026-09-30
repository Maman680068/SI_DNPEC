import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveBalance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { SetLeaveBalanceDto } from '../dto/set-leave-balance.dto';
import { MASKED_LEAVE_TYPE_LABEL, SENSITIVE_LEAVE_TYPE_CODE } from '../leave-medical-privacy.service';
import { estDrh } from '../../socle/roles-fonctionnels';

type OrgTarget = { id: string; divisionId: string | null; sectionId: string | null; celluleId: string | null };

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

  /**
   * Soldes d'un agent : lui-même, le DRH (qui décide des congés, N3) et ses responsables en cascade.
   * Congé maladie (§2.2, N3) : sa ligne n'est nommée que pour l'agent et le DRH ; les responsables,
   * DN et DNA compris, voient « Absence — motif protégé ».
   */
  async listForUser(actor: AuthenticatedUser, userId: string) {
    await this.assertCanView(actor, userId);
    const balances = await this.prisma.leaveBalance.findMany({
      where: { userId },
      include: { leaveType: true },
      orderBy: [{ year: 'desc' }, { leaveType: { code: 'asc' } }],
    });
    const masquer = actor.id !== userId && !estDrh(actor);
    return balances.map((b) => this.toView(b, masquer && b.leaveType.code === SENSITIVE_LEAVE_TYPE_CODE));
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

  private async assertCanView(actor: AuthenticatedUser, userId: string): Promise<OrgTarget> {
    if (actor.id === userId) {
      return { id: actor.id, divisionId: actor.divisionId, sectionId: actor.sectionId, celluleId: actor.celluleId };
    }
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (!estDrh(actor) && !this.cascade.hasDirectAuthorityOver(actor, target)) {
      throw new ForbiddenException("Vous n'avez pas accès au solde de congés de cet utilisateur.");
    }
    return target;
  }

  private toView(balance: LeaveBalance & { leaveType: { code: string; name: string } }, masked = false) {
    return {
      id: balance.id,
      leaveTypeId: masked ? null : balance.leaveTypeId,
      leaveTypeCode: masked ? null : balance.leaveType.code,
      leaveTypeName: masked ? MASKED_LEAVE_TYPE_LABEL : balance.leaveType.name,
      year: balance.year,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      remainingDays: balance.totalDays - balance.usedDays,
    };
  }
}
