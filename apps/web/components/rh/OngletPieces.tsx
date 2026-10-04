'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { creerPieceRequise, getPiecesRequises, modifierPieceRequise } from '../../lib/api/rh';
import type { ListePieces } from '../../lib/rh/types';
import { BTN_LIGNE, BTN_PRINCIPAL, EtatVide, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { messageErreur, useToast } from '../ui/Toast';

const GRILLE = 'lg:grid-cols-[minmax(0,1fr)_120px_110px]';

/** Pièces exigées pour un dossier complet : la liste nomme la pièce manquante dans les alertes. */
export function OngletPieces() {
  const [l, setL] = useState<ListePieces | null>(null);
  const [libelle, setLibelle] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const toast = useToast();
  const charger = useCallback(() => getPiecesRequises().then(setL).catch((x) => setErreur(messageChargement(x))), []);
  useEffect(() => {
    charger();
  }, [charger]);
  if (!l) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  return (
    <div className="max-w-[820px]" data-testid="pieces-requises">
      <ErreurChargement message={erreur} />
      {l.droits.gerer && (
        <form
          className="mb-3.5 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const l = libelle.trim();
            creerPieceRequise(l)
              .then(() => {
                setLibelle('');
                charger();
                toast.succes('Pièce requise ajoutée', { detail: `« ${l} » est désormais exigée pour un dossier complet.` });
              })
              .catch((x) => toast.erreur('Ajout impossible', messageErreur(x)));
          }}
        >
          <label className="min-w-0 flex-1 basis-[240px] text-[13px] font-semibold">
            Nouvelle pièce requise
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} className="mt-1 h-[38px] w-full rounded-[9px] border border-line bg-surface px-3 text-[13.5px] font-normal" />
          </label>
          <button type="submit" className={BTN_PRINCIPAL} disabled={libelle.trim().length < 3}>
            <Plus aria-hidden size={16} /> Ajouter la pièce
          </button>
        </form>
      )}
      <Tableau
        label="Pièces requises"
        grille={GRILLE}
        colonnes={['Pièce', 'État', <span key="a" className="sr-only">Actions</span>]}
        vide={<EtatVide texte="Aucune pièce requise : ajoutez la première ci-dessus." />}
        pied={<span>Une pièce retirée n’est plus exigée pour un dossier complet.</span>}
      >
        {l.pieces.map((p) => (
          <LigneTableau key={p.id} grille={GRILLE}>
            <span className={p.actif ? 'font-semibold text-ink-900' : 'text-text-muted line-through'}>{p.libelle}</span>
            {p.actif ? <Pastille ton="vert">Exigée</Pastille> : <Pastille ton="gris">Retirée</Pastille>}
            <span className="flex lg:justify-end">
              {l.droits.gerer && (
                <button type="button" className={BTN_LIGNE} onClick={() =>
                    modifierPieceRequise(p.id, { actif: !p.actif })
                      .then(() => {
                        charger();
                        toast.succes(p.actif ? 'Pièce retirée' : 'Pièce rétablie', {
                          detail: p.libelle,
                          annuler: () => void modifierPieceRequise(p.id, { actif: p.actif }).then(charger).catch((x) => toast.erreur('Action impossible', messageErreur(x))),
                        });
                      })
                      .catch((x) => toast.erreur('Action impossible', messageErreur(x)))
                  }>
                  {p.actif ? 'Retirer' : 'Rétablir'}
                </button>
              )}
            </span>
          </LigneTableau>
        ))}
      </Tableau>
    </div>
  );
}
