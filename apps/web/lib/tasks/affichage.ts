import type { Task, TaskPriority, TaskStatus } from './types';

/** Affichage des tâches (refonte de l'interface, maquettes validées) : statuts, priorités, échéances. */

export const STATUT_LIBELLE: Record<TaskStatus, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  SOUMISE_VALIDATION: 'En validation',
  TERMINEE: 'Terminée',
};

/** Pastille de statut (fond pâle, texte et point de la couleur du statut). */
export const STATUT_PASTILLE: Record<TaskStatus, string> = {
  A_FAIRE: 'bg-fond-gris text-text-fort',
  EN_COURS: 'bg-ink-50 text-ink',
  SOUMISE_VALIDATION: 'bg-gold-50 text-ambre',
  TERMINEE: 'bg-sage-50 text-sage',
};

export const PRIORITE_LIBELLE: Record<TaskPriority, string> = { URGENT: 'Haute', NORMAL: 'Normale', FAIBLE: 'Basse' };
export const PRIORITE_COULEUR: Record<TaskPriority, string> = { URGENT: 'bg-clay', NORMAL: 'bg-ink', FAIBLE: 'bg-[#A3A9BA]' };
export const PRIORITE_ORDRE: Record<TaskPriority, number> = { URGENT: 0, NORMAL: 1, FAIBLE: 2 };

const JOUR = 86_400_000;
export const estClose = (t: Pick<Task, 'status'>) => t.status === 'TERMINEE';

/** Jours (calendaires, heure de Conakry = UTC) entre aujourd'hui et l'échéance ; négatif = dépassée. */
export function joursAvantEcheance(t: Pick<Task, 'dueDate'>, maintenant = new Date()): number | null {
  if (!t.dueDate) return null;
  const jour = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((jour(new Date(t.dueDate)) - jour(maintenant)) / JOUR);
}

export const estEnRetard = (t: Pick<Task, 'dueDate' | 'status'>, maintenant = new Date()) => !estClose(t) && (joursAvantEcheance(t, maintenant) ?? 0) < 0;

export type GroupeEcheance = 'retard' | 'semaine' | 'plusTard' | 'terminees';
export const GROUPES_ECHEANCE: { cle: GroupeEcheance; libelle: string }[] = [
  { cle: 'retard', libelle: 'En retard' },
  { cle: 'semaine', libelle: 'Cette semaine' },
  { cle: 'plusTard', libelle: 'Plus tard' },
  { cle: 'terminees', libelle: 'Terminées' },
];
/** En retard, cette semaine (7 jours), plus tard (ou sans échéance) ; les closes à part. */
export function groupeEcheance(t: Task, maintenant = new Date()): GroupeEcheance {
  if (estClose(t)) return 'terminees';
  const j = joursAvantEcheance(t, maintenant);
  if (j === null) return 'plusTard';
  if (j < 0) return 'retard';
  return j <= 7 ? 'semaine' : 'plusTard';
}

/** Échéance courte : « 27 sept. », ou « mar. 6 oct. » dans la semaine. */
export function dateEcheance(t: Pick<Task, 'dueDate'>, avecJour = false): string {
  if (!t.dueDate) return '—';
  return new Date(t.dueDate).toLocaleDateString('fr-FR', { ...(avecJour ? { weekday: 'short' } : {}), day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Ton de l'échéance : dépassée, proche (4 jours), dans la semaine, plus tard. */
export function tonEcheance(t: Task, maintenant = new Date()): 'retard' | 'proche' | 'semaine' | 'tard' | 'aucune' {
  const j = joursAvantEcheance(t, maintenant);
  if (j === null || estClose(t)) return 'aucune';
  if (j < 0) return 'retard';
  if (j <= 4) return 'proche';
  return j <= 7 ? 'semaine' : 'tard';
}
export const PUCE_ECHEANCE: Record<ReturnType<typeof tonEcheance>, string> = {
  retard: 'bg-clay-50 text-clay',
  proche: 'bg-gold-50 text-ambre',
  semaine: 'bg-ink-50 text-ink',
  tard: 'bg-fond-gris text-text-muted',
  aucune: 'bg-fond-gris text-text-muted',
};

/**
 * Action directe d'une ligne (tableau de bord) : Démarrer (créateur ou personne assignée), Soumettre
 * (créateur ou responsable), sinon Voir/Ouvrir. Mêmes règles que les boutons de la fiche ; l'API reste
 * seule juge.
 */
export function actionDirecte(t: Task, moi: string | undefined): { libelle: string; action: 'demarrer' | 'soumettre' | null } {
  const createur = t.createdById === moi;
  const assigne = t.assignees.some((a) => a.userId === moi);
  const responsable = t.assignees.some((a) => a.userId === moi && a.roleOnTask === 'RESPONSABLE');
  if (t.status === 'A_FAIRE' && (createur || assigne)) return { libelle: 'Démarrer', action: 'demarrer' };
  if (t.status === 'EN_COURS' && (createur || responsable)) return { libelle: 'Soumettre', action: 'soumettre' };
  return { libelle: t.status === 'SOUMISE_VALIDATION' || t.status === 'TERMINEE' ? 'Voir' : 'Ouvrir', action: null };
}
