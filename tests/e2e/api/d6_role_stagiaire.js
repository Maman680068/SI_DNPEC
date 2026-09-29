// D6 — rôle STAGIAIRE : liste blanche vérifiée sur TOUTES les routes de l'API (analyse des
// contrôleurs), visibilité des tâches, exclusions (courrier, réunions, sondages, GED), rôles.
const E = require('../config');
const fs = require('fs'); const path = require('path');
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const SRC = E.API_SRC;
const REFUS = 'n’est pas accessible aux stagiaires';

// Routes ouvertes attendues (méthode + chemin normalisé).
const OUVERTES = new Set([
  'GET /users', 'GET /users/resolve', 'GET /users/search', 'GET /users/:id',
  'GET /tasks', 'GET /tasks/dashboard', 'GET /tasks/saved-filters', 'POST /tasks/saved-filters', 'DELETE /tasks/saved-filters/:id',
  'GET /tasks/:id', 'PATCH /tasks/:id/progress', 'GET /tasks/:id/subtasks', 'POST /tasks/:id/toggle', 'POST /tasks/:id/start',
  'POST /tasks/:id/submit', 'POST /tasks/:id/comments', 'GET /tasks/:id/comments', 'POST /tasks/:id/attachments',
  'GET /tasks/:id/attachments', 'GET /tasks/:id/attachments/:attachmentId/download', 'DELETE /tasks/:id/attachments/:attachmentId',
  'GET /announcements', 'GET /announcements/:id', 'POST /announcements/:id/read',
  'GET /org/divisions', 'GET /org/divisions/:id', 'GET /org/cellules', 'GET /org/cellules/:id',
  'GET /org/divisions/:divisionId/sections', 'GET /org/sections/:id', 'GET /suppleances/mine',
]);
const CLASSES_OUVERTES = ['/auth', '/messages', '/notifications', '/personnel-files', '/stages', '/aide'];

function routes() {
  const out = [];
  const walk = (d) => fs.readdirSync(d).forEach((f) => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.controller.ts') && out.push(p); });
  walk(SRC);
  const r = [];
  for (const f of out) {
    const s = fs.readFileSync(f, 'utf8');
    const m = s.match(/@Controller\((?:'([^']*)')?\)/); if (!m) continue;
    const prefix = m[1] ? '/' + m[1] : '';
    for (const x of s.matchAll(/@(Get|Post|Patch|Delete|Put)\((?:'([^']*)')?\)/g)) {
      const p = (prefix + (x[2] ? '/' + x[2] : '')) || '/';
      r.push({ methode: x[1].toUpperCase(), chemin: p, publique: /@Public\(\)\s*(?:\n\s*@[^\n]*)*\n\s*@/.test('') });
    }
  }
  return r;
}

(async () => {
  const st = (await call('admin', 'POST', '/users', { email: `stag${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `Stagiaire${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  if (!st.id) throw new Error(JSON.stringify(st));
  const K = `stag${S}`;
  check('création d’un compte Stagiaire par l’administrateur (rattaché à la section SSR)', st.role === 'STAGIAIRE');

  console.log('— Toutes les routes de l’API, appelées par le stagiaire');
  const liste = routes();
  let ouvertes = 0, refusees = 0; const anomalies = [];
  for (const { methode, chemin } of liste) {
    if (['/health', '/health/dependances'].includes(chemin) || chemin.startsWith('/auth')) continue; // publiques ou session (déconnexion) : vérifiées à part
    const url = chemin.replace(/:[A-Za-z]+/g, 'inexistant');
    const r = await call(K, methode, url, methode === 'GET' || methode === 'DELETE' ? undefined : {});
    const refus = r.status === 403 && (JSON.stringify(r.body).includes(REFUS) || r.body.message === 'Forbidden resource'); // liste blanche, ou @Roles déjà refusé
    const attendue = chemin !== '/personnel-files/import' && (OUVERTES.has(`${methode} ${chemin}`) || CLASSES_OUVERTES.some((c) => chemin === c || chemin.startsWith(c + '/')));
    if (attendue) { ouvertes++; if (refus) anomalies.push(`OUVERTE refusée : ${methode} ${chemin}`); }
    else { refusees++; if (!refus) anomalies.push(`FERMÉE non refusée : ${methode} ${chemin} → ${r.status}`); }
  }
  check(`${liste.length} routes analysées : ${ouvertes} ouvertes non bloquées, ${refusees} fermées refusées par la liste blanche`, anomalies.length === 0, anomalies.join(' ; '));
  expect('stagiaire : GET /auth/me', await call(K, 'GET', '/auth/me'), 200);
  check('rôle renvoyé : STAGIAIRE', (await call(K, 'GET', '/auth/me')).body.role === 'STAGIAIRE');

  console.log('— Tâches : les siennes seulement, jamais celles de la section');
  const sienne = await call('chefssr', 'POST', '/tasks', { title: `Tâche du stagiaire ${S}`, assignees: [{ userId: st.id }], divisionId: ids.DPE, sectionId: ids.SSR });
  expect('le chef de section assigne une tâche au stagiaire', sienne, 201);
  const section = await call('chefssr', 'POST', '/tasks', { title: `Tâche de section ${S}`, assignees: [{ userId: ids.agent1 }], divisionId: ids.DPE, sectionId: ids.SSR });
  expect('tâche de la section (assignée à agent1)', section, 201);
  const vues = (await call(K, 'GET', '/tasks')).body.map((t) => t.id);
  check('stagiaire : voit sa tâche', vues.includes(sienne.body.id));
  check('stagiaire : ne voit pas la tâche de la section', !vues.includes(section.body.id));
  expect('stagiaire : ouvre la tâche de la section', await call(K, 'GET', `/tasks/${section.body.id}`), 403);
  check('témoin : agent1 (Chargé d’Études de la section) voit la tâche du stagiaire', (await call('agent1', 'GET', '/tasks')).body.some((t) => t.id === sienne.body.id));
  expect('stagiaire : démarre sa tâche', await call(K, 'POST', `/tasks/${sienne.body.id}/start`), 201);
  const cree = await call(K, 'POST', '/tasks', { title: 'Essai', assignees: [{ userId: st.id }] });
  check('stagiaire : ne crée pas de tâche (liste blanche)', cree.status === 403 && JSON.stringify(cree.body).includes(REFUS));

  console.log('— Aucun droit par défaut dans les autres modules');
  const arrivee = await prisma.courrierArrivee.findFirst({ where: { statut: { in: ['ENREGISTRE', 'IMPUTE'] }, registre: { portee: 'DIRECTION' }, confidentialite: 'ORDINAIRE' }, include: { registre: true } });
  if (arrivee) {
    const acteur = arrivee.registre.portee === 'DIRECTION' ? 'dn' : 'dn';
    const r = await call(acteur, 'POST', `/courrier/arrivees/${arrivee.id}/imputations`, { imputeAId: st.id, nature: 'ATTRIBUTION' });
    check('imputer un courrier à un stagiaire → 403', r.status === 403 && /stagiaire/.test(r.body.message), `${r.status} ${r.body.message}`);
  }
  const reg = await prisma.registreCourrier.findFirst({ where: { portee: 'DIRECTION' } });
  const h = await call('admin', 'POST', '/courrier/habilitations', { userId: st.id, registreId: reg.id });
  check('habiliter un stagiaire au courrier → 403', h.status === 403 && /stagiaire/.test(h.body.message), `${h.status} ${h.body.message}`);
  const reu = await call('chefssr', 'POST', '/meetings', { title: `Réunion ${S}`, startAt: new Date(Date.now() + 864e5).toISOString(), participantIds: [st.id] });
  check('inviter un stagiaire à une réunion → 403', reu.status === 403 && /stagiaire/.test(reu.body.message), `${reu.status} ${reu.body.message}`);
  const son = await call('chefdpe', 'POST', '/polls', { question: `Sondage ${S} ?`, options: ['Oui', 'Non'], scope: 'DIVISION', divisionId: ids.DPE });
  expect('sondage de division (DPE)', son, 201);
  const notifSondage = (u) => prisma.notification.count({ where: { userId: u, channel: 'IN_APP', createdAt: { gte: new Date(Date.now() - 60000) }, body: { contains: `Sondage ${S}` } } });
  check('sondage : notifié à agent1, jamais au stagiaire', (await notifSondage(st.id)) === 0 && (await notifSondage(ids.agent1)) === 1, `${await notifSondage(st.id)} / ${await notifSondage(ids.agent1)}`);
  const grp = await call('chefdpe', 'POST', '/polls', { question: `Groupe ${S} ?`, options: ['Oui', 'Non'], scope: 'GROUPE_PERSONNALISE', recipientUserIds: [ids.agent1, st.id] });
  check('sondage à un groupe comprenant un stagiaire → 403', grp.status === 403 && /stagiaires/.test(grp.body.message), `${grp.status} ${grp.body.message}`);
  const ann = await call('chefdpe', 'POST', '/announcements', { title: `Annonce ${S}`, body: 'Bienvenue', scope: 'DIVISION', divisionId: ids.DPE });
  expect('annonce de division (DPE)', ann, 201);
  check('annonce : visible par le stagiaire', (await call(K, 'GET', '/announcements')).body.some((a) => a.id === ann.body.id));
  check('messagerie : le stagiaire écrit à son chef', (await call(K, 'POST', '/messages', { recipientId: ids.chefssr, body: 'Bonjour' })).status === 201);

  console.log('— Dossier du personnel, rôles');
  check('dossier : le stagiaire lit le sien (niveau 2 compris)', (await call(K, 'GET', `/personnel-files/${st.id}`)).body.droits.niveau2 === true);
  const chefLit = (await call('chefssr', 'GET', `/personnel-files/${st.id}`)).body;
  check('dossier : son chef lit le niveau 1 seulement', chefLit.sensitive === null && chefLit.droits.niveau2 === false);
  expect('dossier d’un autre agent (agent1) par le stagiaire', await call(K, 'GET', `/personnel-files/${ids.agent1}`), 403);
  const u = (await call('admin', 'POST', '/users', { email: `stagb${S}@test.local`, password: 'Password123!', firstName: 'Ibrahima', lastName: `Stagiaire${S}`, role: 'AGENT', divisionId: ids.DPE })).body;
  const vers = await call('admin', 'POST', `/users/${u.id}/role`, { role: 'STAGIAIRE', roleAttendu: 'AGENT', motif: 'Accueilli comme stagiaire' });
  check('changement de rôle Chargé d’Études → Stagiaire, sans unité', vers.status === 201 && (await prisma.user.findUnique({ where: { id: u.id } })).role === 'STAGIAIRE', JSON.stringify(vers.body).slice(0, 160));
  expect('Stagiaire → division et cellule à la fois', await call('admin', 'POST', `/users/${u.id}/role`, { role: 'STAGIAIRE', roleAttendu: 'STAGIAIRE', divisionId: ids.DPE, celluleId: ids.SAF, motif: 'Essai invalide' }), 400);
  expect('Stagiaire → Chargé d’Études (embauche)', await call('admin', 'POST', `/users/${u.id}/role`, { role: 'AGENT', roleAttendu: 'STAGIAIRE', divisionId: ids.DPE, motif: 'Recruté à la fin du stage' }), 201);
  expect('un stagiaire n’est pas suppléant (rang)', await call('chefdpe', 'POST', '/suppleances', { titulaireId: ids.chefdpe, suppleantId: st.id, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 864e5).toISOString() }), 403);

  const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('P');
  ws.addRow(['Email', 'Prénom', 'Nom', 'Rôle']); ws.addRow([`imp${S}@test.local`, 'Fatou', `Import${S}`, 'Stagiaire']);
  const fd = new FormData(); fd.append('file', new Blob([Buffer.from(await wb.xlsx.writeBuffer())]), 'p.xlsx');
  const ri = await fetch('http://localhost:3000/personnel-files/import', { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('drh')) }, body: fd }).then((r) => r.json());
  check('import Excel : ligne « Stagiaire » sans unité → compte Stagiaire', ri.created === 1 && (await prisma.user.findUnique({ where: { email: `imp${S}@test.local` } })).role === 'STAGIAIRE', JSON.stringify(ri.details));
  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
