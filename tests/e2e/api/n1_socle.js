// N1 — socle NIMBA : reprise (unités, agents, rôles), conventions d'API v1 (trace_id, enveloppe
// d'erreur), refus journalisés, organigramme (création, modification, fermeture datée, 403/409),
// agents (cycle de vie par le DRH, départ avec transfert des tâches, fins prévues J-15/J-3/échéance,
// prolongation, confirmation), rôles fonctionnels (attribution, retrait, reflets courrier et
// logistique, jamais empruntés en intérim), « aucun compte sans agent ».
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5).toUpperCase();
const JOUR = 864e5;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const brut = async (method, path, token, body, headers = {}) => {
  const r = await fetch('http://localhost:3000' + path, {
    method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, headers: r.headers };
};
const connexion = async (email, password = 'Password123!') => brut('POST', '/auth/login', null, { email, password });
const agentDe = async (userId) => (await prisma.user.findUnique({ where: { id: userId }, select: { agent: true } })).agent;

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const fins = app.get(require(D + '/socle/agents.service').AgentsService);
  const reprise = app.get(require(D + '/socle/reprise-n1.service').ReprisesN1Service);

  console.log('— Reprise automatique (données du jeu de test)');
  const actifsSansAgent = await prisma.user.count({ where: { status: 'ACTIF', agentId: null } });
  check('aucun compte actif sans agent', actifsSansAgent === 0, `${actifsSansAgent}`);
  const direction = await prisma.uniteOrganisationnelle.findFirst({ where: { type: 'DIRECTION', parentId: null } });
  check('Direction créée (racine unique)', !!direction && (await prisma.uniteOrganisationnelle.count({ where: { type: 'DIRECTION' } })) === 1);
  const divisions = await prisma.division.count();
  check(`chaque division a son unité (${divisions})`, (await prisma.uniteOrganisationnelle.count({ where: { type: 'DIVISION', divisionId: { not: null } } })) === divisions);
  check('chaque section a son unité, sous sa division', (await prisma.section.count()) === (await prisma.uniteOrganisationnelle.count({ where: { sectionId: { not: null }, parent: { type: 'DIVISION' } } })));
  const secdir = await prisma.uniteOrganisationnelle.findFirst({ where: { code: 'SECDIR' }, include: { cellule: true } });
  check('Secrétariat de direction créé (unité + cellule)', !!secdir?.cellule && secdir.parentId === direction.id);
  const uDpe = await prisma.uniteOrganisationnelle.findUnique({ where: { divisionId: ids.DPE } });
  check('responsable de DPE = chef de division actif', uDpe.responsableId === ids.chefdpe);
  check('responsable de la Direction = DN', direction.responsableId === ids.dn);
  const aAssdn = await agentDe(ids.assdn);
  check('assistant du DN rattaché au Secrétariat de direction', aAssdn.uniteId === secdir.id);
  const aAgent1 = await agentDe(ids.agent1);
  check('agent rattaché à sa section, matricule provisoire P-…', aAgent1.uniteId === (await prisma.uniteOrganisationnelle.findUnique({ where: { sectionId: ids.SSR } })).id && /^P-\d{6}$/.test(aAgent1.matricule) && aAgent1.matriculeProvisoire);
  const actifs = async (userId, role) => prisma.attributionRole.count({ where: { userId, role, retireLe: null } });
  check('DRH : rôle fonctionnel DRH repris', (await actifs(ids.drh, 'DRH')) === 1);
  check('DN et DNA : Validateur', (await actifs(ids.dn, 'VALIDATEUR')) === 1 && (await actifs(ids.dna, 'VALIDATEUR')) === 1);
  check('chef de la cellule SAF : Chef SAF', (await actifs(ids.chefsaf, 'CHEF_SAF')) === 1);
  check('assistants : rôle Assistant', (await actifs(ids.assdn, 'ASSISTANT')) === 1 && (await actifs(ids.asssaf, 'ASSISTANT')) === 1);
  const habs = await prisma.habilitationCourrier.count();
  check(`habilitations courrier reflétées une à une (${habs})`, (await prisma.attributionRole.count({ where: { habilitationCourrierId: { not: null } } })) === habs);
  check('aucun Gestionnaire RH ni Gestionnaire paie déduit', (await prisma.attributionRole.count({ where: { role: { in: ['GESTIONNAIRE_RH', 'GESTIONNAIRE_PAIE'] } } })) === 0);
  const r2 = await reprise.reconcilier();
  check('reprise idempotente : une seconde passe ne crée rien', Object.values(r2).every((n) => n === 0), JSON.stringify(r2));

  console.log('— Conventions d’API (trace_id, enveloppe v1) et refus journalisés');
  const tAgent = (await connexion('agent1@test.local')).body.accessToken;
  const r404 = await brut('GET', '/api/v1/agents/inexistant', (await connexion('drh@test.local')).body.accessToken);
  check('v1 : enveloppe { code, message, details, trace_id }', r404.status === 404 && r404.body.code === 'INTROUVABLE' && typeof r404.body.message === 'string' && 'details' in r404.body && r404.body.trace_id === r404.headers.get('x-trace-id'), JSON.stringify(r404.body));
  const r400 = await brut('POST', '/api/v1/unites', (await connexion('drh@test.local')).body.accessToken, { type: 'SECTION' });
  check('v1 : 400 de validation → REQUETE_INVALIDE avec détails', r400.status === 400 && r400.body.code === 'REQUETE_INVALIDE' && Array.isArray(r400.body.details));
  const ancien = await brut('GET', '/users/pending', tAgent);
  check('route historique : forme d’erreur inchangée { statusCode, message }', ancien.status === 403 && ancien.body.statusCode === 403 && !('trace_id' in ancien.body) && !!ancien.headers.get('x-trace-id'));
  await new Promise((r) => setTimeout(r, 300));
  const refusAncien = await prisma.accesRefuse.findFirst({ where: { userId: ids.agent1, route: '/users/pending' }, orderBy: { createdAt: 'desc' } });
  check('refus d’une route historique journalisé (compte, route, trace)', !!refusAncien && refusAncien.traceId === ancien.headers.get('x-trace-id'));
  const r403 = await brut('POST', '/api/v1/unites', tAgent, { type: 'CELLULE', parentId: direction.id, code: `X${S}`, libelle: 'Refus' });
  check('v1 : 403 → DROIT_INSUFFISANT', r403.status === 403 && r403.body.code === 'DROIT_INSUFFISANT');
  await new Promise((r) => setTimeout(r, 300));
  const refusV1 = await prisma.accesRefuse.findFirst({ where: { userId: ids.agent1, route: '/api/v1/unites' }, orderBy: { createdAt: 'desc' } });
  check('refus v1 journalisé avec son étape (§5.5 : ROLE)', refusV1?.etape === 'ROLE' && refusV1.objetType === 'UniteOrganisationnelle');

  console.log('— Organigramme : lecture par tous, gestion DRH et administrateur');
  const org = await call('agent1', 'GET', '/api/v1/organigramme');
  check('un agent lit l’organigramme, sans droit de gestion', org.status === 200 && org.body.droits.peutGerer === false && org.body.unites.every((u) => !u.droits.peutModifier));
  const orgDrh = await call('drh', 'GET', '/api/v1/organigramme');
  check('le DRH gère : types d’enfants proposés sous la Direction', orgDrh.body.droits.peutGerer && orgDrh.body.unites.find((u) => u.type === 'DIRECTION').droits.typesEnfants.map((t) => t.type).join() === 'DIVISION,CELLULE,INSTANCE');
  expect('un chef de division ne crée pas d’unité', await call('chefdpe', 'POST', '/api/v1/unites', { type: 'CELLULE', parentId: direction.id, code: `C${S}`, libelle: 'Refus' }), 403);
  const div = await call('drh', 'POST', '/api/v1/unites', { type: 'DIVISION', parentId: direction.id, code: `D${S}`, libelle: `Division test ${S}` });
  expect('le DRH crée une division', div, 201);
  const legacyDiv = await prisma.division.findUnique({ where: { code: `D${S}` } });
  check('… sa ligne historique existe (les modules actuels la voient)', !!legacyDiv && div.body.divisionId === legacyDiv.id);
  const sec = await call('admin', 'POST', '/api/v1/unites', { type: 'SECTION', parentId: div.body.id, code: `S${S}`, libelle: 'Section test' });
  expect('l’administrateur crée une section sous cette division', sec, 201);
  check('… section historique rattachée à la bonne division', (await prisma.section.findUnique({ where: { id: sec.body.sectionId } })).divisionId === legacyDiv.id);
  expect('une section ne se crée pas sous la Direction', await call('drh', 'POST', '/api/v1/unites', { type: 'SECTION', parentId: direction.id, code: `Z${S}`, libelle: 'Refus' }), 400);
  expect('une division ne se crée pas sous une section', await call('drh', 'POST', '/api/v1/unites', { type: 'DIVISION', parentId: sec.body.id, code: `Y${S}`, libelle: 'Refus' }), 400);
  expect('code déjà utilisé sous le même parent', await call('drh', 'POST', '/api/v1/unites', { type: 'SECTION', parentId: div.body.id, code: `S${S}`, libelle: 'Doublon' }), 409);
  const inst = await call('drh', 'POST', '/api/v1/unites', { type: 'INSTANCE', parentId: direction.id, code: `I${S}`, libelle: 'Instance test' });
  expect('le DRH crée une instance (support : cellule historique)', inst, 201);
  expect('renommer la section', await call('drh', 'PATCH', `/api/v1/unites/${sec.body.id}`, { libelle: 'Section renommée' }), 200);
  check('… renommage répercuté sur la ligne historique', (await prisma.section.findUnique({ where: { id: sec.body.sectionId } })).name === 'Section renommée');
  expect('instance → cellule', await call('drh', 'PATCH', `/api/v1/unites/${inst.body.id}`, { type: 'CELLULE' }), 200);
  expect('division → section refusé', await call('drh', 'PATCH', `/api/v1/unites/${div.body.id}`, { type: 'SECTION' }), 400);
  // Un agent dans la section : fermeture refusée.
  const nouveau = await call('admin', 'POST', '/users', { email: `n1${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'Nina', lastName: `Socle${S}`, role: 'AGENT', divisionId: legacyDiv.id, sectionId: sec.body.sectionId });
  expect('l’administrateur crée un compte dans la section', nouveau, 201);
  const aNouveau = await agentDe(nouveau.body.id);
  check('… son agent est créé et rattaché à la section', !!aNouveau && aNouveau.uniteId === sec.body.id && aNouveau.matriculeProvisoire);
  expect('fermer la division alors que la section est ouverte', await call('drh', 'POST', `/api/v1/unites/${div.body.id}/fermeture`, { motif: 'Réorganisation' }), 409);
  const refusFermeture = await call('drh', 'POST', `/api/v1/unites/${sec.body.id}/fermeture`, { motif: 'Réorganisation' });
  check(`fermer la section alors qu’un agent y est rattaché → 409 (« ${refusFermeture.body.message} »)`, refusFermeture.status === 409 && /agent/.test(refusFermeture.body.message));
  expect('fermeture sans motif', await call('drh', 'POST', `/api/v1/unites/${inst.body.id}/fermeture`, {}), 400);
  expect('un agent ne ferme pas une unité', await call('agent1', 'POST', `/api/v1/unites/${inst.body.id}/fermeture`, { motif: 'x' }), 403);
  expect('le DRH ferme l’unité vide', await call('drh', 'POST', `/api/v1/unites/${inst.body.id}/fermeture`, { motif: 'Instance dissoute' }), 201);
  check('… cellule historique désactivée', (await prisma.cellule.findUnique({ where: { id: inst.body.celluleId } })).isActive === false);
  expect('… fermer deux fois', await call('drh', 'POST', `/api/v1/unites/${inst.body.id}/fermeture`, { motif: 'x' }), 409);
  expect('… une unité fermée ne se modifie plus', await call('drh', 'PATCH', `/api/v1/unites/${inst.body.id}`, { libelle: 'x' }), 409);
  const hist = await call('agent1', 'GET', `/api/v1/unites/${inst.body.id}/historique`);
  check('historique : création, modification, fermeture, avec l’auteur', hist.status === 200 && ['CREATION', 'MODIFICATION', 'FERMETURE'].every((e) => hist.body.some((h) => h.evenement === e)) && hist.body.every((h) => h.auteur?.id === ids.drh));
  expect('la Direction ne se ferme pas', await call('drh', 'POST', `/api/v1/unites/${direction.id}/fermeture`, { motif: 'x' }), 409);
  expect('stagiaire : organigramme fermé par défaut', await brut('GET', '/api/v1/organigramme', null), 401);

  console.log('— Aucun compte sans agent : rapprochement et matricule');
  const drhAgent = await call('drh', 'POST', '/api/v1/agents', { nom: `Diallo${S}`, prenoms: 'Aïssata', genre: 'F', uniteId: uDpe.id, fonction: 'Chargée d’études', matricule: `FP${S}` });
  expect('le DRH crée un agent (sans compte) avec son matricule', drhAgent, 201);
  expect('matricule déjà attribué', await call('drh', 'POST', '/api/v1/agents', { nom: 'X', prenoms: 'Y', uniteId: uDpe.id, matricule: `FP${S}` }), 409);
  expect('un chef ne crée pas d’agent', await call('chefdpe', 'POST', '/api/v1/agents', { nom: 'X', prenoms: 'Y', uniteId: uDpe.id }), 403);
  const sansCompte = await call('admin', 'GET', '/api/v1/agents?sansCompte=true');
  check('l’administrateur voit les agents sans compte (identité et unité seulement)', sansCompte.status === 200 && sansCompte.body.donnees.some((a) => a.id === drhAgent.body.id) && sansCompte.body.donnees.every((a) => !('statut' in a) && !('compte' in a)));
  expect('… mais pas la liste complète des agents', await call('admin', 'GET', '/api/v1/agents'), 403);
  const lie = await call('admin', 'POST', '/users', { email: `lie${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'Aïssata', lastName: `Diallo${S}`, role: 'AGENT', divisionId: ids.DPE, agentId: drhAgent.body.id });
  expect('compte créé en le rattachant à l’agent existant', lie, 201);
  check('… rattachement effectif, pas de second agent', (await prisma.user.findUnique({ where: { id: lie.body.id } })).agentId === drhAgent.body.id && (await prisma.agent.count({ where: { nom: `Diallo${S}` } })) === 1);
  expect('un agent qui a déjà un compte n’en reçoit pas un second', await call('admin', 'POST', '/users', { email: `bis${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'A', lastName: 'B', role: 'AGENT', divisionId: ids.DPE, agentId: drhAgent.body.id }), 409);
  expect('matricule déjà attribué à un autre agent', await call('admin', 'POST', '/users', { email: `ter${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'A', lastName: 'B', role: 'AGENT', divisionId: ids.DPE, matricule: `FP${S}` }), 409);

  console.log('— Agents : lecture, modification, cycle de vie (DRH seul)');
  const liste = await call('drh', 'GET', '/api/v1/agents?statut=EN_ACTIVITE&taille=5');
  check('liste paginée { donnees, page, taille, total }', liste.status === 200 && liste.body.donnees.length <= 5 && liste.body.total > 5 && liste.body.page === 1);
  expect('un chef ne lit pas la liste des agents', await call('chefdpe', 'GET', '/api/v1/agents'), 403);
  const moi = await call('agent1', 'GET', `/api/v1/agents/${aAgent1.id}`);
  check('l’agent lit sa propre fiche, sans action possible', moi.status === 200 && moi.body.actions.length === 0);
  expect('… mais pas celle d’un collègue', await call('agent1', 'GET', `/api/v1/agents/${(await agentDe(ids.agent2)).id}`), 403);
  const nouveauMatricule = await call('drh', 'PATCH', `/api/v1/agents/${aNouveau.id}`, { matricule: `MAT${S}`, genre: 'F' });
  check('le DRH remplace le matricule provisoire', nouveauMatricule.status === 200 && nouveauMatricule.body.matricule === `MAT${S}` && nouveauMatricule.body.matriculeProvisoire === false);
  expect('… matricule d’un autre agent', await call('drh', 'PATCH', `/api/v1/agents/${aNouveau.id}`, { matricule: `FP${S}` }), 409);
  const aDrh = await agentDe(ids.drh);
  expect('le DRH ne change pas sa propre situation', await call('drh', 'POST', `/api/v1/agents/${aDrh.id}/suspension`, { motif: 'x' }), 403);
  expect('suspension sans motif', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/suspension`, {}), 400);
  expect('le DRH suspend l’agent', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/suspension`, { motif: 'Absence prolongée' }), 201);
  check('… compte suspendu : connexion refusée', (await prisma.user.findUnique({ where: { id: nouveau.body.id } })).status === 'SUSPENDU' && (await connexion(`n1${S.toLowerCase()}@test.local`)).status === 403);
  expect('… suspendre deux fois', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/suspension`, { motif: 'x' }), 409);
  expect('le DRH réactive', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/reactivation`, { motif: 'Retour' }), 201);
  check('… connexion rétablie', (await connexion(`n1${S.toLowerCase()}@test.local`)).status === 200);

  console.log('— Départ : compte désactivé, tâches transférées au chef, suppléances et rôles retirés');
  const tache = await call('dn', 'POST', '/tasks', { title: `Tâche du partant ${S}`, assignees: [{ userId: nouveau.body.id }] });
  expect('une tâche est confiée à l’agent', tache, 201);
  expect('départ dans le futur refusé (utiliser la fin prévue)', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/depart`, { dateDepart: iso(Date.now() + 5 * JOUR), motif: 'x' }), 400);
  expect('le DRH enregistre le départ', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/depart`, { dateDepart: iso(Date.now()), motif: 'Mutation hors DNPEC' }), 201);
  const partant = await prisma.user.findUnique({ where: { id: nouveau.body.id } });
  check('… compte désactivé', partant.status === 'SUPPRIME' && (await connexion(`n1${S.toLowerCase()}@test.local`)).status === 403);
  const assignes = await prisma.taskAssignee.findMany({ where: { taskId: tache.body.id } });
  check('… tâche transférée au premier responsable actif en remontant (section et division neuves sans chef → le DN, responsable de la Direction)', assignes.length === 1 && assignes[0].userId === ids.dn, JSON.stringify(assignes.map((a) => a.userId)));
  check('… dossier agent conservé, statut Parti', (await prisma.agent.findUnique({ where: { id: aNouveau.id } })).statut === 'PARTI');
  expect('… départ en double', await call('drh', 'POST', `/api/v1/agents/${aNouveau.id}/depart`, { dateDepart: iso(Date.now()), motif: 'x' }), 409);
  expect('… désormais l’unité se ferme', await call('drh', 'POST', `/api/v1/unites/${sec.body.id}/fermeture`, { motif: 'Réorganisation' }), 201);

  console.log('— Fin prévue : alertes J-15 et J-3, prolongation, confirmation, départ automatique');
  const cdd = await call('admin', 'POST', '/users', { email: `cdd${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'Kadiatou', lastName: `Contrat${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP });
  const aCdd = await agentDe(cdd.body.id);
  const fin = new Date(Date.now() + 20 * JOUR);
  expect('le DRH fixe une fin de contrat', await call('drh', 'PATCH', `/api/v1/agents/${aCdd.id}`, { dateFinPrevue: iso(fin), natureFinPrevue: 'CONTRAT' }), 200);
  const notifsDrh = () => prisma.notification.count({ where: { userId: ids.drh, channel: 'IN_APP', link: `/agents?id=${aCdd.id}` } });
  await fins.executer(new Date(fin.getTime() - 16 * JOUR));
  check('J-16 : aucune alerte', (await notifsDrh()) === 0);
  await fins.executer(new Date(fin.getTime() - 15 * JOUR));
  check('J-15 : alerte au DRH (notification + email)', (await notifsDrh()) === 1 && (await prisma.notification.count({ where: { userId: ids.drh, channel: 'EMAIL', link: `/agents?id=${aCdd.id}` } })) === 1);
  await fins.executer(new Date(fin.getTime() - 14 * JOUR));
  check('J-14 : pas de doublon', (await notifsDrh()) === 1);
  await fins.executer(new Date(fin.getTime() - 3 * JOUR));
  check('J-3 : rappel au DRH', (await notifsDrh()) === 2);
  expect('prolongation sans motif', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/prolongation`, { nouvelleDateFin: iso(fin.getTime() + 30 * JOUR) }), 400);
  expect('prolongation avant la fin actuelle', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/prolongation`, { nouvelleDateFin: iso(fin.getTime() - JOUR), motif: 'x' }), 400);
  expect('un chef ne prolonge pas', await call('chefdpe', 'POST', `/api/v1/agents/${aCdd.id}/prolongation`, { nouvelleDateFin: iso(fin.getTime() + 30 * JOUR), motif: 'x' }), 403);
  const nouvelleFin = new Date(fin.getTime() + 30 * JOUR);
  expect('le DRH prolonge le contrat', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/prolongation`, { nouvelleDateFin: iso(nouvelleFin), motif: 'Renouvellement du contrat' }), 201);
  await fins.executer(new Date(fin.getTime() + JOUR));
  check('… à l’ancienne échéance : aucune désactivation', (await prisma.agent.findUnique({ where: { id: aCdd.id } })).statut === 'EN_ACTIVITE' && (await prisma.user.findUnique({ where: { id: cdd.body.id } })).status === 'ACTIF');
  await fins.executer(new Date(nouvelleFin.getTime() - 15 * JOUR));
  check('… nouvelles alertes calculées sur la nouvelle date', (await notifsDrh()) === 3);
  expect('le DRH confirme la fin', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/confirmation-fin`), 201);
  expect('… confirmer deux fois', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/confirmation-fin`), 409);
  await fins.executer(new Date(nouvelleFin.getTime() - 3 * JOUR));
  check('… fin confirmée : pas de rappel J-3', (await notifsDrh()) === 3);
  await fins.executer(new Date(nouvelleFin.getTime()));
  check('… le jour de la fin (dernier jour de présence) : toujours actif', (await prisma.user.findUnique({ where: { id: cdd.body.id } })).status === 'ACTIF');
  await fins.executer(new Date(nouvelleFin.getTime() + JOUR));
  const apres = await prisma.agent.findUnique({ where: { id: aCdd.id } });
  check('… lendemain : « Parti » et compte désactivé automatiquement', apres.statut === 'PARTI' && (await prisma.user.findUnique({ where: { id: cdd.body.id } })).status === 'SUPPRIME');
  check('… DRH notifié le jour même', (await notifsDrh()) === 4);
  const b2 = await fins.executer(new Date(nouvelleFin.getTime() + 2 * JOUR));
  check('… idempotent', b2.departs === 0 && (await notifsDrh()) === 4);
  // Les dates simulées ci-dessus sont dans le futur : l’échéance est ramenée à hier pour juger la réactivation au temps réel.
  await prisma.agent.update({ where: { id: aCdd.id }, data: { dateFinPrevue: new Date(Date.now() - JOUR) } });
  expect('réactivation sans nouvelle date alors que la fin est passée', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/reactivation`, { motif: 'Nouveau contrat' }), 400);
  expect('réactivation par le DRH avec une nouvelle date de fin', await call('drh', 'POST', `/api/v1/agents/${aCdd.id}/reactivation`, { motif: 'Nouveau contrat', nouvelleDateFin: iso(Date.now() + 90 * JOUR) }), 201);
  check('… compte réactivé, connexion possible', (await connexion(`cdd${S.toLowerCase()}@test.local`)).status === 200);

  console.log('— Rôles fonctionnels : attribution, retrait, reflets, jamais empruntés');
  expect('un DRH n’attribue pas de rôle', await call('drh', 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'GESTIONNAIRE_RH' }), 403);
  expect('Agent du courrier : s’attribue depuis le Courrier', await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'AGENT_COURRIER' }), 400);
  expect('rôle du domaine B : pas encore utilisé', await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'ANALYSTE' }), 400);
  const grh = await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'GESTIONNAIRE_RH', motif: 'Note de service' });
  expect('l’administrateur attribue Gestionnaire RH', grh, 201);
  expect('… en double sur la même période', await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'GESTIONNAIRE_RH' }), 409);
  check('… le gestionnaire RH lit la liste des agents', (await call('agent2', 'GET', '/api/v1/agents')).status === 200);
  check('… mais n’agit pas sur leur cycle de vie', (await call('agent2', 'POST', `/api/v1/agents/${aAgent1.id}/suspension`, { motif: 'x' })).status === 403);
  expect('retrait sans motif', await call('admin', 'POST', `/api/v1/attributions-roles/${grh.body.id}/retrait`, {}), 400);
  expect('l’administrateur retire le rôle', await call('admin', 'POST', `/api/v1/attributions-roles/${grh.body.id}/retrait`, { motif: 'Fin de mission' }), 201);
  check('… retrait immédiat (liste des agents refusée)', (await call('agent2', 'GET', '/api/v1/agents')).status === 403);
  expect('… retirer deux fois', await call('admin', 'POST', `/api/v1/attributions-roles/${grh.body.id}/retrait`, { motif: 'x' }), 409);
  check('… l’attribution reste dans l’historique', !!(await prisma.attributionRole.findUnique({ where: { id: grh.body.id } })).retireLe);
  const drhDonne = await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.agentdee, role: 'DRH', motif: 'Intérim de la fonction RH' });
  expect('un agent reçoit le rôle DRH', drhDonne, 201);
  check('… il exerce aussitôt (import du personnel ouvert, dossiers niveau 2)', (await call('agentdee', 'GET', `/personnel-files/${ids.agent1}`)).status === 200);
  await call('admin', 'POST', `/api/v1/attributions-roles/${drhDonne.body.id}/retrait`, { motif: 'Fin' });
  check('… et plus du tout après le retrait', (await call('agentdee', 'GET', `/personnel-files/${ids.agent1}`)).status === 403);
  const mes = await call('agent1', 'GET', '/api/v1/attributions-roles');
  check('chacun ne voit que ses propres rôles', mes.status === 200 && mes.body.attributions.every((a) => a.user.id === ids.agent1) && mes.body.droits.peutAttribuer === false);
  // Reflets : habilitation logistique → Gestionnaire logistique.
  const hLog = await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agent2 });
  expect('habilitation logistique accordée depuis son écran', hLog, 201);
  check('… reflet : rôle Gestionnaire logistique actif', (await actifs(ids.agent2, 'GESTIONNAIRE_LOGISTIQUE')) === 1);
  await call('admin', 'POST', `/logistique/habilitations/${hLog.body.id}/revoquer`);
  check('… révocation reflétée', (await actifs(ids.agent2, 'GESTIONNAIRE_LOGISTIQUE')) === 0);
  // Intérim : la position s'emprunte, les rôles fonctionnels jamais.
  const val = await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.chefsfp, role: 'VALIDATEUR' });
  const debut = new Date(Date.now() - 60e3).toISOString(); const finS = new Date(Date.now() + 2 * JOUR).toISOString();
  const sup = await call('chefsfp', 'POST', '/suppleances', { titulaireId: ids.chefsfp, suppleantId: ids.chefssr, startDate: debut, endDate: finS });
  expect('le chef SFP désigne le chef SSR comme suppléant', sup, 201);
  const meInterim = await call('chefssr', 'GET', '/auth/me', undefined, { 'X-Interim-For': ids.chefsfp });
  check('en intérim : le rôle Validateur du titulaire n’est pas emprunté', meInterim.status === 200 && !meInterim.body.rolesFonctionnels.includes('VALIDATEUR'));
  await call('chefsfp', 'POST', `/suppleances/${sup.body.id}/revoke`);
  await call('admin', 'POST', `/api/v1/attributions-roles/${val.body.id}/retrait`, { motif: 'Fin du test' });

  console.log('— Changement de rôle : responsable d’unité et rôle DRH suivent');
  const chef = await call('admin', 'POST', `/users/${ids.agent2}/role`, { role: 'CHEF_SECTION', roleAttendu: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR, motif: 'Nomination' });
  if (chef.status === 201 || chef.status === 200) {
    const uSsr = await prisma.uniteOrganisationnelle.findUnique({ where: { sectionId: ids.SSR } });
    check('chef de section en double : poste signalé (responsable vide)', uSsr.responsableId === null || uSsr.responsableId === ids.chefssr);
  } else {
    check(`changement de rôle refusé par ses propres règles (${chef.status}) : l’unité garde son responsable`, (await prisma.uniteOrganisationnelle.findUnique({ where: { sectionId: ids.SSR } })).responsableId === ids.chefssr);
  }

  await app.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
