import type { Meeting } from './types';

/** Mise en forme des réunions (refonte de l'interface, étape 6). */

export const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « 10:00 – 11:00 », ou « 10:00 » sans fin. */
export const horaire = (m: Pick<Meeting, 'startAt' | 'endAt'>) => (m.endAt ? `${heure(m.startAt)} – ${heure(m.endAt)}` : heure(m.startAt));

/** Lundi 0 h de la semaine d'une date. */
export function lundiDe(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Semaine affichée par défaut : la semaine en cours, ou la suivante le samedi et le dimanche. */
export function semaineCourante(): Date {
  const d = new Date();
  return lundiDe([0, 6].includes(d.getDay()) ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2) : d);
}

export const ajouterJours = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const memeJour = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** « Semaine du 5 au 9 octobre » (mois répété s'il change). */
export function titreSemaine(lundi: Date): string {
  const vendredi = ajouterJours(lundi, 4);
  const mois = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long' });
  const annee = vendredi.getFullYear() !== new Date().getFullYear() ? ` ${vendredi.getFullYear()}` : '';
  return lundi.getMonth() === vendredi.getMonth()
    ? `Semaine du ${lundi.getDate()} au ${vendredi.getDate()} ${mois(vendredi)}${annee}`
    : `Semaine du ${lundi.getDate()} ${mois(lundi)} au ${vendredi.getDate()} ${mois(vendredi)}${annee}`;
}

export const jourCourt = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase() + '.';
export const dateLongue = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export type Relation = 'organisateur' | 'confirme' | 'attente' | 'decline' | 'perimetre' | 'annulee';

/** Place de la personne dans la réunion (couleur du calendrier, boutons de réponse). */
export function relationDe(m: Meeting, userId: string | undefined): Relation {
  if (m.status === 'ANNULEE') return 'annulee';
  if (m.createdById === userId) return 'organisateur';
  const p = m.participants.find((x) => x.userId === userId);
  if (!p) return 'perimetre';
  return p.responseStatus === 'CONFIRME' ? 'confirme' : p.responseStatus === 'DECLINE' ? 'decline' : 'attente';
}

/** Couleur d'une réunion dans le calendrier (maquette : bleu, or, vert). */
export const COULEUR_RELATION: Record<Relation, string> = {
  organisateur: 'border-ink bg-ink-50',
  confirme: 'border-sage bg-sage-50',
  attente: 'border-gold bg-gold-50',
  decline: 'border-[#CDD1DF] bg-[#F4F5F9]',
  perimetre: 'border-[#7D8BC4] bg-[#F4F6FC]',
  annulee: 'border-[#CDD1DF] bg-[#F4F5F9]',
};

export const LIBELLE_RELATION: Record<Relation, string> = {
  organisateur: 'organisée par vous',
  confirme: 'vous participez',
  attente: 'réponse attendue',
  decline: 'vous êtes absent',
  perimetre: 'dans votre périmètre',
  annulee: 'annulée',
};
