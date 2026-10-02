// Captures avant/après de la correction des contrastes (socle N6, WCAG 2.1 AA), pour la PR :
// docs/captures/n6/contraste_<écran>_avant.png et _apres.png. « Avant » = mêmes écrans avec les
// couleurs de la maquette (variables de .contraste-aa remises à leur valeur d'origine), « après » =
// couleurs assombries. Prises sur l'application locale après une relance de la suite.
//   NODE_PATH=apps/api/node_modules node tests/e2e/outils/captures_contraste.js
const fs = require('fs');
const path = require('path');
const E = require('../config');
const { browser, loginPage, WEB } = require('../ui/helpers');
const DEST = path.join(E.RACINE, 'docs/captures/n6');
const VUE = { width: 1280, height: 760 };
const ORIGINE = '.contraste-aa { --couleur-sage: #1c8b4b !important; --couleur-texte-faint: #9298a8 !important; }';
const ECRANS = [
  ['agent1', '/dashboard', 'tableau_de_bord'],
  ['agent1', '/tasks', 'taches'],
  ['chefdpe', '/leaves', 'conges'],
  ['drh', '/rh?onglet=effectifs', 'rh'],
];

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const b = await browser();
  for (const [compte, url, nom] of ECRANS) {
    const p = await loginPage(b, compte, VUE);
    for (const [etat, style] of [['avant', ORIGINE], ['apres', null]]) {
      await p.goto(WEB + url);
      if (style) await p.addStyleTag({ content: style });
      await p.waitForLoadState('networkidle').catch(() => {});
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(DEST, `contraste_${nom}_${etat}.png`) });
      console.log('  ✓', `contraste_${nom}_${etat}.png`);
    }
    await p.context().close();
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
