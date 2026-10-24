'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, FileText, Mail, Menu, Search, SquareCheck, Target, Users, type LucideIcon } from 'lucide-react';
import { rechercher } from '../../lib/api/pilotage';
import type { Recherche } from '../../lib/pilotage/types';
import { useAuth } from '../../lib/auth/AuthProvider';
import { estStagiaire } from '../../lib/auth/stagiaire';
import { InterimSwitcher } from '../interim/InterimSwitcher';
import { MessagesIcon } from './MessagesIcon';
import { NotificationBell } from './NotificationBell';
import { MenuCreer } from './MenuCreer';
import { titrePage } from './Sidebar';
import { useNavigation } from '../../lib/navigation/NavigationProvider';
import { SurBandeauProvider, useEcranTresLarge } from '../../lib/navigation/bandeau';

const ICONES: Record<string, LucideIcon> = { taches: SquareCheck, activites: Target, documents: FileText, courrier: Mail, annuaire: Users, reunions: CalendarDays };

/** Passage du libellé qui correspond à la saisie, surligné (sans accents ni casse). */
function surligner(texte: string, q: string): ReactNode {
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const i = norm(texte).indexOf(norm(q.trim()));
  if (!q.trim() || i < 0) return texte;
  const n = q.trim().length;
  return (
    <>
      {texte.slice(0, i)}
      <mark className="rounded-[3px] bg-gold-50 px-0.5 text-text">{texte.slice(i, i + n)}</mark>
      {texte.slice(i + n)}
    </>
  );
}

/**
 * Barre du haut (refonte de l'interface) : titre de la page, recherche globale (Ctrl K y place le
 * curseur), intérim, messagerie, notifications et menu « Créer ». Collante : elle est hors de la zone
 * qui défile. Variante « bandeau » : posée dans le menu en haut (écran large, fond ink-900), sans
 * titre de page ; ses icônes prennent alors leurs classes « sur bandeau » (`lib/navigation/bandeau`).
 */
export function Topbar({ onMenuClick, variante }: { onMenuClick?: () => void; variante?: 'bandeau' }) {
  const bandeau = variante === 'bandeau';
  // Tablette et petit portable : texte d'exemple court, sinon il est coupé au milieu d'un mot.
  const tresLarge = useEcranTresLarge();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const champ = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLFormElement>(null);
  const idListe = useId();
  // Résultats pendant la frappe (refonte, étape 9, maquette `apres-recherche`) : dès 3 lettres, après
  // un court délai, par la même route que la page Recherche (mêmes règles de visibilité).
  const [resultats, setResultats] = useState<Recherche | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) {
      setResultats(null);
      return;
    }
    let annule = false;
    const minuteur = setTimeout(() => {
      rechercher(t)
        .then((r) => !annule && (setResultats(r), setActif(-1)))
        .catch(() => !annule && setResultats({ q: t, categories: [] }));
    }, 250);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [q]);
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => zone.current && !zone.current.contains(e.target as Node) && setOuvert(false);
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);
  const groupes = useMemo(() => (resultats?.categories ?? []).filter((c) => c.resultats.length > 0), [resultats]);
  const plats = useMemo(() => groupes.flatMap((c) => c.resultats.map((r) => ({ ...r, cle: c.cle }))), [groupes]);
  const total = groupes.reduce((n, c) => n + c.resultats.length, 0);
  const plus = groupes.some((c) => c.autres);
  const voirTout = () => {
    setOuvert(false);
    router.push(`/recherche?q=${encodeURIComponent(q.trim())}`);
  };
  function clavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOuvert(true);
      setActif((a) => Math.min(a + 1, plats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape') {
      if (ouvert) {
        e.preventDefault();
        setOuvert(false);
      } else champ.current?.blur();
    } else if (e.key === 'Enter' && ouvert && actif >= 0 && plats[actif]) {
      e.preventDefault();
      setOuvert(false);
      router.push(plats[actif]!.lien);
    }
  }
  // Recherche transverse (socle N5) : tâches, documents, courrier, annuaire, réunions, selon les
  // droits de chacun (API) ; fermée aux stagiaires, comme les modules qu'elle interroge.
  const recherche = !estStagiaire(user?.role);
  const { navigation } = useNavigation();
  const titre = titrePage(pathname, user?.role, user?.rolesFonctionnels, navigation?.modelisation);

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
    <SurBandeauProvider value={bandeau}>
    <header className={bandeau ? 'flex h-[62px] items-center gap-3.5' : 'z-30 flex h-[62px] flex-shrink-0 items-center gap-2.5 border-b border-line bg-surface px-4 md:gap-3.5 md:px-7'}>
      <button
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
        className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] border border-line text-ink md:hidden"
      >
        <Menu aria-hidden size={20} />
      </button>
      {!bandeau && (
        <div className="min-w-0 truncate text-[13.5px] font-semibold text-text md:w-[180px] md:flex-none" data-testid="titre-page">
          {titre}
        </div>
      )}
      <form
        ref={zone}
        role="search"
        className={`relative mx-auto hidden h-[38px] min-w-0 max-w-[520px] flex-1 items-center gap-2.5 rounded-[10px] border px-3 md:flex ${bandeau ? 'border-white/20 bg-white/[.08] text-[#B9BFDD] focus-within:border-white/50' : 'border-line bg-bg text-text-faint focus-within:border-ink'}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 3) voirTout();
        }}
      >
        {recherche && (
          <>
            <Search aria-hidden size={16} className="flex-none" />
            <input
              ref={champ}
              type="search"
              role="combobox"
              aria-label="Recherche transverse"
              aria-keyshortcuts="Control+K"
              aria-expanded={ouvert && q.trim().length >= 3}
              aria-controls={idListe}
              aria-autocomplete="list"
              aria-activedescendant={ouvert && actif >= 0 && plats[actif] ? `${idListe}-${actif}` : undefined}
              autoComplete="off"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOuvert(true);
              }}
              onFocus={() => q.trim().length >= 3 && setOuvert(true)}
              onKeyDown={clavier}
              placeholder={!bandeau || tresLarge ? 'Rechercher une tâche, un document, une personne…' : 'Rechercher…'}
              minLength={3}
              className={`h-full min-w-0 flex-1 bg-transparent text-[13.5px] focus:outline-none ${bandeau ? 'text-white placeholder:text-[#B9BFDD]' : 'text-text placeholder:text-text-faint'}`}
            />
            <kbd className={`flex-none rounded-[5px] border px-1.5 py-0.5 font-sans text-[11px] font-semibold ${bandeau ? 'border-white/25 text-[#C9CEE6]' : 'border-line bg-surface text-text-muted'}`}>{ouvert && q.trim().length >= 3 ? 'Échap' : 'Ctrl K'}</kbd>
            {ouvert && q.trim().length >= 3 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface text-text shadow-[0_16px_40px_rgba(18,28,77,0.22)]" data-testid="suggestions-recherche">
                <div id={idListe} role="listbox" aria-label="Résultats de la recherche" className="max-h-[60vh] overflow-y-auto py-1">
                  {!resultats ? (
                    <div className="space-y-2.5 px-4 py-3" role="status" aria-label="Recherche en cours">
                      {[60, 45, 52].map((l) => (
                        <span key={l} aria-hidden className="block h-3 animate-pulse rounded bg-fond-gris" style={{ width: `${l}%` }} />
                      ))}
                    </div>
                  ) : total === 0 ? (
                    <p className="px-4 py-3.5 text-[13px] text-text-muted">Aucun résultat pour « {q.trim()} ».</p>
                  ) : (
                    groupes.map((c) => {
                      const Icone = ICONES[c.cle] ?? Search;
                      return (
                        <div key={c.cle} role="group" aria-label={c.libelle}>
                          <div className="flex justify-between px-4 pb-1 pt-2 text-[11.5px] font-semibold text-text-muted">
                            <span>{c.libelle}</span>
                            <span>
                              {c.resultats.length}
                              {c.autres ? '+' : ''}
                            </span>
                          </div>
                          {c.resultats.map((r) => {
                            const i = plats.findIndex((x) => x.id === r.id && x.cle === c.cle);
                            return (
                              <div
                                key={r.id}
                                id={`${idListe}-${i}`}
                                role="option"
                                aria-selected={i === actif}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setOuvert(false);
                                  router.push(r.lien);
                                }}
                                onMouseEnter={() => setActif(i)}
                                className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-[13.5px] ${i === actif ? 'bg-survol' : ''}`}
                              >
                                <span aria-hidden className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-ink-50 text-ink">
                                  <Icone size={15} />
                                </span>
                                <span className="min-w-0 flex-1 truncate">{surligner(r.libelle, q)}</span>
                                {r.detail && <span className="max-w-[45%] flex-none truncate text-[12px] text-text-muted">{surligner(r.detail, q)}</span>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center gap-3 border-t border-line bg-fond-doux px-4 py-2 text-[12px] text-text-muted">
                  <span aria-hidden>↑ ↓ naviguer · Entrée ouvrir · Échap fermer</span>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={voirTout} className="ml-auto font-bold text-ink hover:underline">
                    {total > 0 ? `Voir les ${total}${plus ? '+' : ''} résultats` : 'Ouvrir la recherche'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </form>
      <div className="ml-auto flex flex-none items-center gap-1 md:ml-0 md:gap-1.5">
        {recherche && (
          <Link href="/recherche" aria-label="Ouvrir la recherche" className="grid h-[38px] w-[38px] place-items-center rounded-[10px] text-ink md:hidden">
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
    </SurBandeauProvider>
  );
}
