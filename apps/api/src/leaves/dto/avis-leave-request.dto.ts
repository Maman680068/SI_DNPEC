import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Avis du chef d'unité (circuit A6.1) : un avis défavorable doit être motivé. */
export class AvisLeaveRequestDto {
  @IsIn(['FAVORABLE', 'DEFAVORABLE'], { message: 'Avis attendu : FAVORABLE ou DEFAVORABLE.' })
  avis!: 'FAVORABLE' | 'DEFAVORABLE';

  @IsOptional() @IsString() @MaxLength(2000) motif?: string;
}
