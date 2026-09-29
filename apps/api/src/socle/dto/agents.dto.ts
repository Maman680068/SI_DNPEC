import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const NATURES_FIN = ['STAGE', 'CONTRAT'] as const;
const MATRICULE = /^[A-Za-z0-9][A-Za-z0-9./-]{1,29}$/;

export class ListerAgentsDto {
  @IsOptional() @IsIn(['EN_ACTIVITE', 'SUSPENDU', 'PARTI']) statut?: string;
  @IsOptional() @IsString() uniteId?: string;
  @IsOptional() @IsString() @MaxLength(100) recherche?: string;
  @IsOptional() @IsIn(['true']) matriculeProvisoire?: string;
  @IsOptional() @IsIn(['true']) finProche?: string;
  @IsOptional() @IsIn(['true']) sansCompte?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) taille?: number;
}

export class CreerAgentDto {
  @IsOptional() @IsString() @Matches(MATRICULE, { message: 'Matricule invalide.' }) matricule?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) nom!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) prenoms!: string;
  @IsOptional() @IsIn(['F', 'M']) genre?: string;
  @IsString() @IsNotEmpty() uniteId!: string;
  @IsOptional() @IsString() @MaxLength(150) fonction?: string;
  @IsOptional() @IsDateString() dateFinPrevue?: string;
  @IsOptional() @IsIn(NATURES_FIN) natureFinPrevue?: string;
}

export class ModifierAgentDto {
  @IsOptional() @IsString() @Matches(MATRICULE, { message: 'Matricule invalide.' }) matricule?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) nom?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) prenoms?: string;
  @IsOptional() @IsIn(['F', 'M']) genre?: string;
  @IsOptional() @IsString() @MaxLength(150) fonction?: string;
  /** Fin de contrat (la fin d'un stage suit le module Stages, ou se prolonge ici). */
  @IsOptional() @IsDateString() dateFinPrevue?: string;
  @IsOptional() @IsIn(NATURES_FIN) natureFinPrevue?: string;
}

export class MotifDto {
  @IsString() @IsNotEmpty({ message: 'Le motif est obligatoire.' }) @MaxLength(500) motif!: string;
}

export class DepartDto extends MotifDto {
  @IsDateString() dateDepart!: string;
}

export class ReactiverDto extends MotifDto {
  /** Obligatoire si la fin prévue est déjà passée (sinon l'agent repartirait aussitôt). */
  @IsOptional() @IsDateString() nouvelleDateFin?: string;
}

export class ProlongerDto extends MotifDto {
  @IsDateString() nouvelleDateFin!: string;
}
