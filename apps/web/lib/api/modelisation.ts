import { apiFetch } from './client';
import type { AffectationsPersonne, FicheModele, ListeModeles, PersonneDesignable, RoleModelisation, VersionDetail } from '../modelisation/types';

const j = (body: unknown) => ({ body: JSON.stringify(body) });

export const getModeles = () => apiFetch<ListeModeles>('/api/v1/modeles');
export const getModele = (id: string) => apiFetch<FicheModele>(`/api/v1/modeles/${id}`);
export const getVersion = (id: string) => apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}`);

export function deposerPaquet(fichier: File, donneesConfirmees: boolean) {
  const fd = new FormData();
  fd.append('donneesConfirmees', donneesConfirmees ? 'true' : 'false');
  fd.append('paquet', fichier);
  return apiFetch<VersionDetail>('/api/v1/modeles/versions', { method: 'POST', body: fd });
}
export const relancerVerification = (id: string) => apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}/verification`, { method: 'POST' });
export const reglerVersion = (id: string, reglages: { manettes: { id: string; actif: boolean; min: number; max: number }[]; compteurs: { id: string; actif: boolean }[] }) =>
  apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}/reglages`, { method: 'PUT', ...j(reglages) });
export const envoyerVersion = (id: string) => apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}/envoi`, { method: 'POST' });
export const abandonnerVersion = (id: string, motif: string) => apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}/abandon`, { method: 'POST', ...j({ motif }) });
export const demanderDerogation = (id: string, controleId: string, motif: string) =>
  apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}/derogations`, { method: 'POST', ...j({ controleId, motif }) });
export const confirmerDerogation = (id: string, controleId: string) => apiFetch<VersionDetail>(`/api/v1/modeles/versions/${id}/derogations/${controleId}/confirmation`, { method: 'POST' });
export const approuverVersion = (id: string) => apiFetch<FicheModele>(`/api/v1/modeles/versions/${id}/approbation`, { method: 'POST' });
export const refuserVersion = (id: string, motif: string) => apiFetch<FicheModele>(`/api/v1/modeles/versions/${id}/refus`, { method: 'POST', ...j({ motif }) });

export const getAffectations = (userId: string) => apiFetch<AffectationsPersonne>(`/api/v1/modelisation/affectations?userId=${encodeURIComponent(userId)}`);
export const attribuerRole = (body: { userId: string; role: RoleModelisation; modeleId?: string; motif: string }) => apiFetch<{ id: string }>('/api/v1/modelisation/affectations', { method: 'POST', ...j(body) });
export const clorePersonneRole = (id: string, motif: string) => apiFetch<{ id: string }>(`/api/v1/modelisation/affectations/${id}/fin`, { method: 'POST', ...j({ motif }) });
export const getPersonnesDesignables = () => apiFetch<PersonneDesignable[]>('/api/v1/modelisation/personnes');
