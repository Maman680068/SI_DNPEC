'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Poll } from '../../lib/polls/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SCOPE_TONE: Record<Poll['scope'], 'accent' | 'gold' | 'sage' | 'clay' | 'muted'> = {
  DNPEC: 'clay',
  DIVISION: 'accent',
  SECTION: 'accent',
  CELLULE: 'gold',
  GROUPE_PERSONNALISE: 'muted',
};

export function PollList({ polls, onSelect }: { polls: Poll[]; onSelect: (id: string) => void }) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();

  if (polls.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucun sondage pour l&apos;instant.</p>;
  }

  return (
    <div className="space-y-3">
      {polls.map((poll) => {
        const hasVoted = poll.myOptionIds.length > 0;
        return (
          <Card key={poll.id} onClick={() => onSelect(poll.id)} className="cursor-pointer p-[18px] hover:border-accent/40">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={SCOPE_TONE[poll.scope]}>{SCOPE_LABEL[poll.scope]}</Badge>
              {poll.isClosed && <Badge tone="clay">Clôturé</Badge>}
              {!poll.isClosed && hasVoted && <Badge tone="sage">Vous avez voté</Badge>}
              <span className="ml-auto text-[11px] text-text-faint">{formatDate(poll.createdAt)}</span>
            </div>
            <div className="mb-1 text-[14.5px] font-bold">{poll.question}</div>
            <div className="text-[11px] text-text-faint">
              Par {poll.authorId === currentUser?.id ? 'vous' : getUserLabel(poll.authorId)} · {poll.totalVoters}{' '}
              vote{poll.totalVoters > 1 ? 's' : ''}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
