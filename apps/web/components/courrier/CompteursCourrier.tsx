'use client';

import Link from 'next/link';
import type { TableauDeBordCourrier } from '../../lib/courrier/types';

export type Rubrique = keyof TableauDeBordCourrier;

export const RUBRIQUES: { cle: Rubrique; libelle: (n: number) => string }[] = [
  { cle: 'aImputer', libelle: (n) => `${n} à imputer` },
  { cle: 'aTraiter', libelle: (n) => `${n} à traiter` },
  { cle: 'enRetard', libelle: (n) => `${n} en retard` },
  { cle: 'aViser', libelle: (n) => `${n} à viser` },
  { cle: 'aSigner', libelle: (n) => `${n} à signer` },
  { cle: 'aExpedier', libelle: (n) => `${n} à expédier` },
  { cle: 'priseDeConnaissance', libelle: (n) => `${n} à prendre en connaissance` },
  { cle: 'brouillons', libelle: (n) => `${n} brouillon${n > 1 ? 's' : ''} à reprendre` },
];

/** Compteurs non nuls du tableau de bord courrier, chacun lien vers sa rubrique
 * de « À faire ». Aucun compteur à zéro n'est affiché. */
export function CompteursCourrier({
  tableau,
  actif,
  onChoisir,
}: {
  tableau: TableauDeBordCourrier;
  actif?: Rubrique | null;
  /** Sur /courrier : change de rubrique sans navigation. Ailleurs : lien. */
  onChoisir?: (r: Rubrique) => void;
}) {
  const visibles = RUBRIQUES.filter((r) => tableau[r.cle] > 0);
  if (visibles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {visibles.map((r) => {
        const cls = `rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
          actif === r.cle ? 'border-ink bg-ink text-white' : r.cle === 'enRetard' ? 'border-clay bg-clay-soft text-clay' : 'border-line bg-surface text-ink hover:bg-bg'
        }`;
        return onChoisir ? (
          <button key={r.cle} type="button" onClick={() => onChoisir(r.cle)} className={cls}>
            {r.libelle(tableau[r.cle])}
          </button>
        ) : (
          <Link key={r.cle} href={`/courrier?rubrique=${r.cle}`} className={cls}>
            {r.libelle(tableau[r.cle])}
          </Link>
        );
      })}
    </div>
  );
}
