'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { searchUsers } from '../../lib/api/org';
import { createMeeting } from '../../lib/api/meetings';
import type { BasicUserInfo } from '../../lib/org/types';
import type { Meeting } from '../../lib/meetings/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function CreateMeetingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (meeting: Meeting) => void }) {
  const { user: currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BasicUserInfo[]>([]);
  const [participants, setParticipants] = useState<BasicUserInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(query).then((users) => {
        if (!cancelled) {
          const pickedIds = new Set([currentUser?.id, ...participants.map((p) => p.id)]);
          setResults(users.filter((u) => !pickedIds.has(u.id)));
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, currentUser?.id, participants]);

  function addParticipant(user: BasicUserInfo) {
    setParticipants((prev) => [...prev, user]);
    setQuery('');
    setResults([]);
  }

  function removeParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const meeting = await createMeeting({
        title,
        agenda: agenda.trim() || undefined,
        location: location.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        participantIds: participants.map((p) => p.id),
      });
      onCreated(meeting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer la réunion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouvelle réunion</h2>

        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field
            label="Début"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
          <Field label="Fin (optionnel)" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>

        <Field label="Lieu / salle (optionnel)" value={location} onChange={(e) => setLocation(e.target.value)} />

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Ordre du jour (optionnel)</label>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Participants</label>
          {participants.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent"
                >
                  {p.firstName} {p.lastName}
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    aria-label={`Retirer ${p.firstName} ${p.lastName}`}
                    className="text-accent hover:text-clay"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ajouter un participant…"
              className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
            />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[180px] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addParticipant(u)}
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-bg"
                  >
                    <span className="font-semibold">
                      {u.firstName} {u.lastName}
                    </span>
                    {u.jobTitle && <span className="ml-1.5 text-text-faint">· {u.jobTitle}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !title || !startAt}>
            {submitting ? 'Création…' : 'Créer la réunion'}
          </Button>
        </div>
      </form>
    </div>
  );
}
