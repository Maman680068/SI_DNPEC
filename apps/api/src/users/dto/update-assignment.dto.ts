import { IsOptional, IsString } from 'class-validator';

/** Chaque champ omis reste inchangé ; passer `null` explicitement l'efface. */
export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  divisionId?: string | null;

  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  celluleId?: string | null;
}
