/**
 * Heures ouvrées (socle N3, circuit A6.1) : seules comptent les heures des jours du lundi au
 * vendredi (heure de Conakry = UTC), hors jours fériés (`feries` : dates « AAAA-MM-JJ », fournies
 * par JoursFeriesService). « 48 heures ouvrées » = deux jours ouvrés pleins : une demande déposée
 * le vendredi à 10 h a son échéance le mardi à 10 h (le mercredi si le lundi est férié).
 */
const HEURE = 3600e3;
const AUCUN: ReadonlySet<string> = new Set();
let feriesCourants: ReadonlySet<string> = AUCUN;
const ouvre = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !feriesCourants.has(d.toISOString().slice(0, 10));

/** Date atteinte après `heures` heures ouvrées à partir de `depart`. */
export function ajouterHeuresOuvrees(depart: Date, heures: number, feries: ReadonlySet<string> = AUCUN): Date {
  feriesCourants = feries;
  let t = new Date(depart);
  // Un départ pendant le week-end compte à partir du lundi 0 h.
  while (!ouvre(t)) t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1));
  let reste = heures * HEURE;
  while (reste > 0) {
    const finJour = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1);
    const dispo = finJour - t.getTime();
    if (reste <= dispo) return new Date(t.getTime() + reste);
    reste -= dispo;
    t = new Date(finJour);
    while (!ouvre(t)) t = new Date(t.getTime() + 24 * HEURE);
  }
  return t;
}

/** Heures ouvrées entre deux instants (0 si `fin` précède `debut`). */
export function heuresOuvreesEntre(debut: Date, fin: Date, feries: ReadonlySet<string> = AUCUN): number {
  feriesCourants = feries;
  if (fin <= debut) return 0;
  let n = 0;
  let t = debut.getTime();
  while (t < fin.getTime()) {
    const d = new Date(t);
    const finJour = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    const bout = Math.min(finJour, fin.getTime());
    if (ouvre(d)) n += bout - t;
    t = bout;
  }
  return n / HEURE;
}
