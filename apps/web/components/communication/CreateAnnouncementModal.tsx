'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useOrg } from '../../lib/org/OrgProvider';
import { createAnnouncement } from '../../lib/api/communication';
import type { Announcement, AnnouncementScope } from '../../lib/communication/types';
import { SCOPE_LABEL } from '../../lib/communication/types';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

/** Reflète (côté UX seulement — l'autorité réelle est vérifiée par l'API à chaque
 * niveau) ce que AnnouncementsService.resolveAudienceAndAuthorize accepte pour
 * chaque rôle, pour ne proposer que des portées qui ont une chance d'aboutir. */
function getAvailableScopes(role: string): AnnouncementScope[] {
  switch (role) {
    case 'DN':
    case 'DNA':
      return ['DNPEC', 'DIVISION', 'SECTION', 'CELLULE', 'GROUPE_PERSONNALISE'];
    case 'ADMIN_SYSTEME':
      return ['DIVISION', 'SECTION', 'CELLULE', 'GROUPE_PERSONNALISE'];
    case 'CHEF_DIVISION':
      return ['DIVISION', 'SECTION', 'GROUPE_PERSONNALISE'];
    case 'CHEF_SECTION':
      return ['SECTION', 'GROUPE_PERSONNALISE'];
    case 'CHEF_CELLULE':
      return ['CELLULE', 'GROUPE_PERSONNALISE'];
    default:
      return [];
  }
}

export function CreateAnnouncementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (announcement: Announcement) => void;
}) {
  const { user: currentUser } = useAuth();
  const { divisions, sections, cellules, users } = useOrg();
  const availableScopes = useMemo(() => getAvailableScopes(currentUser?.role ?? ''), [currentUser?.role]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<AnnouncementScope>(availableScopes[0] ?? 'GROUPE_PERSONNALISE');
  const [divisionId, setDivisionId] = useState(currentUser?.divisionId ?? '');
  const [sectionId, setSectionId] = useState(currentUser?.sectionId ?? '');
  const [celluleId, setCelluleId] = useState(currentUser?.celluleId ?? '');
  const [recipientUserIds, setRecipientUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChefDivision = currentUser?.role === 'CHEF_DIVISION';
  const isChefSection = currentUser?.role === 'CHEF_SECTION';
  const isChefCellule = currentUser?.role === 'CHEF_CELLULE';
  const sectionsForDivision = sections.filter((s) => s.divisionId === divisionId);

  function toggleRecipient(userId: string) {
    setRecipientUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const announcement = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        scope,
        divisionId: scope === 'DIVISION' || scope === 'SECTION' ? divisionId : undefined,
        sectionId: scope === 'SECTION' ? sectionId : undefined,
        celluleId: scope === 'CELLULE' ? celluleId : undefined,
        recipientUserIds: scope === 'GROUPE_PERSONNALISE' ? recipientUserIds : undefined,
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

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Portée</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as AnnouncementScope)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {availableScopes.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        {scope === 'DIVISION' && (
          <div className="mb-4">
            {isChefDivision ? (
              <p className="text-[13px] text-text-muted">
                Votre division : <strong>{divisions.find((d) => d.id === currentUser?.divisionId)?.name}</strong>
              </p>
            ) : (
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">Choisir une division…</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {scope === 'SECTION' && (
          <div className="mb-4 space-y-2.5">
            {isChefSection ? (
              <p className="text-[13px] text-text-muted">
                Votre section : <strong>{sections.find((s) => s.id === currentUser?.sectionId)?.name}</strong>
              </p>
            ) : (
              <>
                {!isChefDivision && (
                  <select
                    value={divisionId}
                    onChange={(e) => {
                      setDivisionId(e.target.value);
                      setSectionId('');
                    }}
                    required
                    className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
                  >
                    <option value="">Choisir une division…</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  required
                  disabled={!divisionId}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm disabled:opacity-60"
                >
                  <option value="">Choisir une section…</option>
                  {sectionsForDivision.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {scope === 'CELLULE' && (
          <div className="mb-4">
            {isChefCellule ? (
              <p className="text-[13px] text-text-muted">
                Votre cellule : <strong>{cellules.find((c) => c.id === currentUser?.celluleId)?.name}</strong>
              </p>
            ) : (
              <select
                value={celluleId}
                onChange={(e) => setCelluleId(e.target.value)}
                required
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">Choisir une cellule…</option>
                {cellules.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {scope === 'GROUPE_PERSONNALISE' && (
          <div className="mb-4">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Destinataires</label>
            <div className="max-h-32 overflow-y-auto rounded-md border border-line p-2">
              {users
                .filter((u) => u.id !== currentUser?.id)
                .map((u) => (
                  <label key={u.id} className="flex items-center gap-2 py-1 text-[13px]">
                    <input
                      type="checkbox"
                      checked={recipientUserIds.includes(u.id)}
                      onChange={() => toggleRecipient(u.id)}
                    />
                    {u.firstName} {u.lastName}
                  </label>
                ))}
              {users.length <= 1 && <p className="text-[12.5px] text-text-faint">Aucun destinataire disponible.</p>}
            </div>
          </div>
        )}

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
