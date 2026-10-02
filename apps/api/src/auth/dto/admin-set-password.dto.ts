import { IsString, MinLength, MaxLength } from 'class-validator';

export class AdminSetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(200, { message: 'Mot de passe trop long (200 caractères au plus).' })
  newPassword!: string;
}
