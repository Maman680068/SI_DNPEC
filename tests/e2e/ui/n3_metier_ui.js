// N3 — écrans sous Chromium, bureau (1366) et téléphone (390) : avis du chef puis décision du DRH
// sur un congé (onglet « À traiter », circuit affiché), motif médical déverrouillé par le DRH et par le
// chef qui donne l'avis après réauthentification, « motif protégé » pour le DN, certificat médical
// joint par l'agent, calendrier des jours fériés (saisie par l'administrateur, lecture par l'agent), avancement calculé d'une tâche (plus de curseur),
// encadreur principal désigné, rapport de stage déposé par le stagiaire puis validé par l'encadreur.
const path = require('path');
const fs = require('fs');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function ouvrirDemande(p, onglet, nom) {
  await p.goto(`${WEB}/leaves`);
  await p.getByRole('tab', { name: new RegExp(`^${onglet}`) }).click();
  const carte = p.locator('div', { hasText: nom }).filter({ has: p.getByRole('button', { name: /Examiner|Consulter/ }) }).last();
  await carte.getByRole('button', { name: /Examiner|Consulter/ }).click();
  await p.locator('[data-testid=circuit-conge]').waitFor();
}

(async () => {
  const b = await browser();
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie']]) if (!types.some((x) => x.code === code)) await call('admin', 'POST', '/leave-types', { code, name });
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const annuel = types.find((t) => t.code === 'CONGE_ANNUEL');
  const maladie = types.find((t) => t.code === 'CONGE_MALADIE');
  const agent1 = await prisma.user.findUnique({ where: { id: ids.agent1 }, select: { firstName: true, lastName: true } });
  const nom = `${agent1.firstName} ${agent1.lastName}`;
  // Isolement : demandes en attente d'agent1 laissées par les suites précédentes annulées.
  for (const r of await prisma.leaveRequest.findMany({ where: { userId: ids.agent1, status: 'EN_ATTENTE' }, select: { id: true } })) await call('agent1', 'POST', `/leaves/${r.id}/cancel`);

  console.log('— Congé : avis du chef (bureau)');
  const c = (await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(90), endDate: jour(92), reason: `Voyage ${S}` })).body;
  let p = await loginPage(b, 'chefssr');
  await ouvrirDemande(p, 'À traiter', nom);
  const circuit = await p.locator('[data-testid=circuit-conge]').innerText();
  check('tiroir : étape « avis du chef attendu » et échéance affichée', /avis/i.test(circuit) && /réputé favorable/.test(circuit), circuit.slice(0, 120));
  check('boutons d’avis, pas de décision', (await p.getByRole('button', { name: 'Avis favorable' }).count()) === 1 && (await p.getByRole('button', { name: 'Approuver' }).count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n3_avis_chef_bureau.png` });
  await p.getByRole('button', { name: 'Avis favorable' }).click();
  await p.locator('[data-testid=circuit-conge]').waitFor({ state: 'detached' });
  check('avis enregistré en base', (await prisma.leaveRequest.findUnique({ where: { id: c.id } })).avisEtat === 'FAVORABLE');
  await p.context().close();

  console.log('— Congé : décision du DRH (bureau)');
  p = await loginPage(b, 'drh');
  await ouvrirDemande(p, 'À traiter', nom);
  await p.getByText(/SOLDE/i).first().waitFor();
  await p.waitForTimeout(500);
  check('DRH : le solde du demandeur s’affiche (aucun refus)', (await p.getByText('pas accès au solde').count()) === 0);
  check('DRH : avis favorable du chef affiché, boutons de décision', /favorable/i.test(await p.locator('[data-testid=circuit-conge]').innerText()) && (await p.getByRole('button', { name: 'Approuver' }).count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n3_decision_drh_bureau.png` });
  await p.getByRole('button', { name: 'Approuver' }).click();
  await p.locator('[data-testid=circuit-conge]').waitFor({ state: 'detached' });
  check('demande approuvée', (await prisma.leaveRequest.findUnique({ where: { id: c.id } })).status === 'APPROUVEE');

  console.log('— Motif médical : déverrouillé par le DRH (bureau)');
  const m = (await call('agent1', 'POST', '/leaves', { leaveTypeId: maladie.id, startDate: jour(95), endDate: jour(96), reason: `Examen médical ${S}` })).body;
  await call('chefssr', 'POST', `/leaves/${m.id}/avis`, { avis: 'FAVORABLE' });
  await ouvrirDemande(p, 'À traiter', nom);
  check('motif médical verrouillé à l’ouverture', (await p.getByText(`Examen médical ${S}`).count()) === 0 && (await p.getByRole('button', { name: 'Afficher le motif' }).count()) === 1);
  await p.getByRole('button', { name: 'Afficher le motif' }).click();
  const f = p.getByRole('dialog', { name: 'Confirmez votre identité' });
  await f.getByLabel('Votre mot de passe').fill('Password123!');
  await f.getByRole('button', { name: 'Confirmer' }).click();
  await p.getByText(`Examen médical ${S}`).waitFor();
  check('après réauthentification : motif affiché', true);
  await p.screenshot({ path: `${E.SHOTS}/n3_motif_medical_bureau.png` });
  await p.context().close();

  console.log('— Chef qui donne l’avis : type et motif (après réauthentification) ; DN : « motif protégé »');
  const m2 = (await call('agent1', 'POST', '/leaves', { leaveTypeId: maladie.id, startDate: jour(110), endDate: jour(112), reason: `Hospitalisation ${S}` })).body;
  p = await loginPage(b, 'chefssr');
  await ouvrirDemande(p, 'À traiter', nom);
  check('chef : type « Congé maladie », dates et durée ; motif verrouillé', (await p.getByText('Congé maladie').count()) >= 1 && (await p.getByRole('button', { name: 'Afficher le motif' }).count()) === 1);
  await p.getByRole('button', { name: 'Afficher le motif' }).click();
  const fc = p.getByRole('dialog', { name: 'Confirmez votre identité' });
  await fc.getByLabel('Votre mot de passe').fill('Password123!');
  await fc.getByRole('button', { name: 'Confirmer' }).click();
  await p.getByText(`Hospitalisation ${S}`).waitFor();
  check('chef, après réauthentification : motif médical affiché ; jamais le certificat', (await p.locator('[data-testid=certificat-medical]').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n3_chef_conge_maladie_bureau.png` });
  await p.context().close();
  p = await loginPage(b, 'dn');
  await p.goto(`${WEB}/leaves`);
  await p.getByRole('tab', { name: /^Suivi/ }).click();
  await p.getByText(/motif protégé/).first().waitFor();
  check('DN : « Absence — motif protégé », sans le type', (await p.getByText(`Hospitalisation ${S}`).count()) === 0);
  await ouvrirDemande(p, 'Suivi', nom);
  check('DN : consultation sans aucun bouton d’avis ou de décision', (await p.getByRole('button', { name: /Avis favorable|Approuver/ }).count()) === 0);
  await p.context().close();

  console.log('— Certificat médical (agent, téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/leaves`);
  const carteM = p.locator('[data-testid=certificat-medical]').first();
  await carteM.waitFor();
  const fichierCert = path.join(E.OUT, 'tmp', `certificat_${S}.pdf`);
  fs.writeFileSync(fichierCert, `Certificat ${S}`);
  await carteM.locator('input[type=file]').setInputFiles(fichierCert);
  await p.getByText(`certificat_${S}.pdf`).first().waitFor();
  check('agent : certificat joint à son congé maladie', true);
  await p.screenshot({ path: `${E.SHOTS}/n3_certificat_mobile.png` });
  fs.rmSync(fichierCert, { force: true });
  await call('agent1', 'POST', `/leaves/${m2.id}/cancel`);
  await p.context().close();

  console.log('— Jours fériés : saisie par l’administrateur (bureau), lecture par l’agent (téléphone)');
  const AN = new Date().getUTCFullYear() + 1;
  for (const j of (await call('admin', 'GET', `/api/v1/jours-feries?annee=${AN}`)).body.jours.filter((x) => x.nature === 'RELIGIEUX')) await call('admin', 'DELETE', `/api/v1/jours-feries/${j.id}`);
  p = await loginPage(b, 'admin');
  await p.goto(`${WEB}/leaves?onglet=feries&annee=${AN}`);
  const cal = p.locator('[data-testid=jours-feries]');
  await cal.getByText('Fête de l’Indépendance').waitFor();
  check('administrateur : fêtes fixes pré-remplies, alerte « aucune fête religieuse »', (await cal.getByRole('status').count()) === 1);
  await cal.getByLabel('Date').last().fill(`${AN}-06-16`);
  await cal.getByLabel('Libellé').last().fill(`Tabaski ${S}`);
  await cal.getByRole('button', { name: 'Ajouter le jour férié' }).click();
  await cal.getByText(`Tabaski ${S}`).waitFor();
  check('fête religieuse ajoutée, alerte levée', (await cal.getByRole('status').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n3_jours_feries_bureau.png`, fullPage: true });
  await p.context().close();
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/leaves`);
  await p.getByRole('tab', { name: 'Jours fériés' }).click();
  await p.locator('[data-testid=jours-feries]').getByText('Fête de l’Indépendance').waitFor();
  check('agent : calendrier en lecture (aucun bouton de saisie)', (await p.getByRole('button', { name: 'Ajouter le jour férié' }).count()) === 0);
  check('téléphone : sans défilement horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.context().close();
  for (const j of (await call('admin', 'GET', `/api/v1/jours-feries?annee=${AN}`)).body.jours.filter((x) => x.libelle === `Tabaski ${S}`)) await call('admin', 'DELETE', `/api/v1/jours-feries/${j.id}`);

  console.log('— Tâche : avancement calculé');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Synthèse N3 ${S}`, priority: 'NORMAL', dueDate: jour(10), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  await call('agent1', 'POST', `/tasks/${t.id}/start`);
  p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/tasks`);
  await p.getByText(`Synthèse N3 ${S}`).first().click();
  await p.locator('[data-testid=avancement-calcule]').waitFor();
  check('tiroir : avancement 50 % expliqué, aucun curseur', /statut/.test(await p.locator('[data-testid=avancement-calcule]').innerText()) && (await p.locator('input[type=range]').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n3_avancement_bureau.png` });
  await p.context().close();

  console.log('— Stage : encadreur principal et rapport');
  for (const o of await prisma.stage.findMany({ where: { statut: { in: ['PREVU', 'EN_COURS'] } }, select: { id: true } })) await call('drh', 'POST', `/stages/${o.id}/interrompre`, { motif: 'Nettoyage avant test N3' });
  const st = (await call('admin', 'POST', '/users', { email: `n3ui${S}@test.local`, password: 'Password123!', firstName: 'Mariama', lastName: `Stagiaire${S}`, role: 'STAGIAIRE' })).body;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const sid = (await call('drh', 'POST', '/stages', { stagiaireId: st.id, etablissement: 'Université de Conakry', dateDebut: aujourdhui, dateFin: jour(30) })).body.id;
  const per = (await call('drh', 'POST', `/stages/${sid}/periodes`, { divisionId: ids.DPE, sectionId: ids.SSR, dateDebut: aujourdhui, dateFin: jour(30), formatEvaluation: 'AUCUNE' })).body;
  const pid = per.periodes ? per.periodes[0].id : per.id;
  await call('chefssr', 'POST', `/stages/${sid}/periodes/${pid}/accepter`, { tuteurId: ids.agent1 });
  // Début de stage appliqué comme le ferait le job quotidien.
  await prisma.periodeStage.update({ where: { id: pid }, data: { statut: 'EN_COURS', rattachementAppliqueAt: new Date() } });
  await prisma.stage.update({ where: { id: sid }, data: { statut: 'EN_COURS' } });

  p = await loginPage(b, 'drh');
  await p.goto(`${WEB}/stages/${sid}`);
  await p.locator('[data-testid=rapport-stage]').waitFor();
  check('DRH : encadreur « non désigné »', /non désigné/.test(await p.locator('[data-testid=encadrant-principal]').innerText()));
  await p.getByRole('button', { name: 'Désigner l’encadreur' }).click();
  const fe = p.getByRole('dialog', { name: 'Encadreur principal' });
  await fe.getByLabel(/Encadreur/).selectOption(ids.agent1);
  await fe.getByRole('button', { name: 'Désigner' }).click();
  await fe.waitFor({ state: 'detached' });
  await p.waitForFunction((n) => document.querySelector('[data-testid=encadrant-principal]')?.textContent?.includes(n), agent1.lastName);
  check('encadreur principal désigné et affiché', true);
  await p.context().close();

  const ctx = await b.newContext({ viewport: TELEPHONE, locale: 'fr-FR' });
  p = await ctx.newPage();
  await p.goto(`${WEB}/login`);
  await p.getByLabel('Adresse e-mail').fill(`n3ui${S}@test.local`);
  await p.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await p.getByRole('button', { name: /connecter/i }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  await p.goto(`${WEB}/stages/${sid}`);
  await p.locator('[data-testid=rapport-stage]').waitFor();
  const fichier = path.join(E.OUT, 'tmp', `rapport_${S}.pdf`);
  fs.writeFileSync(fichier, '%PDF-1.4\n% rapport de test\n');
  await p.getByLabel('Fichier du rapport').setInputFiles(fichier);
  await p.waitForFunction(() => /Déposé/.test(document.querySelector('[data-testid=statut-rapport]')?.textContent ?? ''));
  check('téléphone : rapport déposé par le stagiaire, statut affiché', true);
  check('… sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n3_rapport_stagiaire_mobile.png`, fullPage: true });
  await ctx.close();
  fs.rmSync(fichier, { force: true });

  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/stages/${sid}`);
  await p.locator('[data-testid=rapport-stage]').waitFor();
  await p.screenshot({ path: `${E.SHOTS}/n3_rapport_encadreur_mobile.png`, fullPage: true });
  await p.getByRole('button', { name: 'Valider le rapport' }).click();
  await p.waitForFunction(() => /Validé/.test(document.querySelector('[data-testid=statut-rapport]')?.textContent ?? ''));
  check('téléphone : l’encadreur valide le rapport', (await prisma.stage.findUnique({ where: { id: sid } })).rapportStatut === 'VALIDE');
  await p.context().close();
  await call('drh', 'POST', `/stages/${sid}/interrompre`, { motif: 'Fin du test N3' });

  console.log('— Congé sur téléphone');
  const c2 = (await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(100), endDate: jour(101) })).body;
  p = await loginPage(b, 'chefssr', TELEPHONE);
  await ouvrirDemande(p, 'À traiter', nom);
  await p.getByRole('button', { name: 'Avis défavorable' }).click();
  await p.getByLabel('Motif de l’avis défavorable').fill('Période de clôture budgétaire');
  check('téléphone : tiroir d’avis sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n3_avis_chef_mobile.png` });
  await p.getByRole('button', { name: 'Confirmer l’avis défavorable' }).click();
  await p.locator('[data-testid=circuit-conge]').waitFor({ state: 'detached' });
  const l2 = await prisma.leaveRequest.findUnique({ where: { id: c2.id } });
  check('avis défavorable motivé enregistré', l2.avisEtat === 'DEFAVORABLE' && /clôture/.test(l2.avisMotif));
  await p.context().close();
  await call('agent1', 'POST', `/leaves/${c2.id}/cancel`);
  await call('agent1', 'POST', `/leaves/${m.id}/cancel`);

  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
