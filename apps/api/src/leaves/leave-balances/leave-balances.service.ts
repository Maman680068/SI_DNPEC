import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveBalance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { SetLeaveBalanceDto } from '../dto/set-leave-balance.dto';
import { LeaveMedicalPrivacyService, MASKED_LEAVE_TYPE_LABEL, SENSITIVE_LEAVE_TYPE_CODE } from '../leave-medical-privacy.service';

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
    private readonly medicalPrivacy: LeaveMedicalPrivacyService,
  ) {}

  /**
   * Vue passive/agrégée (pas une décision précise à prendre sur une demande) : ici le
   * masquage congé maladie s'applique dès que l'acteur est DN/DNA regardant le solde
   * d'un tiers dont l'unité a un chef plus proche — sans exception "validateur réel",
   * contrairement à LeaveRequestsService (voir LeaveMedicalPrivacyService pour la
   * distinction). Un DN/DNA amené à décider d'une demande précise sans chef plus
   * proche verra le vrai solde via ce même calcul, car il est alors le seul validateur.
   */
  async listForUser(actor: AuthenticatedUser, userId: string) {
    const target = await this.assertCanView(actor, userId);
    const balances = await this.prisma.leaveBalance.findMany({
      where: { userId },
      include: { leaveType: true },
      orderBy: [{ year: 'desc' }, { leaveType: { code: 'asc' } }],
    });

    const mustCheckMasking = actor.id !== userId && this.cascade.isLeadershipRole(actor.role);
    const hasCloserValidator = mustCheckMasking ? await this.medicalPrivacy.hasCloserValidator(target) : false;
    return balances.map((b) =>
      this.toView(b, mustCheckMasking && hasCloserValidator && b.leaveType.code === SENSITIVE_LEAVE_TYPE_CODE),
    );
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
    if (!this.cascade.hasDirectAuthorityOver(actor, target)) {
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
