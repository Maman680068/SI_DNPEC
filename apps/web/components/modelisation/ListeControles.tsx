'use client';

import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { Controle } from '../../lib/modelisation/types';
import type { TonPastille } from '../ui/Charte';

/** Ton d'un état de version (API) → pastille de la charte. */
export const TON_VERSION: Record<string, TonPastille> = { bleu: 'bleu', or: 'ambre', vert: 'vert', rouge: 'rouge', gris: 'gris' };

/** Rond d'état d'un contrôle : réussi (vert), alerte (ambre « ! »), bloquant en échec (rouge). */
function Rond({ c }: { c: Controle }) {
  if (c.ok)
    return (
      <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-sage text-white">
        <Check aria-hidden size={15} strokeWidth={3} />
      </span>
    );
  if (c.type === 'alerte')
    return (
      <span aria-hidden className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-gold text-[14px] font-extrabold text-ink-900">
        !
      </span>
    );
  return (
    <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-clay text-white">
      <X aria-hidden size={15} strokeWidth={3} />
    </span>
  );
}

const etat = (c: Controle) => (c.ok ? 'réussi' : c.type === 'alerte' ? 'alerte' : 'bloquant en échec');

/**
 * Contrôles de dépôt d'une version (maquettes mod-2 et mod-4) : libellé, seuil, valeur technique à
 * droite (écart, résidu…). Ces valeurs sont techniques : l'administrateur les voit (décision n° 3).
 */
export function ListeControles({ controles, apres }: { controles: Controle[]; apres?: (c: Controle) => ReactNode }) {
  return (
    <ul className="divide-y divide-[#EEF0F5]" data-testid="controles">
      {controles.map((c) => (
        <li key={c.id} className="flex items-start gap-3 py-2.5" data-testid="controle" data-etat={c.ok ? 'ok' : c.type}>
          <Rond c={c} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[14px] font-bold text-ink-900">
                {c.libelle}
                <span className="sr-only"> : {etat(c)}</span>
              </span>
              <span className={`text-[13px] font-bold ${c.ok ? 'text-sage' : c.type === 'alerte' ? 'text-ambre' : 'text-clay'}`}>{c.valeur}</span>
            </div>
            <div className="text-[12.5px] text-text-muted">
              {c.type === 'bloquant' ? 'Contrôle bloquant' : 'Alerte'}
              {c.seuil ? ` · seuil ${c.seuil}` : ''}
              {!c.ok && c.type === 'alerte' ? ' · à vérifier par le responsable du modèle' : ''}
            </div>
            {apres?.(c)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Taille lisible (Mo, Ko). */
export const taillePaquet = (o: number) => (o >= 1024 * 1024 ? `${(o / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
export const empreinteCourte = (e: string) => `${e.slice(0, 4)}…${e.slice(-4)}`;
