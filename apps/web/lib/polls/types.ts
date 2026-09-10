import type { AnnouncementScope } from '../communication/types';

export interface PollOptionResult {
  id: string;
  label: string;
  order: number;
  voteCount: number;
}

export interface PollVoter {
  optionId: string;
  userId: string;
  votedAt: string;
}

export interface Poll {
  id: string;
  authorId: string;
  question: string;
  allowMultiple: boolean;
  scope: AnnouncementScope;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  closesAt: string | null;
  closedAt: string | null;
  createdAt: string;
  isClosed: boolean;
  totalVoters: number;
  options: PollOptionResult[];
  myOptionIds: string[];
  /** Vrai pour l'auteur et la direction (DN/DNA/ADMIN_SYSTEME) — voir voters. */
  canSeeDetail: boolean;
  /** Qui a voté quoi — présent seulement si canSeeDetail (nominatif, comme
   * AnnouncementRead : jamais exposé à un simple participant). */
  voters?: PollVoter[];
}

export interface CreatePollInput {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  closesAt?: string;
  scope: AnnouncementScope;
  divisionId?: string;
  sectionId?: string;
  celluleId?: string;
  recipientUserIds?: string[];
}
