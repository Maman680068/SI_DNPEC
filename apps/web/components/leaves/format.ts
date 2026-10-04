import type { TonPastille } from '../ui/Charte';
import type { LeaveRequest } from '../../lib/leaves/types';

/** Dates des congés : jours calendaires enregistrés à minuit UTC (aucun décalage de fuseau). */
const UTC = { timeZone: 'UTC' } as const;

/** « AAAA-MM-JJ » d'une date de congé. */
export const jourIso = (iso: string | Date) => (typeof iso === 'string' ? iso : iso.toISOString()).slice(0, 10);

/** « samedi 3 octobre 2026 ». */
export const dateLongue = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { ...UTC, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** « 3 oct. » (« 1er janv. » le premier du mois). */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  const texte = d.toLocaleDateString('fr-FR', { ...UTC, day: 'numeric', month: 'short' });
  return d.getUTCDate() === 1 ? texte.replace(/^1 /, '1er ') : texte;
}

/** « 3 octobre ». */
export const dateJourMois = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { ...UTC, day: 'numeric', month: 'long' });

/** Lendemain d'une date de congé (reprise du travail). */
export const lendemain = (iso: string) => new Date(new Date(iso).getTime() + 864e5).toISOString();

/** Période compacte : « 3 – 6 octobre », « 28 sept. – 3 oct. », années ajoutées si elles diffèrent de l'année en cours. */
export function periode(debut: string, fin: string): string {
  const d = new Date(debut);
  const f = new Date(fin);
  const annee = new Date().getFullYear();
  const memeAnnee = d.getUTCFullYear() === f.getUTCFullYear();
  const suffixe = memeAnnee && d.getUTCFullYear() === annee ? '' : ` ${f.getUTCFullYear()}`;
  if (jourIso(debut) === jourIso(fin)) return `${dateJourMois(debut)}${suffixe}`;
  if (memeAnnee && d.getUTCMonth() === f.getUTCMonth()) return `${d.getUTCDate()} – ${dateJourMois(fin)}${suffixe}`;
  if (memeAnnee) return `${dateCourte(debut)} – ${dateCourte(fin)}${suffixe}`;
  return `${dateCourte(debut)} ${d.getUTCFullYear()} – ${dateCourte(fin)} ${f.getUTCFullYear()}`;
}

/** Échéance de l'avis : « 7 octobre à 00:00 » (heure locale du navigateur). */
export const echeanceLongue = (iso: string) =>
  `${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

/** Échéance de l'avis : « 7 oct., 00:00 ». */
export const echeanceCourte = (iso: string) =>
  `${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

export const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

/** Type en minuscule initiale, pour une phrase (« congé maladie »). */
export const typeEnPhrase = (nom: string) => (nom ? nom.charAt(0).toLowerCase() + nom.slice(1) : nom);

/** Pastille de l'étape d'une demande (refus : motif à lire dans le détail). */
export function pastilleEtape(r: LeaveRequest): { ton: TonPastille; texte: string } {
  switch (r.etape) {
    case 'AVIS_ATTENDU':
      return { ton: 'ambre', texte: 'Avis du chef attendu' };
    case 'DECISION_ATTENDUE':
      return { ton: 'encre', texte: 'Décision du DRH attendue' };
    case 'APPROUVEE':
      return { ton: 'vert', texte: 'Approuvé' };
    case 'REFUSEE':
      return { ton: 'rouge', texte: 'Refusé (motif dans le détail)' };
    default:
      return { ton: 'gris', texte: 'Annulé' };
  }
}

/** Initiales d'un nom complet (« Mamadou Sylla » → « MS ») ; préfixe de démonstration ignoré. */
export function initialesNom(nom: string): string {
  const mots = nom.replace(/^TEST — /, '').split(/\s+/).filter(Boolean);
  return `${mots[0]?.charAt(0) ?? ''}${mots.length > 1 ? mots[mots.length - 1]!.charAt(0) : ''}`.toUpperCase();
}
