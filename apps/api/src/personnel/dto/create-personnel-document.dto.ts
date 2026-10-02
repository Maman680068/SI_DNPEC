import { IsOptional, IsString, Length } from 'class-validator';

export class CreatePersonnelDocumentDto {
  @IsString()
  @Length(1, 150)
  label!: string;

  /** Socle N6 : pièce de la liste des pièces requises que ce document fournit. */
  @IsOptional()
  @IsString()
  pieceRequiseId?: string;
}
