'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { rechercher } from '../../../lib/api/pilotage';
import type { Recherche } from '../../../lib/pilotage/types';
import { ErreurChargement, messageChargement } from '../../../components/ui/ErreurChargement';
import { BarreOutils, BTN_LIGNE, EnTetePage, EtatVide, Filtres, FiltreSelect, Panneau } from '../../../components/ui/Charte';
import { SqueletteCartes, SquelettePage } from '../../../components/ui/Squelette';

/** Lien « voir tout » : l'écran du module, avec son propre filtre de recherche. */
const ECRAN: Record<string, (q: string) => string> = {
  taches: () => '/tasks',
  activites: () => '/plan-travail',
  documents: (q) => `/documents?q=${encodeURIComponent(q)}`,
  courrier: () => '/courrier',
  annuaire: (q) => `/annuaire?q=${encodeURIComponent(q)}`,
  reunions: () => '/reunions',
};

/** Résultats de la recherche transverse (socle N5) : 5 par catégorie, limités aux droits de chacun. */
export default function RecherchePage() {
  return (
    <Suspense fallback={<SquelettePage />}>
      <Resultats />
    </Suspense>
  );
}

function Resultats() {
  // La barre du haut change l'adresse sans recharger la page : les résultats suivent `q`.
  const q = useSearchParams().get('q') ?? '';
  const [r, setR] = useState<Recherche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Filtre d'affichage : une seule catégorie (les résultats restent ceux de l'API).
  const [categorie, setCategorie] = useState('');
  const tropCourt = q.trim().length < 3;
  useEffect(() => {
    setR(null);
    setErreur(null);
    if (tropCourt) return;
    rechercher(q)
      .then(setR)
      .catch((e) => setErreur(messageChargement(e)));
  }, [q, tropCourt]);
  const categories = r ? r.categories.filter((c) => !categorie || c.cle === categorie) : [];

  return (
    <div>
      <EnTetePage titre={`Résultats pour « ${q} »`} sousTitre={r ? `${r.categories.reduce((t, c) => t + c.resultats.length, 0)} résultat(s)` : undefined} />
      <p className="-mt-1.5 mb-4 text-[13px] text-text-muted">
        Seuls les éléments que vous pouvez consulter apparaissent. Les filtres détaillés restent
        disponibles dans chaque module.
      </p>
      <ErreurChargement message={erreur} />
      {r && (
        <BarreOutils>
          <Filtres actifs={categorie ? 1 : 0} onEffacer={() => setCategorie('')}>
            <FiltreSelect
              label="Catégorie"
              value={categorie}
              defaut=""
              onChange={setCategorie}
              options={[{ value: '', label: 'Catégorie : toutes' }, ...r.categories.map((c) => ({ value: c.cle, label: c.libelle }))]}
            />
          </Filtres>
        </BarreOutils>
      )}
      {tropCourt ? (
        <div className="rounded-xl border border-line bg-surface">
          <EtatVide texte="Saisissez au moins 3 caractères dans la barre de recherche, en haut de la page." />
        </div>
      ) : !r ? (
        erreur ? null : <SqueletteCartes cartes={4} />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {categories.map((c) => (
            <Panneau
              key={c.cle}
              testid={`categorie-${c.cle}`}
              titre={c.libelle}
              compteur={
                <span className="text-[12.5px] font-semibold text-text-faint">
                  {c.resultats.length}
                  {c.autres ? '+' : ''}
                </span>
              }
              action={
                c.autres && (
                  <Link href={ECRAN[c.cle]?.(q) ?? '/dashboard'} className={BTN_LIGNE}>
                    Voir tout dans le module
                  </Link>
                )
              }
            >
              {c.resultats.length === 0 ? (
                <p className="px-[18px] py-3.5 text-[13px] text-text-muted">Aucun résultat.</p>
              ) : (
                <ul>
                  {c.resultats.map((x) => (
                    <li key={x.id} className="border-b border-[#F0F1F6] last:border-b-0">
                      <Link href={x.lien} className="block px-[18px] py-2.5 hover:bg-[#F6F7FC]">
                        <span className="text-[13.5px] font-semibold text-ink-900">{x.libelle}</span>
                        {x.detail && (
                          <span className="block text-[12px] text-text-muted">{x.detail}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panneau>
          ))}
        </div>
      )}
    </div>
  );
}
