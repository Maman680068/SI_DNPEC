import type { Folder } from './types';

/** Affichage de la GED (refonte de l'interface) : périodes, dates, tailles, chemins de dossier. */

const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Dates de la GED : jours calendaires (stockés à minuit UTC). */
const jma = (iso: string) => {
  const d = new Date(iso);
  return { j: d.getUTCDate(), m: d.getUTCMonth(), a: d.getUTCFullYear() };
};
const dernierJour = (m: number, a: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();

/** Période couverte, forme courte du tableau : « 2026 », « 2026 – 2030 », « sept. 2026 », « août – sept. 2026 », « 28 sept. 2026 ». */
export function periodeCourte(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return 'À compléter';
  const d = jma(debut);
  const f = jma(fin);
  const anneesEntieres = d.j === 1 && d.m === 0 && f.j === 31 && f.m === 11;
  if (anneesEntieres) return d.a === f.a ? `${d.a}` : `${d.a} – ${f.a}`;
  if (d.a === f.a && d.m === f.m && d.j === f.j) return `${d.j} ${MOIS_COURT[d.m]} ${d.a}`;
  if (d.a === f.a && d.m === f.m) return `${MOIS_COURT[d.m]} ${d.a}`;
  if (d.a === f.a) return `${MOIS_COURT[d.m]} – ${MOIS_COURT[f.m]} ${d.a}`;
  return `${MOIS_COURT[d.m]} ${d.a} – ${MOIS_COURT[f.m]} ${f.a}`;
}

/** Période couverte, forme longue de la fenêtre : « 4 août – 3 septembre 2026 ». */
export function periodeLongue(debut: string | null, fin: string | null): string | null {
  if (!debut || !fin) return null;
  const d = jma(debut);
  const f = jma(fin);
  if (d.j === 1 && f.j === dernierJour(f.m, f.a) && d.a === f.a && d.m === f.m) return `${MOIS_LONG[d.m]} ${d.a}`;
  if (d.a === f.a && d.m === f.m && d.j === f.j) return `${d.j} ${MOIS_LONG[d.m]} ${d.a}`;
  if (d.a === f.a) return `${d.j} ${MOIS_LONG[d.m]} – ${f.j} ${MOIS_LONG[f.m]} ${f.a}`;
  return `${d.j} ${MOIS_LONG[d.m]} ${d.a} – ${f.j} ${MOIS_LONG[f.m]} ${f.a}`;
}

/** Date calendaire longue : « 3 octobre 2026 ». */
export const dateLongue = (iso: string) => {
  const d = jma(iso);
  return `${d.j} ${MOIS_LONG[d.m]} ${d.a}`;
};

/** Date d'un événement (dépôt, publication) : « aujourd'hui », « hier », « 2 oct. », « 2 oct. 2025 ». */
export function dateRelative(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(maintenant) - jour(d)) / 86_400_000);
  if (ecart === 0) return 'aujourd’hui';
  if (ecart === 1) return 'hier';
  const j = d.getDate() === 1 ? '1er' : `${d.getDate()}`;
  return `${j} ${MOIS_COURT[d.getMonth()]}${d.getFullYear() !== maintenant.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

/** Date et heure courtes d'une version : « 3 oct., 01:30 ». */
export const dateHeure = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MOIS_COURT[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}, ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function taille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1_048_576) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1_048_576).toFixed(1).replace('.', ',')} Mo`;
}

/** Chemin d'un dossier depuis la racine de l'espace (noms des dossiers parents compris). */
export function cheminDossier(folderId: string | null, dossiers: Folder[]): Folder[] {
  const parId = new Map(dossiers.map((f) => [f.id, f]));
  const chemin: Folder[] = [];
  let f = folderId ? parId.get(folderId) : undefined;
  while (f && !chemin.includes(f)) {
    chemin.unshift(f);
    f = f.parentFolderId ? parId.get(f.parentFolderId) : undefined;
  }
  return chemin;
}

/** Choix simples du filtre « Période couverte » (bornes envoyées à l'API : couvreDu / couvreAu, chevauchement). */
export type ChoixPeriode = '' | 'annee' | 'precedente' | '12mois' | 'perso';
export function bornesPeriode(choix: ChoixPeriode, du: string, au: string, maintenant = new Date()): { couvreDu?: string; couvreAu?: string } {
  const a = maintenant.getFullYear();
  switch (choix) {
    case 'annee':
      return { couvreDu: `${a}-01-01`, couvreAu: `${a}-12-31` };
    case 'precedente':
      return { couvreDu: `${a - 1}-01-01`, couvreAu: `${a - 1}-12-31` };
    case '12mois': {
      const d = new Date(maintenant);
      d.setFullYear(a - 1);
      return { couvreDu: d.toISOString().slice(0, 10), couvreAu: maintenant.toISOString().slice(0, 10) };
    }
    case 'perso':
      return { couvreDu: du || undefined, couvreAu: au || undefined };
    default:
      return {};
  }
}
