import { IsDateString, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class AttestationTravailDto {
  @IsString()
  agentId!: string;
}

export class RegistreDto {
  @IsString()
  registreId!: string;
}

export class OrdreMissionDto {
  @IsString()
  agentId!: string;

  @IsString()
  @Length(5, 500)
  objet!: string;

  @IsString()
  @Length(2, 200)
  destination!: string;

  @IsDateString()
  dateDepart!: string;

  @IsDateString()
  dateRetour!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  transport?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999_999_999_999)
  fraisMontant?: number;
}
