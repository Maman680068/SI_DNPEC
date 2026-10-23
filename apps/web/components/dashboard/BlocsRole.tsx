'use client';

import Link from 'next/link';
import type { BlocTableau } from '../../lib/api/tableau-de-bord';

/** Blocs repris ailleurs sur le tableau de bord (compteurs, « À traiter », colonne droite, plan). */
const REPRIS = ['taches', 'solde', 'demandes', 'reunions', 'encadrement', 'activites', 'conges-avis', 'conges-decision', 'comptes'];

/**
 * Blocs du tableau de bord propres au rôle (socle N6, A6.6), compactés en une ligne chacun
 * (refonte de l'interface) ; un bloc à zéro est masqué.
 */
export function BlocsRole({ blocs }: { blocs: BlocTableau[] }) {
  const visibles = blocs.filter((b) => !REPRIS.includes(b.cle) && (b.valeur ?? 0) > 0);
  if (visibles.length === 0) return null;
  return (
    <section aria-label="Suivi de mon rôle" data-testid="blocs-role" className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-[18px] py-3.5">
        <h2 className="font-heading text-[16px] font-bold text-ink-900">Suivi de mon rôle</h2>
      </div>
      {visibles.map((b, i) => (
        <article key={b.cle} data-testid={`bloc-${b.cle}`} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-[18px] py-2.5 md:grid-cols-[minmax(0,240px)_48px_minmax(0,1fr)_auto] ${i ? 'border-t border-line-doux' : ''}`}>
          <h3 className="truncate text-[13.5px] font-semibold">{b.titre}</h3>
          <span className="font-heading text-[18px] font-extrabold leading-none text-ink md:order-none">{b.valeur}</span>
          <p className="col-span-2 min-w-0 truncate text-[12.5px] text-text-muted md:col-span-1">
            {[b.sousTitre, ...(b.elements ?? []).slice(0, 3).map((e) => (e.detail ? `${e.libelle} (${e.detail})` : e.libelle))].filter(Boolean).join(' · ')}
          </p>
          {b.lien && (
            <Link href={b.lien} aria-label={`Voir : ${b.titre}`} className="hidden text-[12.5px] font-semibold text-ink hover:underline md:inline">
              Voir
            </Link>
          )}
        </article>
      ))}
    </section>
  );
}
