'use client';

import { useState, type FormEvent } from 'react';
import { approveUser } from '../../lib/api/users';
import { useOrg } from '../../lib/org/OrgProvider';
import type { AdminUser, OrgAttachment } from '../../lib/users/types';
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../../lib/users/types';
import type { SystemRole } from '../../lib/auth/types';
import { OrgAttachmentFields } from './OrgAttachmentFields';
import { Button } from '../ui/Button';

export function ApproveRegistrationModal({
  user,
  onClose,
  onApproved,
}: {
  user: AdminUser;
  onClose: () => void;
  onApproved: (user: AdminUser) => void;
}) {
  const { getDivisionName, getSectionName, getCelluleName, getUserLabel } = useOrg();
  // Une Division/Cellule déclarée reste compatible avec le rôle par défaut AGENT
  // (le cas courant), donc pas besoin de deviner un rôle différent — mais un
  // superviseur déclaré ne peut correspondre qu'au rôle ASSISTANT_DIRECTION :
  // partir d'AGENT ici forcerait l'admin à changer le rôle manuellement, ce qui
  // effacerait aussitôt le pré-remplissage (OrgAttachmentFields réinitialise
  // l'attachement à chaque changement de "famille" de rattachement).
  const [role, setRole] = useState<SystemRole>(user.declaredSupervisorId ? 'ASSISTANT_DIRECTION' : 'AGENT');
  // Pré-rempli avec le rattachement déclaré à l'inscription (voir OrgAttachmentFields :
  // son effet de réinitialisation-au-changement-de-rôle s'abstient exprès au premier
  // montage pour laisser passer ces valeurs) — l'admin n'a plus qu'à confirmer ou corriger.
  const [attachment, setAttachment] = useState<OrgAttachment>({
    divisionId: user.declaredDivisionId,
    sectionId: user.declaredSectionId,
    celluleId: user.declaredCelluleId,
    supervisorId: user.declaredSupervisorId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDeclaration = !!(user.declaredDivisionId || user.declaredCelluleId || user.declaredSupervisorId);
  const declarationLabel = user.declaredSupervisorId
    ? `Assiste ${getUserLabel(user.declaredSupervisorId)}`
    : user.declaredCelluleId
      ? getCelluleName(user.declaredCelluleId)
      : [getDivisionName(user.declaredDivisionId), getSectionName(user.declaredSectionId)]
          .filter(Boolean)
          .join(' · ');

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

        {hasDeclaration && (
          <div className="mb-5 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
            <strong>Rattachement déclaré à l’inscription :</strong> {declarationLabel}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Rôle attribué</label>
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
          <Button type="submit" variant="gold" disabled={submitting}>
            {submitting ? 'Validation…' : 'Approuver'}
          </Button>
        </div>
      </form>
    </div>
  );
}
