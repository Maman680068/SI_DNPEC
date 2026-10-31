// S8 — Organisation (api/v1/organisation) : vue des trois onglets calculée par l'API — DN, DNA, chargés d'études
// auprès du DN, cellules rattachées au DN (CTSCM, CNC) ou à la DNA (SAF, RH, CSID), nature (CNC = instance,
// membres d'autres institutions), divisions et sections (chef, agents, état, sans section, jauge des chefs),
// en congé aujourd'hui (nombre seul), rôles tenus par les agents d'une cellule ; rattachement modifiable par
// l'administrateur et le DRH (audité) ; tout le monde consulte, hors stagiaires.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const URL = '/api/v1/organisation';
const J = 864e5;

(async () => {
  console.log('— Accès et droits');
  check('sans session : 401', (await fetch(BASE + URL)).status === 401);
  const stg = (await call('admin', 'POST', '/users', { email: `orst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `OrgStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  void stg;
  expect('stagiaire : refusé', await call(`orst${S}`, 'GET', URL), 403);
  const droits = async (k) => (await call(k, 'GET', URL)).body.droits;
  check('agent : lecture seule', JSON.stringify(await droits('agent1')) === JSON.stringify({ structure: false, designerChef: false, rattachement: false }));
  check('DRH : rattachement seulement', JSON.stringify(await droits('drh')) === JSON.stringify({ structure: false, designerChef: false, rattachement: true }));
  check('administrateur : structure, chefs, rattachement', JSON.stringify(await droits('admin')) === JSON.stringify({ structure: true, designerChef: true, rattachement: true }));

  console.log('— Jeu : agent sans section, agent auprès du DN, congé du jour, rôle logistique');
  const sansSection = (await call('admin', 'POST', '/users', { email: `orss${S}@test.local`, password: 'Password123!', firstName: 'Ibrahima', lastName: `SansSection${S}`, role: 'AGENT', divisionId: ids.DPE })).body;
  const aupres = (await call('admin', 'POST', '/users', { email: `ordn${S}@test.local`, password: 'Password123!', firstName: 'Kadiatou', lastName: `AupresDN${S}`, role: 'AGENT' })).body;
  const type = (await prisma.leaveType.findFirst()) ?? (await prisma.leaveType.create({ data: { code: 'CONGE_ANNUEL', name: 'Congé annuel' } }));
  const auj = new Date(); auj.setUTCHours(0, 0, 0, 0);
  const conge = await prisma.leaveRequest.create({ data: { userId: ids.agent2, leaveTypeId: type.id, startDate: new Date(auj.getTime() - J), endDate: new Date(auj.getTime() + J), daysCount: 3, status: 'APPROUVEE', reason: `Motif ${S}` } });
  const hLog = (await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf })).body;

  const v = (await call('agent1', 'GET', URL)).body;
  const cel = (code) => v.cellules.find((c) => c.code === code);
  check('rattachement initial : CTSCM et CNC au DN ; SAF, RH, CSID à la DNA', cel('CTSCM').rattachement === 'DN' && cel('CNC').rattachement === 'DN' && ['SAF', 'RH', 'CSID'].every((c) => cel(c).rattachement === 'DNA'));
  check('nature : CNC instance, SAF service, CSID cellule', cel('CNC').nature === 'INSTANCE' && cel('CNC').libelleNature === 'Instance' && cel('SAF').libelleNature === 'Service' && cel('CSID').nature === 'CELLULE');
  check('CNC sans agent : « membres d’autres institutions » (pas « 0 agent »)', cel('CNC').agents > 0 || cel('CNC').membresExternes === true);
  check('rôles tenus calculés : « Logistique » au SAF, « Administration du SI » à la CSID', cel('SAF').roles.includes('Logistique') && cel('CSID').roles.includes('Administration du SI'));
  check('DN et DNA en tête, chargés d’études auprès du DN calculés', v.direction.dn?.id === ids.dn && v.direction.dna?.id === ids.dna && v.direction.chargesAupresDn.some((p) => p.id === aupres.id));
  const dpe = v.divisions.find((d) => d.id === ids.DPE);
  const ssr = dpe.sections.find((s) => s.id === ids.SSR);
  check('DPE : chef de division, section SSR complète avec son chef', dpe.chef?.id === ids.chefdpe && ssr.chef?.id === ids.chefssr && ssr.etat === 'COMPLETE');
  check('DPE : agent sans section signalé', dpe.agentsSansSection.some((a) => a.id === sansSection.id));
  check('DPE : en congé aujourd’hui (nombre seul, sans motif)', dpe.enConge >= 1 && !JSON.stringify(v).includes(`Motif ${S}`));
  check('jauge des chefs : désignés ≤ postes (1 + sections actives)', dpe.postesChef === 1 + dpe.sections.filter((s) => s.actif).length && dpe.chefsDesignes <= dpe.postesChef && dpe.chefsDesignes === (dpe.chef ? 1 : 0) + dpe.sections.filter((s) => s.actif && s.chef).length);
  check('chiffres : unités sans responsable', Number.isInteger(v.chiffres.sansResponsable) && v.chiffres.sansResponsable >= 0);

  console.log('— Rattachement d’une cellule (administrateur et DRH)');
  const ctscm = cel('CTSCM');
  expect('agent : modification refusée', await call('agent1', 'PATCH', `${URL}/cellules/${ctscm.id}`, { rattachement: 'DNA' }), 403);
  expect('DN : modification refusée (droits inchangés)', await call('dn', 'PATCH', `${URL}/cellules/${ctscm.id}`, { rattachement: 'DNA' }), 403);
  expect('valeur inconnue : 400', await call('drh', 'PATCH', `${URL}/cellules/${ctscm.id}`, { rattachement: 'DG' }), 400);
  const m = await call('drh', 'PATCH', `${URL}/cellules/${ctscm.id}`, { rattachement: 'DNA' });
  expect('DRH : CTSCM rattachée à la DNA', m, 200);
  check('… vue à jour, modification auditée', m.body.cellules.find((c) => c.id === ctscm.id).rattachement === 'DNA' && (await prisma.auditLog.count({ where: { entityType: 'Cellule', entityId: ctscm.id, metadata: { path: ['event'], equals: 'rattachement' } } })) >= 1);
  expect('administrateur : remise au DN', await call('admin', 'PATCH', `${URL}/cellules/${ctscm.id}`, { rattachement: 'DN' }), 200);

  await prisma.leaveRequest.delete({ where: { id: conge.id } });
  if (hLog?.id) await call('admin', 'POST', `/logistique/habilitations/${hLog.id}/revoquer`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
