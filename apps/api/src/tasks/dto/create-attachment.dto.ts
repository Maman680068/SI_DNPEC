import { IsInt, IsString, Min } from 'class-validator';

// Enregistre uniquement les métadonnées d'un fichier déjà déposé dans le
// stockage objet (fileKey) — l'upload binaire lui-même (URL pré-signée
// MinIO/S3) suppose un module de stockage qui n'existe pas encore.
export class CreateAttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  fileKey!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
