'use client';

import { useState, type FormEvent } from 'react';
import { retirerCelluleChef } from '../../lib/api/org';
import type { Cellule } from '../../lib/org/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { Button } from '../ui/Button';

/** Rôles proposés au chef qui quitte la fonction en restant dans la cellule ;
 * tout autre changement (autre unité, autre fonction) passe par « Changer de
 * rôle » sur la page Utilisateurs. Le serveur revérifie tout. */
const ROLES_APRES_RETRAIT = ['AGENT', 'DRH', 'ADMIN_SYSTEME'] as const;

/** Retrait du chef d'une cellule (POST /org/cellules/:id/chef/retrait) : motif
 * obligatoire, rôle cible (Chargé d'Études par défaut) ; historique, audit,
 * sessions fermées — même mécanisme que tout changement de rôle. */
export function RetirerChefModal({ cellule, chef, onClose, onDone }: { cellule: Cellule; chef: string; onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState<(typeof ROLES_APRES_RETRAIT)[number]>('AGENT');
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await retirerCelluleChef(cellule.id, motif.trim(), role);
      onDone();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Retrait impossible');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,26,38,0.42)] sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Retirer le chef" className="w-full rounded-t-lg bg-surface p-5 sm:max-w-[460px] sm:rounded-lg sm:p-6">
        <h2 className="mb-1 text-[18px] font-semibold">Retirer le chef</h2>
        <p className="mb-4 text-[12.5px] text-text-muted">
          {chef} quitte la direction de {cellule.name} et reste dans la cellule avec le rôle choisi.
        </p>
        <label htmlFor="rc-role" className="mb-1.5 block text-[12.5px] font-semibold">
          Nouveau rôle
        </label>
        <select id="rc-role" className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          {ROLES_APRES_RETRAIT.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <label htmlFor="rc-motif" className="mb-1.5 block text-[12.5px] font-semibold">
          Motif (obligatoire)
        </label>
        <textarea
          id="rc-motif"
          className="mb-4 min-h-[70px] w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          required
          minLength={5}
          maxLength={1000}
        />
        {erreur && (
          <div role="alert" className="mb-4 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">
            {erreur}
          </div>
        )}
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="gold" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Retirer le chef'}
          </Button>
        </div>
      </form>
    </div>
  );
}
