import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoleFonctionnel } from '@prisma/client';

export class ListerAttributionsDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsEnum(RoleFonctionnel) role?: RoleFonctionnel;
  @IsOptional() @IsIn(['true', 'false']) actives?: string;
}

export class AttribuerRoleDto {
  @IsString() @IsNotEmpty() userId!: string;
  @IsEnum(RoleFonctionnel) role!: RoleFonctionnel;
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsString() @MaxLength(500) motif?: string;
}

export class RetirerRoleDto {
  @IsString() @IsNotEmpty({ message: 'Le motif du retrait est obligatoire.' }) @MaxLength(500) motif!: string;
}
