import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

/**
 * Regroupement de tâches (RF-TAC-13). Visibilité simple par division (pas
 * de confidentialité propre au Projet — c'est la confidentialité de chaque
 * Task qui filtre le contenu réel) : création libre pour tout utilisateur
 * authentifié, modification/suppression réservées au créateur ou à
 * ADMIN_SYSTEME (paramétrage, pas de contenu métier ici).
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthenticatedUser, dto: CreateProjectDto) {
    if (dto.divisionId) await this.assertDivisionExists(dto.divisionId);

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        divisionId: dto.divisionId,
        createdById: actor.id,
      },
    });
  }

  findAllVisibleTo(actor: AuthenticatedUser) {
    const isTopLevel =
      actor.role === SystemRole.DN || actor.role === SystemRole.DNA || actor.role === SystemRole.ADMIN_SYSTEME;

    let where: Prisma.ProjectWhereInput = {};
    if (!isTopLevel) {
      const visibilityOr: Prisma.ProjectWhereInput[] = [{ createdById: actor.id }];
      if (actor.divisionId) visibilityOr.push({ divisionId: actor.divisionId });
      where = { OR: visibilityOr };
    }

    return this.prisma.project.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async findOneOrThrow(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Projet introuvable');
    return project;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    const project = await this.findOneOrThrow(id);
    this.assertCanManage(actor, project.createdById);
    if (dto.divisionId) await this.assertDivisionExists(dto.divisionId);

    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const project = await this.findOneOrThrow(id);
    this.assertCanManage(actor, project.createdById);
    await this.prisma.project.delete({ where: { id } });
  }

  private assertCanManage(actor: AuthenticatedUser, createdById: string): void {
    if (actor.id === createdById || actor.role === SystemRole.ADMIN_SYSTEME) return;
    throw new ForbiddenException('Seuls le créateur du projet ou un administrateur peuvent le modifier.');
  }

  private async assertDivisionExists(divisionId: string): Promise<void> {
    const division = await this.prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division introuvable');
  }
}
