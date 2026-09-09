import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères' })
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  // Rattachement souhaité, purement déclaratif — voir AuthService.register
  // et le commentaire sur User.declaredDivisionId dans schema.prisma.
  @IsOptional()
  @IsString()
  declaredDivisionId?: string;

  @IsOptional()
  @IsString()
  declaredSectionId?: string;

  @IsOptional()
  @IsString()
  declaredCelluleId?: string;

  @IsOptional()
  @IsString()
  declaredSupervisorId?: string;
}
