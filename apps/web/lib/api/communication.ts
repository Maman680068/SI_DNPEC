import { apiFetch } from './client';
import type {
  Announcement,
  AnnouncementReadReceipt,
  ContexteConversation,
  Conversation,
  CreateAnnouncementInput,
  DirectMessage,
} from '../communication/types';

export function sendMessage(recipientId: string, body: string): Promise<DirectMessage> {
  return apiFetch<DirectMessage>('/messages', { method: 'POST', body: JSON.stringify({ recipientId, body }) });
}

export function getConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/messages/conversations');
}

export function getMessagesWith(userId: string): Promise<DirectMessage[]> {
  return apiFetch<DirectMessage[]>(`/messages/with/${userId}`);
}

export function markMessageRead(id: string): Promise<void> {
  return apiFetch<void>(`/messages/${id}/read`, { method: 'PATCH' });
}

export function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  return apiFetch<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(input) });
}

export function getAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>('/announcements');
}

export function markAnnouncementRead(id: string): Promise<void> {
  return apiFetch<void>(`/announcements/${id}/read`, { method: 'POST' });
}

export function getAnnouncementReads(id: string): Promise<AnnouncementReadReceipt[]> {
  return apiFetch<AnnouncementReadReceipt[]>(`/announcements/${id}/reads`);
}

export function getNombreMessagesNonLus(): Promise<number> {
  return apiFetch<number>('/messages/unread-count');
}

/** Signalé par le fil de messages après marquage « lu », pour que la pastille
 * de la barre du haut se mette à jour sans attendre son rafraîchissement. */
export const EVENEMENT_MESSAGES_LUS = 'dnpec:messages-lus';

/** Fiche de l'interlocuteur : fonction, unité, documents cités et tâches en commun que le lecteur voit. */
export function getContexteConversation(userId: string): Promise<ContexteConversation> {
  return apiFetch<ContexteConversation>(`/api/v1/messages/avec/${encodeURIComponent(userId)}/contexte`);
}
