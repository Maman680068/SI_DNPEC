import { apiFetch } from './client';
import type { CreateSuggestionInput, Suggestion, UpdateSuggestionStatusInput } from '../suggestions/types';

export function createSuggestion(input: CreateSuggestionInput): Promise<Suggestion> {
  return apiFetch<Suggestion>('/suggestions', { method: 'POST', body: JSON.stringify(input) });
}

export function getMySuggestions(): Promise<Suggestion[]> {
  return apiFetch<Suggestion[]>('/suggestions/mine');
}

export function getAllSuggestions(): Promise<Suggestion[]> {
  return apiFetch<Suggestion[]>('/suggestions');
}

export function updateSuggestionStatus(id: string, input: UpdateSuggestionStatusInput): Promise<Suggestion> {
  return apiFetch<Suggestion>(`/suggestions/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) });
}
