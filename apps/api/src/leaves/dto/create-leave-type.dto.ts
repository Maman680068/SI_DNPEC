import { IsString, Length, Matches } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @Matches(/^[A-Z_]{2,40}$/, { message: 'Le code doit être en majuscules (ex. CONGE_ANNUEL)' })
  code!: string;

  @IsString()
  @Length(2, 200)
  name!: string;
}
