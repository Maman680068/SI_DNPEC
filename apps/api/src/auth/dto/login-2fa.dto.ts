import { IsString, Length } from 'class-validator';

export class LoginTwoFaDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
