import { PeriodeStageStatut, Prisma } from '@prisma/client';

/** Unité d'accueil d'une période : Division (+ Section) OU Cellule. */
export interface UniteStage {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/** Statuts d'une période qui occupent une place (plan du stagiaire, capacité). */
export const PERIODE_OCCUPANTE: PeriodeStageStatut[] = [
  PeriodeStageStatut.PROPOSEE,
  PeriodeStageStatut.ACCEPTEE,
  PeriodeStageStatut.EN_COURS,
  PeriodeStageStatut.TERMINEE,
];

/** Clé d'unité : « SEC:<id> », « DIV:<id> » ou « CEL:<id> ». */
export function cleUnite(u: UniteStage): string {
  if (u.sectionId) return `SEC:${u.sectionId}`;
  if (u.divisionId) return `DIV:${u.divisionId}`;
  return `CEL:${u.celluleId}`;
}

/** Clés dont la capacité s'applique à une période : une période en section
 * compte aussi pour sa division. */
export function clesCapacite(u: UniteStage): string[] {
  if (u.sectionId && u.divisionId) return [`SEC:${u.sectionId}`, `DIV:${u.divisionId}`];
  return [cleUnite(u)];
}

/** Filtre des périodes d'une clé d'unité (une division inclut ses sections). */
export function periodesDeLaCle(cle: string): Prisma.PeriodeStageWhereInput {
  const [type, id] = [cle.slice(0, 3), cle.slice(4)];
  if (type === 'SEC') return { sectionId: id };
  if (type === 'DIV') return { divisionId: id };
  return { celluleId: id };
}

export function uniteDeCle(cle: string): UniteStage | null {
  const m = /^(DIV|SEC|CEL):(.+)$/.exec(cle);
  if (!m) return null;
  const id = m[2]!;
  if (m[1] === 'CEL') return { divisionId: null, sectionId: null, celluleId: id };
  if (m[1] === 'DIV') return { divisionId: id, sectionId: null, celluleId: null };
  return { divisionId: null, sectionId: id, celluleId: null };
}

/** Jour (minuit UTC) d'une date — la Guinée est à UTC+0. */
export function jour(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const JOUR_MS = 24 * 60 * 60 * 1000;

export function chevauche(a: { dateDebut: Date; dateFin: Date }, b: { dateDebut: Date; dateFin: Date }): boolean {
  return a.dateDebut <= b.dateFin && b.dateDebut <= a.dateFin;
}

/** Nombre maximal d'intervalles [début, fin] (jours inclus) simultanés. */
export function maximumSimultane(intervalles: { dateDebut: Date; dateFin: Date }[]): number {
  const evenements: [number, number][] = [];
  for (const i of intervalles) {
    evenements.push([i.dateDebut.getTime(), 1]);
    evenements.push([i.dateFin.getTime() + JOUR_MS, -1]);
  }
  evenements.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let courant = 0;
  let max = 0;
  for (const [, delta] of evenements) {
    courant += delta;
    max = Math.max(max, courant);
  }
  return max;
}

/** Critères de la grille d'évaluation (format GRILLE) et niveaux acceptés. */
export const CRITERES_GRILLE = ['assiduite', 'qualite', 'autonomie', 'integration'] as const;
export const NIVEAUX_GRILLE = ['INSUFFISANT', 'SATISFAISANT', 'TRES_SATISFAISANT'] as const;
