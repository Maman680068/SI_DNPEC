import { IsOptional, IsString } from 'class-validator';

/**
 * Champs de profil "neutres" : email, role et rattachement organisationnel
 * en sont volontairement exclus — ils passent par des endpoints dédiés
 * (update-assignment, update-status) pour éviter qu'une modification de
 * profil anodine ne change accidentellement des droits.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}
