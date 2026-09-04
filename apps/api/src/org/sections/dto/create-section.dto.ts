import { IsString, Length } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  @Length(2, 10)
  code!: string;

  @IsString()
  @Length(2, 200)
  name!: string;
}
