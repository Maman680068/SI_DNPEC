/**
 * Moteur de recherche « comme une messagerie » (S2, réutilisé par l'annuaire S4) : texte comparé sans
 * accents ni majuscules, chaque mot tapé doit se retrouver dans un des champs, et une personne dont un
 * mot COMMENCE par le texte passe avant celle qui ne fait que le contenir.
 */

/** Minuscules sans accents ni signes (« Sékou » → « sekou », « Œ » → « oe »). */
export function normaliser(texte: string | null | undefined): string {
  return (texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots de la recherche (normalisés, sans doublon). */
export function motsRecherche(q: string): string[] {
  return [...new Set(normaliser(q).split(' ').filter(Boolean))];
}

/**
 * Score d'une fiche pour une recherche : `null` si un mot n'est trouvé dans aucun champ ; sinon, plus
 * petit = meilleur (0 par mot trouvé en début de mot, 1 trouvé ailleurs), puis ordre des champs.
 */
export function scoreRecherche(mots: string[], champs: (string | null | undefined)[]): number | null {
  if (!mots.length) return 0;
  const normes = champs.map(normaliser);
  let score = 0;
  for (const mot of mots) {
    let meilleur: number | null = null;
    normes.forEach((c, i) => {
      if (!c) return;
      const debut = (' ' + c).includes(' ' + mot);
      const dedans = c.includes(mot);
      const s = debut ? i * 0.01 : dedans ? 1 + i * 0.01 : null;
      if (s !== null && (meilleur === null || s < meilleur)) meilleur = s;
    });
    if (meilleur === null) return null;
    score += meilleur;
  }
  return score;
}
