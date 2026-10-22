'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, CircleHelp, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useNavigation } from '../../lib/navigation/NavigationProvider';
import type { CompteursNavigation } from '../../lib/api/navigation';
import { lienActif, navigationPour, type NavItem } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Menu en haut (écran large) : bandeau aux couleurs du menu de gauche (ink-900, or), avec une
 * rangée d'onglets — un par groupe du menu — puis, sous le bandeau, les sous-onglets du groupe de
 * la page ouverte. Mêmes entrées, mêmes règles par rôle et mêmes pastilles que le menu de gauche
 * (`navigationPour`). Sur téléphone, le tiroir du menu de gauche reste utilisé.
 */
type Onglet = { label: string; items: NavItem[] };

function somme(items: NavItem[], c?: CompteursNavigation): number {
  return items.reduce((s, i) => s + (i.compteur && c ? c[i.compteur] : 0), 0);
}

function Pastille({ n, dore, claire }: { n: number; dore?: boolean; claire?: boolean }) {
  if (!n) return null;
  const ton = dore ? 'bg-gold text-ink-900' : claire ? 'bg-ink-50 text-ink' : 'bg-white/[.14] text-white';
  return (
    <span aria-hidden data-testid="pastille-menu" className={`grid h-5 min-w-[22px] place-items-center rounded-[10px] px-1.5 text-[11.5px] font-bold ${ton}`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

function initiales(p: string, n: string) {
  return `${p.charAt(0)}${n.charAt(0)}`.toUpperCase();
}

export function MenuHaut() {
  const { user, logout } = useAuth();
  const { navigation } = useNavigation();
  const pathname = usePathname();
  const { groupes, plus, aide } = navigationPour(user?.role, user?.rolesFonctionnels, navigation?.modelisation);
  const libellePlus = plus.some((i) => i.href === '/parametrage') ? 'Administration' : 'Personnel et RH';
  const onglets: Onglet[] = [...groupes, { label: libellePlus, items: plus }];
  const actif = lienActif([...onglets.flatMap((o) => o.items), aide], pathname);
  const ongletActif = onglets.find((o) => o.items.some((i) => i.href === actif));
  const compteurs = navigation?.compteurs;

  const [compte, setCompte] = useState(false);
  const zoneCompte = useRef<HTMLDivElement>(null);
  useEffect(() => setCompte(false), [pathname]);
  useEffect(() => {
    if (!compte) return;
    const dehors = (e: MouseEvent) => zoneCompte.current && !zoneCompte.current.contains(e.target as Node) && setCompte(false);
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [compte]);

  return (
    <div className="z-30 flex-shrink-0">
      <div className="bandeau-sombre bg-ink-900 text-[#C9CEE6]">
        {/* Rangée du haut : identité, recherche, messagerie, notifications, « Créer », aide et compte. */}
        <div className="flex items-center gap-3 pl-6 pr-5">
          <Link href="/dashboard" className="flex flex-none items-center gap-[11px] py-3">
            <img src="/logo-dnpec.png" alt="" className="h-9 w-9 flex-shrink-0 rounded-full bg-white object-contain p-0.5" />
            <span>
              <span className="block font-heading text-[15px] font-bold tracking-[.01em] text-white">DNPEC</span>
              <span className="block text-[12px] text-[#9AA2C8]">Espace de travail</span>
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <Topbar variante="bandeau" />
          </div>
          <Link
            href={aide.href}
            aria-current={actif === aide.href ? 'page' : undefined}
            className="flex h-[38px] flex-none items-center gap-2 rounded-[10px] px-2.5 text-[14px] font-medium text-[#D3D7EC] hover:bg-white/[.08] hover:text-white"
          >
            <CircleHelp aria-hidden size={18} strokeWidth={1.8} />
            <span className="hidden lg:inline">Aide</span>
          </Link>
          {user && (
            <div ref={zoneCompte} className="relative flex-none">
              <button
                type="button"
                onClick={() => setCompte(!compte)}
                aria-expanded={compte}
                aria-label="Mon compte"
                className="flex items-center gap-2.5 rounded-[10px] py-1 pl-1 pr-2 hover:bg-white/[.08]"
              >
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-gold text-[12.5px] font-bold text-ink-900">
                  {initiales(user.firstName, user.lastName)}
                </span>
                <span className="hidden min-w-0 text-left xl:block">
                  <span className="block max-w-[170px] truncate text-[13.5px] font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="block max-w-[170px] truncate text-[12px] text-[#9AA2C8]">{user.jobTitle ?? user.role}</span>
                </span>
                <ChevronDown aria-hidden size={16} className="opacity-70" />
              </button>
              {compte && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[240px] overflow-hidden rounded-[10px] border border-line bg-surface py-1 text-[13.5px] text-text shadow-lg">
                  <Link href="/compte" className="block px-3.5 py-2 font-semibold hover:bg-bg">Mon profil</Link>
                  <Link href="/compte?section=securite" className="block px-3.5 py-2 hover:bg-bg">Sécurité du compte</Link>
                  <Link href="/compte?section=notifications" className="block px-3.5 py-2 hover:bg-bg">Préférences de notification</Link>
                  <button onClick={() => logout()} className="flex w-full items-center gap-2 border-t border-line px-3.5 py-2 text-left hover:bg-bg">
                    <LogOut aria-hidden size={16} /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Onglets : un par groupe du menu ; le groupe de la page ouverte est souligné en or. */}
        <nav aria-label="Menu principal" className="flex gap-1 overflow-x-auto px-4">
          {onglets.map((o) => {
            const estActif = o === ongletActif;
            const n = somme(o.items, compteurs);
            return (
              <Link
                key={o.label}
                href={o.items[0]!.href}
                aria-current={estActif ? 'true' : undefined}
                className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3.5 pb-3 pt-2 text-[14.5px] ${
                  estActif ? 'border-gold font-semibold text-white' : 'border-transparent font-medium text-[#B9BFDD] hover:text-white'
                }`}
              >
                {o.label}
                <Pastille n={n} dore={o.items.some((i) => i.dore && i.compteur && compteurs?.[i.compteur])} />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sous-onglets : les entrées du groupe ouvert, avec leurs icônes et pastilles. */}
      {ongletActif && (
        <nav aria-label={ongletActif.label} className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4">
          {ongletActif.items.map((i) => {
            const Icone = i.icone;
            const estActif = i.href === actif;
            const n = i.compteur && compteurs ? compteurs[i.compteur] : 0;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={estActif ? 'page' : undefined}
                className={`flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3 py-[11px] text-[13.5px] ${
                  estActif ? 'border-ink font-semibold text-ink' : 'border-transparent font-medium text-text-muted hover:text-ink'
                }`}
              >
                <Icone aria-hidden size={16} strokeWidth={1.9} />
                {i.label}
                <Pastille n={n} dore={i.dore} claire />
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
