'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createAnnouncement } from '../../lib/api/communication';
import type { Announcement, AudienceScopeValue } from '../../lib/communication/types';
import { getAvailableAudienceScopes } from '../../lib/communication/types';
import { AudienceScopeFields } from './AudienceScopeFields';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

export function CreateAnnouncementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (announcement: Announcement) => void;
}) {
  const { user: currentUser } = useAuth();
  const availableScopes = useMemo(() => getAvailableAudienceScopes(currentUser?.role ?? ''), [currentUser?.role]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AudienceScopeValue>({
    scope: availableScopes[0] ?? 'GROUPE_PERSONNALISE',
    divisionId: currentUser?.divisionId ?? '',
    sectionId: currentUser?.sectionId ?? '',
    celluleId: currentUser?.celluleId ?? '',
    recipientUserIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const announcement = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        scope: audience.scope,
        divisionId: audience.scope === 'DIVISION' || audience.scope === 'SECTION' ? audience.divisionId : undefined,
        sectionId: audience.scope === 'SECTION' ? audience.sectionId : undefined,
        celluleId: audience.scope === 'CELLULE' ? audience.celluleId : undefined,
        recipientUserIds: audience.scope === 'GROUPE_PERSONNALISE' ? audience.recipientUserIds : undefined,
      });
      onCreated(announcement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer l'annonce");
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
        className="w-full max-w-[480px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-5 text-[19px] font-semibold">Nouvelle annonce</h2>

        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent focus:outline focus:outline-2 focus:outline-accent"
          />
        </div>

        <AudienceScopeFields availableScopes={availableScopes} value={audience} onChange={setAudience} />

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="solid" disabled={submitting || !title.trim() || !body.trim()}>
            {submitting ? 'Publication…' : "Publier l'annonce"}
          </Button>
        </div>
      </form>
    </div>
  );
}
