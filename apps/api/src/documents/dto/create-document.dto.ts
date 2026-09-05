import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

/** Champs texte du formulaire multipart — le fichier est géré séparément par
 * FileInterceptor (voir DocumentsController.create). */
export class CreateDocumentDto {
  @IsString()
  @Length(2, 300)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsString()
  divisionId!: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  sourceTaskId?: string;
}
