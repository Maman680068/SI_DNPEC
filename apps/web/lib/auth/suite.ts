'use client';

/**
 * Page visée avant (re)connexion — ex. un lien d'email ouvert avec une session
 * expirée. Mémorisée dans l'onglet (sessionStorage) par AppLayout, reprise une
 * seule fois après la connexion (y compris après la double authentification).
 * Une déconnexion volontaire n'en mémorise aucune.
 */
const CLE = 'dnpec.suite';
let deconnexionVolontaire = false;

/** Chemin interne seulement (jamais une autre origine), hors pages de connexion. */
function valide(chemin: string | null): chemin is string {
  return !!chemin && chemin.startsWith('/') && !chemin.startsWith('//') && !chemin.startsWith('/login') && chemin !== '/';
}

export function marquerDeconnexionVolontaire(): void {
  deconnexionVolontaire = true;
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : rien à oublier
  }
}

/** Renvoie vrai si la page a été mémorisée (session perdue, pas une déconnexion). */
export function memoriserSuite(chemin: string): boolean {
  if (deconnexionVolontaire || !valide(chemin)) return false;
  try {
    sessionStorage.setItem(CLE, chemin);
    return true;
  } catch {
    return false;
  }
}

/** Page à ouvrir après la connexion (puis oubliée), ou le tableau de bord. */
export function consommerSuite(): string {
  deconnexionVolontaire = false;
  try {
    const chemin = sessionStorage.getItem(CLE);
    sessionStorage.removeItem(CLE);
    return valide(chemin) ? chemin : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
