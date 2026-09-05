import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentCategory, DocumentVisibility } from '@prisma/client';

/** Filtres de GET /documents (RF-GED-05 : division, date, type). Combinés en ET avec
 * le périmètre de visibilité de l'acteur. */
export class DocumentFiltersDto {
  @IsOptional()
  @IsString()
  divisionId?: string;

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
}
