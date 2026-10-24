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
function abonnerA(requete: string) {
  return (rappel: () => void) => {
    const m = window.matchMedia(requete);
    m.addEventListener('change', rappel);
    return () => m.removeEventListener('change', rappel);
  };
}
const abonnements = new Map<string, (rappel: () => void) => () => void>();
/** Vrai quand la requête média est satisfaite ; `parDefaut` côté serveur. */
function useRequeteMedia(requete: string, parDefaut: boolean): boolean {
  if (!abonnements.has(requete)) abonnements.set(requete, abonnerA(requete));
  return useSyncExternalStore(abonnements.get(requete)!, () => window.matchMedia(requete).matches, () => parDefaut);
}

/** Écran large (≥ md, 768 px) : menu en haut ; sinon barre du haut et tiroir du menu. */
export function useEcranLarge(): boolean {
  return useRequeteMedia(REQUETE_LARGE, true);
}

/** Écran d'au moins 1280 px (xl) : la recherche du bandeau a la place d'un texte d'exemple complet. */
export function useEcranTresLarge(): boolean {
  return useRequeteMedia('(min-width: 1280px)', true);
}
