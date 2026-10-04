// Lot E — écrans : changement de rôle (Utilisateurs) et chef de cellule (Utilisateurs, Organisation).
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
const dlg = (p) => p.getByRole('dialog');
async function nouveau(n, role, extra) {
  const r = await call('admin', 'POST', '/users', { email: `e3${S}${n}@test.local`, password: 'Password123!', firstName: n.toUpperCase(), lastName: `E3${S}`, role, ...extra });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return r.body;
}
// Attend qu'une condition (lue en base) devienne vraie, 10 s au plus.
async function attendre(f) { for (let i = 0; i < 40; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
const ligne = (p, u) => p.locator('tr', { hasText: u.email });
(async () => {
  const cnc = await prisma.cellule.findUnique({ where: { code: 'CNC' } });
  const rh = await prisma.cellule.findUnique({ where: { code: 'RH' } });
  if (cnc.chefId) await call('admin', 'POST', `/org/cellules/${cnc.id}/chef/retrait`, { motif: 'Préparation du test E3' });
  const u = await nouveau('u', 'AGENT', { divisionId: ids.DEE });
  const v = await nouveau('v', 'AGENT', { celluleId: cnc.id });
  const b = await browser();
  const p = await loginPage(b, 'admin');
  p.on('dialog', (d) => d.accept());
  await p.goto(WEB + '/users');
  await ligne(p, u).waitFor();

  console.log('— Changer de rôle : Chargé d’Études → DRH');
  await ligne(p, u).getByRole('button', { name: 'Changer de rôle' }).click();
  await dlg(p).getByLabel('Nouveau rôle').selectOption('DRH');
  await dlg(p).getByLabel(/^Cellule/).selectOption(rh.id);
  // Refonte (étape 9) : motif exigé dans la fenêtre (message sous le champ, aucun appel).
  await dlg(p).getByRole('button', { name: 'Voir les effets' }).click();
  check('motif vide : « Indiquez le motif du changement. » sous le champ', (await dlg(p).getByText('Indiquez le motif du changement.').count()) === 1 && (await p.locator('[data-testid=apercu-role]').count()) === 0);
  await dlg(p).getByLabel('Motif', { exact: true }).fill('Nomination DRH par décision du DN');
  await dlg(p).getByRole('button', { name: 'Voir les effets' }).click();
  await p.locator('[data-testid=apercu-role]').waitFor();
  const ap = await p.locator('[data-testid=apercu-role]').innerText();
  check('aperçu : avant → après et sessions', /Chargé.*→.*Directeur des Ressources Humaines/s.test(ap) && /sessions seront fermées/.test(ap), ap.split('\n')[0]);
  await p.screenshot({ path: `${SHOTS}/e3_changement_role_apercu_desktop.png` });
  await dlg(p).getByRole('button', { name: 'Confirmer le changement' }).click();
  await ligne(p, u).getByText('Directeur des Ressources Humaines').waitFor();
  check('message de confirmation « Rôle changé »', /Rôle changé/.test(await p.getByTestId('toast').innerText()));
  check('table à jour : DRH, cellule RH', (await ligne(p, u).innerText()).includes('Ressources Humaines'));

  console.log('— Refus affiché');
  await ligne(p, u).getByRole('button', { name: 'Changer de rôle' }).click();
  await dlg(p).getByLabel('Nouveau rôle').selectOption('DN');
  await dlg(p).getByLabel('Motif', { exact: true }).fill('Tentative de second DN');
  await dlg(p).getByRole('button', { name: 'Voir les effets' }).click();
  await dlg(p).getByRole('alert').waitFor();
  check('un second DN : message 409 de l’API dans la fenêtre', /déjà un DN actif/.test(await dlg(p).getByRole('alert').innerText()), await dlg(p).getByRole('alert').innerText());
  await dlg(p).getByRole('button', { name: 'Annuler' }).click();
  const asssaf = await prisma.user.findUnique({ where: { id: ids.chefsaf } });
  await ligne(p, asssaf).getByRole('button', { name: 'Changer de rôle' }).click();
  await dlg(p).getByLabel('Nouveau rôle').selectOption('AGENT');
  await dlg(p).getByRole('radio', { name: 'Cellule transversale' }).click();
  const celluleSel = dlg(p).getByLabel(/^Cellule/);
  await celluleSel.selectOption({ label: (await celluleSel.locator('option').allInnerTexts()).find((t) => /Administratif/.test(t)) });
  await dlg(p).getByLabel('Motif', { exact: true }).fill('Fin de fonction de chef');
  await dlg(p).getByRole('button', { name: 'Voir les effets' }).click();
  await dlg(p).getByRole('alert').waitFor();
  check('chef avec assistante : 409 avec la personne à réaffecter', /Réaffectez.*ASSSAF/.test(await dlg(p).getByRole('alert').innerText()), await dlg(p).getByRole('alert').innerText());
  await dlg(p).getByRole('button', { name: 'Annuler' }).click();

  console.log('— Nommer chef de cellule (motif), puis retirer depuis Organisation');
  await ligne(p, v).getByRole('button', { name: 'Nommer chef de cellule' }).click();
  await dlg(p).getByLabel('Cellule', { exact: true }).selectOption(cnc.id);
  await dlg(p).getByRole('button', { name: 'Nommer chef' }).click();
  check('motif exigé par la fenêtre (message sous le champ)', (await dlg(p).getByText('Indiquez le motif de la nomination.').count()) === 1 && (await dlg(p).getByLabel('Motif', { exact: true }).evaluate((e) => !e.checkValidity())));
  await dlg(p).getByLabel('Motif', { exact: true }).fill('Nomination à la tête du CNC');
  await dlg(p).getByRole('button', { name: 'Nommer chef' }).click();
  check('v est Chef de Cellule du CNC', await attendre(async () => (await prisma.cellule.findUnique({ where: { id: cnc.id } })).chefId === v.id));
  await ligne(p, v).getByRole('cell', { name: 'Chef de Cellule', exact: true }).waitFor();
  check('message de confirmation « Chef de cellule nommé »', /Chef de cellule nommé/.test(await p.getByTestId('toast').innerText()));
  await p.goto(WEB + '/organisation');
  await p.getByRole('tab', { name: 'Cellules' }).click();
  const carte = p.locator('div', { hasText: 'Comité National de Coordination' }).filter({ has: p.getByRole('button', { name: 'Retirer le chef' }) }).last();
  await carte.waitFor();
  check('Organisation : nom du chef affiché', (await carte.innerText()).includes(`chef : V E3${S}`), (await carte.innerText()).split('\n').slice(0, 2).join(' / '));
  await carte.getByRole('button', { name: 'Retirer le chef' }).click();
  await dlg(p).getByLabel('Motif', { exact: true }).fill('Fin de fonction');
  await p.screenshot({ path: `${SHOTS}/e3_retirer_chef_desktop.png` });
  await dlg(p).getByRole('button', { name: 'Retirer le chef' }).click();
  const retire = await attendre(async () => !(await prisma.cellule.findUnique({ where: { id: cnc.id } })).chefId);
  const vv = await prisma.user.findUnique({ where: { id: v.id } });
  check('retrait : Chargé d’Études dans le CNC, chefId vidé', retire && vv.role === 'AGENT' && vv.celluleId === cnc.id);
  await p.getByText('CNC · sans chef').waitFor();
  check('Organisation : « sans chef » affiché', true);

  console.log('— Mobile');
  const m = await loginPage(b, 'admin', { width: 390, height: 844 });
  await m.goto(WEB + '/users');
  await m.getByRole('button', { name: 'Changer de rôle' }).first().click();
  await dlg(m).getByLabel('Motif', { exact: true }).waitFor();
  check('mobile 390 px : fenêtre sans défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.screenshot({ path: `${SHOTS}/e3_changement_role_mobile.png` });
  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch(async (e) => { console.error(e); process.exit(2); });
