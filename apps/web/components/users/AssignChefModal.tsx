'use client';

import { useState, type FormEvent } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { assignCelluleChef } from '../../lib/api/org';
import type { AdminUser } from '../../lib/users/types';
import { Button } from '../ui/Button';

/**
 * Nomme `user` chef d'une cellule via la transaction dédiée (POST /org/cellules/:id/chef) —
 * jamais un simple changement de rôle, qui laisserait Cellule.chefId incohérent (voir
 * lib/users/types.ts, ASSIGNABLE_ROLES). Un rafraîchissement complet de la liste après succès
 * est nécessaire côté appelant : l'ancien chef de la cellule choisie est démis en même temps.
 */
export function AssignChefModal({
  user,
  onClose,
  onAssigned,
}: {
  user: AdminUser;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { cellules, refreshCellules } = useOrg();
  const [celluleId, setCelluleId] = useState(cellules[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetCellule = cellules.find((c) => c.id === celluleId);
  const alreadyHasChef = !!targetCellule?.chefId && targetCellule.chefId !== user.id;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await assignCelluleChef(celluleId, user.id);
      await refreshCellules();
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de nommer ce chef de cellule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-lg bg-surface p-6"
      >
        <h2 className="mb-1.5 text-[19px] font-semibold">Nommer chef de cellule</h2>
        <p className="mb-5 text-[13px] text-text-muted">
          {user.firstName} {user.lastName} · {user.email}
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-text">Cellule</label>
          <select
            value={celluleId}
            onChange={(e) => setCelluleId(e.target.value)}
            required
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          >
            {cellules.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {alreadyHasChef && (
          <p className="mb-4 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
            Cette cellule a déjà un chef — il sera automatiquement remis au rôle Agent.
          </p>
        )}
        {user.divisionId && (
          <p className="mb-4 rounded-md bg-clay-soft px-3.5 py-2.5 text-[12.5px] text-clay">
            Cet utilisateur est rattaché à une Division : l’API refusera cette nomination tant
            qu’il n’en est pas détaché.
          </p>
        )}

        {error && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="gold" disabled={submitting || !celluleId}>
            {submitting ? 'Nomination…' : 'Nommer chef'}
          </Button>
        </div>
      </form>
    </div>
  );
}
