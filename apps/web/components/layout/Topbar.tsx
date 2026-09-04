'use client';

import { useAuth } from '../../lib/auth/AuthProvider';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Topbar() {
  const { user } = useAuth();

  return (
    <div className="flex h-16 items-center justify-between gap-5 border-b border-line bg-surface px-6.5">
      <div className="relative max-w-[380px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-faint">
          ⌕
        </span>
        <input
          placeholder="Rechercher une tâche, un document, une personne…"
          className="w-full rounded-md border border-line bg-bg py-2.5 pl-8.5 pr-3.5 text-[13.5px]"
        />
      </div>
      <div className="flex items-center gap-4.5">
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line text-text-muted">
          ✉<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-surface bg-clay" />
        </button>
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
