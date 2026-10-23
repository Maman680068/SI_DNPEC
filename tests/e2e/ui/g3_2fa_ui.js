// G3 — double authentification sous Chromium : activation depuis « Sécurité du compte »
// (QR code), connexion avec le code qui ramène à la page visée (lien profond), désactivation
// par code, réinitialisation par l'administrateur depuis Utilisateurs ; mobile sans défilement.
const E = require('../config');
const { authenticator } = require('otplib');
const { browser, check, bilan, WEB, seDeconnecter } = require('./helpers');
const { call } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const EMAIL = `g3ui${S}@test.local`;
async function code(secret) {
  const reste = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (reste <= 2) await new Promise((r) => setTimeout(r, (reste + 0.5) * 1000));
  return authenticator.generate(secret);
}
async function saisir(page, email) {
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: /connecter/i }).click();
}

/** Revue de sécurité 2026-10 : configurer la 2FA demande le mot de passe (fenêtre de réauthentification). */
async function confirmerIdentite(p) {
  const f = p.getByRole('dialog', { name: 'Confirmez votre identité' });
  await f.getByLabel('Votre mot de passe').fill('Password123!');
  await f.getByRole('button', { name: 'Confirmer' }).click();
  await f.waitFor({ state: 'detached' });
}

(async () => {
  const u = await call('admin', 'POST', '/users', { email: EMAIL, password: 'Password123!', firstName: 'Double', lastName: `Auth${S}`, role: 'AGENT' });
  check('compte de test créé', u.status === 201);
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  await p.goto(`${WEB}/login`);
  await saisir(p, EMAIL);
  await p.waitForURL('**/dashboard');

  console.log('— Activation depuis « Mon profil », section Sécurité');
  // Refonte (étape 9) : « Sécurité du compte » est une section de la page « Mon profil ».
  await p.getByRole('button', { name: 'Mon compte' }).click();
  await p.getByRole('link', { name: 'Sécurité du compte' }).click();
  await p.waitForURL('**/compte?section=securite');
  await p.getByRole('heading', { name: 'Mon profil', level: 1 }).waitFor();
  await p.getByRole('heading', { name: 'Sécurité' }).waitFor();
  await p.getByTestId('double-auth').getByText('Désactivée', { exact: true }).waitFor();
  check('état affiché : désactivée', /Désactivée/.test(await p.getByTestId('double-auth').innerText()));
  await p.getByTestId('double-auth').getByRole('button', { name: 'Activer' }).click();
  await confirmerIdentite(p);
  const secret = (await p.getByTestId('cle-manuelle').innerText()).trim();
  check('QR code et clé manuelle affichés', secret.length >= 16 && (await p.getByAltText('QR code de la double authentification').count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/securite.png`, fullPage: true });
  await p.getByLabel(/Code à 6 chiffres/).fill('000000');
  await p.getByRole('button', { name: 'Confirmer l’activation' }).click();
  await p.getByText('Code de vérification invalide').waitFor();
  check('code faux : refus de l’API affiché', true);
  await p.getByLabel(/Code à 6 chiffres/).fill(await code(secret));
  await p.getByRole('button', { name: 'Confirmer l’activation' }).click();
  await p.getByText(/Double authentification activée/).waitFor();
  await p.getByTestId('double-auth').getByText('Activée', { exact: true }).waitFor();
  check('activée : état « Activée »', true);

  console.log('— Déconnexion, lien profond, connexion avec le code : retour à la page visée');
  await seDeconnecter(p);
  await p.waitForURL((url) => !url.pathname.startsWith('/compte'));
  await p.goto(`${WEB}/logistique?onglet=reservations`);
  await p.waitForURL('**/login**');
  await saisir(p, EMAIL);
  await p.waitForURL('**/login/2fa');
  check('mot de passe seul : page du code', true);
  await p.getByLabel('Code de vérification').fill(await code(secret));
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForURL('**/logistique?onglet=reservations');
  check('après le code : retour à la page visée (réservations)', true);

  console.log('— Désactivation par code');
  await p.goto(`${WEB}/compte/securite`);
  await p.waitForURL('**/compte?section=securite');
  check('ancienne adresse /compte/securite : redirigée vers la section Sécurité de « Mon profil »', true);
  await p.getByTestId('double-auth').getByRole('button', { name: 'Désactiver' }).click();
  const fd = p.getByRole('dialog', { name: 'Désactiver la double authentification' });
  await fd.getByLabel(/Code actuel/).fill(await code(secret));
  await fd.getByRole('button', { name: 'Désactiver', exact: true }).click();
  await p.getByTestId('toast').getByText('Double authentification désactivée').waitFor();
  await p.getByTestId('double-auth').getByText('Désactivée', { exact: true }).waitFor();
  check('désactivée', true);

  console.log('— Mobile');
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', storageState: await ctx.storageState() })).newPage();
  await m.goto(`${WEB}/compte/securite`);
  await m.getByRole('heading', { name: 'Mon profil', level: 1 }).waitFor();
  check('mobile : pas de défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);

  console.log('— Réinitialisation par l’administrateur');
  await p.getByTestId('double-auth').getByRole('button', { name: 'Activer' }).click();
  await confirmerIdentite(p);
  const secret2 = (await p.getByTestId('cle-manuelle').innerText()).trim();
  await p.getByLabel(/Code à 6 chiffres/).fill(await code(secret2));
  await p.getByRole('button', { name: 'Confirmer l’activation' }).click();
  await p.getByText(/Double authentification activée/).waitFor();
  const a = await (await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' })).newPage();
  a.on('dialog', (d) => d.accept());
  await a.goto(`${WEB}/login`);
  await saisir(a, 'admin@test.local');
  await a.waitForURL('**/dashboard');
  await a.goto(`${WEB}/users`);
  const ligne = a.locator('tr, li, div').filter({ hasText: EMAIL }).filter({ has: a.getByRole('button', { name: 'Gérer' }) }).last();
  await ligne.getByRole('button', { name: 'Gérer' }).first().click();
  await a.getByRole('button', { name: 'Réinitialiser la double authentification' }).click();
  await a.getByText(/Double authentification réinitialisée/).waitFor();
  check('l’administrateur réinitialise depuis la fiche du compte', true);
  await a.screenshot({ path: `${E.SHOTS}/reinitialisation-2fa.png` });
  await p.goto(`${WEB}/login`);
  const ctx2 = await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' });
  const q = await ctx2.newPage();
  await q.goto(`${WEB}/login`);
  await saisir(q, EMAIL);
  await q.waitForURL('**/dashboard');
  check('la personne se reconnecte sans code', true);

  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
