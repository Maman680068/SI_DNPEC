// D6 — attestation de fin de stage : modèle Word (champs {{CLE}}, y compris coupés entre plusieurs
// « runs ») et PDF à champs, version provisoire, version finale = acte du module Courrier signé par
// le DN (numéro), prise de connaissance par le stagiaire depuis son stage, nom repris du compte à jour.
const E = require('../config');
require('reflect-metadata');
const { execSync } = require('child_process');
const fs = require('fs');
const { call, login, ids, check, expect, bilan } = require('../lib');
const { NestFactory } = require('@nestjs/core');
const PizZip = require('pizzip');
const { PDFDocument } = require('pdf-lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const BASE_URL = 'http://localhost:3000';
const TMP = E.tmp('attestation');
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const BASE = new Date(Date.UTC(new Date().getUTCFullYear() + 2, 0, 5) + Math.floor(Math.random() * 300) * J);
const d = (n) => new Date(BASE.getTime() + n * J).toISOString().slice(0, 10);

function docx(nom, runs) {
  // Document Word réel (python-docx) : chaque élément de `runs` est un « run » distinct.
  fs.mkdirSync(TMP, { recursive: true });
  const f = `${TMP}/${nom}.docx`;
  execSync(`python3 -c "import docx,sys,json; d=docx.Document(); p=d.add_paragraph(); [p.add_run(r) for r in json.loads(sys.argv[1])]; d.save(sys.argv[2])" '${JSON.stringify(runs).replace(/'/g, "'\\''")}' '${f}'`);
  return fs.readFileSync(f);
}
async function pdfAChamps(champs) {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595, 842]); const form = pdf.getForm();
  champs.forEach((c, i) => form.createTextField(c).addToPage(page, { x: 60, y: 760 - i * 40, width: 460, height: 24 }));
  return Buffer.from(await pdf.save());
}
async function envoyer(key, path, buf, nom) {
  const fd = new FormData(); if (buf) fd.append('file', new Blob([buf]), nom);
  const r = await fetch(BASE_URL + path, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(key)) }, body: fd });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function telecharger(key, path) {
  const r = await fetch(BASE_URL + path, { headers: { Authorization: 'Bearer ' + (await login(key)) } });
  return { status: r.status, type: r.headers.get('content-type'), nom: decodeURIComponent((r.headers.get('content-disposition') || '').replace(/.*filename="([^"]+)".*/, '$1')), buf: Buffer.from(await r.arrayBuffer()) };
}
const texteDocx = (buf) => new PizZip(buf).file('word/document.xml').asText().replace(/<[^>]+>/g, '');
const hex = (s) => Buffer.from(s, 'latin1').toString('hex').toUpperCase();
// Contenu d'un PDF, flux décompressés (pdf-lib compresse les flux de contenu).
function contenuPdf(buf) {
  const zlib = require('zlib'); const l = buf.toString('latin1'); let out = l; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(l))) { const fin = l.indexOf('endstream', m.index); try { out += zlib.inflateSync(Buffer.from(l.slice(m.index + m[0].length, fin), 'latin1')).toString('latin1'); } catch { /* flux non compressé */ } }
  return out;
}

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const job = app.get(require(D + '/stages/stages-rotation.service').StagesRotationService);
  const st = (await call('admin', 'POST', '/users', { email: `att${S}@test.local`, password: 'Password123!', firstName: 'Kadiatou', lastName: `Diallo${S}`, role: 'STAGIAIRE' })).body.id;
  const K = `att${S}`;
  const stage = (await call('drh', 'POST', '/stages', { stagiaireId: st, etablissement: 'Université de Sonfonia', diplomePrepare: 'Licence Statistique', dateDebut: d(0), dateFin: d(20) })).body.id;
  const pid = (await call('drh', 'POST', `/stages/${stage}/periodes`, { divisionId: ids.DEE, dateDebut: d(0), dateFin: d(20), formatEvaluation: 'AUCUNE' })).body.periodes[0].id;
  await call('chefdee', 'POST', `/stages/${stage}/periodes/${pid}/accepter`, { tuteurId: ids.agentdee });
  await job.executer(new Date(BASE.getTime() + 3600e3));
  await job.executer(new Date(BASE.getTime() + 21 * J + 3600e3));

  console.log('— Modèle d’attestation (DRH seul)');
  for (const k of ['dn', 'chefdee', K]) expect(`${k} lit le modèle`, await call(k, 'GET', '/stages/modele-attestation'), 403);
  // Réglages des stages : l'administrateur système les tient aussi (tant qu'aucun DRH n'est nommé).
  expect('admin lit le modèle (réglages des stages)', await call('admin', 'GET', '/stages/modele-attestation'), 200);
  const dispo = await call('drh', 'GET', '/stages/modele-attestation');
  check('champs disponibles affichés au DRH (14)', dispo.status === 200 && dispo.body.champsDisponibles.length === 14 && dispo.body.champsDisponibles.some((c) => c.cle === 'NOM_COMPLET'));
  expect('un chef importe un modèle', await envoyer('chefdee', '/stages/modele-attestation', docx('chef', ['{{NOM}}']), 'a.docx'), 403);
  const inc = await envoyer('drh', '/stages/modele-attestation', docx('inconnu', ['Attestation pour {{NOM_COMPLET}} — {{MATRICULE}}']), 'modele.docx');
  check('champ inconnu refusé (400), avec la liste des champs disponibles', inc.status === 400 && /MATRICULE/.test(inc.body.message) && /NOM_COMPLET/.test(inc.body.message), inc.body && inc.body.message);
  expect('Word sans aucun champ', await envoyer('drh', '/stages/modele-attestation', docx('vide', ['Texte fixe']), 'vide.docx'), 400);
  expect('fichier ni Word ni PDF', await envoyer('drh', '/stages/modele-attestation', Buffer.from('x'), 'modele.txt'), 400);
  expect('Word illisible', await envoyer('drh', '/stages/modele-attestation', Buffer.from('pas un zip'), 'faux.docx'), 400);
  const ok = await envoyer('drh', '/stages/modele-attestation', docx('attestation', ['Nous attestons que ', '{{NOM_', 'COMPLET}}', ', de {{ETABLISSEMENT}}, a effectué un stage du {{DATE_DEBUT}} au {{DATE_FIN}} ({{DUREE}}) : {{UNITES}}. N° {{NUMERO}} — {{SIGNATAIRE}}']), 'Modele DNPEC.docx');
  check('modèle Word importé, champs reconnus (même coupés entre deux runs)', ok.status === 201 && ok.body.modele.type === 'DOCX' && ['NOM_COMPLET', 'ETABLISSEMENT', 'DATE_DEBUT', 'DATE_FIN', 'DUREE', 'UNITES', 'NUMERO', 'SIGNATAIRE'].every((c) => ok.body.modele.champs.includes(c)), JSON.stringify(ok.body && (ok.body.modele || ok.body.message)));

  console.log('— Documents (modèle Word)');
  const doc1 = await telecharger('drh', `/stages/${stage}/attestation/document`);
  const t1 = texteDocx(doc1.buf);
  check('document Word rempli (nom, établissement, unité, dates), plus aucun {{…}}', doc1.status === 200 && /wordprocessingml/.test(doc1.type) && t1.includes(`Kadiatou DIALLO${S.toUpperCase()}`) && t1.includes('Université de Sonfonia') && /Division/.test(t1) && !t1.includes('{{'), t1.slice(0, 160));
  check('numéro et signataire vides avant signature', /N° {2}—/.test(t1) || /N°\s+—/.test(t1));
  await call('admin', 'PATCH', `/users/${st}`, { lastName: `Barry${S}` });
  check('nom repris du compte à jour (après changement de nom)', texteDocx((await telecharger('drh', `/stages/${stage}/attestation/document`)).buf).includes(`Kadiatou BARRY${S.toUpperCase()}`));
  const prov = await telecharger('drh', `/stages/${stage}/attestation/provisoire`);
  check('provisoire : PDF (mise en page standard, le Word ne se convertit pas côté serveur)', prov.status === 200 && prov.type === 'application/pdf' && prov.buf.slice(0, 4).toString() === '%PDF' && (await PDFDocument.load(prov.buf)).getPageCount() >= 1);
  for (const k of ['dn', 'chefdee', K]) expect(`${k} télécharge la provisoire`, await call(k, 'GET', `/stages/${stage}/attestation/provisoire`), 403);

  console.log('— Modèle PDF à champs');
  const pdfMod = await pdfAChamps(['NOM_COMPLET', 'DATE_DEBUT', 'DATE_FIN', 'NUMERO']);
  const okp = await envoyer('drh', '/stages/modele-attestation', pdfMod, 'modele.pdf');
  check('modèle PDF importé (4 champs), l’ancien modèle Word désactivé', okp.status === 201 && okp.body.modele.type === 'PDF' && okp.body.modele.champs.length === 4 && (await prisma.modeleAttestation.count({ where: { actif: true } })) === 1);
  expect('PDF avec un champ inconnu', await envoyer('drh', '/stages/modele-attestation', await pdfAChamps(['NOM_COMPLET', 'GRADE']), 'x.pdf'), 400);
  expect('PDF sans champ', await envoyer('drh', '/stages/modele-attestation', Buffer.from(await (await PDFDocument.create()).save()), 'x.pdf'), 400);
  const p2 = await telecharger('drh', `/stages/${stage}/attestation/provisoire`);
  const l2 = contenuPdf(p2.buf);
  check('provisoire depuis le PDF : champs remplis et aplatis, mention « PROVISOIRE »', p2.type === 'application/pdf' && l2.includes(hex('Kadiatou')) && l2.includes(hex('PROVISOIRE - NON SIGNEE')) && (await PDFDocument.load(p2.buf)).getForm().getFields().length === 0);
  const f2 = await telecharger('drh', `/stages/${stage}/attestation/document`);
  const l3 = contenuPdf(f2.buf);
  check('document PDF (sans mention provisoire)', f2.type === 'application/pdf' && l3.includes(hex('Kadiatou')) && !l3.includes(hex('PROVISOIRE - NON SIGNEE')));
  // Retour au modèle Word pour la version finale.
  await envoyer('drh', '/stages/modele-attestation', docx('final', ['{{NOM_COMPLET}} — N° {{NUMERO}} — {{SIGNATAIRE}}']), 'Modele final.docx');

  console.log('— Version finale : acte du module Courrier');
  const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
  const reg = (await call('admin', 'POST', '/courrier/registres', { code: `AT${L}`, libelle: `Attestations de stage ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'ATT/{seq}/{annee}' })).body;
  const regDep = (await call('admin', 'POST', '/courrier/registres', { code: `DP${L}`, libelle: `Départs ${S}`, nature: 'DEPART', portee: 'DIRECTION', gabaritNumero: '{seq}' })).body;
  expect('acte avant la clôture du stage', await call('drh', 'POST', `/stages/${stage}/attestation/acte`, { registreId: reg.id }), 409);
  expect('clôture du stage', await call('drh', 'POST', `/stages/${stage}/cloturer`), 201);
  expect('registre de départ (pas d’actes)', await call('drh', 'POST', `/stages/${stage}/attestation/acte`, { registreId: regDep.id }), 400);
  expect('un chef prépare l’acte', await call('chefdee', 'POST', `/stages/${stage}/attestation/acte`, { registreId: reg.id }), 403);
  const acteR = await call('drh', 'POST', `/stages/${stage}/attestation/acte`, { registreId: reg.id });
  expect('le DRH prépare l’acte', acteR, 201);
  const acteId = acteR.body.acteId;
  const acte = await prisma.acteCourrier.findUnique({ where: { id: acteId }, include: { pieces: true } });
  check('acte : bénéficiaire = stagiaire, prise de connaissance requise, document joint, registre d’attestations', acte.beneficiaireId === st && acte.priseConnaissanceRequise && acte.pieces.some((p) => p.nature === 'ANNEXE' && p.fileName.endsWith('.docx')) && acte.registreId === reg.id);
  expect('seconde préparation', await call('drh', 'POST', `/stages/${stage}/attestation/acte`, { registreId: reg.id }), 409);
  let vue = (await call(K, 'GET', `/stages/${stage}`)).body.attestation;
  check('stagiaire : rien avant la signature', vue.acte === null && !vue.droits.prendreConnaissance && !vue.droits.telechargerFinale);
  expect('le DRH soumet l’acte (circuit du module Courrier)', await call('drh', 'POST', `/courrier/actes/${acteId}/soumettre`), 201);
  let a2 = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a2.statut === 'EN_VISA' && i < 3; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a2 = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  check('acte à signer', a2.statut === 'A_SIGNER', a2.statut);
  const fd = new FormData(); fd.append('file', new Blob([`SCAN SIGNE ${S}`]), 'attestation-signee.pdf');
  const sig = await fetch(`${BASE_URL}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
  check('le DN signe avec le scan (numéro attribué)', sig.status === 201, sig.status);
  const signe = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  check('numéro au format du registre', /^ATT\/\d+\/\d{4}$/.test(signe.numero), signe.numero);

  console.log('— Après signature');
  vue = (await call(K, 'GET', `/stages/${stage}`)).body.attestation;
  check('stagiaire : numéro visible, prise de connaissance et téléchargement proposés', vue.acte && vue.acte.numero === signe.numero && vue.droits.prendreConnaissance && vue.droits.telechargerFinale);
  expect('le stagiaire ouvre l’acte dans le module Courrier', await call(K, 'GET', `/courrier/actes/${acteId}`), 403);
  const fin = await telecharger(K, `/stages/${stage}/attestation/finale`);
  check('le stagiaire télécharge le scan signé depuis son stage', fin.status === 200 && fin.buf.toString() === `SCAN SIGNE ${S}`);
  expect('le chef de la DEE télécharge l’attestation', await call('chefdee', 'GET', `/stages/${stage}/attestation/finale`), 403);
  expect('le DRH prend connaissance à sa place', await call('drh', 'POST', `/stages/${stage}/attestation/prise-de-connaissance`), 403);
  expect('le stagiaire prend connaissance', await call(K, 'POST', `/stages/${stage}/attestation/prise-de-connaissance`), 201);
  check('prise de connaissance enregistrée sur l’acte', !!(await prisma.acteCourrier.findUnique({ where: { id: acteId } })).priseConnaissanceAt);
  expect('seconde prise de connaissance', await call(K, 'POST', `/stages/${stage}/attestation/prise-de-connaissance`), 409);
  expect('provisoire après signature', await call('drh', 'GET', `/stages/${stage}/attestation/provisoire`), 409);
  const doc3 = texteDocx((await telecharger('drh', `/stages/${stage}/attestation/document`)).buf);
  check('document final : numéro et signataire renseignés', doc3.includes(signe.numero) && doc3.includes('DN'), doc3);

  await app.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
