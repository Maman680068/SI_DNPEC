import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { DocumentCategory, TypeDocument } from '@prisma/client';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @Length(2, 300)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsString()
  folderId?: string;

  // Socle N4 — métadonnées (compléter celles des documents d'avant N4).
  @IsOptional()
  @IsEnum(TypeDocument)
  typeDocument?: TypeDocument;

  @IsOptional()
  @IsDateString()
  dateDocument?: string;

  @IsOptional()
  @IsDateString()
  periodeDebut?: string;

  @IsOptional()
  @IsDateString()
  periodeFin?: string;
}
