import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';

@Injectable()
export class DivisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.division.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const division = await this.prisma.division.findUnique({ where: { id } });
    if (!division) throw new NotFoundException('Division introuvable');
    return division;
  }

  async create(dto: CreateDivisionDto) {
    const existing = await this.prisma.division.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code de division existe déjà');
    return this.prisma.division.create({ data: dto });
  }

  async update(id: string, dto: UpdateDivisionDto) {
    await this.findOneOrThrow(id);
    return this.prisma.division.update({ where: { id }, data: dto });
  }

  /**
   * Sans ces vérifications, la suppression heurterait un comportement de
   * clé étrangère incohérent selon la table : sections.divisionId est
   * ON DELETE CASCADE (les Sections disparaîtraient silencieusement),
   * tandis que users.divisionId / tasks.divisionId sont ON DELETE SET NULL
   * (les comptes et tâches seraient orphelins sans avertissement). On
   * bloque donc explicitement tant que l'un de ces trois existe encore.
   */
  async remove(id: string): Promise<void> {
    await this.findOneOrThrow(id);

    const [sectionCount, userCount, taskCount] = await Promise.all([
      this.prisma.section.count({ where: { divisionId: id } }),
      this.prisma.user.count({ where: { divisionId: id } }),
      this.prisma.task.count({ where: { divisionId: id } }),
    ]);

    if (sectionCount > 0) {
      throw new ConflictException(
        `Cette Division contient encore ${sectionCount} Section(s) — supprimez-les d’abord.`,
      );
    }
    if (userCount > 0) {
      throw new ConflictException(
        `Cette Division a encore ${userCount} utilisateur(s) rattaché(s) — impossible à supprimer.`,
      );
    }
    if (taskCount > 0) {
      throw new ConflictException(
        `Cette Division a encore ${taskCount} tâche(s) rattachée(s) — impossible à supprimer.`,
      );
    }

    await this.prisma.division.delete({ where: { id } });
  }

  /**
   * Suspend une Division (§2.3) : n'affecte jamais les personnes déjà
   * rattachées (elles gardent connexion, tâches, congés, documents intacts),
   * bloque seulement la croissance de l'unité — voir les points d'application
   * de isActive dans AuthService.getRegistrationOrgOptions,
   * UsersService.create/approveRegistration et TasksService.broadcastToDivision.
   */
  async suspend(id: string, actor: AuthenticatedUser) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.division.update({ where: { id }, data: { isActive: false } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Division',
      entityId: id,
      metadata: { event: 'suspended' },
    });

    return updated;
  }

  async reactivate(id: string, actor: AuthenticatedUser) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.division.update({ where: { id }, data: { isActive: true } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Division',
      entityId: id,
      metadata: { event: 'reactivated' },
    });

    return updated;
  }
}
