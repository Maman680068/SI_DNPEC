import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Cellule, SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateCelluleDto } from './dto/create-cellule.dto';
import { UpdateCelluleDto } from './dto/update-cellule.dto';

@Injectable()
export class CellulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.cellule.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string): Promise<Cellule> {
    const cellule = await this.prisma.cellule.findUnique({ where: { id } });
    if (!cellule) throw new NotFoundException('Cellule introuvable');
    return cellule;
  }

  async create(dto: CreateCelluleDto) {
    const existing = await this.prisma.cellule.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code de cellule existe déjà');
    return this.prisma.cellule.create({ data: dto });
  }

  async update(id: string, dto: UpdateCelluleDto) {
    await this.findOneOrThrow(id);
    return this.prisma.cellule.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);
    await this.prisma.cellule.delete({ where: { id } });
  }

  /**
   * Nomme le chef d'une cellule (SAF, RH, CSID pour l'instant — CTSCM/CNC
   * n'ont pas encore de structure définie, rien n'empêche techniquement de
   * leur en assigner un le jour venu). Transactionnel : démet l'ancien chef
   * (retour au rôle AGENT) et promeut le nouveau, en maintenant l'invariant
   * documenté dans le schéma (CHEF_CELLULE.celluleId == Cellule dont il est
   * chefId).
   */
  async assignChef(celluleId: string, userId: string, actor: AuthenticatedUser) {
    const cellule = await this.findOneOrThrow(celluleId);

    const targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new NotFoundException('Utilisateur introuvable');
    if (targetUser.divisionId) {
      throw new ConflictException(
        'Un utilisateur rattaché à une Division ne peut pas devenir chef de cellule sans changer de rattachement au préalable.',
      );
    }

    const previousChefId = cellule.chefId;

    const updatedCellule = await this.prisma.$transaction(async (tx) => {
      if (previousChefId && previousChefId !== userId) {
        await tx.user.update({ where: { id: previousChefId }, data: { role: SystemRole.AGENT } });
      }
      await tx.user.update({
        where: { id: userId },
        data: { role: SystemRole.CHEF_CELLULE, celluleId },
      });
      return tx.cellule.update({ where: { id: celluleId }, data: { chefId: userId } });
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Cellule',
      entityId: celluleId,
      metadata: { event: 'chef_assigned', previousChefId, newChefId: userId },
    });

    return updatedCellule;
  }

  async removeChef(celluleId: string, actor: AuthenticatedUser) {
    const cellule = await this.findOneOrThrow(celluleId);
    if (!cellule.chefId) return cellule;

    const previousChefId = cellule.chefId;

    const updatedCellule = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: previousChefId }, data: { role: SystemRole.AGENT } });
      return tx.cellule.update({ where: { id: celluleId }, data: { chefId: null } });
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Cellule',
      entityId: celluleId,
      metadata: { event: 'chef_removed', previousChefId },
    });

    return updatedCellule;
  }
}
