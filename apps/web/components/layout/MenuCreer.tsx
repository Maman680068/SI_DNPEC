'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, MessageSquare, Plus, SquareCheck, Sun, type LucideIcon } from 'lucide-react';
import { useNavigation } from '../../lib/navigation/NavigationProvider';
import type { Navigation } from '../../lib/api/navigation';
import { EVENEMENT_CREER, LIENS_CREATION } from '../../lib/navigation/creer';

/** Entrées du menu « Créer » : chacune ouvre la fenêtre de création de son écran (paramètre lu par la page). */
const ENTREES: { cle: keyof Navigation['creer']; label: string; href: string; icone: LucideIcon }[] = [
  { cle: 'tache', label: 'Nouvelle tâche', href: LIENS_CREATION.tache, icone: SquareCheck },
  { cle: 'reunion', label: 'Nouvelle réunion', href: LIENS_CREATION.reunion, icone: CalendarDays },
  { cle: 'conge', label: 'Demande de congé', href: LIENS_CREATION.conge, icone: Sun },
  { cle: 'message', label: 'Nouveau message', href: LIENS_CREATION.message, icone: MessageSquare },
  { cle: 'document', label: 'Nouveau document', href: LIENS_CREATION.document, icone: FileText },
];

/** Bouton doré « Créer » de la barre du haut : entrées limitées aux droits du rôle (donnés par l'API). */
export function MenuCreer() {
  const { navigation } = useNavigation();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const entrees = navigation ? ENTREES.filter((e) => navigation.creer[e.cle]) : [];

  useEffect(() => setOuvert(false), [pathname]);
  useEffect(() => {
    if (!ouvert) return;
    racine.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [ouvert]);

  if (entrees.length === 0) return null;
  return (
    <div ref={racine} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Créer"
        className="flex h-[38px] items-center gap-2 rounded-[10px] bg-gold px-2.5 text-[14px] font-bold text-ink-900 hover:brightness-95 sm:px-3.5"
      >
        <Plus aria-hidden size={18} strokeWidth={2} />
        <span className="hidden sm:inline">Créer</span>
      </button>
      {ouvert && (
        <div role="menu" aria-label="Créer" className="absolute right-0 top-full z-50 mt-1.5 w-[230px] overflow-hidden rounded-[10px] border border-line bg-surface py-1.5 shadow-lg">
          {entrees.map(({ cle, label, href, icone: Icone }) => (
            <Link
              key={cle}
              role="menuitem"
              href={href}
              onClick={(e) => {
                setOuvert(false);
                // Page déjà ouverte : elle ouvre sa fenêtre sans être rechargée.
                if (pathname === href.split('?')[0]) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent(EVENEMENT_CREER, { detail: cle }));
                }
              }}
              className="flex items-center gap-2.5 px-3.5 py-2 text-[13.5px] font-medium text-text hover:bg-bg focus:bg-bg focus:outline-none"
            >
              <Icone aria-hidden size={16} className="text-ink" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
