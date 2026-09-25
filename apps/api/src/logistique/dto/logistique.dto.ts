import { EtatBien, NatureCategorieLogistique, StatutDemandeLogistique, TypeDemandeLogistique, TypeMouvementStock } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

// ---------------------------------------------------------------- Paramétrage

export class HabilitationLogistiqueDto {
  @IsString()
  userId!: string;
}

export class CreerCategorieDto {
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/, { message: 'Le code : 2 à 10 lettres majuscules ou chiffres (préfixe du numéro d’inventaire).' })
  code!: string;

  @IsString()
  @Length(2, 120)
  libelle!: string;

  @IsEnum(NatureCategorieLogistique)
  nature!: NatureCategorieLogistique;

  @IsBoolean()
  validationChefRequise!: boolean;
}

export class ModifierCategorieDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  libelle?: string;

  @IsOptional()
  @IsBoolean()
  validationChefRequise?: boolean;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class ArticleDto {
  @IsString()
  categorieId!: string;

  @IsString()
  @Length(2, 160)
  libelle!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  unite?: string;

  @IsBoolean()
  suiviStock!: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  seuilAlerte?: number | null;
}

export class ModifierArticleDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  libelle?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  unite?: string;

  @IsOptional()
  @IsBoolean()
  suiviStock?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  seuilAlerte?: number | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class MouvementStockDto {
  @IsEnum(TypeMouvementStock)
  type!: TypeMouvementStock;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantite!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  motif?: string;
}

// ---------------------------------------------------------------- Inventaire

export class CreerBienDto {
  @IsString()
  categorieId!: string;

  @IsString()
  @Length(2, 200)
  designation!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  marque?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  numeroSerie?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  emplacement?: string;

  @IsOptional()
  @IsDateString()
  dateAcquisition?: string;
}

export class ModifierBienDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  designation?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(1, 120)
  marque?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(1, 120)
  numeroSerie?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(1, 200)
  emplacement?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  dateAcquisition?: string | null;
}

/** Affectation à une personne OU à une unité (division, section, cellule). */
export class AffecterBienDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  celluleId?: string;
}

export class MotifDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  motif?: string;
}

export class MotifObligatoireDto {
  @IsString()
  @Length(3, 500)
  motif!: string;
}

export class EtatBienDto {
  @IsEnum(EtatBien)
  etat!: EtatBien;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  motif?: string;
}

export class FiltresBiensDto {
  @IsOptional()
  @IsString()
  categorieId?: string;

  @IsOptional()
  @IsEnum(EtatBien)
  etat?: EtatBien;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
}

// ---------------------------------------------------------------- Demandes

export class CreerDemandeDto {
  @IsEnum(TypeDemandeLogistique)
  type!: TypeDemandeLogistique;

  /** MATERIEL : catégorie de biens demandée. */
  @IsOptional()
  @IsString()
  categorieId?: string;

  /** FOURNITURE : article demandé. */
  @IsOptional()
  @IsString()
  articleId?: string;

  /** INTERVENTION : bien concerné. */
  @IsOptional()
  @IsString()
  bienId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantite?: number;

  @IsString()
  @Length(3, 300)
  objet!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  justification?: string;
}

export class TraiterDemandeDto {
  /** FOURNITURE avec suivi de stock : quantité réellement remise (sortie de stock). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantiteLivree?: number;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  compteRendu?: string;
}

export class FiltresDemandesDto {
  @IsOptional()
  @IsEnum(StatutDemandeLogistique)
  statut?: StatutDemandeLogistique;

  /** « a_valider » : celles que je peux valider ; « a_traiter » : file des gestionnaires ; « miennes ». */
  @IsOptional()
  @IsString()
  @Matches(/^(a_valider|a_traiter|miennes)$/)
  vue?: 'a_valider' | 'a_traiter' | 'miennes';
}
