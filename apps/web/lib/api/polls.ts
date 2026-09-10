import { apiFetch } from './client';
import type { CreatePollInput, Poll } from '../polls/types';

export function createPoll(input: CreatePollInput): Promise<Poll> {
  return apiFetch<Poll>('/polls', { method: 'POST', body: JSON.stringify(input) });
}

export function getPolls(): Promise<Poll[]> {
  return apiFetch<Poll[]>('/polls');
}

export function getPoll(id: string): Promise<Poll> {
  return apiFetch<Poll>(`/polls/${id}`);
}

export function votePoll(id: string, optionIds: string[]): Promise<Poll> {
  return apiFetch<Poll>(`/polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ optionIds }) });
}

export function closePoll(id: string): Promise<Poll> {
  return apiFetch<Poll>(`/polls/${id}/close`, { method: 'POST' });
}
