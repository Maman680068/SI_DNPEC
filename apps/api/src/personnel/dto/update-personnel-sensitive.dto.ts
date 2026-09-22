import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdatePersonnelSensitiveDto {
  @IsOptional()
  @IsString()
  @Length(1, 300)
  personalAddress?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  personalPhone?: string;

  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  emergencyContactRelation?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  emergencyContactPhone?: string;
}
