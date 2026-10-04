'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

/**
 * Messages de confirmation (refonte, étape 9, maquette `apres-toast-squelette`) : un message bref en
 * bas à droite après une action réussie (« Tâche validée »), avec « Annuler » quand l'action peut
 * l'être ; les erreurs dans le même style, en rouge. Un seul message à la fois (le suivant remplace
 * le précédent). Annoncé aux lecteurs d'écran (role="status", ou "alert" pour une erreur).
 */
type Toast = { id: number; ton: 'succes' | 'erreur'; titre: string; detail?: string; annuler?: () => void | Promise<void> };
type Api = {
  succes: (titre: string, options?: { detail?: string; annuler?: () => void | Promise<void> }) => void;
  erreur: (titre: string, detail?: string) => void;
};

const Contexte = createContext<Api | null>(null);
const DUREE = 5000;
const DUREE_AVEC_ANNULER = 8000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suivant = useRef(1);

  const fermer = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    setToast(null);
  }, []);
  const montrer = useCallback((t: Omit<Toast, 'id'>) => {
    if (minuteur.current) clearTimeout(minuteur.current);
    setToast({ ...t, id: suivant.current++ });
    minuteur.current = setTimeout(() => setToast(null), t.annuler ? DUREE_AVEC_ANNULER : t.ton === 'erreur' ? DUREE_AVEC_ANNULER : DUREE);
  }, []);
  useEffect(() => () => void (minuteur.current && clearTimeout(minuteur.current)), []);

  const api = useRef<Api>({
    succes: (titre, o) => montrer({ ton: 'succes', titre, detail: o?.detail, annuler: o?.annuler }),
    erreur: (titre, detail) => montrer({ ton: 'erreur', titre, detail }),
  });

  return (
    <Contexte.Provider value={api.current}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex justify-end sm:inset-x-auto sm:bottom-7 sm:right-7">
        {toast && (
          <div
            key={toast.id}
            role={toast.ton === 'erreur' ? 'alert' : 'status'}
            data-testid="toast"
            data-ton={toast.ton}
            className={`pointer-events-auto flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-[13.5px] text-white shadow-[0_16px_36px_rgba(18,28,77,0.35)] sm:w-[380px] ${toast.ton === 'erreur' ? 'bg-clay' : 'bg-ink-900'}`}
          >
            <span aria-hidden className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full ${toast.ton === 'erreur' ? 'bg-white/20' : 'bg-sage'}`}>
              {toast.ton === 'erreur' ? <AlertTriangle size={16} /> : <Check size={16} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block font-semibold leading-tight">{toast.titre}</b>
              {toast.detail && <span className="block text-[12.5px] leading-snug text-white/80">{toast.detail}</span>}
            </span>
            {toast.annuler ? (
              <button
                type="button"
                className="flex-none rounded-md px-1.5 py-1 font-bold text-gold hover:underline"
                onClick={() => {
                  const a = toast.annuler;
                  fermer();
                  void a?.();
                }}
              >
                Annuler
              </button>
            ) : (
              <button type="button" aria-label="Fermer le message" className="flex-none rounded-md p-1 text-white/70 hover:text-white" onClick={fermer}>
                <X aria-hidden size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </Contexte.Provider>
  );
}

/** Messages de confirmation : `toast.succes('Tâche validée', { detail, annuler })`, `toast.erreur(...)`. */
export function useToast(): Api {
  const c = useContext(Contexte);
  // Hors du fournisseur (pages publiques) : sans effet.
  return c ?? { succes: () => {}, erreur: () => {} };
}

/** Message d'erreur lisible pour un échec d'appel (jamais un texte technique). */
export function messageErreur(err: unknown, defaut = 'L’action n’a pas abouti. Réessayez dans un instant.'): string {
  if (!(err instanceof Error) || !err.message) return defaut;
  const m = err.message;
  // Messages techniques (réseau, JSON, codes) remplacés par le message par défaut.
  if (/^(Failed to fetch|NetworkError|Unexpected token|TypeError|Internal server error|Request failed)/i.test(m) || /^\d{3}\b/.test(m)) return defaut;
  // Messages de validation en anglais (class-validator) : une phrase française.
  if (/\b(must be|must not be|should not|should be|is not a valid|must contain|must match|each value in)\b/i.test(m)) return 'Certaines informations ne sont pas acceptées. Vérifiez la saisie, puis réessayez.';
  return m;
}
