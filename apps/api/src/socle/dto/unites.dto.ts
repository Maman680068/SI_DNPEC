import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TypeUnite } from '@prisma/client';

const CODE = /^[A-Z0-9][A-Z0-9-]{0,19}$/;
const MESSAGE_CODE = 'Code : lettres majuscules, chiffres ou tirets (20 caractères au plus).';

export class CreerUniteDto {
  @IsEnum(TypeUnite) type!: TypeUnite;
  @IsString() @IsNotEmpty() parentId!: string;
  @IsString() @Matches(CODE, { message: MESSAGE_CODE }) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) libelle!: string;
}

export class ModifierUniteDto {
  @IsOptional() @IsString() @Matches(CODE, { message: MESSAGE_CODE }) code?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) libelle?: string;
  /** Cellule ⇄ Instance seulement (même support historique). */
  @IsOptional() @IsEnum(TypeUnite) type?: TypeUnite;
}

export class FermerUniteDto {
  @IsString() @IsNotEmpty({ message: 'Le motif de la fermeture est obligatoire.' }) @MaxLength(500) motif!: string;
  /** Date d'effet (aujourd'hui par défaut, jamais dans le futur). */
  @IsOptional() @IsDateString() dateEffet?: string;
}
