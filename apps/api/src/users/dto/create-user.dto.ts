import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsEnum(SystemRole)
  role!: SystemRole;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  celluleId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  // Socle NIMBA : rapprochement avec un agent existant (sans compte), ou
  // matricule du nouvel agent (sinon matricule provisoire).
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  matricule?: string;
}
