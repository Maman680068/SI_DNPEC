'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Ellipsis,
  FileText,
  Flag,
  Folder,
  FolderOpen,
  GraduationCap,
  House,
  IdCard,
  Lightbulb,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  ScrollText,
  Settings,
  SquareCheck,
  Sun,
  Target,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { USERS_PAGE_VISIBLE_ROLES } from '../../lib/users/types';
import { NAVIGATION_STAGIAIRE, estStagiaire } from '../../lib/auth/stagiaire';
import { useNavigation } from '../../lib/navigation/NavigationProvider';
import type { CompteursNavigation } from '../../lib/api/navigation';

type Compteur = keyof CompteursNavigation;
export type NavItem = { icone: LucideIcon; label: string; href: string; compteur?: Compteur; dore?: boolean };
type NavGroup = { label: string; items: NavItem[] };

/** Groupes principaux (refonte de l'interface, maquette validée) ; « Plus » et « Aide » suivent. */
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Mon travail',
    items: [
      { icone: House, label: 'Tableau de bord', href: '/dashboard' },
      { icone: SquareCheck, label: 'Mes tâches', href: '/tasks', compteur: 'taches', dore: true },
      // Socle N5 : plan de travail (objectifs, activités) et instructions de la Direction ; fermés aux stagiaires.
      { icone: Target, label: 'Plan de travail', href: '/plan-travail' },
      { icone: Flag, label: 'Instructions', href: '/instructions', compteur: 'instructions' },
      { icone: CalendarDays, label: 'Réunions', href: '/reunions', compteur: 'reunions' },
    ],
  },
  {
    label: 'Échanges',
    items: [
      { icone: MessageSquare, label: 'Messagerie', href: '/communication', compteur: 'messages' },
      // Courrier et actes (D7) : tout profil — l'administrateur système n'y voit
      // que son courrier personnel ; il en a aussi le paramétrage (Plus).
      { icone: Mail, label: 'Courrier', href: '/courrier', compteur: 'courrier' },
      { icone: Users, label: 'Annuaire', href: '/annuaire' },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { icone: Folder, label: 'Archives & documents', href: '/documents' },
      { icone: Sun, label: 'Congés & absences', href: '/leaves', compteur: 'conges' },
      // Documents générés (socle N4) : attestation de travail, ordre de mission, rapport d'activité.
      { icone: FileText, label: 'Documents générés', href: '/documents-generes' },
      // Logistique (D9) : tout profil sauf stagiaire (NAVIGATION_STAGIAIRE).
      { icone: Package, label: 'Logistique', href: '/logistique', compteur: 'logistique' },
    ],
  },
];

/** Rôles qui voient l'entrée « Stagiaires » (D6). */
const STAGES_NAV_ROLES = ['DRH', 'DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

/** Rôles fonctionnels (socle NIMBA) qui ouvrent l'écran « Agents ». */
const AGENTS_NAV_ROLES_FONCTIONNELS = ['DRH', 'GESTIONNAIRE_RH'];

/** Rôles pouvant être titulaire ou suppléant (§4.10, API CHEF_TIER_ROLES) —
 * rôle PROPRE de la personne, jamais le rôle emprunté pendant un intérim. */
const SUPPLEANCE_NAV_ROLES = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];

const AIDE: NavItem = { icone: CircleHelp, label: 'Aide', href: '/aide' };

/**
 * Entrées du menu selon le rôle (mêmes règles qu'avant la refonte) : les groupes principaux, puis
 * le groupe repliable « Plus » (dossier du personnel, RH, organisation, stagiaires, suggestions,
 * journal d'audit, administration…), puis l'aide. "Utilisateurs" n'apparaît que pour ADMIN_SYSTEME
 * (gestion complète) et DN/DNA (lecture seule — voir app/(app)/users/page.tsx) ; « Agents » pour le
 * DRH et le gestionnaire RH.
 */
export function navigationPour(role: string | undefined, rolesFonctionnels: string[] = []): { groupes: NavGroup[]; plus: NavItem[]; aide: NavItem } {
  if (estStagiaire(role)) {
    return {
      groupes: NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => NAVIGATION_STAGIAIRE.includes(i.href)) })).filter((g) => g.items.length > 0),
      plus: [
        { icone: FolderOpen, label: 'Dossier du personnel', href: '/personnel' },
        { icone: GraduationCap, label: 'Mon stage', href: '/stages' },
      ],
      aide: AIDE,
    };
  }
  const voitStages = STAGES_NAV_ROLES.includes(role ?? '') || rolesFonctionnels.includes('DRH');
  const voitAgents = rolesFonctionnels.some((r) => AGENTS_NAV_ROLES_FONCTIONNELS.includes(r));
  const plus: NavItem[] = [
    // Dossier du personnel (D3) : tout profil — au moins son propre dossier ; les autres selon GET /personnel-files.
    { icone: FolderOpen, label: 'Dossier du personnel', href: '/personnel' },
    // Ressources humaines (socle N6) : onglets ouverts donnés par GET /api/v1/rh.
    { icone: Users, label: 'Ressources humaines', href: '/rh' },
  ];
  if (voitAgents) plus.push({ icone: IdCard, label: 'Agents', href: '/agents' });
  // Organigramme (socle NIMBA) : lisible par tous, géré par le DRH et l'administrateur.
  plus.push({ icone: Building2, label: 'Organisation', href: '/organisation' });
  // Stages (D6) : DRH, Direction, chefs ; un tuteur y arrive par ses notifications et le tableau de bord.
  if (voitStages) plus.push({ icone: GraduationCap, label: 'Stagiaires', href: '/stages', compteur: 'stages' });
  if (SUPPLEANCE_NAV_ROLES.includes(role ?? '')) plus.push({ icone: ArrowLeftRight, label: 'Suppléances', href: '/suppleances' });
  plus.push({ icone: Lightbulb, label: 'Boîte à suggestions', href: '/suggestions' });
  // Socle N2 : journal d'audit pour tous, dans sa portée ; paramétrage et supervision (administrateur ;
  // DN et DNA en lecture).
  plus.push({ icone: ScrollText, label: 'Journal d’audit', href: '/journal-audit' });
  if (USERS_PAGE_VISIBLE_ROLES.includes(role ?? '')) plus.push({ icone: UserCog, label: 'Utilisateurs', href: '/users', compteur: 'utilisateurs' });
  if (['ADMIN_SYSTEME', 'DN', 'DNA'].includes(role ?? '')) plus.push({ icone: Settings, label: 'Paramétrage et supervision', href: '/parametrage' });
  if (role === 'ADMIN_SYSTEME') {
    plus.push({ icone: Mail, label: 'Courrier (administration)', href: '/courrier/administration' });
    plus.push({ icone: Package, label: 'Logistique (administration)', href: '/logistique/administration' });
    // Réglages des stages (capacités, modèle d'attestation), jamais leur contenu.
    plus.push({ icone: GraduationCap, label: 'Stages (réglages)', href: '/stages/parametres' });
  }
  return { groupes: NAV_GROUPS, plus, aide: AIDE };
}

/** Titre de la page affiché dans la barre du haut : l'entrée du menu la plus précise. */
const TITRES_HORS_MENU: Record<string, string> = {
  '/recherche': 'Recherche',
  '/compte/notifications': 'Préférences de notification',
  '/compte/securite': 'Sécurité du compte',
};
export function titrePage(pathname: string | null, role: string | undefined, rolesFonctionnels: string[] = []): string {
  if (!pathname) return '';
  if (TITRES_HORS_MENU[pathname]) return TITRES_HORS_MENU[pathname];
  const { groupes, plus, aide } = navigationPour(role, rolesFonctionnels);
  const items = [...groupes.flatMap((g) => g.items), ...plus, aide];
  const actif = lienActif(items, pathname);
  return items.find((i) => i.href === actif)?.label ?? '';
}

/** Entrée active : le lien le plus précis qui contient la page (Courrier et Courrier (administration)
 * ne s'allument jamais ensemble). */
function lienActif(items: NavItem[], pathname: string | null): string | undefined {
  return items
    .map((i) => i.href)
    .filter((h) => pathname === h || pathname?.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const CLE_PLUS = 'dnpec.menu.plus';

function Pastille({ n, dore, id }: { n: number; dore?: boolean; id?: string }) {
  if (!n) return null;
  return (
    <span
      id={id}
      aria-hidden
      data-testid="pastille-menu"
      className={`ml-auto grid h-5 min-w-[22px] place-items-center rounded-[10px] px-1.5 text-[11.5px] font-bold ${dore ? 'bg-gold text-ink-900' : 'bg-white/[.12] text-white'}`}
    >
      {n > 99 ? '99+' : n}
      <span className="sr-only"> à traiter</span>
    </span>
  );
}

function Entree({ item, actif, compteurs }: { item: NavItem; actif: boolean; compteurs?: CompteursNavigation }) {
  const Icone = item.icone;
  const n = item.compteur && compteurs ? compteurs[item.compteur] : 0;
  const idPastille = `pastille-${item.href.replace(/\W/g, '')}`;
  return (
    <Link
      href={item.href}
      aria-current={actif ? 'page' : undefined}
      aria-describedby={n ? idPastille : undefined}
      className={`flex h-[35px] items-center gap-[11px] rounded-lg px-2.5 text-[14px] font-medium ${
        actif ? 'bg-white/[.09] text-white shadow-[inset_3px_0_0_theme(colors.gold.DEFAULT)]' : 'text-[#D3D7EC] hover:bg-white/[.05] hover:text-white'
      }`}
    >
      <Icone aria-hidden size={18} strokeWidth={1.8} className="flex-none" />
      <span className="truncate">{item.label}</span>
      <Pastille n={n} dore={item.dore} id={idPastille} />
    </Link>
  );
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { navigation } = useNavigation();
  const pathname = usePathname();
  const { groupes, plus, aide } = navigationPour(user?.role, user?.rolesFonctionnels);
  const actif = lienActif([...groupes.flatMap((g) => g.items), ...plus, aide], pathname);
  const plusActif = plus.some((i) => i.href === actif);
  const [plusOuvert, setPlusOuvert] = useState(false);
  const [menuCompte, setMenuCompte] = useState(false);
  const compteurs = navigation?.compteurs;
  const nPlus = plus.reduce((s, i) => s + (i.compteur && compteurs ? compteurs[i.compteur] : 0), 0);
  // Libellé du groupe repliable : l'administration y figure pour l'administrateur, le DN et la DNA.
  const libellePlus = plus.some((i) => i.href === '/parametrage') ? 'Personnel et administration' : 'Personnel et RH';

  // Dernier état du groupe « Plus » (confort personnel, navigateur seulement).
  useEffect(() => {
    try {
      setPlusOuvert(window.localStorage.getItem(CLE_PLUS) === '1');
    } catch {
      // Stockage indisponible : groupe replié.
    }
  }, []);
  function basculerPlus() {
    const v = !plusOuvert;
    setPlusOuvert(v);
    try {
      window.localStorage.setItem(CLE_PLUS, v ? '1' : '0');
    } catch {
      // Stockage indisponible : l'état vaut pour la page seulement.
    }
  }

  // Referme le tiroir mobile à chaque changement de page — sans ça, naviguer
  // depuis le tiroir le laisserait ouvert par-dessus la page suivante.
  useEffect(() => {
    onClose?.();
    setMenuCompte(false);
  }, [pathname]);

  const plusVisible = plusOuvert || plusActif;

  return (
    <>
      {/* Fond assombri derrière le tiroir mobile — absent en desktop, où le menu
       * est toujours visible dans le flux normal (voir md:static). */}
      {open && <div className="fixed inset-0 z-40 bg-[rgba(18,28,77,0.45)] md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[240px] flex-shrink-0 flex-col bg-ink-900 text-[#C9CEE6] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-shrink-0 items-center gap-[11px] pb-4 pl-5 pr-[18px] pt-[18px]">
          <img src="/logo-dnpec.png" alt="" className="h-9 w-9 flex-shrink-0 rounded-full bg-white object-contain p-0.5" />
          <div>
            <div className="font-heading text-[15px] font-bold tracking-[.01em] text-white">DNPEC</div>
            <div className="text-[12px] text-[#9AA2C8]">Espace de travail</div>
          </div>
          <button onClick={onClose} aria-label="Fermer le menu" className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[#C9CEE6] md:hidden">
            <X aria-hidden size={18} />
          </button>
        </div>

        {/* Seule cette liste défile si elle dépasse la hauteur de l'écran : le logo (au-dessus) et la
         * carte de l'utilisateur (en dessous) restent ancrés, quel que soit le défilement de la page. */}
        <nav aria-label="Menu principal" className="menu-defilant min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1">
          {groupes.map((g) => (
            <div key={g.label}>
              <div className="px-2.5 pb-1.5 pt-3.5 text-[11.5px] font-semibold text-[#8189B5]">{g.label}</div>
              {g.items.map((item) => (
                <Entree key={item.href} item={item} actif={item.href === actif} compteurs={compteurs} />
              ))}
            </div>
          ))}
          <div className="px-2.5 pb-1.5 pt-3.5 text-[11.5px] font-semibold text-[#8189B5]">Plus</div>
          <button
            type="button"
            onClick={basculerPlus}
            aria-expanded={plusVisible}
            aria-controls="menu-plus"
            className="flex h-[35px] w-full items-center gap-[11px] rounded-lg px-2.5 text-left text-[14px] font-medium text-[#D3D7EC] hover:bg-white/[.05] hover:text-white"
          >
            <Ellipsis aria-hidden size={18} strokeWidth={1.8} className="flex-none" />
            <span className="truncate">{libellePlus}</span>
            {!plusVisible && nPlus > 0 && <Pastille n={nPlus} />}
            <ChevronDown aria-hidden size={16} className={`flex-none opacity-60 transition-transform ${nPlus > 0 && !plusVisible ? '' : 'ml-auto'} ${plusVisible ? 'rotate-180' : ''}`} />
          </button>
          {plusVisible && (
            <div id="menu-plus" className="ml-3 border-l border-white/10 pl-2">
              {plus.map((item) => (
                <Entree key={item.href} item={item} actif={item.href === actif} compteurs={compteurs} />
              ))}
            </div>
          )}
          <div className="mt-0.5">
            <Entree item={aide} actif={aide.href === actif} />
          </div>
        </nav>

        {user && (
          <div className="relative mx-3 mb-3.5 mt-2.5 flex flex-shrink-0 items-center gap-2.5 rounded-[10px] bg-white/[.06] p-2.5">
            <button
              type="button"
              onClick={() => setMenuCompte(!menuCompte)}
              aria-expanded={menuCompte}
              aria-label="Mon compte"
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-gold text-[12.5px] font-bold text-ink-900">
                {initials(user.firstName, user.lastName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-white">
                  {user.firstName} {user.lastName}
                </span>
                <span className="block truncate text-[12px] text-[#9AA2C8]">{user.jobTitle ?? user.role}</span>
              </span>
            </button>
            <button onClick={() => logout()} title="Se déconnecter" aria-label="Se déconnecter" className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-[#9AA2C8] hover:text-white">
              <LogOut aria-hidden size={18} strokeWidth={1.8} />
            </button>
            {menuCompte && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-[10px] border border-line bg-surface py-1 text-[13.5px] text-text shadow-lg">
                <Link href="/compte/notifications" className="block px-3.5 py-2 hover:bg-bg" aria-label="Mes notifications (préférences)">
                  Préférences de notification
                </Link>
                <Link href="/compte/securite" className="block px-3.5 py-2 hover:bg-bg">
                  Sécurité du compte
                </Link>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
