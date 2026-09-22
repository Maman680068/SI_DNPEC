import { IsString, Length } from 'class-validator';

export class CreateDecisionDto {
  @IsString()
  @Length(2, 2000)
  content!: string;
}
