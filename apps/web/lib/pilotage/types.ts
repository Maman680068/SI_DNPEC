/** Socle N5 : plan de travail, instructions, fils de discussion, recherche, préférences. */
export interface Personne {
  id: string;
  nom: string;
}

export interface Activite {
  id: string;
  objectifId: string;
  libelle: string;
  responsable: Personne;
  dateDebut: string;
  dateFin: string;
  indicateur: string;
  cible: string | null;
  avancement: number;
  nombreTaches: number;
  enRetard: boolean;
  droits: { modifier: boolean; supprimer: boolean };
}

export interface ActiviteDetail extends Activite {
  objectif: { id: string; libelle: string; unite: string; annee: number };
  taches: {
    id: string;
    title: string;
    status: string;
    progressPercent: number | null;
    dueDate: string | null;
  }[];
  responsablesPossibles: { id: string; firstName: string; lastName: string }[];
}

export interface Objectif {
  id: string;
  annee: number;
  uniteId: string;
  unite: string;
  libelle: string;
  description: string | null;
  avancement: number;
  activites: Activite[];
  droits: { modifier: boolean; supprimer: boolean; ajouterActivite: boolean };
}

export interface Plan {
  annee: number;
  unites: { id: string; libelle: string; type: string; gere: boolean }[];
  peutCreer: boolean;
  objectifs: Objectif[];
}

export interface ActiviteDisponible {
  id: string;
  libelle: string;
  objectif: string;
  unite: string;
  dateFin: string;
}

export type StatutInstruction = 'EMISE' | 'RECUE' | 'PRISE_EN_COMPTE' | 'EXECUTEE' | 'REJETEE';
export const LIBELLE_STATUT_INSTRUCTION: Record<StatutInstruction, string> = {
  EMISE: 'Émise',
  RECUE: 'Reçue',
  PRISE_EN_COMPTE: 'Prise en compte',
  EXECUTEE: 'Exécutée',
  REJETEE: 'Rejetée',
};

export interface Instruction {
  id: string;
  objet: string;
  texte: string;
  emetteur: Personne;
  destinataire: Personne;
  agentConcerne: Personne | null;
  echeance: string | null;
  statut: StatutInstruction;
  emiseLe: string;
  recueLe: string | null;
  priseEnCompteLe: string | null;
  executeeLe: string | null;
  rejeteeLe: string | null;
  motifRejet: string | null;
  compteRendu: string | null;
  acteId: string | null;
  enRetard: boolean;
  droits: { prendreEnCompte: boolean; executer: boolean; rejeter: boolean; acteRequis: boolean };
  /** Fiche seulement : actes signés proposés pour l'exécution d'une instruction RH. */
  actesPossibles?: { id: string; libelle: string }[];
}

export interface ListeInstructions {
  peutEmettre: boolean;
  personnesPossibles: Personne[];
  emises: Instruction[];
  recues: Instruction[];
  meConcernant: Instruction[];
}

export interface FilResume {
  id: string;
  objet: string;
  dernierMessageLe: string;
  participants: Personne[];
  dernier: { auteur: string; extrait: string } | null;
  nonLus: number;
}

export type TypeObjet = 'TACHE' | 'DOCUMENT' | 'REUNION' | 'ARRIVEE' | 'ACTE';
export const LIBELLE_TYPE_OBJET: Record<TypeObjet, string> = {
  TACHE: 'Tâche',
  DOCUMENT: 'Document',
  REUNION: 'Réunion',
  ARRIVEE: 'Courrier arrivé',
  ACTE: 'Acte',
};

export interface MessageFil {
  id: string;
  corps: string;
  createdAt: string;
  auteur: Personne;
  lien: {
    type: TypeObjet;
    accessible: boolean;
    id?: string;
    libelle?: string;
    lien?: string;
  } | null;
  lectures: (Personne & { luLe: string | null })[];
}

export interface Fil {
  id: string;
  objet: string;
  createdAt: string;
  participants: Personne[];
  messages: MessageFil[];
}

export interface ResultatRecherche {
  id: string;
  libelle: string;
  detail: string | null;
  lien: string;
}

export interface Recherche {
  q: string;
  categories: { cle: string; libelle: string; resultats: ResultatRecherche[]; autres: boolean }[];
}

export interface PreferencesNotification {
  resumeQuotidien: boolean;
  heureResume: number;
  enAttente: number;
}
