import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Cellule } from '@prisma/client';
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

  /** users.celluleId / tasks.celluleId sont ON DELETE SET NULL — sans ce contrôle,
   * supprimer une Cellule encore utilisée orphelinerait silencieusement ces lignes
   * (le chef éventuel est lui aussi rattaché via celluleId, donc déjà couvert). */
  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);

    const [userCount, taskCount] = await Promise.all([
      this.prisma.user.count({ where: { celluleId: id } }),
      this.prisma.task.count({ where: { celluleId: id } }),
    ]);

    if (userCount > 0) {
      throw new ConflictException(
        `Cette Cellule a encore ${userCount} utilisateur(s) rattaché(s) — impossible à supprimer.`,
      );
    }
    if (taskCount > 0) {
      throw new ConflictException(
        `Cette Cellule a encore ${taskCount} tâche(s) rattachée(s) — impossible à supprimer.`,
      );
    }

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
  /** Voir DivisionsService.suspend — même principe. Le chef en poste, s'il y en a un,
   * n'est jamais touché : seule la nomination d'un NOUVEAU chef est bloquée (assignChef). */
  async suspend(id: string, actor: AuthenticatedUser) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.cellule.update({ where: { id }, data: { isActive: false } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Cellule',
      entityId: id,
      metadata: { event: 'suspended' },
    });

    return updated;
  }

  async reactivate(id: string, actor: AuthenticatedUser) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.cellule.update({ where: { id }, data: { isActive: true } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Cellule',
      entityId: id,
      metadata: { event: 'reactivated' },
    });

    return updated;
  }
}
