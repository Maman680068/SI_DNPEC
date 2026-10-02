'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTableauRole, type TableauRole } from '../../lib/api/tableau-de-bord';
import { ErreurChargement, messageChargement } from '../ui/ErreurChargement';

/** Blocs du tableau de bord propres au rôle (socle N6, A6.6) ; le bloc « tâches » est déjà en tête. */
export function BlocsRole() {
  const [t, setT] = useState<TableauRole | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getTableauRole().then(setT).catch((x) => setErreur(messageChargement(x)));
  }, []);
  if (erreur) return <ErreurChargement message={erreur} />;
  if (!t) return null;
  const blocs = t.blocs.filter((b) => b.cle !== 'taches');
  return (
    <section aria-label="Mon tableau de bord" data-testid="blocs-role" className="mb-[22px] grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {blocs.map((b) => (
        <article key={b.cle} data-testid={`bloc-${b.cle}`} className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h2 className="text-[13.5px] font-bold">{b.titre}</h2>
            {b.valeur !== undefined && b.valeur !== null && <span className="text-[22px] font-extrabold leading-none">{b.valeur}</span>}
          </div>
          {b.sousTitre && <p className="mb-2 text-[12px] text-text-muted">{b.sousTitre}</p>}
          {b.elements && b.elements.length > 0 ? (
            <ul className="space-y-1 text-[12.5px]">
              {b.elements.map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  {e.lien ? <Link href={e.lien} className="min-w-0 truncate font-semibold text-accent">{e.libelle}</Link> : <span className="min-w-0 truncate">{e.libelle}</span>}
                  {e.detail && <span className="flex-shrink-0 text-text-muted">{e.detail}</span>}
                </li>
              ))}
            </ul>
          ) : (
            b.vide && (!b.valeur || b.valeur === 0) && <p className="text-[12.5px] text-text-muted">{b.vide}</p>
          )}
          {b.lien && <Link href={b.lien} aria-label={`Ouvrir : ${b.titre}`} className="mt-2 inline-block text-[12px] font-semibold text-accent">Ouvrir</Link>}
        </article>
      ))}
    </section>
  );
}
