// Comptes et habilitations — GET api/v1/comptes/synthese : pour chaque compte, ses rôles fonctionnels
// actifs (libellés calculés par l'API) et l'état de la double authentification (jamais le secret) ; les
// agents en activité du socle sans compte. Administrateur : tout, avec « Ouvrir un compte » ; DN et DNA :
// lecture seule ; tout autre profil, et tout intérim : 403. « Aucun compte sans agent » inchangé.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const URL = '/api/v1/comptes/synthese';
const J = 864e5;
// Suppléances laissées actives par une suite précédente : retirées pour ces titulaires (données de test).
const liberer = (titulaires) => prisma.suppleance.updateMany({ where: { titulaireId: { in: titulaires }, revokedAt: null, endDate: { gt: new Date() } }, data: { revokedAt: new Date() } });

(async () => {
  console.log('— Accès');
  check('sans session : 401', (await fetch(BASE + URL)).status === 401);
  const stg = (await call('admin', 'POST', '/users', { email: `cst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `CompteStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'chefsaf', 'drh', 'assdn', `cst${S}`]) expect(`${k} : refusé`, await call(k, 'GET', URL), 403);
  const a = await call('admin', 'GET', URL);
  expect('administrateur : synthèse lue', a, 200);
  check('administrateur : « Ouvrir un compte » permis', a.body.droits.ouvrirCompte === true);
  for (const k of ['dn', 'dna']) {
    const r = await call(k, 'GET', URL);
    expect(`${k} : lecture`, r, 200);
    check(`${k} : lecture seule, mêmes comptes que l’administrateur`, r.body.droits.ouvrirCompte === false && r.body.comptes.length === a.body.comptes.length);
  }
  const attendus = await prisma.user.count({ where: { status: { not: 'EN_ATTENTE' } } });
  check(`tous les comptes (hors inscriptions en attente) : ${attendus}`, a.body.comptes.length === attendus, a.body.comptes.length);

  console.log('— Rôles fonctionnels : libellés calculés par l’API');
  const ligne = (b, id) => b.comptes.find((c) => c.id === id);
  check('DRH : « Directeur des Ressources Humaines »', ligne(a.body, ids.drh).rolesFonctionnels.includes('Directeur des Ressources Humaines'), JSON.stringify(ligne(a.body, ids.drh)));
  const val = await call('admin', 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'VALIDATEUR' });
  expect('rôle Validateur attribué à agent2', val, 201);
  check('… affiché aussitôt', ligne((await call('admin', 'GET', URL)).body, ids.agent2).rolesFonctionnels.includes('Validateur'));
  await call('admin', 'POST', `/api/v1/attributions-roles/${val.body.id}/retrait`, { motif: 'Fin du test' });
  check('… et plus après le retrait', !ligne((await call('admin', 'GET', URL)).body, ids.agent2).rolesFonctionnels.includes('Validateur'));

  console.log('— Double authentification : état seulement, jamais le secret');
  const SECRET = `SECRET-${S}-NE-SORT-PAS`;
  await prisma.user.update({ where: { id: ids.agent2 }, data: { twoFactorEnabled: true, twoFactorSecret: SECRET } });
  const b2 = await call('admin', 'GET', URL);
  check('agent2 : « Activée » ; agent1 : « Non »', ligne(b2.body, ids.agent2).doubleAuthentification === true && ligne(b2.body, ids.agent1).doubleAuthentification === false);
  const texte = JSON.stringify(b2.body) + JSON.stringify((await call('dn', 'GET', URL)).body) + JSON.stringify((await call('admin', 'GET', '/users')).body);
  check('aucun secret dans une réponse (synthèse, liste des comptes)', !texte.includes(SECRET) && !/twoFactorSecret/.test(texte));
  await prisma.user.update({ where: { id: ids.agent2 }, data: { twoFactorEnabled: false, twoFactorSecret: null } });

  console.log('— Agents sans compte');
  const unite = await prisma.uniteOrganisationnelle.findFirst({ select: { id: true, libelle: true } });
  const sans = await prisma.agent.create({ data: { matricule: `CS${S}`.toUpperCase(), nom: `SansCompte${S}`, prenoms: 'Mariama', fonction: 'Chargée d’études', uniteId: unite.id } });
  const parti = await prisma.agent.create({ data: { matricule: `CP${S}`.toUpperCase(), nom: `Parti${S}`, prenoms: 'Ibrahima', statut: 'PARTI' } });
  const b3 = (await call('admin', 'GET', URL)).body;
  const l = b3.agentsSansCompte.find((x) => x.id === sans.id);
  check('agent en activité sans compte listé : matricule, nom, fonction, unité, date de création', l && l.matricule === sans.matricule && l.nom === sans.nom && l.prenoms === 'Mariama' && l.fonction === 'Chargée d’études' && l.unite === unite.libelle && l.dateCreation === new Date().toISOString().slice(0, 10), JSON.stringify(l));
  const avecCompte = await prisma.user.findUnique({ where: { id: ids.agent1 }, select: { agentId: true } });
  check('agent parti : absent ; agent d’un compte existant (agent1) : absent', !b3.agentsSansCompte.some((x) => x.id === parti.id) && !!avecCompte.agentId && !b3.agentsSansCompte.some((x) => x.id === avecCompte.agentId));
  check('DN : même liste, sans droit d’ouvrir', (await call('dn', 'GET', URL)).body.agentsSansCompte.some((x) => x.id === sans.id));
  expect('DN : création de compte refusée', await call('dn', 'POST', '/users', { email: `cs${S}@test.local`, password: 'Password123!', firstName: 'Mariama', lastName: sans.nom, role: 'AGENT', divisionId: ids.DPE, agentId: sans.id }), 403);
  const ouvert = await call('admin', 'POST', '/users', { email: `cs${S}@test.local`, password: 'Password123!', firstName: 'Mariama', lastName: sans.nom, role: 'AGENT', divisionId: ids.DPE, agentId: sans.id });
  expect('administrateur : « Ouvrir un compte » (création rattachée à l’agent)', ouvert, 201);
  check('… compte rattaché à l’agent, qui quitte la liste', (await prisma.user.findUnique({ where: { id: ouvert.body.id } })).agentId === sans.id && !(await call('admin', 'GET', URL)).body.agentsSansCompte.some((x) => x.id === sans.id));
  expect('agent parti : compte refusé (409)', await call('admin', 'POST', '/users', { email: `cp${S}@test.local`, password: 'Password123!', firstName: 'Ibrahima', lastName: parti.nom, role: 'AGENT', divisionId: ids.DPE, agentId: parti.id }), 409);

  console.log('— Intérim : rien n’est emprunté');
  await liberer([ids.dn]);
  const sup = await call('dn', 'POST', '/suppleances', { titulaireId: ids.dn, suppleantId: ids.chefdpe, startDate: new Date(Date.now() - 60e3).toISOString(), endDate: new Date(Date.now() + J).toISOString() });
  expect('suppléance de test (DN → chef DPE)', sup, 201);
  check('chef DPE en intérim du DN : l’intérim est bien actif (rôle DN emprunté)', (await call('chefdpe', 'GET', '/auth/me', undefined, { 'X-Interim-For': ids.dn })).status === 200);
  expect('chef DPE en intérim du DN : synthèse refusée', await call('chefdpe', 'GET', URL, undefined, { 'X-Interim-For': ids.dn }), 403);
  await call('dn', 'POST', `/suppleances/${sup.body.id}/revoke`);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
