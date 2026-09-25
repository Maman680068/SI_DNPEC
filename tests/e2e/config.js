// Configuration de la suite de bout en bout : tous les chemins sont déduits
// du dépôt, jamais écrits en dur. Les fichiers produits (état, captures,
// journaux, fichiers temporaires) vont dans E2E_OUT (défaut : tests/e2e/out,
// ignoré par git).
const path = require('path');
const fs = require('fs');

const RACINE = path.resolve(__dirname, '../..');
const OUT = path.resolve(process.env.E2E_OUT || path.join(__dirname, 'out'));

const E = {
  RACINE,
  API_DIR: path.join(RACINE, 'apps/api'),
  API_DIST: path.join(RACINE, 'apps/api/dist'),
  API_SRC: path.join(RACINE, 'apps/api/src'),
  OUT,
  SHOTS: path.join(OUT, 'shots'),
  /** Fichier d'état partagé entre suites (identifiants du jeu de données, registres...). */
  etat: (nom) => path.join(OUT, 'etat', nom),
  /** Dossier temporaire propre à une suite. */
  tmp: (nom) => path.join(OUT, 'tmp', nom),
};

for (const d of [E.SHOTS, path.join(OUT, 'etat'), path.join(OUT, 'tmp')]) fs.mkdirSync(d, { recursive: true });

module.exports = E;
