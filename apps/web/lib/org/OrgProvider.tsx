'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getCellules, getDivisions, getSections, getUsers, resolveUsers } from '../api/org';
import type { BasicUserInfo, Cellule, Division, OrgUser, Section } from './types';
import { useAuth } from '../auth/AuthProvider';

interface OrgContextValue {
  loading: boolean;
  divisions: Division[];
  sections: Section[];
  cellules: Cellule[];
  /** Utilisateurs visibles par l'acteur courant (périmètre cascade — voir
   * CascadeService.getVisibleUserWhere côté API : un Agent ne s'y voit que lui-même).
   * Source des listes de sélection (assignation, mention) — pas pour l'affichage
   * d'un id isolé, voir getUserLabel/getUserInitials. */
  users: OrgUser[];
  getDivisionName: (id: string | null) => string | null;
  getSectionName: (id: string | null) => string | null;
  getCelluleName: (id: string | null) => string | null;
  /** Nom affichable d'un utilisateur. Résolu via `users` (périmètre cascade) si possible,
   * sinon via GET /users/resolve (par lots) — voir ensureResolved. Affiche un identifiant
   * tronqué le temps de la résolution asynchrone, jamais de manière durable. */
  getUserLabel: (id: string) => string;
  getUserInitials: (id: string) => string;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [cellules, setCellules] = useState<Cellule[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);

  // Cache des résolutions hors périmètre cascade (GET /users/resolve), peuplé à la
  // demande. pendingRef/timerRef groupent les ids demandés pendant un même passage de
  // rendu en un seul appel réseau au lieu d'un par id.
  const [resolvedExtra, setResolvedExtra] = useState<Record<string, BasicUserInfo>>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    Promise.all([getDivisions(), getCellules(), getUsers()]).then(async ([divisionsResult, cellulesResult, usersResult]) => {
      if (cancelled) return;
      setDivisions(divisionsResult);
      setCellules(cellulesResult);
      setUsers(usersResult);

      const sectionsByDivision = await Promise.all(divisionsResult.map((d) => getSections(d.id)));
      if (cancelled) return;
      setSections(sectionsByDivision.flat());
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  function ensureResolved(id: string): void {
    if (users.some((u) => u.id === id) || resolvedExtra[id] || pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    if (timerRef.current) return;

    timerRef.current = setTimeout(async () => {
      const ids = Array.from(pendingRef.current);
      pendingRef.current.clear();
      timerRef.current = null;
      try {
        const resolved = await resolveUsers(ids);
        setResolvedExtra((prev) => {
          const next = { ...prev };
          for (const u of resolved) next[u.id] = u;
          return next;
        });
      } catch {
        // Silencieux : les ids concernés retombent sur le placeholder tronqué.
      }
    }, 30);
  }

  function findUser(id: string): { firstName: string; lastName: string } | null {
    return users.find((u) => u.id === id) ?? resolvedExtra[id] ?? null;
  }

  function getDivisionName(id: string | null): string | null {
    if (!id) return null;
    return divisions.find((d) => d.id === id)?.name ?? null;
  }

  function getSectionName(id: string | null): string | null {
    if (!id) return null;
    return sections.find((s) => s.id === id)?.name ?? null;
  }

  function getCelluleName(id: string | null): string | null {
    if (!id) return null;
    return cellules.find((c) => c.id === id)?.name ?? null;
  }

  function getUserLabel(id: string): string {
    const user = findUser(id);
    if (user) return `${user.firstName} ${user.lastName}`;
    ensureResolved(id);
    return `Utilisateur…${id.slice(-4)}`;
  }

  function getUserInitials(id: string): string {
    const user = findUser(id);
    if (user) return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    ensureResolved(id);
    return '?';
  }

  return (
    <OrgContext.Provider
      value={{ loading, divisions, sections, cellules, users, getDivisionName, getSectionName, getCelluleName, getUserLabel, getUserInitials }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg doit être utilisé sous OrgProvider.');
  return ctx;
}
