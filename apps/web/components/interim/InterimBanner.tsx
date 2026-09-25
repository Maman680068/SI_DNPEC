'use client';

import { useInterim } from '../../lib/interim/InterimProvider';
import { ROLE_LABEL } from '../../lib/users/types';

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Bandeau permanent tant qu'un intérim est actif dans l'onglet — personne ne
 * doit pouvoir agir « au nom de » quelqu'un sans le voir en permanence. Affiche
 * aussi, une fois, le motif d'une sortie automatique d'intérim. */
export function InterimBanner() {
  const { interim, notice, stopInterim, dismissNotice } = useInterim();

  if (interim) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gold bg-gold-soft px-4 py-2.5 text-[12.5px] text-ink md:px-[26px]"
      >
        <span className="font-bold">Mode intérim</span>
        {/* Mobile : titre + bouton sur une ligne, texte pleine largeur dessous ;
         * à partir de md : titre, texte extensible, bouton à droite. */}
        <button
          onClick={stopInterim}
          className="ml-auto rounded-md border border-ink/30 bg-surface px-3 py-1.5 text-[12px] font-semibold hover:bg-bg md:order-last md:ml-0"
        >
          Quitter l’intérim
        </button>
        <span className="min-w-0 basis-full md:basis-0 md:flex-1">
          Vous agissez au nom de <strong>{interim.titulaireName}</strong> ({ROLE_LABEL[interim.titulaireRole]}), jusqu’au{' '}
          {formatDay(interim.endDate)}. Vos actions sont journalisées « par intérim, au nom de ».
        </span>
      </div>
    );
  }

  if (notice) {
    return (
      <div role="alert" className="flex items-center gap-3 border-b border-clay/40 bg-clay-soft px-4 py-2.5 text-[12.5px] text-clay md:px-[26px]">
        <span className="min-w-0 flex-1">{notice}</span>
        <button onClick={dismissNotice} aria-label="Fermer" className="font-bold">
          ✕
        </button>
      </div>
    );
  }

  return null;
}
