import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Folder } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateFolderDto } from '../dto/create-folder.dto';
import { UpdateFolderDto } from '../dto/update-folder.dto';

/** Dossiers libres au sein de l'espace privé d'une division (RF-GED-04). */
@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateFolderDto): Promise<Folder> {
    this.cascade.assertCanAccessDivisionWorkspace(actor, dto.divisionId);

    if (dto.parentFolderId) {
      const parent = await this.prisma.folder.findUnique({ where: { id: dto.parentFolderId } });
      if (!parent || parent.divisionId !== dto.divisionId) {
        throw new NotFoundException('Dossier parent introuvable dans cette division');
      }
    }

    const folder = await this.prisma.folder.create({
      data: { name: dto.name, divisionId: dto.divisionId, parentFolderId: dto.parentFolderId, createdById: actor.id },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Folder',
      entityId: folder.id,
      metadata: { name: folder.name, divisionId: folder.divisionId },
    });

    return folder;
  }

  /** Lister l'arborescence privée d'une division est une LECTURE (RF-GED-01,
   * "besoin d'en connaître") — appartenance structurelle, pas cascade
   * hiérarchique, voir CascadeService.isMemberOfDivision. */
  async findAllForDivision(actor: AuthenticatedUser, divisionId: string): Promise<Folder[]> {
    this.cascade.assertIsMemberOfDivision(actor, divisionId);
    return this.prisma.folder.findMany({ where: { divisionId }, orderBy: { name: 'asc' } });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateFolderDto): Promise<Folder> {
    const folder = await this.getOrThrow(id);
    await this.assertCanModify(actor, folder);

    if (dto.parentFolderId) {
      const parent = await this.prisma.folder.findUnique({ where: { id: dto.parentFolderId } });
      if (!parent || parent.divisionId !== folder.divisionId) {
        throw new NotFoundException('Dossier parent introuvable dans cette division');
      }
    }

    const updated = await this.prisma.folder.update({
      where: { id },
      data: { name: dto.name, parentFolderId: dto.parentFolderId },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Folder',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  private async getOrThrow(id: string): Promise<Folder> {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('Dossier introuvable');
    return folder;
  }

  private async assertCanModify(actor: AuthenticatedUser, folder: Folder): Promise<void> {
    if (folder.createdById === actor.id) return;
    const creator = await this.prisma.user.findUnique({
      where: { id: folder.createdById },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!creator) throw new NotFoundException('Créateur du dossier introuvable');
    if (this.cascade.hasDirectAuthorityOver(actor, creator)) return;
    throw new ForbiddenException('Seuls le créateur ou son supérieur hiérarchique direct peuvent modifier ce dossier.');
  }
}
