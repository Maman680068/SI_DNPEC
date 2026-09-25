import { apiFetch } from './client';
import type {
  ConvertDecisionInput,
  CreateMeetingInput,
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
