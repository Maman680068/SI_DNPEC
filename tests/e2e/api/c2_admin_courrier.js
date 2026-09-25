// C2 — courrier personnel de l'administrateur système : il rédige ses actes, reçoit ses plis,
// peut être bénéficiaire ; il ne voit rien d'autre ; jamais imputé ni délégataire (voir c2_routes).
const E = require('../config');
const ExcelJS = require('exceljs');
const { call, upload, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36);
const iso = () => new Date().toISOString();
async function xlsx(key, path) {
  const r = await fetch('http://localhost:3000' + path, { headers: { Authorization: 'Bearer ' + (await require('../lib').login(key)) } });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const rows = []; wb.worksheets[0].eachRow((row, i) => { if (i > 1) rows.push(row.values); });
  return rows;
}
(async () => {
  const admin = await prisma.user.findUnique({ where: { id: ids.admin }, select: { celluleId: true } });

  console.log('— Rédaction (rattaché à la cellule CSID, sans chef)');
  const k1 = await call('admin', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Lettre de l’admin ${S}`, destinataires: 'Fournisseur' });
  expect('l’administrateur rédige une lettre (registre Direction)', k1, 201);
  const s1 = await call('admin', 'POST', `/courrier/actes/${k1.body.id}/soumettre`);
  expect('… il la soumet', s1, 201);
  check('… circuit selon son rattachement : Chef de Cellule (poste vacant) puis signature DN/DNA', s1.body.statut === 'A_SIGNER' && s1.body.visas.length === 1 && s1.body.visas[0].niveau === 'CHEF_CELLULE' && s1.body.visas[0].statut === 'SAUTE', JSON.stringify(s1.body.visas.map((v) => `${v.niveau}:${v.statut}:${v.motifSaut}`)));
  expect('l’administrateur ne signe pas sa lettre', await call('admin', 'POST', `/courrier/actes/${k1.body.id}/signer`), 403);
  expect('le DN la signe', await call('dn', 'POST', `/courrier/actes/${k1.body.id}/signer`), 201);

  console.log('— Rédaction sans unité : registres Direction seulement, circuit vide');
  await prisma.user.update({ where: { id: ids.admin }, data: { celluleId: null } });
  try {
    const u1 = await call('admin', 'POST', '/courrier/actes', { registreId: reg.DEPU, confidentialite: 'ORDINAIRE', objet: `Unité ${S}` });
    expect('sans unité : registre d’unité refusé', u1, 400);
    const k2 = (await call('admin', 'POST', '/courrier/actes', { registreId: reg.NS, confidentialite: 'ORDINAIRE', objet: `Note de l’admin ${S}` })).body;
    const s2 = await call('admin', 'POST', `/courrier/actes/${k2.id}/soumettre`);
    check('sans unité : circuit vide, directement « à signer » (DN/DNA)', s2.status === 201 && s2.body.statut === 'A_SIGNER' && s2.body.visas.length === 0, `${s2.status} ${s2.body.statut} ${s2.body.visas && s2.body.visas.length}`);
    check('… le DN a le droit de signer, pas le chef de division', (await call('dn', 'GET', `/courrier/actes/${k2.id}`)).body.droits.signer === true && (await call('chefdpe', 'GET', `/courrier/actes/${k2.id}`)).status === 403);
    expect('… et l’annule lui-même (non numéroté)', await call('admin', 'POST', `/courrier/actes/${k2.id}/annuler`, { motif: 'Annulé par son rédacteur (test)' }), 201);
  } finally {
    await prisma.user.update({ where: { id: ids.admin }, data: { celluleId: admin.celluleId } });
  }
  const br = (await call('admin', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Brouillon admin ${S}` })).body;
  const tb1 = (await call('admin', 'GET', '/courrier/tableau-de-bord')).body;
  check('tableau de bord : son brouillon compte', tb1.brouillons >= 1, JSON.stringify(tb1));
  expect('il supprime son brouillon', await call('admin', 'DELETE', `/courrier/actes/${br.id}`), 204);

  console.log('— Bénéficiaire (ordre de mission) et prise de connaissance');
  const om = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Ordre de mission de l’admin ${S}`, beneficiaireId: ids.admin, priseConnaissanceRequise: true })).body;
  await call('agent1', 'POST', `/courrier/actes/${om.id}/soumettre`);
  expect('avant signature : l’administrateur ne voit pas l’acte', await call('admin', 'GET', `/courrier/actes/${om.id}`), 403);
  await call('chefssr', 'POST', `/courrier/actes/${om.id}/viser`, {});
  await call('chefdpe', 'POST', `/courrier/actes/${om.id}/viser`, {});
  expect('signé par le DN', await call('dn', 'POST', `/courrier/actes/${om.id}/signer`), 201);
  const vu = await call('admin', 'GET', `/courrier/actes/${om.id}`);
  check('après signature : il le voit et doit en prendre connaissance', vu.status === 200 && vu.body.droits.prendreConnaissance === true && vu.body.droits.signer === false);
  check('tableau de bord : « à prendre en connaissance » compte', (await call('admin', 'GET', '/courrier/tableau-de-bord')).body.priseDeConnaissance >= 1);
  expect('il prend connaissance', await call('admin', 'POST', `/courrier/actes/${om.id}/prise-de-connaissance`), 201);
  const omDn = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Ordre de mission du DN ${S}`, beneficiaireId: ids.dn })).body;
  await call('agent1', 'POST', `/courrier/actes/${omDn.id}/soumettre`);
  await call('chefssr', 'POST', `/courrier/actes/${omDn.id}/viser`, {});
  await call('chefdpe', 'POST', `/courrier/actes/${omDn.id}/viser`, {});
  expect('règle inchangée : jamais signataire de son propre acte (DN bénéficiaire)', await call('dn', 'POST', `/courrier/actes/${omDn.id}/signer`), 403);

  console.log('— Pli personnel à son nom');
  const pli = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: iso(), expediteur: 'Banque', confidentialite: 'PERSONNEL', destinataireId: ids.admin })).body;
  const niv = async (k) => { const r = await call(k, 'GET', `/courrier/arrivees/${pli.id}`); return r.status === 200 ? r.body.niveau : r.status; };
  check('administrateur (destinataire) : contenu', (await niv('admin')) === 'CONTENU');
  for (const [k, e] of [['dn', 'EXISTENCE'], ['dna', 'EXISTENCE'], ['secdg', 'EXISTENCE'], ['assdn', 403], ['chefdpe', 403], ['agent1', 403]]) check(`pli de l’administrateur — ${k} : ${e}`, (await niv(k)) === e);
  expect('il complète son pli', await call('admin', 'POST', `/courrier/arrivees/${pli.id}/completer`, { objet: 'Relevé bancaire' }), 201);
  check('… objet visible de lui seul (DN : existence, sans objet)', (await call('dn', 'GET', `/courrier/arrivees/${pli.id}`)).body.objet === null);

  console.log('— Il ne voit que ses éléments');
  const arr = (await call('admin', 'GET', '/courrier/arrivees')).body;
  check('arrivées : uniquement ses plis personnels', arr.length >= 1 && arr.every((a) => a.destinataireId === ids.admin), `${arr.length} ligne(s)`);
  const act = (await call('admin', 'GET', '/courrier/actes')).body;
  check('actes : uniquement rédigés par lui ou dont il est bénéficiaire (signés)', act.length >= 2 && act.every((a) => a.redacteurId === ids.admin || (a.beneficiaireId === ids.admin && a.numero)), `${act.length} ligne(s)`);
  const totalArr = await prisma.courrierArrivee.count(); const totalAct = await prisma.acteCourrier.count();
  check('… alors que les registres en contiennent bien d’autres', totalArr > arr.length && totalAct > act.length, `${totalArr} arrivées, ${totalAct} actes au total`);
  const xa = await xlsx('admin', '/courrier/arrivees/export.xlsx');
  const xk = await xlsx('admin', '/courrier/actes/export.xlsx');
  check('export arrivées : ses seuls plis', xa.length === arr.length && xa.every((r) => arr.some((a) => a.numero === r[1])), `${xa.length} ligne(s)`);
  check('export actes : ses seuls actes', xk.length === act.length, `${xk.length} ligne(s)`);
  expect('il ne peut pas imputer son pli sans le requalifier', await call('admin', 'GET', `/courrier/imputables?arriveeId=${pli.id}`), 409);
  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch(async (e) => { console.error(e); process.exit(2); });
