// D7 — export Excel : jamais une ligne ni un champ de plus que l'écran.
const E = require('../config');
const ExcelJS = require('exceljs');
const { call, login, ids, check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
async function xlsx(key, path) {
  const r = await fetch('http://localhost:3000' + path, { headers: { Authorization: 'Bearer ' + (await login(key)) } });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const ws = wb.worksheets[0]; const rows = [];
  ws.eachRow((row, i) => { if (i > 1) rows.push(row.values.slice(1).map((v) => (v == null ? '' : String(v)))); });
  return { status: r.status, rows };
}
(async () => {
  const totalArr = await prisma.courrierArrivee.count({ where: { annee: new Date().getFullYear() } });
  const totalActes = await prisma.acteCourrier.count();
  console.log(`Base locale : ${totalArr} arrivées cette année, ${totalActes} actes.`);
  for (const k of ['dn', 'dna', 'secdg', 'secdpe', 'chefdpe', 'chefssr', 'assdn', 'agent1', 'agentdee', 'admin']) {
    const ecran = (await call(k, 'GET', '/courrier/arrivees')).body;
    const ex = await xlsx(k, '/courrier/arrivees/export.xlsx');
    const numE = ecran.map((a) => a.numero).sort(), numX = ex.rows.map((r) => r[0]).sort();
    const memesLignes = JSON.stringify(numE) === JSON.stringify(numX);
    const objets = ecran.every((a) => {
      const row = ex.rows.find((r) => r[0] === a.numero);
      return row && (a.objet ? row[4] === a.objet : row[4] === '' || row[4].startsWith('(pli personnel'));
    });
    const persoMasque = ecran.filter((a) => a.niveau === 'EXISTENCE').every((a) => ex.rows.find((r) => r[0] === a.numero)[4].startsWith('(pli personnel'));
    check(`arrivées — ${k.padEnd(8)} : export = écran (${numX.length} lignes), objets identiques, plis personnels masqués`, ex.status === 200 && memesLignes && objets && persoMasque);
    const actesE = (await call(k, 'GET', '/courrier/actes')).body;
    const exA = await xlsx(k, '/courrier/actes/export.xlsx');
    const idA = actesE.map((a) => a.numero ?? '(non numéroté)').sort(), idX = exA.rows.map((r) => r[0]).sort();
    check(`actes    — ${k.padEnd(8)} : export = écran (${idX.length} lignes)`, exA.status === 200 && JSON.stringify(idA) === JSON.stringify(idX));
  }
  const conf = await prisma.courrierArrivee.findFirst({ where: { confidentialite: 'CONFIDENTIEL' }, orderBy: { createdAt: 'desc' } });
  const exAdmin = await xlsx('admin', '/courrier/arrivees/export.xlsx');
  const exAss = await xlsx('assdn', '/courrier/arrivees/export.xlsx');
  // Règle C2 : l'administrateur n'a que son courrier personnel (plis à son nom).
  const plisAdmin = await prisma.courrierArrivee.findMany({ where: { destinataireId: ids.admin }, select: { numero: true } });
  check('admin : son export ne contient que ses plis personnels', exAdmin.rows.length === plisAdmin.length && exAdmin.rows.every((r) => plisAdmin.some((x) => x.numero === r[0])), `${exAdmin.rows.length} ligne(s) / ${plisAdmin.length} pli(s) à son nom`);
  check('assistante du DN : aucun CONFIDENTIEL dans son export (objet absent)', !exAss.rows.some((r) => r[4] === conf.objet));
  check('exports audités', (await prisma.auditLog.count({ where: { entityType: 'RegistreCourrier', metadata: { path: ['event'], equals: 'export_excel' } } })) >= 20);
  await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(1); });
