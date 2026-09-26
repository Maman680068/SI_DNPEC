'use client';

import { useState, type FormEvent } from 'react';
import { rejectUser } from '../../lib/api/users';
import { useOrg } from '../../lib/org/OrgProvider';
import { DECLARABLE_ROLE_LABEL, type DeclarableRole } from '../../lib/auth/types';
import type { AdminUser } from '../../lib/users/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function declarationLabel(
  user: AdminUser,
  getDivisionName: (id: string | null) => string | null,
  getSectionName: (id: string | null) => string | null,
  getCelluleName: (id: string | null) => string | null,
): string | null {
  if (user.declaredCelluleId) return getCelluleName(user.declaredCelluleId);
  if (user.declaredDivisionId) {
    const division = getDivisionName(user.declaredDivisionId);
    const section = getSectionName(user.declaredSectionId);
    return section ? `${division} · ${section}` : division;
  }
  return null;
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
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();
  const [aRejeter, setARejeter] = useState<AdminUser | null>(null);

  if (users.length === 0) {
    return <p className="py-8 text-center text-[13px] text-text-faint">Aucune inscription en attente.</p>;
  }

  return (
    <div className="space-y-3">
      {aRejeter && (
        <RejetInscriptionModal
          user={aRejeter}
          onClose={() => setARejeter(null)}
          onRejected={(id) => {
            setARejeter(null);
            onRejected(id);
          }}
        />
      )}
      {users.map((user) => {
        const declared = declarationLabel(user, getDivisionName, getSectionName, getCelluleName);
        return (
          <Card key={user.id} className="flex flex-col gap-3 p-[18px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[14px] font-bold">
                {user.firstName} {user.lastName}
              </div>
              <div className="mb-1.5 text-[13px] text-text-muted">
                {user.email} · Inscrit le {formatDate(user.createdAt)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {user.declaredRole && (
                  <Badge tone="accent">
                    Poste déclaré : {DECLARABLE_ROLE_LABEL[user.declaredRole as DeclarableRole] ?? user.declaredRole}
                  </Badge>
                )}
                {declared && <Badge tone="gold">Souhaite : {declared}</Badge>}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Button
                variant="outline"
                className="border-clay text-clay hover:bg-clay-soft"
                onClick={() => setARejeter(user)}
              >
                Rejeter
              </Button>
              <Button variant="gold" onClick={() => onApprove(user)}>
                Approuver
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Rejet d'une inscription : le compte en attente est supprimé et la personne
 * reçoit un email sobre (elle peut refaire une demande). Le motif, facultatif,
 * n'est repris dans l'email que s'il est saisi.
 */
function RejetInscriptionModal({
  user,
  onClose,
  onRejected,
}: {
  user: AdminUser;
  onClose: () => void;
  onRejected: (id: string) => void;
}) {
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function rejeter(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await rejectUser(user.id, motif.trim() || undefined);
      onRejected(user.id);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Impossible de rejeter cette inscription');
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,26,38,0.42)] p-4" onClick={onClose}>
      <form
        onSubmit={rejeter}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-lg bg-surface p-6"
      >
        <h2 className="mb-1.5 text-[19px] font-semibold">Rejeter l’inscription</h2>
        <p className="mb-4 text-[13px] text-text-muted">
          {user.firstName} {user.lastName} · {user.email}
        </p>
        <p className="mb-4 rounded-md bg-gold-soft px-3.5 py-2.5 text-[12.5px] text-ink">
          La demande est supprimée. La personne reçoit un email lui indiquant qu’elle n’a pas été retenue et qu’elle peut en
          refaire une.
        </p>
        <label htmlFor="rejet-motif" className="mb-1.5 block text-[12.5px] font-semibold">
          Motif (facultatif, repris dans l’email)
        </label>
        <textarea
          id="rejet-motif"
          className="mb-4 min-h-[70px] w-full rounded-md border border-line bg-surface px-3 py-2 text-[13.5px]"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          maxLength={500}
        />
        {erreur && <div className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{erreur}</div>}
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="outline" className="border-clay text-clay hover:bg-clay-soft" disabled={enCours}>
            {enCours ? 'Rejet…' : 'Rejeter la demande'}
          </Button>
        </div>
      </form>
    </div>
  );
}
