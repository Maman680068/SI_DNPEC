'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type ActionMenu = { label: string; onSelect: () => void; testid?: string; danger?: boolean; aide?: string };

/**
 * Bouton icône « ⋯ » (« Plus d'actions ») et son menu déroulant : les actions secondaires d'une ligne
 * de tableau, pour qu'il ne reste qu'un bouton visible. Rien n'est affiché sans action. Le menu se
 * ferme au clic extérieur, à Échap et à Tab ; ↑ ↓ Début Fin pour s'y déplacer. Position fixe : jamais
 * coupé par le tableau, ouvert vers le haut quand la place manque en dessous.
 */
export function MenuActions({ actions, libelle = 'Plus d’actions' }: { actions: ActionMenu[]; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  function fermer(rendreFocus = true) {
    setOuvert(false);
    setPosition(null);
    if (rendreFocus) bouton.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!ouvert) return;
    const placer = () => {
      const r = bouton.current?.getBoundingClientRect();
      const m = menu.current;
      if (!r || !m) return;
      const h = m.offsetHeight;
      const w = m.offsetWidth;
      const bas = r.bottom + 4 + h <= window.innerHeight - 8;
      setPosition({
        top: bas ? r.bottom + 4 : Math.max(8, r.top - 4 - h),
        left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)),
      });
    };
    placer();
    window.addEventListener('resize', placer);
    window.addEventListener('scroll', placer, true);
    return () => {
      window.removeEventListener('resize', placer);
      window.removeEventListener('scroll', placer, true);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !bouton.current?.contains(t)) fermer(false);
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  // Premier choix mis au point une fois le menu placé (visible).
  useEffect(() => {
    if (ouvert && position && !menu.current?.contains(document.activeElement)) menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true });
  }, [ouvert, position]);

  if (actions.length === 0) return null;

  function clavier(e: ReactKeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const aller = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus({ preventScroll: true });
    };
    if (e.key === 'ArrowDown') aller(i + 1);
    else if (e.key === 'ArrowUp') aller(i - 1);
    else if (e.key === 'Home') aller(0);
    else if (e.key === 'End') aller(items.length - 1);
    else if (e.key === 'Escape') {
      // Échap ferme le menu seulement (pas la fenêtre ou la page qui le contient).
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      fermer();
    } else if (e.key === 'Tab') fermer(false);
  }

  return (
    <>
      <button
        ref={bouton}
        type="button"
        aria-label={libelle}
        title={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idMenu : undefined}
        onClick={(e) => {
          // Dans une ligne cliquable : le menu ne déclenche jamais l'ouverture de la ligne.
          e.stopPropagation();
          if (ouvert) fermer(false);
          else setOuvert(true);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'ArrowDown' && !ouvert) {
            e.preventDefault();
            setOuvert(true);
          }
        }}
        className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px] border border-line text-ink hover:bg-bg"
        data-testid="plus-actions"
      >
        <MoreHorizontal aria-hidden size={16} />
      </button>
      {ouvert && (
        <div
          ref={menu}
          id={idMenu}
          role="menu"
          aria-label={libelle}
          onKeyDown={clavier}
          onClick={(e) => e.stopPropagation()}
          style={position ?? { top: 0, left: 0 }}
          className={`fixed z-[70] min-w-[200px] rounded-[10px] border border-line bg-surface py-1 shadow-[0_12px_30px_rgba(18,28,77,0.18)] ${position ? '' : 'invisible'}`}
          data-testid="menu-actions"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-testid={a.testid}
              title={a.aide}
              onClick={() => {
                fermer(false);
                a.onSelect();
              }}
              className={`block w-full whitespace-nowrap px-3.5 py-2 text-left text-[13px] font-semibold hover:bg-bg focus:bg-bg focus:outline-none ${a.danger ? 'text-clay' : 'text-ink'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
