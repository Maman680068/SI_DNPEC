import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { DocumentCategory, TypeDocument } from '@prisma/client';

/** Champs texte du formulaire multipart — le fichier est géré séparément par
 * FileInterceptor (voir DocumentsController.create). Socle N4 : type, date et période
 * couverte obligatoires (§8, SIG-RF-GED-07) ; lien facultatif vers la tâche ou la réunion
 * d'origine (SIG-RF-GED-08). */
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

  @IsEnum(TypeDocument, { message: 'Le type du document est obligatoire.' })
  typeDocument!: TypeDocument;

  @IsOptional()
  @IsDateString({}, { message: 'Date du document invalide.' })
  dateDocument?: string;

  @IsDateString({}, { message: 'Le début de la période couverte est obligatoire.' })
  periodeDebut!: string;

  @IsDateString({}, { message: 'La fin de la période couverte est obligatoire.' })
  periodeFin!: string;

  @IsString()
  divisionId!: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  sourceTaskId?: string;

  @IsOptional()
  @IsString()
  sourceMeetingId?: string;
}
