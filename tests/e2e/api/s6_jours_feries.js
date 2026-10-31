// S6 — jours fériés : prochain férié et chiffres (en semaine / en week-end), propositions de fêtes religieuses
// (lundi de Pâques calculé, autres estimées « à vérifier » ; 2027 sans dates publiées → à saisir), ajout en
// lot, « Préparer l'année suivante » ; un férié ajouté sur un congé déjà approuvé : congés à recalculer
// (détail au DRH, nombre seul à l'administrateur), recalcul congé par congé par le DRH, solde ajusté, audité.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const URL = '/api/v1/jours-feries';
const AN = 2029;

(async () => {
  console.log('— Lecture et droits');
  const ag = (await call('agent1', 'GET', `${URL}?annee=2026`)).body;
  check('agent : lecture seule, aucune proposition, aucun congé à recalculer', !ag.droits.gerer && !ag.droits.recalculer && ag.religieusesProposees.length === 0 && ag.aRecalculer.nombre === 0);
  expect('agent : ajout en lot refusé', await call('agent1', 'POST', `${URL}/lot`, { annee: AN, jours: [{ date: `${AN}-07-04`, libelle: 'Essai', nature: 'RELIGIEUX' }] }), 403);

  console.log('— Fêtes religieuses proposées');
  const r26 = (await call('admin', 'GET', `${URL}?annee=2026`)).body;
  const prop = (r, cle) => r.religieusesProposees.find((f) => f.cle === cle);
  check('2026 : lundi de Pâques calculé (6 avril), sans « à vérifier »', prop(r26, 'LUNDI_PAQUES').date === '2026-04-06' && prop(r26, 'LUNDI_PAQUES').aVerifier === false);
  check('2026 : Korité, Tabaski, Maouloud estimées « à vérifier » (table du code)', prop(r26, 'KORITE').date === '2026-03-20' && prop(r26, 'TABASKI').date === '2026-05-27' && prop(r26, 'LENDEMAIN_TABASKI').date === '2026-05-28' && prop(r26, 'MAOULOUD').date === '2026-08-25' && prop(r26, 'LAILATOUL_QADR').date === '2026-03-17' && prop(r26, 'KORITE').aVerifier);
  const r27 = (await call('admin', 'GET', `${URL}?annee=2027`)).body;
  check('2027 : lundi de Pâques calculé (29 mars) ; dates non publiées laissées vides', prop(r27, 'LUNDI_PAQUES').date === '2027-03-29' && prop(r27, 'KORITE').date === null && prop(r27, 'TABASKI').date === null);

  console.log('— Préparer l’année, chiffres, week-end');
  await prisma.jourFerie.deleteMany({ where: { date: { gte: new Date(`${AN}-01-01`), lt: new Date(`${AN + 1}-01-01`) } } });
  const prep = await call('admin', 'POST', `${URL}/fetes-fixes`, { annee: AN });
  check(`« Préparer ${AN} » : six fêtes fixes`, prep.body.jours.length === 6);
  const c = prep.body;
  const weekEnd = c.jours.filter((j) => [0, 6].includes(new Date(j.date).getUTCDay())).length;
  check(`chiffres : saisis ${c.jours.length}, en week-end ${weekEnd}, en semaine ${c.jours.length - weekEnd}`, c.chiffres.saisis === 6 && c.chiffres.weekEnd === weekEnd && c.chiffres.enSemaine === 6 - weekEnd && c.jours.every((j) => j.weekEnd === [0, 6].includes(new Date(j.date).getUTCDay())));
  check('prochain jour férié et son délai en jours', !!c.prochain && Number.isInteger(c.prochain.dansJours) && c.prochain.dansJours >= 0);
  const lot = await call('admin', 'POST', `${URL}/lot`, { annee: AN, jours: [{ date: `${AN}-04-02`, libelle: 'Lundi de Pâques', nature: 'RELIGIEUX' }, { date: `${AN}-04-25`, libelle: 'Tabaski', nature: 'RELIGIEUX' }] });
  expect('« Vérifier et ajouter » : deux fêtes ajoutées en lot', lot, 201);
  check('… ajoutées, alerte levée', lot.body.ajoutes === 2 && lot.body.calendrier.religieusesSaisies === true);
  check('… jamais en double', (await call('admin', 'POST', `${URL}/lot`, { annee: AN, jours: [{ date: `${AN}-04-25`, libelle: 'Tabaski', nature: 'RELIGIEUX' }] })).body.ajoutes === 0);

  console.log('— Férié ajouté sur un congé approuvé : recalcul par le DRH');
  const type = (await prisma.leaveType.findFirst({ where: { code: 'CONGE_ANNUEL' } })) ?? (await prisma.leaveType.create({ data: { code: 'CONGE_ANNUEL', name: 'Congé annuel' } }));
  const conge = await prisma.leaveRequest.create({ data: { userId: ids.agent2, leaveTypeId: type.id, startDate: new Date(`${AN}-07-02T00:00:00Z`), endDate: new Date(`${AN}-07-06T00:00:00Z`), daysCount: 5, status: 'APPROUVEE' } });
  await prisma.leaveBalance.upsert({ where: { userId_leaveTypeId_year: { userId: ids.agent2, leaveTypeId: type.id, year: AN } }, update: { usedDays: 5, totalDays: 30 }, create: { userId: ids.agent2, leaveTypeId: type.id, year: AN, totalDays: 30, usedDays: 5 } });
  const ajout = await call('admin', 'POST', URL, { date: `${AN}-07-04`, libelle: 'Férié de test', nature: 'FIXE' });
  expect('administrateur : férié ajouté sur la période du congé', ajout, 201);
  check('réponse : un congé à recalculer, sans détail pour l’administrateur', ajout.body.aRecalculer.nombre >= 1 && ajout.body.aRecalculer.conges.length === 0);
  const drh = (await call('drh', 'GET', `${URL}?annee=${AN}`)).body;
  const ligne = drh.aRecalculer.conges.find((x) => x.id === conge.id);
  check('DRH : le congé listé (agent, période, 5 → 4 jours), sans type ni motif', drh.droits.recalculer && !!ligne && ligne.joursEnregistres === 5 && ligne.joursRecalcules === 4 && !('type' in ligne) && !('motif' in ligne));
  expect('administrateur : recalcul refusé (DRH seul)', await call('admin', 'POST', `${URL}/conges/${conge.id}/recalculer`), 403);
  const rc = await call('drh', 'POST', `${URL}/conges/${conge.id}/recalculer`);
  expect('DRH : congé recalculé', rc, 201);
  check('… 5 → 4 jours, solde ajusté d’autant (aucun recalcul automatique avant)', rc.body.joursAvant === 5 && rc.body.joursApres === 4 && (await prisma.leaveRequest.findUnique({ where: { id: conge.id } })).daysCount === 4 && (await prisma.leaveBalance.findFirst({ where: { userId: ids.agent2, leaveTypeId: type.id, year: AN } })).usedDays === 4);
  check('… recalcul audité (avant, après)', (await prisma.auditLog.count({ where: { entityType: 'LeaveRequest', entityId: conge.id, metadata: { path: ['event'], equals: 'recalcul_jours_feries' } } })) === 1);
  expect('second recalcul : déjà à jour', await call('drh', 'POST', `${URL}/conges/${conge.id}/recalculer`), 409);
  check('plus rien à recalculer pour ce congé', !(await call('drh', 'GET', `${URL}?annee=${AN}`)).body.aRecalculer.conges.some((x) => x.id === conge.id));

  await prisma.leaveRequest.delete({ where: { id: conge.id } });
  await prisma.jourFerie.deleteMany({ where: { date: { gte: new Date(`${AN}-01-01`), lt: new Date(`${AN + 1}-01-01`) } } });
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
