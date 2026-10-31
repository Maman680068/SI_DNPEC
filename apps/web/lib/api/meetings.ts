import { apiFetch } from './client';
import type {
  ConvertDecisionInput,
  DemandeReunion,
  DemandesReunion,
  DroitsReunions,
  ParticipantsPossibles,
  CreateMeetingInput,
  DecisionsASuivre,
  DecisionsReleve,
  Meeting,
  MeetingResponseStatus,
  ResponsablePossible,
} from '../meetings/types';

export function getMeetings(): Promise<Meeting[]> {
  return apiFetch<Meeting[]>('/meetings');
}

export function getMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/meetings/${id}`);
}

export function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  return apiFetch<Meeting>('/meetings', { method: 'POST', body: JSON.stringify(input) });
}

export function respondToMeeting(id: string, status: MeetingResponseStatus): Promise<Meeting> {
  return apiFetch<Meeting>(`/meetings/${id}/respond`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

/** Compte rendu et « réunion ouverte » (PATCH /meetings/:id, organisateur seulement). */
export function updateMeeting(id: string, input: { minutesText?: string; isOpen?: boolean }): Promise<Meeting> {
  return apiFetch<Meeting>(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function cancelMeeting(id: string, reason?: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/meetings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}

// ---- Décisions (D2) --------------------------------------------------------

export function getDecisions(meetingId: string): Promise<DecisionsReleve> {
  return apiFetch<DecisionsReleve>(`/meetings/${meetingId}/decisions`);
}

export function createDecision(meetingId: string, content: string): Promise<unknown> {
  return apiFetch(`/meetings/${meetingId}/decisions`, { method: 'POST', body: JSON.stringify({ content }) });
}

export function updateDecision(id: string, content: string): Promise<unknown> {
  return apiFetch(`/decisions/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) });
}

export function getResponsablesPossibles(id: string): Promise<ResponsablePossible[]> {
  return apiFetch<ResponsablePossible[]>(`/decisions/${id}/responsables-possibles`);
}

export function convertDecision(id: string, input: ConvertDecisionInput): Promise<unknown> {
  return apiFetch(`/decisions/${id}/convert-to-action`, { method: 'POST', body: JSON.stringify(input) });
}

export function closeDecision(id: string): Promise<unknown> {
  return apiFetch(`/decisions/${id}/close`, { method: 'POST' });
}

export function remindDecision(id: string): Promise<unknown> {
  return apiFetch(`/decisions/${id}/remind`, { method: 'POST' });
}

/** Décisions des réunions visibles, ouvertes (retards en tête) puis clôturées récemment. */
export function getDecisionsASuivre(): Promise<DecisionsASuivre> {
  return apiFetch<DecisionsASuivre>('/api/v1/decisions/a-suivre');
}

// ---- Demandes de réunion (S1) ------------------------------------------------

export const getDroitsReunions = () => apiFetch<DroitsReunions>('/api/v1/reunions/droits');
export const getParticipantsPossibles = () => apiFetch<ParticipantsPossibles>('/api/v1/reunions/participants-possibles');
export const getDemandesReunion = () => apiFetch<DemandesReunion>('/api/v1/demandes-reunion');
export const getDemandeReunion = (id: string) => apiFetch<DemandeReunion>(`/api/v1/demandes-reunion/${id}`);
export const demanderReunion = (v: { objet: string; explication: string; debut: string; fin: string; participantIds: string[]; uniteIds: string[] }) =>
  apiFetch<DemandeReunion>('/api/v1/demandes-reunion', { method: 'POST', body: JSON.stringify(v) });
export const accepterDemandeReunion = (id: string, v: { debut?: string; fin?: string; participantIds?: string[]; uniteIds?: string[] }) =>
  apiFetch<DemandeReunion>(`/api/v1/demandes-reunion/${id}/accepter`, { method: 'POST', body: JSON.stringify(v) });
export const refuserDemandeReunion = (id: string, motif: string) =>
  apiFetch<DemandeReunion>(`/api/v1/demandes-reunion/${id}/refuser`, { method: 'POST', body: JSON.stringify({ motif }) });
export const transmettreDemandeReunion = (id: string) => apiFetch<DemandeReunion>(`/api/v1/demandes-reunion/${id}/transmettre`, { method: 'POST' });
