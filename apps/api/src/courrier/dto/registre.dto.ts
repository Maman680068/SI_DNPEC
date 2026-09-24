import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { RegistreNature, RegistrePortee } from '@prisma/client';

export class CreateRegistreDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/, { message: 'Le code doit être en majuscules (2 à 20 caractères, ex. ARR, NS, OM).' })
  code!: string;

  @IsString()
  @Length(2, 200)
  libelle!: string;

  @IsEnum(RegistreNature)
  nature!: RegistreNature;

  @IsEnum(RegistrePortee)
  portee!: RegistrePortee;

  @IsString()
  @Length(3, 120)
  gabaritNumero!: string;
}

export class UpdateRegistreDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  libelle?: string;

  @IsOptional()
  @IsString()
  @Length(3, 120)
  gabaritNumero?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(RegistreNature)
  nature?: RegistreNature;

  @IsOptional()
  @IsEnum(RegistrePortee)
  portee?: RegistrePortee;
}

export class CreateHabilitationDto {
  @IsString()
  userId!: string;

  @IsString()
  registreId!: string;

  /** "DNPEC" (implicite pour la portée Direction), "DIV:<id>" ou "CEL:<id>". */
  @IsOptional()
  @IsString()
  uniteKey?: string;
}

export class InitialiserCompteurDto {
  @IsOptional()
  @IsString()
  uniteKey?: string;

  @IsInt()
  @Min(2000)
  annee!: number;

  /** Dernier numéro déjà consommé sur papier (le prochain sera dernier + 1). */
  @IsInt()
  @Min(0)
  dernier!: number;
}
