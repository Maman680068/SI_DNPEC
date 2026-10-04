// Refonte de l'interface (étape 3, Congés) — GET api/v1/conges/:id/contexte : contexte de la fenêtre
// d'avis ou de décision. Réservé au chef qui donne l'avis, au décideur et au demandeur (403 pour un
// agent tiers, le chef d'une autre division, un chef de la division qui ne donne pas l'avis, le
// stagiaire ; 401 sans session). Contenu limité au besoin d'en connaître : absents du PÉRIMÈTRE du
// lecteur seulement (un absent hors périmètre n'apparaît jamais), type masqué pour qui ne le voit pas,
// jamais de motif ; tâches de l'agent visibles du lecteur ; solde de CONGÉ ANNUEL seul, aucun total
// d'absences maladie.
const { call, ids, check, expect, bilan } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const ctx = (k, id) => call(k, 'GET', `/api/v1/conges/${id}/contexte`);
const nomsAbsents = (b) => (b.absents || []).map((a) => a.userId);

(async () => {
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie']]) if (!types.some((x) => x.code === code)) await call('admin', 'POST', '/leave-types', { code, name });
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const annuel = types.find((t) => t.code === 'CONGE_ANNUEL');
  const maladie = types.find((t) => t.code === 'CONGE_MALADIE');
  const A = new Date(jour(200)).getUTCFullYear();
  await call('admin', 'PUT', `/leaves/balances/${ids.agent1}`, { leaveTypeId: annuel.id, year: A, totalDays: 30 });
  await call('admin', 'PUT', `/leaves/balances/${ids.agent1}`, { leaveTypeId: maladie.id, year: A, totalDays: 10 });
  const aNettoyer = [];
  const demande = async (k, typeId, d, f, reason) => {
    const r = await call(k, 'POST', '/leaves', { leaveTypeId: typeId, startDate: jour(d), endDate: jour(f), ...(reason ? { reason } : {}) });
    if (r.body && r.body.id) aNettoyer.push([k, r.body.id]);
    return r.body;
  };
  const approuver = async (avisant, r) => {
    await call(avisant, 'POST', `/leaves/${r.id}/avis`, { avis: 'FAVORABLE' });
    return call('drh', 'POST', `/leaves/${r.id}/approve`, {});
  };

  console.log('— Jeu de données : une demande d’agent1, des absences approuvées qui la chevauchent');
  const r1 = await demande('agent1', annuel.id, 200, 204, `Voyage ${S}`);
  check('demande d’agent1 créée (avis de la cheffe de section attendu)', r1 && r1.etape === 'AVIS_ATTENDU', JSON.stringify(r1).slice(0, 120));
  const a2 = await demande('agent2', maladie.id, 201, 202, `Secret médical ${S}`);
  expect('absence maladie d’agent2 (même section) approuvée', await approuver('chefssr', a2), 201);
  const ad = await demande('agentdee', annuel.id, 201, 203);
  expect('congé d’un agent d’une autre division approuvé', await approuver('chefse', ad), 201);
  const as = await demande('secdpe', annuel.id, 203, 205);
  expect('congé d’un agent de l’autre section de la division approuvé', await approuver('chefsfp', as), 201);
  const hors = await demande('agent2', annuel.id, 230, 231);
  expect('congé d’agent2 hors de la période approuvé', await approuver('chefssr', hors), 201);
  const t1 = (await call('chefssr', 'POST', '/tasks', { title: `Échéance pendant l’absence ${S}`, dueDate: jour(202), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const t2 = (await call('chefssr', 'POST', '/tasks', { title: `Échéance après l’absence ${S}`, dueDate: jour(220), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const t3 = (await call('chefdpe', 'POST', '/tasks', { title: `Confidentielle division ${S}`, dueDate: jour(203), divisionId: ids.DPE, confidentiality: 'CONFIDENTIEL_DIVISION', assignees: [{ userId: ids.agent1 }] })).body;
  check('tâches créées', !!(t1.id && t2.id && t3.id), JSON.stringify([t1, t2, t3].map((t) => t.id || t.message)));

  console.log('— Accès : 401, 403');
  const r401 = await fetch(`http://localhost:3000/api/v1/conges/${r1.id}/contexte`);
  check('sans session : 401', r401.status === 401);
  expect('agent tiers (même section) : 403', await ctx('agent2', r1.id), 403);
  expect('chef d’une autre division : 403', await ctx('chefdee', r1.id), 403);
  expect('chef de la division qui ne donne pas l’avis (le plus proche est la cheffe de section) : 403', await ctx('chefdpe', r1.id), 403);
  expect('DRH avant l’avis (il ne décide qu’après) : 403', await ctx('drh', r1.id), 403);
  const r403 = await ctx('agent2', r1.id);
  check('erreur api/v1 : enveloppe { code, message, trace_id }', !!(r403.body && r403.body.code && r403.body.message && r403.body.trace_id), JSON.stringify(r403.body).slice(0, 160));
  const sg = (await call('admin', 'POST', '/users', { email: `ctxst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `CtxStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  if (sg && sg.id) expect('stagiaire : 403', await ctx(`ctxst${S}`, r1.id), 403);
  else check('stagiaire de test non créé : contrôle sauté', true, JSON.stringify(sg).slice(0, 120));
  expect('demande inconnue : 404', await ctx('chefssr', 'inconnue'), 404);

  console.log('— Cheffe de section qui donne l’avis');
  const c = await ctx('chefssr', r1.id);
  expect('cheffe de section : 200', c, 200);
  const b = c.body;
  check('chef attendu : la cheffe de section', b.avisants.length === 1 && b.avisants[0].id === ids.chefssr, JSON.stringify(b.avisants));
  check('absents : agent2 (même section, chevauchement)', nomsAbsents(b).includes(ids.agent2));
  check('absents : jamais hors périmètre (autre division)', !nomsAbsents(b).includes(ids.agentdee));
  check('absents : jamais hors périmètre (autre section de la division)', !nomsAbsents(b).includes(ids.secdpe));
  check('absents : jamais le demandeur, ni une absence hors période', !nomsAbsents(b).includes(ids.agent1) && !b.absents.some((a) => a.demandeId === hors.id));
  const absA2 = b.absents.find((a) => a.userId === ids.agent2);
  check('absent : la cheffe, avisante d’agent2, voit le type « Congé maladie » (droits actuels)', absA2 && absA2.type === 'Congé maladie', absA2 && absA2.type);
  check('absent : jamais de motif', !JSON.stringify(b).includes(`Secret médical ${S}`) && !b.absents.some((a) => 'reason' in a || 'motif' in a));
  const tachesIds = b.taches.map((t) => t.id);
  check('tâche à échéance pendant l’absence listée', tachesIds.includes(t1.id));
  check('tâche à échéance après l’absence absente', !tachesIds.includes(t2.id));
  const vues = (await call('chefssr', 'GET', `/tasks?assigneeId=${ids.agent1}&dueAfter=${jour(200)}&dueBefore=${jour(205)}`)).body.map((t) => t.id);
  check('tâches : seulement celles que la cheffe voit (confidentielle de division exclue)', !tachesIds.includes(t3.id) && !vues.includes(t3.id) && tachesIds.every((id) => vues.includes(id)));
  check('solde : congé annuel seul (30 j)', b.soldeAnnuel && b.soldeAnnuel.totalDays === 30 && b.soldeAnnuel.annee === A, JSON.stringify(b.soldeAnnuel));
  const texte = JSON.stringify(b).toLowerCase();
  check('aucun total d’absences maladie dans la réponse', !/maladie/.test(Object.keys(b).join(',').toLowerCase()) && !('soldes' in b) && !texte.includes('"totaldays":10'));
  check('jours fériés de la période : nombre entier', Number.isInteger(b.feriesDansPeriode));

  console.log('— Demandeur : ses propres informations seulement');
  const d = await ctx('agent1', r1.id);
  expect('demandeur : 200', d, 200);
  check('demandeur : chef attendu nommé, ni absents ni tâches', d.body.avisants.length === 1 && d.body.absents === null && d.body.taches === null, JSON.stringify(d.body).slice(0, 200));

  console.log('— DRH qui décide, après l’avis');
  expect('avis favorable de la cheffe de section', await call('chefssr', 'POST', `/leaves/${r1.id}/avis`, { avis: 'FAVORABLE' }), 201);
  expect('cheffe de section après son avis : 403 (plus rien à faire)', await ctx('chefssr', r1.id), 403);
  const h = await ctx('drh', r1.id);
  expect('DRH : 200', h, 200);
  check('DRH : absents de l’unité du demandeur (division), jamais d’une autre division', nomsAbsents(h.body).includes(ids.agent2) && nomsAbsents(h.body).includes(ids.secdpe) && !nomsAbsents(h.body).includes(ids.agentdee), JSON.stringify(h.body.absents.map((a) => a.nom)));
  check('DRH : plus de chef attendu', h.body.avisants.length === 0);
  check('DRH : solde annuel seul', h.body.soldeAnnuel && h.body.soldeAnnuel.totalDays === 30);

  console.log('— Type masqué pour qui ne le voit pas (chef de division, avisant d’une cheffe de section)');
  const rc = await demande('chefssr', annuel.id, 200, 204);
  const k = await ctx('chefdpe', rc.id);
  expect('chef de division, avisant de la cheffe de section : 200', k, 200);
  const absK = k.body.absents.find((a) => a.userId === ids.agent2);
  check('absence maladie d’agent2 vue « Absence — motif protégé » (le chef de division n’est pas son avisant)', absK && absK.type === 'Absence — motif protégé' && !JSON.stringify(k.body).includes('Congé maladie'), absK && absK.type);
  check('chef de division : absents de sa division (autre section comprise), jamais d’une autre division', nomsAbsents(k.body).includes(ids.secdpe) && !nomsAbsents(k.body).includes(ids.agentdee));

  console.log('— Nettoyage');
  for (const [kk, id] of aNettoyer) await call(kk, 'POST', `/leaves/${id}/cancel`);
  for (const t of [t1, t2, t3]) if (t.id) await call(t === t3 ? 'chefdpe' : 'chefssr', 'DELETE', `/tasks/${t.id}`);
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
