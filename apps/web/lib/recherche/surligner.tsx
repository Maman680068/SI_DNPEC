import type { ReactNode } from 'react';

/** Même normalisation que l'API (`common/recherche/texte.ts`), caractère par caractère. */
function normCar(c: string): string {
  const n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n === 'œ') return 'oe';
  if (n === 'æ') return 'ae';
  return /[a-z0-9]/.test(n) ? n : ' ';
}

/** Mots tapés, normalisés (sans accents ni majuscules). */
export function motsTapes(q: string): string[] {
  return [...new Set(Array.from(q).map(normCar).join('').split(' ').filter(Boolean))];
}

/**
 * Texte avec les lettres trouvées en gras : la mise en évidence seulement — le tri et le choix des
 * personnes viennent de l'API.
 */
export function surligner(texte: string, mots: string[]): ReactNode {
  if (!mots.length || !texte) return texte;
  // Correspondance position normalisée → position d'origine.
  let norme = '';
  const origine: number[] = [];
  Array.from(texte).forEach((c, i) => {
    const n = normCar(c);
    for (const x of n) {
      norme += x;
      origine.push(i);
    }
  });
  const chars = Array.from(texte);
  const gras = new Array<boolean>(chars.length).fill(false);
  for (const mot of mots) {
    let k = norme.indexOf(mot);
    while (k !== -1) {
      for (let j = k; j < k + mot.length; j++) gras[origine[j]!] = true;
      k = norme.indexOf(mot, k + mot.length);
    }
  }
  const morceaux: ReactNode[] = [];
  let courant = '';
  let etat = gras[0] ?? false;
  chars.forEach((c, i) => {
    if (gras[i] !== etat) {
      morceaux.push(etat ? <b key={i} className="font-extrabold text-ink-900">{courant}</b> : courant);
      courant = '';
      etat = gras[i]!;
    }
    courant += c;
  });
  morceaux.push(etat ? <b key="fin" className="font-extrabold text-ink-900">{courant}</b> : courant);
  return <>{morceaux}</>;
}
