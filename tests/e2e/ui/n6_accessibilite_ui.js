// N6 — accessibilité des écrans principaux (SOC-PLT-04, WCAG 2.1 niveau AA) : audit automatique axe-core
// sous Chromium, bureau et téléphone, pour chaque profil sur ses écrans (accueil et connexion exclus :
// identité visuelle validée, contrôlée inchangée). Aucune violation « grave » ni
// « critique » admise ; les violations « modérées » et « mineures » sont listées dans le rapport
// (out/accessibilite.md) pour la revue manuelle qui complète l'audit.
const fs = require('fs');
const path = require('path');
const { AxeBuilder } = require('@axe-core/playwright');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const ECRANS = [
  ['agent1', '/dashboard'],
  ['agent1', '/tasks'],
  ['agent1', '/leaves'],
  ['agent1', '/personnel'],
  ['agent1', '/documents'],
  ['agent1', '/communication'],
  ['agent1', '/plan-travail'],
  ['agent1', '/logistique?onglet=vehicules'],
  ['agent1', '/rh?onglet=fiches'],
  ['chefdpe', '/dashboard'],
  ['chefdpe', '/reunions'],
  ['dn', '/dashboard'],
  ['dn', '/courrier'],
  ['dn', '/instructions'],
  ['drh', '/rh?onglet=effectifs'],
  ['drh', '/rh?onglet=alertes'],
  ['drh', '/rh?onglet=carriere'],
  ['drh', '/stages'],
  ['admin', '/users'],
  ['admin', '/parametrage'],
];
const GRAVES = ['serious', 'critical'];

(async () => {
  const b = await browser();
  const rapport = ['# Audit d’accessibilité automatique (axe-core, WCAG 2.1 A et AA)', '', '| Profil | Écran | Format | Règle | Impact | Éléments |', '|---|---|---|---|---|---|'];
  for (const [vue, taille] of [['bureau', undefined], ['téléphone', TELEPHONE]]) {
    console.log(`— ${vue}`);
    const pages = {};
    for (const [compte, url] of ECRANS) {
      const p = (pages[compte] = pages[compte] || (await loginPage(b, compte, taille)));
      await p.goto(WEB + url);
      await p.waitForLoadState('networkidle').catch(() => {});
      await p.waitForTimeout(400);
      const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of r.violations) rapport.push(`| ${compte} | ${url} | ${vue} | ${v.id} | ${v.impact} | ${v.nodes.length} |`);
      const graves = r.violations.filter((v) => GRAVES.includes(v.impact));
      check(`${compte} ${url} (${vue}) : aucune violation grave ou critique`, graves.length === 0, graves.map((v) => `${v.id} (${v.nodes.length}) : ${v.nodes[0]?.target?.join(' ')}`).join(' ; '));
    }
    for (const p of Object.values(pages)) await p.context().close();
  }
  // Accueil et connexion : identité visuelle validée inchangée (couleurs de la maquette, hors .contraste-aa).
  for (const url of ['/', '/login']) {
    const p = await (await b.newContext({ locale: 'fr-FR' })).newPage();
    await p.goto(WEB + url);
    await p.waitForLoadState('networkidle').catch(() => {});
    const c = await p.evaluate(() => ({ sage: getComputedStyle(document.body).getPropertyValue('--couleur-sage').trim(), faint: getComputedStyle(document.body).getPropertyValue('--couleur-texte-faint').trim(), aa: document.querySelectorAll('.contraste-aa').length }));
    check(`${url} : couleurs d’origine (vert #1c8b4b, gris #9298a8), sans la correction de contraste`, c.sage === '#1c8b4b' && c.faint === '#9298a8' && c.aa === 0, JSON.stringify(c));
    await p.context().close();
  }
  fs.writeFileSync(path.join(E.OUT, 'accessibilite.md'), rapport.join('\n') + '\n');
  await b.close();
  bilan();
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
