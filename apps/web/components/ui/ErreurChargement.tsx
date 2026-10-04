'use client';

import { SqueletteListe } from './Squelette';

/** Message d'échec d'un chargement de page — auparavant l'erreur ne remontait
 * qu'en console et la page restait sur « Chargement… ». */
export function ErreurChargement({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-clay-soft px-3.5 py-3 text-[13px] text-clay">
      <span>{message}</span>
      <button onClick={() => window.location.reload()} className="rounded-md border border-clay px-3 py-1.5 text-[12.5px] font-semibold">
        Réessayer
      </button>
    </div>
  );
}

/**
 * Chargement d'une liste ou d'un bloc : un squelette en lignes grises (refonte, étape 9), masqué
 * quand le chargement a échoué (l'erreur est affichée en tête). `lignes` : hauteur du squelette.
 */
export function Chargement({ erreur, lignes = 4 }: { erreur: string | null; className?: string; lignes?: number }) {
  if (erreur) return null;
  return <SqueletteListe lignes={lignes} colonnes={3} />;
}

export function messageChargement(err: unknown, defaut = 'Chargement impossible. Vérifiez la connexion puis réessayez.'): string {
  return err instanceof Error && err.message ? err.message : defaut;
}
