import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateSuggestionDto {
  @IsString()
  @Length(2, 4000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
