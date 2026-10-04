export type EtatService = 'NOMINAL' | 'DEGRADE' | 'INDISPONIBLE';

export interface Parametre {
  cle: string;
  libelle: string;
  unite: string;
  defaut: number;
  min: number;
  max: number;
  effet: string;
  reference: string;
  valeur: number;
  modifie: boolean;
  modifieLe: string | null;
  modifiePar: string | null;
}

export interface TestRestauration {
  date: string;
  resultat: 'REUSSI' | 'ECHEC';
  commentaire: string | null;
  declarePar: string | null;
}

export interface ListeParametres {
  droits: { peutModifier: boolean };
  parametres: Parametre[];
  testRestauration: TestRestauration | null;
}

export interface Supervision {
  droits: { peutDeclarerTest: boolean };
  genereLe: string;
  etatGlobal: EtatService;
  /** `action` : écran existant proposé pour un service à traiter (calculé par l'API). */
  services: { cle: string; libelle: string; etat: EtatService; detail: string; action?: { libelle: string; lien: string } | null }[];
  taches: { tache: string; libelle: string; periodeMinutes: number; derniere: { debut: string; fin: string | null; statut: string; message: string | null } | null; echecs24h: number }[];
  sessions: { ouvertes: number; expirationJours: number };
  connexions: { reussies24h: number; echecs24h: number };
  sauvegardes: { gestion: string; testRestauration: TestRestauration | null; testEnRetard: boolean };
  comptesASurveiller: { id: string; nom: string; email: string; role: string; motif: string }[];
  finsProches: { agentId: string; nom: string; date: string; nature: string | null; confirmee: boolean }[];
  accesRefuses: {
    parPeriode: Record<'24h' | '7j' | '30j', { etape: string; nombre: number }[]>;
    derniers: { id: string; date: string; compte: string; methode: string; route: string; etape: string; objetType: string | null; motif: string }[];
  };
}

export interface EntreeAudit {
  id: string;
  numero: number;
  date: string;
  action: string;
  libelle: string;
  evenement: string | null;
  objetType: string;
  objetId: string;
  acteur: { id: string; nom: string } | null;
  auNomDe: { id: string; nom: string } | null;
  scellee: boolean;
}

export interface PageAudit {
  droits: { peutVerifier: boolean };
  portee: string;
  total: number;
  page: number;
  taille: number;
  typesObjets: string[];
  entrees: EntreeAudit[];
}

export interface VerificationAudit {
  intacte: boolean;
  rangRompu: number | null;
  lignesVerifiees: number;
  nonScellees: number;
  scellementEnRetard: number;
}

export const LIBELLE_ETAT: Record<EtatService, string> = { NOMINAL: 'Nominal', DEGRADE: 'Dégradé', INDISPONIBLE: 'Indisponible' };
export const TON_ETAT: Record<EtatService, 'sage' | 'gold' | 'clay'> = { NOMINAL: 'sage', DEGRADE: 'gold', INDISPONIBLE: 'clay' };
export const LIBELLE_ETAPE: Record<string, string> = {
  PROTEGE: 'Objet protégé',
  EXTERNE: 'Compte externe',
  PERIMETRE: 'Hors périmètre',
  ROLE: 'Rôle insuffisant',
  AUTRE: 'Autre refus',
};
export const ACTIONS_AUDIT: Record<string, string> = {
  CREATION: 'Création',
  MODIFICATION: 'Modification',
  SUPPRESSION: 'Suppression',
  VALIDATION: 'Validation',
  REJET: 'Rejet',
  PUBLICATION: 'Publication',
  CONNEXION: 'Connexion',
  DECONNEXION: 'Déconnexion',
};
