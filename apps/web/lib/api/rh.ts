import { apiFetch, telechargerFichier } from './client';
import type {
  AlerteRh,
  Effectifs,
  Familles,
  Fiches,
  FichePoste,
  ListeMouvements,
  ListePieces,
  Mouvement,
  PlanFormation,
  PlanSessions,
  SessionFormation,
  TypeMouvement,
} from '../rh/types';

const j = (method: string, body?: unknown) => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const getEffectifs = () => apiFetch<Effectifs>('/api/v1/rh/effectifs');
export const exporterEffectifs = () => telechargerFichier('/api/v1/rh/effectifs/export.xlsx', null);
export const getAlertesRh = () => apiFetch<AlerteRh[]>('/api/v1/rh/alertes');
export const getPiecesRequises = () => apiFetch<ListePieces>('/api/v1/rh/pieces-requises');
export const creerPieceRequise = (libelle: string) => apiFetch('/api/v1/rh/pieces-requises', j('POST', { libelle }));
export const modifierPieceRequise = (id: string, v: { libelle?: string; actif?: boolean }) =>
  apiFetch(`/api/v1/rh/pieces-requises/${id}`, j('PATCH', v));

export const getFamillesActes = () => apiFetch<Familles>('/api/v1/rh/familles-actes');
export const choisirRegistreFamille = (code: string, registreId: string | null) =>
  apiFetch<Familles>(`/api/v1/rh/familles-actes/${code}`, j('PATCH', { registreId }));

export const getMouvements = (userId?: string, filtres?: { annee?: number; type?: string }) =>
  apiFetch<ListeMouvements>(`/api/v1/rh/mouvements?${new URLSearchParams(Object.entries({ userId: userId ?? '', annee: filtres?.annee ? String(filtres.annee) : '', type: filtres?.type ?? '' }).filter(([, v]) => v)).toString()}`);
export const registreAttenduFamille = (code: string) => apiFetch<Familles>(`/api/v1/rh/familles-actes/${code}/registre-attendu`, j('POST'));
export const configurerFamillesActes = () => apiFetch<Familles>('/api/v1/rh/familles-actes/configurer', j('POST'));
export const preparerMouvement = (v: { userId: string; type: TypeMouvement; dateEffet: string; motif?: string; apres: Record<string, string | null> }) =>
  apiFetch<Mouvement>('/api/v1/rh/mouvements', j('POST', v));
export const preparerActeMouvement = (id: string) => apiFetch<{ acteId: string }>(`/api/v1/rh/mouvements/${id}/acte`, j('POST'));
export const annulerMouvement = (id: string) => apiFetch(`/api/v1/rh/mouvements/${id}/annulation`, j('POST'));

export const getFichesPoste = () => apiFetch<Fiches>('/api/v1/rh/fiches-poste');
export const enregistrerFichePoste = (v: { fonction: string; missions: string; activites?: string; competences?: string }, id?: string) =>
  apiFetch<FichePoste>(id ? `/api/v1/rh/fiches-poste/${id}` : '/api/v1/rh/fiches-poste', j(id ? 'PATCH' : 'POST', v));

export const getPlanFormation = (annee: number) => apiFetch<PlanFormation>(`/api/v1/rh/formation?annee=${annee}`);
export const exprimerBesoin = (v: { annee: number; intitule: string; priorite: string; origine: string; effectif?: number }) =>
  apiFetch('/api/v1/rh/formation', j('POST', v));
export const statutBesoin = (id: string, statut: string) => apiFetch(`/api/v1/rh/formation/${id}/statut`, j('PATCH', { statut }));
export const getOngletsRh = () =>
  apiFetch<{ effectifs: boolean; alertes: boolean; carriere: boolean; familles: boolean; fiches: boolean; formation: boolean; pieces: boolean }>('/api/v1/rh');

// Plan de formation individuel (sessions par agent).
export const getSessionsFormation = () => apiFetch<PlanSessions>('/api/v1/rh/formations');
export const creerSessionFormation = (v: { intitule: string; agentId: string; besoinId?: string; dateDebut: string; dateFin?: string; dureeJours?: number; organisme?: string; planifier?: boolean }) =>
  apiFetch<SessionFormation>('/api/v1/rh/formations', j('POST', v));
export const etatSessionFormation = (id: string, action: 'planifier' | 'suivie' | 'annuler') => apiFetch<SessionFormation>(`/api/v1/rh/formations/${id}/${action}`, j('POST'));
export const getMesFormations = () => apiFetch<SessionFormation[]>('/api/v1/profil/formations');
