import type { SystemRole } from '../auth/types';

export type UserStatus = 'EN_ATTENTE' | 'ACTIF' | 'SUSPENDU';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  photoUrl: string | null;
  jobTitle: string | null;
  role: SystemRole;
  status: UserStatus;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgAttachment {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

export interface CreateUserInput extends OrgAttachment {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: SystemRole;
}

export interface ApproveUserInput extends OrgAttachment {
  role: SystemRole;
}

export const SYSTEM_ROLES: SystemRole[] = [
  'DN',
  'DNA',
  'CHEF_DIVISION',
  'CHEF_SECTION',
  'CHEF_CELLULE',
  'AGENT',
  'ADMIN_SYSTEME',
  'ASSISTANT_DIRECTION',
];

export const ROLE_LABEL: Record<SystemRole, string> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_DIVISION: 'Chef de Division',
  CHEF_SECTION: 'Chef de Section',
  CHEF_CELLULE: 'Chef de Cellule',
  AGENT: 'Agent / Chargé d’Études',
  ADMIN_SYSTEME: 'Administrateur Système',
  ASSISTANT_DIRECTION: 'Assistant(e) de Direction',
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  EN_ATTENTE: 'En attente',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
};

/** Rôles pour lesquels la page Utilisateurs apparaît dans le menu — ADMIN_SYSTEME en
 * gestion complète, DN/DNA en lecture seule (voir page.tsx : le backend réserve
 * GET /users/pending, POST /users, /approve, /reject et /status à ADMIN_SYSTEME). */
export const USERS_PAGE_VISIBLE_ROLES = ['ADMIN_SYSTEME', 'DN', 'DNA'];
