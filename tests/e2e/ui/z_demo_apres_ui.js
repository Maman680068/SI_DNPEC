// Z — démonstration sous Chromium, après « supprimer » : plus aucun contenu « TEST — » dans les
// écrans des comptes réels ; seuls apparaissent, là où ils sont listés, les éléments annulés,
// supprimés ou désactivés (courrier annulé, comptes désactivés — « Supprimé » avant N1 —, unités désactivées).
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');

const SANS_TEST = [
  ['dn', ['/dashboard', '/tasks', '/reunions', '/communication', '/documents', '/leaves', '/suggestions', '/logistique', '/stages', '/annuaire', '/organisation']],
  ['admin', ['/dashboard', '/tasks', '/logistique', '/stages/parametres']],
  ['chefdpe', ['/dashboard', '/tasks', '/reunions', '/documents', '/leaves']],
  ['agent1', ['/dashboard', '/tasks', '/communication', '/documents', '/logistique']],
];
// Écrans où les éléments de démonstration restent visibles, mais uniquement annulés / supprimés / désactivés.
const MARQUES = [
  ['dn', '/courrier', /annul|désactivé/i, 'Arrivées'],
  ['dn', '/courrier', /annul|désactivé/i, 'Départs et actes'],
  ['admin', '/users', /supprim|désactiv/i],
  ['dn', '/personnel', /supprim|désactiv/i],
];

(async () => {
  const b = await browser();
  for (const [compte, urls] of SANS_TEST) {
    const p = await loginPage(b, compte);
    for (const url of urls) {
      await p.goto(WEB + url);
      await p.waitForLoadState('networkidle').catch(() => {});
      await p.waitForTimeout(600);
      const t = await p.locator('body').innerText();
      check(`${compte} ${url} : aucun « TEST — »`, !t.includes('TEST — '), (t.split('\n').find((l) => l.includes('TEST — ')) || '').slice(0, 120));
    }
    await p.context().close();
  }
  for (const [compte, url, marque, onglet] of MARQUES) {
    const p = await loginPage(b, compte);
    await p.goto(WEB + url);
    if (onglet) await p.getByRole('tab', { name: onglet, exact: true }).first().click();
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(600);
    // Chaque mention « TEST — » doit porter sa marque dans sa carte (3 lignes avant ou après).
    const toutes = (await p.locator('body').innerText()).split('\n');
    const blocs = toutes.map((l, i) => (l.includes('TEST — ') ? toutes.slice(Math.max(0, i - 3), i + 4).join(' ') : null)).filter(Boolean);
    if (url === '/courrier') check(`${compte} ${url} (${onglet}) : jamais de clé d’unité brute (« unité supprimée »)`, !toutes.some((l) => /(DIV|CEL|SEC):[a-z0-9]{10,}/.test(l)));
    check(`${compte} ${url}${onglet ? ` (${onglet})` : ''} : éléments de démonstration seulement ${marque} (${blocs.length})`, blocs.every((b) => marque.test(b)), blocs.filter((b) => !marque.test(b)).slice(0, 2).join(' | '));
    await p.screenshot({ path: `${E.SHOTS}/demo_apres_${compte}${url.replace(/\//g, '_')}${onglet ? '_' + onglet.replace(/\W+/g, '_') : ''}.png`, fullPage: true });
    await p.context().close();
  }
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
