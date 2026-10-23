'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Thème de l'application (clair par défaut, ou sombre) : choix de la personne, gardé dans le navigateur
 * seulement (confort d'affichage, aucun droit). Appliqué par l'attribut `data-theme` du conteneur
 * `.contraste-aa` (app/globals.css) : l'accueil et la connexion, hors de ce conteneur, ne changent pas.
 */
export type Theme = 'clair' | 'sombre';
const CLE = 'dnpec.theme';

/** Thème gardé dans le navigateur (clair si rien n'est gardé ou si le stockage est indisponible). */
export function lireTheme(): Theme {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(CLE) === 'sombre' ? 'sombre' : 'clair';
  } catch {
    return 'clair';
  }
}

const Contexte = createContext<{ theme: Theme; choisir: (t: Theme) => void }>({ theme: 'clair', choisir: () => undefined });

export function ThemeProvider({ children }: { children: (theme: Theme) => ReactNode }) {
  const [theme, setTheme] = useState<Theme>(lireTheme);
  const choisir = useCallback((t: Theme) => {
    setTheme(t);
    try {
      window.localStorage.setItem(CLE, t);
    } catch {
      // Stockage indisponible (navigation privée…) : le choix vaut pour la page seulement.
    }
  }, []);
  return <Contexte.Provider value={{ theme, choisir }}>{children(theme)}</Contexte.Provider>;
}

export const useTheme = () => useContext(Contexte);
