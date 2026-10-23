'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useInterim } from '../../lib/interim/InterimProvider';
import { ROLE_LABEL } from '../../lib/users/types';
import { useSurBandeau } from '../../lib/navigation/bandeau';

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/**
 * Sélecteur « Agir en intérim pour… » (barre du haut). N'apparaît que si la
 * personne a au moins une suppléance exerçable maintenant (en cours ET
 * conforme), ou si un intérim est déjà actif dans l'onglet — pour pouvoir en
 * sortir. Le choix est explicite et propre à l'onglet (voir InterimProvider).
 */
export function InterimSwitcher() {
  const { user } = useAuth();
  const { interim, available, startInterim, stopInterim } = useInterim();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const surBandeau = useSurBandeau();

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user || (available.length === 0 && !interim)) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-9 items-center gap-2 rounded-md border px-2.5 text-[12.5px] font-semibold ${
          interim
            ? 'border-gold bg-gold-soft text-ink-900'
            : surBandeau
              ? 'border-white/25 text-[#D3D7EC] hover:bg-white/[.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold'
              : 'border-line text-text-muted hover:bg-bg'
        }`}
      >
        <span aria-hidden>⇄</span>
        <span className="hidden max-w-[180px] truncate lg:inline">
          {interim ? `Intérim : ${interim.titulaireName}` : 'Agir en intérim pour…'}
        </span>
        <span className="sr-only lg:hidden">Agir en intérim pour…</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-[290px] max-w-[calc(100vw-32px)] rounded-md border border-line bg-surface py-1.5 shadow-lg"
        >
          <div className="px-3 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Agir au nom de…
          </div>
          <button
            role="menuitemradio"
            aria-checked={!interim}
            onClick={() => {
              stopInterim();
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-bg"
          >
            <span>
              <span className="font-semibold">Moi-même</span>
              <span className="ml-1.5 text-text-faint">
                {user.firstName} {user.lastName}
              </span>
            </span>
            {!interim && <span className="text-sage">✓</span>}
          </button>
          {available.map((s) => (
            <button
              key={s.id}
              role="menuitemradio"
              aria-checked={interim?.suppleanceId === s.id}
              onClick={() => {
                startInterim(s);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-bg"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {s.titulaire.firstName} {s.titulaire.lastName}
                </span>
                <span className="block text-[11.5px] text-text-faint">
                  {ROLE_LABEL[s.titulaire.role]} · jusqu’au {formatDay(s.endDate)}
                </span>
              </span>
              {interim?.suppleanceId === s.id && <span className="text-sage">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
