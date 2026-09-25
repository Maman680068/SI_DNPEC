export type Nom = { id: string; firstName: string; lastName: string };

export type NatureCategorie = 'BIEN' | 'FOURNITURE';
export interface Categorie {
  id: string;
  code: string;
  libelle: string;
  nature: NatureCategorie;
  validationChefRequise: boolean;
  actif: boolean;
}

export interface Article {
  id: string;
  categorieId: string;
  categorie: { id: string; code: string; libelle: string; validationChefRequise: boolean };
  libelle: string;
  unite: string;
  suiviStock: boolean;
  stock: number | null;
  seuilAlerte: number | null;
  sousSeuil: boolean;
  actif: boolean;
}

export interface MouvementStock {
  id: string;
  type: 'ENTREE' | 'SORTIE';
  quantite: number;
  stockApres: number;
  motif: string | null;
  demandeId: string | null;
  createdAt: string;
  par: Nom;
}

export type EtatBien = 'EN_SERVICE' | 'EN_PANNE' | 'EN_REPARATION' | 'REFORME';
export const ETAT_LABEL: Record<EtatBien, string> = {
  EN_SERVICE: 'En service',
  EN_PANNE: 'En panne',
  EN_REPARATION: 'En réparation',
  REFORME: 'Réformé',
};

export interface Affectation {
  id: string;
  debut: string;
  fin: string | null;
  libelle: string;
  faitePar: Nom;
}

export interface Bien {
  id: string;
  numeroInventaire: string;
  categorie: { id: string; code: string; libelle: string };
  designation: string;
  marque: string | null;
  numeroSerie: string | null;
  emplacement: string | null;
  dateAcquisition: string | null;
  etat: EtatBien;
  createdAt: string;
  affectation: Affectation | null;
  droits: { modifier: boolean; affecter: boolean; retour: boolean; changerEtat: boolean; signalerPanne: boolean };
}

export type TypeMouvementBien = 'ACQUISITION' | 'AFFECTATION' | 'RETOUR' | 'CHANGEMENT_ETAT' | 'MODIFICATION' | 'INTERVENTION';
export interface FicheBien extends Bien {
  historique: { id: string; type: TypeMouvementBien; detail: Record<string, unknown>; createdAt: string; par: Nom }[];
  affectations: Affectation[];
}

export type TypeDemande = 'FOURNITURE' | 'MATERIEL' | 'INTERVENTION';
export const TYPE_DEMANDE_LABEL: Record<TypeDemande, string> = { FOURNITURE: 'Fournitures', MATERIEL: 'Matériel', INTERVENTION: 'Intervention' };
export type StatutDemande = 'A_VALIDER' | 'A_TRAITER' | 'EN_TRAITEMENT' | 'TRAITEE' | 'REFUSEE' | 'ANNULEE';

export interface Demande {
  id: string;
  type: TypeDemande;
  objet: string;
  justification: string | null;
  quantite: number | null;
  quantiteLivree: number | null;
  statut: StatutDemande;
  statutLibelle: string;
  validationChef: boolean;
  compteRendu: string | null;
  motifRefus: string | null;
  createdAt: string;
  valideeAt: string | null;
  priseEnChargeAt: string | null;
  traiteeAt: string | null;
  refuseeAt: string | null;
  demandeurId: string;
  demandeur: Nom;
  categorie: { id: string; code: string; libelle: string };
  article: { id: string; libelle: string; unite: string; suiviStock: boolean; stock: number | null } | null;
  bien: { id: string; numeroInventaire: string; designation: string } | null;
  valideePar: Nom | null;
  traiteePar: Nom | null;
  refuseePar: Nom | null;
  droits: { valider: boolean; refuser: boolean; prendreEnCharge: boolean; traiter: boolean; annuler: boolean };
}

export interface TableauLogistique {
  gestionnaire: boolean;
  aValider: number;
  aTraiter: number;
  stockBas: number;
  mesDemandesEnCours: number;
  reservationsAValider: number;
}

export type TypeRessource = 'SALLE' | 'MATERIEL_PRESENTATION';
export const TYPE_RESSOURCE_LABEL: Record<TypeRessource, string> = { SALLE: 'Salle', MATERIEL_PRESENTATION: 'Matériel de présentation' };
export type ModeReservation = 'IMMEDIATE' | 'VALIDATION';
export const MODE_LABEL: Record<ModeReservation, string> = { IMMEDIATE: 'Confirmation immédiate', VALIDATION: 'Validation du gestionnaire' };

export interface Ressource {
  id: string;
  nom: string;
  type: TypeRessource;
  description: string | null;
  capacite: number | null;
  mode: ModeReservation;
  actif: boolean;
  droits?: { modifier: boolean };
}

export interface Conflit {
  id: string;
  debut: string;
  fin: string;
  statut: StatutReservation;
  titulaire: Nom;
  objet: string | null;
  evincable: boolean;
}

export interface Disponibilite extends Ressource {
  libre: boolean;
  conflits: Conflit[];
  prioritePossible: boolean;
}

export type StatutReservation = 'EN_ATTENTE' | 'CONFIRMEE' | 'REFUSEE' | 'ANNULEE' | 'ANNULEE_PRIORITE';
export const STATUT_RESERVATION_LABEL: Record<StatutReservation, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
  ANNULEE_PRIORITE: 'Annulée pour priorité',
};

export interface Reservation {
  id: string;
  ressource: { id: string; nom: string; type: TypeRessource; mode: ModeReservation };
  titulaireId: string;
  titulaire: Nom;
  creeePar: Nom;
  debut: string;
  fin: string;
  objet: string | null;
  meetingId: string | null;
  meeting: { id: string; title: string } | null;
  statut: StatutReservation;
  prioritaire: boolean;
  decideePar: Nom | null;
  motifRefus: string | null;
  annuleePar: Nom | null;
  motifAnnulation: string | null;
  evinceePar: Nom | null;
  createdAt: string;
  estTitulaire: boolean;
  droits: { annuler: boolean; valider: boolean; refuser: boolean };
}

export interface Habilitation {
  id: string;
  createdAt: string;
  revoqueeAt: string | null;
  user: Nom & { email: string; role: string; status: string };
  accordeePar: Nom;
  revoqueePar: Nom | null;
}
