'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { estStagiaire } from '../../lib/auth/stagiaire';
import { InterimSwitcher } from '../interim/InterimSwitcher';
import { MessagesIcon } from './MessagesIcon';
import { NotificationBell } from './NotificationBell';
import { MenuCreer } from './MenuCreer';
import { titrePage } from './Sidebar';

/**
 * Barre du haut (refonte de l'interface) : titre de la page, recherche globale (Ctrl K y place le
 * curseur), intérim, messagerie, notifications et menu « Créer ». Collante : elle est hors de la zone
 * qui défile.
 */
export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const champ = useRef<HTMLInputElement>(null);
  // Recherche transverse (socle N5) : tâches, documents, courrier, annuaire, réunions, selon les
  // droits de chacun (API) ; fermée aux stagiaires, comme les modules qu'elle interroge.
  const recherche = !estStagiaire(user?.role);
  const titre = titrePage(pathname, user?.role, user?.rolesFonctionnels);

  useEffect(() => {
    if (!recherche) return;
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        champ.current?.focus();
        champ.current?.select();
      }
    };
    window.addEventListener('keydown', raccourci);
    return () => window.removeEventListener('keydown', raccourci);
  }, [recherche]);

  return (
    <header className="z-30 flex h-[62px] flex-shrink-0 items-center gap-2.5 border-b border-line bg-surface px-4 md:gap-3.5 md:px-7">
      <button
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
        className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border border-line text-ink md:hidden"
      >
        <Menu aria-hidden size={20} />
      </button>
      <div className="min-w-0 truncate text-[13.5px] font-semibold text-text md:w-[180px] md:flex-none" data-testid="titre-page">
        {titre}
      </div>
      <form
        role="search"
        className="mx-auto hidden h-[38px] min-w-0 max-w-[520px] flex-1 items-center gap-2.5 rounded-[10px] border border-line bg-bg px-3 text-text-faint focus-within:border-ink md:flex"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 3) router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        {recherche && (
          <>
            <Search aria-hidden size={16} className="flex-none" />
            <input
              ref={champ}
              type="search"
              aria-label="Recherche transverse"
              aria-keyshortcuts="Control+K"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une tâche, un document, une personne…"
              minLength={3}
              className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-text placeholder:text-text-faint focus:outline-none"
            />
            <kbd className="flex-none rounded-[5px] border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold text-text-muted">Ctrl K</kbd>
          </>
        )}
      </form>
      <div className="ml-auto flex flex-none items-center gap-1 md:ml-0 md:gap-1.5">
        {recherche && (
          <Link href="/recherche" aria-label="Rechercher" className="grid h-[38px] w-[38px] place-items-center rounded-[10px] text-ink md:hidden">
            <Search aria-hidden size={20} />
          </Link>
        )}
        <InterimSwitcher />
        <MessagesIcon />
        <NotificationBell />
        <div className="ml-1">
          <MenuCreer />
        </div>
      </div>
    </header>
  );
}
