'use client';

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

export function MySuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-text-faint">
        Vous n&apos;avez pas encore soumis de suggestion (les suggestions envoyées anonymement n&apos;apparaissent
        pas ici).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} className="p-[18px]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge tone={STATUS_TONE[suggestion.status]}>{STATUS_LABEL[suggestion.status]}</Badge>
            <span className="text-[11px] text-text-faint">{formatDate(suggestion.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-[13.5px]">{suggestion.content}</p>
          {suggestion.response && (
            <div className="mt-3 rounded-md bg-bg p-3 text-[13px]">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                Réponse de la Direction
              </div>
              {suggestion.response}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
