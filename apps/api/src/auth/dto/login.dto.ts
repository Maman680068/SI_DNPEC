import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200, { message: 'Mot de passe trop long (200 caractères au plus).' })
  password!: string;
}
