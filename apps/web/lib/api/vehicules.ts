import { apiFetch } from './client';
import type { EtatVehicule, ParcVehicules, Vehicule, VehiculeDetail } from '../logistique/vehicules';

const j = (method: string, body?: unknown) => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const getParcVehicules = () => apiFetch<ParcVehicules>('/api/v1/vehicules');
export const getVehicule = (id: string) => apiFetch<VehiculeDetail>(`/api/v1/vehicules/${id}`);
export const creerVehicule = (v: { immatriculation: string; marque: string; modele: string; energie: string; kilometrage: number }) =>
  apiFetch<Vehicule>('/api/v1/vehicules', j('POST', v));
export const modifierVehicule = (id: string, v: { etat?: EtatVehicule; actif?: boolean }) => apiFetch<Vehicule>(`/api/v1/vehicules/${id}`, j('PATCH', v));
export const ajouterPlein = (id: string, v: { date: string; litres: number; kilometrage: number; ordreMissionId?: string }) =>
  apiFetch(`/api/v1/vehicules/${id}/pleins`, j('POST', v));
export const affecterVehicule = (ordreId: string, vehiculeId: string | null) =>
  apiFetch(`/api/v1/vehicules/missions/${ordreId}/vehicule`, j('POST', { vehiculeId }));
export const retourMission = (ordreId: string, kilometrageRetour: number) =>
  apiFetch<{ ok: boolean; distance: number }>(`/api/v1/vehicules/missions/${ordreId}/retour`, j('POST', { kilometrageRetour }));
