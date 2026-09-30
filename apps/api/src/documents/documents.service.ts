import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DocumentVisibility, Prisma, StatutDiffusion, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentFiltersDto } from './dto/document-filters.dto';
import { StatutDocumentDto } from './dto/statut-document.dto';
import { ExportsService, LIBELLE_STATUT } from '../socle/exports.service';
import { TasksService } from '../tasks/tasks.service';
import { MeetingsService } from '../meetings/meetings.service';

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
  sourceMeetingId: true,
  statutDiffusion: true,
  typeDocument: true,
  dateDocument: true,
  periodeDebut: true,
  periodeFin: true,
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

/** Vue renvoyée au web (socle N4) : droits calculés ici, lien d'origine limité à ce que le lecteur voit. */
export type DocumentVue = DocumentWithVersion & {
  metadonneesCompletes: boolean;
  source: { type: 'TACHE' | 'REUNION'; id: string; titre: string | null } | null;
  droits: { modifier: boolean; marquerFinal: boolean; publier: boolean; valider: boolean; rendreDiffusable: boolean; retirer: boolean };
};

/** Objet des changements de statut (journal générique `changements_statut`). */
const OBJET_DOCUMENT = 'Document';
const jour = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);

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
    private readonly exports: ExportsService,
    private readonly tasks: TasksService,
    private readonly meetings: MeetingsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateDocumentDto, file: Express.Multer.File): Promise<DocumentWithVersion> {
    this.cascade.assertCanAccessDivisionWorkspace(actor, dto.divisionId);
    if (dto.folderId) await this.assertFolderInDivision(dto.folderId, dto.divisionId);
    if (dto.sourceTaskId) await this.assertTaskExists(actor, dto.sourceTaskId);
    if (dto.sourceMeetingId) await this.meetings.findOneVisibleTo(actor, dto.sourceMeetingId);
    if (dto.sourceTaskId && dto.sourceMeetingId) throw new BadRequestException('Un document est issu d’une tâche ou d’une réunion, pas des deux.');
    this.assertPeriode(dto.periodeDebut, dto.periodeFin);
    if (!file) throw new BadRequestException('Le fichier est obligatoire.');

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
            sourceMeetingId: dto.sourceMeetingId,
            typeDocument: dto.typeDocument,
            dateDocument: dto.dateDocument ? jour(dto.dateDocument) : undefined,
            periodeDebut: jour(dto.periodeDebut),
            periodeFin: jour(dto.periodeFin),
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
      metadata: { title: document.title, divisionId: document.divisionId, typeDocument: document.typeDocument, source: dto.sourceTaskId ? 'tache' : dto.sourceMeetingId ? 'reunion' : null },
    });

    return document;
  }

  /** Vue d'un document pour l'acteur (droits, lien d'origine, complétude des métadonnées). */
  async presenter(actor: AuthenticatedUser, d: DocumentWithVersion): Promise<DocumentVue> {
    const modifier = await this.peutModifier(actor, d);
    const validateur = this.estValidateur(actor, d);
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    const complet = this.metadonneesCompletes(d);
    let source: DocumentVue['source'] = null;
    if (d.sourceTaskId) {
      const t = await this.tasks.findOneVisibleTo(actor, d.sourceTaskId).catch(() => null);
      source = { type: 'TACHE', id: d.sourceTaskId, titre: t ? t.title : null };
    } else if (d.sourceMeetingId) {
      const m = await this.meetings.findOneVisibleTo(actor, d.sourceMeetingId).catch(() => null);
      source = { type: 'REUNION', id: d.sourceMeetingId, titre: m ? m.title : null };
    }
    return {
      ...d,
      metadonneesCompletes: complet,
      source,
      droits: {
        modifier,
        marquerFinal: modifier && !d.isFinal,
        publier: d.isFinal && d.visibility !== DocumentVisibility.PUBLIE_DNPEC && this.peutPublier(actor, d),
        valider: validateur && d.statutDiffusion === StatutDiffusion.BROUILLON,
        rendreDiffusable: direction && d.statutDiffusion === StatutDiffusion.VALIDE,
        retirer: (d.statutDiffusion === StatutDiffusion.DIFFUSABLE && direction) || (d.statutDiffusion === StatutDiffusion.VALIDE && validateur),
      },
    };
  }

  /**
   * Statut de diffusion (§7.1) : Brouillon → Validé (chef de la division productrice, DN, DNA ;
   * document « Final » aux métadonnées complètes) → Diffusable (DN, DNA). Retrait d'un cran avec
   * motif ; rien ne disparaît. Journalisé (`changements_statut`) et audité.
   */
  async changerStatut(actor: AuthenticatedUser, id: string, dto: StatutDocumentDto): Promise<DocumentWithVersion> {
    const d = await this.getOrThrow(id);
    this.assertVisible(actor, d);
    const de = d.statutDiffusion;
    const vers = dto.vers;
    const motif = dto.motif?.trim() || null;
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    const ordre: StatutDiffusion[] = [StatutDiffusion.BROUILLON, StatutDiffusion.VALIDE, StatutDiffusion.DIFFUSABLE];
    const ecart = ordre.indexOf(vers) - ordre.indexOf(de);
    if (ecart === 0) throw new ConflictException(`Le document est déjà « ${LIBELLE_STATUT[vers]} ».`);
    if (Math.abs(ecart) > 1) throw new ConflictException(`Passage direct de « ${LIBELLE_STATUT[de]} » à « ${LIBELLE_STATUT[vers]} » impossible : un statut à la fois.`);
    if (vers === StatutDiffusion.VALIDE && de === StatutDiffusion.BROUILLON) {
      if (!this.estValidateur(actor, d)) throw new ForbiddenException('La validation revient au chef de la division productrice, au DN ou à la DNA.');
      if (!d.isFinal) throw new ConflictException('Seul un document marqué « Final » peut être validé.');
      if (!this.metadonneesCompletes(d)) throw new ConflictException('Métadonnées à compléter avant validation : type, date et période couverte.');
    } else if (vers === StatutDiffusion.DIFFUSABLE) {
      if (!direction) throw new ForbiddenException('Seuls le DN et la DNA rendent un document diffusable hors de la Direction.');
    } else {
      // Retrait d'un cran : de Diffusable par le DN/DNA, de Validé par un validateur.
      const autorise = de === StatutDiffusion.DIFFUSABLE ? direction : this.estValidateur(actor, d);
      if (!autorise) throw new ForbiddenException('Vous ne pouvez pas retirer ce statut.');
      if (!motif || motif.length < 5) throw new BadRequestException('Le retrait exige un motif (5 caractères au moins).');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const n = await tx.document.updateMany({ where: { id, statutDiffusion: de }, data: { statutDiffusion: vers } });
      if (!n.count) throw new ConflictException('Le statut vient de changer : rechargez le document.');
      await tx.changementStatut.create({ data: { objetType: OBJET_DOCUMENT, objetId: id, de, vers, motif, parId: actor.id } });
      return tx.document.findUniqueOrThrow({ where: { id }, select: DOCUMENT_SELECT });
    });
    await this.audit.log({
      actorId: actor.id,
      action: ecart > 0 ? AuditAction.VALIDATION : AuditAction.MODIFICATION,
      entityType: 'Document',
      entityId: id,
      metadata: { event: 'statut_diffusion', de, vers, motif },
    });
    return updated;
  }

  async historiqueStatut(actor: AuthenticatedUser, id: string) {
    const d = await this.getOrThrow(id);
    this.assertVisible(actor, d);
    const lignes = await this.prisma.changementStatut.findMany({ where: { objetType: OBJET_DOCUMENT, objetId: id }, orderBy: { le: 'desc' } });
    const ids = [...new Set(lignes.map((l) => l.parId).filter((x): x is string => !!x))];
    const noms = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return lignes.map((l) => ({ id: l.id, de: l.de, vers: l.vers, motif: l.motif, le: l.le, par: l.parId ? noms.get(l.parId) ?? null : 'Système' }));
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
        typeDocument: filters.typeDocument,
        statutDiffusion: filters.statutDiffusion,
        sourceTaskId: filters.sourceTaskId,
        sourceMeetingId: filters.sourceMeetingId,
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
        // Nouveau contenu : un document Validé ou Diffusable redevient Brouillon (§7.1).
        if (document.statutDiffusion !== StatutDiffusion.BROUILLON) {
          await tx.changementStatut.create({ data: { objetType: OBJET_DOCUMENT, objetId: id, de: document.statutDiffusion, vers: StatutDiffusion.BROUILLON, motif: `Nouvelle version (v${version.versionNumber})`, parId: actor.id } });
        }
        return tx.document.update({ where: { id }, data: { currentVersionId: version.id, statutDiffusion: StatutDiffusion.BROUILLON }, select: DOCUMENT_SELECT });
      }),
    );

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Document',
      entityId: id,
      metadata: { event: 'new_version', versionNumber: updated.currentVersion?.versionNumber, ...(document.statutDiffusion !== StatutDiffusion.BROUILLON ? { statutRetire: document.statutDiffusion } : {}) },
    });

    return updated;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateDocumentDto): Promise<DocumentWithVersion> {
    const document = await this.getOrThrow(id);
    await this.assertCanModify(actor, document);
    if (dto.folderId) await this.assertFolderInDivision(dto.folderId, document.divisionId);
    const debut = dto.periodeDebut ?? document.periodeDebut?.toISOString();
    const fin = dto.periodeFin ?? document.periodeFin?.toISOString();
    if (debut && fin) this.assertPeriode(debut, fin);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        folderId: dto.folderId,
        typeDocument: dto.typeDocument,
        dateDocument: dto.dateDocument ? jour(dto.dateDocument) : undefined,
        periodeDebut: dto.periodeDebut ? jour(dto.periodeDebut) : undefined,
        periodeFin: dto.periodeFin ? jour(dto.periodeFin) : undefined,
      },
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

    if (!this.peutPublier(actor, document)) {
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

  /** Téléchargement d'une version : la copie remise porte la mention du statut (service d'export unique). */
  async downloadVersion(actor: AuthenticatedUser, documentId: string, versionId: string) {
    const document = await this.getOrThrow(documentId);
    this.assertVisible(actor, document);

    const version = await this.prisma.documentVersion.findUnique({ where: { id: versionId } });
    if (!version || version.documentId !== documentId) throw new NotFoundException('Version introuvable pour ce document');

    const chunks: Buffer[] = [];
    for await (const c of this.storage.createReadStream(version.fileKey)) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    const fichier = await this.exports.marquer({ buffer: Buffer.concat(chunks), fileName: version.fileName, mimeType: version.mimeType }, document.statutDiffusion);
    return { ...fichier, statut: document.statutDiffusion };
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

  private metadonneesCompletes(d: Pick<DocumentWithVersion, 'periodeDebut' | 'periodeFin'>): boolean {
    return !!d.periodeDebut && !!d.periodeFin;
  }

  /** Responsable métier (§7.1) : chef de la division productrice, DN, DNA. */
  private estValidateur(actor: AuthenticatedUser, d: Pick<DocumentWithVersion, 'divisionId'>): boolean {
    return PUBLISHER_TOP_ROLES.includes(actor.role) || (actor.role === SystemRole.CHEF_DIVISION && actor.divisionId === d.divisionId);
  }

  private peutPublier(actor: AuthenticatedUser, d: Pick<DocumentWithVersion, 'divisionId'>): boolean {
    return this.estValidateur(actor, d);
  }

  private assertPeriode(debut: string, fin: string): void {
    if (jour(fin) < jour(debut)) throw new BadRequestException('La fin de la période couverte précède son début.');
  }

  private async peutModifier(actor: AuthenticatedUser, document: DocumentWithVersion): Promise<boolean> {
    return this.assertCanModify(actor, document).then(() => true, () => false);
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

  /** Tâche d'origine : visible du déposant (on ne lie pas un document à une tâche qu'on ne voit pas). */
  private async assertTaskExists(actor: AuthenticatedUser, taskId: string): Promise<void> {
    await this.tasks.findOneVisibleTo(actor, taskId);
  }
}
