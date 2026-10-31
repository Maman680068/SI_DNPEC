// S9b — écran Utilisateurs (Chromium) : cinq chiffres, alerte de double authentification et « Envoyer un
// rappel », tableau sans texte coupé (personne, rôle et unité, rôles fonctionnels, sécurité, statut),
// interrupteur « Masquer les comptes de démonstration (TEST) » activé par défaut et gardé par le navigateur,
// filtres, onglet « Agents sans compte » avec compteur, « Renvoyer l'invitation » ; DN en lecture ; téléphone.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);

(async () => {
  const demo = (await call('admin', 'POST', '/users', { email: `s9bu${S}@demo.dnpec.test`, password: 'Password123!', firstName: 'TEST — Démo', lastName: `Ecran${S}`, role: 'AGENT', divisionId: ids.DPE })).body;
  const neuf = (await call('admin', 'POST', '/users', { email: `s9bun${S}@test.local`, password: 'Password123!', firstName: 'Neuve', lastName: `Ecran${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  await prisma.user.update({ where: { id: ids.drh }, data: { twoFactorEnabled: false } });
  await prisma.agent.create({ data: { matricule: `S9B${S}`.toUpperCase(), nom: `SansCompte${S}`, prenoms: 'Aïssata', fonction: 'Chargée d’études' } });
  const synth = (await call('admin', 'GET', '/api/v1/comptes/synthese')).body;
  const b = await browser();

  console.log('— Administrateur');
  const p = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await p.goto(`${WEB}/users`);
  await p.getByTestId('chiffre-actifs').waitFor();
  for (const [t, v] of [['chiffre-actifs', synth.chiffres.actifs], ['chiffre-sans-2fa', synth.chiffres.actifsSansDoubleAuthentification], ['chiffre-jamais-connectes', synth.chiffres.jamaisConnectes]]) {
    const txt = await p.getByTestId(t).innerText();
    check(`chiffre ${t} : ${v} (valeur de l’API)`, new RegExp(`^${v}\\b`).test(txt.trim()), txt.replace(/\n/g, ' / '));
  }
  check('cinq chiffres en tête', (await p.getByRole('region', { name: 'Chiffres des comptes' }).locator('[data-testid^=chiffre-]').count()) === 5);
  const alerte = p.getByTestId('alerte-2fa');
  check('alerte : comptes sans double authentification, dont droits élevés', /sans double authentification/.test(await alerte.innerText()) && /droits élevés/.test(await alerte.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/s9b_utilisateurs_bureau.png` });

  const ligne = (email) => p.locator('[data-testid=ligne-compte]', { hasText: email });
  await ligne(neuf.email).waitFor();
  const t = await ligne(neuf.email).innerText();
  check('ligne : nom et e-mail, rôle et sigle « DPE · SSR », « Jamais connecté »', t.includes(`Neuve Ecran${S}`) && t.includes(neuf.email) && t.includes('DPE · SSR') && t.includes('Jamais connecté'), t.replace(/\n/g, ' / '));
  check('aucun texte coupé : pas de « truncate » dans le tableau', (await p.locator('table .truncate').count()) === 0);
  check('rôles fonctionnels en étiquettes (DRH)', (await p.locator('[data-testid=ligne-compte] [data-testid=roles-fonctionnels] >> text=Directeur des Ressources Humaines').count()) >= 1);

  console.log('— Comptes de démonstration');
  const inter = p.getByTestId('masquer-demo');
  check('interrupteur activé par défaut ; compte de démonstration masqué', (await inter.getAttribute('aria-checked')) === 'true' && (await ligne(demo.email).count()) === 0);
  await inter.click();
  await ligne(demo.email).waitFor();
  check('désactivé : compte de démonstration affiché, marqué « Démonstration »', /Démonstration/.test(await ligne(demo.email).innerText()));
  await p.reload();
  await p.getByTestId('masquer-demo').waitFor();
  await p.waitForTimeout(300);
  check('préférence gardée par le navigateur après rechargement', (await p.getByTestId('masquer-demo').getAttribute('aria-checked')) === 'false' && (await ligne(demo.email).count()) === 1);
  await p.getByTestId('masquer-demo').click();

  console.log('— Filtres');
  await p.getByLabel('Double authentification', { exact: true }).selectOption('oui');
  const lignes2fa = await p.locator('[data-testid=ligne-compte] [data-testid=double-authentification]').allInnerTexts();
  check('filtre « Activée » : uniquement des comptes avec 2FA', lignes2fa.every((x) => /2FA activée/.test(x)), `${lignes2fa.length} ligne(s)`);
  await p.getByLabel('Double authentification', { exact: true }).selectOption('tous');
  await p.getByLabel('Unité', { exact: true }).selectOption('DPE · SSR');
  const unites = await p.locator('[data-testid=ligne-compte] [data-testid=role-compte]').allInnerTexts();
  check('filtre unité « DPE · SSR »', unites.length > 0 && unites.every((x) => x.includes('DPE · SSR')));
  await p.getByLabel('Unité', { exact: true }).selectOption('toutes');
  await p.getByLabel('Rôle', { exact: true }).selectOption('DRH');
  check('filtre rôle « DRH »', (await p.locator('[data-testid=role-compte]').allInnerTexts()).every((x) => x.includes('Directeur des Ressources Humaines')));
  await p.getByLabel('Rôle', { exact: true }).selectOption('tous');

  console.log('— Renvoyer l’invitation');
  await ligne(neuf.email).getByRole('button', { name: 'Plus d’actions' }).click();
  await p.getByRole('menu').getByRole('menuitem', { name: 'Renvoyer l’invitation' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Invitation renvoyée' }).waitFor();
  check('« Invitation renvoyée »', true);
  await p.locator('[data-testid=ligne-compte]', { hasText: `agent1` }).first().waitFor().catch(() => {});

  console.log('— Envoyer un rappel');
  await alerte.getByRole('button', { name: 'Envoyer un rappel' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Rappel envoyé' }).waitFor();
  check('« Rappel envoyé » avec le nombre de personnes', /personne\(s\)/.test(await p.getByTestId('toast').filter({ hasText: 'Rappel envoyé' }).innerText()));

  console.log('— Onglet « Agents sans compte »');
  const onglet = p.getByRole('tab', { name: /Agents sans compte/ });
  check(`onglet avec compteur (${synth.agentsSansCompte.length})`, (await onglet.innerText()).includes(String(synth.agentsSansCompte.length)));
  await onglet.click();
  await p.getByTestId('agents-sans-compte').waitFor();
  check('le tableau des agents sans compte est dans l’onglet, pas sous la liste', (await p.locator('[data-testid=ligne-compte]').count()) === 0);
  await p.getByTestId('chiffre-inscriptions').click();
  check('chiffre « Inscriptions à examiner » : ouvre l’onglet des inscriptions', (await p.getByRole('tab', { name: /Inscriptions en attente/ }).getAttribute('aria-selected')) === 'true');
  await p.goto(`${WEB}/users?onglet=agents-sans-compte`);
  await p.getByTestId('agents-sans-compte').waitFor();
  check('lien ?onglet=agents-sans-compte', true);
  await p.context().close();

  console.log('— DN : lecture');
  const d = await loginPage(b, 'dn', { width: 1440, height: 900 });
  await d.goto(`${WEB}/users`);
  await d.getByTestId('chiffre-actifs').waitFor();
  check('DN : chiffres, aucun « Envoyer un rappel », aucun onglet des inscriptions', (await d.getByRole('button', { name: 'Envoyer un rappel' }).count()) === 0 && (await d.getByRole('tab', { name: /Inscriptions/ }).count()) === 0 && (await d.getByRole('tab', { name: /Agents sans compte/ }).count()) === 1);
  await d.context().close();

  console.log('— Téléphone');
  const m = await loginPage(b, 'admin', { width: 390, height: 844 });
  await m.goto(`${WEB}/users`);
  await m.getByTestId('chiffre-actifs').waitFor();
  check('390 px : sans défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.screenshot({ path: `${E.SHOTS}/s9b_utilisateurs_mobile.png`, fullPage: true });
  await b.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch(async (e) => { console.error(e); process.exit(2); });
