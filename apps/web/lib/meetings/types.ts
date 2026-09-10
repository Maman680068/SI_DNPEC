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
