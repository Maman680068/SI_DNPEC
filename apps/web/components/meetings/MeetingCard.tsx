'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import type { Meeting } from '../../lib/meetings/types';
import { Badge } from '../ui/Badge';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

export function MeetingCard({ meeting, onSelect }: { meeting: Meeting; onSelect: () => void }) {
  const { user: currentUser } = useAuth();
  const mine = meeting.participants.find((p) => p.userId === currentUser?.id);

  return (
    <button
      onClick={onSelect}
      className="flex w-full flex-col gap-2 rounded-lg border border-line bg-surface p-4 text-left hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold">{meeting.title}</span>
          {meeting.status === 'ANNULEE' && <Badge tone="clay">Annulée</Badge>}
          {meeting.createdById === currentUser?.id && <Badge tone="gold">Organisateur</Badge>}
        </div>
        <div className="text-[12.5px] text-text-muted">
          {formatWhen(meeting.startAt)}
          {meeting.location && ` · ${meeting.location}`}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 text-[12px] text-text-faint">
        {meeting.participants.length} participant{meeting.participants.length > 1 ? 's' : ''}
        {mine && mine.userId !== meeting.createdById && (
          <Badge tone={mine.responseStatus === 'CONFIRME' ? 'sage' : mine.responseStatus === 'DECLINE' ? 'clay' : 'muted'}>
            {mine.responseStatus === 'CONFIRME' ? 'Confirmé' : mine.responseStatus === 'DECLINE' ? 'Décliné' : 'En attente'}
          </Badge>
        )}
      </div>
    </button>
  );
}
