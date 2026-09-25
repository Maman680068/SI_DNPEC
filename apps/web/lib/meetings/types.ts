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
  createdById: string;
  createdAt: string;
  updatedAt: string;
  participants: MeetingParticipant[];
}

export interface CreateMeetingInput {
  title: string;
  agenda?: string;
  location?: string;
  startAt: string;
  endAt?: string;
  participantIds: string[];
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
