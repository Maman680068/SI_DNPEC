import { IsString, Length } from 'class-validator';

export class EnableTwoFaDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
