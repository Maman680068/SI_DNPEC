// D6 — écrans des stages sous Chromium (bureau et mobile) : DRH (création, plan, capacité refusée,
// modèle, attestation), chef (acceptation), tuteur (évaluation), chef (visa), stagiaire (lecture,
// prise de connaissance). Le job de rotation est appelé avec des dates simulées.
const E = require('../config');
require('reflect-metadata');
const { execSync } = require('child_process');
const fs = require('fs');
const { browser, loginPage, check, bilan, WEB, ouvrirPlus } = require('./helpers');
const { call, login, ids } = require('../lib');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const SHOTS = E.SHOTS;
const TMP = E.tmp('ui');
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const BASE = new Date(Date.UTC(new Date().getUTCFullYear() + 4, 1, 1) + Math.floor(Math.random() * 300) * J);
const d = (n) => new Date(BASE.getTime() + n * J).toISOString().slice(0, 10);
const MOBILE = { width: 390, height: 844 };
async function attendre(f) { for (let i = 0; i < 60; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
const dlg = (p) => p.locator('form[role=dialog]');

(async () => {
  const app = await NestFactory.createApplicationContext(require(E.API_DIST + '/app.module').AppModule, { logger: false });
  const job = app.get(require(E.API_DIST + '/stages/stages-rotation.service').StagesRotationService);
  for (const o of await prisma.stage.findMany({ where: { statut: { in: ['PREVU', 'EN_COURS'] } }, select: { id: true } })) await call('drh', 'POST', `/stages/${o.id}/interrompre`, { motif: 'Nettoyage avant test' });
  for (const c of await prisma.capaciteAccueil.findMany()) await call('drh', 'PUT', '/stages/capacites', { uniteKey: c.uniteKey, maximum: null });
  const mk = async (n, prenom) => (await call('admin', 'POST', '/users', { email: `ui${S}${n}@test.local`, password: 'Password123!', firstName: prenom, lastName: `Camara${S}`, role: 'STAGIAIRE' })).body.id;
  const st = await mk('a', 'Aminata');
  const st2 = await mk('b', 'Moussa');
  const K = `ui${S}a`;
  const b = await browser();

  console.log('— DRH (bureau) : nouveau stage et plan');
  const drh = await loginPage(b, 'drh');
  drh.on('dialog', (x) => x.accept());
  await ouvrirPlus(drh);
  await drh.getByRole('link', { name: 'Stagiaires' }).click();
  await drh.getByRole('button', { name: '+ Nouveau stage' }).click();
  await dlg(drh).getByLabel('Stagiaire').selectOption(st);
  await dlg(drh).getByLabel('Établissement d’origine').fill('Université Kofi Annan de Guinée');
  await dlg(drh).getByLabel('Diplôme préparé (facultatif)').fill('Master Économétrie');
  await dlg(drh).getByLabel('Début').fill(d(0));
  await dlg(drh).getByLabel('Fin').fill(d(40));
  await dlg(drh).getByRole('button', { name: 'Créer le stage' }).click();
  await drh.waitForURL('**/stages/c*');
  const sid = drh.url().split('/').pop();
  check('stage créé, fiche ouverte', !!(await prisma.stage.findUnique({ where: { id: sid } })));
  const periode = async (unite, debut, fin, format) => {
    await drh.getByRole('button', { name: '+ Ajouter une période' }).click();
    if (unite.cellule) { await dlg(drh).getByRole('button', { name: 'Cellule' }).click(); await dlg(drh).getByLabel('Cellule').selectOption(unite.cellule); }
    else { await dlg(drh).getByLabel('Division').selectOption(unite.division); if (unite.section) await dlg(drh).getByLabel('Section').selectOption(unite.section); }
    await dlg(drh).getByLabel('Du').fill(debut); await dlg(drh).getByLabel('Au').fill(fin);
    await dlg(drh).getByLabel('Évaluation de fin de période').selectOption(format);
    await dlg(drh).getByRole('button', { name: 'Enregistrer' }).click();
  };
  await periode({ division: ids.DPE, section: ids.SSR }, d(0), d(19), 'GRILLE');
  await drh.locator('[data-testid=periode-1]').waitFor();
  await periode({ cellule: ids.SAF }, d(20), d(40), 'TEXTE');
  await drh.locator('[data-testid=periode-2]').waitFor();
  check('deux périodes « à accepter par l’unité »', (await drh.getByText('À accepter par l’unité').count()) === 2);
  await drh.screenshot({ path: `${SHOTS}/d6_stage_plan_drh_desktop.png`, fullPage: true });

  console.log('— DRH : capacité d’accueil (paramètres) et refus affiché');
  await drh.goto(`${WEB}/stages/parametres`);
  await drh.locator('[data-testid=capacites]').getByLabel('Division').selectOption(ids.DPE);
  await drh.locator('[data-testid=capacites]').getByLabel('Section').selectOption(ids.SSR);
  await drh.getByLabel('Maximum').fill('1');
  await drh.getByRole('button', { name: 'Fixer la capacité' }).click();
  await drh.getByText('Capacité enregistrée.').waitFor();
  check('capacité SSR = 1 enregistrée', (await prisma.capaciteAccueil.findUnique({ where: { uniteKey: `SEC:${ids.SSR}` } })).maximum === 1);
  const s2 = (await call('drh', 'POST', '/stages', { stagiaireId: st2, etablissement: 'ISSEG', dateDebut: d(0), dateFin: d(40) })).body.id;
  await drh.goto(`${WEB}/stages/${s2}`);
  await periode({ division: ids.DPE, section: ids.SSR }, d(5), d(15), 'TEXTE');
  const alerte = dlg(drh).getByRole('alert');
  await alerte.waitFor();
  check('période au-delà de la capacité : refus de l’API dans la fenêtre', /Capacité d’accueil atteinte/.test(await alerte.innerText()), await alerte.innerText());
  await dlg(drh).getByRole('button', { name: 'Annuler' }).click();
  await call('drh', 'PUT', '/stages/capacites', { uniteKey: `SEC:${ids.SSR}`, maximum: null });

  console.log('— Chef de section (bureau) : acceptation, tuteur');
  const chef = await loginPage(b, 'chefssr');
  await chef.goto(`${WEB}/stages/${sid}`);
  await chef.locator('[data-testid=periode-1]').getByRole('button', { name: 'Accepter et désigner le tuteur' }).click();
  const sel = dlg(chef).getByLabel('Tuteur');
  await attendre(async () => (await sel.locator('option').count()) > 1);
  const ecran = (await sel.locator('option').evaluateAll((os) => os.map((o) => o.value))).filter(Boolean).sort();
  const api = (await call('chefssr', 'GET', `/stages/${sid}/periodes/${(await prisma.periodeStage.findFirst({ where: { stageId: sid, ordre: 1 } })).id}/tuteurs-possibles`)).body.map((u) => u.id).sort();
  check(`tuteurs proposés = liste de l’API (${ecran.length})`, JSON.stringify(ecran) === JSON.stringify(api));
  await chef.screenshot({ path: `${SHOTS}/d6_acceptation_chef_desktop.png` });
  await sel.selectOption(ids.agent1);
  await dlg(chef).getByRole('button', { name: 'Accepter' }).click();
  await chef.locator('[data-testid=periode-1]').getByText('Acceptée').waitFor();
  check('période acceptée, tuteur affiché', /Tuteur : AGENT1/i.test(await chef.locator('[data-testid=periode-1]').innerText()));
  check('le chef de section ne peut pas accepter la période de SAF', (await chef.locator('[data-testid=periode-2]').getByRole('button', { name: /Accepter/ }).count()) === 0);
  await call('chefsaf', 'POST', `/stages/${sid}/periodes/${(await prisma.periodeStage.findFirst({ where: { stageId: sid, ordre: 2 } })).id}/accepter`, { tuteurId: ids.agentsaf });

  console.log('— Rotation (job, dates simulées) puis tuteur (mobile) : évaluation');
  await job.executer(new Date(BASE.getTime() + 3600e3));
  check('rattachement du stagiaire = SSR', (await prisma.user.findUnique({ where: { id: st } })).sectionId === ids.SSR);
  const tut = await loginPage(b, 'agent1', MOBILE);
  await tut.goto(`${WEB}/stages/${sid}`);
  const ev = tut.locator('[data-testid=evaluation-1]');
  await ev.waitFor();
  for (const [c, n] of [['Assiduité', 'TRES_SATISFAISANT'], ['Qualité du travail', 'SATISFAISANT'], ['Autonomie', 'SATISFAISANT'], ['Intégration', 'TRES_SATISFAISANT']]) await ev.getByLabel(c).selectOption(n);
  await ev.getByLabel('Appréciation').fill(`Stagiaire rigoureuse, notes de conjoncture de qualité ${S}.`);
  await tut.screenshot({ path: `${SHOTS}/d6_evaluation_tuteur_mobile.png`, fullPage: true });
  await ev.getByRole('button', { name: 'Soumettre au visa' }).click();
  await tut.getByText('Évaluation soumise au responsable de l’unité.').waitFor();
  check('évaluation soumise (base)', (await prisma.evaluationStage.findFirst({ where: { periode: { stageId: sid, ordre: 1 } } })).statut === 'SOUMISE');
  check('mobile : pas de défilement horizontal', (await tut.evaluate(() => document.documentElement.scrollWidth)) <= 390);

  console.log('— Chef : visa ; stagiaire (mobile) : lecture');
  const stag = await loginPage(b, K, MOBILE);
  await stag.goto(`${WEB}/stages`);
  await stag.waitForURL(`**/stages/${sid}`);
  check('stagiaire : « Mon stage » ouvre directement son stage', true);
  check('avant visa : l’évaluation n’est pas visible du stagiaire', !(await stag.locator('[data-testid=evaluation-1]').innerText().catch(() => '')).includes(S));
  await chef.reload();
  await chef.locator('[data-testid=evaluation-1]').getByRole('button', { name: 'Viser' }).click();
  await chef.getByText('Évaluation visée : le stagiaire peut la lire.').waitFor();
  await stag.reload();
  await stag.locator('[data-testid=evaluation-1]').getByText(S, { exact: false }).waitFor();
  const t = await stag.locator('[data-testid=evaluation-1]').innerText();
  check('après visa : grille et appréciation visibles du stagiaire', /Très satisfaisant/.test(t) && /Visée/.test(t));
  check('stagiaire : aucune action de gestion', (await stag.getByRole('button', { name: /Ajouter|Modifier|Accepter|Viser|Clôturer|Interrompre/ }).count()) === 0);
  await stag.screenshot({ path: `${SHOTS}/d6_mon_stage_stagiaire_mobile.png`, fullPage: true });

  console.log('— DRH : modèle Word, clôture, attestation');
  fs.mkdirSync(TMP, { recursive: true });
  execSync(`python3 -c "import docx; d=docx.Document(); d.add_paragraph('ATTESTATION DE STAGE N° {{NUMERO}}'); d.add_paragraph('Nous attestons que {{NOM_COMPLET}}, de {{ETABLISSEMENT}}, a effectué un stage du {{DATE_DEBUT}} au {{DATE_FIN}} : {{UNITES}}.'); d.add_paragraph('{{SIGNATAIRE}}'); d.save('${TMP}/modele.docx')"`);
  await drh.goto(`${WEB}/stages/parametres`);
  await drh.getByLabel('Nouveau modèle (.docx, ou .pdf à champs)').setInputFiles(`${TMP}/modele.docx`);
  await drh.getByRole('button', { name: 'Importer' }).click();
  await drh.getByText('Modèle importé.').waitFor();
  check('modèle Word importé, champs utilisés affichés', /NOM_COMPLET/.test(await drh.locator('[data-testid=modele]').innerText()));
  await drh.screenshot({ path: `${SHOTS}/d6_parametres_drh_desktop.png`, fullPage: true });
  await job.executer(new Date(BASE.getTime() + 20 * J + 3600e3));
  await job.executer(new Date(BASE.getTime() + 41 * J + 3600e3));
  await drh.goto(`${WEB}/stages/${sid}`);
  const [pdf] = await Promise.all([drh.waitForEvent('download'), drh.getByRole('button', { name: 'Version provisoire (PDF)' }).click()]);
  check('version provisoire téléchargée (PDF)', fs.readFileSync(await pdf.path()).slice(0, 4).toString() === '%PDF');
  await drh.getByRole('button', { name: 'Clôturer' }).click();
  await drh.getByText('Stage clôturé.').waitFor();
  const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
  await call('admin', 'POST', '/courrier/registres', { code: `ATT${L}`, libelle: `Attestations de stage ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'ATT/{seq}/{annee}' });
  await drh.getByRole('button', { name: 'Préparer l’attestation finale' }).click();
  await attendre(async () => (await dlg(drh).getByLabel('Registre d’attestations').locator('option').count()) > 1);
  await dlg(drh).getByLabel('Registre d’attestations').selectOption({ label: `ATT${L} — Attestations de stage ${S}` });
  await dlg(drh).getByRole('button', { name: 'Créer l’acte' }).click();
  await drh.getByText('Acte en préparation dans le module Courrier').waitFor();
  const st1 = await prisma.stage.findUnique({ where: { id: sid } });
  check('acte créé et relié au stage', !!st1.attestationActeId);
  await call('drh', 'POST', `/courrier/actes/${st1.attestationActeId}/soumettre`);
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'attestation.pdf');
  await fetch(`http://localhost:3000/courrier/actes/${st1.attestationActeId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
  await stag.reload();
  await stag.locator('[data-testid=attestation]').getByText(/Attestation n°/).waitFor();
  const [scan] = await Promise.all([stag.waitForEvent('download'), stag.getByRole('button', { name: 'Télécharger l’attestation signée' }).click()]);
  check('stagiaire : scan signé téléchargé', fs.readFileSync(await scan.path(), 'utf8') === `SCAN ${S}`);
  await stag.getByRole('button', { name: 'J’ai pris connaissance de mon attestation' }).click();
  await stag.getByText('Prise de connaissance enregistrée.').waitFor();
  check('prise de connaissance enregistrée sur l’acte', !!(await prisma.acteCourrier.findUnique({ where: { id: st1.attestationActeId } })).priseConnaissanceAt);
  await stag.screenshot({ path: `${SHOTS}/d6_attestation_stagiaire_mobile.png`, fullPage: true });
  await drh.reload();
  await drh.locator('[data-testid=attestation]').getByText(/Attestation n°/).waitFor();
  await drh.screenshot({ path: `${SHOTS}/d6_stage_termine_drh_desktop.png`, fullPage: true });

  await b.close(); await app.close(); fs.rmSync(TMP, { recursive: true, force: true }); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
