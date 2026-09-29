import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReauthentificationDto {
  @IsString() @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' }) @MaxLength(200) motDePasse!: string;
  /** Code à 6 chiffres, exigé si la double authentification est active. */
  @IsOptional() @IsString() @MaxLength(10) code?: string;
}
