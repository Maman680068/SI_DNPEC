// S9c — paramétrage du courrier (Chromium) : alertes en tête (registre sans personne habilitée, familles
// d'actes sans registre avec lien), registres groupés par nature en tableau (prochain numéro, numéros de
// l'année, personnes habilitées ou « Personne », famille liée), deux onglets, registres de démonstration
// masqués par défaut, habilitations groupées par registre avec compte inactif signalé ; téléphone.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-4).toUpperCase();
const an = new Date().getFullYear();

(async () => {
  const seul = (await call('admin', 'POST', '/courrier/registres', { code: `U9C${S}`, libelle: 'Registre sans personne', nature: 'DEPART', portee: 'DIRECTION', gabaritNumero: '{seq:3}-{code}/{annee}' })).body;
  const demo = (await call('admin', 'POST', '/courrier/registres', { code: `TEST-U${S}`, libelle: 'TEST — Registre écran', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{seq}/{annee}' })).body;
  const inactif = (await call('admin', 'POST', '/users', { email: `s9cu${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'Secrétaire', lastName: `Partie${S}`, role: 'AGENT', divisionId: ids.DPE })).body;
  const avec = (await call('admin', 'POST', '/courrier/registres', { code: `V9C${S}`, libelle: 'Registre au compte inactif', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{seq}/{annee}' })).body;
  await call('admin', 'POST', '/courrier/habilitations', { userId: inactif.id, registreId: avec.id });
  await call('admin', 'PATCH', `/users/${inactif.id}/status`, { status: 'SUSPENDU' });
  const fam = await prisma.familleActeRh.findFirst({ orderBy: { code: 'asc' } });
  await prisma.familleActeRh.update({ where: { code: fam.code }, data: { registreId: null } });

  const b = await browser();
  const p = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await p.goto(`${WEB}/courrier/administration`);
  await p.locator('[data-testid=registre]').first().waitFor();
  const alerte = p.getByTestId('alerte-sans-personne');
  check('alerte : registre actif sans personne habilitée', (await alerte.innerText()).includes(seul.code) && (await alerte.innerText()).includes(avec.code));
  const af = p.getByTestId('alerte-familles');
  check(`alerte : famille « ${fam.libelle} » sans registre, lien vers Carrière et actes`, (await af.innerText()).includes(fam.libelle) && (await af.getByRole('link', { name: 'Ouvrir Carrière et actes' }).getAttribute('href')) === '/rh?onglet=carriere');
  check('trois groupes : Arrivée, Départ, Actes', (await p.locator('[data-testid^=groupe-]').count()) === 3 && (await p.getByRole('heading', { name: /^Arrivée/ }).count()) === 1 && (await p.getByRole('heading', { name: /^Actes/ }).count()) === 1);
  check('deux onglets : « Registres et numérotation », « Habilitations du secrétariat »', (await p.getByRole('tab').allInnerTexts()).map((t) => t.split('\n')[0]).join('|').startsWith('Registres et numérotation|Habilitations du secrétariat'));
  const l = p.locator('[data-testid=registre]', { hasText: seul.code });
  check('ligne : prochain numéro sans consommer, « aucun cette année », « Personne »', (await l.getByTestId('prochain-numero').innerText()) === `001-${seul.code}/${an}` && /aucun cette année/.test(await l.getByTestId('numeros-annee').innerText()) && (await l.getByTestId('habilites').innerText()) === 'Personne');
  check('« Personne » en rouge', /text-clay/.test(await l.getByTestId('habilites').locator('b').getAttribute('class')));
  check('registre au compte inactif : signalé sur la ligne', /compte inactif/.test(await p.locator('[data-testid=registre]', { hasText: avec.code }).getByTestId('habilites').innerText()));
  check('registre de démonstration masqué par défaut', (await p.locator('[data-testid=registre]', { hasText: demo.code }).count()) === 0 && (await p.getByTestId('masquer-demo').getAttribute('aria-checked')) === 'true');
  await p.getByTestId('masquer-demo').click();
  await p.locator('[data-testid=registre]', { hasText: demo.code }).waitFor();
  check('interrupteur : registre de démonstration affiché', true);
  await p.getByTestId('masquer-demo').click();
  await p.screenshot({ path: `${E.SHOTS}/s9c_parametrage_courrier_bureau.png`, fullPage: true });

  await p.getByRole('tab', { name: /Habilitations du secrétariat/ }).click();
  const grp = p.locator('[data-testid=habilitations-registre]', { hasText: avec.code });
  await grp.waitFor();
  check('habilitations groupées par registre ; compte inactif signalé', /Compte inactif/.test(await grp.innerText()) && /Partie/.test(await grp.innerText()));
  check('onglet : compteur des comptes inactifs habilités', /\d/.test(await p.getByRole('tab', { name: /Habilitations du secrétariat/ }).innerText()));
  await grp.getByRole('button', { name: 'Habiliter quelqu’un' }).click();
  check('« Habiliter quelqu’un » : registre présélectionné', (await p.getByRole('dialog').getByLabel('Registre', { exact: true }).inputValue()) === avec.id);
  await p.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

  const m = await loginPage(b, 'admin', { width: 390, height: 844 });
  await m.goto(`${WEB}/courrier/administration`);
  await m.locator('[data-testid=registre]').first().waitFor();
  check('390 px : sans défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.screenshot({ path: `${E.SHOTS}/s9c_parametrage_courrier_mobile.png`, fullPage: true });

  await prisma.familleActeRh.update({ where: { code: fam.code }, data: { registreId: fam.registreId } });
  for (const r of [seul, demo, avec]) await call('admin', 'PATCH', `/courrier/registres/${r.id}`, { isActive: false });
  await b.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch(async (e) => { console.error(e); process.exit(2); });
