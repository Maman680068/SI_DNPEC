import type { SystemRole } from '../auth/types';
import type { TaskStatus } from '../tasks/types';

export type MeetingStatus = 'PLANIFIEE' | 'ANNULEE';
export type MeetingResponseStatus = 'EN_ATTENTE' | 'CONFIRME' | 'DECLINE';

export interface MeetingParticipant {
  id: string;
  userId: string;
  responseStatus: MeetingResponseStatus;
  respondedAt: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  agenda: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  status: MeetingStatus;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** Compte rendu (texte libre, organisateur) et réunion déclarée ouverte (D2). */
  minutesText?: string | null;
  isOpen?: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  participants: MeetingParticipant[];
  // D9 — salle réservée avec la réunion (statut : éviction pour priorité, refus...).
  reservation: { id: string; statut: 'EN_ATTENTE' | 'CONFIRMEE' | 'REFUSEE' | 'ANNULEE' | 'ANNULEE_PRIORITE'; ressource: { id: string; nom: string } } | null;
  // S1 — réunion issue d'une demande validée (« Validée par … »).
  demandeReunion?: { id: string; decidePar: { firstName: string; lastName: string } | null } | null;
}

export interface CreateMeetingInput {
  title: string;
  agenda?: string;
  location?: string;
  startAt: string;
  endAt?: string;
  participantIds: string[];
  /** S1 — création avec une demande acceptée (date et participants imposés par l’API). */
  demandeReunionId?: string;
  ressourceId?: string;
  prioritaire?: boolean;
}

export const RESPONSE_STATUS_LABEL: Record<MeetingResponseStatus, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  DECLINE: 'Décliné',
};

// ---- Décisions de réunion (D2) -------------------------------------------

export type DecisionStatus = 'EN_ATTENTE' | 'CLOTUREE';

/** Actions permises à l'utilisateur, calculées par l'API (l'écran n'en déduit aucune). */
export interface DecisionDroits {
  modifier: boolean;
  convertir: boolean;
  cloturer: boolean;
  relancer: boolean;
}

export interface Decision {
  id: string;
  meetingId: string;
  content: string;
  status: DecisionStatus;
  closedAt: string | null;
  closedById: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  action: { id: string; title: string; status: TaskStatus; dueDate: string | null } | null;
  droits: DecisionDroits;
}

export interface DecisionsReleve {
  peutAjouter: boolean;
  decisions: Decision[];
}

export interface ResponsablePossible {
  id: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  jobTitle: string | null;
}

export interface ConvertDecisionInput {
  title?: string;
  assigneeId: string;
  dueDate: string;
}

/** « Décisions à suivre » de la page Réunions (GET api/v1/decisions/a-suivre). */
export interface DecisionASuivre extends Omit<Decision, 'droits'> {
  meeting: { id: string; title: string; startAt: string };
  enRetard: boolean;
}

export interface DecisionsASuivre {
  enRetard: number;
  decisions: DecisionASuivre[];
}

// ---- Demandes de réunion (S1) ----------------------------------------------

export type EtatDemandeReunion = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'UTILISEE' | 'EXPIREE';
export const LIBELLE_ETAT_DEMANDE: Record<EtatDemandeReunion, string> = {
  EN_ATTENTE: 'En attente de décision',
  ACCEPTEE: 'Acceptée : à créer',
  REFUSEE: 'Refusée',
  UTILISEE: 'Réunion créée',
  EXPIREE: 'Expirée',
};
export const LIBELLE_ETAPE_DEMANDE: Record<string, string> = {
  DEMANDEE: 'Demandée',
  TRANSMISE: 'Transmise',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  REUNION_CREEE: 'Réunion créée',
};
export interface DemandeReunion {
  id: string;
  objet: string;
  explication: string;
  debut: string;
  fin: string;
  demandeur: { id: string; nom: string };
  participants: { id: string; nom: string }[];
  unites: { id: string; code: string; libelle: string }[];
  etat: EtatDemandeReunion;
  decideurs: string[];
  decidePar: string | null;
  decideeLe: string | null;
  motifRefus: string | null;
  reunionId: string | null;
  etapes: { action: string; par: string | null; vers: string[]; motif: string | null; le: string }[];
  droits: { accepter: boolean; refuser: boolean; transmettre: boolean; creerReunion: boolean };
}
export interface DemandesReunion {
  miennes: DemandeReunion[];
  aDecider: DemandeReunion[];
  droits: DroitsReunions;
}
export interface DroitsReunions {
  creerReunion: boolean;
  demanderReunion: boolean;
}
export interface ParticipantsPossibles {
  personnes: { id: string; nom: string; fonction: string | null; unite: string | null }[];
  unites: { id: string; code: string; libelle: string; type: string; niveau: number; membres: string[] }[];
}
