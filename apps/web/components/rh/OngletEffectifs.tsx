'use client';

import { useEffect, useState } from 'react';
import { getEffectifs } from '../../lib/api/rh';
import type { Effectifs, Repartition } from '../../lib/rh/types';
import { Chargement, ErreurChargement, messageChargement } from '../ui/ErreurChargement';

function Repartitions({ titre, lignes, total }: { titre: string; lignes: Repartition[]; total: number }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-label={titre}>
      <h2 className="mb-2.5 text-[13.5px] font-bold">{titre}</h2>
      <ul className="space-y-1.5">
        {lignes.map((l) => (
          <li key={l.libelle} className="text-[12.5px]">
            <div className="flex justify-between gap-2">
              <span>{l.libelle}</span>
              <span className="font-semibold">{l.nombre}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded bg-bg" aria-hidden="true">
              <div className="h-1.5 rounded bg-accent" style={{ width: `${total ? Math.round((l.nombre / total) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Effectifs (A3.5) : répartitions calculées à chaque lecture depuis les agents et leurs dossiers. */
export function OngletEffectifs() {
  const [e, setE] = useState<Effectifs | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    getEffectifs().then(setE).catch((x) => setErreur(messageChargement(x)));
  }, []);
  if (!e) return <><ErreurChargement message={erreur} /><Chargement erreur={erreur} /></>;
  const indicateurs: [string, string, string][] = [
    ['Agents en fonction', String(e.total), 'hors départs confirmés'],
    ['Ancienneté moyenne', e.ancienneteMoyenneAnnees !== null ? `${e.ancienneteMoyenneAnnees} ans` : '—', `${e.ancienneteRenseignee} date(s) de prise de service renseignée(s)`],
    ['Part des femmes', e.partFemmes !== null ? `${e.partFemmes} %` : '—', `${e.femmes} sur ${e.genreRenseigne} genre(s) renseigné(s)`],
  ];
  return (
    <div data-testid="effectifs">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {indicateurs.map(([t, v, s]) => (
          <div key={t} className="rounded-lg border border-line bg-surface p-4">
            <div className="text-[12px] font-semibold text-text-muted">{t}</div>
            <div className="text-[26px] font-extrabold">{v}</div>
            <div className="text-[11.5px] text-text-muted">{s}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Repartitions titre="Par unité" lignes={e.parUnite} total={e.total} />
        <Repartitions titre="Par statut" lignes={e.parStatut} total={e.total} />
        <Repartitions titre="Par catégorie" lignes={e.parCategorie} total={e.total} />
      </div>
      <p className="mt-3 text-[11.5px] text-text-muted">Calculé le {new Date(e.calculeLe).toLocaleString('fr-FR')} à partir des dossiers ; rien n’est saisi ici.</p>
    </div>
  );
}
