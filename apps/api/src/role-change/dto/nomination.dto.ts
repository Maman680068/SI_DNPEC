import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, ValidateIf, ValidateNested } from 'class-validator';
import { SystemRole } from '@prisma/client';

/** Nouveau rôle de l'actuel titulaire du poste (par défaut : Chargé d'Études dans la même unité). */
export class RoleAncienTitulaireDto {
  @IsEnum(SystemRole)
  role!: SystemRole;

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
}

export class ConfirmerNominationDto {
  /** Précision ajoutée au motif « Acte de nomination n° … » du changement de rôle. */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RoleAncienTitulaireDto)
  ancienTitulaire?: RoleAncienTitulaireDto;
}

export class RefuserNominationDto {
  @IsString()
  @Length(5, 1000, { message: 'Un motif d’au moins 5 caractères est obligatoire.' })
  motif!: string;
}
