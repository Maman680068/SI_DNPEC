'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getCellules, getDivisions, getSections, getUsers } from '../api/org';
import type { Cellule, Division, OrgUser, Section } from './types';
import { useAuth } from '../auth/AuthProvider';

interface OrgContextValue {
  loading: boolean;
  divisions: Division[];
  sections: Section[];
  cellules: Cellule[];
  /** Utilisateurs visibles par l'acteur courant (périmètre cascade — voir
   * CascadeService.getVisibleUserWhere côté API : un Agent ne s'y voit que lui-même). */
  users: OrgUser[];
  getDivisionName: (id: string | null) => string | null;
  getSectionName: (id: string | null) => string | null;
  getCelluleName: (id: string | null) => string | null;
  /** Nom affichable d'un utilisateur, ou un identifiant tronqué si hors du périmètre
   * visible par l'acteur (ex. un Agent consultant un commentaire de son supérieur). */
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
    const user = users.find((u) => u.id === id);
    return user ? `${user.firstName} ${user.lastName}` : `Utilisateur…${id.slice(-4)}`;
  }

  function getUserInitials(id: string): string {
    const user = users.find((u) => u.id === id);
    return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '?';
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
