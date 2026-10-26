import { apiFetch } from './client';
import type { CreateSuppleanceInput, Suppleance, SuppleanceParty } from '../suppleances/types';

// Toujours en son nom propre (skipInterim) : ces écrans décrivent les
// suppléances de la personne connectée, jamais celles du titulaire dont elle
// assure éventuellement l'intérim dans cet onglet.

export function getMySuppleances(): Promise<Suppleance[]> {
  return apiFetch<Suppleance[]>('/suppleances/mine', { skipInterim: true });
}

export function getManageableTitulaires(): Promise<SuppleanceParty[]> {
  return apiFetch<SuppleanceParty[]>('/suppleances/titulaires', { skipInterim: true });
}

export function getSuppleanceCandidates(titulaireId: string): Promise<SuppleanceParty[]> {
  return apiFetch<SuppleanceParty[]>(`/suppleances/candidats?titulaireId=${encodeURIComponent(titulaireId)}`, {
    skipInterim: true,
  });
}

export function createSuppleance(input: CreateSuppleanceInput): Promise<Suppleance> {
  return apiFetch<Suppleance>('/suppleances', { method: 'POST', body: JSON.stringify(input), skipInterim: true });
}

export function revokeSuppleance(id: string): Promise<Suppleance> {
  return apiFetch<Suppleance>(`/suppleances/${id}/revoke`, { method: 'POST', skipInterim: true });
}

/** Vue d'ensemble « Toutes les suppléances en cours » (DN, DNA, administrateur ; identité réelle). */
export interface SuppleanceEnCours {
  id: string;
  unite: string;
  titulaire: string;
  suppleant: string;
  debut: string;
  fin: string;
  statut: 'EN_COURS' | 'NON_CONFORME';
}
export function getDroitsSuppleances(): Promise<{ voirToutes: boolean }> {
  return apiFetch<{ voirToutes: boolean }>('/suppleances/droits', { skipInterim: true });
}
export function getSuppleancesEnCours(): Promise<SuppleanceEnCours[]> {
  return apiFetch<SuppleanceEnCours[]>('/suppleances/en-cours', { skipInterim: true });
}
