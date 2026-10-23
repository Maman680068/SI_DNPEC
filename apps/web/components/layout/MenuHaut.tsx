'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useNavigation } from '../../lib/navigation/NavigationProvider';
import type { CompteursNavigation } from '../../lib/api/navigation';
import { lienActif, navigationPour, type NavItem } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Menu en haut (écran large) : bandeau ink-900 (logo, recherche, messagerie, notifications, « Créer »,
 * aide, menu du compte), rangée d'onglets — un par groupe du menu, pastille = somme des compteurs du
 * groupe, groupe de la page ouverte souligné en or —, puis bande blanche des sous-onglets du groupe
 * ouvert. Mêmes entrées, mêmes règles par rôle et mêmes pastilles que le tiroir du téléphone
 * (`navigationPour`). Clavier : Tab entre les rangées, flèches gauche/droite, Début et Fin dans une
 * rangée ; une rangée trop longue défile horizontalement (flèches de défilement, onglet actif visible).
 */
type Onglet = { label: string; items: NavItem[] };

function somme(items: NavItem[], c?: CompteursNavigation): number {
  return items.reduce((s, i) => s + (i.compteur && c ? c[i.compteur] : 0), 0);
}

function Pastille({ n, dore, claire, id }: { n: number; dore?: boolean; claire?: boolean; id?: string }) {
  if (!n) return null;
  const ton = dore ? 'bg-gold text-ink-900' : claire ? 'bg-ink-50 text-ink' : 'bg-white/[.14] text-white';
  return (
    <span id={id} aria-hidden data-testid="pastille-menu" className={`grid h-5 min-w-[22px] place-items-center rounded-[10px] px-1.5 text-[11.5px] font-bold ${ton}`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

function initiales(p: string, n: string) {
  return `${p.charAt(0)}${n.charAt(0)}`.toUpperCase();
}

/** Flèches gauche/droite, Début et Fin : passe d'un lien à l'autre dans la rangée. */
function clavierRangee(e: KeyboardEvent<HTMLElement>) {
  const liens = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]')];
  const i = liens.indexOf(document.activeElement as HTMLAnchorElement);
  if (i < 0) return;
  const cible = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: liens.length - 1 }[e.key];
  if (cible === undefined) return;
  e.preventDefault();
  liens[(cible + liens.length) % liens.length]?.focus();
}

/**
 * Rangée d'onglets qui défile horizontalement quand l'écran est trop étroit : barre de défilement
 * masquée, flèches aux extrémités tant qu'il reste des onglets cachés de ce côté, onglet actif
 * ramené dans la vue à chaque changement de page.
 */
function RangeeDefilante({ label, sombre, cle, children }: { label: string; sombre?: boolean; cle: string; children: ReactNode }) {
  const rangee = useRef<HTMLElement>(null);
  const [bords, setBords] = useState({ gauche: false, droite: false });
  const mesurer = useCallback(() => {
    const r = rangee.current;
    if (!r) return;
    setBords({ gauche: r.scrollLeft > 2, droite: r.scrollLeft + r.clientWidth < r.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    const r = rangee.current;
    if (!r) return;
    r.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(r);
    return () => obs.disconnect();
  }, [cle, mesurer]);
  const defiler = (sens: number) => rangee.current?.scrollBy({ left: sens * rangee.current.clientWidth * 0.6, behavior: 'smooth' });
  const fleche = sombre
    ? 'bg-ink-900 text-[#D3D7EC] hover:text-white shadow-[0_0_12px_8px_theme(colors.ink.900)]'
    : 'bg-surface text-text-muted hover:text-ink shadow-[0_0_12px_8px_theme(colors.surface)]';
  return (
    <div className="relative">
      <nav aria-label={label} ref={rangee} onScroll={mesurer} onKeyDown={clavierRangee} className="sans-barre flex gap-1 overflow-x-auto px-4">
        {children}
      </nav>
      {bords.gauche && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => defiler(-1)} className={`absolute inset-y-0 left-0 grid w-8 place-items-center ${fleche}`}>
          <ChevronLeft size={18} />
        </button>
      )}
      {bords.droite && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => defiler(1)} className={`absolute inset-y-0 right-0 grid w-8 place-items-center ${fleche}`}>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

/** Menu du compte : profil, sécurité, préférences, déconnexion. Liste de liens dépliable (les liens
 * restent des liens) ; clavier : focus sur la première entrée à l'ouverture, flèches, Échap. */
function MenuCompte() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => setOuvert(false), [pathname]);
  useEffect(() => {
    if (!ouvert) return;
    zone.current?.querySelector<HTMLElement>('[data-entree-compte]')?.focus();
    const dehors = (e: MouseEvent) => zone.current && !zone.current.contains(e.target as Node) && setOuvert(false);
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);
  if (!user) return null;

  function clavier(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-entree-compte]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      setOuvert(false);
      bouton.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') setOuvert(false);
  }
  const entree = 'flex w-full items-center gap-2 px-3.5 py-2 text-left hover:bg-bg focus:bg-bg focus:outline-none';

  return (
    <div ref={zone} className="relative flex-none">
      <button
        ref={bouton}
        type="button"
        onClick={() => setOuvert(!ouvert)}
        aria-expanded={ouvert}
        aria-controls="menu-compte"
        aria-label="Mon compte"
        className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-2 hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-gold text-[12.5px] font-bold text-ink-900">
          {initiales(user.firstName, user.lastName)}
        </span>
        <span className="hidden min-w-0 text-left xl:block">
          <span className="block max-w-[170px] truncate text-[13.5px] font-semibold text-white">
            {user.firstName} {user.lastName}
          </span>
          <span className="block max-w-[170px] truncate text-[12px] text-[#AEB5D6]">{user.jobTitle ?? user.role}</span>
        </span>
        <ChevronDown aria-hidden size={16} className={`text-[#D3D7EC] transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>
      {ouvert && (
        <div
          id="menu-compte"
          onKeyDown={clavier}
          className="absolute right-0 top-full z-50 mt-2 w-[250px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 text-[13.5px] text-text shadow-lg"
        >
          <div className="border-b border-line px-3.5 pb-2 pt-1.5 xl:hidden">
            <div className="truncate font-semibold">
              {user.firstName} {user.lastName}
            </div>
            <div className="truncate text-[12px] text-text-muted">{user.jobTitle ?? user.role}</div>
          </div>
          <Link data-entree-compte href="/compte" className={`${entree} font-semibold`}>
            Mon profil
          </Link>
          <Link data-entree-compte href="/compte?section=securite" className={entree}>
            Sécurité du compte
          </Link>
          <Link data-entree-compte href="/compte?section=notifications" className={entree}>
            Préférences de notification
          </Link>
          <button data-entree-compte type="button" onClick={() => logout()} className={`${entree} border-t border-line`}>
            <LogOut aria-hidden size={16} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export function MenuHaut() {
  const { user } = useAuth();
  const { navigation } = useNavigation();
  const pathname = usePathname();
  const { groupes, plus, aide } = navigationPour(user?.role, user?.rolesFonctionnels, navigation?.modelisation);
  const libellePlus = plus.some((i) => i.href === '/parametrage') ? 'Administration' : 'Personnel et RH';
  const onglets: Onglet[] = [...groupes, { label: libellePlus, items: plus }];
  const actif = lienActif([...onglets.flatMap((o) => o.items), aide], pathname);
  const ongletActif = onglets.find((o) => o.items.some((i) => i.href === actif));
  const compteurs = navigation?.compteurs;
  const focusClair = 'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold';

  return (
    <div className="z-30 flex-shrink-0" data-testid="menu-haut">
      <div className="bg-ink-900 text-[#C9CEE6]">
        {/* Rangée du haut : identité, recherche, messagerie, notifications, « Créer », aide et compte. */}
        <div className="flex items-center gap-3 pl-6 pr-5">
          <Link href="/dashboard" className={`flex flex-none items-center gap-[11px] rounded-[10px] py-3 ${focusClair}`}>
            <img src="/logo-dnpec.png" alt="" className="h-9 w-9 flex-shrink-0 rounded-full bg-white object-contain p-0.5" />
            <span>
              <span className="block font-heading text-[15px] font-bold tracking-[.01em] text-white">DNPEC</span>
              <span className="block text-[12px] text-[#AEB5D6]">Espace de travail</span>
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <Topbar variante="bandeau" />
          </div>
          <Link
            href={aide.href}
            aria-current={actif === aide.href ? 'page' : undefined}
            aria-label="Aide"
            className={`flex h-[38px] flex-none items-center gap-2 rounded-[10px] px-2.5 text-[14px] font-medium text-[#D3D7EC] hover:bg-white/[.08] hover:text-white ${focusClair} ${
              actif === aide.href ? 'bg-white/[.09] text-white' : ''
            }`}
          >
            <CircleHelp aria-hidden size={18} strokeWidth={1.8} />
            <span className="hidden lg:inline">Aide</span>
          </Link>
          <MenuCompte />
        </div>

        {/* Onglets : un par groupe du menu ; le groupe de la page ouverte est souligné en or. */}
        <RangeeDefilante label="Menu principal" sombre cle={ongletActif?.label ?? ''}>
          {onglets.map((o) => {
            const estActif = o === ongletActif;
            const n = somme(o.items, compteurs);
            return (
              <Link
                key={o.label}
                href={o.items[0]!.href}
                aria-current={estActif ? 'true' : undefined}
                aria-describedby={n ? `pastille-groupe-${o.items[0]!.href.replace(/\W/g, '')}` : undefined}
                data-testid="onglet-groupe"
                className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-3.5 pb-3 pt-2 text-[14.5px] ${focusClair} ${
                  estActif ? 'border-gold font-semibold text-white' : 'border-transparent font-medium text-[#C2C8E4] hover:text-white'
                }`}
              >
                {o.label}
                <Pastille n={n} dore={o.items.some((i) => i.dore && i.compteur && compteurs?.[i.compteur])} id={`pastille-groupe-${o.items[0]!.href.replace(/\W/g, '')}`} />
              </Link>
            );
          })}
        </RangeeDefilante>
      </div>

      {/* Sous-onglets : les entrées du groupe ouvert, avec leurs icônes et pastilles. */}
      {ongletActif && (
        <div className="border-b border-line bg-surface" data-testid="sous-onglets">
          <RangeeDefilante label={ongletActif.label} cle={actif ?? ''}>
            {ongletActif.items.map((i) => {
              const Icone = i.icone;
              const estActif = i.href === actif;
              const n = i.compteur && compteurs ? compteurs[i.compteur] : 0;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={estActif ? 'page' : undefined}
                  aria-describedby={n ? `pastille-haut-${i.href.replace(/\W/g, '')}` : undefined}
                  className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3 py-[11px] text-[13.5px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                    estActif ? 'border-ink font-semibold text-ink' : 'border-transparent font-medium text-text-muted hover:text-ink'
                  }`}
                >
                  <Icone aria-hidden size={16} strokeWidth={1.9} />
                  {i.label}
                  <Pastille n={n} dore={i.dore} claire id={`pastille-haut-${i.href.replace(/\W/g, '')}`} />
                </Link>
              );
            })}
          </RangeeDefilante>
        </div>
      )}
    </div>
  );
}
