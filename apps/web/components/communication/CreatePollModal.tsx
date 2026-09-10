'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createPoll } from '../../lib/api/polls';
import type { Poll } from '../../lib/polls/types';
import type { AudienceScopeValue } from '../../lib/communication/types';
import { getAvailableAudienceScopes } from '../../lib/communication/types';
import { AudienceScopeFields } from './AudienceScopeFields';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

const EMPTY_OPTIONS = ['', ''];

export function CreatePollModal({ onClose, onCreated }: { onClose: () => void; onCreated: (poll: Poll) => void }) {
  const { user: currentUser } = useAuth();
  const availableScopes = useMemo(() => getAvailableAudienceScopes(currentUser?.role ?? ''), [currentUser?.role]);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState('');
  const [audience, setAudience] = useState<AudienceScopeValue>({
    scope: availableScopes[0] ?? 'GROUPE_PERSONNALISE',
    divisionId: currentUser?.divisionId ?? '',
    sectionId: currentUser?.sectionId ?? '',
    celluleId: currentUser?.celluleId ?? '',
    recipientUserIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validOptions = options.map((o) => o.trim()).filter(Boolean);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const poll = await createPoll({
        question: question.trim(),
        options: validOptions,
        allowMultiple,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
        scope: audience.scope,
        divisionId: audience.scope === 'DIVISION' || audience.scope === 'SECTION' ? audience.divisionId : undefined,
        sectionId: audience.scope === 'SECTION' ? audience.sectionId : undefined,
        celluleId: audience.scope === 'CELLULE' ? audience.celluleId : undefined,
        recipientUserIds: audience.scope === 'GROUPE_PERSONNALISE' ? audience.recipientUserIds : undefined,
      });
      onCreated(poll);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le sondage');
    } finally {
      setSubmitting(false);
    }
  }

  if (availableScopes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouveau sondage</h2>

        <Field label="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required autoFocus />

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Options</label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    aria-label={`Retirer l'option ${index + 1}`}
                    className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-bg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-2 text-[12.5px] font-semibold text-accent hover:underline"
          >
            + Ajouter une option
          </button>
        </div>

        <label className="mb-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />
          Autoriser plusieurs choix par personne
        </label>

        <Field
          label="Clôture automatique (optionnel)"
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
        />

        <AudienceScopeFields availableScopes={availableScopes} value={audience} onChange={setAudience} />

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !question.trim() || validOptions.length < 2}>
            {submitting ? 'Publication…' : 'Publier le sondage'}
          </Button>
        </div>
      </form>
    </div>
  );
}
