'use client';

import { useState } from 'react';
import { createSuggestion } from '../../lib/api/suggestions';
import type { Suggestion } from '../../lib/suggestions/types';
import { Fenetre } from '../ui/Fenetre';

/** Nouvelle suggestion (fenêtre de formulaire) : texte libre, soumission anonyme possible. */
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

  async function handleSubmit() {
    if (!content.trim()) return;
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
    <Fenetre titre="Nouvelle suggestion" onClose={onClose} onSubmit={handleSubmit} libelleValider="Envoyer" enCours={submitting} erreur={error} largeur={520}>
      <label className="mb-4 block text-[12.5px] font-semibold text-text">
        Votre suggestion, à destination de la Direction
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          required
          className="mt-1 w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] font-normal"
        />
      </label>

      <label className="mb-2 flex items-start gap-2 text-[13px]">
        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="mt-0.5" />
        <span>
          Soumettre anonymement
          <span className="block text-[12px] text-text-muted">
            Ni la Direction ni personne d’autre ne pourra savoir que la suggestion vient de vous — en contrepartie, elle
            n’apparaîtra pas dans « Mes suggestions » et vous ne serez pas notifié·e de son suivi.
          </span>
        </span>
      </label>
    </Fenetre>
  );
}
