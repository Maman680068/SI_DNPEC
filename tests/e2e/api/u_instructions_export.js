// Refonte de l'interface (étape 8) — GET api/v1/instructions/export.xlsx : bouton « Exporter » de
// l'écran Instructions de la Direction. Même périmètre que la liste (GET api/v1/instructions) :
// émetteur, DN/DNA, destinataire ; l'agent concerné seulement après l'exécution ; jamais le texte, le
// compte rendu ni le motif de rejet. 401 sans session, 403 pour un stagiaire.
const ExcelJS = require('exceljs');
const { call, login, ids, check, expect, bilan } = require('../lib');
const BASE = process.env.BASE || 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
async function xlsx(key) {
  const r = await fetch(`${BASE}/api/v1/instructions/export.xlsx`, { headers: { Authorization: 'Bearer ' + (await login(key)) } });
  if (r.status !== 200) return { status: r.status, lignes: [] };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const lignes = [];
  wb.worksheets[0].eachRow((row, n) => n > 1 && lignes.push(row.values.slice(1).map((v) => (v == null ? '' : String(v)))));
  return { status: r.status, type: r.headers.get('content-type'), nom: r.headers.get('content-disposition'), entete: wb.worksheets[0].getRow(1).values.slice(1), lignes };
}
const objets = (x) => x.lignes.map((l) => l[1]);
const union = (b) => new Set([...b.emises, ...b.recues, ...b.meConcernant].map((i) => i.id)).size;
(async () => {
  console.log('— Accès');
  const r401 = await fetch(`${BASE}/api/v1/instructions/export.xlsx`);
  check('sans session : 401', r401.status === 401);
  const sg = (await call('admin', 'POST', '/users', { email: `insst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `InsStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  if (sg && sg.id) expect('stagiaire : 403', await call(`insst${S}`, 'GET', '/api/v1/instructions/export.xlsx'), 403);
  else check('stagiaire de test non créé : contrôle sauté', true, JSON.stringify(sg).slice(0, 120));

  console.log('— Une instruction RH (agent concerné) et une instruction rejetée');
  const objetRh = `Export RH ${S}`;
  const rh = await call('dn', 'POST', '/api/v1/instructions', { objet: objetRh, texte: `Texte confidentiel ${S}`, destinataireId: ids.chefdpe, agentConcerneId: ids.agent2 });
  expect('DN émet une instruction RH (concerne agent2) au chef de division', rh, 201);
  const objetRej = `Export rejet ${S}`;
  const rej = await call('dna', 'POST', '/api/v1/instructions', { objet: objetRej, texte: 'Préparer une note.', destinataireId: ids.chefdpe });
  expect('DNA émet une seconde instruction', rej, 201);
  expect('le destinataire la rejette avec un motif', await call('chefdpe', 'POST', `/api/v1/instructions/${rej.body.id}/rejet`, { motif: `Motif protégé ${S}` }), 200);

  console.log('— Contenu : celui de la liste, pour chaque profil');
  for (const k of ['dn', 'dna', 'chefdpe', 'agent1', 'agent2', 'drh']) {
    const x = await xlsx(k);
    const liste = (await call(k, 'GET', '/api/v1/instructions')).body;
    check(`${k} : 200, classeur Excel, autant de lignes que d’instructions dans sa liste (${x.lignes.length})`, x.status === 200 && /spreadsheetml/.test(x.type) && /instructions_\d{4}-\d{2}-\d{2}\.xlsx/.test(x.nom) && x.lignes.length === union(liste));
  }
  const dn = await xlsx('dn');
  check('colonnes : métadonnées de suivi seulement (ni texte, ni compte rendu, ni motif)', JSON.stringify(dn.entete) === JSON.stringify(['Émise le', 'Objet', 'Émetteur', 'Destinataire', 'Agent concerné', 'Échéance', 'Statut', 'En retard', 'Close le']), JSON.stringify(dn.entete));
  const ligneRh = dn.lignes.find((l) => l[1] === objetRh);
  check('DN : instruction RH présente (destinataire, agent concerné, statut « Émise »)', !!ligneRh && ligneRh[6] === 'Émise' && ligneRh[4].length > 0, JSON.stringify(ligneRh));
  const ligneRej = dn.lignes.find((l) => l[1] === objetRej);
  check('DN : instruction rejetée présente, statut « Rejetée », date de clôture', !!ligneRej && ligneRej[6] === 'Rejetée' && ligneRej[8].length > 0, JSON.stringify(ligneRej));
  check('DNA (Direction) : voit aussi l’instruction du DN', objets(await xlsx('dna')).includes(objetRh));
  check('destinataire : les deux instructions', (await xlsx('chefdpe')).lignes.filter((l) => [objetRh, objetRej].includes(l[1])).length === 2);
  check('aucun export ne contient le texte ni le motif de rejet', ![dn, await xlsx('chefdpe')].some((x) => JSON.stringify(x.lignes).includes(`Texte confidentiel ${S}`) || JSON.stringify(x.lignes).includes(`Motif protégé ${S}`)));

  console.log('— Hors périmètre : rien ne sort');
  check('agent concerné (agent2), instruction non exécutée : absente de son export (invisible avant l’exécution)', !objets(await xlsx('agent2')).includes(objetRh));
  check('agent sans lien (agent1) : aucune des deux', !objets(await xlsx('agent1')).some((o) => [objetRh, objetRej].includes(o)));
  check('DRH (ni émetteur, ni destinataire) : aucune des deux', !objets(await xlsx('drh')).some((o) => [objetRh, objetRej].includes(o)));
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
