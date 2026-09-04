import { IsOptional, IsString, Length } from 'class-validator';

export class ValidateTaskDto {
  @IsOptional()
  @IsString()
  @Length(2, 2000)
  comment?: string;
}
