import { SystemRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class ChangerRoleDto {
  @IsEnum(SystemRole)
  role!: SystemRole;

  /** Rôle vu par l'administrateur (aperçu) : 409 s'il a changé entre-temps. */
  @IsEnum(SystemRole)
  roleAttendu!: SystemRole;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  divisionId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  sectionId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  celluleId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  supervisorId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  jobTitle?: string;

  @IsString()
  @Length(5, 1000, { message: 'Un motif d’au moins 5 caractères est obligatoire.' })
  motif!: string;
}

/** Nommer le chef d'une cellule (écran Utilisateurs / Organisation). */
export class NommerChefCelluleDto {
  @IsString()
  userId!: string;

  @IsString()
  @Length(5, 1000, { message: 'Un motif d’au moins 5 caractères est obligatoire.' })
  motif!: string;
}

/** Retirer le chef d'une cellule : il reste dans la cellule avec le rôle cible. */
export class RetirerChefCelluleDto {
  @IsOptional()
  @IsEnum(SystemRole)
  role?: SystemRole;

  @IsString()
  @Length(5, 1000, { message: 'Un motif d’au moins 5 caractères est obligatoire.' })
  motif!: string;
}
