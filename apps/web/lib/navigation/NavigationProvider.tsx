'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getNavigation, type Navigation } from '../api/navigation';
import { EVENEMENT_MESSAGES_LUS } from '../api/communication';
import { useInterim } from '../interim/InterimProvider';

const INTERVALLE_MS = 60_000;

interface NavigationContexte {
  navigation: Navigation | null;
  rafraichir: () => void;
}
const Contexte = createContext<NavigationContexte>({ navigation: null, rafraichir: () => undefined });

/**
 * Compteurs du menu, « À traiter » et menu « Créer » (GET api/v1/navigation) : chargés à chaque
 * changement de page et chaque minute (jamais onglet caché, performance 2026-10). Placé sous
 * InterimProvider : en intérim, l'en-tête X-Interim-For est ajouté par apiFetch.
 */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { interim } = useInterim();
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const requete = useRef(0);

  const rafraichir = useCallback(() => {
    const n = ++requete.current;
    getNavigation()
      .then((r) => n === requete.current && setNavigation(r))
      .catch(() => {
        // Pastilles seulement : une erreur passagère ne doit rien afficher.
      });
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => document.hidden || rafraichir(), INTERVALLE_MS);
    window.addEventListener(EVENEMENT_MESSAGES_LUS, rafraichir);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(EVENEMENT_MESSAGES_LUS, rafraichir);
    };
  }, [rafraichir]);

  useEffect(() => {
    rafraichir();
  }, [pathname, interim?.titulaireId, rafraichir]);

  return <Contexte.Provider value={{ navigation, rafraichir }}>{children}</Contexte.Provider>;
}

export const useNavigation = () => useContext(Contexte);
