import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  NotificationType,
  PersonnelFileBasic,
  PersonnelFileSensitive,
  Prisma,
  SystemRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PersonnelHistoryService } from './personnel-history.service';
import { UpdatePersonnelBasicDto } from './dto/update-personnel-basic.dto';
import { UpdatePersonnelSensitiveDto } from './dto/update-personnel-sensitive.dto';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { CreatePersonnelDocumentDto } from './dto/create-personnel-document.dto';
import { ReportPersonnelErrorDto } from './dto/report-personnel-error.dto';
import { BASIC_FIELD_KEYS, SENSITIVE_FIELD_KEYS, markAllFieldsVerified, markFieldsUnverified } from './personnel-field-status.util';

type OrgTarget = { id: string; divisionId: string | null; sectionId: string | null; celluleId: string | null };

const BASIC_DEFAULTS = {
  employmentStatus: null,
  grade: null,
  echelon: null,
  serviceStartDate: null,
  jobDescriptionFileKey: null,
  jobDescriptionFileName: null,
  verifiedFields: {} as Prisma.JsonValue,
};

const SENSITIVE_DEFAULTS = {
  personalAddress: null,
  personalPhone: null,
  personalEmail: null,
  emergencyContactName: null,
  emergencyContactRelation: null,
  emergencyContactPhone: null,
  verifiedFields: {} as Prisma.JsonValue,
};

/**
 * Dossier du personnel (module personnel/) — voir schema.prisma pour la
 * séparation niveau 1 (PersonnelFileBasic) / niveau 2 (PersonnelFileSensitive
 * + PersonnelDiploma + PersonnelDocument + PersonnelCareerEvent), et l'audit
 * mené avant construction pour le détail du principe "besoin d'en connaître"
 * appliqué ici.
 *
 * Contrôle d'accès fait ici, pas par un Guard (comme Congés/GED) : dépend de
 * la ressource ciblée (userId de la route), jamais du rôle seul.
 * - Niveau 1 (lecture) : soi-même, DRH, ou cascade.hasDirectAuthorityOver
 *   (DN/DNA sur toute la DNPEC, Chef de Division/Section/Cellule sur son
 *   périmètre — réutilisé tel quel, la lecture "chef sur son périmètre"
 *   est structurellement identique à l'autorité de validation ailleurs).
 * - Niveau 2 (lecture/écriture) et niveau 1 (écriture) : soi-même ou DRH
 *   UNIQUEMENT — jamais la cascade, y compris pour DN/DNA.
 */
@Injectable()
export class PersonnelFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly history: PersonnelHistoryService,
  ) {}

  async getFile(actor: AuthenticatedUser, userId: string) {
    const target = await this.getTargetOrThrow(userId);
    const isSelf = actor.id === userId;
    const isDrh = actor.role === SystemRole.DRH;

    if (!isSelf && !isDrh && !this.cascade.hasDirectAuthorityOver(actor, target)) {
      throw new ForbiddenException('Ce dossier est hors de votre périmètre.');
    }

    const basicRow = await this.prisma.personnelFileBasic.findUnique({ where: { userId } });
    const basic = this.toBasicView(basicRow);

    if (!isSelf && !isDrh) {
      // Niveau 1 seul : le niveau 2 n'est même pas interrogé, pas juste masqué.
      return { userId, basic, sensitive: null, diplomas: [], documents: [], careerHistory: [] };
    }

    const [sensitiveRow, diplomas, documents, careerHistory] = await Promise.all([
      this.prisma.personnelFileSensitive.findUnique({ where: { userId } }),
      this.prisma.personnelDiploma.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.personnelDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.personnelCareerEvent.findMany({ where: { userId }, orderBy: { effectiveDate: 'desc' } }),
    ]);

    return { userId, basic, sensitive: this.toSensitiveView(sensitiveRow), diplomas, documents, careerHistory };
  }

  async updateBasic(actor: AuthenticatedUser, userId: string, dto: UpdatePersonnelBasicDto) {
    const target = await this.getTargetOrThrow(userId);
    this.assertCanWrite(actor, userId);

    const current = await this.prisma.personnelFileBasic.findUnique({ where: { userId } });
    const changedKeys = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
    const verifiedFields = markFieldsUnverified(current?.verifiedFields, changedKeys);
    const source = actor.id === userId ? 'SELF' : 'DRH';

    const data = {
      ...(dto.employmentStatus !== undefined ? { employmentStatus: dto.employmentStatus } : {}),
      ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
      ...(dto.echelon !== undefined ? { echelon: dto.echelon } : {}),
      ...(dto.serviceStartDate !== undefined ? { serviceStartDate: new Date(dto.serviceStartDate) } : {}),
      verifiedFields,
      source,
    };

    const updated = await this.prisma.personnelFileBasic.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    // Historique de carrière (RF niveau 2, voir PersonnelHistoryService) — un
    // changement de grade ou d'échelon est une PROMOTION, quelle que soit sa
    // direction (une régression reste un événement à tracer).
    if (dto.grade !== undefined && dto.grade !== current?.grade) {
      await this.history.recordPromotion(userId, actor.id, current?.grade ?? null, dto.grade);
    }
    if (dto.echelon !== undefined && dto.echelon !== current?.echelon) {
      await this.history.recordPromotion(userId, actor.id, current?.echelon ?? null, dto.echelon);
    }

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'PersonnelFileBasic',
      entityId: target.id,
      metadata: { fields: changedKeys },
    });

    return this.toBasicView(updated);
  }

  async setJobDescription(actor: AuthenticatedUser, userId: string, file: Express.Multer.File) {
    await this.getTargetOrThrow(userId);
    this.assertCanWrite(actor, userId);

    const current = await this.prisma.personnelFileBasic.findUnique({ where: { userId } });
    if (current?.jobDescriptionFileKey) await this.storage.delete(current.jobDescriptionFileKey);

    const { fileKey } = await this.storage.save(file.buffer, file.originalname);
    const verifiedFields = markFieldsUnverified(current?.verifiedFields, ['jobDescription']);
    const source = actor.id === userId ? 'SELF' : 'DRH';

    const updated = await this.prisma.personnelFileBasic.upsert({
      where: { userId },
      create: { userId, jobDescriptionFileKey: fileKey, jobDescriptionFileName: file.originalname, verifiedFields, source },
      update: { jobDescriptionFileKey: fileKey, jobDescriptionFileName: file.originalname, verifiedFields, source },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'PersonnelFileBasic',
      entityId: userId,
      metadata: { fields: ['jobDescription'] },
    });

    return this.toBasicView(updated);
  }

  async updateSensitive(actor: AuthenticatedUser, userId: string, dto: UpdatePersonnelSensitiveDto) {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);

    const current = await this.prisma.personnelFileSensitive.findUnique({ where: { userId } });
    const changedKeys = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
    const verifiedFields = markFieldsUnverified(current?.verifiedFields, changedKeys);
    const source = actor.id === userId ? 'SELF' : 'DRH';

    const data = { ...dto, verifiedFields, source };

    const updated = await this.prisma.personnelFileSensitive.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'PersonnelFileSensitive',
      entityId: userId,
      metadata: { fields: changedKeys },
    });

    return this.toSensitiveView(updated);
  }

  async addDiploma(actor: AuthenticatedUser, userId: string, dto: CreateDiplomaDto, file?: Express.Multer.File) {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);

    const saved = file ? await this.storage.save(file.buffer, file.originalname) : null;
    const diploma = await this.prisma.personnelDiploma.create({
      data: {
        userId,
        title: dto.title,
        institution: dto.institution,
        obtainedYear: dto.obtainedYear,
        fileKey: saved?.fileKey,
        fileName: file?.originalname,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'PersonnelDiploma',
      entityId: diploma.id,
      metadata: { title: diploma.title },
    });

    return diploma;
  }

  async removeDiploma(actor: AuthenticatedUser, userId: string, diplomaId: string): Promise<void> {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);

    const diploma = await this.prisma.personnelDiploma.findUnique({ where: { id: diplomaId } });
    if (!diploma || diploma.userId !== userId) throw new NotFoundException('Diplôme introuvable');

    await this.prisma.personnelDiploma.delete({ where: { id: diplomaId } });
    if (diploma.fileKey) await this.storage.delete(diploma.fileKey);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SUPPRESSION,
      entityType: 'PersonnelDiploma',
      entityId: diplomaId,
      metadata: { title: diploma.title },
    });
  }

  async addDocument(actor: AuthenticatedUser, userId: string, dto: CreatePersonnelDocumentDto, file: Express.Multer.File) {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);

    const { fileKey } = await this.storage.save(file.buffer, file.originalname);
    const document = await this.prisma.personnelDocument.create({
      data: { userId, label: dto.label, fileKey, fileName: file.originalname, uploadedById: actor.id },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'PersonnelDocument',
      entityId: document.id,
      metadata: { label: document.label },
    });

    return document;
  }

  async removeDocument(actor: AuthenticatedUser, userId: string, documentId: string): Promise<void> {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);

    const document = await this.prisma.personnelDocument.findUnique({ where: { id: documentId } });
    if (!document || document.userId !== userId) throw new NotFoundException('Pièce administrative introuvable');

    await this.prisma.personnelDocument.delete({ where: { id: documentId } });
    await this.storage.delete(document.fileKey);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SUPPRESSION,
      entityType: 'PersonnelDocument',
      entityId: documentId,
      metadata: { label: document.label },
    });
  }

  async downloadDocument(actor: AuthenticatedUser, userId: string, documentId: string) {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);

    const document = await this.prisma.personnelDocument.findUnique({ where: { id: documentId } });
    if (!document || document.userId !== userId) throw new NotFoundException('Pièce administrative introuvable');

    return { document, stream: this.storage.createReadStream(document.fileKey) };
  }

  async getCareerHistory(actor: AuthenticatedUser, userId: string) {
    await this.getTargetOrThrow(userId);
    this.assertCanAccessSensitive(actor, userId);
    return this.prisma.personnelCareerEvent.findMany({ where: { userId }, orderBy: { effectiveDate: 'desc' } });
  }

  /** "Confirmer mes informations" — action réservée à la personne concernée, jamais
   * au DRH à sa place : c'est elle qui atteste que les données sont exactes. */
  async confirmMyInformation(actor: AuthenticatedUser, userId: string): Promise<void> {
    if (actor.id !== userId) {
      throw new ForbiddenException('Seule la personne concernée peut confirmer ses propres informations.');
    }

    const [basic, sensitive] = await Promise.all([
      this.prisma.personnelFileBasic.findUnique({ where: { userId } }),
      this.prisma.personnelFileSensitive.findUnique({ where: { userId } }),
    ]);

    await this.prisma.$transaction([
      ...(basic
        ? [
            this.prisma.personnelFileBasic.update({
              where: { userId },
              data: { verifiedFields: markAllFieldsVerified(BASIC_FIELD_KEYS) },
            }),
          ]
        : []),
      ...(sensitive
        ? [
            this.prisma.personnelFileSensitive.update({
              where: { userId },
              data: { verifiedFields: markAllFieldsVerified(SENSITIVE_FIELD_KEYS) },
            }),
          ]
        : []),
      this.prisma.personnelDiploma.updateMany({ where: { userId }, data: { verified: true } }),
      this.prisma.personnelDocument.updateMany({ where: { userId }, data: { verified: true } }),
    ]);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.VALIDATION,
      entityType: 'PersonnelFile',
      entityId: userId,
      metadata: { event: 'confirmed_by_owner' },
    });
  }

  /** "Signaler une erreur" — notifie tous les DRH actifs avec le champ en cause. */
  async reportError(actor: AuthenticatedUser, userId: string, dto: ReportPersonnelErrorDto): Promise<void> {
    if (actor.id !== userId) {
      throw new ForbiddenException('Vous ne pouvez signaler une erreur que sur votre propre dossier.');
    }

    const drhUsers = await this.prisma.user.findMany({
      where: { role: SystemRole.DRH, status: UserStatus.ACTIF },
      select: { id: true },
    });

    await Promise.all(
      drhUsers.map((drh) =>
        this.notifications.notify(
          drh.id,
          NotificationType.DOSSIER_ERREUR_SIGNALEE,
          'Erreur signalée sur un dossier',
          `Champ « ${dto.fieldLabel} » — ${dto.comment}`,
          `/personnel/${userId}`,
        ),
      ),
    );

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'PersonnelFileErrorReport',
      entityId: userId,
      metadata: { fieldLabel: dto.fieldLabel, comment: dto.comment },
    });
  }

  // --------------------------------------------------------------------

  private assertCanWrite(actor: AuthenticatedUser, userId: string): void {
    if (actor.id === userId) return;
    if (actor.role === SystemRole.DRH) return;
    throw new ForbiddenException('Seuls le DRH et la personne concernée peuvent modifier ce dossier.');
  }

  /** Même règle que assertCanWrite pour l'instant (self ou DRH), mais gardée
   * distincte : le niveau 2 n'admet aucune extension future à la cascade,
   * contrairement au niveau 1 où l'écriture pourrait un jour s'ouvrir à
   * d'autres rôles sans toucher au niveau 2. */
  private assertCanAccessSensitive(actor: AuthenticatedUser, userId: string): void {
    if (actor.id === userId) return;
    if (actor.role === SystemRole.DRH) return;
    throw new ForbiddenException('Ce contenu est réservé à la personne concernée et au DRH.');
  }

  private async getTargetOrThrow(userId: string): Promise<OrgTarget> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    return target;
  }

  private toBasicView(row: PersonnelFileBasic | null) {
    return row ?? { ...BASIC_DEFAULTS };
  }

  private toSensitiveView(row: PersonnelFileSensitive | null) {
    return row ?? { ...SENSITIVE_DEFAULTS };
  }
}
