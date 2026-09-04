import { apiFetch } from './client';
import type { Division, Section, Cellule, OrgUser } from '../org/types';

export function getDivisions(): Promise<Division[]> {
  return apiFetch<Division[]>('/org/divisions');
}

export function getSections(divisionId: string): Promise<Section[]> {
  return apiFetch<Section[]>(`/org/divisions/${divisionId}/sections`);
}

export function getCellules(): Promise<Cellule[]> {
  return apiFetch<Cellule[]>('/org/cellules');
}

/** Scopé par le périmètre cascade de l'acteur (ex. un Agent ne voit que lui-même) —
 * voir CascadeService.getVisibleUserWhere côté API. */
export function getUsers(): Promise<OrgUser[]> {
  return apiFetch<OrgUser[]>('/users');
}
