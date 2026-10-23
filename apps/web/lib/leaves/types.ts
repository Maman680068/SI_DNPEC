export type LeaveRequestStatus = 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE' | 'ANNULEE';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  // null quand ce type de congé précis a été masqué (exception "besoin d'en
  // connaître" des congés maladie pour DN/DNA sans autorité directe la plus
  // proche — voir apps/api LeaveMedicalPrivacyService).
  leaveTypeId: string | null;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approverId: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  leaveType: { code: string | null; name: string };
  user: { id: string; firstName: string; lastName: string; divisionId: string | null; sectionId: string | null; celluleId: string | null };
  /** Circuit A6.1 (socle N3) : avis du chef d'unité, puis décision du DRH. */
  etape: EtapeConge;
  avisEtat: 'FAVORABLE' | 'DEFAVORABLE' | 'TACITE' | null;
  avisMotif: string | null;
  avisLe: string | null;
  avisEcheance: string | null;
  avisPar: { id: string; nom: string } | null;
  /** Motif médical (demandeur, chef qui donne l'avis, DRH), visible après réauthentification. */
  motifVerrouille: boolean;
  /** Certificat médical : demandeur et DRH seulement. */
  certificat: { nom: string; deposeLe: string } | null;
  droits: { peutDonnerAvis: boolean; peutDecider: boolean; peutAnnuler: boolean; deposerCertificat?: boolean; lireCertificat?: boolean };
  /** Demande en attente au-delà du solde restant de son type (calculé par l'API ; null si non renseigné pour ce lecteur). */
  soldeInsuffisant?: boolean | null;
  soldeRestant?: number | null;
}

export interface JourFerie {
  id: string;
  date: string;
  libelle: string;
  nature: 'FIXE' | 'RELIGIEUX';
}

export interface CalendrierFeries {
  annee: number;
  jours: JourFerie[];
  fixesManquantes: { date: string; libelle: string }[];
  religieusesSaisies: boolean;
  droits: { gerer: boolean };
}

export type EtapeConge = 'AVIS_ATTENDU' | 'DECISION_ATTENDUE' | 'APPROUVEE' | 'REFUSEE' | 'ANNULEE';

export const LIBELLE_ETAPE: Record<EtapeConge, string> = {
  AVIS_ATTENDU: 'Avis du chef attendu',
  DECISION_ATTENDUE: 'Décision du DRH attendue',
  APPROUVEE: 'Approuvée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export const LIBELLE_AVIS: Record<'FAVORABLE' | 'DEFAVORABLE' | 'TACITE', string> = {
  FAVORABLE: 'Avis favorable',
  DEFAVORABLE: 'Avis défavorable',
  TACITE: 'Avis réputé favorable (délai dépassé)',
};

export interface LeaveBalanceView {
  id: string;
  // null/generic quand masqué — voir LeaveRequest.leaveTypeId.
  leaveTypeId: string | null;
  leaveTypeCode: string | null;
  leaveTypeName: string;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

/** GET api/v1/conges/simulation : bandeau du formulaire de demande (calculé par l'API). */
export interface SimulationConge {
  leaveType: { id: string; name: string };
  jours: number;
  feries: { date: string; libelle: string }[];
  reprise: string;
  solde: { annee: number; avant: number; apres: number } | null;
  avisants: { id: string; nom: string }[];
  delaiAvisHeures: number;
}

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export const STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  EN_ATTENTE: 'En attente',
  APPROUVEE: 'Approuvée',
  REJETEE: 'Rejetée',
  ANNULEE: 'Annulée',
};

export const LEADERSHIP_ROLES_FOR_LEAVES = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

/** Contexte de la fenêtre d'avis ou de décision (GET api/v1/conges/:id/contexte) : absents et tâches
 * nuls pour le demandeur ; solde de congé annuel seul. */
export interface ContexteConge {
  demandeId: string;
  avisants: { id: string; nom: string }[];
  feriesDansPeriode: number;
  soldeAnnuel: { annee: number; libelle: string; totalDays: number; usedDays: number; remainingDays: number } | null;
  absents: { demandeId: string; userId: string; nom: string; type: string; debut: string; fin: string }[] | null;
  taches: { id: string; titre: string; echeance: string | null; statut: string }[] | null;
}

/** Codes de types de congé reconnus par l'écran (anneau du congé annuel, absences maladie de l'agent). */
export const CODE_CONGE_ANNUEL = 'CONGE_ANNUEL';
export const CODE_CONGE_MALADIE = 'CONGE_MALADIE';
