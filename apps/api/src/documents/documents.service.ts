import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DocumentVisibility, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentFiltersDto } from './dto/document-filters.dto';

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  visibility: true,
  isFinal: true,
  divisionId: true,
  folderId: true,
  sourceTaskId: true,
  currentVersionId: true,
  currentVersion: {
    select: { id: true, versionNumber: true, fileName: true, mimeType: true, sizeBytes: true, uploadedAt: true, uploadedById: true },
  },
  publishedAt: true,
  publishedById: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const VERSION_SELECT = {
  id: true,
  documentId: true,
  versionNumber: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  uploadedById: true,
  uploadedAt: true,
} satisfies Prisma.DocumentVersionSelect;

type DocumentWithVersion = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_SELECT }>;

/** Rôles pouvant publier institutionnellement (RF-GED-02) — DN/DNA pour toute la
 * DNPEC, un Chef de Division seulement pour les documents de sa propre division. */
const PUBLISHER_TOP_ROLES: SystemRole[] = [SystemRole.DN, SystemRole.DNA];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly cascade: CascadeService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateDocumentDto, file: Express.Multer.File): Promise<DocumentWithVersion> {
    this.cascade.assertCanAccessDivisionWorkspace(actor, dto.divisionId);
    if (dto.folderId) await this.assertFolderInDivision(dto.folderId, dto.divisionId);
    if (dto.sourceTaskId) await this.assertTaskExists(dto.sourceTaskId);

    const document = await this.storage.saveThen(file.buffer, file.originalname, ({ fileKey, sizeBytes }) =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            title: dto.title,
            description: dto.description,
            category: dto.category,
            divisionId: dto.divisionId,
            folderId: dto.folderId,
            sourceTaskId: dto.sourceTaskId,
            createdById: actor.id,
          },
        });
        const version = await tx.documentVersion.create({
          data: {
            documentId: created.id,
            versionNumber: 1,
            fileName: file.originalname,
            fileKey,
            mimeType: file.mimetype,
            sizeBytes,
            uploadedById: actor.id,
          },
        });
        return tx.document.update({ where: { id: created.id }, data: { currentVersionId: version.id }, select: DOCUMENT_SELECT });
      }),
    );

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Document',
      entityId: document.id,
      metadata: { title: document.title, divisionId: document.divisionId },
    });

    return document;
  }

  async findAllVisibleTo(actor: AuthenticatedUser, filters: DocumentFiltersDto): Promise<DocumentWithVersion[]> {
    const createdAt: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}) }
        : undefined;

    return this.prisma.document.findMany({
      where: {
        OR: this.visibilityClauses(actor),
        divisionId: filters.divisionId,
        category: filters.category,
        visibility: filters.visibility,
        folderId: filters.folderId,
        createdAt,
        title: filters.q ? { contains: filters.q, mode: 'insensitive' } : undefined,
      },
      select: DOCUMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string): Promise<DocumentWithVersion> {
    const document = await this.getOrThrow(id);
    this.assertVisible(actor, document);
    return document;
  }

  async listVersions(actor: AuthenticatedUser, id: string) {
    const document = await this.getOrThrow(id);
    this.assertVisible(actor, document);
    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      select: VERSION_SELECT,
      orderBy: { versionNumber: 'desc' },
    });
  }

  async addVersion(actor: AuthenticatedUser, id: string, file: Express.Multer.File): Promise<DocumentWithVersion> {
    const document = await this.getOrThrow(id);
    await this.assertCanModify(actor, document);

    const lastVersion = await this.prisma.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { versionNumber: 'desc' },
    });
    const updated = await this.storage.saveThen(file.buffer, file.originalname, ({ fileKey, sizeBytes }) =>
      this.prisma.$transaction(async (tx) => {
        const version = await tx.documentVersion.create({
          data: {
            documentId: id,
            versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
            fileName: file.originalname,
            fileKey,
            mimeType: file.mimetype,
            sizeBytes,
            uploadedById: actor.id,
          },
        });
        return tx.document.update({ where: { id }, data: { currentVersionId: version.id }, select: DOCUMENT_SELECT });
      }),
    );

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Document',
      entityId: id,
      metadata: { event: 'new_version', versionNumber: updated.currentVersion?.versionNumber },
    });

    return updated;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateDocumentDto): Promise<DocumentWithVersion> {
    const document = await this.getOrThrow(id);
    await this.assertCanModify(actor, document);
    if (dto.folderId) await this.assertFolderInDivision(dto.folderId, document.divisionId);

    const updated = await this.prisma.document.update({
      where: { id },
      data: { title: dto.title, description: dto.description, category: dto.category, folderId: dto.folderId },
      select: DOCUMENT_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Document',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  /** RF-GED-03 : marquage "Final" — condition préalable à la publication institutionnelle. */
  async markFinal(actor: AuthenticatedUser, id: string): Promise<DocumentWithVersion> {
    const document = await this.getOrThrow(id);
    await this.assertCanModify(actor, document);

    const updated = await this.prisma.document.update({ where: { id }, data: { isFinal: true }, select: DOCUMENT_SELECT });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.VALIDATION,
      entityType: 'Document',
      entityId: id,
      metadata: { event: 'marked_final' },
    });

    return updated;
  }

  /** RF-GED-02 : publication institutionnelle — DN/DNA (toute la DNPEC) ou Chef de
   * Division (sa propre division uniquement), et seulement si isFinal est déjà vrai. */
  async publish(actor: AuthenticatedUser, id: string): Promise<DocumentWithVersion> {
    const document = await this.getOrThrow(id);

    const isTopPublisher = PUBLISHER_TOP_ROLES.includes(actor.role);
    const isDivisionChief = actor.role === SystemRole.CHEF_DIVISION && actor.divisionId === document.divisionId;
    if (!isTopPublisher && !isDivisionChief) {
      throw new ForbiddenException('Seuls le DN, la DNA, ou le Chef de la division concernée peuvent publier ce document.');
    }
    if (!document.isFinal) {
      throw new ConflictException('Seul un document marqué "Final" peut être publié.');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { visibility: DocumentVisibility.PUBLIE_DNPEC, publishedAt: new Date(), publishedById: actor.id },
      select: DOCUMENT_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.PUBLICATION,
      entityType: 'Document',
      entityId: id,
      metadata: { title: document.title },
    });

    return updated;
  }

  async downloadVersion(actor: AuthenticatedUser, documentId: string, versionId: string) {
    const document = await this.getOrThrow(documentId);
    this.assertVisible(actor, document);

    const version = await this.prisma.documentVersion.findUnique({ where: { id: versionId } });
    if (!version || version.documentId !== documentId) throw new NotFoundException('Version introuvable pour ce document');

    return { version, stream: this.storage.createReadStream(version.fileKey) };
  }

  // --------------------------------------------------------------------

  /** Le PRIVE_DIVISION suit l'appartenance structurelle (RF-GED-01, "besoin d'en
   * connaître"), pas la cascade hiérarchique : DN/DNA n'y ont aucun raccourci, voir
   * CascadeService.isMemberOfDivision. */
  private visibilityClauses(actor: AuthenticatedUser): Prisma.DocumentWhereInput[] {
    const clauses: Prisma.DocumentWhereInput[] = [{ visibility: DocumentVisibility.PUBLIE_DNPEC }];
    if (actor.divisionId) {
      clauses.push({ visibility: DocumentVisibility.PRIVE_DIVISION, divisionId: actor.divisionId });
    }
    return clauses;
  }

  private assertVisible(actor: AuthenticatedUser, document: DocumentWithVersion): void {
    if (document.visibility === DocumentVisibility.PUBLIE_DNPEC) return;
    if (this.cascade.isMemberOfDivision(actor, document.divisionId)) return;
    throw new ForbiddenException("Ce document est hors de votre périmètre.");
  }

  private async assertCanModify(actor: AuthenticatedUser, document: DocumentWithVersion): Promise<void> {
    if (document.createdById === actor.id) return;
    const creator = await this.prisma.user.findUnique({
      where: { id: document.createdById },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!creator) throw new NotFoundException('Créateur du document introuvable');
    if (this.cascade.hasDirectAuthorityOver(actor, creator)) return;
    throw new ForbiddenException('Seuls le créateur ou son supérieur hiérarchique direct peuvent modifier ce document.');
  }

  private async getOrThrow(id: string): Promise<DocumentWithVersion> {
    const document = await this.prisma.document.findUnique({ where: { id }, select: DOCUMENT_SELECT });
    if (!document) throw new NotFoundException('Document introuvable');
    return document;
  }

  private async assertFolderInDivision(folderId: string, divisionId: string): Promise<void> {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.divisionId !== divisionId) {
      throw new NotFoundException('Dossier introuvable dans cette division');
    }
  }

  private async assertTaskExists(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche source introuvable');
  }
}
