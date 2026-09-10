export type SuggestionStatus = 'RECUE' | 'EN_ETUDE' | 'RETENUE' | 'NON_RETENUE';

export interface Suggestion {
  id: string;
  authorId: string | null;
  isAnonymous: boolean;
  content: string;
  status: SuggestionStatus;
  response: string | null;
  respondedById: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface CreateSuggestionInput {
  content: string;
  isAnonymous?: boolean;
}

export interface UpdateSuggestionStatusInput {
  status: SuggestionStatus;
  response?: string;
}

export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  RECUE: 'Reçue',
  EN_ETUDE: 'En étude',
  RETENUE: 'Retenue',
  NON_RETENUE: 'Non retenue',
};
