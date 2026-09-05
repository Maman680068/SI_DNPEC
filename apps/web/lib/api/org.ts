import { apiFetch } from './client';
import type { BasicUserInfo, Division, Section, Cellule, OrgUser } from '../org/types';

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
 * voir CascadeService.getVisibleUserWhere côté API. Source des listes de sélection
 * (assignation, mention) : volontairement bornée à ce périmètre. */
export function getUsers(): Promise<OrgUser[]> {
  return apiFetch<OrgUser[]>('/users');
}

/** Résolution de noms hors périmètre cascade (GET /users/resolve) — pour l'affichage
 * uniquement (co-responsable, auteur de commentaire, mention), jamais pour peupler une
 * liste de sélection. Champs non sensibles uniquement (ni rôle, ni email, ni statut). */
export function resolveUsers(ids: string[]): Promise<BasicUserInfo[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return apiFetch<BasicUserInfo[]>(`/users/resolve?ids=${ids.map(encodeURIComponent).join(',')}`);
}
