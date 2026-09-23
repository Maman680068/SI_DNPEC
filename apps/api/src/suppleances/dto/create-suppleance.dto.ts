import { IsDateString, IsString } from 'class-validator';

export class CreateSuppleanceDto {
  @IsString()
  titulaireId!: string;

  @IsString()
  suppleantId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
