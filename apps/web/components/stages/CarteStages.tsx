'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStages } from '../../lib/api/stages';

/** Carte « Stagiaires » du tableau de bord : périodes à accepter, évaluations à
 * rédiger ou à viser (compteurs de l'API). Rien si tout est à zéro. */
export function CarteStages() {
  const [n, setN] = useState(0);
  useEffect(() => {
    getStages()
      .then((l) => setN(l.stages.reduce((t, s) => t + s.aTraiter, 0)))
      .catch(() => setN(0));
  }, []);
  if (n === 0) return null;
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3.5" data-testid="carte-stages">
      <h2 className="text-[14px] font-extrabold">🎓 Stagiaires — {n} élément{n > 1 ? 's' : ''} à traiter</h2>
      <Link href="/stages" className="text-[12.5px] font-semibold text-accent hover:underline">
        Ouvrir →
      </Link>
    </section>
  );
}
