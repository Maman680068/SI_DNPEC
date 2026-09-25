import { apiFetch } from './client';
import type { AdminUser, ApproveUserInput, ChangementRoleApercu, ChangementRoleInput, CreateUserInput, UserStatus } from '../users/types';

/** Tous les comptes visibles par l'acteur — pour ADMIN_SYSTEME/DN/DNA (périmètre
 * "top-level" côté CascadeService), équivaut à la liste complète. */
export function listAllUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/users');
}

/** ADMIN_SYSTEME uniquement (voir UsersController). */
export function listPendingUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/users/pending');
}

export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>('/users', { method: 'POST', body: JSON.stringify(input) });
}

export function approveUser(id: string, input: ApproveUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${id}/approve`, { method: 'POST', body: JSON.stringify(input) });
}

export function rejectUser(id: string): Promise<void> {
  return apiFetch<void>(`/users/${id}/reject`, { method: 'POST' });
}

export function setUserStatus(id: string, status: UserStatus): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

/** Réinitialisation par un administrateur, depuis la fiche d'un compte — option (a) :
 * réutilise le mécanisme "mot de passe oublié" (email avec lien à usage unique, 1h). */
export function sendPasswordResetEmail(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/users/${id}/password/send-reset-email`, { method: 'POST' });
}

/** Option (b) : l'admin définit lui-même un mot de passe temporaire — révoque aussi
 * les sessions actives du compte côté API. */
export function setUserPassword(id: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/users/${id}/password/set`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

/** Changement de rôle — aperçu (aucune écriture) puis action ; mêmes contrôles côté API. */
export function apercuChangementRole(id: string, input: ChangementRoleInput): Promise<ChangementRoleApercu> {
  return apiFetch<ChangementRoleApercu>(`/users/${id}/role/apercu`, { method: 'POST', body: JSON.stringify(input) });
}

export function changerRole(id: string, input: ChangementRoleInput): Promise<ChangementRoleApercu> {
  return apiFetch<ChangementRoleApercu>(`/users/${id}/role`, { method: 'POST', body: JSON.stringify(input) });
}

/** Réinitialisation de la double authentification d'un compte (téléphone perdu) :
 * 2FA désactivée, secret effacé, sessions fermées. Administrateur système seulement. */
export function resetTwoFa(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/users/${id}/2fa/reset`, { method: 'POST' });
}
