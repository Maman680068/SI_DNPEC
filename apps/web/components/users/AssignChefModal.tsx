'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { assignCelluleChef } from '../../lib/api/org';
import type { AdminUser } from '../../lib/users/types';
import { FenetreFormulaire, Liste, ZoneTexte } from '../ui/Formulaire';
import { messageErreur } from '../ui/Toast';

/**
 * Nomme `user` chef d'une cellule (POST /org/cellules/:id/chef) — même mécanisme
 * que tout changement de rôle : motif obligatoire, Cellule.chefId posé dans la même
 * transaction, historique et audit. Une cellule qui a déjà un chef est refusée
 * (409) : il faut d'abord changer le rôle de ce chef.
 */
export function AssignChefModal({
  user,
  onClose,
  onAssigned,
}: {
  user: AdminUser;
  onClose: () => void;
  onAssigned: (cellule: string) => void;
}) {
  const { cellules: allCellules, refreshOrg } = useOrg();
  // Une cellule suspendue (§2.3) ne peut pas recevoir de NOUVEAU chef tant
  // qu'elle n'est pas réactivée (CellulesService.assignChef) — exclue ici aussi.
  const cellules = allCellules.filter((c) => c.isActive);
  const [celluleId, setCelluleId] = useState(cellules[0]?.id ?? '');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetCellule = cellules.find((c) => c.id === celluleId);
  const alreadyHasChef = !!targetCellule?.chefId && targetCellule.chefId !== user.id;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await assignCelluleChef(celluleId, user.id, motif.trim());
      await refreshOrg();
      onAssigned(targetCellule?.name ?? '');
    } catch (err) {
      setError(messageErreur(err, 'Impossible de nommer ce chef de cellule'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FenetreFormulaire
      titre="Nommer chef de cellule"
      sousTitre={`${user.firstName} ${user.lastName} · ${user.email}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      largeur={600}
      enCours={submitting}
      erreur={error}
      libelleValider="Nommer chef"
      pied="Tracé dans l’historique ; la personne devra se reconnecter."
      valider={() => (motif.trim() && motif.trim().length < 5 ? { 'motif-chef': 'Le motif doit compter au moins 5 caractères.' } : {})}
    >
      <Liste id="chef-cellule" label="Cellule" value={celluleId} onChange={setCelluleId} required messageObligatoire="Choisissez la cellule." vide={cellules.length ? undefined : 'Aucune cellule active'} options={cellules.map((c) => ({ value: c.id, label: c.name }))} />
      {alreadyHasChef && (
        <p className="mb-3.5 rounded-[10px] bg-clay-50 px-3.5 py-2.5 text-[12.5px] text-clay">
          Cette cellule a déjà un chef : changez d’abord son rôle (il n’est jamais rétrogradé automatiquement).
        </p>
      )}
      <ZoneTexte id="motif-chef" label="Motif" value={motif} onChange={setMotif} required messageObligatoire="Indiquez le motif de la nomination." maxLength={1000} />
    </FenetreFormulaire>
  );
}
