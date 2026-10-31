import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { NATURES_JOUR_FERIE } from '../jours-feries.service';

export class JourFerieDto {
  @IsDateString()
  date!: string;

  @IsString()
  @Length(2, 120)
  libelle!: string;

  @IsIn(NATURES_JOUR_FERIE as unknown as string[])
  nature!: string;
}

export class ModifierJourFerieDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  libelle?: string;

  @IsOptional()
  @IsIn(NATURES_JOUR_FERIE as unknown as string[])
  nature?: string;
}

export class AnneeDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee!: number;
}

/** « Vérifier et ajouter » : fêtes cochées, dates vérifiées. */
export class LotJoursFeriesDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => JourFerieDto)
  jours!: JourFerieDto[];
}
