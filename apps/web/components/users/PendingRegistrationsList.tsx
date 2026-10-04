'use client';

import { useState } from 'react';
import { rejectUser } from '../../lib/api/users';
import { useOrg } from '../../lib/org/OrgProvider';
import { DECLARABLE_ROLE_LABEL, type DeclarableRole } from '../../lib/auth/types';
import type { AdminUser } from '../../lib/users/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EtatVide } from '../ui/Charte';
import { FenetreFormulaire, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

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
    return <div className="rounded-xl border border-line bg-surface"><EtatVide texte="Aucune inscription en attente." /></div>;
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
            <div className="flex flex-shrink-0 flex-wrap gap-2">
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

  async function rejeter() {
    setEnCours(true);
    setErreur(null);
    try {
      await rejectUser(user.id, motif.trim() || undefined);
      onRejected(user.id);
    } catch (err) {
      setErreur(messageErreur(err, 'Impossible de rejeter cette inscription'));
      setEnCours(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Rejeter l’inscription"
      sousTitre={`${user.firstName} ${user.lastName} · ${user.email}`}
      onClose={onClose}
      onSubmit={rejeter}
      largeur={560}
      enCours={enCours}
      erreur={erreur}
      danger
      libelleValider="Rejeter la demande"
      pied="La personne peut refaire une demande."
    >
      <p className="mb-3.5 rounded-[10px] bg-gold-50 px-3.5 py-2.5 text-[12.5px] text-ink">
        La demande est supprimée. La personne reçoit un email lui indiquant qu’elle n’a pas été retenue et qu’elle peut en refaire une.
      </p>
      <ZoneTexte id="rejet-motif" label="Motif repris dans l’email" facultatif value={motif} onChange={setMotif} maxLength={500} />
    </FenetreFormulaire>
  );
}
