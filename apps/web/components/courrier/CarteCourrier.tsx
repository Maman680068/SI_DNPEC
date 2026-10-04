'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { getTableauDeBord } from '../../lib/api/courrier';
import type { TableauDeBordCourrier } from '../../lib/courrier/types';
import { CompteursCourrier, RUBRIQUES } from './CompteursCourrier';

/**
 * Carte « Courrier » du tableau de bord général : compteurs non nuls de
 * GET /courrier/tableau-de-bord (rôle emprunté pendant un intérim : la page
 * est remontée et la requête porte X-Interim-For), chacun ouvrant sa rubrique
 * sur /courrier. Rien si tout est à zéro (pour l'administrateur système, qui
 * n'a que son courrier personnel, elle n'apparaît donc que s'il a un élément
 * personnel en attente).
 */
export function CarteCourrier() {
  const [tableau, setTableau] = useState<TableauDeBordCourrier | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    getTableauDeBord()
      .then(setTableau)
      .catch(() => setErreur(true));
  }, []);

  if (erreur) {
    return <p className="mb-5 text-[12.5px] text-text-faint">Courrier : compteurs momentanément indisponibles.</p>;
  }
  if (!tableau || !RUBRIQUES.some((r) => tableau[r.cle] > 0)) return null;
  return (
    <section className="mb-5 rounded-lg border border-line bg-surface px-4 py-3.5" data-testid="carte-courrier">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-extrabold">
          <Mail aria-hidden size={16} />
          Courrier
        </h2>
        <Link href="/courrier" className="text-[12.5px] font-semibold text-accent hover:underline">
          Ouvrir le courrier →
        </Link>
      </div>
      <CompteursCourrier tableau={tableau} />
    </section>
  );
}
