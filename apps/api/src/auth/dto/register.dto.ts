import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

// Postes déclarables à l'inscription (User.declaredRole) — délibérément une
// simple liste de chaînes, pas le SystemRole importé du client Prisma : ce
// champ est purement informatif (voir schema.prisma) et ne doit pas être
// couplé au type du vrai rôle système.
export const DECLARABLE_ROLES = [
  'AGENT',
  'CHEF_SECTION',
  'CHEF_DIVISION',
  'CHEF_CELLULE',
  'DN',
  'DNA',
  'ASSISTANT_DIRECTION',
] as const;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
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

  // Poste actuel déclaré — obligatoire, voir schema.prisma User.declaredRole.
  @IsIn(DECLARABLE_ROLES)
  declaredRole!: string;
}
