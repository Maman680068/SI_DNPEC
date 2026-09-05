'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Conversation } from '../../lib/communication/types';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function ConversationList({
  conversations,
  selectedUserId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel, getUserInitials } = useOrg();

  if (conversations.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-text-faint">Aucune conversation pour l&apos;instant.</p>;
  }

  return (
    <div>
      {conversations.map((conversation) => {
        const unread = conversation.lastMessage.recipientId === currentUser?.id && !conversation.lastMessage.readAt;
        const isSelected = conversation.otherUserId === selectedUserId;
        return (
          <button
            key={conversation.otherUserId}
            onClick={() => onSelect(conversation.otherUserId)}
            className={`flex w-full items-center gap-2.5 border-b border-line px-4 py-3 text-left ${
              isSelected ? 'bg-accent-soft' : 'hover:bg-bg'
            }`}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-accent-soft text-[12px] font-bold text-accent">
              {getUserInitials(conversation.otherUserId)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-[13px] ${unread ? 'font-bold text-ink' : 'font-semibold text-text'}`}>
                  {getUserLabel(conversation.otherUserId)}
                </span>
                <span className="flex-shrink-0 text-[10.5px] text-text-faint">
                  {formatWhen(conversation.lastMessage.createdAt)}
                </span>
              </div>
              <p className={`truncate text-[12px] ${unread ? 'font-semibold text-text' : 'text-text-muted'}`}>
                {conversation.lastMessage.body}
              </p>
            </div>
            {unread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-clay" />}
          </button>
        );
      })}
    </div>
  );
}
