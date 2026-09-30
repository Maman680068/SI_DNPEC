'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { estStagiaire } from '../../lib/auth/stagiaire';
import { InterimSwitcher } from '../interim/InterimSwitcher';
import { MessagesIcon } from './MessagesIcon';
import { NotificationBell } from './NotificationBell';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');

  return (
    <div className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:gap-5 md:px-[26px]">
      <button
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line text-text-muted md:hidden"
      >
        ☰
      </button>
      {/* Recherche transverse (socle N5) : tâches, documents, courrier, annuaire, réunions, selon les
       * droits de chacun (API) ; fermée aux stagiaires, comme les modules qu'elle interroge. */}
      <form
        role="search"
        className="relative min-w-0 flex-1 md:max-w-[380px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 3) router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        {!estStagiaire(user?.role) && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-faint"
            >
              ⌕
            </span>
            <input
              type="search"
              aria-label="Rechercher dans la plateforme"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (3 caractères au moins)…"
              minLength={3}
              className="w-full rounded-md border border-line bg-bg py-2.5 pl-[34px] pr-3.5 text-[13.5px]"
            />
          </>
        )}
      </form>
      <div className="flex items-center gap-2.5 md:gap-[18px]">
        <InterimSwitcher />
        <MessagesIcon />
        <NotificationBell />
        {user && (
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-gold text-[12.5px] font-bold text-ink">
            {initials(user.firstName, user.lastName)}
          </div>
        )}
      </div>
    </div>
  );
}
