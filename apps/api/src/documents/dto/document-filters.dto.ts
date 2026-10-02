import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentCategory, DocumentVisibility, StatutDiffusion, TypeDocument } from '@prisma/client';

/** Filtres de GET /documents (RF-GED-05 : division, date, type). Combinés en ET avec
 * le périmètre de visibilité de l'acteur. */
export class DocumentFiltersDto {
  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsString()
  celluleId?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsEnum(DocumentVisibility)
  visibility?: DocumentVisibility;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  q?: string;

  // Socle N4 — type, statut de diffusion, objet d'origine.
  @IsOptional()
  @IsEnum(TypeDocument)
  typeDocument?: TypeDocument;

  @IsOptional()
  @IsEnum(StatutDiffusion)
  statutDiffusion?: StatutDiffusion;

  @IsOptional()
  @IsString()
  sourceTaskId?: string;

  @IsOptional()
  @IsString()
  sourceMeetingId?: string;
}
