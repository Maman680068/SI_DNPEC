'use client';

import { useState } from 'react';
import { rejectUser } from '../../lib/api/users';
import type { AdminUser } from '../../lib/users/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PendingRegistrationsList({
  users,
  onApprove,
  onRejected,
}: {
  users: AdminUser[];
  onApprove: (user: AdminUser) => void;
  onRejected: (id: string) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReject(user: AdminUser) {
    if (!window.confirm(`Rejeter définitivement l’inscription de ${user.firstName} ${user.lastName} ?`)) return;
    setRejectingId(user.id);
    setError(null);
    try {
      await rejectUser(user.id);
      onRejected(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de rejeter cette inscription');
    } finally {
      setRejectingId(null);
    }
  }

  if (users.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucune inscription en attente.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}
      {users.map((user) => (
        <Card key={user.id} className="flex items-center justify-between gap-3 p-[18px]">
          <div>
            <div className="text-[14px] font-bold">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-[13px] text-text-muted">
              {user.email} · Inscrit le {formatDate(user.createdAt)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-clay text-clay hover:bg-clay-soft"
              disabled={rejectingId === user.id}
              onClick={() => handleReject(user)}
            >
              Rejeter
            </Button>
            <Button variant="gold" onClick={() => onApprove(user)}>
              Approuver
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
