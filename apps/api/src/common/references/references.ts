/**
 * Références courtes (lot « références courtes ») : « T-418 » pour une tâche (séquence globale),
 * « A-07 » pour une activité du plan de travail (numéro dans l'année du plan, deux chiffres au moins).
 */
export const referenceTache = (numero: number) => `T-${numero}`;
export const referenceActivite = (numero: number) => `A-${String(numero).padStart(2, '0')}`;

/**
 * Saisie de recherche qui désigne une référence : « T-418 », « t418 », « T 418 », « A-07 », « a7 » ou
 * le numéro seul (« 418 » : tâche ou activité). Null si la saisie n'est pas une référence.
 */
export function lireReference(q: string): { lettre: 'T' | 'A' | null; numero: number } | null {
  const m = /^\s*([ta])?\s*-?\s*(\d{1,9})\s*$/i.exec(q);
  if (!m) return null;
  return { lettre: m[1] ? (m[1].toUpperCase() as 'T' | 'A') : null, numero: Number(m[2]) };
}
