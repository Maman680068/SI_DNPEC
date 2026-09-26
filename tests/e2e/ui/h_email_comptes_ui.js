// H — écrans des emails de compte sous Chromium : rejet d'une inscription avec motif facultatif
// (fenêtre dédiée, email lu dans le journal de l'API), approbation (mention de l'email), création
// d'un compte (mention du lien de choix du mot de passe), fenêtre de rejet sur mobile.
const fs = require('fs');
const path = require('path');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');
const { ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const JOURNAL = path.join(E.OUT, 'logs', 'api-normal.log');
const attendre = async (f, n = 40) => { for (let i = 0; i < n; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
const email = (dest, sujet) => {
  const s = fs.readFileSync(JOURNAL, 'utf8');
  const d = s.lastIndexOf(`destinataire=${dest}, sujet="${sujet}"`);
  if (d < 0) return null;
  const f = s.indexOf('[Nest]', d + 10);
  return s.slice(d, f < 0 ? undefined : f);
};
async function inscrire(adresse, prenom) {
  const r = await fetch('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adresse, password: 'Password123!', firstName: prenom, lastName: `Ecran${S}`, declaredRole: 'AGENT', declaredDivisionId: ids.DPE, declaredSectionId: ids.SFP }) });
  if (r.status !== 201) throw new Error('inscription ' + r.status);
}

(async () => {
  const b = await browser();
  const eRejet = `uirej${S}@test.local`; const eAppro = `uiapp${S}@test.local`; const eMobile = `uimob${S}@test.local`;
  await inscrire(eRejet, 'Maimouna'); await inscrire(eAppro, 'Ousmane'); await inscrire(eMobile, 'Sekou');

  console.log('— Rejet avec motif');
  const a = await loginPage(b, 'admin');
  await a.goto(`${WEB}/users`);
  await a.getByRole('button', { name: 'Inscriptions en attente' }).click();
  const carte = (adresse) => a.locator('div').filter({ hasText: adresse }).filter({ has: a.getByRole('button', { name: 'Rejeter' }) }).last();
  await carte(eRejet).getByRole('button', { name: 'Rejeter' }).click();
  await a.getByRole('heading', { name: 'Rejeter l’inscription' }).waitFor();
  check('fenêtre de rejet : la personne sera prévenue par email', (await a.getByText('reçoit un email lui indiquant qu’elle n’a pas été retenue').count()) === 1);
  await a.getByLabel('Motif (facultatif, repris dans l’email)').fill('Merci de passer par votre chef de division.');
  await a.getByRole('button', { name: 'Rejeter la demande' }).click();
  check('la demande disparaît de la liste', await attendre(async () => (await a.getByText(eRejet).count()) === 0));
  check('demande supprimée en base', (await prisma.user.findUnique({ where: { email: eRejet } })) === null);
  const m1 = await (async () => { let m = null; await attendre(async () => !!(m = email(eRejet, 'Votre demande d’accès au SI DNPEC'))); return m; })();
  check('email de rejet avec le motif saisi', !!m1 && m1.includes('Motif indiqué par l’administrateur : Merci de passer par votre chef de division.'));
  await a.screenshot({ path: `${E.SHOTS}/h_rejet_fait.png` });

  console.log('— Annuler ne rejette rien');
  await carte(eMobile).getByRole('button', { name: 'Rejeter' }).click();
  await a.getByRole('button', { name: 'Annuler' }).click();
  check('annuler : demande conservée', (await prisma.user.findUnique({ where: { email: eMobile } })) !== null);

  console.log('— Approbation');
  await carte(eAppro).getByRole('button', { name: 'Approuver' }).click();
  await a.getByRole('heading', { name: 'Approuver l’inscription' }).waitFor();
  check('fenêtre d’approbation : mention de l’email « Se connecter »', (await a.getByText('La personne recevra un email avec son rôle, son unité et un bouton « Se connecter ».').count()) === 1);
  await a.screenshot({ path: `${E.SHOTS}/h_approbation.png` });
  await a.locator('form').getByRole('button', { name: 'Approuver' }).click();
  check('compte actif', await attendre(async () => (await prisma.user.findUnique({ where: { email: eAppro } }))?.status === 'ACTIF'));
  let m2 = null; await attendre(async () => !!(m2 = email(eAppro, 'Votre compte SI DNPEC est activé')));
  check('email d’approbation avec bouton « Se connecter »', !!m2 && m2.includes('Se connecter : http://localhost:3100/login'));

  console.log('— Création d’un compte');
  await a.goto(`${WEB}/users`);
  await a.getByRole('button', { name: '+ Nouveau compte' }).click();
  check('fenêtre de création : mention du lien de choix du mot de passe', (await a.getByText('un lien pour choisir son propre mot de passe (valable 7 jours)').count()) === 1);
  await a.context().close();

  console.log('— Mobile');
  const m = await loginPage(b, 'admin', { width: 390, height: 844 });
  await m.goto(`${WEB}/users`);
  await m.getByRole('button', { name: 'Inscriptions en attente' }).click();
  await m.locator('div').filter({ hasText: eMobile }).filter({ has: m.getByRole('button', { name: 'Rejeter' }) }).last().getByRole('button', { name: 'Rejeter' }).click();
  await m.getByRole('heading', { name: 'Rejeter l’inscription' }).waitFor();
  check('mobile : fenêtre de rejet sans défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.screenshot({ path: `${E.SHOTS}/h_rejet_mobile.png` });
  await m.getByRole('button', { name: 'Rejeter la demande' }).click();
  check('mobile : rejet sans motif', await attendre(async () => (await prisma.user.findUnique({ where: { email: eMobile } })) === null));
  let m3 = null; await attendre(async () => !!(m3 = email(eMobile, 'Votre demande d’accès au SI DNPEC')));
  check('email de rejet sans motif', !!m3 && !m3.includes('Motif'));

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
