/**
 * Références courtes (numéros stables donnés par l'API) : « T-418 » pour une tâche, « A-07 » pour une
 * activité du plan de travail (deux chiffres au moins). Mise en forme seulement.
 */
export const referenceTache = (numero: number | null | undefined) => (numero ? `T-${numero}` : '');
export const referenceActivite = (numero: number | null | undefined) => (numero ? `A-${String(numero).padStart(2, '0')}` : '');
