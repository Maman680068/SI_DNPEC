import { apiFetch } from './client';
import type { NotificationItem } from '../notifications/types';

// Notifications de la personne connectée (jamais celles d'un titulaire
// pendant un intérim : l'API répond sur l'identité réelle).

export function getNotifications(): Promise<NotificationItem[]> {
  return apiFetch<NotificationItem[]>('/notifications');
}

export function getNombreNonLues(): Promise<number> {
  return apiFetch<number>('/notifications/unread-count');
}

export function marquerLue(id: string): Promise<unknown> {
  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function marquerToutLu(): Promise<unknown> {
  return apiFetch('/notifications/read-all', { method: 'PATCH' });
}
