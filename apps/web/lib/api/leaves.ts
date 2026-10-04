import { apiFetch, telechargerFichier } from './client';
import type { CalendrierFeries, ContexteConge, CreateLeaveRequestInput, JourFerie, LeaveBalanceView, LeaveRequest, LeaveType } from '../leaves/types';

export function getLeaveTypes(): Promise<LeaveType[]> {
  return apiFetch<LeaveType[]>('/leave-types');
}

export function getLeaveRequests(): Promise<LeaveRequest[]> {
  return apiFetch<LeaveRequest[]>('/leaves');
}

export function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>('/leaves', { method: 'POST', body: JSON.stringify(input) });
}

export function donnerAvisConge(id: string, avis: 'FAVORABLE' | 'DEFAVORABLE', motif?: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/avis`, { method: 'POST', body: JSON.stringify({ avis, ...(motif ? { motif } : {}) }) });
}

export function getLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}`);
}

export function approveLeaveRequest(id: string, comment?: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/approve`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function rejectLeaveRequest(id: string, comment: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/leaves/${id}/cancel`, { method: 'POST' });
}

/** Contexte d'une demande (absents de l'équipe, tâches pendant l'absence, solde annuel, chef attendu). */
export function getContexteConge(id: string): Promise<ContexteConge> {
  return apiFetch<ContexteConge>(`/api/v1/conges/${id}/contexte`);
}

export function getMyBalances(): Promise<LeaveBalanceView[]> {
  return apiFetch<LeaveBalanceView[]>('/leaves/balances/me');
}

export function getBalancesForUser(userId: string): Promise<LeaveBalanceView[]> {
  return apiFetch<LeaveBalanceView[]>(`/leaves/balances/${userId}`);
}

/** Certificat médical d'un congé maladie (socle N3) : l'agent le dépose ; lui et le DRH le lisent. */
export function deposerCertificat(id: string, file: File): Promise<LeaveRequest> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<LeaveRequest>(`/leaves/${id}/certificat`, { method: 'POST', body: form });
}

export function telechargerCertificat(id: string): Promise<void> {
  return telechargerFichier(`/leaves/${id}/certificat`, null);
}

// Calendrier des jours fériés (socle N3)
export const getJoursFeries = (annee: number) => apiFetch<CalendrierFeries>(`/api/v1/jours-feries?annee=${annee}`);
export const creerJourFerie = (input: { date: string; libelle: string; nature: 'FIXE' | 'RELIGIEUX' }) =>
  apiFetch<JourFerie>('/api/v1/jours-feries', { method: 'POST', body: JSON.stringify(input) });
export const modifierJourFerie = (id: string, input: Partial<{ date: string; libelle: string; nature: 'FIXE' | 'RELIGIEUX' }>) =>
  apiFetch<JourFerie>(`/api/v1/jours-feries/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const supprimerJourFerie = (id: string) => apiFetch<{ supprime: boolean }>(`/api/v1/jours-feries/${id}`, { method: 'DELETE' });
export const reprendreFetesFixes = (annee: number) =>
  apiFetch<CalendrierFeries>('/api/v1/jours-feries/fetes-fixes', { method: 'POST', body: JSON.stringify({ annee }) });
