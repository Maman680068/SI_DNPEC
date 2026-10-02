// N4 — écrans sous Chromium, bureau (1366) et téléphone (390) : dépôt dans la GED avec les
// métadonnées obligatoires, statut de diffusion (marquer final, valider, historique), dépôt direct
// depuis une tâche, écran « Documents générés » (attestation de travail : aperçu fidèle et Word ;
// ordre de mission avec frais en toutes lettres ; rapport d'activité sur téléphone).
const fs = require('fs');
const path = require('path');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const b = await browser();
  const fichier = path.join(E.OUT, 'tmp', `note_${S}.txt`);
  fs.writeFileSync(fichier, `Note de conjoncture ${S}`);

  console.log('— GED : dépôt avec métadonnées (bureau)');
  let p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/documents`);
  await p.getByRole('button', { name: '+ Nouveau document' }).click();
  await p.getByLabel('Titre', { exact: true }).fill(`Note N4 ${S}`);
  const envoyer = p.getByRole('button', { name: 'Envoyer' });
  await p.getByLabel('Fichier').setInputFiles(fichier);
  check('sans type ni période : envoi impossible', await envoyer.isDisabled());
  await p.locator('#doc-type').selectOption('NOTE_CONJONCTURE');
  await p.locator('#doc-debut').fill('2026-07-01');
  await p.locator('#doc-fin').fill('2026-09-30');
  await p.screenshot({ path: `${E.SHOTS}/n4_depot_bureau.png` });
  await envoyer.click();
  await p.getByText(`Note N4 ${S}`).first().click();
  const statut = p.locator('[data-testid=statut-document]');
  await statut.waitFor();
  check('document déposé : Brouillon, type et période affichés', /Brouillon/.test(await statut.innerText()) && /Note de conjoncture/.test(await p.locator('[data-testid=metadonnees]').innerText()) && /30 sept\. 2026/.test(await p.locator('[data-testid=metadonnees]').innerText()));
  check('agent : aucune action de statut', (await p.locator('[data-testid=actions-statut]').count()) === 0);
  await p.getByRole('button', { name: 'Marquer comme final' }).click();
  await p.getByText('Final', { exact: true }).first().waitFor();
  await p.context().close();

  console.log('— Statut : validation par le chef de division (bureau)');
  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/documents`);
  await p.getByText(`Note N4 ${S}`).first().click();
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForFunction(() => /Validé/.test(document.querySelector('[data-testid=statut-document]')?.textContent ?? ''));
  await p.locator('[data-testid=historique-statut]').waitFor();
  check('validé : badge « Validé », historique (Brouillon → Validé, auteur)', /Brouillon → Validé/.test(await p.locator('[data-testid=historique-statut]').innerText()));
  check('chef de division : pas de « Rendre diffusable » (DN, DNA)', (await p.getByRole('button', { name: 'Rendre diffusable' }).count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n4_statut_bureau.png` });
  await p.context().close();

  console.log('— Dépôt direct depuis une tâche');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Synthèse N4 ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/tasks/${t.id}`);
  const issus = p.locator('[data-testid=documents-issus]');
  await issus.waitFor();
  await issus.getByRole('button', { name: 'Déposer un document' }).click();
  check('formulaire prérempli : « Issu de : tâche … »', new RegExp(`Synthèse N4 ${S}`).test(await p.locator('[data-testid=source-depot]').innerText()));
  await p.getByLabel('Titre', { exact: true }).fill(`Livrable ${S}`);
  await p.locator('#doc-type').selectOption('RAPPORT');
  await p.getByLabel('Fichier').setInputFiles(fichier);
  await p.getByRole('button', { name: 'Envoyer' }).click();
  await issus.getByText(`Livrable ${S}`).waitFor();
  check('document listé dans la tâche, lien vers la GED', (await issus.getByRole('link', { name: `Livrable ${S}` }).getAttribute('href')).startsWith('/documents?id='));
  await issus.getByRole('link', { name: `Livrable ${S}` }).click();
  await p.locator('[data-testid=source-document]').waitFor();
  check('fiche du document : « Issu de : Tâche … »', new RegExp(`Synthèse N4 ${S}`).test(await p.locator('[data-testid=source-document]').innerText()));
  await p.context().close();

  console.log('— Documents générés : attestation de travail (DRH, bureau)');
  p = await loginPage(b, 'drh');
  check('menu : « Documents générés »', (await p.locator('a[href="/documents-generes"]').count()) === 1);
  await p.goto(`${WEB}/documents-generes`);
  await p.getByRole('tab', { name: 'Attestations de travail' }).waitFor();
  await p.getByLabel('Agent').selectOption(ids.agent1);
  await p.getByText('Créée le', { exact: false }).first().waitFor({ timeout: 5000 }).catch(() => {});
  const avant = await p.locator('[data-testid=attestation-travail]').count();
  await p.getByRole('button', { name: 'Nouvelle attestation de travail' }).click();
  await p.waitForFunction((n) => document.querySelectorAll('[data-testid=attestation-travail]').length > n, avant);
  const att = p.locator('[data-testid=attestation-travail]').first();
  check('attestation créée : « Projet — acte non préparé »', /Projet/.test(await att.innerText()));
  await att.getByRole('button', { name: 'Aperçu' }).click();
  await p.locator('[data-testid=apercu-document]').waitFor();
  check('aperçu fidèle : le PDF produit s’affiche', /^blob:/.test(await p.locator('[data-testid=apercu-document]').getAttribute('src')));
  await p.waitForTimeout(4000); // rendu du PDF par la visionneuse de Chromium
  await p.screenshot({ path: `${E.SHOTS}/n4_apercu_bureau.png` });
  await p.getByRole('button', { name: 'Fermer l’aperçu' }).click();
  const [dl] = await Promise.all([p.waitForEvent('download'), att.getByRole('button', { name: 'Word' }).click()]);
  check('téléchargement Word (.docx)', /\.docx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('Préparer l’acte proposé au DRH', (await att.getByRole('button', { name: 'Préparer l’acte' }).count()) === 1);
  await p.context().close();

  console.log('— Ordre de mission (chef de section, téléphone)');
  p = await loginPage(b, 'chefssr', TELEPHONE);
  await p.goto(`${WEB}/documents-generes?onglet=ordres`);
  await p.getByRole('button', { name: '+ Nouvel ordre de mission' }).click();
  await p.getByLabel('Agent').selectOption(ids.agent1);
  await p.getByLabel('Destination').fill('Labé');
  await p.getByLabel('Objet de la mission').fill(`Enquête de conjoncture ${S}`);
  await p.getByLabel('Départ').fill('2026-11-10');
  await p.getByLabel('Retour').fill('2026-11-12');
  await p.getByLabel(/Frais de mission/).fill('281000');
  await p.getByRole('button', { name: 'Enregistrer l’ordre de mission' }).click();
  const om = p.locator('[data-testid=ordre-mission]', { hasText: `Enquête de conjoncture ${S}` });
  await om.waitFor();
  check('frais en toutes lettres : « deux cent quatre-vingt-un mille »', /deux cent quatre-vingt-un mille \(281 000\) francs guinéens/.test(await om.innerText()), await om.innerText());
  check('téléphone : sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n4_ordre_mission_mobile.png`, fullPage: true });
  await p.context().close();

  console.log('— Rapport d’activité (agent, téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/documents-generes`);
  check('agent : seul l’onglet « Rapport d’activité » (et l’ordre qui le concerne)', (await p.getByRole('tab', { name: 'Attestations de travail' }).count()) === 0);
  await p.getByRole('tab', { name: 'Rapport d’activité' }).click();
  await p.getByRole('button', { name: 'Aperçu' }).click();
  await p.locator('[data-testid=apercu-document]').waitFor();
  check('rapport : aperçu affiché sur téléphone', true);
  await p.waitForTimeout(4000); // rendu du PDF par la visionneuse de Chromium
  await p.screenshot({ path: `${E.SHOTS}/n4_rapport_mobile.png` });
  await p.context().close();

  console.log('— Document d’une cellule rattachée à la Direction : dépôt (téléphone), validation par le chef de cellule (bureau)');
  p = await loginPage(b, 'agentsaf', TELEPHONE);
  await p.goto(`${WEB}/documents`);
  await p.getByRole('button', { name: 'Mon espace cellule' }).waitFor();
  check('agent de cellule : onglet « Mon espace cellule », espace de sa cellule', /Cellule :/.test(await p.locator('body').innerText()));
  await p.getByRole('button', { name: '+ Nouveau document' }).click();
  await p.getByLabel('Titre', { exact: true }).fill(`Note SAF ${S}`);
  await p.getByLabel('Fichier').setInputFiles(fichier);
  await p.locator('#doc-type').selectOption('NOTE_TECHNIQUE');
  await p.locator('#doc-debut').fill('2026-07-01');
  await p.locator('#doc-fin').fill('2026-09-30');
  await p.getByRole('button', { name: 'Envoyer' }).click();
  await p.getByText(`Note SAF ${S}`).first().click();
  await p.locator('[data-testid=statut-document]').waitFor();
  await p.getByRole('button', { name: 'Marquer comme final' }).click();
  await p.getByText('Final', { exact: true }).first().waitFor();
  check('téléphone : pas de défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n4_cellule_mobile.png` });
  await p.context().close();
  p = await loginPage(b, 'chefsaf');
  await p.goto(`${WEB}/documents`);
  await p.getByText(`Note SAF ${S}`).first().click();
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForFunction(() => /Validé/.test(document.querySelector('[data-testid=statut-document]')?.textContent ?? ''));
  check('le chef de la cellule valide le document de sa cellule', true);
  await p.screenshot({ path: `${E.SHOTS}/n4_cellule_chef_bureau.png` });
  await p.context().close();
  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/documents`);
  await p.waitForTimeout(800);
  check('un chef de division ne voit pas le document privé de la cellule', !(await p.locator('body').innerText()).includes(`Note SAF ${S}`));
  await p.context().close();

  fs.rmSync(fichier, { force: true });
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
