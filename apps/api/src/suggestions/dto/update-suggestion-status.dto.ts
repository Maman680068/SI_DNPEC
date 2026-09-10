import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { SuggestionStatus } from '@prisma/client';

export class UpdateSuggestionStatusDto {
  @IsEnum(SuggestionStatus)
  status!: SuggestionStatus;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  response?: string;
}
