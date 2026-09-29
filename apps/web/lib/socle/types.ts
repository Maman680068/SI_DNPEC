/** Socle NIMBA (lot N1) — types renvoyés par /api/v1 (organigramme, agents, rôles fonctionnels). */

export type TypeUnite = 'DIRECTION' | 'DIVISION' | 'SECTION' | 'CELLULE' | 'INSTANCE';
export type StatutAgent = 'EN_ACTIVITE' | 'SUSPENDU' | 'PARTI';
export type ActionAgent = 'MODIFIER' | 'SUSPENDRE' | 'REACTIVER' | 'DEPART' | 'PROLONGER' | 'CONFIRMER_FIN';

export interface Personne {
  id: string;
  firstName: string;
  lastName: string;
}

export interface UniteOrganigramme {
  id: string;
  code: string;
  libelle: string;
  type: TypeUnite;
  libelleType: string;
  parentId: string | null;
  dateCreation: string;
  dateFermeture: string | null;
  motifFermeture: string | null;
  responsable: (Personne & { jobTitle: string | null }) | null;
  suppleant: (Personne & { jusquau: string }) | null;
  suspendue: boolean;
  fermee: boolean;
  effectif: number;
  droits: {
    peutModifier: boolean;
    peutFermer: boolean;
    fermetureBloquee: string | null;
    typesEnfants: { type: TypeUnite; libelle: string }[];
    typesPossibles: { type: TypeUnite; libelle: string }[];
  };
}

export interface Organigramme {
  droits: { peutGerer: boolean };
  types: { type: TypeUnite; libelle: string }[];
  unites: UniteOrganigramme[];
}

export interface EvenementUnite {
  id: string;
  evenement: string;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  dateEffet: string;
  auteur: Personne | null;
}

export interface UniteCourte {
  id: string;
  code: string;
  libelle: string;
  type: TypeUnite;
  dateFermeture: string | null;
}

export interface Agent {
  id: string;
  matricule: string;
  matriculeProvisoire: boolean;
  nom: string;
  prenoms: string;
  genre: string | null;
  fonction: string | null;
  statut: StatutAgent;
  libelleStatut: string;
  dateFinPrevue: string | null;
  natureFinPrevue: 'STAGE' | 'CONTRAT' | null;
  finConfirmeeAt: string | null;
  dateDepart: string | null;
  motifDepart: string | null;
  joursAvantFin: number | null;
  finProche: boolean;
  unite: UniteCourte | null;
  compte: { id: string; email: string; status: string; role: string } | null;
  actions: ActionAgent[];
}

export interface MouvementAgent {
  id: string;
  type: string;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  motif: string | null;
  dateEffet: string;
  auteur: Personne | null;
}

export interface AgentDetail extends Agent {
  cheminUnite: string[];
  mouvements: MouvementAgent[];
}

export interface PageAgents {
  droits: { peutCreer: boolean; peutGerer: boolean };
  donnees: Agent[];
  page: number;
  taille: number;
  total: number;
}

export interface AgentSansCompte {
  id: string;
  matricule: string;
  nom: string;
  prenoms: string;
  fonction: string | null;
  unite: UniteCourte | null;
}

export interface PointsDeReprise {
  matriculesProvisoires: number;
  unitesSansResponsable: { id: string; code: string; libelle: string; type: TypeUnite }[];
  chefsEnDouble: number;
  agentsDansUniteSuspendue: number;
  stagiairesSansDateDeFin: number;
}

export interface Attribution {
  id: string;
  role: string;
  libelle: string;
  registreId: string | null;
  uniteKey: string | null;
  dateDebut: string;
  dateFin: string | null;
  motif: string | null;
  retireLe: string | null;
  motifRetrait: string | null;
  active: boolean;
  gereeParModule: boolean;
  peutRetirer: boolean;
  user: Personne & { email: string; role: string; status: string };
  attribuePar: Personne | null;
  retirePar: Personne | null;
}

export interface ListeAttributions {
  droits: { peutAttribuer: boolean };
  rolesAttribuables: { role: string; libelle: string }[];
  attributions: Attribution[];
}

/** Libellés des mouvements d'un agent (historique). */
export const LIBELLE_MOUVEMENT: Record<string, string> = {
  ENTREE: 'Entrée',
  COMPTE: 'Compte rattaché',
  MUTATION: 'Changement d’unité',
  SUSPENSION: 'Suspension',
  REACTIVATION: 'Retour en activité',
  DEPART: 'Départ',
  PROLONGATION: 'Prolongation',
  FIN_CONFIRMEE: 'Fin confirmée par le DRH',
  MATRICULE: 'Matricule',
  IDENTITE: 'Identité',
};

export const LIBELLE_EVENEMENT_UNITE: Record<string, string> = {
  CREATION: 'Création',
  MODIFICATION: 'Modification',
  RESPONSABLE: 'Responsable',
  FERMETURE: 'Fermeture',
  REPRISE_INITIALE: 'Reprise initiale des rôles (N1)',
};
