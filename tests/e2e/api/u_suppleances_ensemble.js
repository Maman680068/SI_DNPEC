// Suppléances — vue d'ensemble « Toutes les suppléances en cours » (GET /suppleances/en-cours), en lecture
// seule pour le DN, la DNA et l'administrateur (unité, titulaire, suppléant, période, statut) ; tout autre
// profil : pas d'onglet (droits) et 403 sur la route ; rien n'est emprunté en intérim.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5;
const t = (n) => new Date(Date.now() + n).toISOString();

(async () => {
  console.log('— Jeu : une suppléance en cours, une à venir, une révoquée, une en cours pour le DN');
  const enCours = await call('chefsfp', 'POST', '/suppleances', { titulaireId: ids.chefsfp, suppleantId: ids.chefssr, startDate: t(-60e3), endDate: t(2 * J) });
  expect('en cours : chef SFP → chef SSR', enCours, 201);
  const aVenir = await call('chefse', 'POST', '/suppleances', { titulaireId: ids.chefse, suppleantId: ids.chefdee, startDate: t(3 * J), endDate: t(5 * J) });
  expect('à venir : chef SE → chef DEE', aVenir, 201);
  const revoquee = await call('chefdee', 'POST', '/suppleances', { titulaireId: ids.chefdee, suppleantId: ids.chefdpe, startDate: t(-60e3), endDate: t(J) });
  expect('chef DEE → chef DPE, puis révoquée', revoquee, 201);
  await call('chefdee', 'POST', `/suppleances/${revoquee.body.id}/revoke`);
  const dn = await call('dn', 'POST', '/suppleances', { titulaireId: ids.dn, suppleantId: ids.chefdpe, startDate: t(-60e3), endDate: t(J) });
  expect('en cours : DN → chef DPE', dn, 201);

  console.log('— DN, DNA, administrateur : onglet et lecture');
  for (const k of ['dn', 'dna', 'admin']) {
    check(`${k} : onglet « Toutes les suppléances en cours » permis par l’API`, (await call(k, 'GET', '/suppleances/droits')).body.voirToutes === true);
    const r = await call(k, 'GET', '/suppleances/en-cours');
    expect(`${k} : vue d’ensemble lue`, r, 200);
    const idsL = r.body.map((x) => x.id);
    check(`${k} : les suppléances en cours seulement (ni à venir, ni révoquée)`, idsL.includes(enCours.body.id) && idsL.includes(dn.body.id) && !idsL.includes(aVenir.body.id) && !idsL.includes(revoquee.body.id));
  }
  const l = (await call('dn', 'GET', '/suppleances/en-cours')).body;
  const ligne = l.find((x) => x.id === enCours.body.id);
  const [tit, sup] = await Promise.all([ids.chefsfp, ids.chefssr].map((id) => prisma.user.findUnique({ where: { id } })));
  check('ligne : unité du titulaire, titulaire, suppléant, période, statut « EN_COURS »', ligne.unite.includes('·') && ligne.titulaire === `${tit.firstName} ${tit.lastName}` && ligne.suppleant === `${sup.firstName} ${sup.lastName}` && !!ligne.debut && !!ligne.fin && ligne.statut === 'EN_COURS', JSON.stringify(ligne));
  check('suppléance du DN : unité « Direction »', l.find((x) => x.id === dn.body.id).unite === 'Direction');
  check('lecture seule : aucune action ni identifiant de personne dans la réponse', l.every((x) => Object.keys(x).sort().join() === 'debut,fin,id,statut,suppleant,titulaire,unite'));

  console.log('— Autres profils : pas d’onglet, 403');
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'chefsaf', 'drh', 'assdn']) {
    check(`${k} : pas d’onglet`, (await call(k, 'GET', '/suppleances/droits')).body.voirToutes === false);
    expect(`${k} : vue d’ensemble refusée`, await call(k, 'GET', '/suppleances/en-cours'), 403);
  }

  console.log('— Intérim : rien n’est emprunté');
  const h = { 'X-Interim-For': ids.dn };
  check('chef DPE en intérim du DN : pas d’onglet', (await call('chefdpe', 'GET', '/suppleances/droits', undefined, h)).body.voirToutes === false);
  expect('chef DPE en intérim du DN : vue d’ensemble refusée', await call('chefdpe', 'GET', '/suppleances/en-cours', undefined, h), 403);

  for (const [k, s] of [['chefsfp', enCours], ['chefse', aVenir], ['dn', dn]]) await call(k, 'POST', `/suppleances/${s.body.id}/revoke`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
