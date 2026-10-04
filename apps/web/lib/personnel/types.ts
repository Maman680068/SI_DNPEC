import type { SystemRole } from '../auth/types';
import type { UserStatus } from '../users/types';

export type EmploymentStatus = 'FONCTIONNAIRE' | 'CONTRACTUEL' | 'STAGIAIRE' | 'MISE_A_DISPOSITION';
export type StatutChamp = 'NON_RENSEIGNE' | 'A_VERIFIER' | 'CONFIRME';
export type CareerEventType = 'AFFECTATION' | 'PROMOTION' | 'CHANGEMENT_FONCTION';

export interface IdentitePersonnel {
  id: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  jobTitle: string | null;
  status: UserStatus;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

export interface ListePersonnel {
  peutImporter: boolean;
  /** Vrai pour le DRH : l'écran affiche la synthèse (GET api/v1/rh/dossiers). */
  syntheseDrh?: boolean;
  personnes: IdentitePersonnel[];
}

export interface NiveauUn {
  employmentStatus: EmploymentStatus | null;
  grade: string | null;
  echelon: string | null;
  /** Socle N6 : catégorie (effectifs) et date du dernier échelon (avancement à instruire). */
  categorie: string | null;
  echelonDepuis: string | null;
  serviceStartDate: string | null;
  jobDescriptionFileName: string | null;
}

export interface NiveauDeux {
  personalAddress: string | null;
  personalPhone: string | null;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone: string | null;
}

export interface Diplome {
  id: string;
  title: string;
  institution: string | null;
  obtainedYear: number | null;
  fileName: string | null;
  verified: boolean;
  createdAt: string;
}

export interface PieceAdministrative {
  id: string;
  label: string;
  fileName: string;
  verified: boolean;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

export interface EvenementCarriere {
  id: string;
  eventType: CareerEventType;
  fromValue: string | null;
  toValue: string | null;
  effectiveDate: string;
  recordedBy: { firstName: string; lastName: string };
}

/** Actions permises, calculées par l'API (l'écran n'en déduit aucune). */
export interface DroitsDossier {
  modifier: boolean;
  niveau2: boolean;
  confirmer: boolean;
  signaler: boolean;
}

export interface DossierPersonnel {
  userId: string;
  identite: IdentitePersonnel;
  basic: NiveauUn;
  /** Statut par champ : clés du niveau 1, plus celles du niveau 2 quand il est transmis. */
  statuts: Record<string, StatutChamp>;
  sensitive: NiveauDeux | null;
  diplomas: Diplome[];
  documents: PieceAdministrative[];
  careerHistory: EvenementCarriere[];
  /** Niveau 2 accessible mais non transmis : réauthentification requise (socle N2). */
  niveau2Verrouille?: boolean;
  droits: DroitsDossier;
}

export interface RapportImport {
  total: number;
  created: number;
  updated: number;
  errors: number;
  details: { row: number; email: string | null; status: 'created' | 'updated' | 'error'; message: string }[];
}

export const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  FONCTIONNAIRE: 'Fonctionnaire',
  CONTRACTUEL: 'Contractuel',
  STAGIAIRE: 'Stagiaire',
  MISE_A_DISPOSITION: 'Mise à disposition',
};

export const STATUT_CHAMP_LABEL: Record<StatutChamp, string> = {
  NON_RENSEIGNE: 'Non renseigné',
  A_VERIFIER: 'À vérifier',
  CONFIRME: 'Confirmé',
};

export const CAREER_EVENT_LABEL: Record<CareerEventType, string> = {
  AFFECTATION: 'Affectation',
  PROMOTION: 'Promotion',
  CHANGEMENT_FONCTION: 'Changement de fonction',
};


/** Synthèse du DRH (GET /api/v1/rh/dossiers) : complétude et alertes calculées par l'API. */
export type StatutAgentDossier = 'EN_ACTIVITE' | 'SUSPENDU' | 'PARTI';
export type TypeAlerteDossier = 'FIN_STAGE' | 'FIN_CONTRAT' | 'AVANCEMENT_ECHELON' | 'DOSSIER_A_VERIFIER' | 'MATRICULE_PROVISOIRE';

export interface LigneDossier {
  agentId: string | null;
  userId: string | null;
  prenom: string;
  nom: string;
  matricule: string | null;
  matriculeProvisoire: boolean;
  poste: string | null;
  role: SystemRole | null;
  unite: string | null;
  statut: StatutAgentDossier;
  finPrevue: string | null;
  completude: number;
  aVerifier: boolean;
  alertes: { type: TypeAlerteDossier; libelle: string }[];
  lien: string;
}

export interface SyntheseDossiers {
  droits: { importer: boolean; creerAgent: boolean };
  synthese: { enActivite: number; suspendus: number; partis: number; aVerifier: number; matriculesProvisoires: number; completudeMoyenne: number | null };
  elementsCompletude: number;
  lignes: LigneDossier[];
  calculeLe: string;
}
