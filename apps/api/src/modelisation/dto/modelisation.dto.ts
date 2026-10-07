import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

/** Champs texte du dépôt (multipart) : la case de confirmation arrive en texte. */
export class DepotPaquetDto {
  @IsIn(['true', 'oui', 'on'], { message: 'Cochez « Je confirme que les données de ce paquet sont publiées ou autorisées pour cet hébergement ».' })
  donneesConfirmees!: string;
}

export class ReglageManetteDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,63}$/)
  id!: string;

  @IsBoolean()
  actif!: boolean;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  min!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  max!: number;
}

export class ReglageCompteurDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,63}$/)
  id!: string;

  @IsBoolean()
  actif!: boolean;
}

export class ReglagesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReglageManetteDto)
  manettes!: ReglageManetteDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReglageCompteurDto)
  compteurs!: ReglageCompteurDto[];
}

export class MotifDto {
  @IsString()
  @MinLength(5, { message: 'Le motif doit contenir au moins 5 caractères.' })
  @MaxLength(2000)
  motif!: string;
}

export class DemandeDerogationDto extends MotifDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,63}$/)
  controleId!: string;
}

export class ExecutionDto {
  /** Scénario au contrat « dnpec-modele/1 » : { mode, chocs, hypotheses } (contrôlé par le serveur). */
  @IsObject()
  scenario!: Record<string, unknown>;
}

export class AffectationDto {
  @IsString()
  userId!: string;

  @IsIn(['ANALYSTE', 'RESPONSABLE', 'SUPPLEANT'])
  role!: 'ANALYSTE' | 'RESPONSABLE' | 'SUPPLEANT';

  @IsOptional()
  @IsString()
  modeleId?: string;

  @IsString()
  @MinLength(5, { message: 'Le motif doit contenir au moins 5 caractères.' })
  @MaxLength(2000)
  motif!: string;
}
