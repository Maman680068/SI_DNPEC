'use client';

import { useCallback, useEffect, useState } from 'react';
import { creerPieceRequise, getPiecesRequises, modifierPieceRequise } from '../../lib/api/rh';
import type { ListePieces } from '../../lib/rh/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

/** Pièces exigées pour un dossier complet : la liste nomme la pièce manquante dans les alertes. */
export function OngletPieces() {
  const [l, setL] = useState<ListePieces | null>(null);
  const [libelle, setLibelle] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => getPiecesRequises().then(setL).catch((x) => setErreur(messageChargement(x))), []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  return (
    <div className="max-w-[720px]" data-testid="pieces-requises">
      <ErreurChargement message={erreur} />
      <ul className="mb-4 divide-y divide-line rounded-lg border border-line bg-surface">
        {l.pieces.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
            <span className={p.actif ? '' : 'text-text-faint line-through'}>{p.libelle}</span>
            <span className="flex items-center gap-2">
              {!p.actif && <Badge tone="muted">Retirée</Badge>}
              {l.droits.gerer && (
                <Button variant="outline" className="!px-3 !py-1 !text-[12px]" onClick={() => modifierPieceRequise(p.id, { actif: !p.actif }).then(charger).catch((x) => setErreur(messageChargement(x)))}>
                  {p.actif ? 'Retirer' : 'Rétablir'}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {l.droits.gerer && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setErreur(null);
            creerPieceRequise(libelle).then(() => (setLibelle(''), charger())).catch((x) => setErreur(messageChargement(x)));
          }}
        >
          <label className="min-w-[240px] flex-1 text-[12.5px] font-semibold">
            Nouvelle pièce requise
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px]" />
          </label>
          <Button type="submit" variant="solid" disabled={libelle.trim().length < 3}>Ajouter la pièce</Button>
        </form>
      )}
    </div>
  );
}
