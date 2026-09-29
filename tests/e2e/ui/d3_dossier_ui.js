// Lot D3 — écrans : /personnel et /personnel/:id (personne, DRH, chef, DN), niveau 2 jamais
// transmis au navigateur d'un chef ou du DN, import Excel, bureau et mobile.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
const TEL = `+224 62${S}`, ADR = `Quartier Kaloum ${S}`, URG = `Mariama ${S}`;
const SECRETS = [TEL, ADR, URG, `Licence ${S}`];
async function attendre(f) { for (let i = 0; i < 40; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
// Enregistre le corps de toutes les réponses de l'API reçues par la page.
function espion(page) {
  const corps = [];
  page.on('response', async (r) => { if (r.url().startsWith('http://localhost:3000')) { try { corps.push(await r.text()); } catch { /* flux */ } } });
  return corps;
}
(async () => {
  const a1 = ids.agent1;
  await call('agent1', 'PATCH', `/personnel-files/${a1}/sensitive`, { personalPhone: TEL, personalAddress: ADR, emergencyContactName: URG, emergencyContactRelation: 'Sœur' });
  const fd = new FormData(); fd.append('title', `Licence ${S}`); fd.append('file', new Blob([`LICENCE ${S}`]), 'licence.pdf');
  await fetch('http://localhost:3000/personnel-files/' + a1 + '/diplomas', { method: 'POST', headers: { Authorization: 'Bearer ' + (await require('../lib').login('agent1')), 'X-Reauth': await require('../lib').preuve('agent1') }, body: fd });
  await call('drh', 'PATCH', `/personnel-files/${a1}/basic`, { grade: `B${S}`, serviceStartDate: '2012-03-01' });
  const b = await browser();
  // Socle N2 : le niveau 2 s'ouvre après confirmation de l'identité (mot de passe).
  const deverrouiller = async (page) => {
    await page.locator('[data-testid=niveau-2-verrouille]').getByRole('button', { name: 'Afficher les données protégées' }).click();
    const f = page.getByRole('dialog', { name: 'Confirmez votre identité' });
    await f.getByLabel('Votre mot de passe').fill('Password123!');
    await f.getByRole('button', { name: 'Confirmer' }).click();
  };

  console.log('— La personne (bureau)');
  const p = await loginPage(b, 'agent1');
  p.on('dialog', (d) => d.accept());
  await p.getByRole('link', { name: 'Dossier du personnel' }).click();
  await p.getByRole('button', { name: 'Mon dossier' }).click();
  await p.waitForURL(`**/personnel/${a1}`);
  await deverrouiller(p);
  await p.locator('[data-testid=niveau-2]').waitFor();
  check('niveau 2 affiché à la personne', (await p.locator('[data-testid=niveau-2]').innerText()).includes(TEL));
  check('bandeau « à vérifier » et grade « À vérifier »', (await p.locator('[data-testid=bandeau-a-verifier]').count()) === 1 && /À vérifier/.test(await p.locator('[data-testid="champ-Grade"]').innerText()));
  await p.screenshot({ path: `${SHOTS}/d3_mon_dossier_a_verifier_desktop.png`, fullPage: true });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="champ-Fiche de poste"]').getByRole('button', { name: 'Télécharger' }).click()]);
  check('fiche de poste téléchargée', fs.readFileSync(await dl.path(), 'utf8').startsWith('FICHE'), dl.suggestedFilename());
  await p.getByRole('button', { name: 'Confirmer mes informations' }).click();
  await p.getByText('Vos informations sont confirmées.').waitFor();
  check('après confirmation : plus de bandeau, grade « Confirmé »', await attendre(async () => (await p.locator('[data-testid=bandeau-a-verifier]').count()) === 0 && /Confirmé/.test(await p.locator('[data-testid="champ-Grade"]').innerText())));
  await p.getByRole('button', { name: 'Signaler une erreur' }).click();
  await p.getByLabel('Information concernée').selectOption('Grade');
  await p.getByLabel('Ce qui est inexact').fill(`Mon grade est A1 depuis 2024 ${S}`);
  await p.getByRole('button', { name: 'Envoyer au DRH' }).click();
  await p.getByText('Le DRH a été prévenu.').waitFor();
  const notif = await prisma.notification.findFirst({ where: { userId: ids.drh, type: 'DOSSIER_ERREUR_SIGNALEE', channel: 'IN_APP', body: { contains: S } } });
  check('signalement : DRH notifié, lien /personnel/:id', notif && notif.link === `/personnel/${a1}`);
  await p.locator('[data-testid=niveau-2]').getByRole('button', { name: 'Modifier' }).click();
  await p.getByLabel('Téléphone personnel').fill(`${TEL}9`);
  await p.getByRole('button', { name: 'Enregistrer' }).click();
  await p.getByText('Informations personnelles enregistrées.').waitFor();
  check('modification du téléphone : « À vérifier » et bandeau de retour', await attendre(async () => /À vérifier/.test(await p.locator('[data-testid="champ-Téléphone personnel"]').innerText()) && (await p.locator('[data-testid=bandeau-a-verifier]').count()) === 1), await p.locator('[data-testid="champ-Téléphone personnel"]').innerText());
  check('pas de bouton d’import pour un Chargé d’Études', (await (await p.goto(`${WEB}/personnel`), p.getByRole('button', { name: 'Importer (Excel)' }).count())) === 0);

  console.log('— Lien d’email vers /personnel/:id, DRH (bureau)');
  const d = await loginPage(b, 'drh');
  d.on('dialog', (x) => x.accept());
  await d.goto(`${WEB}/personnel/${a1}`);
  await deverrouiller(d);
  await d.locator('[data-testid=niveau-2]').waitFor();
  check('lien direct : dossier ouvert avec le niveau 2 pour le DRH', (await d.locator('[data-testid=niveau-2]').innerText()).includes(`${TEL}9`));
  check('DRH : ni bandeau de confirmation, ni « Signaler »', (await d.locator('[data-testid=bandeau-a-verifier]').count()) === 0 && (await d.getByRole('button', { name: 'Signaler une erreur' }).count()) === 0);
  await d.locator('[data-testid=niveau-1]').getByRole('button', { name: 'Modifier' }).click();
  await d.getByLabel('Échelon').fill(`E${S}`);
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await d.getByText('Situation administrative enregistrée.').waitFor();
  check('DRH : échelon enregistré « À vérifier »', await attendre(async () => /À vérifier/.test(await d.locator('[data-testid="champ-Échelon"]').innerText())));
  await d.getByRole('button', { name: 'Ajouter' }).nth(1).click();
  await d.getByLabel('Libellé').fill(`Arrêté de nomination ${S}`);
  await d.getByLabel('Fichier').setInputFiles({ name: 'arrete.pdf', mimeType: 'application/pdf', buffer: Buffer.from(`ARRETE ${S}`) });
  await d.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await d.getByText(`Arrêté de nomination ${S}`).waitFor();
  check('DRH : pièce ajoutée, auteur affiché', /par DRH/.test(await d.getByText(`Arrêté de nomination ${S}`).locator('..').innerText()));
  const hist = await d.locator('[data-testid=historique]').innerText();
  check('historique de carrière en lecture seule (promotion)', hist.includes(`B${S}`) && (await d.locator('[data-testid=historique]').getByRole('button').count()) === 0);
  await d.screenshot({ path: `${SHOTS}/d3_dossier_drh_desktop.png`, fullPage: true });

  await d.goto(`${WEB}/personnel`);
  await d.getByRole('button', { name: 'Importer (Excel)' }).click();
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('P');
  ws.addRow(['Email', 'Prénom', 'Nom', 'Rôle', 'Division', 'Cellule', 'Grade']);
  ws.addRow([`d3ui${S}@test.local`, 'Fanta', `Camara${S}`, '', 'DPE', '', 'A3']);
  ws.addRow([`d3ui${S}b@test.local`, 'Ibrahima', `Sow${S}`, 'CHEF_DIVISION', 'DPE', '', '']);
  await d.getByLabel('Fichier .xlsx').setInputFiles({ name: 'personnel.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
  await d.getByRole('dialog').getByRole('button', { name: 'Importer' }).click();
  await d.locator('[data-testid=bilan-import]').waitFor();
  const rap = await d.getByRole('dialog').innerText();
  check('rapport d’import : 1 créé, 1 erreur (rôle réservé)', /1 compte créé/.test(rap) && /1 erreur/.test(rap) && /ne crée que des comptes de Chargé d'Études/.test(rap), rap.split('\n').slice(1, 2).join(' '));
  await d.screenshot({ path: `${SHOTS}/d3_import_rapport_desktop.png` });
  await d.getByRole('button', { name: 'Fermer' }).click();
  await d.getByLabel('Rechercher une personne').fill(`camara${S}`);
  check('liste rechargée : la personne importée apparaît', await attendre(async () => (await d.locator('[data-testid=ligne-personnel]').count()) === 1));

  console.log('— Chef de section (mobile) et DN (bureau) : niveau 1 seulement, rien du niveau 2 reçu');
  for (const [key, viewport, shot] of [['chefssr', { width: 390, height: 844 }, 'd3_dossier_chef_mobile.png'], ['dn', undefined, 'd3_dossier_dn_desktop.png']]) {
    const c = await loginPage(b, key, viewport);
    const recus = espion(c);
    await c.goto(`${WEB}/personnel`);
    await c.getByLabel('Rechercher une personne').fill('agent1');
    await c.locator('[data-testid=ligne-personnel]').first().click();
    await c.waitForURL(`**/personnel/${a1}`);
    await c.locator('[data-testid=niveau-1]').waitFor();
    check(`${key} : niveau 1 affiché (grade)`, (await c.locator('[data-testid=niveau-1]').innerText()).includes(`B${S}`));
    check(`${key} : niveau 2 absent, mention « réservé »`, (await c.locator('[data-testid=niveau-2]').count()) === 0 && (await c.locator('[data-testid=niveau-2-reserve]').count()) === 1);
    check(`${key} : aucun bouton Modifier / Confirmer / Signaler`, (await c.getByRole('button', { name: /Modifier|Confirmer|Signaler/ }).count()) === 0);
    const [f] = await Promise.all([c.waitForEvent('download'), c.locator('[data-testid="champ-Fiche de poste"]').getByRole('button', { name: 'Télécharger' }).click()]);
    check(`${key} : fiche de poste téléchargeable (niveau 1)`, fs.readFileSync(await f.path(), 'utf8').startsWith('FICHE'));
    await c.screenshot({ path: `${SHOTS}/${shot}`, fullPage: true });
    if (viewport) check(`${key} : pas de défilement horizontal`, (await c.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width);
    await attendre(async () => recus.length > 3);
    check(`${key} : ${recus.length} réponses de l’API reçues, aucune ne contient une valeur du niveau 2`, recus.length > 0 && !recus.some((t) => SECRETS.some((s) => t.includes(s)) || t.includes(`${TEL}9`)));
  }

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
