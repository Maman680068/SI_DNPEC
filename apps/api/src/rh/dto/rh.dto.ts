import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { TypeMouvementCarriere } from '@prisma/client';

export class PieceRequiseDto {
  @IsString()
  @Length(3, 120)
  libelle!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  ordre?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class ModifierPieceRequiseDto {
  @IsOptional()
  @IsString()
  @Length(3, 120)
  libelle?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  ordre?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class MouvementDto {
  @IsString()
  userId!: string;

  @IsEnum(TypeMouvementCarriere)
  type!: TypeMouvementCarriere;

  @IsDateString({}, { message: 'Date d’effet invalide.' })
  dateEffet!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  motif?: string;

  /** Valeurs après le mouvement : fonction (nomination), echelon (avancement), grade/echelon/categorie
   * (promotion), divisionId/sectionId/celluleId (mutation) ; rien pour une fin de contrat. */
  @IsObject()
  apres!: Record<string, string | null>;
}

export class FamilleRegistreDto {
  @IsOptional()
  @IsString()
  registreId?: string | null;
}

export class FichePosteDto {
  @IsString()
  @Length(2, 160)
  fonction!: string;

  @IsString()
  @Length(10, 6000)
  missions!: string;

  @IsOptional()
  @IsString()
  @Length(0, 6000)
  activites?: string;

  @IsOptional()
  @IsString()
  @Length(0, 6000)
  competences?: string;
}

export const PRIORITES_FORMATION = ['HAUTE', 'MOYENNE', 'BASSE'] as const;
export const ORIGINES_FORMATION = ['ENTRETIEN', 'PLAN_TRAVAIL', 'NOUVELLE_FONCTION', 'REGLEMENTAIRE', 'AUTRE'] as const;
export const STATUTS_FORMATION = ['EXPRIME', 'RETENU', 'REALISE', 'ECARTE'] as const;

export class BesoinFormationDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee!: number;

  @IsString()
  @Length(3, 200)
  intitule!: string;

  @IsIn(PRIORITES_FORMATION)
  priorite!: (typeof PRIORITES_FORMATION)[number];

  @IsIn(ORIGINES_FORMATION)
  origine!: (typeof ORIGINES_FORMATION)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  effectif?: number;
}

export class StatutBesoinDto {
  @IsIn(STATUTS_FORMATION)
  statut!: (typeof STATUTS_FORMATION)[number];
}

export class AnneeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee?: number;
}

/** Plan de formation individuel : session de formation d'un agent (docs/conception_plan_formation.md). */
export class SessionFormationDto {
  @IsString()
  @Length(3, 200)
  intitule!: string;

  /** Compte de l'agent. */
  @IsString()
  agentId!: string;

  /** Besoin d'origine (facultatif) : un besoin retenu. */
  @IsOptional()
  @IsString()
  besoinId?: string;

  @IsDateString()
  dateDebut!: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dureeJours?: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  organisme?: string;

  /** Planifiée d'emblée (sinon souhaitée). */
  @IsOptional()
  @IsBoolean()
  planifier?: boolean;
}

export class ModifierSessionFormationDto {
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dureeJours?: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  organisme?: string;
}
