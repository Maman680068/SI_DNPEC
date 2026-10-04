'use client';

import { useEffect } from 'react';

/**
 * Montre la barre de défilement pendant le défilement (refonte, étape 9) : l'élément qui défile
 * reçoit la classe « en-defilement » pendant 900 ms (voir globals.css). Sans rendu.
 */
export function DefilementVisible() {
  useEffect(() => {
    const minuteurs = new Map<Element, ReturnType<typeof setTimeout>>();
    const surDefilement = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.scrollingElement;
      if (!el) return;
      el.classList.add('en-defilement');
      const avant = minuteurs.get(el);
      if (avant) clearTimeout(avant);
      minuteurs.set(el, setTimeout(() => { el.classList.remove('en-defilement'); minuteurs.delete(el); }, 900));
    };
    document.addEventListener('scroll', surDefilement, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', surDefilement, { capture: true });
      minuteurs.forEach((t) => clearTimeout(t));
    };
  }, []);
  return null;
}
