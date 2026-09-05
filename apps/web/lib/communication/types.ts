export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  attachmentKey: string | null;
  attachmentName: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  otherUserId: string;
  lastMessage: DirectMessage;
}

export type AnnouncementScope = 'DNPEC' | 'DIVISION' | 'SECTION' | 'CELLULE' | 'GROUPE_PERSONNALISE';

export interface Announcement {
  id: string;
  authorId: string;
  title: string;
  body: string;
  scope: AnnouncementScope;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  createdAt: string;
}

export interface AnnouncementReadReceipt {
  id: string;
  announcementId: string;
  userId: string;
  readAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  scope: AnnouncementScope;
  divisionId?: string;
  sectionId?: string;
  celluleId?: string;
  recipientUserIds?: string[];
}

export const SCOPE_LABEL: Record<AnnouncementScope, string> = {
  DNPEC: 'Toute la DNPEC',
  DIVISION: 'Division',
  SECTION: 'Section',
  CELLULE: 'Cellule',
  GROUPE_PERSONNALISE: 'Groupe personnalisé',
};
