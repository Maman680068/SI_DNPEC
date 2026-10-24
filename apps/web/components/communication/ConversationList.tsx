'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Conversation } from '../../lib/communication/types';
import { extrait, quandListe } from '../../lib/communication/affichage';
import { Initiales } from '../ui/Charte';

/** Liste des conversations (maquette : point doré si non lu, initiales, nom, extrait, heure). */
export function ConversationList({
  conversations,
  selectedUserId,
  onSelect,
  filtre = '',
}: {
  conversations: Conversation[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  filtre?: string;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel, getUserInitials } = useOrg();
  const q = filtre.trim().toLowerCase();
  const visibles = q ? conversations.filter((c) => `${getUserLabel(c.otherUserId)} ${c.lastMessage.body}`.toLowerCase().includes(q)) : conversations;

  if (conversations.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-text-muted">Aucune conversation pour l’instant : « Nouveau message » pour en démarrer une.</p>;
  }
  if (visibles.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-text-muted">Aucune conversation ne correspond à « {filtre} ».</p>;
  }

  return (
    <ul aria-label="Conversations">
      {visibles.map((conversation) => {
        const unread = conversation.lastMessage.recipientId === currentUser?.id && !conversation.lastMessage.readAt;
        const isSelected = conversation.otherUserId === selectedUserId;
        const nom = getUserLabel(conversation.otherUserId);
        return (
          <li key={conversation.otherUserId}>
            <button
              type="button"
              data-testid="conversation"
              aria-current={isSelected ? 'true' : undefined}
              aria-label={`${nom}${unread ? ' (non lu)' : ''}`}
              onClick={() => onSelect(conversation.otherUserId)}
              className={`flex w-full items-center gap-[11px] border-b border-line-doux px-3.5 py-[11px] text-left ${isSelected ? 'bg-ink-50' : 'hover:bg-survol'}`}
            >
              <Initiales texte={getUserInitials(conversation.otherUserId)} taille={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <b className="truncate text-[13.5px] font-semibold text-text">{nom}</b>
                  <span className="flex-none text-[11.5px] font-medium text-text-muted">{quandListe(conversation.lastMessage.createdAt)}</span>
                </span>
                <span className={`mt-0.5 block truncate text-[12.5px] ${unread ? 'font-semibold text-text' : 'text-text-muted'}`}>{extrait(conversation.lastMessage.body)}</span>
              </span>
              {unread && <span aria-hidden className="h-[9px] w-[9px] flex-none rounded-full bg-gold" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
