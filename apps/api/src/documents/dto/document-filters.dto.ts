import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
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

  // Période couverte (refonte de l'interface) : documents dont la période couverte chevauche [couvreDu, couvreAu].
  @IsOptional()
  @IsDateString()
  couvreDu?: string;

  @IsOptional()
  @IsDateString()
  couvreAu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
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
