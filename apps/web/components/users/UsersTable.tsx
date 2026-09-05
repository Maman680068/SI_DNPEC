'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { setUserStatus } from '../../lib/api/users';
import type { AdminUser } from '../../lib/users/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

function attachmentLabel(
  user: AdminUser,
  getDivisionName: (id: string | null) => string | null,
  getSectionName: (id: string | null) => string | null,
  getCelluleName: (id: string | null) => string | null,
): string {
  if (user.celluleId) return getCelluleName(user.celluleId) ?? '—';
  if (user.divisionId) {
    const division = getDivisionName(user.divisionId);
    const section = getSectionName(user.sectionId);
    return section ? `${division} · ${section}` : division ?? '—';
  }
  return '—';
}

export function UsersTable({
  users,
  canManage,
  onChange,
}: {
  users: AdminUser[];
  /** ADMIN_SYSTEME uniquement — DN/DNA voient cette liste en lecture seule
   * (PATCH /users/:id/status est réservé à ADMIN_SYSTEME côté API). */
  canManage: boolean;
  onChange: (updated: AdminUser) => void;
}) {
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleStatus(user: AdminUser) {
    const nextStatus = user.status === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
    const verb = nextStatus === 'SUSPENDU' ? 'suspendre' : 'réactiver';
    if (!window.confirm(`Confirmer : ${verb} le compte de ${user.firstName} ${user.lastName} ?`)) return;
    setPendingId(user.id);
    setError(null);
    try {
      const updated = await setUserStatus(user.id, nextStatus);
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour ce compte');
    } finally {
      setPendingId(null);
    }
  }

  if (users.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucun compte.</p>;
  }

  return (
    <div>
      {error && <div className="mb-3 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-bg text-[11px] font-bold uppercase tracking-wide text-text-faint">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Rattachement</th>
              <th className="px-4 py-3">Statut</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-4 py-3 text-text-muted">{user.email}</td>
                <td className="px-4 py-3">{ROLE_LABEL[user.role]}</td>
                <td className="px-4 py-3 text-text-muted">
                  {attachmentLabel(user, getDivisionName, getSectionName, getCelluleName)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={user.status === 'SUSPENDU' ? 'clay' : 'sage'}>
                    {user.status === 'SUSPENDU' ? 'Suspendu' : 'Actif'}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      disabled={pendingId === user.id}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.status === 'SUSPENDU' ? 'Réactiver' : 'Suspendre'}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
