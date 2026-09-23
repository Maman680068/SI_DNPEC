import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAllForDivision(divisionId: string) {
    await this.assertDivisionExists(divisionId);
    return this.prisma.section.findMany({ where: { divisionId }, orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) throw new NotFoundException('Section introuvable');
    return section;
  }

  async create(divisionId: string, dto: CreateSectionDto) {
    await this.assertDivisionExists(divisionId);

    const existing = await this.prisma.section.findUnique({
      where: { divisionId_code: { divisionId, code: dto.code } },
    });
    if (existing) throw new ConflictException('Ce code de section existe déjà dans cette division');

    return this.prisma.section.create({ data: { ...dto, divisionId } });
  }

  async update(id: string, dto: UpdateSectionDto) {
    await this.findOneOrThrow(id);
    return this.prisma.section.update({ where: { id }, data: dto });
  }

  /** users.sectionId / tasks.sectionId sont ON DELETE SET NULL — sans ce contrôle,
   * supprimer une Section encore utilisée orphelinerait silencieusement ces lignes. */
  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);

    const [userCount, taskCount] = await Promise.all([
      this.prisma.user.count({ where: { sectionId: id } }),
      this.prisma.task.count({ where: { sectionId: id } }),
    ]);

    if (userCount > 0) {
      throw new ConflictException(
        `Cette Section a encore ${userCount} utilisateur(s) rattaché(s) — impossible à supprimer.`,
      );
    }
    if (taskCount > 0) {
      throw new ConflictException(
        `Cette Section a encore ${taskCount} tâche(s) rattachée(s) — impossible à supprimer.`,
      );
    }

    await this.prisma.section.delete({ where: { id } });
  }

  /** Voir DivisionsService.suspend — même principe, indépendant du statut de la Division. */
  async suspend(id: string, actor: AuthenticatedUser) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.section.update({ where: { id }, data: { isActive: false } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Section',
      entityId: id,
      metadata: { event: 'suspended' },
    });

    return updated;
  }

  async reactivate(id: string, actor: AuthenticatedUser) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.section.update({ where: { id }, data: { isActive: true } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Section',
      entityId: id,
      metadata: { event: 'reactivated' },
    });

    return updated;
  }

  private async assertDivisionExists(divisionId: string): Promise<void> {
    const division = await this.prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division introuvable');
  }
}
