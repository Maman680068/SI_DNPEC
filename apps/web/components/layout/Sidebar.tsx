'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { USERS_PAGE_VISIBLE_ROLES } from '../../lib/users/types';
import { NAVIGATION_STAGIAIRE, estStagiaire } from '../../lib/auth/stagiaire';

type NavGroup = { label: string; items: { icon: string; label: string; href?: string }[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Général',
    items: [
      { icon: '▦', label: 'Tableau de bord', href: '/dashboard' },
      { icon: '✎', label: 'Mes tâches', href: '/tasks' },
      // Socle N5 : plan de travail (objectifs, activités) et instructions de la Direction ; fermés aux stagiaires.
      { icon: '◎', label: 'Plan de travail', href: '/plan-travail' },
      { icon: '⚑', label: 'Instructions', href: '/instructions' },
      { icon: '✉', label: 'Communication', href: '/communication' },
      { icon: '🗂', label: 'Archives & documents', href: '/documents' },
      { icon: '🗓', label: 'Réunions', href: '/reunions' },
      // Courrier et actes (D7) : tout profil — l'administrateur système n'y voit
      // que son courrier personnel ; il en a aussi le paramétrage (Administration).
      { icon: '📨', label: 'Courrier', href: '/courrier' },
      // Logistique (D9) : tout profil sauf stagiaire (NAVIGATION_STAGIAIRE).
      { icon: '🧰', label: 'Logistique', href: '/logistique' },
      // Aide (G4) : tout profil, stagiaire compris ; guides filtrés par GET /aide/profils.
      { icon: '?', label: 'Aide', href: '/aide' },
    ],
  },
  {
    label: 'Personnel',
    items: [
      // Dossier du personnel (D3) : tout profil — au moins son propre dossier ;
      // les autres selon GET /personnel-files.
      { icon: '📁', label: 'Dossier du personnel', href: '/personnel' },
      // Stages (D6) : DRH, Direction, chefs ; « Mon stage » pour un stagiaire ;
      // un tuteur y arrive par ses notifications et la carte du tableau de bord.
      { icon: '🎓', label: 'Stagiaires', href: '/stages' },
      { icon: '🌴', label: 'Congés & absences', href: '/leaves' },
      // Documents générés (socle N4) : attestation de travail, ordre de mission, rapport d'activité.
      { icon: '🖨', label: 'Documents générés', href: '/documents-generes' },
      // Ressources humaines (socle N6) : effectifs et alertes (DRH, Direction), carrière et actes,
      // fiches de poste, formation ; les onglets ouverts sont donnés par GET /api/v1/rh.
      { icon: '👥', label: 'Ressources humaines', href: '/rh' },
      { icon: '☰', label: 'Annuaire', href: '/annuaire' },
      // Organigramme (socle NIMBA) : lisible par tous, géré par le DRH et l'administrateur.
      { icon: '🏛', label: 'Organisation', href: '/organisation' },
      { icon: '✦', label: 'Boîte à suggestions', href: '/suggestions' },
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

/** "Utilisateurs" n'apparaît que pour ADMIN_SYSTEME (gestion complète) et DN/DNA
 * (lecture seule — voir app/(app)/users/page.tsx). "Organisation" (organigramme) est
 * dans le groupe Personnel, pour tous ; « Agents » pour le DRH et le gestionnaire RH. */
function navGroupsFor(role: string | undefined, rolesFonctionnels: string[] = []): NavGroup[] {
  if (estStagiaire(role)) {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => NAVIGATION_STAGIAIRE.includes(i.href ?? '')).map((i) => (i.href === '/stages' ? { ...i, label: 'Mon stage' } : i)),
    })).filter((g) => g.items.length > 0);
  }
  const voitStages = STAGES_NAV_ROLES.includes(role ?? '') || rolesFonctionnels.includes('DRH');
  const voitAgents = rolesFonctionnels.some((r) => AGENTS_NAV_ROLES_FONCTIONNELS.includes(r));
  const base = NAV_GROUPS.map((g) => ({
    ...g,
    items: [
      ...g.items.filter((i) => voitStages || i.href !== '/stages'),
      ...(g.label === 'Personnel' && voitAgents ? [{ icon: '🪪', label: 'Agents', href: '/agents' }] : []),
    ],
  }));
  const groups = SUPPLEANCE_NAV_ROLES.includes(role ?? '')
    ? base.map((g) =>
        g.label === 'Personnel' ? { ...g, items: [...g.items, { icon: '⇄', label: 'Suppléances', href: '/suppleances' }] } : g,
      )
    : base;
  const adminItems: NavGroup['items'] = [];
  if (USERS_PAGE_VISIBLE_ROLES.includes(role ?? '')) {
    adminItems.push({ icon: '👤', label: 'Utilisateurs', href: '/users' });
  }
  // Socle N2 : paramétrage et supervision (administrateur ; DN et DNA en lecture) ; journal d'audit
  // pour tous, dans sa portée (toute la Direction ici, son périmètre ou ses actions ailleurs).
  const direction = ['ADMIN_SYSTEME', 'DN', 'DNA'].includes(role ?? '');
  if (direction) {
    adminItems.push({ icon: '⚙', label: 'Paramétrage et supervision', href: '/parametrage' });
    adminItems.push({ icon: '🧾', label: 'Journal d’audit', href: '/journal-audit' });
  } else {
    const perso = groups.find((g) => g.label === 'Personnel');
    if (perso) perso.items.push({ icon: '🧾', label: 'Journal d’audit', href: '/journal-audit' });
  }
  if (role === 'ADMIN_SYSTEME') {
    adminItems.push({ icon: '📨', label: 'Courrier', href: '/courrier/administration' });
    adminItems.push({ icon: '🧰', label: 'Logistique', href: '/logistique/administration' });
    // Réglages des stages (capacités, modèle d'attestation), jamais leur contenu.
    adminItems.push({ icon: '🎓', label: 'Stages (réglages)', href: '/stages/parametres' });
  }
  if (adminItems.length === 0) return groups;
  return [...groups, { label: 'Administration', items: adminItems }];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const navGroups = navGroupsFor(user?.role, user?.rolesFonctionnels);
  // Entrée active : le lien le plus précis qui contient la page (Courrier et
  // Administration → Courrier ne s'allument jamais ensemble).
  const activeHref = navGroups
    .flatMap((g) => g.items.map((i) => i.href ?? ''))
    .filter((h) => h && (pathname === h || pathname?.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];

  // Referme le tiroir mobile à chaque changement de page — sans ça, naviguer
  // depuis le tiroir le laisserait ouvert par-dessus la page suivante.
  useEffect(() => {
    onClose?.();
  }, [pathname]);

  return (
    <>
      {/* Fond assombri derrière le tiroir mobile — absent en desktop, où la
       * sidebar est toujours visible dans le flux normal (voir md:static). */}
      {open && (
        <div className="fixed inset-0 z-40 bg-[rgba(20,26,38,0.42)] md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-shrink-0 flex-col border-r border-line bg-surface p-3.5 transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-7 flex flex-shrink-0 items-center gap-3 px-2">
          <img src="/logo-dnpec.png" alt="DNPEC" className="h-9 w-9 flex-shrink-0 object-contain" />
          <div>
            <div className="text-[11px] text-text-faint">DNPEC</div>
            <div className="font-heading text-[13.5px] font-bold text-ink">Espace de travail</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-text-muted md:hidden"
          >
            ✕
          </button>
        </div>

      {/* Seule cette liste défile si elle dépasse la hauteur disponible — le
       * logo (au-dessus) et le profil (en-dessous) restent toujours ancrés,
       * quelle que soit la longueur du contenu de la page à droite. */}
      <div className="flex-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 mt-[18px] px-2.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = !!item.href && item.href === activeHref;
              const className = `mb-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.6px] font-medium ${
                active
                  ? 'bg-accent-soft font-bold text-ink shadow-[inset_3px_0_0_theme(colors.gold.DEFAULT)]'
                  : 'text-text-muted hover:bg-bg hover:text-ink'
              }`;
              const content = (
                <>
                  <span className="w-[18px] text-center text-sm opacity-85">{item.icon}</span>
                  {item.label}
                </>
              );
              return item.href ? (
                <Link key={item.label} href={item.href} className={className}>
                  {content}
                </Link>
              ) : (
                <a key={item.label} className={`${className} cursor-default opacity-60`}>
                  {content}
                </a>
              );
            })}
          </div>
        ))}
      </div>

      {user && (
        <div className="flex flex-shrink-0 items-center gap-2.5 border-t border-line pl-2 pt-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gold text-[12.5px] font-bold text-ink">
            {initials(user.firstName, user.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-ink">
              {user.firstName} {user.lastName}
            </div>
            <div className="truncate text-[11px] text-text-faint">{user.jobTitle ?? user.role}</div>
          </div>
          <Link href="/compte/notifications" title="Préférences de notification" aria-label="Mes notifications (préférences)" className="text-text-faint hover:text-ink">
            🔔
          </Link>
          <Link href="/compte/securite" title="Sécurité du compte" aria-label="Sécurité du compte" className="text-text-faint hover:text-ink">
            🔒
          </Link>
          <button
            onClick={() => logout()}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="text-text-faint hover:text-clay"
          >
            ⏻
          </button>
        </div>
      )}
      </aside>
    </>
  );
}
