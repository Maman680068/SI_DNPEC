import { IsOptional, IsString, Length } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(2, 200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  divisionId?: string;
}
