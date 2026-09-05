'use client';

import { useState, type FormEvent } from 'react';
import { createUser } from '../../lib/api/users';
import type { AdminUser, OrgAttachment } from '../../lib/users/types';
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { OrgAttachmentFields } from './OrgAttachmentFields';
import { Field } from '../ui/Input';
import { Button } from '../ui/Button';

const EMPTY_ATTACHMENT: OrgAttachment = { divisionId: null, sectionId: null, celluleId: null };

export function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SystemRole>('AGENT');
  const [attachment, setAttachment] = useState<OrgAttachment>(EMPTY_ATTACHMENT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await createUser({ email, firstName, lastName, password, role, ...attachment });
      onCreated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le compte');
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
        <h2 className="mb-5 text-[19px] font-semibold">Nouveau compte</h2>

        <Field label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Field label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={12}
          required
        />
        <p className="-mt-3 mb-4 text-[11.5px] text-text-faint">12 caractères minimum.</p>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Rôle</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as SystemRole)}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {ASSIGNABLE_ROLES.map((r) => (
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
          <Button type="submit" variant="solid" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer le compte'}
          </Button>
        </div>
      </form>
    </div>
  );
}
