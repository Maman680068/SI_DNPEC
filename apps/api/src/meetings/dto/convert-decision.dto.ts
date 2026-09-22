import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

/** "Convertir en action" (D2) : responsable et échéance obligatoires — c'est
 * la raison d'être de la conversion, une action sans l'un des deux n'a pas
 * de sens. `title` optionnel : reprend le texte de la décision si omis. */
export class ConvertDecisionDto {
  @IsOptional()
  @IsString()
  @Length(2, 300)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  assigneeId!: string;

  @IsDateString()
  dueDate!: string;
}
