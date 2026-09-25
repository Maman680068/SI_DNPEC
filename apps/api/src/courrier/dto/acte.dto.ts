import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ActeStatut, CourrierConfidentialite } from '@prisma/client';

const CONFIDENTIALITES_ACTE = [CourrierConfidentialite.ORDINAIRE, CourrierConfidentialite.CONFIDENTIEL];

export class CreateActeDto {
  @IsString()
  registreId!: string;

  @IsString()
  @Length(2, 500)
  objet!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  destinataires?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20000)
  corps?: string;

  @IsIn(CONFIDENTIALITES_ACTE, { message: 'Un acte est ORDINAIRE ou CONFIDENTIEL.' })
  confidentialite!: CourrierConfidentialite;

  /** Agent concerné (attestation, ordre de mission...) — voit l'acte signé. */
  @IsOptional()
  @IsString()
  beneficiaireId?: string;

  @IsOptional()
  @IsBoolean()
  priseConnaissanceRequise?: boolean;

  /** Courrier arrivée auquel ce départ répond. */
  @IsOptional()
  @IsString()
  repondAId?: string;
}

export class UpdateActeDto {
  @IsOptional()
  @IsString()
  registreId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  objet?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  destinataires?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20000)
  corps?: string;

  @IsOptional()
  @IsIn(CONFIDENTIALITES_ACTE, { message: 'Un acte est ORDINAIRE ou CONFIDENTIEL.' })
  confidentialite?: CourrierConfidentialite;

  @IsOptional()
  @IsString()
  beneficiaireId?: string;

  @IsOptional()
  @IsBoolean()
  priseConnaissanceRequise?: boolean;

  @IsOptional()
  @IsString()
  repondAId?: string;
}

export class ViserDto {
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  commentaire?: string;
}

export class ExpedierDto {
  @IsString()
  @Length(2, 200)
  modeExpedition!: string;
}

export class ActeFiltresDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee?: number;

  @IsOptional()
  @IsString()
  registreId?: string;

  @IsOptional()
  @IsEnum(ActeStatut)
  statut?: ActeStatut;

  @IsOptional()
  @IsString()
  q?: string;
}
