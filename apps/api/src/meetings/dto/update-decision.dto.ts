import { IsString, Length } from 'class-validator';

export class UpdateDecisionDto {
  @IsString()
  @Length(2, 2000)
  content!: string;
}
