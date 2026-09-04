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
  jobTitle?: string;
}
