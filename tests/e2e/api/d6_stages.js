// D6 — rotation des stagiaires : droits (403), conflits (409), capacité (y compris concurrence),
// tuteurs possibles = acceptés (force brute), job de rotation (dates simulées, idempotence),
// évaluations (formats, visa, visibilité), liste = stages lisibles, changement de rôle.
const E = require('../config');
require('reflect-metadata');
const { call, ids, check, expect, bilan } = require('../lib');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
// Stage loin dans le futur : le job réel (tous les jours à 0 h 05) ne le touche pas pendant le test.
const BASE = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 2, 2) + Math.floor(Math.random() * 200) * J);
const d = (n) => new Date(BASE.getTime() + n * J).toISOString().slice(0, 10);
const at = (n, h = 1) => new Date(BASE.getTime() + n * J + h * 3600e3);

async function stagiaire(n) {
  const r = await call('admin', 'POST', '/users', { email: `d6${S}${n}@test.local`, password: 'Password123!', firstName: n.toUpperCase(), lastName: `Stagiaire${S}`, role: 'STAGIAIRE' });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  ids[`d6${S}${n}`] = r.body.id;
  return r.body.id;
}
const P = (stageId, p = '') => `/stages/${stageId}${p}`;

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const job = app.get(require(D + '/stages/stages-rotation.service').StagesRotationService);
  // Isolement : stages ouverts laissés par une exécution précédente interrompus, capacités retirées.
  for (const o of await prisma.stage.findMany({ where: { statut: { in: ['PREVU', 'EN_COURS'] } }, select: { id: true } })) await call('drh', 'POST', `/stages/${o.id}/interrompre`, { motif: 'Nettoyage avant test' });
  for (const c of await prisma.capaciteAccueil.findMany()) await call('drh', 'PUT', '/stages/capacites', { uniteKey: c.uniteKey, maximum: null });
  const st = await stagiaire('a');
  const st2 = await stagiaire('b');
  const KA = `d6${S}a`, KB = `d6${S}b`;
  // Division sans chef (responsable de repli : DN/DNA).
  const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
  const div = (await call('admin', 'POST', '/org/divisions', { code: `ST${L}`, name: `Division sans chef ${S}` })).body;

  console.log('— Dossier de stage (DRH seul)');
  const corps = { stagiaireId: st, etablissement: 'Université Gamal Abdel Nasser de Conakry', diplomePrepare: 'Master Économie', dateDebut: d(0), dateFin: d(60) };
  for (const k of ['dn', 'chefdpe', 'admin', 'agent1', KA]) expect(`${k} crée un stage`, await call(k, 'POST', '/stages', corps), 403);
  expect('stage pour un compte qui n’est pas stagiaire', await call('drh', 'POST', '/stages', { ...corps, stagiaireId: ids.agent1 }), 409);
  expect('dates inversées', await call('drh', 'POST', '/stages', { ...corps, dateDebut: d(10), dateFin: d(5) }), 400);
  const s1 = await call('drh', 'POST', '/stages', corps);
  expect('le DRH crée le stage', s1, 201);
  const sid = s1.body.id;
  expect('second stage ouvert pour le même stagiaire', await call('drh', 'POST', '/stages', corps), 409);
  check('droits DRH : modifier, ajouter une période, interrompre', s1.body.droits.ajouterPeriode && s1.body.droits.interrompre && s1.body.vue === 'DRH');

  console.log('— Plan de rotation');
  const per = (body) => call('drh', 'POST', P(sid, '/periodes'), body);
  const p1r = await per({ divisionId: ids.DPE, sectionId: ids.SSR, dateDebut: d(0), dateFin: d(13), formatEvaluation: 'GRILLE', objectifs: 'Note de conjoncture' });
  expect('période 1 : section SSR, grille', p1r, 201);
  expect('période 2 : cellule SAF, texte', await per({ celluleId: ids.SAF, dateDebut: d(14), dateFin: d(27), formatEvaluation: 'TEXTE' }), 201);
  expect('période 3 : division sans chef, sans évaluation', await per({ divisionId: div.id, dateDebut: d(28), dateFin: d(40), formatEvaluation: 'AUCUNE' }), 201);
  expect('période qui chevauche la période 1', await per({ divisionId: ids.DEE, dateDebut: d(10), dateFin: d(15), formatEvaluation: 'TEXTE' }), 409);
  expect('période hors des dates du stage', await per({ divisionId: ids.DEE, dateDebut: d(55), dateFin: d(70), formatEvaluation: 'TEXTE' }), 409);
  expect('division et cellule à la fois', await per({ divisionId: ids.DEE, celluleId: ids.SAF, dateDebut: d(41), dateFin: d(45), formatEvaluation: 'TEXTE' }), 400);
  expect('section sans division', await per({ sectionId: ids.SSR, dateDebut: d(41), dateFin: d(45), formatEvaluation: 'TEXTE' }), 400);
  const cnc = await prisma.cellule.findUnique({ where: { code: 'CNC' } });
  await call('admin', 'POST', `/org/cellules/${cnc.id}/suspend`);
  expect('unité suspendue', await per({ celluleId: cnc.id, dateDebut: d(41), dateFin: d(45), formatEvaluation: 'TEXTE' }), 409);
  await call('admin', 'POST', `/org/cellules/${cnc.id}/reactivate`);
  expect('le chef de section ajoute une période', await call('chefssr', 'POST', P(sid, '/periodes'), { divisionId: ids.DEE, dateDebut: d(41), dateFin: d(45), formatEvaluation: 'TEXTE' }), 403);
  let plan = (await call('drh', 'GET', P(sid))).body;
  const [p1, p2, p3] = plan.periodes;
  check('ordre recalculé par date, 3 périodes proposées', plan.periodes.map((p) => p.ordre).join() === '1,2,3' && plan.periodes.every((p) => p.statut === 'PROPOSEE'));
  check('responsable SSR = chef de section ; division sans chef = DN et DNA', p1.responsables.map((r) => r.id).join() === ids.chefssr && p3.responsables.length === 2 && p3.responsables.every((r) => [ids.dn, ids.dna].includes(r.id)));
  check('notification « à accepter » au chef de section', (await prisma.notification.count({ where: { userId: ids.chefssr, type: 'STAGE_PERIODE_A_ACCEPTER', link: `/stages/${sid}`, channel: 'IN_APP' } })) === 1);

  console.log('— Capacité d’accueil (DRH, bloquante)');
  const st2s = (await call('drh', 'POST', '/stages', { stagiaireId: st2, etablissement: 'ISSEG', dateDebut: d(0), dateFin: d(60) })).body.id;
  for (const k of ['dn', 'chefssr', KA]) expect(`${k} fixe une capacité`, await call(k, 'PUT', '/stages/capacites', { uniteKey: `SEC:${ids.SSR}`, maximum: 1 }), 403);
  expect('unité inconnue', await call('drh', 'PUT', '/stages/capacites', { uniteKey: 'SEC:inconnue', maximum: 1 }), 404);
  expect('SSR : 1 stagiaire au plus', await call('drh', 'PUT', '/stages/capacites', { uniteKey: `SEC:${ids.SSR}`, maximum: 1 }), 200);
  const c409 = await call('drh', 'POST', P(st2s, '/periodes'), { divisionId: ids.DPE, sectionId: ids.SSR, dateDebut: d(5), dateFin: d(20), formatEvaluation: 'TEXTE' });
  check('SSR pleine sur la période : 409 avec le nom de l’unité', c409.status === 409 && /Capacité d’accueil atteinte/.test(c409.body.message), `${c409.status} ${c409.body.message}`);
  expect('SSR après la période du premier stagiaire', await call('drh', 'POST', P(st2s, '/periodes'), { divisionId: ids.DPE, sectionId: ids.SSR, dateDebut: d(14), dateFin: d(20), formatEvaluation: 'TEXTE' }), 201);
  await call('drh', 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DPE}`, maximum: 1 });
  const cdiv = await call('drh', 'POST', P(st2s, '/periodes'), { divisionId: ids.DPE, sectionId: ids.SFP, dateDebut: d(0), dateFin: d(5), formatEvaluation: 'TEXTE' });
  check('division DPE pleine (période 1 en SSR) : une section voisine est refusée', cdiv.status === 409, `${cdiv.status} ${cdiv.body.message}`);
  const st2p = (await call('drh', 'GET', P(st2s))).body.periodes[0];
  const dep = await call('drh', 'PATCH', P(sid, `/periodes/${p1.id}`), { dateFin: d(15) });
  check('déplacer la période 1 sur celle du second stagiaire (DPE pleine) : 409', dep.status === 409, `${dep.status} ${dep.body.message}`);
  await call('drh', 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DPE}`, maximum: null });
  await call('drh', 'PUT', '/stages/capacites', { uniteKey: `SEC:${ids.SSR}`, maximum: null });
  // Concurrence : capacité 1 sur la cellule SE, deux créations simultanées.
  const x1 = await stagiaire('c'), x2 = await stagiaire('e');
  const sx1 = (await call('drh', 'POST', '/stages', { stagiaireId: x1, etablissement: 'ENAM', dateDebut: d(0), dateFin: d(30) })).body.id;
  const sx2 = (await call('drh', 'POST', '/stages', { stagiaireId: x2, etablissement: 'ENAM', dateDebut: d(0), dateFin: d(30) })).body.id;
  await call('drh', 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DEE}`, maximum: 1 });
  const simult = await Promise.all([sx1, sx2].map((s) => call('drh', 'POST', P(s, '/periodes'), { divisionId: ids.DEE, dateDebut: d(1), dateFin: d(9), formatEvaluation: 'TEXTE' })));
  check('deux créations simultanées sur une capacité de 1 : une 201, une 409', simult.map((r) => r.status).sort().join() === '201,409', simult.map((r) => r.status).join());
  await call('drh', 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DEE}`, maximum: null });
  const planning = await call('drh', 'GET', `/stages/planning?debut=${d(0)}&fin=${d(60)}`);
  check('planning (DRH) : périodes et unités', planning.status === 200 && planning.body.periodes.some((p) => p.id === p1.id && p.stagiaire.id === st));
  expect('planning refusé à un chef', await call('chefssr', 'GET', '/stages/planning'), 403);

  console.log('— Acceptation, tuteur (force brute), refus');
  expect('chef de division (pas le responsable : SSR a son chef) accepte', await call('chefdpe', 'POST', P(sid, `/periodes/${p1.id}/accepter`), { tuteurId: ids.agent1 }), 403);
  expect('DN accepte une période d’une unité qui a son chef', await call('dn', 'POST', P(sid, `/periodes/${p1.id}/accepter`), { tuteurId: ids.agent1 }), 403);
  expect('tuteur hors de l’unité (agentdee)', await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/accepter`), { tuteurId: ids.agentdee }), 403);
  expect('le stagiaire comme tuteur', await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/accepter`), { tuteurId: st }), 403);
  expect('le chef de section accepte (tuteur agent1)', await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/accepter`), { tuteurId: ids.agent1 }), 201);
  expect('accepter deux fois', await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/accepter`), { tuteurId: ids.agent1 }), 409);
  const proposes = (await call('chefssr', 'GET', P(sid, `/periodes/${p1.id}/tuteurs-possibles`))).body.map((u) => u.id).sort();
  const tous = await prisma.user.findMany({ select: { id: true } });
  const acceptes = [];
  for (const u of tous) { const r = await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/tuteur`), { tuteurId: u.id }); if (r.status === 201) acceptes.push(u.id); else if (r.status !== 403) check(`tuteur ${u.id} : refus inattendu`, false, `${r.status}`); }
  check(`tuteurs : ${proposes.length} proposés = ${acceptes.length} acceptés sur ${tous.length} comptes`, JSON.stringify(proposes) === JSON.stringify(acceptes.sort()));
  await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/tuteur`), { tuteurId: ids.agent1 });
  expect('refus sans motif', await call('chefsaf', 'POST', P(sid, `/periodes/${p2.id}/refuser`), {}), 400);
  expect('le chef de SAF refuse (motif)', await call('chefsaf', 'POST', P(sid, `/periodes/${p2.id}/refuser`), { motif: 'Cellule en clôture budgétaire ce mois-ci' }), 201);
  check('le DRH est notifié du refus', (await prisma.notification.count({ where: { userId: ids.drh, type: 'STAGE_PERIODE_REFUSEE', link: `/stages/${sid}`, channel: 'IN_APP' } })) >= 1);
  expect('le DRH déplace la période refusée (elle redevient proposée)', await call('drh', 'PATCH', P(sid, `/periodes/${p2.id}`), { dateDebut: d(16), dateFin: d(27) }), 200);
  check('période 2 : de nouveau proposée', (await call('drh', 'GET', P(sid))).body.periodes[1].statut === 'PROPOSEE');
  expect('le chef de SAF accepte en se désignant tuteur', await call('chefsaf', 'POST', P(sid, `/periodes/${p2.id}/accepter`), { tuteurId: ids.chefsaf }), 201);
  expect('le DN accepte la période de la division sans chef (tuteur : lui-même)', await call('dn', 'POST', P(sid, `/periodes/${p3.id}/accepter`), { tuteurId: ids.dn }), 201);

  console.log('— Formats d’évaluation');
  expect('le tuteur passe la période 1 en texte libre', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/format`), { formatEvaluation: 'TEXTE' }), 201);
  expect('… puis revient à la grille', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/format`), { formatEvaluation: 'GRILLE' }), 201);
  expect('un autre agent change le format', await call('agent2', 'POST', P(sid, `/periodes/${p1.id}/format`), { formatEvaluation: 'TEXTE' }), 403);
  expect('rédiger avant le début de la période', await call('agent1', 'PUT', P(sid, `/periodes/${p1.id}/evaluation`), { appreciation: 'Trop tôt' }), 409);

  console.log('— Job de rotation (dates simulées)');
  const avant = await prisma.user.findUnique({ where: { id: st } });
  let b = await job.executer(at(-3));
  check('J-3 : « période à venir » (stagiaire, tuteur, chef)', (await prisma.notification.count({ where: { userId: { in: [st, ids.agent1, ids.chefssr] }, type: 'STAGE_PERIODE_A_VENIR', link: `/stages/${sid}`, channel: 'IN_APP' } })) === 3);
  b = await job.executer(at(0));
  const apres = await prisma.user.findUnique({ where: { id: st } });
  check('J0 : rattachement du stagiaire = DPE / SSR', !avant.divisionId && apres.divisionId === ids.DPE && apres.sectionId === ids.SSR);
  plan = (await call('drh', 'GET', P(sid))).body;
  check('J0 : période 1 en cours, stage en cours', plan.periodes[0].statut === 'EN_COURS' && plan.statut === 'EN_COURS');
  const evts = await prisma.personnelCareerEvent.findMany({ where: { userId: st, eventType: 'AFFECTATION' } });
  check('historique de carrière : affectation enregistrée', evts.length === 1 && /SSR|Section|Division/.test(evts[0].toValue));
  await job.executer(at(0, 5));
  check('idempotence : second passage sans effet', (await prisma.personnelCareerEvent.count({ where: { userId: st, eventType: 'AFFECTATION' } })) === 1);
  check('le stagiaire voit son stage dans sa liste', (await call(KA, 'GET', '/stages')).body.stages.some((s) => s.id === sid));

  console.log('— Évaluation (grille, visa, visibilité)');
  expect('critère inconnu', await call('agent1', 'PUT', P(sid, `/periodes/${p1.id}/evaluation`), { criteres: { ponctualite: 'SATISFAISANT' } }), 400);
  expect('brouillon partiel', await call('agent1', 'PUT', P(sid, `/periodes/${p1.id}/evaluation`), { criteres: { assiduite: 'TRES_SATISFAISANT', qualite: 'SATISFAISANT' } }), 200);
  expect('le format ne change plus une fois l’évaluation commencée', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/format`), { formatEvaluation: 'TEXTE' }), 409);
  expect('soumettre une grille incomplète', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/evaluation/soumettre`)), 400);
  expect('grille complète + appréciation', await call('agent1', 'PUT', P(sid, `/periodes/${p1.id}/evaluation`), { criteres: { assiduite: 'TRES_SATISFAISANT', qualite: 'SATISFAISANT', autonomie: 'SATISFAISANT', integration: 'TRES_SATISFAISANT' }, appreciation: `Travail sérieux ${S}` }), 200);
  const ev = (k) => call(k, 'GET', P(sid)).then((r) => r.body.periodes && r.body.periodes[0].evaluation);
  check('brouillon : invisible du stagiaire, du chef et du DRH', !(await ev(KA)) && !(await ev('chefssr')) && !(await ev('drh')) && !!(await ev('agent1')));
  expect('le tuteur soumet', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/evaluation/soumettre`)), 201);
  check('soumise : visible du chef et du DRH, pas du stagiaire ni du DN', !!(await ev('chefssr')) && !!(await ev('drh')) && !(await ev(KA)) && !(await ev('dn')));
  expect('le tuteur vise', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/evaluation/viser`)), 403);
  expect('le chef de division vise (le chef de section existe)', await call('chefdpe', 'POST', P(sid, `/periodes/${p1.id}/evaluation/viser`)), 403);
  expect('le chef de section renvoie (motif)', await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/evaluation/renvoyer`), { motif: 'Préciser l’autonomie' }), 201);
  expect('le tuteur corrige et soumet de nouveau', await call('agent1', 'POST', P(sid, `/periodes/${p1.id}/evaluation/soumettre`)), 201);
  expect('le chef de section vise', await call('chefssr', 'POST', P(sid, `/periodes/${p1.id}/evaluation/viser`)), 201);
  const vue = await ev(KA);
  check('visée : visible du stagiaire avec la grille et l’appréciation', vue && vue.statut === 'VISEE' && vue.criteres.autonomie === 'SATISFAISANT' && vue.appreciation.includes(S));
  check('visée : visible du DN', !!(await ev('dn')));
  expect('modifier une évaluation visée', await call('agent1', 'PUT', P(sid, `/periodes/${p1.id}/evaluation`), { appreciation: 'x' }), 409);

  console.log('— Période suivante : tuteur = chef (jamais de visa de sa propre évaluation)');
  b = await job.executer(at(14));
  check('J14 : période 1 terminée', (await call('drh', 'GET', P(sid))).body.periodes[0].statut === 'TERMINEE');
  b = await job.executer(at(16));
  const s16 = await prisma.user.findUnique({ where: { id: st } });
  check('J16 : rattachement = cellule SAF', s16.celluleId === ids.SAF && !s16.divisionId);
  expect('chef de SAF (tuteur) rédige en texte libre', await call('chefsaf', 'PUT', P(sid, `/periodes/${p2.id}/evaluation`), { appreciation: `Très bonne intégration ${S}` }), 200);
  expect('… et soumet', await call('chefsaf', 'POST', P(sid, `/periodes/${p2.id}/evaluation/soumettre`)), 201);
  expect('chef de SAF vise sa propre évaluation', await call('chefsaf', 'POST', P(sid, `/periodes/${p2.id}/evaluation/viser`)), 403);
  expect('la DNA vise (niveau supérieur)', await call('dna', 'POST', P(sid, `/periodes/${p2.id}/evaluation/viser`)), 201);
  expect('période sans évaluation : rédiger', await call('dn', 'PUT', P(sid, `/periodes/${p3.id}/evaluation`), { appreciation: 'x' }), 409);

  console.log('— Relances et alertes du job');
  const st2periode = (await call('drh', 'GET', P(st2s))).body.periodes.find((p) => p.statut === 'PROPOSEE');
  b = await job.executer(at(14, 6));
  check('période non acceptée à sa date : alerte au DRH', (await prisma.notification.count({ where: { userId: ids.drh, type: 'STAGE_ALERTE', link: `/stages/${st2s}`, channel: 'IN_APP' } })) >= 1 && !!st2periode);
  check('le second stagiaire reste sans unité', !(await prisma.user.findUnique({ where: { id: st2 } })).divisionId);

  console.log('— Visibilité : liste = stages lisibles (force brute)');
  const tousStages = await prisma.stage.findMany({ select: { id: true } });
  for (const k of ['dn', 'dna', 'drh', 'chefssr', 'chefdpe', 'chefsaf', 'chefdee', 'agent1', 'agent2', 'admin', KA, KB]) {
    const liste = new Set((await call(k, 'GET', '/stages')).body.stages.map((s) => s.id));
    const lisibles = new Set();
    for (const s of tousStages) if ((await call(k, 'GET', P(s.id))).status === 200) lisibles.add(s.id);
    check(`${k} : ${liste.size} listés = ${lisibles.size} lisibles`, liste.size === lisibles.size && [...liste].every((x) => lisibles.has(x)));
  }
  check('chef de division : lit le plan (période en SSR) sans pouvoir décider', (await call('chefdpe', 'GET', P(sid))).body.periodes[0].droits.accepter === false);
  expect('un autre stagiaire lit ce stage', await call(KB, 'GET', P(sid)), 404);
  expect('le chef de la DEE (hors plan) lit ce stage', await call('chefdee', 'GET', P(sid)), 404);
  expect('le stagiaire modifie son stage', await call(KA, 'PATCH', P(sid), { etablissement: 'Autre' }), 403);

  console.log('— Changement de rôle, clôture, interruption');
  expect('changer le rôle d’un stagiaire en stage', await call('admin', 'POST', `/users/${st}/role`, { role: 'AGENT', roleAttendu: 'STAGIAIRE', celluleId: ids.SAF, motif: 'Recrutement anticipé' }), 409);
  expect('clôturer avec une période non terminée', await call('drh', 'POST', P(sid, '/cloturer')), 409);
  expect('interrompre sans motif', await call('drh', 'POST', P(sid, '/interrompre'), {}), 400);
  const it = await call('drh', 'POST', P(sid, '/interrompre'), { motif: 'Fin anticipée demandée par l’université' });
  expect('interrompre (motif)', it, 201);
  check('interrompu : période en cours terminée, période future annulée', it.body.statut === 'INTERROMPU' && it.body.periodes[1].statut === 'TERMINEE' && it.body.periodes[2].statut === 'ANNULEE');
  expect('ajouter une période à un stage interrompu', await call('drh', 'POST', P(sid, '/periodes'), { divisionId: ids.DEE, dateDebut: d(50), dateFin: d(52), formatEvaluation: 'TEXTE' }), 409);
  expect('changement de rôle après interruption', await call('admin', 'POST', `/users/${st}/role`, { role: 'AGENT', roleAttendu: 'STAGIAIRE', celluleId: ids.SAF, motif: 'Recrutement anticipé' }), 201);

  await app.close();
  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
