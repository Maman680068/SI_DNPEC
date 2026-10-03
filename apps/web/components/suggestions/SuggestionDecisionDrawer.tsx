'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { updateSuggestionStatus } from '../../lib/api/suggestions';
import type { Suggestion, SuggestionStatus } from '../../lib/suggestions/types';
import { STATUS_LABEL } from '../../lib/suggestions/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FenetreDetail } from '../ui/FenetreDetail';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_OPTIONS: SuggestionStatus[] = ['RECUE', 'EN_ETUDE', 'RETENUE', 'NON_RETENUE'];

export function SuggestionDecisionDrawer({
  suggestion,
  onClose,
  onUpdated,
}: {
  suggestion: Suggestion;
  onClose: () => void;
  onUpdated: (suggestion: Suggestion) => void;
}) {
  const { user: currentUser } = useAuth();
  const { getUserLabel } = useOrg();
  const [status, setStatus] = useState<SuggestionStatus>(suggestion.status);
  const [response, setResponse] = useState(suggestion.response ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorLabel = suggestion.isAnonymous
    ? 'Anonyme'
    : suggestion.authorId === currentUser?.id
      ? 'Vous'
      : getUserLabel(suggestion.authorId ?? '');

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateSuggestionStatus(suggestion.id, { status, response: response.trim() || undefined });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreDetail titre="Suggestion" onClose={onClose} sansEntete largeur={720}>
        <div className="mb-4 flex items-start justify-between">
          <div className="text-xs text-text-faint">Suggestion</div>
          <button onClick={onClose} aria-label="Fermer" className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-bg text-text-muted">
            ✕
          </button>
        </div>

        <p className="mb-1 text-[13px] text-text-muted">
          Par {authorLabel} · {formatDate(suggestion.createdAt)}
        </p>
        {suggestion.isAnonymous && (
          <Badge tone="muted" className="mb-3">
            Auteur non enregistré — soumission anonyme
          </Badge>
        )}

        <div className="mb-6 whitespace-pre-wrap rounded-md bg-bg p-3.5 text-[13.5px] leading-relaxed">
          {suggestion.content}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SuggestionStatus)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Réponse {!suggestion.isAnonymous && '(visible par l’auteur)'}
          </label>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{error}</div>}

        <Button variant="solid" className="w-full" disabled={submitting} onClick={handleSave}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
    </FenetreDetail>
  );
}
