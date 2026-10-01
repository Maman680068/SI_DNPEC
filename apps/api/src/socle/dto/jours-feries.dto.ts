import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
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
