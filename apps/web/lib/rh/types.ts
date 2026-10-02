// Ressources humaines (socle N6) — miroir des réponses de api/v1/rh.

export interface Repartition {
  libelle: string;
  nombre: number;
}
export interface Effectifs {
  total: number;
  parUnite: Repartition[];
  parStatut: Repartition[];
  parCategorie: Repartition[];
  ancienneteMoyenneAnnees: number | null;
  ancienneteRenseignee: number;
  femmes: number;
  genreRenseigne: number;
  partFemmes: number | null;
  calculeLe: string;
}

export type TypeAlerteRh = 'FIN_CONTRAT' | 'FIN_STAGE' | 'AVANCEMENT_ECHELON' | 'DOSSIER_INCOMPLET';
export interface AlerteRh {
  cle: string;
  type: TypeAlerteRh;
  priorite: 'HAUTE' | 'MOYENNE' | 'BASSE';
  userId: string | null;
  agentId: string | null;
  nom: string;
  libelle: string;
  detail: string;
  echeance: string | null;
  lien: string;
}

export interface PieceRequise {
  id: string;
  libelle: string;
  ordre: number;
  actif: boolean;
}
export interface ListePieces {
  pieces: PieceRequise[];
  droits: { gerer: boolean };
}

export interface FamilleActe {
  code: string;
  libelle: string;
  signataire: string;
  registre: { id: string; code: string; libelle: string; isActive: boolean } | null;
}
export interface Familles {
  familles: FamilleActe[];
  registresPossibles: { id: string; code: string; libelle: string }[];
  droits: { gerer: boolean };
}

export type TypeMouvement = 'NOMINATION' | 'AVANCEMENT_ECHELON' | 'PROMOTION' | 'MUTATION' | 'FIN_CONTRAT';
export type StatutMouvement = 'PREPARE' | 'EN_ACTE' | 'APPLIQUE' | 'ANNULE';
export const LIBELLE_TYPE_MOUVEMENT: Record<TypeMouvement, string> = {
  NOMINATION: 'Nomination',
  AVANCEMENT_ECHELON: 'Avancement d’échelon',
  PROMOTION: 'Promotion',
  MUTATION: 'Mutation',
  FIN_CONTRAT: 'Fin de contrat',
};
export const LIBELLE_STATUT_MOUVEMENT: Record<StatutMouvement, string> = {
  PREPARE: 'Préparé',
  EN_ACTE: 'Acte en cours',
  APPLIQUE: 'Appliqué',
  ANNULE: 'Annulé',
};
export interface Mouvement {
  id: string;
  userId: string;
  agent: string | null;
  type: TypeMouvement;
  libelleType: string;
  avant: Record<string, string | null>;
  apres: Record<string, string | null>;
  dateEffet: string;
  motif: string | null;
  statut: StatutMouvement;
  acte: { id: string; numero: string | null; statut: string } | null;
  appliqueLe: string | null;
  droits: { preparerActe: boolean; annuler: boolean };
  /** Nomination à un poste de responsabilité : droits du compte (confirmés par l'administrateur). */
  droitsPoste: { statut: 'EN_ATTENTE' | 'APPLIQUE' | 'REFUSE'; role: string; motifRefus: string | null; decideLe: string | null } | null;
}
export interface ListeMouvements {
  mouvements: Mouvement[];
  droits: { preparer: boolean };
  /** Postes de responsabilité qu'une nomination peut viser : rôle, unité et intitulé de la fonction en découlent. */
  postes: { cle: string; role: string; divisionId: string | null; sectionId: string | null; celluleId: string | null; fonction: string; titulaire: string | null }[];
  agents: { id: string; firstName: string; lastName: string; role: string }[];
}

export interface FichePoste {
  id: string;
  fonction: string;
  missions: string;
  activites: string | null;
  competences: string | null;
  updatedAt: string;
}
export interface Fiches {
  fiches: FichePoste[];
  maFicheId: string | null;
  droits: { gerer: boolean };
}

export type PrioriteFormation = 'HAUTE' | 'MOYENNE' | 'BASSE';
export type OrigineFormation = 'ENTRETIEN' | 'PLAN_TRAVAIL' | 'NOUVELLE_FONCTION' | 'REGLEMENTAIRE' | 'AUTRE';
export type StatutFormation = 'EXPRIME' | 'RETENU' | 'REALISE' | 'ECARTE';
export const LIBELLE_ORIGINE: Record<OrigineFormation, string> = {
  ENTRETIEN: 'Entretien annuel',
  PLAN_TRAVAIL: 'Plan de travail',
  NOUVELLE_FONCTION: 'Nouvelle fonction',
  REGLEMENTAIRE: 'Obligation réglementaire',
  AUTRE: 'Autre',
};
export const LIBELLE_STATUT_FORMATION: Record<StatutFormation, string> = {
  EXPRIME: 'Exprimé',
  RETENU: 'Retenu',
  REALISE: 'Réalisé',
  ECARTE: 'Écarté',
};
export interface BesoinFormation {
  id: string;
  annee: number;
  unite: string | null;
  intitule: string;
  priorite: PrioriteFormation;
  origine: OrigineFormation;
  effectif: number;
  statut: StatutFormation;
}
export interface PlanFormation {
  annee: number;
  besoins: BesoinFormation[];
  monUnite: string | null;
  droits: { exprimer: boolean; decider: boolean };
}
