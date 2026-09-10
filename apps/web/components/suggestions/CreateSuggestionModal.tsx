'use client';

import { useState, type FormEvent } from 'react';
import { createSuggestion } from '../../lib/api/suggestions';
import type { Suggestion } from '../../lib/suggestions/types';
import { Button } from '../ui/Button';

export function CreateSuggestionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (suggestion: Suggestion | null) => void;
}) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const suggestion = await createSuggestion({ content: content.trim(), isAnonymous });
      // Une suggestion anonyme n'a pas d'authorId : elle n'apparaîtra jamais dans
      // "Mes suggestions" (voir SuggestionsService) — inutile de l'ajouter à la liste locale.
      onCreated(isAnonymous ? null : suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’envoyer la suggestion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouvelle suggestion</h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">
            Votre suggestion, à destination de la Direction
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            required
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        <label className="mb-4 flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Soumettre anonymement
            <span className="block text-[11.5px] text-text-faint">
              Ni la Direction ni personne d’autre ne pourra savoir que la suggestion vient de vous — en
              contrepartie, elle n’apparaîtra pas dans « Mes suggestions » et vous ne serez pas notifié·e de son
              suivi.
            </span>
          </span>
        </label>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !content.trim()}>
            {submitting ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
