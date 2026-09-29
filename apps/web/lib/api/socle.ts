import { apiFetch } from './client';
import type {
  AgentDetail,
  AgentSansCompte,
  EvenementUnite,
  ListeAttributions,
  Organigramme,
  PageAgents,
  PointsDeReprise,
  TypeUnite,
} from '../socle/types';

/** Socle NIMBA (lot N1) — routes /api/v1. */
const V1 = '/api/v1';

const json = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

// Organigramme
export const getOrganigramme = () => apiFetch<Organigramme>(`${V1}/organigramme`);
export const getHistoriqueUnite = (id: string) => apiFetch<EvenementUnite[]>(`${V1}/unites/${id}/historique`);
export const creerUnite = (input: { type: TypeUnite; parentId: string; code: string; libelle: string }) =>
  apiFetch(`${V1}/unites`, json('POST', input));
export const modifierUnite = (id: string, input: { code?: string; libelle?: string; type?: TypeUnite }) =>
  apiFetch(`${V1}/unites/${id}`, json('PATCH', input));
export const fermerUnite = (id: string, input: { motif: string; dateEffet?: string }) =>
  apiFetch(`${V1}/unites/${id}/fermeture`, json('POST', input));

// Agents
export function listerAgents(f: Record<string, string | number | undefined>): Promise<PageAgents> {
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  return apiFetch<PageAgents>(`${V1}/agents?${q.toString()}`);
}
export const listerAgentsSansCompte = () =>
  apiFetch<{ donnees: AgentSansCompte[] }>(`${V1}/agents?sansCompte=true&taille=500`).then((r) => r.donnees);
export const getAgent = (id: string) => apiFetch<AgentDetail>(`${V1}/agents/${id}`);
export const getPointsDeReprise = () => apiFetch<PointsDeReprise>(`${V1}/agents/reprise`);
export const creerAgent = (input: Record<string, string | undefined>) => apiFetch(`${V1}/agents`, json('POST', input));
export const modifierAgent = (id: string, input: Record<string, string | undefined>) => apiFetch<AgentDetail>(`${V1}/agents/${id}`, json('PATCH', input));
export const suspendreAgent = (id: string, motif: string) => apiFetch<AgentDetail>(`${V1}/agents/${id}/suspension`, json('POST', { motif }));
export const reactiverAgent = (id: string, motif: string, nouvelleDateFin?: string) =>
  apiFetch<AgentDetail>(`${V1}/agents/${id}/reactivation`, json('POST', { motif, ...(nouvelleDateFin ? { nouvelleDateFin } : {}) }));
export const departAgent = (id: string, dateDepart: string, motif: string) => apiFetch<AgentDetail>(`${V1}/agents/${id}/depart`, json('POST', { dateDepart, motif }));
export const prolongerAgent = (id: string, nouvelleDateFin: string, motif: string) =>
  apiFetch<AgentDetail>(`${V1}/agents/${id}/prolongation`, json('POST', { nouvelleDateFin, motif }));
export const confirmerFinAgent = (id: string) => apiFetch<AgentDetail>(`${V1}/agents/${id}/confirmation-fin`, json('POST'));

// Rôles fonctionnels
export const listerAttributions = (f: { userId?: string; role?: string; actives?: 'true' } = {}) => {
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => !!v) as [string, string][]);
  return apiFetch<ListeAttributions>(`${V1}/attributions-roles?${q.toString()}`);
};
export const candidatsRoles = () =>
  apiFetch<{ id: string; firstName: string; lastName: string; role: string }[]>(`${V1}/attributions-roles/candidats`);
export const attribuerRole = (input: { userId: string; role: string; dateDebut?: string; dateFin?: string; motif?: string }) =>
  apiFetch(`${V1}/attributions-roles`, json('POST', input));
export const retirerRole = (id: string, motif: string) => apiFetch(`${V1}/attributions-roles/${id}/retrait`, json('POST', { motif }));
