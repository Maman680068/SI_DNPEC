'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthProvider';
import { InterimSwitcher } from '../interim/InterimSwitcher';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();

  return (
    <div className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:gap-5 md:px-[26px]">
      <button
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line text-text-muted md:hidden"
      >
        ☰
      </button>
      <div className="relative min-w-0 flex-1 md:max-w-[380px]">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-faint">
          ⌕
        </span>
        <input
          placeholder="Rechercher…"
          className="w-full rounded-md border border-line bg-bg py-2.5 pl-[34px] pr-3.5 text-[13.5px]"
        />
      </div>
      <div className="flex items-center gap-2.5 md:gap-[18px]">
        <InterimSwitcher />
        <Link href="/communication" className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line text-text-muted">
          ✉<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-surface bg-clay" />
        </Link>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line text-text-muted">
          🔔<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-surface bg-clay" />
        </button>
        {user && (
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-md bg-gold text-[12.5px] font-bold text-ink">
            {initials(user.firstName, user.lastName)}
          </div>
        )}
      </div>
    </div>
  );
}
