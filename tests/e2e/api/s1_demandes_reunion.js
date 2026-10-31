// S1 — Réunions : création directe réservée aux chefs, DN, DNA, assistants de direction et DRH ; le chargé
// d'études DEMANDE (403 s'il crée) ; décision du chef le plus proche (ou de son suppléant en intérim) :
// accepter (date et participants modifiables), refuser (motif obligatoire), transmettre jusqu'au DN / à la
// DNA ; autorisation à usage unique, expirée si la date passe ; sélecteur sans stagiaires.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const h = (jours, heure) => { const d = new Date(Date.now() + jours * J); d.setUTCHours(heure, 0, 0, 0); return d.toISOString(); };
const URL = '/api/v1/demandes-reunion';
const liberer = (titulaires) => prisma.suppleance.updateMany({ where: { titulaireId: { in: titulaires }, revokedAt: null, endDate: { gt: new Date() } }, data: { revokedAt: new Date() } });
const demande = (k, extra = {}) => call(k, 'POST', URL, { objet: `Point ${S} ${Math.random().toString(36).slice(2, 6)}`, explication: 'Faire le point sur les projections.', debut: h(5, 9), fin: h(5, 10), participantIds: [ids.agent2], uniteIds: [], ...extra });

(async () => {
  console.log('— Qui crée directement, qui demande');
  const droits = async (k) => (await call(k, 'GET', '/api/v1/reunions/droits')).body;
  check('chargé d’études : demande, ne crée pas', JSON.stringify(await droits('agent1')) === JSON.stringify({ creerReunion: false, demanderReunion: true }));
  check('administrateur système : demande, ne crée pas', (await droits('admin')).creerReunion === false && (await droits('admin')).demanderReunion === true);
  for (const k of ['chefssr', 'chefdpe', 'chefsaf', 'dn', 'dna', 'assdn', 'drh']) check(`${k} : crée directement`, (await droits(k)).creerReunion === true && (await droits(k)).demanderReunion === false);
  const reunion = (k, extra = {}) => call(k, 'POST', '/meetings', { title: `Réunion directe ${S}`, startAt: h(6, 9), endAt: h(6, 10), participantIds: [], ...extra });
  expect('chargé d’études : création directe refusée', await reunion('agent1'), 403);
  expect('administrateur : création directe refusée', await reunion('admin'), 403);
  for (const k of ['chefssr', 'drh', 'assdn', 'dna']) expect(`${k} : création directe`, await reunion(k), 201);

  console.log('— Sélecteur de participants : unités entières, sans stagiaires');
  const stg = (await call('admin', 'POST', '/users', { email: `drst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `DemStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  const pp = (await call('agent1', 'GET', '/api/v1/reunions/participants-possibles')).body;
  check('aucun stagiaire proposé (ni dans les personnes ni dans les unités)', !pp.personnes.some((p) => p.id === stg.id) && !pp.unites.some((u) => u.membres.includes(stg.id)));
  const uDpe = pp.unites.find((u) => u.code === 'DPE');
  const uSsr = pp.unites.find((u) => u.code === 'SSR');
  check('unité DPE : sous-unités comprises (agent2 de la SSR, chef de division)', !!uDpe && uDpe.membres.includes(ids.agent2) && uDpe.membres.includes(ids.chefdpe) && !!uSsr && uSsr.membres.includes(ids.agent2) && !uSsr.membres.includes(ids.chefdpe));
  expect('stagiaire : sélecteur refusé', await call(`drst${S}`, 'GET', '/api/v1/reunions/participants-possibles'), 403);
  expect('stagiaire : demandes refusées', await call(`drst${S}`, 'GET', URL), 403);
  expect('demande avec un stagiaire parmi les participants', await demande('agent1', { participantIds: [ids.agent2, stg.id] }), 400);
  expect('demande dans le passé', await demande('agent1', { debut: h(-1, 9), fin: h(-1, 10) }), 400);
  expect('chef : ne demande pas (il crée)', await demande('chefssr'), 403);

  console.log('— Demande, transmission jusqu’à la Direction, acceptation avec modification');
  const t0 = new Date();
  const d1 = await demande('agent1', { participantIds: [ids.agent2, ids.chefsfp], uniteIds: [uSsr.id] });
  expect('agent1 demande une réunion', d1, 201);
  check('décideur : son chef le plus proche (chef SSR), état « en attente »', d1.body.etat === 'EN_ATTENTE' && d1.body.decideurs.length === 1 && /CHEFSSR/i.test(d1.body.decideurs[0]), JSON.stringify(d1.body.decideurs));
  check('chef SSR prévenu (lien vers la demande)', (await prisma.notification.count({ where: { userId: ids.chefssr, link: `/reunions?demande=${d1.body.id}`, createdAt: { gte: t0 } } })) >= 1);
  const nav = (await call('chefssr', 'GET', '/api/v1/navigation')).body;
  check('« À traiter » du chef : « Demandes de réunion à décider »', nav.aTraiter.some((a) => a.cle === 'demandes-reunion' && a.nombre >= 1 && a.lien === '/reunions?onglet=demandes'));
  const aDecider = (await call('chefssr', 'GET', URL)).body.aDecider;
  check('chef SSR : la demande dans « à décider », droits accepter / refuser / transmettre', aDecider.some((d) => d.id === d1.body.id && d.droits.accepter && d.droits.refuser && d.droits.transmettre));
  for (const k of ['chefdpe', 'chefsfp', 'agent2', 'dn']) expect(`${k} : décide une demande qui ne lui est pas adressée`, await call(k, 'POST', `${URL}/${d1.body.id}/accepter`, {}), 403);
  expect('refus sans motif', await call('chefssr', 'POST', `${URL}/${d1.body.id}/refuser`, { motif: '' }), 400);
  expect('chef SSR : transmet à son chef', await call('chefssr', 'POST', `${URL}/${d1.body.id}/transmettre`), 200);
  expect('chef SSR : ne décide plus après la transmission', await call('chefssr', 'POST', `${URL}/${d1.body.id}/accepter`, {}), 403);
  const apresSsr = (await call('agent1', 'GET', URL)).body.miennes.find((d) => d.id === d1.body.id);
  check('le demandeur voit où en est sa demande (chez le chef de division)', apresSsr.etat === 'EN_ATTENTE' && /CHEFDPE/i.test(apresSsr.decideurs.join()) && apresSsr.etapes.map((e) => e.action).join() === 'DEMANDEE,TRANSMISE');
  expect('chef de division : transmet à la Direction', await call('chefdpe', 'POST', `${URL}/${d1.body.id}/transmettre`), 200);
  const chezDir = (await call('dn', 'GET', URL)).body.aDecider.find((d) => d.id === d1.body.id);
  check('DN : la demande à décider, sans « transmettre » (la Direction décide en dernier)', !!chezDir && chezDir.droits.accepter && !chezDir.droits.transmettre);
  expect('DN : transmettre refusé', await call('dn', 'POST', `${URL}/${d1.body.id}/transmettre`), 409);
  const acc = await call('dna', 'POST', `${URL}/${d1.body.id}/accepter`, { debut: h(5, 9), fin: h(5, 11), participantIds: [ids.agent2] });
  expect('DNA : accepte en modifiant l’heure de fin et les participants', acc, 200);
  check('… demande acceptée, décidée par la DNA, créneau et participants validés', acc.body.etat === 'ACCEPTEE' && /DNA/i.test(acc.body.decidePar) && acc.body.fin === h(5, 11) && acc.body.participants.map((p) => p.id).join() === ids.agent2);
  expect('DN : décide une demande déjà décidée', await call('dn', 'POST', `${URL}/${d1.body.id}/accepter`, {}), 409);
  check('demandeur prévenu : « Créer la réunion »', (await prisma.notification.count({ where: { userId: ids.agent1, link: `/reunions?demande=${d1.body.id}&creer=1` } })) >= 1);

  console.log('— Créer la réunion : autorisation à usage unique, valeurs validées verrouillées');
  expect('chef SSR : utilise l’autorisation d’un autre', await call('chefssr', 'POST', '/meetings', { title: 'Détournée', startAt: h(5, 9), participantIds: [], demandeReunionId: d1.body.id }), 403);
  const r1 = await call('agent1', 'POST', '/meetings', { title: `Point validé ${S}`, agenda: 'Projections', startAt: h(9, 15), endAt: h(9, 16), participantIds: [ids.chefdpe], demandeReunionId: d1.body.id });
  expect('agent1 crée la réunion de sa demande acceptée', r1, 201);
  check('date, heures et participants : ceux validés (pas ceux envoyés)', r1.body.startAt === h(5, 9) && r1.body.endAt === h(5, 11) && r1.body.participants.map((p) => p.userId).sort().join() === [ids.agent1, ids.agent2].sort().join());
  check('la réunion affiche « Validée par » la DNA', /DNA/i.test(`${r1.body.demandeReunion?.decidePar?.firstName}`));
  expect('seconde utilisation de l’autorisation', await call('agent1', 'POST', '/meetings', { title: `Bis ${S}`, startAt: h(5, 9), participantIds: [], demandeReunionId: d1.body.id }), 409);
  check('demande : « réunion créée », reliée à la réunion', await (async () => { const d = (await call('agent1', 'GET', `${URL}/${d1.body.id}`)).body; return d.etat === 'UTILISEE' && d.reunionId === r1.body.id && d.etapes.at(-1).action === 'REUNION_CREEE'; })());

  console.log('— Refus motivé');
  const d2 = (await demande('agent1')).body;
  expect('chef SSR : refuse avec un motif', await call('chefssr', 'POST', `${URL}/${d2.id}/refuser`, { motif: `Déjà traité en comité ${S}` }), 200);
  const vu2 = (await call('agent1', 'GET', URL)).body.miennes.find((d) => d.id === d2.id);
  check('le demandeur voit le refus et son motif', vu2.etat === 'REFUSEE' && vu2.motifRefus === `Déjà traité en comité ${S}`);
  const n2 = await prisma.notification.findFirst({ where: { userId: ids.agent1, link: `/reunions?demande=${d2.id}` } });
  check('notification du refus sans le texte du motif', !!n2 && !n2.body.includes('comité'));
  expect('réunion sur une demande refusée', await call('agent1', 'POST', '/meetings', { title: 'Refusée', startAt: h(5, 9), participantIds: [], demandeReunionId: d2.id }), 409);

  console.log('— Expiration : la date validée est passée');
  const d3 = (await demande('agent1')).body;
  expect('chef SSR : accepte', await call('chefssr', 'POST', `${URL}/${d3.id}/accepter`, {}), 200);
  await prisma.demandeReunion.update({ where: { id: d3.id }, data: { debut: new Date(Date.now() - J), fin: new Date(Date.now() - J + 3600e3) } });
  check('demande affichée « expirée », sans « Créer la réunion »', await (async () => { const d = (await call('agent1', 'GET', `${URL}/${d3.id}`)).body; return d.etat === 'EXPIREE' && !d.droits.creerReunion; })());
  expect('réunion avec une autorisation expirée', await call('agent1', 'POST', '/meetings', { title: 'Trop tard', startAt: h(5, 9), participantIds: [], demandeReunionId: d3.id }), 409);

  console.log('— Intérim : le suppléant du chef décide');
  await liberer([ids.chefssr]);
  const sup = await call('chefssr', 'POST', '/suppleances', { titulaireId: ids.chefssr, suppleantId: ids.chefsfp, startDate: new Date(Date.now() - 60e3).toISOString(), endDate: new Date(Date.now() + J).toISOString() });
  expect('suppléance chef SSR → chef SFP', sup, 201);
  const d4 = (await demande('agent1')).body;
  expect('chef SFP sans intérim : refusé', await call('chefsfp', 'POST', `${URL}/${d4.id}/accepter`, {}), 403);
  const i4 = await call('chefsfp', 'POST', `${URL}/${d4.id}/accepter`, {}, { 'X-Interim-For': ids.chefssr });
  expect('chef SFP en intérim du chef SSR : accepte', i4, 200);
  check('… décision au nom réel du suppléant, journal « par intérim »', /CHEFSFP/i.test(i4.body.decidePar) && (await prisma.auditLog.count({ where: { entityType: 'DemandeReunion', entityId: d4.id, actorId: ids.chefsfp, onBehalfOfId: ids.chefssr } })) === 1);
  await call('chefssr', 'POST', `/suppleances/${sup.body.id}/revoke`);

  check('chaque étape auditée (demande, transmissions, acceptation)', (await prisma.auditLog.count({ where: { entityType: 'DemandeReunion', entityId: d1.body.id } })) === 4);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
