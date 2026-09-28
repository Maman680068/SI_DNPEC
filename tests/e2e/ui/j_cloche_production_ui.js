// J — la cloche sous Chromium en conditions proches de la production : web compilé (next start),
// API en NODE_ENV=production avec CORS strict (CORS_ORIGIN saisie avec barre finale, voir
// run_all.sh), origines différentes pour le web et l'API. Puis les deux pannes qui produisaient
// « Failed to fetch » : web ouvert depuis une origine absente de CORS_ORIGIN, API injoignable.
const fs = require('fs');
const path = require('path');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');
const { call, ids } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const MESSAGE = 'Le serveur de l’application ne répond pas.';
const attendre = async (f, n = 40) => { for (let i = 0; i < n; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };

async function ouvrirCloche(p) {
  await p.getByRole('button', { name: /Notifications/ }).click();
  const panneau = p.getByRole('dialog', { name: 'Notifications' });
  await panneau.waitFor();
  return panneau;
}
async function connecter(p, base) {
  await p.goto(`${base}/login`);
  await p.getByLabel('Adresse e-mail').fill('agent1@test.local');
  await p.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await p.getByRole('button', { name: /connecter/i }).click();
  await p.waitForURL('**/dashboard');
}

(async () => {
  await call('chefdpe', 'POST', '/messages', { recipientId: ids.agent1, body: `Cloche production ${S}` });
  const b = await browser();

  console.log('— Web et API sur deux origines, CORS strict');
  const p = await loginPage(b, 'agent1');
  const erreursReseau = [];
  // Appels à l'API refusés par le navigateur (CORS) ; une navigation qui interrompt une requête (ERR_ABORTED) n'en est pas un.
  p.on('requestfailed', (r) => r.url().startsWith('http://localhost:3000') && r.failure()?.errorText !== 'net::ERR_ABORTED' && erreursReseau.push(`${r.url()} ${r.failure()?.errorText}`));
  const panneau = await ouvrirCloche(p);
  check('la cloche liste la notification du message', await attendre(async () => (await panneau.locator('[data-testid=notification]').filter({ hasText: `Cloche production ${S}` }).count()) === 1));
  check('aucun « Failed to fetch » ni message d’erreur', (await panneau.getByText(/Failed to fetch|ne répond pas/).count()) === 0);
  check('compteur de non lues affiché (valeur de l’API)', await attendre(async () => (await p.locator('[data-testid=compteur-notifications]').count()) === 1));
  await p.screenshot({ path: `${E.SHOTS}/j_cloche_production.png` });
  await p.keyboard.press('Escape');
  await p.goto(`${WEB}/communication?with=${ids.chefdpe}`);
  await p.getByText(`Cloche production ${S}`).last().waitFor();
  check('les autres écrans appellent aussi l’API (messagerie chargée)', true);
  check('aucune requête bloquée par le navigateur', erreursReseau.length === 0, erreursReseau.slice(0, 3).join(' | '));
  await p.context().close();

  console.log('— Web ouvert depuis une origine absente de CORS_ORIGIN (http://127.0.0.1:3100)');
  const autre = WEB.replace('localhost', '127.0.0.1');
  const q = await (await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' })).newPage();
  await connecter(q, autre);
  check('connexion possible (passe par le serveur du web, pas par CORS)', true);
  const pq = await ouvrirCloche(q);
  check('la cloche affiche le message français, pas « Failed to fetch »', await attendre(async () => (await pq.getByText(MESSAGE).count()) === 1) && (await pq.getByText('Failed to fetch').count()) === 0);
  await q.screenshot({ path: `${E.SHOTS}/j_cloche_origine_refusee.png` });
  const journal = fs.readFileSync(path.join(E.OUT, 'logs', 'api-normal.log'), 'utf8');
  check('l’API journalise l’origine refusée (visible dans les logs Render)', journal.includes(`Origine refusée : ${autre}`));
  await q.context().close();

  console.log('— API injoignable (arrêtée, en redémarrage) : bureau et mobile');
  for (const viewport of [{ width: 1366, height: 860 }, { width: 390, height: 844 }]) {
    const r = await loginPage(b, 'agent1', viewport);
    await r.route('http://localhost:3000/**', (route) => route.abort('connectionrefused'));
    const pr = await ouvrirCloche(r);
    check(`${viewport.width}px : message français dans la cloche`, await attendre(async () => (await pr.getByText(MESSAGE).count()) === 1) && (await pr.getByText('Failed to fetch').count()) === 0);
    await r.goto(`${WEB}/annuaire`);
    check(`${viewport.width}px : même message sur une page (Annuaire, bandeau d’erreur)`, await attendre(async () => (await r.getByRole('alert').filter({ hasText: MESSAGE }).count()) === 1));
    if (viewport.width === 390) {
      check('mobile : sans défilement horizontal', (await r.evaluate(() => document.documentElement.scrollWidth)) <= 390);
      await r.screenshot({ path: `${E.SHOTS}/j_api_injoignable_mobile.png` });
    }
    await r.context().close();
  }

  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
