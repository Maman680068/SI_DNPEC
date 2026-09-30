/**
 * Montant en toutes lettres (SIG-RF-DOC-05), orthographe traditionnelle et accords du français :
 * « deux cents » mais « deux cent un » et « cinq cent mille » ; « quatre-vingts », « quatre-vingts
 * mille » mais « quatre-vingt-un mille » ; « mille » invariable ; « million » et « milliard » prennent
 * la marque du pluriel (« deux cents millions »).
 */
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0 à 99 (0 non écrit, sauf seul). */
function moinsDeCent(n: number): string {
  if (n <= 16) return UNITES[n]!;
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10), u = n % 10;
    if (u === 0) return DIZAINES[d]!;
    if (u === 1) return `${DIZAINES[d]} et un`;
    return `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${moinsDeCent(n - 60)}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${moinsDeCent(n - 80)}`;
}

/** 1 à 999 ; `devantMille` : « cent » reste invariable devant « mille ». */
function moinsDeMille(n: number, devantMille: boolean): string {
  const c = Math.floor(n / 100), r = n % 100;
  const mots: string[] = [];
  if (c === 1) mots.push('cent');
  else if (c > 1) mots.push(`${UNITES[c]} cent${r === 0 && !devantMille ? 's' : ''}`);
  if (r > 0) mots.push(moinsDeCent(r));
  return mots.join(' ');
}

export function nombreEnLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('Montant entier positif attendu');
  if (n === 0) return 'zéro';
  const milliards = Math.floor(n / 1e9), millions = Math.floor((n % 1e9) / 1e6), milliers = Math.floor((n % 1e6) / 1e3), reste = n % 1e3;
  const mots: string[] = [];
  if (milliards) mots.push(`${moinsDeMille(milliards, false)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) mots.push(`${moinsDeMille(millions, false)} million${millions > 1 ? 's' : ''}`);
  if (milliers) mots.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, true)} mille`);
  if (reste) mots.push(moinsDeMille(reste, false));
  return mots.join(' ');
}

/** « cinq cent mille (500 000) francs guinéens ». */
export function montantEnLettres(n: number, devise = 'francs guinéens'): string {
  const chiffres = n.toLocaleString('fr-FR').replace(/ | /g, ' ');
  return `${nombreEnLettres(n)} (${chiffres}) ${n <= 1 ? devise.replace(/s\b/g, '') : devise}`;
}
