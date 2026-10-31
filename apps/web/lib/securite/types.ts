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
  jour: string;
  action: string;
  icone: string;
  /** Phrase en français calculée par l'API (auteur + verbe + objet nommé ; générique si l'objet est protégé). */
  phrase: string;
  libelle: string;
  evenement: string | null;
  domaine: string;
  sensible: boolean;
  objet: { type: string; libelle: string; protege: boolean; lien: string | null };
  objetType: string;
  objetId: string | null;
  avantApres: { champ: string; avant: string; apres: string }[];
  acteur: { id: string; nom: string } | null;
  auNomDe: { id: string; nom: string } | null;
  scellee: boolean;
  empreinte: string | null;
}

export interface PageAudit {
  droits: { peutVerifier: boolean; peutExporter: boolean };
  portee: string;
  total: number;
  page: number;
  taille: number;
  typesObjets: string[];
  domaines: { valeur: string; libelle: string }[];
  sceau: { intacte: boolean | null; entrees: number; derniereVerification: string | null; scellementEnRetard: number };
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

/** Indicateurs de succès (calculés à la lecture par l'API ; seules les cibles sont des paramètres). */
export interface IndicateurSucces {
  cle: string;
  libelle: string;
  valeur: number | null;
  unite: string;
  cible: number;
  cleCible: string;
  sens: 'MIN' | 'MAX';
  atteint: boolean | null;
  periode: string;
  base: number;
}
export interface IndicateursSucces {
  droits: { peutModifier: boolean };
  calculeLe: string;
  indicateurs: IndicateurSucces[];
  cibles: Parametre[];
}
