import { IsString, MinLength } from 'class-validator';

export class AdminSetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  newPassword!: string;
}
