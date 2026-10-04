'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTableauLogistique } from '../../lib/api/logistique';
import type { TableauLogistique } from '../../lib/logistique/types';

/** Carte « Logistique » du tableau de bord : demandes à valider, à traiter,
 * réservations à valider, stock bas (compteurs de l'API). Rien si tout est à zéro. */
export function CarteLogistique() {
  const [t, setT] = useState<TableauLogistique | null>(null);
  useEffect(() => {
    getTableauLogistique()
      .then(setT)
      .catch(() => setT(null));
  }, []);
  if (!t) return null;
  const elements = [
    t.aValider > 0 && `${t.aValider} demande${t.aValider > 1 ? 's' : ''} à valider`,
    t.gestionnaire && t.aTraiter > 0 && `${t.aTraiter} à traiter`,
    t.gestionnaire && t.reservationsAValider > 0 && `${t.reservationsAValider} réservation${t.reservationsAValider > 1 ? 's' : ''} à valider`,
    t.gestionnaire && t.stockBas > 0 && `${t.stockBas} article${t.stockBas > 1 ? 's' : ''} sous le seuil`,
  ].filter(Boolean);
  if (elements.length === 0) return null;
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3.5" data-testid="carte-logistique">
      <h2 className="text-[14px] font-extrabold">Logistique — {elements.join(' · ')}</h2>
      <Link href="/logistique" className="text-[12.5px] font-semibold text-accent hover:underline">
        Ouvrir →
      </Link>
    </section>
  );
}
