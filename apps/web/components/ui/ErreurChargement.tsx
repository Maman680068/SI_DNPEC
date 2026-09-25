'use client';

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

/** « Chargement… », masqué quand le chargement a échoué (l'erreur est affichée en tête). */
export function Chargement({ erreur, className = 'text-sm text-text-muted' }: { erreur: string | null; className?: string }) {
  if (erreur) return null;
  return <p className={className}>Chargement…</p>;
}

export function messageChargement(err: unknown, defaut = 'Chargement impossible. Vérifiez la connexion puis réessayez.'): string {
  return err instanceof Error && err.message ? err.message : defaut;
}
