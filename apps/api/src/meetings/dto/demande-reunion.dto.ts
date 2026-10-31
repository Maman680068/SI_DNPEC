import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class DemandeReunionDto {
  @IsString()
  @Length(2, 300)
  objet!: string;

  @IsString()
  @Length(2, 2000)
  explication!: string;

  @IsDateString()
  debut!: string;

  @IsDateString()
  fin!: string;

  // Personnes proposées, unités déjà dépliées par l'écran (liste figée au moment du choix).
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  participantIds!: string[];

  // Unités entières choisies (mémoire de la demande).
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  uniteIds?: string[];
}

/** Acceptation : le décideur peut modifier la date et les participants. */
export class AccepterDemandeDto {
  @IsOptional()
  @IsDateString()
  debut?: string;

  @IsOptional()
  @IsDateString()
  fin?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  uniteIds?: string[];
}

export class RefuserDemandeDto {
  @IsString()
  @Length(3, 1000, { message: 'Indiquez le motif du refus (3 caractères au moins).' })
  motif!: string;
}
