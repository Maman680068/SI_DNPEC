'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { USERS_PAGE_VISIBLE_ROLES } from '../../lib/users/types';

type NavGroup = { label: string; items: { icon: string; label: string; href?: string }[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Général',
    items: [
      { icon: '▦', label: 'Tableau de bord', href: '/dashboard' },
      { icon: '✎', label: 'Mes tâches' },
      { icon: '✉', label: 'Communication', href: '/communication' },
      { icon: '🗂', label: 'Archives & documents', href: '/documents' },
      { icon: '🗓', label: 'Réunions' },
    ],
  },
  {
    label: 'Personnel',
    items: [
      { icon: '🌴', label: 'Congés & absences', href: '/leaves' },
      { icon: '☰', label: 'Annuaire', href: '/annuaire' },
      { icon: '✦', label: 'Boîte à suggestions' },
    ],
  },
];

/** "Utilisateurs" n'apparaît que pour ADMIN_SYSTEME (gestion complète) et DN/DNA
 * (lecture seule — voir app/(app)/users/page.tsx). "Organisation" est réservée à
 * ADMIN_SYSTEME uniquement (voir app/(app)/organisation/page.tsx). */
function navGroupsFor(role: string | undefined): NavGroup[] {
  const adminItems: NavGroup['items'] = [];
  if (USERS_PAGE_VISIBLE_ROLES.includes(role ?? '')) {
    adminItems.push({ icon: '👤', label: 'Utilisateurs', href: '/users' });
  }
  if (role === 'ADMIN_SYSTEME') {
    adminItems.push({ icon: '🏛', label: 'Organisation', href: '/organisation' });
  }
  if (adminItems.length === 0) return NAV_GROUPS;
  return [...NAV_GROUPS, { label: 'Administration', items: adminItems }];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const navGroups = navGroupsFor(user?.role);

  return (
    <aside className="flex w-[250px] flex-shrink-0 flex-col border-r border-line bg-surface p-3.5">
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink font-heading text-sm font-extrabold text-white">
          DN
        </div>
        <div>
          <div className="text-[11px] text-text-faint">DNPEC</div>
          <div className="font-heading text-[13.5px] font-bold text-ink">Espace de travail</div>
        </div>
      </div>

      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="mb-2 mt-[18px] px-2.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            {group.label}
          </div>
          {group.items.map((item) => {
            const active = !!item.href && pathname?.startsWith(item.href);
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

      {user && (
        <div className="mt-auto flex items-center gap-2.5 border-t border-line pl-2 pt-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gold text-[12.5px] font-bold text-ink">
            {initials(user.firstName, user.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-ink">
              {user.firstName} {user.lastName}
            </div>
            <div className="truncate text-[11px] text-text-faint">{user.jobTitle ?? user.role}</div>
          </div>
          <button
            onClick={() => logout()}
            title="Se déconnecter"
            className="text-text-faint hover:text-clay"
          >
            ⏻
          </button>
        </div>
      )}
    </aside>
  );
}
