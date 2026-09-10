'use client';

import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import type { Suggestion } from '../../lib/suggestions/types';
import { STATUS_LABEL } from '../../lib/suggestions/types';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_TONE: Record<Suggestion['status'], 'accent' | 'gold' | 'sage' | 'clay' | 'muted'> = {
  RECUE: 'muted',
  EN_ETUDE: 'gold',
  RETENUE: 'sage',
  NON_RETENUE: 'clay',
};

export function SuggestionInboxList({
  suggestions,
  onSelect,
}: {
  suggestions: Suggestion[];
  onSelect: (id: string) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();

  if (suggestions.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucune suggestion pour l&apos;instant.</p>;
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <Card
          key={suggestion.id}
          onClick={() => onSelect(suggestion.id)}
          className="cursor-pointer p-[18px] hover:border-accent/40"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge tone={STATUS_TONE[suggestion.status]}>{STATUS_LABEL[suggestion.status]}</Badge>
            <span className="text-[11px] text-text-faint">{formatDate(suggestion.createdAt)}</span>
          </div>
          <p className="line-clamp-2 text-[13.5px]">{suggestion.content}</p>
          <div className="mt-2 text-[11px] text-text-faint">
            {suggestion.isAnonymous
              ? 'Anonyme'
              : suggestion.authorId === currentUser?.id
                ? 'Vous'
                : getUserLabel(suggestion.authorId ?? '')}
          </div>
        </Card>
      ))}
    </div>
  );
}
