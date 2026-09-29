import { apiFetch } from './client';
import type { ListeParametres, PageAudit, Supervision, VerificationAudit } from '../securite/types';

export const listerParametres = () => apiFetch<ListeParametres>('/api/v1/parametres');
export const modifierParametre = (cle: string, valeur: number) =>
  apiFetch<ListeParametres>(`/api/v1/parametres/${encodeURIComponent(cle)}`, { method: 'PATCH', body: JSON.stringify({ valeur }) });
export const getSupervision = () => apiFetch<Supervision>('/api/v1/supervision');
export const declarerTestRestauration = (t: { date: string; resultat: 'REUSSI' | 'ECHEC'; commentaire?: string }) =>
  apiFetch<ListeParametres>('/api/v1/supervision/test-restauration', { method: 'POST', body: JSON.stringify(t) });
export const lireJournalAudit = (f: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') q.set(k, String(v));
  return apiFetch<PageAudit>(`/api/v1/journal-audit?${q.toString()}`);
};
export const verifierJournalAudit = () => apiFetch<VerificationAudit>('/api/v1/journal-audit/verification');
