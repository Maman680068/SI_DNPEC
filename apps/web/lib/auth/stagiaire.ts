import type { SystemRole } from './types';

/**
 * Rôle STAGIAIRE (D6). L'API est seule juge (StagiaireGuard : liste blanche) ;
 * l'écran s'en sert uniquement pour ne pas proposer un module qui lui est fermé
 * (navigation, boutons, onglets) plutôt que d'afficher un refus.
 */
export function estStagiaire(role: SystemRole | string | null | undefined): boolean {
  return role === 'STAGIAIRE';
}

/** Entrées de navigation ouvertes à un stagiaire. */
export const NAVIGATION_STAGIAIRE = ['/dashboard', '/tasks', '/communication', '/personnel', '/stages', '/aide'];
