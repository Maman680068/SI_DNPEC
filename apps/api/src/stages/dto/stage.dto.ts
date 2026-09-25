import { EvaluationFormat } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

export class CreerStageDto {
  @IsString()
  stagiaireId!: string;

  @IsString()
  @Length(2, 200)
  etablissement!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  diplomePrepare?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  encadrantAcademique?: string;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;
}

export class ModifierStageDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  etablissement?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  diplomePrepare?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  encadrantAcademique?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;
}

export class PeriodeDto {
  @IsOptional()
  @IsString()
  divisionId?: string | null;

  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  celluleId?: string | null;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsEnum(EvaluationFormat)
  formatEvaluation!: EvaluationFormat;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  objectifs?: string;
}

/** Modification d'une période : champs facultatifs ; une période commencée
 * n'accepte que dateFin, avec un motif. */
export class ModifierPeriodeDto {
  @IsOptional()
  @IsString()
  divisionId?: string | null;

  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  celluleId?: string | null;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsEnum(EvaluationFormat)
  formatEvaluation?: EvaluationFormat;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  objectifs?: string;

  @IsOptional()
  @IsString()
  @Length(5, 1000)
  motif?: string;
}

export class AccepterPeriodeDto {
  @IsString()
  tuteurId!: string;
}

export class MotifDto {
  @IsString()
  @Length(5, 1000)
  motif!: string;
}

export class FormatEvaluationDto {
  @IsEnum(EvaluationFormat)
  formatEvaluation!: EvaluationFormat;
}

export class EvaluationDto {
  @IsOptional()
  @IsObject()
  criteres?: Record<string, string>;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  appreciation?: string;
}

export class CapaciteDto {
  @Matches(/^(DIV|SEC|CEL):[A-Za-z0-9_-]+$/, { message: 'Unité invalide (DIV:, SEC: ou CEL: suivi de son identifiant).' })
  uniteKey!: string;

  /** null : retirer la limite. */
  @ValidateIf((o) => o.maximum !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  maximum!: number | null;
}
