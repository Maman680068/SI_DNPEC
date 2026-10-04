'use client';

import Link from 'next/link';
import type { TableauDeBordCourrier } from '../../lib/courrier/types';

/** Rubriques de « À faire » (ce qui attend la personne, par les droits de l'API). */
export type Rubrique = 'aImputer' | 'aTraiter' | 'enRetard' | 'aViser' | 'aSigner' | 'aExpedier' | 'priseDeConnaissance' | 'brouillons';

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

/** Nombre d'éléments distincts qui attendent la personne (« En retard » est contenu dans « À traiter »). */
export const totalAFaire = (t: TableauDeBordCourrier) => RUBRIQUES.filter((r) => r.cle !== 'enRetard').reduce((s, r) => s + t[r.cle], 0);

/** Compteurs non nuls de « À faire », chacun filtre sa rubrique. Aucun compteur à zéro n'est affiché. */
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
    <div className="mb-3.5 flex flex-wrap gap-2" data-testid="rubriques">
      {visibles.map((r) => {
        const on = actif === r.cle;
        const cls = `inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold ${
          on ? 'border-ink bg-ink text-white' : r.cle === 'enRetard' ? 'border-[#E7B3BB] bg-clay-50 text-clay' : 'border-line bg-surface text-ink hover:bg-bg'
        }`;
        return onChoisir ? (
          <button key={r.cle} type="button" onClick={() => onChoisir(r.cle)} className={cls} aria-pressed={on}>
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
