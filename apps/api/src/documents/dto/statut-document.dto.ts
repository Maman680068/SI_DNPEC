import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { StatutDiffusion } from '@prisma/client';

/** Changement de statut de diffusion (§7.1) ; motif obligatoire pour un retrait (contrôlé par le service). */
export class StatutDocumentDto {
  @IsEnum(StatutDiffusion)
  vers!: StatutDiffusion;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  motif?: string;
}
