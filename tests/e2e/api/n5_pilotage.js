// N5 — pilotage et collaboration : plan de travail (objectif → activité → tâche, droits par unité,
// avancement calculé, rapport d'activité), alertes d'échéance (veille à l'assigné, retard au chef le
// plus proche, une seule fois), notifications (immédiates ou résumé quotidien, préférences, envoi
// groupé), fils de discussion (plusieurs destinataires, accusés de lecture, renvoi vers un objet vu
// seulement de qui a le droit, objet protégé refusé, conservation 3 ans), recherche transverse
// (jamais plus que chaque module), instructions de la Direction (cycle, invisibles pour l'agent
// concerné avant l'exécution, exécution par un acte signé, rejet, relance à 7 jours).
const zlib = require('zlib');
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const annee = new Date().getUTCFullYear();
const notifs = (userId, depuis, type, lien) => prisma.notification.findMany({ where: { userId, createdAt: { gte: depuis }, ...(type ? { type } : {}), ...(lien ? { link: lien } : {}) } });

function textePdf(buf) {
  const l = buf.toString('latin1'); let flux = ''; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(l))) { const fin = l.indexOf('endstream', m.index); try { flux += zlib.inflateSync(Buffer.from(l.slice(m.index + m[0].length, fin), 'latin1')).toString('latin1'); } catch { flux += l.slice(m.index, fin); } }
  return [...flux.matchAll(/<([0-9A-Fa-f]{2,})>/g)].map((x) => Buffer.from(x[1], 'hex').toString('latin1')).join('');
}
async function binaire(k, path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(k)), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) };
}
async function signerActe(acteId, soumettant) {
  expect('soumission de l’acte', await call(soumettant, 'POST', `/courrier/actes/${acteId}/soumettre`), 201);
  let a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a.statut === 'EN_VISA' && i < 4; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'signe.pdf');
  const r = await fetch(`${API}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
  check('le DN signe l’acte', r.status === 201, r.status);
}

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const echeances = app.get(require(D + '/tasks/echeances-taches.service').EcheancesTachesService);
  const resume = app.get(require(D + '/communication/notifications/resume-quotidien.service').ResumeQuotidienService);
  const instructions = app.get(require(D + '/instructions/instructions.service').InstructionsService);
  const conservation = app.get(require(D + '/socle/conservation.service').ConservationService);
  const uSSR = await prisma.uniteOrganisationnelle.findFirst({ where: { sectionId: ids.SSR } });
  const uDPE = await prisma.uniteOrganisationnelle.findFirst({ where: { divisionId: ids.DPE, sectionId: null, type: 'DIVISION' } });
  const uDEE = await prisma.uniteOrganisationnelle.findFirst({ where: { divisionId: ids.DEE, sectionId: null, type: 'DIVISION' } });

  // ------------------------------------------------------------------ plan de travail
  console.log('— Plan de travail : droits par unité');
  const O = { annee, uniteId: uSSR.id, libelle: `Suivi de la conjoncture ${S}`, description: 'Objectif de la section' };
  expect('un agent ne crée pas d’objectif', await call('agent1', 'POST', '/api/v1/plan-travail/objectifs', O), 403);
  expect('le chef d’une autre division non plus', await call('chefdee', 'POST', '/api/v1/plan-travail/objectifs', O), 403);
  const obj = await call('chefssr', 'POST', '/api/v1/plan-travail/objectifs', O);
  expect('le chef de section crée l’objectif de sa section', obj, 201);
  const objDiv = await call('chefdpe', 'POST', '/api/v1/plan-travail/objectifs', { annee, uniteId: uDPE.id, libelle: `Objectif de division ${S}` });
  expect('le chef de division crée l’objectif de sa division', objDiv, 201);
  check('… et gère le plan de ses sections', (await call('chefdpe', 'GET', `/api/v1/plan-travail/unites/${uSSR.id}/responsables-possibles`)).status === 200);
  expect('le DN crée un objectif pour toute unité', await call('dn', 'POST', '/api/v1/plan-travail/objectifs', { annee, uniteId: uDEE.id, libelle: `Objectif DEE ${S}` }), 201);
  const resp = (await call('chefssr', 'GET', `/api/v1/plan-travail/unites/${uSSR.id}/responsables-possibles`)).body;
  check('responsables possibles : membres actifs de la section', resp.some((u) => u.id === ids.agent1) && !resp.some((u) => u.id === ids.agentdee));
  const A = { libelle: `Note mensuelle ${S}`, responsableId: ids.agent1, dateDebut: jour(-20), dateFin: jour(-1), indicateur: 'Notes publiées', cible: '1 par mois' };
  expect('responsable hors de l’unité', await call('chefssr', 'POST', `/api/v1/plan-travail/objectifs/${obj.body.id}/activites`, { ...A, responsableId: ids.agentdee }), 400);
  expect('dates inversées', await call('chefssr', 'POST', `/api/v1/plan-travail/objectifs/${obj.body.id}/activites`, { ...A, dateDebut: jour(5), dateFin: jour(1) }), 400);
  const depuisAct = new Date();
  const act = await call('chefssr', 'POST', `/api/v1/plan-travail/objectifs/${obj.body.id}/activites`, A);
  expect('activité datée (responsable, indicateur, cible)', act, 201);
  check('le responsable est prévenu', (await notifs(ids.agent1, depuisAct, null, `/plan-travail?activite=${act.body.id}`)).length === 2);
  expect('agent1 ne modifie pas l’activité', await call('agent1', 'PATCH', `/api/v1/plan-travail/activites/${act.body.id}`, { libelle: 'Autre libellé' }), 403);

  console.log('— Plan de travail : tâches et avancement calculé');
  const t1 = (await call('chefssr', 'POST', '/tasks', { title: `Collecte ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }], activiteId: act.body.id })).body;
  const t2 = (await call('chefssr', 'POST', '/tasks', { title: `Rédaction ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }], activiteId: act.body.id })).body;
  check('tâches rattachées à l’activité', t1.activiteId === act.body.id && t2.activiteId === act.body.id);
  expect('rattachement à une activité invisible (agent d’une autre division)', await call('agentdee', 'POST', '/tasks', { title: `X ${S}`, priority: 'NORMAL', activiteId: act.body.id }), 403);
  await call('agent1', 'POST', `/tasks/${t1.id}/start`);
  await call('agent1', 'POST', `/tasks/${t1.id}/submit`);
  await call('chefssr', 'POST', `/tasks/${t1.id}/validate`, {});
  const t1b = await prisma.task.findUnique({ where: { id: t1.id } });
  let va = (await call('agent1', 'GET', `/api/v1/plan-travail/activites/${act.body.id}`)).body;
  const attendu = Math.round((t1b.progressPercent + 0) / 2);
  check(`avancement de l’activité = moyenne des tâches (${attendu} %)`, va.avancement === attendu && va.nombreTaches === 2, JSON.stringify({ av: va.avancement, n: va.nombreTaches }));
  check('activité en retard (fin passée, < 100 %)', va.enRetard === (attendu < 100));
  check('agent : lecture sans droit de modifier', va.droits && !va.droits.modifier && va.responsablesPossibles.length === 0);
  check('filtre des tâches par activité', (await call('chefssr', 'GET', `/tasks?activiteId=${act.body.id}`)).body.length === 2);
  const planAg = (await call('agent1', 'GET', `/api/v1/plan-travail?annee=${annee}`)).body;
  const o1 = planAg.objectifs.find((o) => o.id === obj.body.id);
  check('agent1 lit le plan de sa section et de sa division', !!o1 && planAg.objectifs.some((o) => o.id === objDiv.body.id) && !planAg.peutCreer);
  check('avancement de l’objectif = moyenne de ses activités', o1.avancement === attendu);
  // Tableau de bord (avancement des activités) : état comparé au temps écoulé, calculé par l'API.
  const actAo = (await call('chefssr', 'POST', `/api/v1/plan-travail/objectifs/${obj.body.id}/activites`, { ...A, libelle: `En cours ${S}`, dateDebut: jour(-10), dateFin: jour(10) })).body;
  const actFutur = (await call('chefssr', 'POST', `/api/v1/plan-travail/objectifs/${obj.body.id}/activites`, { ...A, libelle: `À venir ${S}`, dateDebut: jour(5), dateFin: jour(30) })).body;
  const plan2 = (await call('agent1', 'GET', `/api/v1/plan-travail?annee=${annee}`)).body.objectifs.find((o) => o.id === obj.body.id);
  const etat = (id) => plan2.activites.find((a) => a.id === id);
  check('activité échue sous 100 % : EN_RETARD, temps écoulé 100 %', etat(act.body.id).etatAvancement === (attendu < 100 ? 'EN_RETARD' : 'CONFORME') && etat(act.body.id).tempsEcoule === 100, JSON.stringify(etat(act.body.id)));
  check('activité à mi-parcours sans avancement : EN_DECALAGE (avancement sous le temps écoulé)', etat(actAo.id).etatAvancement === 'EN_DECALAGE' && etat(actAo.id).tempsEcoule >= 45 && etat(actAo.id).tempsEcoule <= 55, JSON.stringify(etat(actAo.id)));
  check('activité pas encore commencée : CONFORME, temps écoulé 0 %', etat(actFutur.id).etatAvancement === 'CONFORME' && etat(actFutur.id).tempsEcoule === 0);
  check('sigle de l’unité sur l’objectif et ses activités', plan2.uniteSigle === uSSR.code && plan2.activites.every((a) => a.uniteSigle === uSSR.code), plan2.uniteSigle);
  await call('chefssr', 'DELETE', `/api/v1/plan-travail/activites/${actAo.id}`);
  await call('chefssr', 'DELETE', `/api/v1/plan-travail/activites/${actFutur.id}`);
  check('agent1 ne voit pas le plan d’une autre division', !planAg.objectifs.some((o) => o.libelle === `Objectif DEE ${S}`));
  expect('plan d’une autre unité demandé explicitement', await call('agentdee', 'GET', `/api/v1/plan-travail?uniteId=${uSSR.id}`), 403);
  check('activités proposées pour une tâche', (await call('agent1', 'GET', '/api/v1/plan-travail/activites-disponibles')).body.some((a) => a.id === act.body.id));
  expect('objectif avec activités : suppression refusée', await call('chefssr', 'DELETE', `/api/v1/plan-travail/objectifs/${obj.body.id}`), 409);
  expect('activité avec tâches : suppression refusée', await call('chefssr', 'DELETE', `/api/v1/plan-travail/activites/${act.body.id}`), 409);

  console.log('— Rapport d’activité : section « Activités du plan de travail »');
  const rap = await binaire('chefssr', '/api/v1/documents-generes/apercu', { type: 'RAPPORT_ACTIVITE', perimetre: 'SECTION', cibleId: ids.SSR, debut: jour(-30), fin: jour(0) });
  const tr = rap.status === 200 ? textePdf(rap.buf) : '';
  check('rapport : section, activité, indicateur et avancement', rap.status === 200 && /ACTIVITÉS DU PLAN DE TRAVAIL/i.test(tr) && tr.includes(`Note mensuelle ${S}`) && tr.includes('Notes publiées'), rap.status);

  // ------------------------------------------------------------------ alertes d'échéance
  console.log('— Alertes d’échéance');
  const tv = (await call('chefssr', 'POST', '/tasks', { title: `Échéance demain ${S}`, priority: 'NORMAL', dueDate: jour(1), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const trd = (await call('chefssr', 'POST', '/tasks', { title: `En retard ${S}`, priority: 'NORMAL', dueDate: jour(3), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  await prisma.task.update({ where: { id: trd.id }, data: { dueDate: new Date(`${jour(-2)}T00:00:00Z`) } });
  const depuisE = new Date();
  await echeances.executer(new Date());
  check('veille : l’assigné est prévenu', (await notifs(ids.agent1, depuisE, 'TACHE_ECHEANCE_PROCHE', `/tasks/${tv.id}`)).length === 2);
  check('retard : le chef le plus proche (chef de section) est prévenu', (await notifs(ids.chefssr, depuisE, 'TACHE_EN_RETARD', `/tasks/${trd.id}`)).length === 2);
  check('… pas le chef de division ni l’assigné', (await notifs(ids.chefdpe, depuisE, 'TACHE_EN_RETARD', `/tasks/${trd.id}`)).length === 0 && (await notifs(ids.agent1, depuisE, 'TACHE_EN_RETARD', `/tasks/${trd.id}`)).length === 0);
  await echeances.executer(new Date());
  check('une seule alerte par tâche', (await notifs(ids.agent1, depuisE, 'TACHE_ECHEANCE_PROCHE', `/tasks/${tv.id}`)).length === 2 && (await notifs(ids.chefssr, depuisE, 'TACHE_EN_RETARD', `/tasks/${trd.id}`)).length === 2);

  // ------------------------------------------------------------------ notifications
  console.log('— Notifications : immédiates ou résumé quotidien');
  const emailVeille = (await notifs(ids.agent1, depuisE, 'TACHE_ECHEANCE_PROCHE', `/tasks/${tv.id}`)).find((n) => n.channel === 'EMAIL');
  const emailRetard = (await notifs(ids.chefssr, depuisE, 'TACHE_EN_RETARD', `/tasks/${trd.id}`)).find((n) => n.channel === 'EMAIL');
  const inApp = (await notifs(ids.agent1, depuisE, 'TACHE_ECHEANCE_PROCHE', `/tasks/${tv.id}`)).find((n) => n.channel === 'IN_APP');
  check('dans l’application : toujours immédiate', inApp && inApp.sentAt);
  check('email ordinaire : en attente du résumé à 7 h', emailVeille && !emailVeille.sentAt && emailVeille.aEnvoyerLe && new Date(emailVeille.aEnvoyerLe).getUTCHours() === 7 && new Date(emailVeille.aEnvoyerLe) > depuisE);
  check('email urgent (tâche en retard) : envoyé immédiatement', emailRetard && emailRetard.sentAt && !emailRetard.aEnvoyerLe);
  const pref0 = (await call('agent1', 'GET', '/api/v1/notifications/preferences')).body;
  check('préférences par défaut : résumé quotidien à 7 h', pref0.resumeQuotidien === true && pref0.heureResume === 7 && pref0.enAttente >= 1);
  expect('heure hors bornes', await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { heureResume: 24 }), 400);
  const pref1 = await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { heureResume: 9 });
  expect('résumé à 9 h', pref1, 200);
  check('les emails en attente sont reprogrammés à 9 h', new Date((await prisma.notification.findUnique({ where: { id: emailVeille.id } })).aEnvoyerLe).getUTCHours() === 9);
  const r0 = await resume.executer(new Date());
  check('avant l’heure : rien n’est envoyé', !(await prisma.notification.findUnique({ where: { id: emailVeille.id } })).sentAt, JSON.stringify(r0));
  const r1 = await resume.executer(new Date(Date.now() + 2 * J));
  const apres = await prisma.notification.findMany({ where: { userId: ids.agent1, channel: 'EMAIL', sentAt: null, aEnvoyerLe: { not: null } } });
  check('à l’heure : un résumé groupé, plus rien en attente', r1.agents >= 1 && apres.length === 0 && !!(await prisma.notification.findUnique({ where: { id: emailVeille.id } })).sentAt);
  await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { resumeQuotidien: false });
  const depuisI = new Date();
  await call('chefssr', 'POST', '/tasks', { title: `Immédiat ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] });
  const imm = (await notifs(ids.agent1, depuisI, 'TACHE_ASSIGNEE')).find((n) => n.channel === 'EMAIL');
  check('« Tout immédiatement » : l’email part tout de suite', imm && imm.sentAt && !imm.aEnvoyerLe);
  await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { resumeQuotidien: true, heureResume: 7 });
  check('préférences propres à chacun (agent2 inchangé)', (await call('agent2', 'GET', '/api/v1/notifications/preferences')).body.heureResume === 7);

  // ------------------------------------------------------------------ fils de discussion
  console.log('— Fils de discussion');
  const tPriv = (await call('chefssr', 'POST', '/tasks', { title: `Dossier interne ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const F = { objet: `Préparation de la note ${S}`, destinataires: [ids.agent2, ids.agentdee], corps: 'Voici la tâche de référence.', lien: { type: 'TACHE', id: tPriv.id } };
  expect('sans destinataire', await call('agent1', 'POST', '/api/v1/fils', { ...F, destinataires: [] }), 400);
  expect('type d’objet inconnu', await call('agent1', 'POST', '/api/v1/fils', { ...F, lien: { type: 'CONGE', id: 'x' } }), 400);
  expect('objet que l’auteur ne voit pas', await call('agentdee', 'POST', '/api/v1/fils', { ...F, destinataires: [ids.agent1] }), 400);
  const pli = await prisma.courrierArrivee.findFirst({ where: { confidentialite: 'PERSONNEL' } });
  if (pli) {
    const destPli = Object.keys(ids).find((k) => ids[k] === pli.destinataireId) || 'dn';
    expect('pli personnel : objet protégé, jamais joint', await call(destPli, 'POST', '/api/v1/fils', { ...F, destinataires: [ids.agent1], lien: { type: 'ARRIVEE', id: pli.id } }), 400);
  }
  const depuisF = new Date();
  const fil = await call('agent1', 'POST', '/api/v1/fils', F);
  expect('fil créé : objet, deux destinataires, renvoi vers une tâche', fil, 201);
  check('chaque destinataire est prévenu', (await notifs(ids.agent2, depuisF, 'MESSAGE_DIRECT', `/communication?fil=${fil.body.id}`)).length === 2 && (await notifs(ids.agentdee, depuisF, 'MESSAGE_DIRECT', `/communication?fil=${fil.body.id}`)).length === 2);
  check('auteur : lien résolu (titre, adresse)', fil.body.messages[0].lien.accessible && fil.body.messages[0].lien.libelle === `Dossier interne ${S}` && fil.body.messages[0].lien.lien === `/tasks/${tPriv.id}`);
  check('accusés : personne n’a encore lu', fil.body.messages[0].lectures.length === 2 && fil.body.messages[0].lectures.every((l) => !l.luLe));
  const listeAg2 = (await call('agent2', 'GET', '/api/v1/fils')).body.find((f) => f.id === fil.body.id);
  check('agent2 : fil listé, 1 non lu', listeAg2 && listeAg2.nonLus === 1 && listeAg2.participants.length === 3);
  const vuDee = (await call('agentdee', 'GET', `/api/v1/fils/${fil.body.id}`)).body;
  check('destinataire qui ne voit pas la tâche : ni titre ni adresse', vuDee.messages[0].lien.accessible === false && !vuDee.messages[0].lien.libelle && !vuDee.messages[0].lien.lien);
  expect('un non-participant n’ouvre pas le fil', await call('agent2', 'GET', `/api/v1/fils/${fil.body.id}x`), 404);
  expect('… ni un chef', await call('chefssr', 'GET', `/api/v1/fils/${fil.body.id}`), 404);
  const vuAuteur = (await call('agent1', 'GET', `/api/v1/fils/${fil.body.id}`)).body;
  check('accusé de lecture par destinataire (agentdee lu, agent2 non)', vuAuteur.messages[0].lectures.find((l) => l.id === ids.agentdee).luLe && !vuAuteur.messages[0].lectures.find((l) => l.id === ids.agent2).luLe);
  const rep = await call('agent2', 'POST', `/api/v1/fils/${fil.body.id}/messages`, { corps: 'Bien reçu, je complète.' });
  expect('réponse dans le fil', rep, 201);
  check('répondre vaut lecture des messages précédents', rep.body.messages[0].lectures.find((l) => l.id === ids.agent2).luLe && rep.body.messages.length === 2);
  expect('un non-participant ne répond pas', await call('chefssr', 'POST', `/api/v1/fils/${fil.body.id}/messages`, { corps: 'x' }), 404);
  const vieux = await prisma.filMessages.create({ data: { objet: `Ancien ${S}`, creeParId: ids.agent1, participants: { create: [{ userId: ids.agent1 }, { userId: ids.agent2 }] }, messages: { create: [{ auteurId: ids.agent1, corps: 'ancien', createdAt: new Date(Date.now() - (3 * 365 + 2) * J) }] } } });
  const pu = await conservation.purgerMessages(new Date());
  check('conservation : fil de plus de 3 ans purgé, fil récent conservé', pu.messagesFils >= 1 && !(await prisma.filMessages.findUnique({ where: { id: vieux.id } })) && !!(await prisma.filMessages.findUnique({ where: { id: fil.body.id } })));

  // ------------------------------------------------------------------ recherche transverse
  console.log('— Recherche transverse');
  expect('moins de 3 caractères', await call('agent1', 'GET', '/api/v1/recherche?q=ab'), 400);
  const rAg = (await call('agent1', 'GET', `/api/v1/recherche?q=${S}`)).body;
  const cat = (r, cle) => r.categories.find((c) => c.cle === cle);
  check('6 catégories : tâches, plan de travail, documents, courrier, annuaire, réunions', rAg.categories.map((c) => c.cle).join() === 'taches,activites,documents,courrier,annuaire,reunions');
  check('agent1 trouve ses tâches (5 au plus, « autres » signalés)', cat(rAg, 'taches').resultats.length === 5 && cat(rAg, 'taches').autres === true);
  for (const k of ['agentdee', 'admin', 'agent2', 'dn']) {
    const r = (await call(k, 'GET', `/api/v1/recherche?q=${S}`)).body;
    const visibles = new Set((await call(k, 'GET', '/tasks?includeSubtasks=true')).body.map((t) => t.id));
    check(`${k} : aucune tâche hors de ce que l’écran des tâches lui montre`, cat(r, 'taches').resultats.every((t) => visibles.has(t.id)), `${cat(r, 'taches').resultats.length} résultat(s)`);
  }
  check('agent d’une autre division : aucune tâche de la section', cat((await call('agentdee', 'GET', `/api/v1/recherche?q=${S}`)).body, 'taches').resultats.length === 0);
  // Références courtes : « T-418 », « t418 », « 418 » pour une tâche ; « A-07 » pour une activité ; jamais hors périmètre.
  const t1n = (await call('agent1', 'GET', `/tasks/${t1.id}`)).body;
  check('tâche : numéro stable renvoyé par l’API', Number.isInteger(t1n.numero) && t1n.numero > 0 && (await prisma.task.findUnique({ where: { id: t1.id } })).numero === t1n.numero);
  for (const saisie of [`T-${t1n.numero}`, `t${String(t1n.numero).padStart(2, '0')}`, String(t1n.numero).padStart(3, '0')]) {
    const r = (await call('agent1', 'GET', `/api/v1/recherche?q=${encodeURIComponent(saisie)}`)).body;
    check(`recherche « ${saisie} » : la tâche T-${t1n.numero}, libellé préfixé de sa référence`, cat(r, 'taches').resultats.some((x) => x.id === t1.id && x.libelle.startsWith(`T-${t1n.numero} — `)));
  }
  check('recherche par référence hors périmètre : rien (agent d’une autre division)', !cat((await call('agentdee', 'GET', `/api/v1/recherche?q=T-${t1n.numero}`)).body, 'taches').resultats.some((x) => x.id === t1.id));
  const actN = (await call('agent1', 'GET', `/api/v1/plan-travail/activites/${act.body.id}`)).body;
  check('activité : numéro et référence « A-07 » (deux chiffres au moins)', Number.isInteger(actN.numero) && actN.reference === `A-${String(actN.numero).padStart(2, '0')}`, actN.reference);
  const rAct = (await call('agent1', 'GET', `/api/v1/recherche?q=${encodeURIComponent(actN.reference)}`)).body;
  check(`recherche « ${actN.reference} » : l’activité, lien vers le plan de travail`, cat(rAct, 'activites').resultats.some((x) => x.id === act.body.id && x.lien === `/plan-travail?activite=${act.body.id}` && x.libelle.startsWith(`${actN.reference} — `)));
  check('recherche d’une activité par référence hors périmètre : rien', !cat((await call('agentdee', 'GET', `/api/v1/recherche?q=${encodeURIComponent(actN.reference)}`)).body, 'activites').resultats.some((x) => x.id === act.body.id));
  check('« A-… » ne cherche pas de tâche, « T-… » pas d’activité', !cat(rAct, 'taches').resultats.some((x) => x.libelle.startsWith(`T-${actN.numero} `)) && !cat((await call('agent1', 'GET', `/api/v1/recherche?q=T-${actN.numero}`)).body, 'activites').resultats.some((x) => x.id === act.body.id));
  const nomAg = (await call('agent1', 'GET', '/users/directory')).body.find((u) => u.id === ids.agent1);
  const rAnn = (await call('agent2', 'GET', `/api/v1/recherche?q=${encodeURIComponent(nomAg.lastName)}`)).body;
  check('annuaire : personnel actif par nom', cat(rAnn, 'annuaire').resultats.some((u) => u.id === ids.agent1));
  if (pli) {
    const destPli = Object.keys(ids).find((k) => ids[k] === pli.destinataireId) || 'dn';
    const rPli = (await call(destPli, 'GET', `/api/v1/recherche?q=${encodeURIComponent(pli.numero)}`)).body;
    check('pli personnel : jamais dans les résultats', !cat(rPli, 'courrier').resultats.some((c) => c.id === pli.id));
  }

  // ------------------------------------------------------------------ instructions
  console.log('— Instructions de la Direction');
  const I = { objet: `Attestation pour agent2 ${S}`, texte: 'Établir l’attestation de travail demandée.', destinataireId: ids.drh, agentConcerneId: ids.agent2, echeance: jour(10) };
  for (const k of ['agent1', 'chefdpe', 'assdn', 'drh']) expect(`${k} n’émet pas d’instruction`, await call(k, 'POST', '/api/v1/instructions', I), 403);
  expect('destinataire = agent concerné', await call('dn', 'POST', '/api/v1/instructions', { ...I, agentConcerneId: ids.drh }), 400);
  expect('à soi-même', await call('dn', 'POST', '/api/v1/instructions', { ...I, destinataireId: ids.dn, agentConcerneId: undefined }), 400);
  const depuisI2 = new Date();
  const ins = await call('dn', 'POST', '/api/v1/instructions', I);
  expect('le DN émet l’instruction', ins, 201);
  check('statut Émise ; destinataire prévenu, email immédiat', ins.body.statut === 'EMISE' && (await notifs(ids.drh, depuisI2, null, `/instructions?id=${ins.body.id}`)).some((n) => n.channel === 'EMAIL' && n.sentAt));
  check('agent concerné : ni notification…', (await notifs(ids.agent2, depuisI2, null, `/instructions?id=${ins.body.id}`)).length === 0);
  check('… ni liste…', !(await call('agent2', 'GET', '/api/v1/instructions')).body.meConcernant.some((x) => x.id === ins.body.id));
  expect('… ni fiche', await call('agent2', 'GET', `/api/v1/instructions/${ins.body.id}`), 404);
  expect('un autre agent ne lit pas l’instruction', await call('agent1', 'GET', `/api/v1/instructions/${ins.body.id}`), 404);
  const lue = await call('drh', 'GET', `/api/v1/instructions/${ins.body.id}`);
  check('ouverture par le destinataire : Reçue (horodatée)', lue.body.statut === 'RECUE' && lue.body.recueLe && lue.body.droits.prendreEnCompte);
  expect('exécuter avant la prise en compte', await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/execution`, { compteRendu: 'fait' }), 409);
  expect('l’émetteur ne prend pas en compte à la place du destinataire', await call('dn', 'POST', `/api/v1/instructions/${ins.body.id}/prise-en-compte`), 403);
  expect('prise en compte', await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/prise-en-compte`), 200);
  expect('instruction RH sans acte', await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/execution`, { compteRendu: 'Attestation établie.' }), 400);
  const att = (await call('drh', 'POST', '/api/v1/attestations-travail', { agentId: ids.agent2 })).body;
  const reg = (await call('admin', 'POST', '/courrier/registres', { code: `IN${L}`, libelle: `Actes des instructions ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'INS/{seq}/{annee}' })).body;
  const acte = (await call('drh', 'POST', `/api/v1/attestations-travail/${att.id}/acte`, { registreId: reg.id })).body;
  expect('acte non signé', await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/execution`, { compteRendu: 'Attestation établie.', acteId: acte.acteId }), 409);
  const att1 = (await call('drh', 'POST', '/api/v1/attestations-travail', { agentId: ids.agent1 })).body;
  const acte1 = (await call('drh', 'POST', `/api/v1/attestations-travail/${att1.id}/acte`, { registreId: reg.id })).body;
  await signerActe(acte1.acteId, 'drh');
  expect('acte d’un autre bénéficiaire', await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/execution`, { compteRendu: 'Attestation établie.', acteId: acte1.acteId }), 400);
  await signerActe(acte.acteId, 'drh');
  const depuisX = new Date();
  const ex = await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/execution`, { compteRendu: 'Attestation établie et signée.', acteId: acte.acteId });
  expect('exécution par l’acte signé', ex, 200);
  check('Exécutée, acte lié ; émetteur et agent concerné prévenus', ex.body.statut === 'EXECUTEE' && ex.body.acteId === acte.acteId && (await notifs(ids.dn, depuisX, null, `/instructions?id=${ins.body.id}`)).length === 2 && (await notifs(ids.agent2, depuisX, null, `/instructions?id=${ins.body.id}`)).length === 2);
  check('agent concerné : visible après l’exécution', (await call('agent2', 'GET', '/api/v1/instructions')).body.meConcernant.some((x) => x.id === ins.body.id) && (await call('agent2', 'GET', `/api/v1/instructions/${ins.body.id}`)).status === 200);
  expect('exécuter deux fois', await call('drh', 'POST', `/api/v1/instructions/${ins.body.id}/execution`, { compteRendu: 'Encore une fois.', acteId: acte.acteId }), 409);

  const ins2 = (await call('dna', 'POST', '/api/v1/instructions', { objet: `Réaffectation ${S}`, texte: 'Préparer la réaffectation.', destinataireId: ids.drh, agentConcerneId: ids.agent1 })).body;
  check('la DNA émet aussi', ins2.statut === 'EMISE');
  expect('rejet sans motif suffisant', await call('drh', 'POST', `/api/v1/instructions/${ins2.id}/rejet`, { motif: 'non' }), 400);
  const depuisR = new Date();
  const rj = await call('drh', 'POST', `/api/v1/instructions/${ins2.id}/rejet`, { motif: 'Poste budgétaire indisponible cette année.' });
  expect('rejet motivé', rj, 200);
  check('émetteur prévenu immédiatement (motif compris)', (await notifs(ids.dna, depuisR, null, `/instructions?id=${ins2.id}`)).some((n) => n.channel === 'EMAIL' && n.sentAt && /Poste budgétaire/.test(n.body)));
  expect('agent concerné : instruction rejetée jamais visible', await call('agent1', 'GET', `/api/v1/instructions/${ins2.id}`), 404);

  const ins3 = (await call('dn', 'POST', '/api/v1/instructions', { objet: `Relance ${S}`, texte: 'Faire le point.', destinataireId: ids.chefdpe })).body;
  await prisma.instruction.update({ where: { id: ins3.id }, data: { emiseLe: new Date(Date.now() - 8 * J) } });
  const depuisRel = new Date();
  await instructions.relancer(new Date());
  check('relance à 7 jours : destinataire et émetteur prévenus', (await notifs(ids.chefdpe, depuisRel, null, `/instructions?id=${ins3.id}`)).length === 2 && (await notifs(ids.dn, depuisRel, null, `/instructions?id=${ins3.id}`)).length === 2);
  await instructions.relancer(new Date());
  check('pas de seconde relance avant 7 jours', (await notifs(ids.chefdpe, depuisRel, null, `/instructions?id=${ins3.id}`)).length === 2);
  await instructions.relancer(new Date(Date.now() + 7 * J + 3600e3));
  check('nouvelle relance 7 jours plus tard', (await notifs(ids.chefdpe, depuisRel, null, `/instructions?id=${ins3.id}`)).length === 4);
  const lDn = (await call('dn', 'GET', '/api/v1/instructions')).body;
  check('DN : émises (toute la Direction), droit d’émettre', lDn.peutEmettre && lDn.emises.some((x) => x.id === ins2.id));
  check('recherche : aucune instruction (jamais cherchées)', !JSON.stringify((await call('dn', 'GET', `/api/v1/recherche?q=${S}`)).body).includes(ins.body.id));

  await app.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
