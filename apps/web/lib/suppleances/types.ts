import type { SystemRole } from '../auth/types';

/** Partie d'une suppléance telle que renvoyée par GET /suppleances/mine. */
export interface SuppleanceParty {
  id: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
  divisionId: string | null;
}

export interface Suppleance {
  id: string;
  titulaireId: string;
  suppleantId: string;
  startDate: string;
  endDate: string;
  createdById: string;
  revokedAt: string | null;
  revokedById: string | null;
  createdAt: string;
  titulaire: SuppleanceParty;
  suppleant: SuppleanceParty;
  /** Règle du rang comparable réévaluée sur les rôles actuels (API) — une
   * suppléance non conforme est refusée à l'usage et doit être redésignée. */
  conforme: boolean;
}

export interface CreateSuppleanceInput {
  titulaireId: string;
  suppleantId: string;
  startDate: string;
  endDate: string;
}

export type SuppleanceStatus = 'A_VENIR' | 'EN_COURS' | 'TERMINEE' | 'REVOQUEE' | 'NON_CONFORME';

/** Statut affiché — NON_CONFORME prime sur tout sauf une révocation ou une fin
 * déjà passée (sans objet : la suppléance n'est de toute façon plus utilisable). */
export function suppleanceStatus(s: Suppleance, now: Date = new Date()): SuppleanceStatus {
  if (s.revokedAt) return 'REVOQUEE';
  if (new Date(s.endDate) < now) return 'TERMINEE';
  if (!s.conforme) return 'NON_CONFORME';
  if (new Date(s.startDate) > now) return 'A_VENIR';
  return 'EN_COURS';
}

export const SUPPLEANCE_STATUS_LABEL: Record<SuppleanceStatus, string> = {
  A_VENIR: 'À venir',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  REVOQUEE: 'Révoquée',
  NON_CONFORME: 'Non conforme — à redésigner',
};

export const SUPPLEANCE_STATUS_TONE: Record<SuppleanceStatus, 'accent' | 'gold' | 'sage' | 'clay' | 'muted'> = {
  A_VENIR: 'accent',
  EN_COURS: 'sage',
  TERMINEE: 'muted',
  REVOQUEE: 'muted',
  NON_CONFORME: 'clay',
};

/** Rôles pouvant être titulaires ou suppléants (API, CHEF_TIER_ROLES). */
export const SUPPLEANCE_ROLES: SystemRole[] = ['DN', 'DNA', 'CHEF_DIVISION', 'CHEF_SECTION', 'CHEF_CELLULE'];
