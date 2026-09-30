'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { rechercher } from '../../../lib/api/pilotage';
import type { Recherche } from '../../../lib/pilotage/types';
import {
  Chargement,
  ErreurChargement,
  messageChargement,
} from '../../../components/ui/ErreurChargement';

/** Lien « voir tout » : l'écran du module, avec son propre filtre de recherche. */
const ECRAN: Record<string, (q: string) => string> = {
  taches: () => '/tasks',
  documents: (q) => `/documents?q=${encodeURIComponent(q)}`,
  courrier: () => '/courrier',
  annuaire: (q) => `/annuaire?q=${encodeURIComponent(q)}`,
  reunions: () => '/reunions',
};

/** Résultats de la recherche transverse (socle N5) : 5 par catégorie, limités aux droits de chacun. */
export default function RecherchePage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-muted">Chargement…</p>}>
      <Resultats />
    </Suspense>
  );
}

function Resultats() {
  // La barre du haut change l'adresse sans recharger la page : les résultats suivent `q`.
  const q = useSearchParams().get('q') ?? '';
  const [r, setR] = useState<Recherche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    setR(null);
    setErreur(null);
    if (q.trim().length < 3)
      return setErreur('Saisissez au moins 3 caractères dans la barre de recherche.');
    rechercher(q)
      .then(setR)
      .catch((e) => setErreur(messageChargement(e)));
  }, [q]);

  return (
    <div className="max-w-[900px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">
        Recherche
      </div>
      <h1 className="mb-1 text-[22px] font-extrabold">Résultats pour « {q} »</h1>
      <p className="mb-5 text-[13px] text-text-muted">
        Seuls les éléments que vous pouvez consulter apparaissent. Les filtres détaillés restent
        disponibles dans chaque module.
      </p>
      <ErreurChargement message={erreur} />
      {!r ? (
        <Chargement erreur={erreur} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {r.categories.map((c) => (
            <section
              key={c.cle}
              data-testid={`categorie-${c.cle}`}
              className="rounded-lg border border-line bg-surface p-4"
            >
              <h2 className="mb-2 text-[14px] font-bold">
                {c.libelle}{' '}
                <span className="font-normal text-text-faint">
                  ({c.resultats.length}
                  {c.autres ? '+' : ''})
                </span>
              </h2>
              {c.resultats.length === 0 ? (
                <p className="text-[12.5px] text-text-faint">Aucun résultat.</p>
              ) : (
                <ul className="space-y-1.5">
                  {c.resultats.map((x) => (
                    <li key={x.id}>
                      <Link href={x.lien} className="block rounded px-1.5 py-1 hover:bg-bg">
                        <span className="text-[13px] font-semibold text-ink">{x.libelle}</span>
                        {x.detail && (
                          <span className="block text-[12px] text-text-muted">{x.detail}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {c.autres && (
                <Link
                  href={ECRAN[c.cle]?.(q) ?? '/dashboard'}
                  className="mt-2 inline-block text-[12.5px] text-ink underline"
                >
                  Voir tout dans le module
                </Link>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
