import { apiFetch } from './client';
import type { CreateMeetingInput, Meeting, MeetingResponseStatus } from '../meetings/types';

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
