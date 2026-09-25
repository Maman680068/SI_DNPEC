import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ArriveeStatut, CourrierConfidentialite, ImputationNature } from '@prisma/client';

export class CreateArriveeDto {
  @IsString()
  registreId!: string;

  /** Obligatoire pour un registre de portée Unité ("DIV:<id>" / "CEL:<id>"). */
  @IsOptional()
  @IsString()
  uniteKey?: string;

  @IsDateString()
  dateReception!: string;

  @IsString()
  @Length(2, 300)
  expediteur!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  referenceExpediteur?: string;

  @IsOptional()
  @IsDateString()
  dateCourrier?: string;

  /** Obligatoire sauf pour un pli PERSONNEL, où il est interdit. */
  @IsOptional()
  @IsString()
  @Length(2, 500)
  objet?: string;

  @IsEnum(CourrierConfidentialite)
  confidentialite!: CourrierConfidentialite;

  /** Dérogation au contrôle des dates (réception future, courrier daté après
   * sa réception) : confirmation explicite + motif obligatoire. Accepte
   * "true"/"false" (formulaire multipart). */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  derogationDate?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  motifDerogation?: string;

  /** Destinataire nominatif — obligatoire pour un pli PERSONNEL. */
  @IsOptional()
  @IsString()
  destinataireId?: string;
}

/** Correction de métadonnées (auditée avant/après) — jamais la numérotation. */
export class UpdateArriveeDto {
  @IsOptional()
  @IsDateString()
  dateReception?: string;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  expediteur?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  referenceExpediteur?: string;

  @IsOptional()
  @IsDateString()
  dateCourrier?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  objet?: string;

  /** Dérogation au contrôle des dates (réception future, courrier daté après
   * sa réception) : confirmation explicite + motif obligatoire. Accepte
   * "true"/"false" (formulaire multipart). */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  derogationDate?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  motifDerogation?: string;
}

export class MotifDto {
  @IsString()
  @Length(5, 1000, { message: 'Un motif d’au moins 5 caractères est obligatoire.' })
  motif!: string;
}

export class CompleterPliDto {
  @IsString()
  @Length(2, 500)
  objet!: string;
}

export class RequalifierPliDto {
  @IsIn([CourrierConfidentialite.ORDINAIRE, CourrierConfidentialite.CONFIDENTIEL], {
    message: 'Un pli personnel ne peut être requalifié qu’en ORDINAIRE ou CONFIDENTIEL.',
  })
  confidentialite!: CourrierConfidentialite;
}

export class ImputerDto {
  @IsString()
  imputeAId!: string;

  @IsEnum(ImputationNature)
  nature!: ImputationNature;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  echeance?: string;
}

export class TraiterImputationDto {
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  compteRendu?: string;

  @IsOptional()
  @IsString()
  reponseActeId?: string;
}

export class ConvertirImputationDto {
  @IsOptional()
  @IsString()
  @Length(2, 300)
  titre?: string;

  /** Par défaut : l'échéance de l'imputation (obligatoire si elle n'en a pas). */
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class OuvrirAccesDto {
  @IsString()
  beneficiaireId!: string;
}

export class ArriveeFiltresDto {
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
  @IsEnum(ArriveeStatut)
  statut?: ArriveeStatut;

  @IsOptional()
  @IsString()
  q?: string;
}
