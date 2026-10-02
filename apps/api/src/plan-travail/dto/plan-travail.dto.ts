import { IsDateString, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ObjectifDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  annee!: number;

  @IsString()
  uniteId!: string;

  @IsString()
  @Length(3, 300)
  libelle!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}

export class ModifierObjectifDto {
  @IsOptional()
  @IsString()
  @Length(3, 300)
  libelle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}

export class ActiviteDto {
  @IsString()
  @Length(3, 300)
  libelle!: string;

  @IsString()
  responsableId!: string;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsString()
  @Length(3, 300)
  indicateur!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  cible?: string;
}

export class ModifierActiviteDto {
  @IsOptional()
  @IsString()
  @Length(3, 300)
  libelle?: string;

  @IsOptional()
  @IsString()
  responsableId?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsString()
  @Length(3, 300)
  indicateur?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  cible?: string;
}

export class PlanFiltresDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  annee?: number;

  @IsOptional()
  @IsString()
  uniteId?: string;
}
