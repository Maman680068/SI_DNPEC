// N3 — règles métier du socle : circuit des congés (avis du chef en 48 heures ouvrées, alerte 12 heures
// avant, avis tacite, décision du DRH, demande d'un DRH décidée par la Direction, reprise des demandes
// d'avant N3), motif médical réservé au DRH derrière la réauthentification, purge des messages de plus
// de 3 ans, avancement des tâches calculé, encadreur principal et rapport de stage.
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, upload, preuve, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const H = 3600e3;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const notifs = (userId, depuis, titre) => prisma.notification.count({ where: { userId, channel: 'IN_APP', createdAt: { gte: depuis }, title: { contains: titre } } });
// Stage loin dans le futur : le job réel de rotation ne le touche pas pendant le test.
const BASE = new Date(Date.UTC(new Date().getUTCFullYear() + 2, 4, 4) + Math.floor(Math.random() * 200) * J);
const d = (n) => new Date(BASE.getTime() + n * J).toISOString().slice(0, 10);

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const conges = app.get(require(D + '/leaves/leave-requests/leave-requests.service').LeaveRequestsService);
  const conservation = app.get(require(D + '/socle/conservation.service').ConservationService);
  const storage = app.get(require(D + '/common/storage/storage.service').StorageService);
  const rotation = app.get(require(D + '/stages/stages-rotation.service').StagesRotationService);
  const { ajouterHeuresOuvrees, heuresOuvreesEntre } = require(D + '/socle/heures-ouvrees');
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie']]) if (!types.some((x) => x.code === code)) await call('admin', 'POST', '/leave-types', { code, name });
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const annuel = types.find((t) => t.code === 'CONGE_ANNUEL');
  const maladie = types.find((t) => t.code === 'CONGE_MALADIE');

  console.log('— Heures ouvrées (du lundi au vendredi)');
  const vendredi = new Date('2026-10-02T10:00:00Z');
  check('48 h ouvrées depuis un vendredi 10 h → mardi 10 h', ajouterHeuresOuvrees(vendredi, 48).toISOString() === '2026-10-06T10:00:00.000Z');
  check('départ un samedi → compté depuis le lundi 0 h', ajouterHeuresOuvrees(new Date('2026-10-03T15:00:00Z'), 12).toISOString() === '2026-10-05T12:00:00.000Z');
  check('entre vendredi 10 h et mardi 10 h : 48 h ouvrées', heuresOuvreesEntre(vendredi, new Date('2026-10-06T10:00:00Z')) === 48);

  console.log('— Délai d’avis : paramètre borné');
  expect('délai hors bornes (6 h)', await call('admin', 'PATCH', '/api/v1/parametres/conges.delaiAvisHeures', { valeur: 6 }), 400);
  expect('délai hors bornes (200 h)', await call('admin', 'PATCH', '/api/v1/parametres/conges.delaiAvisHeures', { valeur: 200 }), 400);
  expect('le DN ne modifie pas le délai', await call('dn', 'PATCH', '/api/v1/parametres/conges.delaiAvisHeures', { valeur: 24 }), 403);
  expect('délai porté à 24 h ouvrées', await call('admin', 'PATCH', '/api/v1/parametres/conges.delaiAvisHeures', { valeur: 24 }), 200);
  await attendre(5500); // cache des paramètres
  const c24 = (await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(60), endDate: jour(61), reason: `N3 ${S} 24h` })).body;
  const l24 = await prisma.leaveRequest.findUnique({ where: { id: c24.id } });
  check('nouvelle demande : échéance à 24 h ouvrées du dépôt', Math.abs(l24.avisEcheance - ajouterHeuresOuvrees(l24.createdAt, 24)) < 2000);
  expect('délai ramené à 48 h', await call('admin', 'PATCH', '/api/v1/parametres/conges.delaiAvisHeures', { valeur: 48 }), 200);
  await attendre(5500);

  console.log('— Circuit : avis du chef, alerte, avis tacite, décision du DRH');
  const t0 = new Date();
  const c = (await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(40), endDate: jour(42), reason: `N3 ${S}` })).body;
  const l = await prisma.leaveRequest.findUnique({ where: { id: c.id } });
  check('dépôt : étape « avis attendu », échéance à 48 h ouvrées', c.etape === 'AVIS_ATTENDU' && Math.abs(l.avisEcheance - ajouterHeuresOuvrees(l.createdAt, 48)) < 2000);
  check('… chef prévenu (« Donner mon avis »), DRH informé', (await notifs(ids.chefssr, t0, '')) > 0 && (await notifs(ids.drh, t0, '')) > 0);
  const vueChef = (await call('chefssr', 'GET', `/leaves/${c.id}`)).body;
  const vueDrh = (await call('drh', 'GET', `/leaves/${c.id}`)).body;
  check('chef : peut donner son avis, pas décider', vueChef.droits.peutDonnerAvis && !vueChef.droits.peutDecider);
  expect('le chef de division ne donne pas l’avis (le chef de section, plus proche, existe)', await call('chefdpe', 'POST', `/leaves/${c.id}/avis`, { avis: 'FAVORABLE' }), 403);
  expect('le DN non plus', await call('dn', 'POST', `/leaves/${c.id}/avis`, { avis: 'FAVORABLE' }), 403);
  check('DRH : ni avis ni décision avant l’avis', !vueDrh.droits.peutDonnerAvis && !vueDrh.droits.peutDecider);
  check('le DRH voit toutes les demandes (liste)', (await call('drh', 'GET', '/leaves')).body.some((r) => r.id === c.id));
  check('un autre agent ne la voit pas', !(await call('agent2', 'GET', '/leaves')).body.some((r) => r.id === c.id));
  expect('un autre agent ne l’ouvre pas', await call('agent2', 'GET', `/leaves/${c.id}`), 403);

  let r = await conges.executer(new Date(l.avisEcheance.getTime() - 20 * H));
  check('20 h ouvrées avant l’échéance : pas encore d’alerte', !(await prisma.leaveRequest.findUnique({ where: { id: c.id } })).alerteAvisAt);
  const tAlerte = new Date();
  // 11 h réelles avant l'échéance : au plus 11 h ouvrées restantes.
  r = await conges.executer(new Date(l.avisEcheance.getTime() - 11 * H));
  check('≤ 12 h ouvrées avant l’échéance : alerte au chef', r.alertes >= 1 && (await notifs(ids.chefssr, tAlerte, 'Rappel : avis attendu')) >= 1);
  const tAlerte2 = new Date();
  await conges.executer(new Date(l.avisEcheance.getTime() - 10 * H));
  check('… une seule fois', (await notifs(ids.chefssr, tAlerte2, 'Rappel : avis attendu')) === 0);
  const tTacite = new Date();
  r = await conges.executer(new Date(l.avisEcheance.getTime() + 60e3));
  const apresTacite = (await call('drh', 'GET', `/leaves/${c.id}`)).body;
  check('échéance passée : avis réputé favorable (tacite), décision attendue du DRH', apresTacite.avisEtat === 'TACITE' && apresTacite.etape === 'DECISION_ATTENDUE' && apresTacite.droits.peutDecider);
  check('… DRH prévenu', (await notifs(ids.drh, tTacite, '')) >= 1);
  check('… avis tacite tracé (auteur : système)', (await prisma.auditLog.count({ where: { entityId: c.id, actorId: null, metadata: { path: ['avis'], equals: 'TACITE' } } })) === 1);
  const tardif = await call('chefssr', 'POST', `/leaves/${c.id}/avis`, { avis: 'DEFAVORABLE', motif: 'Trop tard' });
  check('avis du chef après l’échéance → 409 (réputé favorable)', tardif.status === 409 && /réputé favorable/.test(tardif.body.message), tardif.body.message);
  r = await conges.executer(new Date(l.avisEcheance.getTime() + 2 * H));
  check('job rejoué : rien de plus sur cette demande', (await prisma.auditLog.count({ where: { entityId: c.id, metadata: { path: ['avis'], equals: 'TACITE' } } })) === 1);
  expect('le chef ne décide pas', await call('chefssr', 'POST', `/leaves/${c.id}/approve`, {}), 403);
  expect('le DN ne décide pas (décision du DRH)', await call('dn', 'POST', `/leaves/${c.id}/approve`, {}), 403);
  const tDec = new Date();
  expect('le DRH approuve', await call('drh', 'POST', `/leaves/${c.id}/approve`, {}), 201);
  check('… demandeur et chef informés', (await notifs(ids.agent1, tDec, '')) >= 1 && (await notifs(ids.chefssr, tDec, '')) >= 1);

  console.log('— Reprise : demande en attente d’avant N3 (sans échéance)');
  const ancienne = (await call('agent2', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(70), endDate: jour(71) })).body;
  await prisma.leaveRequest.update({ where: { id: ancienne.id }, data: { avisEcheance: null } });
  const maintenant = new Date();
  r = await conges.executer(maintenant);
  const reprise = await prisma.leaveRequest.findUnique({ where: { id: ancienne.id } });
  check('échéance posée au premier passage du job (48 h ouvrées à partir de ce passage)', r.echeancesPosees >= 1 && Math.abs(reprise.avisEcheance - ajouterHeuresOuvrees(maintenant, 48)) < 2000 && reprise.avisEtat === null);

  console.log('— Demande d’un DRH : décidée par la Direction');
  const cDrh = (await call('drh', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(80), endDate: jour(81) })).body;
  const avisDrh = await prisma.leaveRequest.findUnique({ where: { id: cDrh.id } });
  await conges.executer(new Date(avisDrh.avisEcheance.getTime() + 60e3));
  expect('le DRH ne décide pas sa propre demande', await call('drh', 'POST', `/leaves/${cDrh.id}/approve`, {}), 403);
  check('… le DN la décide', (await call('dn', 'GET', `/leaves/${cDrh.id}`)).body.droits.peutDecider === true);
  expect('le DN approuve', await call('dn', 'POST', `/leaves/${cDrh.id}/approve`, {}), 201);

  console.log('— Motif médical : DRH seul, après réauthentification');
  const m = (await call('agent1', 'POST', '/leaves', { leaveTypeId: maladie.id, startDate: jour(50), endDate: jour(51), reason: `Consultation spécialisée ${S}` })).body;
  const vues = {};
  for (const k of ['chefssr', 'chefdpe', 'dn']) vues[k] = (await call(k, 'GET', `/leaves/${m.id}`)).body;
  check('chef de section, chef de division, DN : type masqué, aucun motif', Object.values(vues).every((v) => v.leaveType.code !== 'CONGE_MALADIE' && v.reason === null && /protégé/.test(v.leaveType.name)));
  check('… le chef donne pourtant son avis', vues.chefssr.droits.peutDonnerAvis === true);
  const sansPreuve = (await call('drh', 'GET', `/leaves/${m.id}`)).body;
  check('DRH sans preuve : type visible, motif verrouillé', sansPreuve.leaveType.code === 'CONGE_MALADIE' && sansPreuve.motifVerrouille === true && sansPreuve.reason === null);
  const avantTrace = await prisma.auditLog.count({ where: { entityType: 'LeaveRequest', entityId: m.id, metadata: { path: ['event'], equals: 'acces_objet_protege' } } });
  const avecPreuve = (await call('drh', 'GET', `/leaves/${m.id}`, undefined, { 'X-Reauth': await preuve('drh') })).body;
  check('DRH avec preuve : motif affiché', avecPreuve.motifVerrouille === false && avecPreuve.reason === `Consultation spécialisée ${S}`);
  check('… consultation tracée au journal d’audit', (await prisma.auditLog.count({ where: { entityType: 'LeaveRequest', entityId: m.id, metadata: { path: ['event'], equals: 'acces_objet_protege' } } })) === avantTrace + 1);
  const vueSoi = (await call('agent1', 'GET', `/leaves/${m.id}`)).body;
  check('le demandeur voit sa propre demande en entier', vueSoi.leaveType.code === 'CONGE_MALADIE' && vueSoi.reason === `Consultation spécialisée ${S}` && vueSoi.motifVerrouille === false);
  const preuveChef = await preuve('chefssr');
  check('une preuve ne donne rien au chef (besoin d’en connaître)', (await call('chefssr', 'GET', `/leaves/${m.id}`, undefined, { 'X-Reauth': preuveChef })).body.reason === null);
  await call('agent1', 'POST', `/leaves/${m.id}/cancel`);

  console.log('— Messages directs : conservation 3 ans');
  const vieux = await storage.save(Buffer.from('pièce ancienne'), 'ancienne.txt');
  const m1 = await prisma.directMessage.create({ data: { senderId: ids.agent1, recipientId: ids.agent2, body: `Ancien ${S}`, attachmentKey: vieux.fileKey, attachmentName: 'ancienne.txt', createdAt: new Date(Date.now() - (3 * 365 + 2) * J) } });
  const m2 = await prisma.directMessage.create({ data: { senderId: ids.agent1, recipientId: ids.agent2, body: `Récent ${S}`, createdAt: new Date(Date.now() - (3 * 365 - 5) * J) } });
  const p = await conservation.purgerMessages(new Date());
  check('message de plus de 3 ans effacé avec sa pièce jointe', p.messages >= 1 && p.piecesJointes >= 1 && !(await prisma.directMessage.findUnique({ where: { id: m1.id } })));
  const fichierAbsent = await new Promise((res) => { let s; try { s = storage.createReadStream(vieux.fileKey); } catch { return res(true); } s.on('error', () => res(true)); s.on('data', () => res(false)); });
  check('… fichier retiré du stockage', fichierAbsent);
  check('message de moins de 3 ans conservé', !!(await prisma.directMessage.findUnique({ where: { id: m2.id } })));
  await prisma.directMessage.delete({ where: { id: m2.id } });

  console.log('— Avancement des tâches : calculé, jamais saisi');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Note ${S}`, priority: 'NORMAL', dueDate: jour(10), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  check('tâche créée : 0 %', t.progressPercent === 0);
  const st1 = (await call('chefssr', 'POST', `/tasks/${t.id}/subtasks`, { title: `Étape 1 ${S}`, priority: 'NORMAL', assignees: [{ userId: ids.agent1 }] })).body;
  const st2 = (await call('chefssr', 'POST', `/tasks/${t.id}/subtasks`, { title: `Étape 2 ${S}`, priority: 'NORMAL', assignees: [{ userId: ids.agent1 }] })).body;
  check('deux sous-tâches créées', !!st1.id && !!st2.id, JSON.stringify(st1).slice(0, 160));
  await call('agent1', 'POST', `/tasks/${st1.id}/toggle`);
  check('une sous-tâche sur deux terminée → 50 %', (await call('agent1', 'GET', `/tasks/${t.id}`)).body.progressPercent === 50);
  await call('agent1', 'POST', `/tasks/${st2.id}/toggle`);
  check('deux sur deux → 100 %', (await call('agent1', 'GET', `/tasks/${t.id}`)).body.progressPercent === 100);
  await call('agent1', 'POST', `/tasks/${st2.id}/toggle`);
  check('sous-tâche rouverte → 50 %', (await call('agent1', 'GET', `/tasks/${t.id}`)).body.progressPercent === 50);
  expect('saisie manuelle de l’avancement', await call('agent1', 'PATCH', `/tasks/${t.id}/progress`, { progressPercent: 80 }), 409);
  const refusSql = await prisma.$executeRawUnsafe(`UPDATE tasks SET "progressPercent" = 77 WHERE id = '${t.id}'`).then(async () => (await prisma.task.findUnique({ where: { id: t.id } })).progressPercent);
  check('même une écriture directe en base est recalculée (déclencheur)', refusSql === 50);

  console.log('— Stage : encadreur principal et rapport');
  const stg = (await call('admin', 'POST', '/users', { email: `n3${S}@test.local`, password: 'Password123!', firstName: 'Rapport', lastName: `Stagiaire${S}`, role: 'STAGIAIRE' })).body;
  ids[`n3${S}`] = stg.id; const KS = `n3${S}`;
  const sid = (await call('drh', 'POST', '/stages', { stagiaireId: stg.id, etablissement: 'Université de Conakry', dateDebut: d(0), dateFin: d(30) })).body.id;
  const per = (await call('drh', 'POST', `/stages/${sid}/periodes`, { divisionId: ids.DPE, sectionId: ids.SSR, dateDebut: d(0), dateFin: d(30), formatEvaluation: 'AUCUNE' })).body;
  const pid = per.periodes ? per.periodes[0].id : per.id;
  expect('le chef accepte la période (tuteur agent1)', await call('chefssr', 'POST', `/stages/${sid}/periodes/${pid}/accepter`, { tuteurId: ids.agent1 }), 201);
  const fichier = [{ field: 'file', name: 'rapport.txt', content: 'Rapport de stage' }];
  expect('dépôt avant le début du stage', await upload(KS, `/stages/${sid}/rapport`, {}, fichier), 409);
  await rotation.executer(new Date(BASE.getTime() + H));
  expect('dépôt sans encadreur principal désigné', await upload(KS, `/stages/${sid}/rapport`, {}, fichier), 409);
  for (const k of ['dn', 'chefssr', 'agent1', KS]) expect(`${k} désigne l’encadreur`, await call(k, 'POST', `/stages/${sid}/encadrant-principal`, { userId: ids.agent1 }), 403);
  check('encadreurs possibles (DRH) : les tuteurs du plan', (await call('drh', 'GET', `/stages/${sid}/encadrants-possibles`)).body.some((x) => x.id === ids.agent1));
  expect('un stagiaire comme encadreur', await call('drh', 'POST', `/stages/${sid}/encadrant-principal`, { userId: stg.id }), 400);
  const tEnc = new Date();
  expect('le DRH désigne agent1', await call('drh', 'POST', `/stages/${sid}/encadrant-principal`, { userId: ids.agent1 }), 201);
  check('… encadreur prévenu', (await notifs(ids.agent1, tEnc, 'encadreur principal')) === 1);
  const vueSt = (await call(KS, 'GET', `/stages/${sid}`)).body;
  check('stagiaire : encadreur affiché, dépôt proposé', vueSt.encadrantPrincipal?.id === ids.agent1 && vueSt.rapport.droits.deposer && !vueSt.rapport.droits.valider);
  expect('un tiers dépose', await upload('agent1', `/stages/${sid}/rapport`, {}, fichier), 403);
  expect('dépôt sans fichier', await upload(KS, `/stages/${sid}/rapport`, {}, []), 400);
  const tDep = new Date();
  expect('le stagiaire dépose son rapport', await upload(KS, `/stages/${sid}/rapport`, {}, fichier), 201);
  check('… encadreur prévenu (« Valider le rapport »)', (await notifs(ids.agent1, tDep, 'Rapport de stage à valider')) === 1);
  expect('second dépôt pendant la validation', await upload(KS, `/stages/${sid}/rapport`, {}, fichier), 409);
  for (const k of ['drh', 'chefssr', 'dn', KS]) expect(`${k} valide le rapport`, await call(k, 'POST', `/stages/${sid}/rapport/valider`), 403);
  expect('le DN ne télécharge pas le rapport', await call('dn', 'GET', `/stages/${sid}/rapport`), 403);
  for (const k of ['drh', 'agent1', KS]) expect(`${k} télécharge le rapport`, await call(k, 'GET', `/stages/${sid}/rapport`), 200);
  expect('renvoi sans motif', await call('agent1', 'POST', `/stages/${sid}/rapport/renvoyer`, { motif: '' }), 400);
  expect('l’encadreur demande une reprise', await call('agent1', 'POST', `/stages/${sid}/rapport/renvoyer`, { motif: 'Compléter la partie méthodologie' }), 201);
  const aReprendre = (await call(KS, 'GET', `/stages/${sid}`)).body.rapport;
  check('stagiaire : « à reprendre », motif visible, nouveau dépôt possible', aReprendre.statut === 'A_REPRENDRE' && /méthodologie/.test(aReprendre.motif) && aReprendre.droits.deposer);
  expect('nouvelle version déposée', await upload(KS, `/stages/${sid}/rapport`, {}, fichier), 201);
  const tVal = new Date();
  expect('l’encadreur valide', await call('agent1', 'POST', `/stages/${sid}/rapport/valider`), 201);
  check('… stagiaire et DRH prévenus', (await notifs(stg.id, tVal, 'Rapport de stage validé')) === 1 && (await notifs(ids.drh, tVal, 'Rapport de stage validé')) >= 1);
  expect('validation rejouée', await call('agent1', 'POST', `/stages/${sid}/rapport/valider`), 409);
  expect('changer d’encadreur après validation', await call('drh', 'POST', `/stages/${sid}/encadrant-principal`, { userId: ids.chefssr }), 409);
  const vueDn = (await call('dn', 'GET', `/stages/${sid}`)).body;
  check('DN : statut du rapport visible, fichier et motif non', vueDn.rapport.statut === 'VALIDE' && vueDn.rapport.fichier === null && !vueDn.rapport.droits.telecharger);
  await call('drh', 'POST', `/stages/${sid}/interrompre`, { motif: 'Fin du test N3' });

  await app.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
