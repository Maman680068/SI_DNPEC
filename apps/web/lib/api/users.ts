import { apiFetch } from './client';
import type { AdminUser, ApproveUserInput, CreateUserInput, UserStatus } from '../users/types';

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
