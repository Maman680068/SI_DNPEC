// Lot F — cloche de notifications, retour à la page visée après (re)connexion, erreurs de chargement.
const E = require('../config');
const { chromium } = require('playwright');
const { browser, loginPage, check, bilan, WEB, seDeconnecter } = require('./helpers');
const { call, ids } = require('../lib');
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
async function attendre(f) { for (let i = 0; i < 40; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
async function saisir(page, key) {
  await page.getByLabel('Adresse e-mail').fill(`${key}@test.local`);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: /connecter/i }).click();
}
(async () => {
  const b = await browser();

  console.log('— Cloche (DRH, bureau puis mobile)');
  await call('drh', 'PATCH', '/notifications/read-all');
  for (let i = 1; i <= 2; i++) await call('agent1', 'POST', `/personnel-files/${ids.agent1}/report-error`, { fieldLabel: 'Grade', comment: `Cloche ${S} n°${i}` });
  const p = await loginPage(b, 'drh');
  const compteur = p.locator('[data-testid=compteur-notifications]');
  await compteur.waitFor();
  check('compteur = non lues de l’API (2)', (await compteur.innerText()) === String((await call('drh', 'GET', '/notifications/unread-count')).body) && (await compteur.innerText()) === '2');
  await p.getByRole('button', { name: /Notifications/ }).click();
  const panneau = p.getByRole('dialog', { name: 'Notifications' });
  await panneau.locator('[data-testid=notification]').first().waitFor();
  check('liste : la plus récente en tête, non lue', /Cloche .* n°2/.test(await panneau.locator('[data-testid=notification]').first().innerText()) && /non lue/.test(await panneau.locator('[data-testid=notification]').first().innerText()));
  await p.screenshot({ path: `${SHOTS}/f_cloche_ouverte_desktop.png` });
  await panneau.locator('[data-testid=notification]').first().click();
  await p.waitForURL(`**/personnel/${ids.agent1}`);
  check('clic : ouvre l’élément lié (/personnel/:id)', true);
  check('compteur : 1 après lecture', await attendre(async () => (await compteur.innerText().catch(() => '')) === '1'));
  await p.getByRole('button', { name: /Notifications/ }).click();
  await p.getByRole('button', { name: 'Tout marquer comme lu' }).click();
  check('« Tout marquer comme lu » : compteur masqué', await attendre(async () => (await compteur.count()) === 0));
  check('API : 0 non lue', (await call('drh', 'GET', '/notifications/unread-count')).body === 0);
  await p.keyboard.press('Escape');
  check('Échap : panneau fermé', await attendre(async () => (await p.getByRole('dialog', { name: 'Notifications' }).count()) === 0));
  const m = await loginPage(b, 'drh', { width: 390, height: 844 });
  await m.getByRole('button', { name: /Notifications/ }).click();
  await m.getByRole('dialog', { name: 'Notifications' }).locator('[data-testid=notification]').first().waitFor();
  const box = await m.getByRole('dialog', { name: 'Notifications' }).boundingBox();
  check('mobile : panneau dans l’écran', box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
  await m.screenshot({ path: `${SHOTS}/f_cloche_mobile.png` });

  console.log('— Lien d’email ouvert sans session');
  const reunion = (await call('chefdpe', 'POST', '/meetings', { title: `Réunion lien email ${S}`, startAt: iso(J), participantIds: [ids.agent1] })).body;
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' });
  const q = await ctx.newPage();
  await q.goto(`${WEB}/reunions?id=${reunion.id}`);
  await q.waitForURL('**/login');
  check('sans session : redirection vers la connexion', true);
  await saisir(q, 'agent1');
  await q.waitForURL(`**/reunions?id=${reunion.id}`);
  await q.getByRole('heading', { name: `Réunion lien email ${S}` }).waitFor();
  check('après connexion : la réunion visée est ouverte (pas le tableau de bord)', true);

  console.log('— Session expirée en cours de route (cookies effacés), puis reconnexion');
  await ctx.clearCookies();
  await q.goto(`${WEB}/personnel/${ids.agent1}`);
  await q.waitForURL('**/login');
  await saisir(q, 'agent1');
  await q.waitForURL(`**/personnel/${ids.agent1}`);
  await q.locator('[data-testid=niveau-1]').waitFor();
  check('reconnexion : retour au dossier visé', true);

  console.log('— Déconnexion volontaire : pas de retour automatique');
  await seDeconnecter(q);
  await q.waitForURL(WEB + '/');
  await q.goto(`${WEB}/login`);
  await saisir(q, 'agent1');
  await q.waitForURL('**/dashboard');
  check('après une déconnexion volontaire : tableau de bord', true);
  const r = await ctx.newPage();
  await ctx.clearCookies();
  await r.goto(`${WEB}/login`);
  await saisir(r, 'agent1');
  await r.waitForURL('**/dashboard');
  check('connexion directe : tableau de bord', true);
  const ext = await ctx.newPage();
  await ctx.clearCookies();
  await ext.goto(`${WEB}/reunions`);
  await ext.waitForURL('**/login');
  await ext.evaluate(() => sessionStorage.setItem('dnpec.suite', '//exemple.org/piege'));
  await saisir(ext, 'agent1');
  await ext.waitForURL('**/dashboard');
  check('chemin externe injecté : ignoré (tableau de bord)', ext.url().startsWith(WEB + '/dashboard'));

  console.log('— Erreur de chargement affichée (Réunions, API simulée en panne)');
  const e = await loginPage(b, 'agent1');
  await e.route('http://localhost:3000/meetings', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, message: 'Service momentanément indisponible' }) }));
  await e.goto(`${WEB}/reunions`);
  const alerte = e.getByRole('alert').filter({ hasText: 'Réessayer' });
  await alerte.waitFor();
  check('message de l’API affiché, « Chargement… » masqué', /momentanément indisponible/.test(await alerte.innerText()) && (await e.getByText('Chargement…').count()) === 0);
  check('bouton « Réessayer »', (await alerte.getByRole('button', { name: 'Réessayer' }).count()) === 1);
  await e.screenshot({ path: `${SHOTS}/f_erreur_chargement_reunions.png` });
  await e.unroute('http://localhost:3000/meetings');
  await alerte.getByRole('button', { name: 'Réessayer' }).click();
  await e.getByRole('heading', { name: 'Réunions' }).waitFor();
  check('« Réessayer » : la liste se charge', await attendre(async () => (await e.getByRole('alert').filter({ hasText: 'Réessayer' }).count()) === 0 && (await e.getByText('Chargement…').count()) === 0));
  for (const [chemin, motif] of [['/leaves', '/leaves'], ['/annuaire', '/users/directory'], ['/users', '/users']]) {
    const key = chemin === '/users' ? 'admin' : 'agent1';
    const x = await loginPage(b, key);
    await x.route(new RegExp(`localhost:3000${motif.replace('/', '\\/')}(\\?|$)`), (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, message: 'Erreur serveur simulée' }) }));
    await x.goto(WEB + chemin);
    check(`${chemin} : erreur affichée`, await attendre(async () => (await x.getByRole('alert').filter({ hasText: 'simulée' }).count()) > 0));
  }

  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
