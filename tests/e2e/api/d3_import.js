// Lot D3 — import Excel du personnel : comptes créés = Chargé d'Études seulement, mêmes
// contrôles que la création manuelle ; dossiers mis à jour sans toucher au rôle.
const { call, login, ids, check, expect, bilan } = require('../lib');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const em = (n) => `d3${S}${n}@test.local`;

async function classeur(lignes) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Personnel');
  ws.addRow(['Email', 'Prénom', 'Nom', 'Rôle', 'Division', 'Section', 'Cellule', "Statut d'emploi", 'Grade', 'Échelon', 'Téléphone personnel']);
  for (const l of lignes) ws.addRow(l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function importer(key, buf) {
  const fd = new FormData();
  if (buf) fd.append('file', new Blob([buf]), 'personnel.xlsx');
  const r = await fetch('http://localhost:3000/personnel-files/import', { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(key)) }, body: fd });
  return { status: r.status, body: await r.json() };
}

(async () => {
  const sfp = await prisma.section.findUnique({ where: { id: ids.SFP } });
  const dpe = await prisma.division.findUnique({ where: { id: ids.DPE } });
  const cnc = await prisma.cellule.findUnique({ where: { code: 'CNC' } });
  const dnAvant = await prisma.user.count({ where: { role: 'DN', status: 'ACTIF' } });
  const buf = await classeur([
    [em('a'), 'Awa', `Import${S}`, 'AGENT', dpe.code, sfp.code, '', 'FONCTIONNAIRE', 'A2', '3', '620000001'],
    [em('b'), 'Binta', `Import${S}`, '', '', '', cnc.code, 'CONTRACTUEL', '', '', ''],
    [em('c'), 'Cheick', `Import${S}`, "Chargé d'études", dpe.code, '', '', '', '', '', ''],
    [em('dn'), 'Deux', `Import${S}`, 'DN', '', '', '', '', '', '', ''],
    [em('adm'), 'Admin', `Import${S}`, 'ADMIN_SYSTEME', '', '', '', '', '', '', ''],
    [em('chef'), 'Chef', `Import${S}`, 'CHEF_DIVISION', dpe.code, '', '', '', '', '', ''],
    [em('drh'), 'Drh', `Import${S}`, 'DRH', '', '', '', '', '', '', ''],
    [em('sans'), 'Sans', `Import${S}`, 'AGENT', '', '', '', '', '', '', ''],
    [em('deux'), 'Deux', `Import${S}`, 'AGENT', dpe.code, '', cnc.code, '', '', '', ''],
    [em('sec'), 'Section', `Import${S}`, 'AGENT', '', sfp.code, '', '', '', '', ''],
    [em('susp'), 'Suspendue', `Import${S}`, 'AGENT', '', '', cnc.code, '', '', '', ''],
    ['agent1@test.local', '', '', 'DN', '', '', '', 'FONCTIONNAIRE', `G${S}`, '', ''],
  ]);

  console.log('— Refus d’accès');
  for (const key of ['admin', 'dn', 'chefdpe', 'agent1']) expect(`${key} importe`, await importer(key, buf), 403);
  expect('DRH sans fichier', await importer('drh', null), 400);

  console.log('— Import par le DRH');
  const r1 = await importer('drh', buf.slice(0));
  expect('import', r1, 201);
  const det = Object.fromEntries(r1.body.details.map((d) => [d.email, d]));
  check('bilan : 4 créés, 1 mis à jour, 7 refusés', r1.body.created === 4 && r1.body.updated === 1 && r1.body.errors === 7, JSON.stringify({ c: r1.body.created, u: r1.body.updated, e: r1.body.errors }));
  for (const n of ['a', 'b', 'c', 'susp']) check(`ligne ${n} : compte créé`, det[em(n)].status === 'created', det[em(n)].message);
  for (const n of ['dn', 'adm', 'chef', 'drh']) check(`ligne ${n} : refusée (rôle réservé au changement de rôle)`, det[em(n)].status === 'error' && /ne crée que des comptes de Chargé d'Études/.test(det[em(n)].message), det[em(n)].message);
  check('ligne sans rattachement : refusée', det[em('sans')].status === 'error' && /rattaché à une Division/.test(det[em('sans')].message), det[em('sans')].message);
  check('ligne division + cellule : refusée', det[em('deux')].status === 'error', det[em('deux')].message);
  check('ligne section sans division : refusée', det[em('sec')].status === 'error' && /sans Division/.test(det[em('sec')].message), det[em('sec')].message);
  check('agent1 existant : dossier mis à jour', det['agent1@test.local'].status === 'updated');

  const crees = await prisma.user.findMany({ where: { email: { in: ['a', 'b', 'c', 'susp'].map(em) } }, select: { email: true, role: true, divisionId: true, sectionId: true, celluleId: true } });
  check('comptes créés : tous Chargé d’Études', crees.length === 4 && crees.every((u) => u.role === 'AGENT'));
  const a = crees.find((u) => u.email === em('a'));
  check('rattachement division + section', a.divisionId === dpe.id && a.sectionId === sfp.id && !a.celluleId);
  check('aucun compte créé pour les lignes refusées', (await prisma.user.count({ where: { email: { in: ['dn', 'adm', 'chef', 'drh', 'sans', 'deux', 'sec'].map(em) } } })) === 0);
  check('toujours un seul DN actif', (await prisma.user.count({ where: { role: 'DN', status: 'ACTIF' } })) === dnAvant);
  const ag1 = await prisma.user.findUnique({ where: { id: ids.agent1 }, include: { personnelFileBasic: true } });
  check('agent1 : rôle inchangé malgré la colonne « DN »', ag1.role === 'AGENT');
  check('agent1 : grade importé, « à vérifier »', ag1.personnelFileBasic.grade === `G${S}` && ag1.personnelFileBasic.verifiedFields.grade === false, JSON.stringify(ag1.personnelFileBasic.verifiedFields));

  console.log('— Unité suspendue');
  await call('admin', 'POST', `/org/cellules/${cnc.id}/suspend`);
  const r2 = await importer('drh', await classeur([[em('susp2'), 'Suspendue', `Import${S}`, 'AGENT', '', '', cnc.code, '', '', '', '']]));
  await call('admin', 'POST', `/org/cellules/${cnc.id}/reactivate`);
  check('cellule suspendue : ligne refusée', r2.body.details[0].status === 'error' && /suspendue/.test(r2.body.details[0].message), r2.body.details[0].message);

  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
