import { IsString, Length, Matches } from 'class-validator';

export class CreateCelluleDto {
  @IsString()
  @Matches(/^[A-Z]{2,10}$/, { message: 'Le code doit être en majuscules (2 à 10 lettres), ex. CSID' })
  code!: string;

  @IsString()
  @Length(2, 200)
  name!: string;
}
