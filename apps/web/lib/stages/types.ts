import type { SystemRole } from '../auth/types';

export type StageStatut = 'PREVU' | 'EN_COURS' | 'TERMINE' | 'INTERROMPU';
export type PeriodeStatut = 'PROPOSEE' | 'ACCEPTEE' | 'REFUSEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
export type FormatEvaluation = 'GRILLE' | 'TEXTE' | 'AUCUNE';
export type EvaluationStatut = 'BROUILLON' | 'SOUMISE' | 'RENVOYEE' | 'VISEE';
export type Niveau = 'INSUFFISANT' | 'SATISFAISANT' | 'TRES_SATISFAISANT';

export interface Personne {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Evaluation {
  id: string;
  redacteur: Personne;
  criteres: Record<string, Niveau> | null;
  appreciation: string | null;
  statut: EvaluationStatut;
  motifRenvoi: string | null;
  soumiseAt: string | null;
  viseePar: Personne | null;
  viseeAt: string | null;
}

export interface DroitsPeriode {
  modifier: boolean;
  annuler: boolean;
  accepter: boolean;
  refuser: boolean;
  changerTuteur: boolean;
  changerFormat: boolean;
  rediger: boolean;
  viser: boolean;
}

export interface Periode {
  id: string;
  ordre: number;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  dateDebut: string;
  dateFin: string;
  formatEvaluation: FormatEvaluation;
  statut: PeriodeStatut;
  unite: string;
  uniteKey: string;
  objectifs: string | null;
  tuteur: Personne | null;
  motifRefus: string | null;
  responsables: Personne[];
  evaluation: Evaluation | null;
  droits: DroitsPeriode;
}

export interface EtatAttestation {
  modeleImporte?: boolean;
  acte: { id: string; statut: string; numero: string | null; signeAt: string | null; priseConnaissanceAt: string | null } | null;
  droits: { provisoire: boolean; document: boolean; creerActe: boolean; prendreConnaissance: boolean; telechargerFinale: boolean };
}

export type RapportStatut = 'DEPOSE' | 'VALIDE' | 'A_REPRENDRE';
export const RAPPORT_STATUT_LABEL: Record<RapportStatut, string> = {
  DEPOSE: 'Déposé, en attente de validation',
  VALIDE: 'Validé',
  A_REPRENDRE: 'À reprendre',
};

export interface EtatRapport {
  statut: RapportStatut | null;
  fichier: string | null;
  deposeLe: string | null;
  motif: string | null;
  valideLe: string | null;
  droits: { designerEncadrant: boolean; deposer: boolean; telecharger: boolean; valider: boolean };
}

export interface Stage {
  id: string;
  vue: 'STAGIAIRE' | 'DRH' | 'DIRECTION' | 'UNITE';
  statut: StageStatut;
  stagiaire: Personne & { status: string };
  rattachementActuel: string;
  etablissement: string;
  diplomePrepare: string | null;
  encadrantAcademique: string | null;
  dateDebut: string;
  dateFin: string;
  motifInterruption: string | null;
  clotureAt: string | null;
  periodes: Periode[];
  attestation: EtatAttestation;
  encadrantPrincipal: Personne | null;
  rapport: EtatRapport;
  droits: { modifier: boolean; ajouterPeriode: boolean; cloturer: boolean; interrompre: boolean };
}

export interface ResumeStage {
  id: string;
  statut: StageStatut;
  etablissement: string;
  dateDebut: string;
  dateFin: string;
  stagiaire: Personne;
  periodeEnCours: { id: string; divisionId: string | null; sectionId: string | null; celluleId: string | null; dateDebut: string; dateFin: string } | null;
  aTraiter: number;
}

export interface ListeStages {
  peutCreer: boolean;
  stages: ResumeStage[];
}

export interface Candidat extends Personne {
  role?: SystemRole;
  jobTitle?: string | null;
  email?: string;
}

export interface Planning {
  debut: string;
  fin: string;
  peutFixerCapacites: boolean;
  capacites: { uniteKey: string; maximum: number; libelle: string }[];
  periodes: (Pick<Periode, 'id' | 'dateDebut' | 'dateFin' | 'statut' | 'formatEvaluation'> & { uniteKey: string; unite: string; stageId: string; stagiaire: Personne; tuteur: Personne | null })[];
}

export interface Capacites {
  peutModifier: boolean;
  voitPlanning: boolean;
  peutCreerNouveauStagiaire: boolean;
  capacites: { uniteKey: string; maximum: number; libelle: string }[];
  /** S9e : toutes les unités d'accueil, limite et occupation du jour (comptages, sans nom). */
  unites: { uniteKey: string; sigle: string; nom: string; niveau: 'DIVISION' | 'SECTION' | 'CELLULE'; maximum: number | null; occupation: number; complet: boolean }[];
}

export interface ModeleAttestation {
  champsDisponibles: { cle: string; description: string }[];
  modele: { id: string; type: 'DOCX' | 'PDF'; fileName: string; champs: string[]; createdAt: string; importePar: Personne | null; parDefaut: boolean } | null;
  /** Modèles remplacés (conservés). */
  historique: { id: string; type: 'DOCX' | 'PDF'; fileName: string; createdAt: string; importePar: Personne | null; parDefaut: boolean }[];
}

/** Contrôle d'un modèle avant activation (rien n'est enregistré). */
export interface VerificationModele {
  valide: boolean;
  type: 'DOCX' | 'PDF' | null;
  champs: string[];
  inconnus: string[];
  absents: string[];
  message: string;
}

export interface PeriodeInput {
  divisionId?: string | null;
  sectionId?: string | null;
  celluleId?: string | null;
  dateDebut: string;
  dateFin: string;
  formatEvaluation: FormatEvaluation;
  objectifs?: string;
  motif?: string;
}

export const STAGE_STATUT_LABEL: Record<StageStatut, string> = { PREVU: 'Prévu', EN_COURS: 'En cours', TERMINE: 'Terminé', INTERROMPU: 'Interrompu' };
export const PERIODE_STATUT_LABEL: Record<PeriodeStatut, string> = {
  PROPOSEE: 'À accepter par l’unité',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Retirée du plan',
};
export const FORMAT_LABEL: Record<FormatEvaluation, string> = { GRILLE: 'Grille (4 critères) + appréciation', TEXTE: 'Texte libre', AUCUNE: 'Pas d’évaluation' };
export const EVALUATION_STATUT_LABEL: Record<EvaluationStatut, string> = { BROUILLON: 'Brouillon', SOUMISE: 'À viser', RENVOYEE: 'Renvoyée au tuteur', VISEE: 'Visée' };
export const CRITERES: { cle: string; libelle: string }[] = [
  { cle: 'assiduite', libelle: 'Assiduité' },
  { cle: 'qualite', libelle: 'Qualité du travail' },
  { cle: 'autonomie', libelle: 'Autonomie' },
  { cle: 'integration', libelle: 'Intégration' },
];
export const NIVEAU_LABEL: Record<Niveau, string> = { INSUFFISANT: 'Insuffisant', SATISFAISANT: 'Satisfaisant', TRES_SATISFAISANT: 'Très satisfaisant' };
