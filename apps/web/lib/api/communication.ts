import { apiFetch } from './client';
import type {
  Announcement,
  AnnouncementReadReceipt,
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
