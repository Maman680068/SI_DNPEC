import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { EmploymentStatus } from '@prisma/client';

/** Chaque champ omis reste inchangé — seuls les champs présents sont réécrits
 * (et donc repassés "à vérifier", voir PersonnelFilesService.updateBasic). */
export class UpdatePersonnelBasicDto {
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  grade?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  echelon?: string;

  @IsOptional()
  @IsDateString()
  serviceStartDate?: string;

  // Socle N6 : catégorie (effectifs) et date du dernier échelon (avancement à instruire).
  @IsOptional()
  @IsString()
  @Length(1, 20)
  categorie?: string;

  @IsOptional()
  @IsDateString()
  echelonDepuis?: string;
}
