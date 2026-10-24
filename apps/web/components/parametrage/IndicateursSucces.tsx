'use client';

import { useCallback, useEffect, useState } from 'react';
import { getIndicateursSucces, modifierParametre } from '../../lib/api/securite';
import type { IndicateurSucces, IndicateursSucces as Donnees } from '../../lib/securite/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';
import { BTN_LIGNE, LigneTableau, Pastille, Tableau } from '../ui/Charte';
import { messageErreur, useToast } from '../ui/Toast';

const GRILLE = 'lg:grid-cols-[minmax(0,2.2fr)_150px_130px_110px_minmax(0,1.6fr)]';
const nombre = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const avecUnite = (v: number, unite: string) => (unite === '%' ? `${nombre(v)} %` : `${nombre(v)} ${unite}`);

/** Cible d'un indicateur : lue par tous, modifiable par l'administrateur (bornes contrôlées par l'API). */
function Cible({ i, peutModifier, min, max, onEnregistree }: { i: IndicateurSucces; peutModifier: boolean; min: number; max: number; onEnregistree: () => void }) {
  const toast = useToast();
  const [valeur, setValeur] = useState(String(i.cible));
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => setValeur(String(i.cible)), [i.cible]);
  const texte = `${i.sens === 'MAX' ? 'au plus ' : 'au moins '}${avecUnite(i.cible, i.unite)}`;
  if (!peutModifier) return <span data-testid="cible">{texte}</span>;
  const id = `cible-${i.cle}`;
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        try {
          await modifierParametre(i.cleCible, Number(valeur));
          toast.succes('Cible enregistrée', { detail: `${i.libelle} : ${valeur} ${i.unite}` });
          onEnregistree();
        } catch (err) {
          toast.erreur('Cible non enregistrée', messageErreur(err));
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        Cible — {i.libelle} ({i.unite}, de {min} à {max})
      </label>
      <span className="text-[12px] text-text-muted">{i.sens === 'MAX' ? '≤' : '≥'}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className="h-8 w-[64px] rounded-md border border-line bg-surface px-2 text-[13px] text-text"
      />
      <span className="text-[12px] text-text-muted">{i.unite === '%' ? '%' : 'j'}</span>
      {valeur !== String(i.cible) && (
        <button type="submit" disabled={envoi} className={BTN_LIGNE}>
          Enregistrer
        </button>
      )}
    </form>
  );
}

/**
 * Onglet « Indicateurs de succès » (docs/conception_indicateurs_succes.md) : valeurs calculées par l'API à
 * la lecture à partir des vraies données ; cibles modifiables par l'administrateur, lues par le DN et la DNA.
 */
export function IndicateursSucces() {
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => {
    getIndicateursSucces()
      .then(setD)
      .catch((e) => setErreur(messageChargement(e)));
  }, []);
  useEffect(charger, [charger]);
  if (!d) return <Chargement erreur={erreur} />;
  const bornes = new Map(d.cibles.map((c) => [c.cle, c]));
  return (
    <div className="mt-4">
      <ErreurChargement message={erreur} />
      <p className="mb-3 text-[13px] text-text-muted">
        Calculés à la lecture à partir des données de l’application (rien n’est enregistré), le {new Date(d.calculeLe).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}.
        {d.droits.peutModifier ? ' Vous pouvez ajuster chaque cible.' : ' Lecture seule : seul l’administrateur ajuste les cibles.'}
      </p>
      <Tableau label="Indicateurs de succès" testid="indicateurs-succes" grille={GRILLE} colonnes={['Indicateur', 'Cible', 'Valeur mesurée', 'Atteint', 'Période de mesure']}>
        {d.indicateurs.map((i) => (
          <LigneTableau key={i.cle} grille={GRILLE} testid="indicateur" label={i.libelle}>
            <span className="font-semibold" data-cle={i.cle}>
              {i.libelle}
            </span>
            <Cible i={i} peutModifier={d.droits.peutModifier} min={bornes.get(i.cleCible)?.min ?? 0} max={bornes.get(i.cleCible)?.max ?? 100} onEnregistree={charger} />
            <span data-testid="valeur">
              {i.valeur === null ? <span className="text-text-muted">Non mesurable</span> : avecUnite(i.valeur, i.unite)}
              <span className="block text-[12px] text-text-muted">
                sur {i.base} élément{i.base > 1 ? 's' : ''}
              </span>
            </span>
            <span data-testid="atteint">
              {i.atteint === null ? <Pastille ton="gris">—</Pastille> : i.atteint ? <Pastille ton="vert">Oui</Pastille> : <Pastille ton="rouge">Non</Pastille>}
            </span>
            <span className="text-[12.5px] text-text-muted">{i.periode}</span>
          </LigneTableau>
        ))}
      </Tableau>
    </div>
  );
}
