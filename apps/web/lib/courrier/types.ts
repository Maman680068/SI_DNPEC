import type { SystemRole } from '../auth/types';

// Réponses de l'API courrier (D7). L'écran n'a rien à calculer : chaque action
// affichée vient de `droits`, calculés par le serveur, qui revérifie toujours.

export type RegistreNature = 'ARRIVEE' | 'DEPART' | 'ACTE';
export type RegistrePortee = 'DIRECTION' | 'UNITE';
export type Confidentialite = 'ORDINAIRE' | 'CONFIDENTIEL' | 'PERSONNEL';
export type ArriveeStatut = 'ENREGISTRE' | 'IMPUTE' | 'TRAITE' | 'CLASSE' | 'ANNULE';
export type ImputationNature = 'ATTRIBUTION' | 'INFORMATION' | 'AVIS';
export type ImputationStatut = 'EN_COURS' | 'TRAITEE';
export type ActeStatut = 'BROUILLON' | 'EN_VISA' | 'RENVOYE' | 'A_SIGNER' | 'SIGNE' | 'EXPEDIE' | 'ANNULE';
export type VisaStatut = 'EN_ATTENTE' | 'VISE' | 'RENVOYE' | 'SAUTE';
export type PieceNature = 'SCAN' | 'ANNEXE' | 'ACTE_SIGNE';
export type NiveauAcces = 'EXISTENCE' | 'METADONNEES' | 'CONTENU';

/** Personne citée par un courrier — champs d'affichage seulement. */
export interface Personne {
  id: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  jobTitle: string | null;
}

export interface Registre {
  id: string;
  code: string;
  libelle: string;
  nature: RegistreNature;
  portee: RegistrePortee;
  gabaritNumero: string;
  isActive: boolean;
}

export interface Unite {
  key: string;
  code: string;
  libelle: string;
}

export interface Habilitation {
  id: string;
  userId: string;
  registreId: string;
  uniteKey: string;
  createdAt: string;
  revoqueeAt: string | null;
  registre: Pick<Registre, 'code' | 'libelle' | 'nature' | 'portee'> & Partial<Registre>;
}

export interface Compteur {
  registreId: string;
  uniteKey: string;
  annee: number;
  dernier: number;
  updatedAt: string;
}

export interface Piece {
  id: string;
  nature: PieceNature;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  deposeParId: string;
  createdAt: string;
}

export interface Imputation {
  id: string;
  parentId: string | null;
  imputeParId: string;
  auNomDeId: string | null;
  imputeAId: string;
  nature: ImputationNature;
  instructions: string | null;
  echeance: string | null;
  statut: ImputationStatut;
  compteRendu: string | null;
  reponseActeId: string | null;
  traiteeAt: string | null;
  traiteeParId: string | null;
  createdAt: string;
  tache: { id: string; status: string } | null;
  droits: { traiter: boolean; sousImputer: boolean; convertir: boolean };
}

export interface Arrivee {
  id: string;
  numero: string;
  annee: number;
  sequence: number;
  registre: { id: string; code: string; libelle: string; portee: RegistrePortee };
  uniteKey: string;
  dateReception: string;
  expediteur: string;
  confidentialite: Confidentialite;
  destinataireId: string | null;
  statut: ArriveeStatut;
  motifAnnulation: string | null;
  createdAt: string;
  niveau: NiveauAcces;
  objet: string | null;
  referenceExpediteur: string | null;
  dateCourrier: string | null;
  imputations: Imputation[];
  pieces: Piece[];
  personnes: Record<string, Personne>;
  droits: {
    imputer: boolean;
    completer: boolean;
    requalifier: boolean;
    corriger: boolean;
    annuler: boolean;
    classer: boolean;
    ajouterPiece: boolean;
    repondre: boolean;
    deleguer: boolean;
  };
}

export interface Visa {
  id: string;
  cycle: number;
  ordre: number;
  niveau: SystemRole;
  viseurAttenduId: string | null;
  statut: VisaStatut;
  motifSaut: string | null;
  viseParId: string | null;
  viseAuNomDeId: string | null;
  commentaire: string | null;
  viseAt: string | null;
}

export interface Acte {
  id: string;
  registreId: string;
  uniteKey: string;
  confidentialite: Confidentialite;
  statut: ActeStatut;
  sequence: number | null;
  annee: number | null;
  numero: string | null;
  redacteurId: string;
  beneficiaireId: string | null;
  objet: string;
  destinataires: string | null;
  corps: string | null;
  priseConnaissanceRequise: boolean;
  priseConnaissanceAt: string | null;
  repondAId: string | null;
  cycle: number;
  motifRenvoi: string | null;
  signataireId: string | null;
  signeAuNomDeId: string | null;
  signeAt: string | null;
  expedieAt: string | null;
  expedieParId: string | null;
  modeExpedition: string | null;
  annuleAt: string | null;
  annuleParId: string | null;
  motifAnnulation: string | null;
  createdAt: string;
  updatedAt: string;
  registre: { id: string; code: string; libelle: string; nature: RegistreNature; portee: RegistrePortee };
  visas: Visa[];
  pieces: Piece[];
  visaCourant: Visa | null;
  enAttentePriseConnaissance: boolean;
  /** Fiche seulement (GET /courrier/actes/:id). */
  circuitObsolete?: boolean;
  personnes: Record<string, Personne>;
  droits: {
    modifier: boolean;
    supprimer: boolean;
    soumettre: boolean;
    viser: boolean;
    renvoyer: boolean;
    signer: boolean;
    expedier: boolean;
    annuler: boolean;
    ajouterPiece: boolean;
    prendreConnaissance: boolean;
    deleguer: boolean;
  };
}

export interface TableauDeBordCourrier {
  aImputer: number;
  aTraiter: number;
  enRetard: number;
  aViser: number;
  aSigner: number;
  aExpedier: number;
  priseDeConnaissance: number;
  brouillons: number;
}

/** Personne proposable (GET /courrier/imputables) — ce que le serveur accepterait. */
export type Candidat = Personne;

export interface Delegataire extends Personne {
  type: 'ASSISTANT' | 'SUPPLEANT';
}

export interface AccesDelegue {
  id: string;
  type: 'ASSISTANT' | 'SUPPLEANT';
  beneficiaireId: string;
  beneficiaire: Personne;
  createdAt: string;
  revoqueAt: string | null;
}

export interface ArriveeFiltres {
  annee?: number;
  registreId?: string;
  statut?: ArriveeStatut;
  q?: string;
}

export interface ActeFiltres {
  annee?: number;
  registreId?: string;
  statut?: ActeStatut;
  q?: string;
}

// ------------------------------------------------------------------
// Libellés
// ------------------------------------------------------------------

export const CONFIDENTIALITE_LABEL: Record<Confidentialite, string> = {
  ORDINAIRE: 'Ordinaire',
  CONFIDENTIEL: 'Confidentiel',
  PERSONNEL: 'Pli personnel',
};

export const ARRIVEE_STATUT_LABEL: Record<ArriveeStatut, string> = {
  ENREGISTRE: 'Enregistré',
  IMPUTE: 'Imputé',
  TRAITE: 'Traité',
  CLASSE: 'Classé',
  ANNULE: 'Annulé',
};

export const ACTE_STATUT_LABEL: Record<ActeStatut, string> = {
  BROUILLON: 'Brouillon',
  EN_VISA: 'En visa',
  RENVOYE: 'Renvoyé',
  A_SIGNER: 'À signer',
  SIGNE: 'Signé',
  EXPEDIE: 'Expédié',
  ANNULE: 'Annulé',
};

export const NATURE_IMPUTATION_LABEL: Record<ImputationNature, string> = {
  ATTRIBUTION: 'Pour attribution',
  INFORMATION: 'Pour information',
  AVIS: 'Pour avis',
};

export const REGISTRE_NATURE_LABEL: Record<RegistreNature, string> = {
  ARRIVEE: 'Arrivée',
  DEPART: 'Départ',
  ACTE: 'Actes',
};

export const REGISTRE_PORTEE_LABEL: Record<RegistrePortee, string> = {
  DIRECTION: 'Direction (numérotation DNPEC)',
  UNITE: 'Unité (numérotation par Division/Cellule)',
};

export const NIVEAU_VISA_LABEL: Partial<Record<SystemRole, string>> = {
  CHEF_SECTION: 'Chef de Section',
  CHEF_DIVISION: 'Chef de Division',
  CHEF_CELLULE: 'Chef de Cellule',
};

type Tone = 'accent' | 'gold' | 'sage' | 'clay' | 'muted';

export const ARRIVEE_STATUT_TONE: Record<ArriveeStatut, Tone> = {
  ENREGISTRE: 'gold',
  IMPUTE: 'accent',
  TRAITE: 'sage',
  CLASSE: 'muted',
  ANNULE: 'clay',
};

export const ACTE_STATUT_TONE: Record<ActeStatut, Tone> = {
  BROUILLON: 'muted',
  EN_VISA: 'accent',
  RENVOYE: 'clay',
  A_SIGNER: 'gold',
  SIGNE: 'sage',
  EXPEDIE: 'sage',
  ANNULE: 'clay',
};

export const CONFIDENTIALITE_TONE: Record<Confidentialite, Tone> = {
  ORDINAIRE: 'muted',
  CONFIDENTIEL: 'clay',
  PERSONNEL: 'gold',
};

export function nomPersonne(personnes: Record<string, Personne>, id: string | null | undefined): string {
  if (!id) return '—';
  const p = personnes[id];
  return p ? `${p.firstName} ${p.lastName}` : 'Personne inconnue';
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function formatDateHeure(iso: string | null | undefined): string {
  return iso
    ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

export function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}
