/** Domaine B, lot B1 : référentiel des modèles (réponses de api/v1/modeles et api/v1/modelisation). */
export type StatutVersion = 'DEPOSEE' | 'CONTROLEE' | 'EN_ATTENTE' | 'ACTIVE' | 'REFUSEE' | 'ARCHIVEE';
export type TonEtat = 'bleu' | 'or' | 'vert' | 'rouge' | 'gris';

export interface ModeleListe {
  id: string;
  code: string;
  nom: string;
  famille: string;
  sousTitre: string;
  demonstration: boolean;
  versionActive: { numero: number; avecDerogation: boolean } | null;
  responsable: string | null;
  etat: { code: StatutVersion; libelle: string; ton: TonEtat; numero: number } | null;
  dernierControle: { numero: number; le: string } | null;
}
export interface ListeModeles {
  droits: { peutDeposer: boolean };
  modeles: ModeleListe[];
}

export interface Controle {
  id: string;
  libelle: string;
  type: 'bloquant' | 'alerte';
  ok: boolean;
  valeur: string;
  seuil: string | null;
}
export interface ManetteVersion {
  id: string;
  libelle: string;
  detail: string | null;
  type: 'choc' | 'hypothese';
  unite: string | null;
  indices: number;
  minPaquet: number;
  maxPaquet: number;
  actif: boolean;
  min: number;
  max: number;
}
export interface CompteurVersion {
  id: string;
  libelle: string;
  unite: string | null;
  actif: boolean;
}
export interface DerogationVue {
  controleId: string;
  controle: string;
  motif: string;
  demandeePar: string | null;
  demandeeLe: string;
  confirmeePar: string | null;
  confirmeeLe: string | null;
}
export interface VersionDetail {
  id: string;
  modele: { id: string; code: string; nom: string };
  numero: number;
  statut: StatutVersion;
  etat: { libelle: string; ton: TonEtat };
  nomFichier: string;
  tailleOctets: number;
  empreinte: string;
  deposeLe: string;
  auteur: string | null;
  approbateur: string | null;
  approuveLe: string | null;
  refusePar: string | null;
  refuseLe: string | null;
  motifRefus: string | null;
  avecDerogation: boolean;
  lu: { famille: string; moteur: string | null; base: string | null; horizon: string | null; manettes: number; compteurs: number; description: string | null; aConfirmer: string[] };
  verification: { statut: 'EN_FILE' | 'EN_COURS' | 'TERMINE' | 'ECHEC'; etape: 'REVEIL' | 'CALCUL' | null; message: string | null; tentatives: number; termineLe: string | null; dureeMs: number | null } | null;
  controles: Controle[];
  resume: { reussis: number; alertes: number; echecs: number };
  manettes: ManetteVersion[];
  compteurs: CompteurVersion[];
  derogations: DerogationVue[];
  droits: {
    peutRegler: boolean;
    peutEnvoyer: boolean;
    peutRelancerVerification: boolean;
    peutAbandonner: boolean;
    peutApprouver: boolean;
    peutRefuser: boolean;
    approbationImpossible: string | null;
    derogationsDemandables: string[];
    derogationsConfirmables: string[];
  };
}
export interface FicheModele {
  modele: { id: string; code: string; nom: string; famille: string; description: string | null; sousTitre: string; demonstration: boolean };
  versions: { id: string; numero: number; statut: StatutVersion; etat: { libelle: string; ton: TonEtat }; nomFichier: string; deposePar: string | null; deposeLe: string; resume: { reussis: number; alertes: number; echecs: number } }[];
  version: VersionDetail | null;
  gouvernance: { responsable: { id: string; nom: string | null } | null; suppleant: { id: string; nom: string | null } | null; administrateur: string | null };
  donnees: { base: string | null; fichiers: { chemin: string; role: string | null }[]; reference: { fichier: string | null; logiciel: string | null; date: string | null } | null };
  utilisation: { manettesActives: number; compteurs: number; simulations: number };
  droits: { peutDeposer: boolean; peutDesigner: boolean };
}

export type RoleModelisation = 'ANALYSTE' | 'RESPONSABLE' | 'SUPPLEANT';
export interface AffectationsPersonne {
  compte: { id: string; nom: string; role: string; ineligible: string | null };
  affectations: {
    id: string;
    role: RoleModelisation;
    libelle: string;
    modele: { id: string; nom: string } | null;
    motif: string;
    debut: string;
    attribuePar: string | null;
    fin: string | null;
    finPar: string | null;
    motifFin: string | null;
    peutClore: boolean;
  }[];
  droits: { peutAttribuerAnalyste: boolean; peutDesigner: boolean };
  modeles: { id: string; nom: string; responsable: string | null; suppleant: string | null }[];
}
export interface PersonneDesignable {
  id: string;
  nom: string;
  fonction: string | null;
}
