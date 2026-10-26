// Plan de formation individuel (docs/conception_plan_formation.md) — sessions de formation par agent sous
// api/v1/rh/formations : le DRH crée, planifie, marque « suivie », annule ; la Direction lit tout ; le chef
// le plus proche lit les sessions de ses agents ; l'agent lit les siennes (api/v1/profil/formations) ;
// tout autre profil reçoit un 403. Alerte « début proche » (paramètre rh.formationAlerteJours) à l'agent et
// à son chef le plus proche, une seule fois, renvoyée si la date de début change.
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const URL = '/api/v1/rh/formations';
const notifs = (userId, depuis, lien) => prisma.notification.findMany({ where: { userId, createdAt: { gte: depuis }, channel: 'IN_APP', link: lien } });

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const job = app.get(require(D + '/rh/formations.service').FormationsService);
  const crees = [];

  console.log('— Paramètre et accès');
  const param = (await call('admin', 'GET', '/api/v1/parametres')).body.parametres.find((p) => p.cle === 'rh.formationAlerteJours');
  check('paramètre « préavis avant une formation » : 15 jours par défaut, borné de 3 à 60', param && param.defaut === 15 && param.min === 3 && param.max === 60 && param.unite === 'jours', JSON.stringify(param));
  check('sans session : 401', (await fetch(BASE + URL)).status === 401);
  const stg = (await call('admin', 'POST', '/users', { email: `fst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `FormStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('stagiaire de test créé', !!stg.id);
  for (const k of ['agent1', 'admin', 'assdn', `fst${S}`]) expect(`${k} : plan de formation refusé`, await call(k, 'GET', URL), 403);
  const p0 = await call('drh', 'GET', URL);
  expect('DRH : plan lu', p0, 200);
  check('DRH : peut créer ; agents proposés par l’API (comptes actifs, sans stagiaire)', p0.body.droits.creer === true && p0.body.agentsPossibles.some((a) => a.id === ids.agent1) && !p0.body.agentsPossibles.some((a) => a.id === stg.id));
  const dn0 = (await call('dn', 'GET', URL)).body;
  check('DN : lecture sans droit d’écriture ni listes de choix', dn0.droits.creer === false && dn0.agentsPossibles.length === 0 && dn0.besoinsRetenus.length === 0);

  console.log('— Besoin d’origine : seul un besoin retenu se planifie');
  const besoin = (await call('chefdpe', 'POST', '/api/v1/rh/formation', { annee: new Date().getUTCFullYear(), intitule: `Économétrie ${S}`, priorite: 'HAUTE', origine: 'PLAN_TRAVAIL', effectif: 2 })).body;
  check('besoin exprimé par le chef de division', !!besoin.id, JSON.stringify(besoin).slice(0, 150));
  const base = { intitule: `Économétrie appliquée ${S}`, agentId: ids.agent1, dateDebut: jour(5), dureeJours: 3, organisme: 'ENA' };
  expect('besoin seulement exprimé : 409', await call('drh', 'POST', URL, { ...base, besoinId: besoin.id }), 409);
  expect('DRH : besoin retenu', await call('drh', 'PATCH', `/api/v1/rh/formation/${besoin.id}/statut`, { statut: 'RETENU' }), 200);
  check('le besoin retenu est proposé au DRH', (await call('drh', 'GET', URL)).body.besoinsRetenus.some((b) => b.id === besoin.id));

  console.log('— Création : DRH seul, période contrôlée');
  for (const k of ['chefssr', 'dn', 'dna', 'agent1', 'admin']) expect(`${k} : création refusée`, await call(k, 'POST', URL, base), 403);
  expect('ni fin ni durée : 400', await call('drh', 'POST', URL, { ...base, dureeJours: undefined }), 400);
  expect('fin avant le début : 400', await call('drh', 'POST', URL, { ...base, dureeJours: undefined, dateFin: jour(2) }), 400);
  expect('stagiaire comme agent : 400', await call('drh', 'POST', URL, { ...base, agentId: stg.id }), 400);
  const souhaitee = await call('drh', 'POST', URL, { ...base, besoinId: besoin.id });
  expect('DRH : session souhaitée créée depuis le besoin retenu', souhaitee, 201);
  crees.push(souhaitee.body.id);
  check('session souhaitée : fin calculée depuis la durée, besoin rattaché', souhaitee.body.etat === 'SOUHAITEE' && souhaitee.body.dateFin === jour(7) && souhaitee.body.dureeJours === 3 && souhaitee.body.besoin.id === besoin.id, JSON.stringify(souhaitee.body));
  const proche = (await call('drh', 'POST', URL, { intitule: `Prévision ${S}`, agentId: ids.agent1, dateDebut: jour(10), dateFin: jour(11), planifier: true })).body;
  const loin = (await call('drh', 'POST', URL, { intitule: `Comptabilité nationale ${S}`, agentId: ids.agentdee, dateDebut: jour(40), dureeJours: 5, planifier: true })).body;
  const passee = (await call('drh', 'POST', URL, { intitule: `Rédaction ${S}`, agentId: ids.agent1, dateDebut: jour(-3), dateFin: jour(-1), planifier: true })).body;
  crees.push(proche.id, loin.id, passee.id);
  check('sessions planifiées créées (durée déduite des dates : 2 jours)', proche.etat === 'PLANIFIEE' && proche.dureeJours === 2 && loin.etat === 'PLANIFIEE' && passee.etat === 'PLANIFIEE');
  check('création auditée', (await prisma.auditLog.count({ where: { entityType: 'SessionFormation', entityId: proche.id, action: 'CREATION', actorId: ids.drh } })) === 1);

  console.log('— Lecture : Direction tout, chef le plus proche ses agents, agent les siennes');
  const idsDe = (l) => l.map((s) => s.id);
  for (const k of ['dn', 'dna']) {
    const l = idsDe((await call(k, 'GET', URL)).body.sessions);
    check(`${k} : toutes les sessions`, [souhaitee.body.id, proche.id, loin.id, passee.id].every((i) => l.includes(i)));
  }
  const ssr = (await call('chefssr', 'GET', URL)).body;
  check('chef de section (chef le plus proche d’agent1) : ses sessions, pas celles d’un agent d’une autre division', [souhaitee.body.id, proche.id, passee.id].every((i) => idsDe(ssr.sessions).includes(i)) && !idsDe(ssr.sessions).includes(loin.id));
  check('chef : aucun droit d’écriture', ssr.droits.creer === false && ssr.sessions.every((s) => !s.droits.planifier && !s.droits.marquerSuivie && !s.droits.annuler && !s.droits.modifier));
  const dpe = (await call('chefdpe', 'GET', URL)).body;
  check('chef de division : pas les sessions d’agent1 (le chef de section est plus proche)', !idsDe(dpe.sessions).some((i) => [souhaitee.body.id, proche.id, passee.id].includes(i)));
  check('chef d’une autre division : la session de son agent seulement', idsDe((await call('chefse', 'GET', URL)).body.sessions).includes(loin.id) && !idsDe((await call('chefse', 'GET', URL)).body.sessions).includes(proche.id));
  const miennes = await call('agent1', 'GET', '/api/v1/profil/formations');
  expect('agent : ses formations lues (Mon profil)', miennes, 200);
  check('agent : les siennes seulement, sans droit', [souhaitee.body.id, proche.id, passee.id].every((i) => idsDe(miennes.body).includes(i)) && !idsDe(miennes.body).includes(loin.id) && miennes.body.every((s) => !s.droits.annuler));
  check('stagiaire : « Mes formations » vide (ouvert, rien à montrer)', (await call(`fst${S}`, 'GET', '/api/v1/profil/formations')).body.length === 0);

  console.log('— Transitions (DRH) : 403 pour les autres, 409 si invalide');
  expect('chef : marquer suivie refusé', await call('chefssr', 'POST', `${URL}/${passee.id}/suivie`), 403);
  expect('agent : annuler refusé', await call('agent1', 'POST', `${URL}/${proche.id}/annuler`), 403);
  expect('session pas encore commencée : « suivie » refusée (409)', await call('drh', 'POST', `${URL}/${proche.id}/suivie`), 409);
  expect('session planifiée : « planifier » refusé (409)', await call('drh', 'POST', `${URL}/${proche.id}/planifier`), 409);
  const suivie = await call('drh', 'POST', `${URL}/${passee.id}/suivie`);
  expect('DRH : session commencée marquée suivie', suivie, 200);
  check('… état « SUIVIE », plus aucune action', suivie.body.etat === 'SUIVIE' && !Object.values(suivie.body.droits).some(Boolean));
  expect('session suivie : annulation refusée (409)', await call('drh', 'POST', `${URL}/${passee.id}/annuler`), 409);
  expect('session suivie : modification refusée (409)', await call('drh', 'PATCH', `${URL}/${passee.id}`, { organisme: 'X' }), 409);
  expect('DRH : session souhaitée planifiée', await call('drh', 'POST', `${URL}/${souhaitee.body.id}/planifier`), 200);
  expect('DRH : puis annulée', await call('drh', 'POST', `${URL}/${souhaitee.body.id}/annuler`), 200);
  expect('session annulée : « planifier » refusé (409)', await call('drh', 'POST', `${URL}/${souhaitee.body.id}/planifier`), 409);
  check('agent : une session annulée disparaît de « Mes formations »', !idsDe((await call('agent1', 'GET', '/api/v1/profil/formations')).body).includes(souhaitee.body.id));
  check('changement d’état audité', (await prisma.auditLog.count({ where: { entityType: 'SessionFormation', entityId: souhaitee.body.id, actorId: ids.drh, action: 'MODIFICATION' } })) === 2);

  console.log('— Alerte « début proche » : agent et chef le plus proche, une seule fois');
  const depuis = new Date();
  await job.executer(new Date());
  check('agent : prévenu (lien vers Mon profil, section formations)', (await notifs(ids.agent1, depuis, '/compte?section=formations')).filter((n) => n.body.includes(`Prévision ${S}`)).length === 1);
  check('chef de section : prévenu (lien vers RH → Formation)', (await notifs(ids.chefssr, depuis, '/rh?onglet=formation')).filter((n) => n.body.includes(`Prévision ${S}`)).length === 1);
  check('… pas le chef de division', (await notifs(ids.chefdpe, depuis, '/rh?onglet=formation')).filter((n) => n.body.includes(S)).length === 0);
  check('session à 40 jours : pas encore d’alerte ; session passée ou annulée : aucune', (await notifs(ids.agentdee, depuis, '/compte?section=formations')).filter((n) => n.body.includes(S)).length === 0 && (await notifs(ids.agent1, depuis, '/compte?section=formations')).filter((n) => n.body.includes(`Rédaction ${S}`) || n.body.includes(`Économétrie appliquée ${S}`)).length === 0);
  check('horodatage posé', !!(await prisma.sessionFormation.findUnique({ where: { id: proche.id } })).alerteDebutAt);
  await job.executer(new Date());
  check('seconde exécution : rien de renvoyé', (await notifs(ids.agent1, depuis, '/compte?section=formations')).filter((n) => n.body.includes(`Prévision ${S}`)).length === 1);
  expect('DRH : date de début déplacée', await call('drh', 'PATCH', `${URL}/${proche.id}`, { dateDebut: jour(12), dateFin: jour(13) }), 200);
  check('nouvelle date : horodatage effacé', (await prisma.sessionFormation.findUnique({ where: { id: proche.id } })).alerteDebutAt === null);
  await job.executer(new Date());
  check('nouvelle date : l’alerte repart une fois', (await notifs(ids.agent1, depuis, '/compte?section=formations')).filter((n) => n.body.includes(`Prévision ${S}`)).length === 2);
  await job.executerQuotidien();
  const tache = await prisma.executionTache.findFirst({ where: { tache: 'alertes-formation' }, orderBy: { debut: 'desc' } });
  check('tâche planifiée « alertes-formation » suivie par la supervision', !!tache && tache.statut === 'SUCCES', tache && tache.statut);

  // Ménage : sessions de ce test (le besoin reste, comme les autres données de test).
  await prisma.sessionFormation.deleteMany({ where: { id: { in: crees } } });
  await app.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
