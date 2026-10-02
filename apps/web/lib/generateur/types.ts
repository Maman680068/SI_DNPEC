/** Documents générés (socle N4, SIG-RF-DOC). Droits et listes de choix viennent de l'API. */
export type TypeGenere = 'ATTESTATION_TRAVAIL' | 'ORDRE_MISSION' | 'RAPPORT_ACTIVITE';
export type Perimetre = 'AGENT' | 'SECTION' | 'DIVISION' | 'CELLULE' | 'DIRECTION';

export interface Personne {
  id: string;
  nom: string;
}

export interface Catalogue {
  attestationTravail: { peutCreer: boolean; agents: Personne[] };
  ordreMission: { peutCreer: boolean; agents: Personne[] };
  rapportActivite: { perimetres: { perimetre: Perimetre; cibleId: string | null; libelle: string }[] };
  registres: { id: string; code: string; libelle: string }[];
  peutDeposerEnGed: boolean;
  destinataires: Personne[];
}

export interface ActeLie {
  id: string;
  statut: string;
  numero: string | null;
}

export interface AttestationTravail {
  id: string;
  type: 'ATTESTATION_TRAVAIL';
  agent: Personne;
  createdAt: string;
  acte: ActeLie | null;
  droits: { produire: boolean; preparerActe: boolean };
}

export interface OrdreMission {
  id: string;
  type: 'ORDRE_MISSION';
  agent: Personne;
  objet: string;
  destination: string;
  dateDepart: string;
  dateRetour: string;
  transport: string | null;
  fraisMontant: number | null;
  fraisEnLettres: string | null;
  acte: ActeLie | null;
  droits: { produire: boolean; preparerActe: boolean };
}

/** Ce qu'il faut produire : un objet enregistré, ou le périmètre et la période d'un rapport. */
export interface Demande {
  type: TypeGenere;
  attestationId?: string;
  ordreMissionId?: string;
  perimetre?: Perimetre;
  cibleId?: string;
  debut?: string;
  fin?: string;
  format?: 'PDF' | 'DOCX';
}

export const LIBELLE_GENERE: Record<TypeGenere, string> = {
  ATTESTATION_TRAVAIL: 'Attestation de travail',
  ORDRE_MISSION: 'Ordre de mission',
  RAPPORT_ACTIVITE: 'Rapport d’activité',
};

/** État de l'acte lié, en clair. */
export function etatActe(a: ActeLie | null): string {
  if (!a) return 'Projet — acte non préparé';
  if (a.statut === 'SIGNE' || a.statut === 'EXPEDIE') return `Signé — n° ${a.numero}`;
  if (a.statut === 'ANNULE') return 'Acte annulé';
  return 'Acte en cours (visa, signature)';
}
