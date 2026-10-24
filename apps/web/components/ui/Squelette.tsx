'use client';

import { useEffect, useState } from 'react';
import { lireTheme, type Theme } from '../../lib/theme';

/**
 * Squelettes de chargement (refonte, étape 9, maquette `apres-toast-squelette`) : des lignes grises
 * qui ont la forme de la page, à la place de « Chargement… ». Annoncés une seule fois aux lecteurs
 * d'écran (« Chargement en cours ») ; les blocs eux-mêmes sont décoratifs.
 */
const BARRE = 'animate-pulse rounded-md bg-gradient-to-r from-fond-gris via-fond-doux to-fond-gris';

export function Barre({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block ${BARRE} ${className}`} />;
}

const LARGEURS = ['w-[62%]', 'w-[48%]', 'w-[74%]', 'w-[55%]', 'w-[68%]', 'w-[44%]'];

/** Liste ou tableau en cours de chargement : `lignes` lignes, `colonnes` colonnes (bureau). */
export function SqueletteListe({ lignes = 6, colonnes = 4, testid = 'squelette' }: { lignes?: number; colonnes?: number; testid?: string }) {
  return (
    <div role="status" aria-label="Chargement en cours" data-testid={testid} className="overflow-hidden rounded-xl border border-line bg-surface">
      <span className="sr-only">Chargement en cours</span>
      <div aria-hidden className="hidden h-[38px] items-center gap-6 border-b border-line bg-fond-doux px-4 lg:flex">
        {Array.from({ length: colonnes }, (_, i) => (
          <Barre key={i} className={`h-2.5 ${i === 0 ? 'w-[120px]' : 'w-[70px]'}`} />
        ))}
      </div>
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} aria-hidden className="flex h-[54px] items-center gap-6 border-b border-line-doux px-4 last:border-b-0">
          <div className="min-w-0 flex-1 space-y-2">
            <Barre className={`h-3 ${LARGEURS[i % LARGEURS.length]}`} />
            <Barre className="h-2 w-[30%]" />
          </div>
          {Array.from({ length: Math.max(0, colonnes - 1) }, (_, j) => (
            <Barre key={j} className={`hidden h-3 lg:block ${j === 0 ? 'w-[90px] rounded-full' : 'w-[64px]'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Bloc de cartes en cours de chargement (tableau de bord, panneaux). */
export function SqueletteCartes({ cartes = 3 }: { cartes?: number }) {
  return (
    <div role="status" aria-label="Chargement en cours" data-testid="squelette" className="grid gap-3.5 md:grid-cols-3">
      <span className="sr-only">Chargement en cours</span>
      {Array.from({ length: cartes }, (_, i) => (
        <div key={i} aria-hidden className="space-y-3 rounded-xl border border-line bg-surface p-[18px]">
          <Barre className="h-3.5 w-[40%]" />
          <Barre className="h-2.5 w-[85%]" />
          <Barre className="h-2.5 w-[70%]" />
          <Barre className="h-2.5 w-[55%]" />
        </div>
      ))}
    </div>
  );
}

/** Page entière en cours de chargement : titre, onglets, puis une liste. */
export function SquelettePage({ testid = 'squelette-page' }: { testid?: string }) {
  return (
    <div data-testid={testid}>
      <div aria-hidden className="mb-4 flex items-center gap-4">
        <Barre className="h-6 w-[220px]" />
        <Barre className="hidden h-3 w-[160px] sm:block" />
      </div>
      <div aria-hidden className="mb-4 flex gap-5 border-b border-line pb-3">
        <Barre className="h-3 w-[90px]" />
        <Barre className="h-3 w-[80px]" />
        <Barre className="h-3 w-[70px]" />
      </div>
      <SqueletteListe />
    </div>
  );
}

/**
 * Écran de démarrage de l'application (session en cours de vérification) : le cadre — bandeau du menu
 * en haut (barre du haut sur téléphone) — puis une page en squelette, à la place de « Chargement… » seul,
 * dans le thème choisi.
 */
export function SqueletteApplication() {
  // Thème lu après le montage : le rendu serveur ne connaît pas le choix gardé dans le navigateur.
  const [theme, setTheme] = useState<Theme>('clair');
  useEffect(() => setTheme(lireTheme()), []);
  return (
    <div className="contraste-aa flex min-h-screen flex-col bg-bg" data-theme={theme} role="status" aria-label="Chargement en cours" data-testid="squelette-application">
      <span className="sr-only">Chargement en cours</span>
      {/* Écran large : bandeau du menu en haut (logo, recherche, onglets) ; téléphone : barre du haut. */}
      <div aria-hidden className="hidden flex-none bg-bandeau px-6 md:block">
        <div className="flex h-[62px] items-center gap-4">
          <span className="h-9 w-9 rounded-full bg-white/15" />
          <span className="h-3 w-[90px] rounded bg-white/15" />
          <span className="mx-auto h-9 w-[420px] rounded-[10px] bg-white/10" />
          <span className="h-9 w-[92px] rounded-[10px] bg-white/15" />
        </div>
        <div className="flex gap-6 pb-4 pt-1">
          {[90, 80, 90, 150].map((l, i) => (
            <span key={i} className="h-3 rounded bg-white/10" style={{ width: l }} />
          ))}
        </div>
      </div>
      <div aria-hidden className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[62px] items-center gap-4 border-b border-line bg-surface px-4 md:hidden">
          <Barre className="h-3 w-[100px]" />
          <Barre className="ml-auto h-9 w-[92px] rounded-[10px]" />
        </div>
        <div className="hidden h-[44px] items-center gap-5 border-b border-line bg-surface px-7 md:flex">
          {['w-[110px]', 'w-[90px]', 'w-[120px]', 'w-[100px]'].map((l) => (
            <Barre key={l} className={`h-3 ${l}`} />
          ))}
        </div>
        <div className="p-4 md:px-7 md:py-6">
          <SquelettePage testid="squelette-page-demarrage" />
        </div>
      </div>
    </div>
  );
}
