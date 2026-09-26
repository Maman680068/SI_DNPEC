import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectRegistrationDto {
  /** Motif facultatif, repris dans l'email à la personne seulement s'il est saisi. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  motif?: string;
}
