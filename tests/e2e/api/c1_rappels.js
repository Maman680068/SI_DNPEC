// D7 — rappels d'échéance : vrai service (contexte Nest), dates simulées, idempotence (redémarrage, 2 instances).
const E = require('../config');
require('reflect-metadata');
const D = E.API_DIST;
const { NestFactory } = require('@nestjs/core');
const { call, upload, ids, check, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5;
const ctx = async () => {
  const { AppModule } = require(D + '/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  return { app, svc: app.get(require(D + '/courrier/rappels.service').CourrierRappelsService) };
};
(async () => {
  const S = Date.now().toString(36);
  const mk = async (objet, conf) => (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: new Date().toISOString(), expediteur: 'Test rappel', objet, confidentialite: conf })).body;
  const echeance = new Date(Date.now() + 3 * J).toISOString();
  const aO = await mk(`Rappel ordinaire ${S}`, 'ORDINAIRE');
  const aC = await mk(`Rappel secret ${S}`, 'CONFIDENTIEL');
  const aT = await mk(`Rappel traité ${S}`, 'ORDINAIRE');
  const aA = await mk(`Rappel annulé ${S}`, 'ORDINAIRE');
  const imp = {};
  for (const [k, a] of Object.entries({ O: aO, C: aC, T: aT, A: aA })) imp[k] = (await call('dn', 'POST', `/courrier/arrivees/${a.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', echeance })).body.id;
  await call('chefdpe', 'POST', `/courrier/imputations/${imp.T}/traiter`, { compteRendu: 'Fait' });
  await call('secdg', 'POST', `/courrier/arrivees/${aA.id}/annuler`, { motif: 'Test des rappels' });
  const etat = async () => Object.fromEntries(await Promise.all(Object.entries(imp).map(async ([k, id]) => [k, await prisma.imputationCourrier.findUnique({ where: { id }, select: { rappelEcheanceEnvoyeAt: true, rappelRetardEnvoyeAt: true } })])));
  const notifs = async (type, a) => prisma.notification.findMany({ where: { type, link: `/courrier?arrivee=${a.id}`, channel: 'EMAIL' } });

  let { app, svc } = await ctx();
  const t0 = Date.now();
  await svc.envoyerRappels(new Date(t0));
  let e = await etat();
  check('J-3 (maintenant) : aucun rappel', !e.O.rappelEcheanceEnvoyeAt && !e.C.rappelEcheanceEnvoyeAt);
  await svc.envoyerRappels(new Date(t0 + 1.5 * J));
  e = await etat();
  check('J-1,5 (simulé) : rappel d’échéance pour les 2 imputations en cours', !!e.O.rappelEcheanceEnvoyeAt && !!e.C.rappelEcheanceEnvoyeAt);
  check('aucun rappel pour l’imputation traitée ni pour le courrier annulé', !e.T.rappelEcheanceEnvoyeAt && !e.A.rappelEcheanceEnvoyeAt);
  await svc.envoyerRappels(new Date(t0 + 1.6 * J));
  const nO = await notifs('IMPUTATION_ECHEANCE_PROCHE', aO), nC = await notifs('IMPUTATION_ECHEANCE_PROCHE', aC);
  check('rappel d’échéance envoyé une seule fois (2e passage sans effet)', nO.length === 1 && nC.length === 1, `${nO.length} / ${nC.length}`);
  check('email ORDINAIRE : objet présent ; CONFIDENTIEL : objet absent', nO[0].body.includes('Rappel ordinaire') && !nC[0].body.includes('Rappel secret'), nC[0].body);
  await svc.envoyerRappels(new Date(t0 + 3.5 * J));
  e = await etat();
  check('J+0,5 (échéance dépassée, pas encore le lendemain) : pas de rappel de retard', !e.O.rappelRetardEnvoyeAt);
  await app.close();

  // « Redémarrage » : nouveau contexte, puis deux instances en parallèle au lendemain de l'échéance.
  ({ app, svc } = await ctx());
  const second = await ctx();
  const sim = new Date(t0 + 4.2 * J);
  await Promise.all([svc.envoyerRappels(sim), second.svc.envoyerRappels(sim), svc.envoyerRappels(sim)]);
  e = await etat();
  const rO = await notifs('IMPUTATION_EN_RETARD', aO), rC = await notifs('IMPUTATION_EN_RETARD', aC);
  check('lendemain de l’échéance : rappel de retard posé', !!e.O.rappelRetardEnvoyeAt && !!e.C.rappelRetardEnvoyeAt);
  const dest = (n) => [...new Set(n.map((x) => x.userId))].sort().join(',');
  check('retard notifié UNE fois à l’imputé et à l’imputant, malgré 3 passages concurrents (2 instances)', rO.length === 2 && rC.length === 2 && dest(rO) === [ids.chefdpe, ids.dn].sort().join(','), `${rO.length} / ${rC.length}`);
  check('email de retard CONFIDENTIEL sans objet', rC.every((n) => !n.body.includes('Rappel secret')), rC[0] && rC[0].body);
  await svc.envoyerRappels(new Date(t0 + 9 * J));
  check('après redémarrage et plusieurs jours : aucun doublon', (await notifs('IMPUTATION_EN_RETARD', aO)).length === 2 && (await notifs('IMPUTATION_ECHEANCE_PROCHE', aO)).length === 1);
  check('rappels audités (acteur système)', (await prisma.auditLog.count({ where: { entityType: 'ImputationCourrier', entityId: imp.O, actorId: null } })) === 2);
  await app.close(); await second.app.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(1); });
