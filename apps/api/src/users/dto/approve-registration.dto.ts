import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class ApproveRegistrationDto {
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

  @IsOptional()
  @IsString()
  jobTitle?: string;

  // Socle NIMBA : rapprochement avec un agent existant (sans compte), ou
  // matricule du nouvel agent (sinon matricule provisoire).
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  matricule?: string;
}
