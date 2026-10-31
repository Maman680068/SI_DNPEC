import { apiFetch } from './client';
import type { AdminUser, ApproveUserInput, ChangementRoleApercu, ChangementRoleInput, CreateUserInput, ListeChangementsRole, UnitePoste, UserStatus } from '../users/types';
import type { SystemRole } from '../auth/types';

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

export function rejectUser(id: string, motif?: string): Promise<void> {
  return apiFetch<void>(`/users/${id}/reject`, { method: 'POST', body: JSON.stringify(motif ? { motif } : {}) });
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

/** Nominations signées à un poste de responsabilité (administrateur système). */
export const getChangementsRole = () => apiFetch<ListeChangementsRole>('/api/v1/changements-role');
export const confirmerChangementRole = (id: string, v: { note?: string; ancienTitulaire?: UnitePoste & { role: SystemRole } }) =>
  apiFetch(`/api/v1/changements-role/${id}/confirmation`, { method: 'POST', body: JSON.stringify(v) });
export const refuserChangementRole = (id: string, motif: string) =>
  apiFetch(`/api/v1/changements-role/${id}/refus`, { method: 'POST', body: JSON.stringify({ motif }) });

/** Comptes et habilitations : rôles fonctionnels, double authentification, agents sans compte (administrateur, DN, DNA). */
export interface CompteSynthese {
  id: string;
  rolesFonctionnels: string[];
  doubleAuthentification: boolean;
  droitsEleves: boolean;
  sigleUnite: string | null;
  derniereConnexion: string | null;
  demonstration: boolean;
  renvoyerInvitation: boolean;
}
export interface SyntheseComptes {
  droits: { ouvrirCompte: boolean; envoyerRappel: boolean; examinerInscriptions: boolean };
  chiffres: {
    actifs: number;
    suspendus: number;
    suspendusDemonstration: number;
    inscriptionsAExaminer: number;
    actifsSansDoubleAuthentification: number;
    droitsElevesSansDoubleAuthentification: number;
    jamaisConnectes: number;
  };
  comptes: CompteSynthese[];
  agentsSansCompte: { id: string; matricule: string; nom: string; prenoms: string; fonction: string | null; unite: string | null; dateCreation: string }[];
}
export function getSyntheseComptes(): Promise<SyntheseComptes> {
  return apiFetch<SyntheseComptes>('/api/v1/comptes/synthese');
}
export function envoyerRappelDoubleAuthentification(): Promise<{ personnes: number }> {
  return apiFetch('/api/v1/comptes/rappel-double-authentification', { method: 'POST' });
}
export function renvoyerInvitation(id: string): Promise<{ envoye: boolean }> {
  return apiFetch(`/api/v1/comptes/${id}/renvoyer-invitation`, { method: 'POST' });
}
