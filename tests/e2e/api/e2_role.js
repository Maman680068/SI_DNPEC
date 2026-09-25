// Lot E — changement de rôle d'un compte existant : refus (400/403/404/409), parcours, effets,
// aperçu = action, sessions, historique, audit, notifications.
const E = require('../config');
const { call, upload, login, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36).slice(-5);
const k = (n) => `e2${S}${n}`;
// Codes d'unités : lettres majuscules seulement.
const L = S.toUpperCase().replace(/\d/g, (d) => 'ABCDEFGHIJ'[d]);
const motif = 'Nomination par décision de la Direction';

async function nouveau(n, role, extra = {}) {
  const r = await call('admin', 'POST', '/users', { email: `${k(n)}@test.local`, password: 'Password123!', firstName: n.toUpperCase(), lastName: `E2${S}`, role, ...extra });
  if (r.status !== 201) throw new Error(`création ${n} : ${JSON.stringify(r.body)}`);
  ids[k(n)] = r.body.id;
  return r.body.id;
}
const role = (id) => prisma.user.findUnique({ where: { id }, select: { role: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true, jobTitle: true } });
const corps = (roleAttendu, cible, extra = {}) => ({ role: cible, roleAttendu, motif, ...extra });
const changer = (id, body, key = 'admin') => call(key, 'POST', `/users/${id}/role`, body);
const apercu = (id, body, key = 'admin') => call(key, 'POST', `/users/${id}/role/apercu`, body);
async function suppleance(titulaire, suppleant, key = titulaire) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(key, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
  return r.body.id;
}
// Aperçu puis action : l'aperçu annonce exactement les effets appliqués.
async function aperçuPuisAction(label, id, body) {
  const a = await apercu(id, body);
  const r = await changer(id, body);
  const { applique, ...effectif } = r.body || {};
  check(`${label} → ${r.status}`, r.status === 201 && applique === true, r.status === 201 ? '' : JSON.stringify(r.body));
  check(`${label} : aperçu = effets appliqués`, a.status === 201 && JSON.stringify(a.body) === JSON.stringify(effectif), a.status !== 201 ? JSON.stringify(a.body) : '');
  return r.body;
}

(async () => {
  // Organisation dédiée : une division neuve avec deux sections, sans chef.
  const div = (await call('admin', 'POST', '/org/divisions', { code: `D${L}`, name: `Division test E2 ${S}` })).body;
  const s1 = (await call('admin', 'POST', `/org/divisions/${div.id}/sections`, { code: `SA${L}`, name: `Section 1 ${S}` })).body;
  const s2 = (await call('admin', 'POST', `/org/divisions/${div.id}/sections`, { code: `SB${L}`, name: `Section 2 ${S}` })).body;
  if (!div.id || !s1.id || !s2.id) throw new Error('mise en place : ' + JSON.stringify({ div, s1, s2 }));
  const cel = Object.fromEntries((await prisma.cellule.findMany()).map((c) => [c.code, c.id]));
  const x = await nouveau('x', 'CHEF_SECTION', { divisionId: div.id, sectionId: s1.id });
  const a = await nouveau('a', 'AGENT', { divisionId: div.id, sectionId: s1.id });
  const b = await nouveau('b', 'AGENT', { divisionId: div.id, sectionId: s2.id });
  const c = await nouveau('c', 'AGENT', { divisionId: ids.DEE });

  console.log('— Refus');
  for (const key of ['dn', 'dna', 'drh', 'chefdpe', 'agent1']) {
    expect(`${key} change un rôle`, await changer(c, corps('AGENT', 'DRH'), key), 403);
    expect(`${key} demande un aperçu`, await apercu(c, corps('AGENT', 'DRH'), key), 403);
  }
  expect('l’administrateur change son propre rôle', await changer(ids.admin, corps('ADMIN_SYSTEME', 'DRH')), 403);
  expect('compte inconnu', await changer('inconnu', corps('AGENT', 'DRH')), 404);
  expect('motif absent', await changer(c, { role: 'DRH', roleAttendu: 'AGENT' }), 400);
  expect('motif trop court', await changer(c, corps('AGENT', 'DRH', { motif: 'ok' })), 400);
  expect('Chef de Division sans division', await changer(c, corps('AGENT', 'CHEF_DIVISION')), 400);
  expect('Chef de Section sans section', await changer(c, corps('AGENT', 'CHEF_SECTION', { divisionId: div.id })), 400);
  expect('Assistant sans superviseur', await changer(c, corps('AGENT', 'ASSISTANT_DIRECTION')), 400);
  expect('aucun changement', await changer(c, corps('AGENT', 'AGENT', { divisionId: ids.DEE })), 409);
  expect('rôle attendu périmé', await changer(c, corps('CHEF_SECTION', 'DRH')), 409);
  expect('un seul DN actif', await changer(c, corps('AGENT', 'DN')), 409);
  expect('une seule DNA active', await changer(c, corps('AGENT', 'DNA')), 409);
  expect('division qui a déjà un chef', await changer(c, corps('AGENT', 'CHEF_DIVISION', { divisionId: ids.DPE })), 409);
  expect('section qui a déjà un chef', await changer(c, corps('AGENT', 'CHEF_SECTION', { divisionId: div.id, sectionId: s1.id })), 409);
  expect('cellule qui a déjà un chef (SAF)', await changer(c, corps('AGENT', 'CHEF_CELLULE', { celluleId: cel.SAF })), 409);
  expect('section hors de sa division', await changer(c, corps('AGENT', 'AGENT', { divisionId: ids.DPE, sectionId: s1.id })), 409);
  const r409a = await changer(ids.chefsaf, corps('CHEF_CELLULE', 'AGENT', { celluleId: cel.SAF }));
  expect('superviseur d’une assistante perd son rôle superviseur', r409a, 409);
  check('… le message liste l’assistante à réaffecter', /ASSSAF/.test(r409a.body.message), r409a.body.message);
  await call('admin', 'POST', `/org/cellules/${cel.CNC}/suspend`);
  expect('rattachement à une cellule suspendue', await changer(c, corps('AGENT', 'AGENT', { celluleId: cel.CNC })), 409);
  await call('admin', 'POST', `/org/cellules/${cel.CNC}/reactivate`);
  const susp = await nouveau('susp', 'AGENT', { divisionId: ids.DEE });
  await call('admin', 'PATCH', `/users/${susp}/status`, { status: 'SUSPENDU' });
  expect('compte suspendu', await changer(susp, corps('AGENT', 'DRH')), 409);
  expect('nommer le DN chef de cellule', await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef`, { userId: ids.dn, motif }), 409);
  expect('nommer la DNA chef de cellule', await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef`, { userId: ids.dna, motif }), 409);
  expect('nommer un Chef de Division chef de cellule', await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef`, { userId: ids.chefdee, motif }), 409);
  expect('retirer le chef d’une cellule qui n’en a pas', await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef/retrait`, { motif }), 409);
  expect('nommer un chef sans motif', await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef`, { userId: c }), 400);

  console.log('— Nominations simultanées sur la même division');
  const p1 = await nouveau('p1', 'AGENT', { divisionId: div.id });
  const p2 = await nouveau('p2', 'AGENT', { divisionId: div.id });
  const par = await Promise.all([p1, p2].map((id) => changer(id, corps('AGENT', 'CHEF_DIVISION', { divisionId: div.id }))));
  const codes = par.map((r) => r.status).sort().join(',');
  check('deux nominations parallèles de Chef de Division : exactement une réussit', codes === '201,409', codes);
  const chefDiv = par[0].status === 201 ? p1 : p2;
  const nbChefs = await prisma.user.count({ where: { role: 'CHEF_DIVISION', divisionId: div.id, status: 'ACTIF' } });
  check('… un seul Chef de Division actif en base', nbChefs === 1);
  await aperçuPuisAction('le chef nommé redevient Chargé d’Études (libère le poste)', chefDiv, corps('CHEF_DIVISION', 'AGENT', { divisionId: div.id }));

  console.log('— Chargé d’Études → DRH (cellule RH) : sessions, historique, audit, notifications');
  const sess = await (await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${k('c')}@test.local`, password: 'Password123!' }) })).json();
  expect('avant : /users/pending (réservé admin) refusé à c', await call(k('c'), 'GET', '/users/pending'), 403);
  const r1 = await aperçuPuisAction('Chargé d’Études → DRH', c, corps('AGENT', 'DRH', { celluleId: cel.RH, jobTitle: 'Directeur des Ressources Humaines' }));
  check('… sessions actives comptées puis révoquées', r1.effets.sessionsRevoquees >= 1, String(r1.effets.sessionsRevoquees));
  const u1 = await role(c);
  check('… rôle, rattachement et intitulé appliqués', u1.role === 'DRH' && u1.celluleId === cel.RH && u1.divisionId === null && u1.jobTitle === 'Directeur des Ressources Humaines');
  const refresh = await fetch(BASE + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: sess.refreshToken }) });
  check('… le jeton de rafraîchissement ne vaut plus (session révoquée)', refresh.status === 401, String(refresh.status));
  const me = await fetch(BASE + '/auth/me', { headers: { Authorization: 'Bearer ' + sess.accessToken } });
  check('… le jeton d’accès encore en cours porte déjà le nouveau rôle (relu à chaque requête)', (await me.json()).role === 'DRH');
  const ev = await prisma.personnelCareerEvent.findMany({ where: { userId: c }, orderBy: { createdAt: 'asc' } });
  check('… historique de carrière : changement de fonction et affectation', ev.some((e) => e.eventType === 'CHANGEMENT_FONCTION' && /Chargé.*→?/.test(e.fromValue) && /Directeur des Ressources Humaines/.test(e.toValue)) && ev.some((e) => e.eventType === 'AFFECTATION'), ev.map((e) => `${e.eventType}: ${e.fromValue} → ${e.toValue}`).join(' | '));
  const au = await prisma.auditLog.findFirst({ where: { entityType: 'User', entityId: c, metadata: { path: ['event'], equals: 'role_change' } } });
  check('… audit avant/après avec le motif', au && au.metadata.avant.role === 'AGENT' && au.metadata.apres.role === 'DRH' && au.metadata.motif === motif && au.actorId === ids.admin);
  const nPers = await prisma.notification.findFirst({ where: { userId: c, type: 'ROLE_MODIFIE', channel: 'EMAIL' } });
  const nDrh = await prisma.notification.findFirst({ where: { userId: ids.drh, type: 'ROLE_MODIFIE', channel: 'EMAIL', link: `/personnel/${c}` } });
  check('… notification ROLE_MODIFIE à la personne et au DRH, sans le motif', !!nPers && !!nDrh && !nPers.body.includes(motif) && !nDrh.body.includes(motif), `${nPers && nPers.body} / ${nDrh && nDrh.body}`);

  console.log('— Chef de Section → Chef de Division : visa, suppléances, tâches, congés, imputation');
  // Acte de a (section 1) en visa chez x (Chef de Section).
  const acte = (await call(k('a'), 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Note E2 ${S}` })).body;
  await call(k('a'), 'POST', `/courrier/actes/${acte.id}/soumettre`);
  // Suppléance de x par l'autre chef de section (b devient chef de S2 pour cela) : conforme aujourd'hui.
  await changer(b, corps('AGENT', 'CHEF_SECTION', { divisionId: div.id, sectionId: s2.id }));
  const supX = await suppleance(k('x'), k('b'));
  // Suppléance chefdee → x (conforme si x est Chef de Division, pas en Chef de Section d'une autre division).
  const tache = (await call('dn', 'POST', '/tasks', { title: `Tâche E2 ${S}`, dueDate: iso(5 * J), divisionId: div.id, sectionId: s1.id, assignees: [{ userId: a }] })).body;
  await call(k('a'), 'POST', `/tasks/${tache.id}/start`);
  await call(k('a'), 'POST', `/tasks/${tache.id}/submit`, {});
  let lt = (await call(k('a'), 'GET', '/leave-types')).body;
  if (!Array.isArray(lt) || lt.length === 0) {
    await call('admin', 'POST', '/leave-types', { code: 'ANNUEL', name: 'Congé annuel' });
    lt = (await call(k('a'), 'GET', '/leave-types')).body;
  }
  const conge = await call(k('a'), 'POST', '/leaves', { leaveTypeId: (lt[0] || {}).id, startDate: iso(20 * J).slice(0, 10), endDate: iso(22 * J).slice(0, 10), reason: 'Test E2' });
  const K = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: iso(0), expediteur: 'Test', objet: `Imputation E2 ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const imp = (await call('dn', 'POST', `/courrier/arrivees/${K.id}/imputations`, { imputeAId: x, nature: 'ATTRIBUTION' })).body;
  const r2 = await aperçuPuisAction('Chef de Section → Chef de Division (même division)', x, corps('CHEF_SECTION', 'CHEF_DIVISION', { divisionId: div.id }));
  check('… suppléance par un Chef de Section de sa division : conservée (conforme)', r2.effets.suppleancesConservees.some((s) => s.id === supX));
  check('… circuit de visa annoncé à recalculer', r2.effets.circuitsDeVisaARecalculer.some((v) => v.acteId === acte.id));
  check('… imputation en cours listée', r2.effets.imputationsEnCours.some((i) => i.id === imp.id));
  const ra = (await call(k('a'), 'GET', `/courrier/actes/${acte.id}`)).body;
  check('… le rédacteur voit le circuit obsolète et peut resoumettre', ra.circuitObsolete === true && ra.droits.soumettre === true);
  check('… et il a été prévenu (« circuit à recalculer »)', (await prisma.notification.count({ where: { userId: a, type: 'ACTE_RENVOYE', link: `/courrier?acte=${acte.id}` } })) >= 1);
  expect('… resoumission', await call(k('a'), 'POST', `/courrier/actes/${acte.id}/soumettre`), 201);
  const circuit = (await call(k('a'), 'GET', `/courrier/actes/${acte.id}`)).body.visas.filter((v) => v.cycle === 2).map((v) => `${v.niveau}:${v.statut}`);
  check('… nouveau circuit : Chef de Section vacant, puis Chef de Division x', circuit.join() === 'CHEF_SECTION:SAUTE,CHEF_DIVISION:EN_ATTENTE', circuit.join());
  check('… l’imputation reste à x, qui peut toujours la traiter', (await call(k('x'), 'GET', `/courrier/arrivees/${K.id}`)).body.imputations.find((i) => i.id === imp.id).droits.traiter === true);

  console.log('— Suppléance devenue non conforme : révoquée, notifiée, intérim refusé');
  const supC = await suppleance('chefdee', k('x')); // x suppléant de chefdee : Chef de Division ↔ Chef de Division, conforme
  const r3 = await aperçuPuisAction('Chef de Division → Chef de Section (section 1)', x, corps('CHEF_DIVISION', 'CHEF_SECTION', { divisionId: div.id, sectionId: s1.id }));
  check('… x (devenu Chef de Section) ne peut plus suppléer un Chef de Division d’une autre division : révoquée', r3.effets.suppleancesRevoquees.some((s) => s.id === supC));
  check('… la suppléance par le Chef de Section de sa division est conservée', r3.effets.suppleancesConservees.some((s) => s.id === supX));
  const sp = await prisma.suppleance.findUnique({ where: { id: supC } });
  check('… révoquée par l’administrateur, en base', !!sp.revokedAt && sp.revokedById === ids.admin);
  check('… les deux parties notifiées (SUPPLEANCE_REVOQUEE)', (await prisma.notification.count({ where: { type: 'SUPPLEANCE_REVOQUEE', userId: { in: [x, ids.chefdee] }, channel: 'IN_APP' } })) >= 2);
  expect('… x tente d’agir en intérim de chefdee', await call(k('x'), 'GET', '/tasks', undefined, { 'X-Interim-For': ids.chefdee }), 403);

  console.log('— Tâches et congés : l’autorité suit le nouveau rôle');
  await aperçuPuisAction('x quitte la hiérarchie (Chargé d’Études dans une autre division)', x, corps('CHEF_SECTION', 'AGENT', { divisionId: ids.DEE }));
  check('… sa suppléance restante (x titulaire, plus chef) est révoquée', !!(await prisma.suppleance.findUnique({ where: { id: supX } })).revokedAt);
  expect('… x ne valide plus la tâche de a', await call(k('x'), 'POST', `/tasks/${tache.id}/validate`, {}), 403);
  await changer(b, corps('CHEF_SECTION', 'CHEF_SECTION', { divisionId: div.id, sectionId: s1.id }));
  const vb = await call(k('b'), 'POST', `/tasks/${tache.id}/validate`, {});
  check('… le nouveau Chef de Section (b) la valide', vb.status === 201 || vb.status === 200, `${vb.status} ${JSON.stringify(vb.body).slice(0, 120)}`);
  if (conge.status === 201) {
    expect('… x ne décide plus du congé de a', await call(k('x'), 'POST', `/leaves/${conge.body.id}/approve`, {}), 403);
    const cb = await call(k('b'), 'POST', `/leaves/${conge.body.id}/approve`, {});
    check('… b tranche le congé en attente', cb.status === 201 || cb.status === 200, `${cb.status} ${JSON.stringify(cb.body).slice(0, 120)}`);
  } else console.log(`--- congé non créé (${conge.status} ${JSON.stringify(conge.body).slice(0, 100)})`);

  console.log('— Chef de Cellule : nommer, retirer (écran Organisation), historique');
  const n1 = await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef`, { userId: c, motif: 'Nomination à la tête du CNC' });
  expect('nommer c (DRH) chef du CNC', n1, 201);
  check('… Cellule.chefId posé, rôle et cellule appliqués', (await prisma.cellule.findUnique({ where: { id: cel.CNC } })).chefId === c && (await role(c)).role === 'CHEF_CELLULE' && (await role(c)).celluleId === cel.CNC);
  const w = await nouveau('w', 'AGENT', { celluleId: cel.CNC });
  expect('… un second chef pour le CNC', await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef`, { userId: w, motif }), 409);
  const r5 = await call('admin', 'POST', `/org/cellules/${cel.CNC}/chef/retrait`, { motif: 'Fin de fonction' });
  expect('retrait du chef (rôle cible par défaut)', r5, 201);
  const u5 = await role(c);
  check('… redevient Chargé d’Études dans la cellule, chefId vidé', u5.role === 'AGENT' && u5.celluleId === cel.CNC && (await prisma.cellule.findUnique({ where: { id: cel.CNC } })).chefId === null);
  check('… historique : Chef de Cellule → Chargé d’Études', (await prisma.personnelCareerEvent.count({ where: { userId: c, eventType: 'CHANGEMENT_FONCTION', toValue: { startsWith: 'Chargé' } } })) >= 1);

  console.log('— Assistant ↔ Chargé d’Études, accès délégués');
  const z = await nouveau('z', 'ASSISTANT_DIRECTION', { supervisorId: ids.dn });
  const Kc = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: iso(0), expediteur: 'Test', objet: `Confidentiel E2 ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  expect('le DN ouvre l’accès à son assistante z', await call('dn', 'POST', `/courrier/arrivees/${Kc.id}/acces-delegues`, { beneficiaireId: z }), 201);
  check('z voit le courrier confidentiel', (await call(k('z'), 'GET', `/courrier/arrivees/${Kc.id}`)).status === 200);
  const r6 = await aperçuPuisAction('Assistante → Chargée d’Études', z, corps('ASSISTANT_DIRECTION', 'AGENT', { divisionId: ids.DPE }));
  check('… accès délégué révoqué', r6.effets.accesDeleguesRevoques === 1 && (await prisma.accesDelegueCourrier.count({ where: { beneficiaireId: z, revoqueAt: null } })) === 0);
  check('… superviseur effacé', (await role(z)).supervisorId === null);
  const zc = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${k('z')}@test.local`, password: 'Password123!' }) }).then((r) => r.json());
  check('… z ne voit plus le courrier', (await fetch(`${BASE}/courrier/arrivees/${Kc.id}`, { headers: { Authorization: 'Bearer ' + zc.accessToken } })).status === 403);
  await aperçuPuisAction('Chargée d’Études → Assistante de la DNA', z, corps('AGENT', 'ASSISTANT_DIRECTION', { supervisorId: ids.dna }));
  check('… superviseur posé, unité effacée', (await role(z)).supervisorId === ids.dna && (await role(z)).divisionId === null);
  expect('assistante avec un superviseur non éligible (Chef de Division)', await changer(z, corps('ASSISTANT_DIRECTION', 'ASSISTANT_DIRECTION', { supervisorId: ids.chefdpe })), 409);

  console.log('— Administrateur système : attribution et retrait');
  await aperçuPuisAction('Chargé d’Études → Administrateur système', w, corps('AGENT', 'ADMIN_SYSTEME', { celluleId: cel.CSID }));
  await aperçuPuisAction('… puis retrait (reste un administrateur actif)', w, corps('ADMIN_SYSTEME', 'AGENT', { celluleId: cel.CSID }));
  console.log('--- dernier administrateur : l’acteur étant lui-même administrateur et ne pouvant viser son propre compte, il reste toujours un autre administrateur actif ; la protection est structurelle (et vérifiée dans le service).');

  console.log('— DN → DNA (suppléances conformes gardées), puis remise en place');
  const dnaAssistants = await prisma.user.count({ where: { supervisorId: ids.dna, role: 'ASSISTANT_DIRECTION' } });
  await changer(z, corps('ASSISTANT_DIRECTION', 'AGENT', { divisionId: ids.DPE })); // libère la DNA de son assistante de test
  await aperçuPuisAction('DNA → Chargée d’Études (libère le poste)', ids.dna, corps('DNA', 'AGENT', { divisionId: ids.DPE }));
  const supDn = await suppleance('dn', 'chefdee');
  const r7 = await aperçuPuisAction('DN → DNA', ids.dn, corps('DN', 'DNA'));
  check('… suppléance DN ↔ Chef de Division conservée', r7.effets.suppleancesConservees.some((s) => s.id === supDn));
  check('… l’assistante du DN reste rattachée (la DNA supervise aussi)', (await role(ids.assdn)).supervisorId === ids.dn);
  await changer(ids.dn, corps('DNA', 'DN'));
  await changer(ids.dna, corps('AGENT', 'DNA'));
  check('remise en place : DN et DNA', (await role(ids.dn)).role === 'DN' && (await role(ids.dna)).role === 'DNA', `${dnaAssistants}`);

  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch(async (e) => { console.error(e); process.exit(2); });
