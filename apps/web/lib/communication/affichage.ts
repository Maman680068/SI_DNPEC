/** Mise en forme de la messagerie (refonte de l'interface, étape 6). */

const jourDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const ecartJours = (iso: string) => Math.round((jourDe(new Date()) - jourDe(new Date(iso))) / 86_400_000);

export const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Heure du dernier message dans la liste : « 09:42 », « hier », « 30 sept. ». */
export function quandListe(iso: string): string {
  const e = ecartJours(iso);
  if (e === 0) return heure(iso);
  if (e === 1) return 'hier';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Séparateur de jour dans l'échange : « Aujourd’hui », « Hier », « lundi 28 septembre ». */
export function libelleJour(iso: string): string {
  const e = ecartJours(iso);
  if (e === 0) return 'Aujourd’hui';
  if (e === 1) return 'Hier';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

export const memeJour = (a: string, b: string) => jourDe(new Date(a)) === jourDe(new Date(b));

/**
 * Document des Archives cité dans un message : une ligne « Document des Archives : /documents?id=… »
 * ajoutée par le trombone (l'adresse de la page du document, sans son titre : le destinataire ne
 * voit le titre que s'il a le droit d'ouvrir le document — l'API le dit, GET …/contexte).
 */
export const ligneDocument = (id: string) => `Document des Archives : /documents?id=${id}`;
const LIGNE_DOCUMENT = /^Document des Archives : \/documents\?id=([A-Za-z0-9_-]+)\s*$/;
const MOTIF_DOCUMENT = /\/documents\?id=([A-Za-z0-9_-]+)/g;

/** Texte à afficher (lignes du trombone retirées) et documents cités, dans l'ordre. */
export function decouperCorps(corps: string): { texte: string; documents: string[] } {
  const documents: string[] = [];
  const lignes = corps.split('\n').filter((l) => {
    const m = l.match(LIGNE_DOCUMENT);
    if (m) {
      if (!documents.includes(m[1]!)) documents.push(m[1]!);
      return false;
    }
    for (const x of l.matchAll(MOTIF_DOCUMENT)) if (!documents.includes(x[1]!)) documents.push(x[1]!);
    return true;
  });
  return { texte: lignes.join('\n').trim(), documents };
}

/** Extrait d'un dernier message pour la liste (renvoi vers un document résumé). */
export function extrait(corps: string): string {
  const { texte, documents } = decouperCorps(corps);
  return texte || (documents.length ? 'Document des Archives' : '');
}
