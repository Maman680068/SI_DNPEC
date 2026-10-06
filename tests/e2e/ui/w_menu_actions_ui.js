// Correctif d'affichage — Administration → Utilisateurs, colonne Actions : « Gérer » seul visible, puis
// « Plus d'actions » (⋯) qui ouvre un menu (Nommer chef de cellule, Changer de rôle — seulement quand
// elles sont proposées pour ce compte). Menu : clic extérieur, Échap, clavier, jamais coupé (ouverture
// vers le haut). Libellés sur une ligne, lignes de même hauteur ; téléphone 390 px ; audit axe.
const { AxeBuilder } = require('@axe-core/playwright');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const BUREAU = { width: 1440, height: 900 };
const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const GRAVES = ['serious', 'critical'];

(async () => {
  // Un compte sans aucune action secondaire : DRH suspendu (ni Chargé d'Études ni Chef de Cellule, pas actif).
  const sans = (await call('admin', 'POST', '/users', { email: `w.sans.${S}@test.local`, password: 'Password123!', firstName: 'Sans', lastName: `Action${S}`, role: 'DRH', celluleId: ids.SAF })).body;
  await call('admin', 'PATCH', `/users/${sans.id}/status`, { status: 'SUSPENDU' });
  const agent = (await call('admin', 'POST', '/users', { email: `w.agent.${S}@test.local`, password: 'Password123!', firstName: 'Avec', lastName: `Actions${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR })).body;

  const b = await browser();
  let p = await loginPage(b, 'admin', BUREAU);
  await p.goto(`${WEB}/users`);
  const ligne = (email) => p.locator('tr', { hasText: email });
  await ligne(agent.email).waitFor();

  console.log('— Colonne Actions');
  const lignes = p.locator('tbody tr');
  const n = await lignes.count();
  let seulGerer = true;
  for (let i = 0; i < n; i++) {
    const libelles = (await lignes.nth(i).locator('td').last().getByRole('button').evaluateAll((bs) => bs.map((x) => x.getAttribute('aria-label') || x.textContent.trim())));
    if (libelles[0] !== 'Gérer' || libelles.length > 2 || (libelles.length === 2 && libelles[1] !== 'Plus d’actions')) seulGerer = false;
  }
  check(`chaque ligne (${n}) : « Gérer » puis, au plus, « Plus d’actions »`, seulGerer);
  const hauteurs = await lignes.evaluateAll((trs) => [...new Set(trs.map((t) => Math.round(t.getBoundingClientRect().height)))]);
  check('toutes les lignes ont la même hauteur', hauteurs.length === 1, hauteurs.join(', '));
  const deborde = await p.locator('tbody button').evaluateAll((bs) => bs.filter((x) => x.getBoundingClientRect().height > 32 || x.scrollWidth > x.clientWidth + 1).length);
  check('aucun libellé de bouton sur deux lignes', deborde === 0, String(deborde));
  check('tableau sans défilement horizontal (bureau)', await p.locator('table').first().evaluate((t) => t.parentElement.scrollWidth <= t.parentElement.clientWidth + 1));
  check('compte sans action secondaire : pas de « ⋯ »', (await ligne(sans.email).getByRole('button', { name: 'Plus d’actions' }).count()) === 0);

  console.log('— Menu');
  const plus = ligne(agent.email).getByRole('button', { name: 'Plus d’actions' });
  check('« ⋯ » : menu annoncé (aria-haspopup), fermé', (await plus.getAttribute('aria-haspopup')) === 'menu' && (await plus.getAttribute('aria-expanded')) === 'false');
  await plus.click();
  const menu = p.getByRole('menu');
  await menu.waitFor();
  check('menu : « Nommer chef de cellule », « Changer de rôle »', (await menu.getByRole('menuitem').allInnerTexts()).join('|') === 'Nommer chef de cellule|Changer de rôle');
  check('premier choix mis au point', await menu.getByRole('menuitem').first().evaluate((x) => x === document.activeElement));
  await p.screenshot({ path: `${E.SHOTS}/w_menu_actions_bureau.png` });
  const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const graves = axe.violations.filter((v) => GRAVES.includes(v.impact));
  check('axe (menu ouvert, bureau) : aucune violation grave ou critique', graves.length === 0, graves.map((v) => `${v.id} : ${v.nodes[0]?.target?.join(' ')}`).join(' ; '));
  await p.keyboard.press('ArrowDown');
  check('↓ : choix suivant', (await menu.getByRole('menuitem', { name: 'Changer de rôle' }).evaluate((x) => x === document.activeElement)));
  await p.keyboard.press('Escape');
  check('Échap : menu fermé, retour sur « ⋯ »', (await menu.count()) === 0 && (await plus.evaluate((x) => x === document.activeElement)));
  await plus.click();
  await menu.waitFor();
  await p.mouse.click(5, 5);
  check('clic à l’extérieur : menu fermé', (await menu.count()) === 0);
  await plus.click();
  await menu.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  await p.getByRole('dialog').getByLabel('Motif', { exact: true }).waitFor();
  check('« Changer de rôle » : même fenêtre qu’avant (motif exigé)', true);
  await p.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

  console.log('— Menu en bas de l’écran : ouvert vers le haut, jamais coupé');
  await p.setViewportSize({ width: 1440, height: 500 });
  const derniere = p.locator('tbody tr').filter({ has: p.getByRole('button', { name: 'Plus d’actions' }) }).last();
  await derniere.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 10000));
  await derniere.getByRole('button', { name: 'Plus d’actions' }).click();
  await menu.waitFor();
  const r = await menu.evaluate((m) => { const x = m.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, h: window.innerHeight }; });
  check('menu entièrement visible', r.top >= 0 && r.bottom <= r.h, JSON.stringify(r));
  await p.keyboard.press('Escape');
  await p.context().close();

  console.log('— Téléphone (390 px)');
  p = await loginPage(b, 'admin', TELEPHONE);
  await p.goto(`${WEB}/users`);
  const carte = p.getByTestId('carte-compte').filter({ hasText: agent.email });
  await carte.waitFor();
  check('carte : « Gérer » puis « Plus d’actions »', (await carte.getByRole('button').evaluateAll((bs) => bs.map((x) => x.getAttribute('aria-label') || x.textContent.trim()))).join('|') === 'Gérer|Plus d’actions');
  await carte.getByRole('button', { name: 'Plus d’actions' }).click();
  await p.getByRole('menu').waitFor();
  check('menu ouvert : pas de défilement horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const rm = await p.getByRole('menu').evaluate((m) => { const x = m.getBoundingClientRect(); return x.left >= 0 && x.right <= window.innerWidth && x.top >= 0 && x.bottom <= window.innerHeight; });
  check('menu entièrement dans l’écran', rm);
  await p.screenshot({ path: `${E.SHOTS}/w_menu_actions_telephone.png` });
  const axeT = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const gravesT = axeT.violations.filter((v) => GRAVES.includes(v.impact));
  check('axe (menu ouvert, téléphone) : aucune violation grave ou critique', gravesT.length === 0, gravesT.map((v) => `${v.id} : ${v.nodes[0]?.target?.join(' ')}`).join(' ; '));
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(1); });
