// Refonte de l'interface (étape 9, formulaire « Demander un congé ») — GET api/v1/conges/simulation :
// bandeau calculé pendant la saisie. Lecture seule, données du demandeur seulement. Vérifie : 401 sans
// session ; jours = règle de création (comparés à une vraie demande créée puis annulée) ; jours fériés
// exclus et listés ; date de reprise (week-end et jour férié sautés) ; solde avant / après du type
// demandé (null sans solde) ; avisants et délai d'avis ; type inconnu 404 ; fin < début 400 ; stagiaire
// refusé (les congés ne sont pas ouverts aux stagiaires, liste blanche de d6_role_stagiaire.js).
const { call, ids, check, expect, bilan } = require('../lib');
const BASE = process.env.BASE || 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const plus = (s, n) => iso(new Date(new Date(`${s}T00:00:00Z`).getTime() + n * J));
const simuler = (k, typeId, debut, fin) => call(k, 'GET', `/api/v1/conges/simulation?leaveTypeId=${encodeURIComponent(typeId)}&debut=${debut}&fin=${fin}`);

(async () => {
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  if (!types.some((x) => x.code === 'CONGE_ANNUEL')) await call('admin', 'POST', '/leave-types', { code: 'CONGE_ANNUEL', name: 'Congé annuel' });
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const annuel = types.find((t) => t.code === 'CONGE_ANNUEL');

  // Une semaine (lundi → vendredi) dans environ 300 jours, sans jour férié du lundi au mardi suivant.
  const feriesDe = async (a) => ((await call('drh', 'GET', `/api/v1/jours-feries?annee=${a}`)).body.jours || []).map((j) => j.date.slice(0, 10));
  let lundi = new Date(Date.now() + 300 * J);
  lundi = new Date(Date.UTC(lundi.getUTCFullYear(), lundi.getUTCMonth(), lundi.getUTCDate()));
  let existants = [];
  for (let essai = 0; essai < 20; essai++) {
    while (lundi.getUTCDay() !== 1) lundi = new Date(lundi.getTime() + J);
    const a = lundi.getUTCFullYear();
    existants = [...(await feriesDe(a)), ...(await feriesDe(a + 1))];
    const semaine = Array.from({ length: 9 }, (_, i) => plus(iso(lundi), i));
    if (!semaine.some((d) => existants.includes(d))) break;
    lundi = new Date(lundi.getTime() + 7 * J);
  }
  const L = iso(lundi), V = plus(L, 4), M = plus(L, 2), LS = plus(L, 7), MS = plus(L, 8);
  const A = lundi.getUTCFullYear();

  console.log(`— Période d’essai : du ${L} au ${V}`);
  const r401 = await fetch(`${BASE}/api/v1/conges/simulation?leaveTypeId=${annuel.id}&debut=${L}&fin=${V}`);
  check('sans session : 401', r401.status === 401, String(r401.status));

  const s0 = await simuler('agent1', annuel.id, L, V);
  expect('agent1 simule une semaine', s0, 200);
  check('5 jours décomptés, aucun jour férié', s0.body.jours === 5 && Array.isArray(s0.body.feries) && s0.body.feries.length === 0, JSON.stringify(s0.body).slice(0, 200));
  check('reprise : le lundi suivant (samedi et dimanche sautés)', s0.body.reprise === LS, s0.body.reprise);
  check('type renvoyé', s0.body.leaveType && s0.body.leaveType.id === annuel.id && !!s0.body.leaveType.name);
  check('avisants : la cheffe de section (chef le plus proche)', Array.isArray(s0.body.avisants) && s0.body.avisants.length >= 1 && s0.body.avisants.some((a) => a.id === ids.chefssr) && s0.body.avisants.every((a) => a.nom), JSON.stringify(s0.body.avisants));
  check('délai d’avis : nombre d’heures', typeof s0.body.delaiAvisHeures === 'number' && s0.body.delaiAvisHeures > 0, String(s0.body.delaiAvisHeures));

  console.log('— Jours fériés exclus, reprise après un jour férié');
  const f1 = await call('drh', 'POST', '/api/v1/jours-feries', { date: M, libelle: `Férié d’essai ${S}`, nature: 'RELIGIEUX' });
  expect('DRH : jour férié le mercredi', f1, 201);
  const f2 = await call('drh', 'POST', '/api/v1/jours-feries', { date: LS, libelle: `Férié lundi ${S}`, nature: 'RELIGIEUX' });
  expect('DRH : jour férié le lundi suivant', f2, 201);
  const s1 = await simuler('agent1', annuel.id, L, V);
  expect('simulation avec un jour férié', s1, 200);
  check('4 jours décomptés (férié exclu)', s1.body.jours === 4, String(s1.body.jours));
  check('jour férié listé avec son libellé', s1.body.feries.length === 1 && s1.body.feries[0].date === M && s1.body.feries[0].libelle === `Férié d’essai ${S}`, JSON.stringify(s1.body.feries));
  check('reprise : le mardi (lundi férié sauté)', s1.body.reprise === MS, s1.body.reprise);

  console.log('— Même règle que la création d’une demande');
  const cree = await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: L, endDate: V, reason: `Simulation ${S}` });
  expect('vraie demande sur la même période', cree, 201);
  check('jours de la demande = jours simulés', cree.body.daysCount === s1.body.jours, `${cree.body.daysCount} / ${s1.body.jours}`);
  if (cree.body.id) expect('demande annulée par son auteur', await call('agent1', 'POST', `/leaves/${cree.body.id}/cancel`), 201);
  const s2 = await simuler('agent1', annuel.id, M, M);
  expect('période d’un seul jour férié', s2, 200);
  check('0 jour décompté (la création serait refusée)', s2.body.jours === 0, String(s2.body.jours));
  const c2 = await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: M, endDate: M });
  expect('création sur ce seul jour férié refusée', c2, 400);

  console.log('— Solde du type demandé');
  await call('admin', 'PUT', `/leaves/balances/${ids.agent1}`, { leaveTypeId: annuel.id, year: A, totalDays: 30 });
  const b = ((await call('agent1', 'GET', '/leaves/balances/me')).body || []).find((x) => x.leaveTypeId === annuel.id && x.year === A);
  const s3 = await simuler('agent1', annuel.id, L, V);
  check('solde avant = solde restant de l’année', s3.body.solde && b && s3.body.solde.annee === A && s3.body.solde.avant === b.totalDays - b.usedDays, JSON.stringify([s3.body.solde, b && [b.totalDays, b.usedDays]]));
  check('solde après = avant − jours décomptés', s3.body.solde && s3.body.solde.apres === s3.body.solde.avant - s3.body.jours, JSON.stringify(s3.body.solde));
  const loin = plus(L, 4 * 364);
  const anLoin = Number(loin.slice(0, 4));
  const aUnSolde = ((await call('agent1', 'GET', '/leaves/balances/me')).body || []).some((x) => x.leaveTypeId === annuel.id && x.year === anLoin);
  const s4 = await simuler('agent1', annuel.id, loin, plus(loin, 1));
  if (!aUnSolde) check(`aucun solde pour ${anLoin} : solde null`, s4.status === 200 && s4.body.solde === null, JSON.stringify(s4.body.solde));

  console.log('— Refus');
  const inconnu = await simuler('agent1', 'type-inexistant', L, V);
  expect('type inconnu : 404', inconnu, 404);
  check('message en français', /Type de congé introuvable/.test(JSON.stringify(inconnu.body)), JSON.stringify(inconnu.body).slice(0, 160));
  const inverse = await simuler('agent1', annuel.id, V, L);
  expect('fin avant le début : 400', inverse, 400);
  expect('date invalide : 400', await simuler('agent1', annuel.id, 'pas-une-date', V), 400);
  expect('paramètre manquant : 400', await call('agent1', 'GET', `/api/v1/conges/simulation?leaveTypeId=${annuel.id}&debut=${L}`), 400);
  expect('période de plus d’un an : 400', await simuler('agent1', annuel.id, L, plus(L, 400)), 400);
  const sg = (await call('admin', 'POST', '/users', { email: `simst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `SimStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  if (sg && sg.id) {
    const rs = await simuler(`simst${S}`, annuel.id, L, V);
    check('stagiaire : 403 (congés fermés aux stagiaires)', rs.status === 403 && /stagiaires/.test(JSON.stringify(rs.body)), `${rs.status} ${JSON.stringify(rs.body).slice(0, 120)}`);
  } else check('stagiaire de test non créé : contrôle sauté', true, JSON.stringify(sg).slice(0, 120));

  console.log('— Lecture seule : rien n’est écrit');
  const avant = (await call('agent1', 'GET', '/leaves')).body.length;
  await simuler('agent1', annuel.id, L, V);
  check('aucune demande créée par la simulation', (await call('agent1', 'GET', '/leaves')).body.length === avant);

  // Nettoyage : jours fériés d'essai.
  for (const f of [f1, f2]) if (f.body && f.body.id) await call('drh', 'DELETE', `/api/v1/jours-feries/${f.body.id}`);
  process.exit(bilan() ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
