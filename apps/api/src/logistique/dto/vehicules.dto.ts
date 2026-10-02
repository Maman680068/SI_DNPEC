import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { EtatBien } from '@prisma/client';

export const ENERGIES = ['ESSENCE', 'GAZOLE'] as const;

export class VehiculeDto {
  @IsString()
  @Matches(/^[A-Z0-9 -]{4,15}$/, { message: 'Immatriculation : 4 à 15 caractères (lettres majuscules, chiffres, tirets, espaces).' })
  immatriculation!: string;

  @IsString()
  @Length(2, 60)
  marque!: string;

  @IsString()
  @Length(1, 60)
  modele!: string;

  @IsIn(ENERGIES)
  energie!: (typeof ENERGIES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kilometrage!: number;
}

export class ModifierVehiculeDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  marque?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  modele?: string;

  @IsOptional()
  @IsIn(ENERGIES)
  energie?: (typeof ENERGIES)[number];

  @IsOptional()
  @IsEnum(EtatBien)
  etat?: EtatBien;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class PleinDto {
  @IsDateString({}, { message: 'Date du plein invalide.' })
  date!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(500)
  litres!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kilometrage!: number;

  @IsOptional()
  @IsString()
  ordreMissionId?: string;
}

export class AffecterVehiculeDto {
  @IsOptional()
  @IsString()
  vehiculeId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kilometrageDepart?: number;
}

export class RetourMissionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kilometrageRetour!: number;
}
