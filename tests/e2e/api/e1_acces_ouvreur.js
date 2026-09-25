// E1 — un accès délégué ne vaut que si l'ouvreur a encore lui-même le droit (réévalué à chaque lecture).
const E = require('../config');
const { call, upload, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36);
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
const vu = async (k, id) => (await call(k, 'GET', `/courrier/arrivees/${id}`)).status;
(async () => {
  const saf = await prisma.cellule.findUnique({ where: { code: 'SAF' } });
  const asssaf = await prisma.user.findUnique({ where: { id: ids.asssaf }, select: { supervisorId: true } });
  check('(préparation) asssaf est l’assistante de chefsaf', asssaf.supervisorId === ids.chefsaf);
  const h = await call('admin', 'POST', '/courrier/habilitations', { userId: ids.secdg, registreId: reg.ARRU, uniteKey: `CEL:${saf.id}` });
  check('(préparation) secdg habilitée sur le registre de la cellule SAF', h.status === 201 || h.status === 409);

  console.log('— Accès « assistant » : l’ouvreur (chef de la cellule) perd son droit');
  const A = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARRU, uniteKey: `CEL:${saf.id}`, dateReception: iso(0), expediteur: 'Test', objet: `E1 assistant ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  expect('chefsaf ouvre l’accès à son assistante', await call('chefsaf', 'POST', `/courrier/arrivees/${A.id}/acces-delegues`, { beneficiaireId: ids.asssaf }), 201);
  check('asssaf voit le courrier', (await vu('asssaf', A.id)) === 200);
  await prisma.user.update({ where: { id: ids.chefsaf }, data: { role: 'AGENT' } });
  try {
    check('chefsaf n’est plus chef : elle-même n’a plus accès', (await vu('chefsaf', A.id)) === 403);
    check('… et l’accès de son assistante tombe aussitôt', (await vu('asssaf', A.id)) === 403);
    check('… aussi dans la liste et l’export', !(await call('asssaf', 'GET', '/courrier/arrivees')).body.some((x) => x.id === A.id));
  } finally {
    await prisma.user.update({ where: { id: ids.chefsaf }, data: { role: 'CHEF_CELLULE' } });
  }
  check('droit rendu à l’ouvreur : l’accès (non révoqué) revaut', (await vu('asssaf', A.id)) === 200);

  console.log('— Accès « suppléant » : l’ouvreur est suspendu');
  await suppleance('chefdpe', 'chefdee');
  const U = (await upload('secdpe', '/courrier/arrivees', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, dateReception: iso(0), expediteur: 'Test', objet: `E1 suppléant ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  expect('chefdpe ouvre l’accès à son suppléant', await call('chefdpe', 'POST', `/courrier/arrivees/${U.id}/acces-delegues`, { beneficiaireId: ids.chefdee }), 201);
  check('chefdee (suppléant) voit le courrier de la DPE', (await vu('chefdee', U.id)) === 200);
  await prisma.user.update({ where: { id: ids.chefdpe }, data: { status: 'SUSPENDU' } });
  try {
    check('ouvreur suspendu : l’accès du suppléant tombe', (await vu('chefdee', U.id)) === 403);
  } finally {
    await prisma.user.update({ where: { id: ids.chefdpe }, data: { status: 'ACTIF' } });
  }
  check('ouvreur réactivé : l’accès revaut', (await vu('chefdee', U.id)) === 200);

  console.log('— Ouvreur dont le droit vient d’une imputation nominative (inchangé)');
  const K = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: iso(0), expediteur: 'Test', objet: `E1 imputé ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  await call('dn', 'POST', `/courrier/arrivees/${K.id}/imputations`, { imputeAId: ids.chefsaf, nature: 'ATTRIBUTION' });
  expect('chefsaf (imputée) ouvre à son assistante', await call('chefsaf', 'POST', `/courrier/arrivees/${K.id}/acces-delegues`, { beneficiaireId: ids.asssaf }), 201);
  check('asssaf voit ce courrier', (await vu('asssaf', K.id)) === 200);
  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.user.update({ where: { id: ids.chefsaf }, data: { role: 'CHEF_CELLULE' } }); await prisma.user.update({ where: { id: ids.chefdpe }, data: { status: 'ACTIF' } }); process.exit(2); });
