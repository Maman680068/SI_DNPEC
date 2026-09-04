import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Matches(/@dnpec\.gov\.gn$/, {
    message: "L'adresse doit être une adresse professionnelle @dnpec.gov.gn",
  })
  email!: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères' })
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;
}
