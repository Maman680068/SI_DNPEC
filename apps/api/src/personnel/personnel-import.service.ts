import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import { createHash, randomBytes } from 'crypto';
import { AuditAction, SystemRole, UserStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { rattachementPourRole } from '../role-change/roles';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { PasswordService } from '../common/security/password.service';
import { EmailService } from '../communication/notifications/email.service';
import { buildEmailContent } from '../communication/notifications/email-template';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { markFieldsUnverified } from './personnel-field-status.util';

export interface ImportRowResult {
  row: number;
  email: string | null;
  status: 'created' | 'updated' | 'error';
  message: string;
}

export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  errors: number;
  details: ImportRowResult[];
}

/** Colonnes reconnues, par clé interne -> libellés d'en-tête acceptés (comparaison
 * insensible aux accents/casse/espaces, voir normalizeHeader). Une seule feuille,
 * une ligne par agent (voir le modèle présenté avant construction). */
const COLUMN_LABELS: Record<string, string[]> = {
  email: ['EMAIL'],
  firstName: ['PRENOM'],
  lastName: ['NOM'],
  role: ['ROLE'],
  divisionCode: ['DIVISION'],
  sectionCode: ['SECTION'],
  celluleCode: ['CELLULE'],
  employmentStatus: ["STATUT D'EMPLOI", 'STATUT'],
  grade: ['GRADE'],
  echelon: ['ECHELON'],
  serviceStartDate: ['DATE DE PRISE DE SERVICE'],
  personalPhone: ['TELEPHONE PERSONNEL'],
  personalAddress: ['ADRESSE PERSONNELLE'],
  personalEmail: ['EMAIL PERSONNEL'],
  emergencyContactName: ['CONTACT URGENCE NOM'],
  emergencyContactRelation: ['CONTACT URGENCE LIEN'],
  emergencyContactPhone: ['CONTACT URGENCE TELEPHONE'],
};

type ColumnMap = Partial<Record<keyof typeof COLUMN_LABELS, number>>;

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Import Excel du personnel (RF-SEC-01, modalité 3 — jamais construite avant
 * ce module). Une ligne = un agent, traitée indépendamment des autres
 * (aucune erreur de ligne n'annule les lignes valides). Email inconnu ->
 * création de compte (RF-SEC-01) + dossier ; email connu -> mise à jour du
 * dossier uniquement, jamais du rôle ni du rattachement d'un compte existant.
 * Direct (pas d'aperçu séparé pour cette v1) avec rapport détaillé par ligne.
 */
@Injectable()
export class PersonnelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordService: PasswordService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async importFromWorkbook(actor: AuthenticatedUser, buffer: Buffer): Promise<ImportReport> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs embarque son propre @types/node (v14, Buffer non générique),
      // incompatible en structure avec celui du monorepo — écart de typage
      // sans impact runtime (c'est bien un Buffer). eslint-disable ciblé plutôt
      // qu'un changement de dépendance pour un simple décalage de version de types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Fichier Excel illisible.');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new BadRequestException('Fichier Excel vide ou sans ligne de données.');
    }

    const columns = this.mapColumns(sheet.getRow(1));
    if (!columns.email) {
      throw new BadRequestException('Colonne "Email" introuvable dans la première ligne.');
    }

    const details: ImportRowResult[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (this.isRowEmpty(row)) continue;
      details.push(await this.importRow(actor, row, columns, rowNumber));
    }

    const created = details.filter((d) => d.status === 'created').length;
    const updated = details.filter((d) => d.status === 'updated').length;
    const errors = details.filter((d) => d.status === 'error').length;

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'PersonnelImport',
      entityId: `batch-${Date.now()}`,
      metadata: { total: details.length, created, updated, errors },
    });

    return { total: details.length, created, updated, errors, details };
  }

  private async importRow(
    actor: AuthenticatedUser,
    row: ExcelJS.Row,
    columns: ColumnMap,
    rowNumber: number,
  ): Promise<ImportRowResult> {
    const email = this.cellString(row, columns.email)?.toLowerCase();
    if (!email) return { row: rowNumber, email: null, status: 'error', message: 'Email manquant' };

    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      let userId: string;
      let status: 'created' | 'updated';

      if (existing) {
        userId = existing.id;
        status = 'updated';
      } else {
        const created = await this.createAccountFromRow(actor, row, columns, email);
        userId = created.id;
        status = 'created';
      }

      await this.upsertPersonnelData(userId, row, columns);
      return {
        row: rowNumber,
        email,
        status,
        message: status === 'created' ? 'Compte créé, dossier renseigné.' : 'Dossier mis à jour.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return { row: rowNumber, email, status: 'error', message };
    }
  }

  private async createAccountFromRow(
    actor: AuthenticatedUser,
    row: ExcelJS.Row,
    columns: ColumnMap,
    email: string,
  ) {
    const firstName = this.cellString(row, columns.firstName);
    const lastName = this.cellString(row, columns.lastName);
    if (!firstName || !lastName) {
      throw new Error('Prénom et nom sont requis pour créer un nouveau compte.');
    }
    // L'import ne crée que des comptes de Chargé d'Études : tout autre rôle
    // (chefs, DN/DNA, DRH, administrateur, assistant) s'attribue ensuite par
    // l'administrateur système via le changement de rôle — motif obligatoire,
    // unicité des chefs, audit et notifications (Lot E). Colonne « Rôle »
    // vide : Chargé d'Études.
    const roleRaw = this.cellString(row, columns.role);
    const roleNormalise = roleRaw ? normalizeHeader(roleRaw) : 'AGENT';
    if (roleNormalise !== 'AGENT' && roleNormalise !== 'CHARGE D ETUDES') {
      throw new Error(
        `Rôle « ${roleRaw} » : l'import ne crée que des comptes de Chargé d'Études. ` +
          "Créez la ligne en Chargé d'Études, puis demandez à l'administrateur système le changement de rôle.",
      );
    }
    const role = SystemRole.AGENT;

    const divisionCode = this.cellString(row, columns.divisionCode)?.toUpperCase();
    const sectionCode = this.cellString(row, columns.sectionCode)?.toUpperCase();
    const celluleCode = this.cellString(row, columns.celluleCode)?.toUpperCase();

    let divisionId: string | null = null;
    let sectionId: string | null = null;
    let celluleId: string | null = null;

    if (divisionCode) {
      const division = await this.prisma.division.findUnique({ where: { code: divisionCode } });
      if (!division) throw new Error(`Division introuvable : "${divisionCode}".`);
      divisionId = division.id;
    }
    if (sectionCode) {
      if (!divisionId) throw new Error('Une Section ne peut être renseignée sans Division.');
      const section = await this.prisma.section.findFirst({ where: { code: sectionCode, divisionId } });
      if (!section) throw new Error(`Section introuvable dans cette division : "${sectionCode}".`);
      sectionId = section.id;
    }
    if (celluleCode) {
      const cellule = await this.prisma.cellule.findUnique({ where: { code: celluleCode } });
      if (!cellule) throw new Error(`Cellule introuvable : "${celluleCode}".`);
      celluleId = cellule.id;
    }

    // Mêmes contrôles que la création manuelle d'un compte (UsersService.create).
    const attachment = rattachementPourRole(role, { divisionId, sectionId, celluleId });
    await this.users.assertOrgAttachmentValid(attachment);
    await this.users.assertUnitsActiveForNewAttachment(attachment);
    await this.users.assertNoActiveChiefConflict(role, attachment);

    const passwordHash = await this.passwordService.hash(randomBytes(24).toString('base64url'));
    const user = await this.prisma.user.create({
      data: { email, passwordHash, firstName, lastName, role, status: UserStatus.ACTIF, ...attachment },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role, createdByImport: true },
    });

    await this.sendWelcomeEmail(user);
    return user;
  }

  /** Réutilise PasswordResetToken directement (pas PasswordResetService, module
   * auth/ — importer AuthModule créerait un cycle avec UsersModule -> PersonnelModule).
   * TTL plus long (7 jours) que le "mot de passe oublié" standard (1h) : c'est un
   * premier contact, pas une demande active de l'utilisateur. Si le lien expire,
   * le compte étant déjà ACTIF, "mot de passe oublié" fonctionne normalement. */
  private async sendWelcomeEmail(user: { id: string; email: string; firstName: string }): Promise<void> {
    const plainToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3100');
    const resetUrl = `${webAppUrl}/reset-password?token=${plainToken}`;
    const { html, text } = buildEmailContent({
      recipientFirstName: user.firstName,
      paragraphs: [
        "Un compte a été créé pour vous sur le SI DNPEC, dans le cadre de l'import du dossier du personnel.",
        'Pour choisir votre mot de passe et activer votre compte, cliquez sur le bouton ci-dessous. Ce lien est valable 7 jours.',
      ],
      buttonLabel: 'Activer mon compte',
      buttonUrl: resetUrl,
      afterButtonParagraphs: [
        'Si ce lien a expiré, utilisez « Mot de passe oublié » sur l\'écran de connexion avec votre adresse email.',
      ],
    });
    await this.email.send(user.email, 'Votre compte SI DNPEC', text, html);
  }

  private async upsertPersonnelData(userId: string, row: ExcelJS.Row, columns: ColumnMap): Promise<void> {
    const employmentStatusRaw = this.cellString(row, columns.employmentStatus)?.toUpperCase();
    const grade = this.cellString(row, columns.grade);
    const echelon = this.cellString(row, columns.echelon);
    const serviceStartDateRaw = this.cellDate(row, columns.serviceStartDate);

    const basicChanged: string[] = [];
    const basicData: Record<string, unknown> = {};
    if (employmentStatusRaw) {
      if (!['FONCTIONNAIRE', 'CONTRACTUEL', 'STAGIAIRE', 'MISE_A_DISPOSITION'].includes(employmentStatusRaw)) {
        throw new Error(`Statut d'emploi invalide : "${employmentStatusRaw}".`);
      }
      basicData.employmentStatus = employmentStatusRaw;
      basicChanged.push('employmentStatus');
    }
    if (grade) {
      basicData.grade = grade;
      basicChanged.push('grade');
    }
    if (echelon) {
      basicData.echelon = echelon;
      basicChanged.push('echelon');
    }
    if (serviceStartDateRaw) {
      basicData.serviceStartDate = serviceStartDateRaw;
      basicChanged.push('serviceStartDate');
    }

    if (basicChanged.length > 0) {
      const currentBasic = await this.prisma.personnelFileBasic.findUnique({ where: { userId } });
      const verifiedFields = markFieldsUnverified(currentBasic?.verifiedFields, basicChanged);
      await this.prisma.personnelFileBasic.upsert({
        where: { userId },
        create: { userId, ...basicData, verifiedFields, source: 'IMPORT' },
        update: { ...basicData, verifiedFields, source: 'IMPORT' },
      });
    }

    const personalPhone = this.cellString(row, columns.personalPhone);
    const personalAddress = this.cellString(row, columns.personalAddress);
    const personalEmail = this.cellString(row, columns.personalEmail);
    const emergencyContactName = this.cellString(row, columns.emergencyContactName);
    const emergencyContactRelation = this.cellString(row, columns.emergencyContactRelation);
    const emergencyContactPhone = this.cellString(row, columns.emergencyContactPhone);

    const sensitiveChanged: string[] = [];
    const sensitiveData: Record<string, unknown> = {};
    if (personalPhone) {
      sensitiveData.personalPhone = personalPhone;
      sensitiveChanged.push('personalPhone');
    }
    if (personalAddress) {
      sensitiveData.personalAddress = personalAddress;
      sensitiveChanged.push('personalAddress');
    }
    if (personalEmail) {
      sensitiveData.personalEmail = personalEmail;
      sensitiveChanged.push('personalEmail');
    }
    if (emergencyContactName || emergencyContactRelation || emergencyContactPhone) {
      if (emergencyContactName) sensitiveData.emergencyContactName = emergencyContactName;
      if (emergencyContactRelation) sensitiveData.emergencyContactRelation = emergencyContactRelation;
      if (emergencyContactPhone) sensitiveData.emergencyContactPhone = emergencyContactPhone;
      sensitiveChanged.push('emergencyContact');
    }

    if (sensitiveChanged.length > 0) {
      const currentSensitive = await this.prisma.personnelFileSensitive.findUnique({ where: { userId } });
      const verifiedFields = markFieldsUnverified(currentSensitive?.verifiedFields, sensitiveChanged);
      await this.prisma.personnelFileSensitive.upsert({
        where: { userId },
        create: { userId, ...sensitiveData, verifiedFields, source: 'IMPORT' },
        update: { ...sensitiveData, verifiedFields, source: 'IMPORT' },
      });
    }
  }

  private mapColumns(headerRow: ExcelJS.Row): ColumnMap {
    const columns: ColumnMap = {};
    const normalizedLookup = new Map<string, keyof typeof COLUMN_LABELS>();
    for (const [key, labels] of Object.entries(COLUMN_LABELS)) {
      for (const label of labels) {
        normalizedLookup.set(normalizeHeader(label), key as keyof typeof COLUMN_LABELS);
      }
    }

    headerRow.eachCell((cell, colNumber) => {
      const raw = cell.text?.toString().trim();
      if (!raw) return;
      const match = normalizedLookup.get(normalizeHeader(raw));
      if (match) columns[match] = colNumber;
    });

    return columns;
  }

  private isRowEmpty(row: ExcelJS.Row): boolean {
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, () => {
      hasValue = true;
    });
    return !hasValue;
  }

  private cellString(row: ExcelJS.Row, colNumber: number | undefined): string | undefined {
    if (!colNumber) return undefined;
    const value = row.getCell(colNumber).text?.toString().trim();
    return value ? value : undefined;
  }

  private cellDate(row: ExcelJS.Row, colNumber: number | undefined): Date | undefined {
    if (!colNumber) return undefined;
    const cell = row.getCell(colNumber);
    if (cell.value instanceof Date) return cell.value;
    const text = this.cellString(row, colNumber);
    if (!text) return undefined;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
