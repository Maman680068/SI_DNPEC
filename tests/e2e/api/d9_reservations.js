// D9-2 — réservations : mode immédiat / validation, aucun chevauchement (y compris concurrence et
// SQL direct), PRIORITÉ HIÉRARCHIQUE (cascade, DN/DNA sur tous, jamais entre pairs ni vers le haut ;
// annoncée = acceptée par force brute), notification avec le nom du prioritaire, audit, lien réunions.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const H = 3600e3;
// Journée de test aléatoire, loin dans le futur : aucune collision avec une autre exécution.
const JOUR = Date.UTC(new Date().getUTCFullYear() + 2, 0, 5) + Math.floor(Math.random() * 300) * 864e5;
const t = (h) => new Date(JOUR + h * H).toISOString();
const sqlErreur = async (sql) => { try { await prisma.$executeRawUnsafe(sql); return null; } catch (e) { return String(e.message); } };
const notif = (userId, type, depuis) => prisma.notification.findMany({ where: { userId, type, channel: 'IN_APP', createdAt: { gte: depuis } }, orderBy: { createdAt: 'desc' } });
const reserver = (k, ressourceId, h1, h2, extra = {}) => call(k, 'POST', '/logistique/reservations', { ressourceId, debut: t(h1), fin: t(h2), objet: `Objet ${k} ${S}`, ...extra });
const statut = async (id) => (await prisma.reservation.findUnique({ where: { id } })).statut;

(async () => {
  const t0 = new Date();
  for (const h of await prisma.habilitationLogistique.findMany({ where: { revoqueeAt: null } })) await call('admin', 'POST', `/logistique/habilitations/${h.id}/revoquer`);
  await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf });

  console.log('— Ressources (gestionnaire)');
  expect('un agent ne crée pas de ressource', await call('agent1', 'POST', '/logistique/ressources', { nom: `Salle X ${S}`, type: 'SALLE', mode: 'IMMEDIATE' }), 403);
  const A = (await call('agentsaf', 'POST', '/logistique/ressources', { nom: `Salle A ${S}`, type: 'SALLE', capacite: 20, mode: 'IMMEDIATE' })).body;
  const B = (await call('agentsaf', 'POST', '/logistique/ressources', { nom: `Salle B ${S}`, type: 'SALLE', capacite: 8, mode: 'VALIDATION' })).body;
  const V = (await call('agentsaf', 'POST', '/logistique/ressources', { nom: `Vidéoprojecteur ${S}`, type: 'MATERIEL_PRESENTATION', mode: 'IMMEDIATE' })).body;
  check('3 ressources créées', !!A.id && !!B.id && !!V.id);
  expect('nom déjà utilisé', await call('agentsaf', 'POST', '/logistique/ressources', { nom: `Salle A ${S}`, type: 'SALLE', mode: 'IMMEDIATE' }), 409);

  console.log('— Créneaux invalides');
  expect('fin avant début', await reserver('agent1', A.id, 10, 9), 400);
  expect('plus de 7 jours', await reserver('agent1', A.id, 0, 24 * 8), 400);
  expect('créneau passé', await call('agent1', 'POST', '/logistique/reservations', { ressourceId: A.id, debut: new Date(Date.now() - 3 * H).toISOString(), fin: new Date(Date.now() - H).toISOString(), objet: 'Passé' }), 400);

  console.log('— Mode immédiat, conflits, priorité hiérarchique');
  const r1 = await reserver('agent1', A.id, 9, 11);
  expect('agent1 réserve la salle A (9 h – 11 h)', r1, 201);
  check('confirmée d’emblée', r1.body.statut === 'CONFIRMEE');
  const a2 = await reserver('agent2', A.id, 10, 12);
  expect('agent2 (pair) sur un créneau qui chevauche', a2, 409);
  check('message sans proposition de priorité', !/priorité/.test(a2.body.message));
  expect('agent2 force la priorité sur un pair', await reserver('agent2', A.id, 10, 12, { prioritaire: true }), 403);
  const dispo = async (k, h1, h2) => (await call(k, 'GET', `/logistique/ressources/disponibilite?debut=${t(h1)}&fin=${t(h2)}`)).body.find((r) => r.id === A.id);
  const vA2 = await dispo('agent2', 10, 12), vC = await dispo('chefssr', 10, 12), vX = await dispo('agentdee', 10, 12);
  check('disponibilité (agent2) : occupée, priorité impossible, objet masqué', !vA2.libre && !vA2.prioritePossible && vA2.conflits[0].objet === null);
  check('disponibilité (chef SSR) : priorité possible, objet visible', vC.prioritePossible && vC.conflits[0].objet === `Objet agent1 ${S}`);
  check('disponibilité (agentdee) : titulaire visible, objet masqué', vX.conflits[0].titulaire.lastName && vX.conflits[0].objet === null);
  const c409 = await reserver('chefssr', A.id, 10, 12);
  check('chef SSR sans priorité : 409 qui propose la priorité', c409.status === 409 && /priorité hiérarchique/.test(c409.body.message));
  const r2 = await reserver('chefssr', A.id, 10, 12, { prioritaire: true });
  expect('chef SSR fait valoir sa priorité', r2, 201);
  check('nouvelle réservation confirmée et marquée prioritaire', r2.body.statut === 'CONFIRMEE' && r2.body.prioritaire === true);
  const ev = await prisma.reservation.findUnique({ where: { id: r1.body.id } });
  check('réservation d’agent1 « annulée pour priorité », évincée par le chef SSR', ev.statut === 'ANNULEE_PRIORITE' && ev.evinceeParId === ids.chefssr && ev.remplaceeParId === r2.body.id);
  const n1 = (await notif(ids.agent1, 'RESERVATION_ANNULEE_PRIORITE', t0))[0];
  check('agent1 notifié avec le nom du prioritaire', n1 && /CHEFSSR/.test(n1.body) && /priorité hiérarchique/.test(n1.body), n1 && n1.body);
  check('éviction auditée (titulaire, prioritaire, nouvelle réservation)', !!(await prisma.auditLog.findFirst({ where: { entityId: r1.body.id, actorId: ids.chefssr, metadata: { path: ['event'], equals: 'annulee_priorite' } } })));
  expect('agent1 reprend le créneau du chef (vers le haut)', await reserver('agent1', A.id, 10, 12, { prioritaire: true }), 403);
  expect('chef SFP (pair du chef SSR)', await reserver('chefsfp', A.id, 10, 12, { prioritaire: true }), 403);
  expect('chef de la DEE (autre division)', await reserver('chefdee', A.id, 10, 12, { prioritaire: true }), 403);
  expect('le chef SSR réserve à nouveau son propre créneau', await reserver('chefssr', A.id, 10, 12, { prioritaire: true }), 409);
  const r3 = await reserver('chefdpe', A.id, 10, 12, { prioritaire: true });
  expect('chef de la DPE évince le chef SSR', r3, 201);
  const r4 = await reserver('dna', A.id, 10, 12, { prioritaire: true });
  expect('DNA évince le chef de division', r4, 201);
  console.log('— DN et DNA : pairs pour la priorité, prioritaires sur tous les autres');
  const dnDna = await reserver('dn', A.id, 10, 12, { prioritaire: true });
  check('DN tente de prendre le créneau de la DNA → 403, motif « pairs »', dnDna.status === 403 && /pairs/.test(dnDna.body.message), dnDna.body.message);
  check('DN : priorité annoncée impossible sur la DNA', (await dispo('dn', 10, 12)).prioritePossible === false);
  expect('DN réserve un autre créneau (22 h – 23 h)', await reserver('dn', A.id, 22, 23), 201);
  expect('la DNA tente de prendre le créneau du DN', await reserver('dna', A.id, 22, 23, { prioritaire: true }), 403);
  check('DNA : priorité annoncée impossible sur le DN', (await dispo('dna', 22, 23)).prioritePossible === false);
  for (const [k, titulaire, h1] of [['dn', 'chefdee', 24], ['dn', 'agentdee', 25], ['dna', 'chefse', 26], ['dna', 'agent2', 27]]) {
    await reserver(titulaire, A.id, h1, h1 + 1);
    check(`${k.toUpperCase()} : priorité annoncée possible sur ${titulaire}`, (await dispo(k, h1, h1 + 1)).prioritePossible === true);
    expect(`${k.toUpperCase()} prend le créneau de ${titulaire}`, await reserver(k, A.id, h1, h1 + 1, { prioritaire: true }), 201);
  }

  console.log('— Force brute : priorité annoncée = priorité acceptée (créneau du chef SSR)');
  let h = 13;
  for (const k of ['agent1', 'agent2', 'chefsfp', 'chefdpe', 'chefdee', 'chefse', 'chefsaf', 'agentsaf', 'admin', 'drh', 'assdn', 'secdg', 'dna', 'dn']) {
    await reserver('chefssr', V.id, h, h + 1);
    const d = (await call(k, 'GET', `/logistique/ressources/disponibilite?debut=${t(h)}&fin=${t(h + 1)}&type=MATERIEL_PRESENTATION`)).body.find((r) => r.id === V.id);
    const r = await reserver(k, V.id, h, h + 1, { prioritaire: true });
    check(`${k} : priorité annoncée ${d.prioritePossible ? 'possible' : 'impossible'} → ${r.status}`, (d.prioritePossible && r.status === 201) || (!d.prioritePossible && r.status === 403));
    h += 1;
  }

  console.log('— Mode validation (salle B)');
  const b1 = await reserver('agent1', B.id, 9, 10);
  check('en attente du gestionnaire', b1.status === 201 && b1.body.statut === 'EN_ATTENTE');
  check('gestionnaire notifié', (await notif(ids.agentsaf, 'RESERVATION_A_VALIDER', t0)).length === 1);
  expect('le créneau en attente est tenu', await reserver('agent2', B.id, 9, 10), 409);
  check('file « à valider » du gestionnaire', (await call('agentsaf', 'GET', '/logistique/reservations?vue=a_valider')).body.some((r) => r.id === b1.body.id));
  expect('un agent ne valide pas', await call('agent2', 'POST', `/logistique/reservations/${b1.body.id}/valider`), 403);
  expect('le gestionnaire valide', await call('agentsaf', 'POST', `/logistique/reservations/${b1.body.id}/valider`), 201);
  expect('validation rejouée', await call('agentsaf', 'POST', `/logistique/reservations/${b1.body.id}/valider`), 409);
  check('titulaire notifié de la confirmation', (await notif(ids.agent1, 'RESERVATION_CONFIRMEE', t0)).length === 1);
  const b2 = await reserver('agentsaf', B.id, 11, 12);
  expect('le gestionnaire ne valide pas sa propre réservation', await call('agentsaf', 'POST', `/logistique/reservations/${b2.body.id}/valider`), 403);
  const b3 = await reserver('agent2', B.id, 13, 14);
  expect('refus sans motif', await call('agentsaf', 'POST', `/logistique/reservations/${b3.body.id}/refuser`, {}), 400);
  expect('refus motivé', await call('agentsaf', 'POST', `/logistique/reservations/${b3.body.id}/refuser`, { motif: 'Travaux dans la salle' }), 201);
  check('créneau libéré par le refus', (await reserver('agentdee', B.id, 13, 14)).status === 201);
  const b4 = await reserver('agent1', B.id, 15, 16);
  const b5 = await reserver('chefssr', B.id, 15, 16, { prioritaire: true });
  check('priorité sur une salle à validation : confirmée d’emblée, attente évincée', b5.body.statut === 'CONFIRMEE' && (await statut(b4.body.id)) === 'ANNULEE_PRIORITE');
  const tb = (await call('agentsaf', 'GET', '/logistique/tableau-de-bord')).body;
  check('tableau de bord du gestionnaire = sa file', tb.reservationsAValider === (await call('agentsaf', 'GET', '/logistique/reservations?vue=a_valider')).body.length);

  console.log('— Annulations');
  const c1 = await reserver('agent2', A.id, 18, 19);
  expect('un tiers n’annule pas', await call('agent1', 'POST', `/logistique/reservations/${c1.body.id}/annuler`, {}), 403);
  expect('le titulaire annule', await call('agent2', 'POST', `/logistique/reservations/${c1.body.id}/annuler`, {}), 201);
  expect('annulation rejouée', await call('agent2', 'POST', `/logistique/reservations/${c1.body.id}/annuler`, {}), 409);
  const c2 = await reserver('agent2', A.id, 18, 19);
  expect('annulation par le gestionnaire sans motif', await call('agentsaf', 'POST', `/logistique/reservations/${c2.body.id}/annuler`, {}), 400);
  expect('annulation motivée par le gestionnaire', await call('agentsaf', 'POST', `/logistique/reservations/${c2.body.id}/annuler`, { motif: 'Salle réquisitionnée' }), 201);
  check('titulaire notifié', (await notif(ids.agent2, 'RESERVATION_ANNULEE', t0)).length === 1);

  console.log('— Concurrence et filets de sécurité en base');
  const conc = await Promise.all(['agent1', 'agent2', 'agentdee', 'chefsaf', 'secdg'].map((k) => reserver(k, A.id, 20, 21)));
  check('5 réservations simultanées du même créneau : une 201, quatre 409', conc.filter((r) => r.status === 201).length === 1 && conc.filter((r) => r.status === 409).length === 4, conc.map((r) => r.status).join());
  const gagnant = conc.find((r) => r.status === 201).body;
  check('trigger : insertion chevauchante refusée en SQL direct', /chevauche/.test(await sqlErreur(`INSERT INTO reservations (id, "ressourceId", "titulaireId", "creeeParId", debut, fin, objet, statut, "updatedAt") VALUES ('x${S}', '${A.id}', '${ids.agent1}', '${ids.agent1}', '${t(20.5)}', '${t(22)}', 'SQL', 'CONFIRMEE', now())`)));
  check('trigger : suppression refusée', /ne peut pas être supprimée/.test(await sqlErreur(`DELETE FROM reservations WHERE id = '${gagnant.id}'`)));

  console.log('— Réunions : salle réservée avec la réunion');
  const reunion = (k, h1, h2, extra = {}) => call(k, 'POST', '/meetings', { title: `Revue ${k} ${S}`, startAt: t(h1), endAt: h2 ? t(h2) : undefined, participantIds: [], ...extra });
  expect('salle sans heure de fin', await reunion('agent1', 30, null, { ressourceId: A.id }), 400);
  const m1 = await reunion('agent1', 30, 31, { ressourceId: A.id });
  expect('agent1 crée une réunion avec la salle A', m1, 201);
  check('lieu = salle, réservation confirmée liée', m1.body.location === `Salle A ${S}` && m1.body.reservation.statut === 'CONFIRMEE');
  const avant = await prisma.meeting.count();
  expect('réunion d’un pair sur la même salle', await reunion('agent2', 30, 31, { ressourceId: A.id }), 409);
  check('aucune réunion créée quand la salle est refusée', (await prisma.meeting.count()) === avant);
  expect('le titulaire ne libère pas la salle hors de la réunion', await call('agent1', 'POST', `/logistique/reservations/${m1.body.reservation.id}/annuler`, {}), 409);
  const m2 = await reunion('chefdpe', 30, 31, { ressourceId: A.id, prioritaire: true });
  expect('le chef de la DPE prend la salle pour sa réunion (priorité)', m2, 201);
  const m1b = (await call('agent1', 'GET', `/meetings/${m1.body.id}`)).body;
  check('réunion d’agent1 conservée, sans salle', m1b.status === 'PLANIFIEE' && m1b.location === null && m1b.reservation.statut === 'ANNULEE_PRIORITE');
  const n2 = (await notif(ids.agent1, 'RESERVATION_ANNULEE_PRIORITE', t0))[0];
  check('notification : prioritaire nommé, réunion conservée', /CHEFDPE/.test(n2.body) && /réunion est conservée/.test(n2.body));
  expect('le chef annule sa réunion', await call('chefdpe', 'POST', `/meetings/${m2.body.id}/cancel`, { reason: 'Reportée' }), 201);
  check('salle libérée par l’annulation de la réunion', (await statut(m2.body.reservation.id)) === 'ANNULEE' && (await dispo('agent2', 30, 31)).libre);

  console.log('— Stagiaire');
  await call('admin', 'POST', '/users', { email: `d9r${S}@test.local`, password: 'Password123!', firstName: 'Stag', lastName: `Res${S}`, role: 'STAGIAIRE' });
  const tok = (await (await fetch('http://localhost:3000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `d9r${S}@test.local`, password: 'Password123!' }) })).json()).accessToken;
  const st = await fetch('http://localhost:3000/logistique/ressources', { headers: { Authorization: 'Bearer ' + tok } });
  check('stagiaire : réservations fermées (403)', st.status === 403);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
