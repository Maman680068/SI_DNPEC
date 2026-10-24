'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Menu en haut : les icônes de la barre du haut (messagerie, notifications, intérim) sont posées sur
 * le bandeau ink-900 sur écran large, sur fond clair sur téléphone. La barre du haut fournit ce
 * contexte ; chaque icône choisit ses classes (plus aucune surcharge CSS).
 */
const SurBandeau = createContext(false);
export const SurBandeauProvider = SurBandeau.Provider;
export const useSurBandeau = () => useContext(SurBandeau);

/** Classes d'un bouton-icône de la barre du haut selon son fond. */
export function classesIcone(surBandeau: boolean): string {
  return surBandeau
    ? 'text-white hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold'
    : 'text-ink hover:bg-bg';
}

/** Bord de la pastille d'une icône : couleur du fond, pour la détacher de l'icône. */
export function bordPastille(surBandeau: boolean): string {
  return surBandeau ? 'border-ink-900' : 'border-surface';
}

const REQUETE_LARGE = '(min-width: 768px)';
function abonner(rappel: () => void) {
  const m = window.matchMedia(REQUETE_LARGE);
  m.addEventListener('change', rappel);
  return () => m.removeEventListener('change', rappel);
}

/** Écran large (≥ md, 768 px) : menu en haut ; sinon barre du haut et tiroir du menu. */
export function useEcranLarge(): boolean {
  return useSyncExternalStore(
    abonner,
    () => window.matchMedia(REQUETE_LARGE).matches,
    () => true,
  );
}
