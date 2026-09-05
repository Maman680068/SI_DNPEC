'use client';

import { useState, type FormEvent } from 'react';
import { approveUser } from '../../lib/api/users';
import type { AdminUser, OrgAttachment } from '../../lib/users/types';
import { ROLE_LABEL, SYSTEM_ROLES } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { OrgAttachmentFields } from './OrgAttachmentFields';
import { Button } from '../ui/Button';

const EMPTY_ATTACHMENT: OrgAttachment = { divisionId: null, sectionId: null, celluleId: null };

export function ApproveRegistrationModal({
  user,
  onClose,
  onApproved,
}: {
  user: AdminUser;
  onClose: () => void;
  onApproved: (user: AdminUser) => void;
}) {
  const [role, setRole] = useState<SystemRole>('AGENT');
  const [attachment, setAttachment] = useState<OrgAttachment>(EMPTY_ATTACHMENT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await approveUser(user.id, { role, ...attachment });
      onApproved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'approuver cette inscription");
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
        <h2 className="mb-1.5 text-[19px] font-semibold">Approuver l’inscription</h2>
        <p className="mb-5 text-[13px] text-text-muted">
          {user.firstName} {user.lastName} · {user.email}
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Rôle attribué</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as SystemRole)}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {SYSTEM_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <OrgAttachmentFields role={role} value={attachment} onChange={setAttachment} />

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="gold" disabled={submitting}>
            {submitting ? 'Validation…' : 'Approuver'}
          </Button>
        </div>
      </form>
    </div>
  );
}
