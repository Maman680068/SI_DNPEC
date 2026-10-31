// S9b — Utilisateurs : cinq chiffres calculés par l'API (actifs ; suspendus dont démonstration ; inscriptions
// à examiner ; actifs sans double authentification ; jamais connectés), sécurité par compte (2FA, dernière
// connexion tirée du journal des connexions), sigle d'unité, marque de démonstration ; « Envoyer un rappel »
// (notification et e-mail immédiat vers « Mon profil ») et « Renvoyer l'invitation » (compte jamais utilisé),
// réservés à l'administrateur, inscrits au journal. Droits inchangés : DN et DNA lisent, les autres 403.
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const URL = '/api/v1/comptes/synthese';

(async () => {
  await login('agent1'); // une connexion réussie au journal, quel que soit l'ordre des suites
  console.log('— Jeu : un compte de démonstration suspendu, un compte neuf jamais utilisé, un DRH sans 2FA');
  const demo = (await call('admin', 'POST', '/users', { email: `s9b${S}@demo.dnpec.test`, password: 'Password123!', firstName: 'TEST — Demo', lastName: `S9b${S}`, role: 'AGENT', divisionId: ids.DPE })).body;
  await call('admin', 'PATCH', `/users/${demo.id}/status`, { status: 'SUSPENDU' });
  const neuf = await call('admin', 'POST', '/users', { email: `s9bn${S}@test.local`, password: 'Password123!', firstName: 'Neuf', lastName: `S9b${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR });
  expect('compte neuf créé', neuf, 201);
  await prisma.user.update({ where: { id: ids.drh }, data: { twoFactorEnabled: false } });

  const r = await call('admin', 'GET', URL);
  expect('administrateur : synthèse', r, 200);
  const b = r.body;
  console.log('— Chiffres recalculés en base');
  const comptes = await prisma.user.findMany({ where: { status: { not: 'EN_ATTENTE' } }, select: { id: true, email: true, status: true, twoFactorEnabled: true, role: true } });
  const vus = new Set((await prisma.journalConnexion.findMany({ where: { resultat: 'SUCCES', userId: { not: null } }, select: { userId: true }, distinct: ['userId'] })).map((x) => x.userId));
  const actifs = comptes.filter((c) => c.status === 'ACTIF');
  const susp = comptes.filter((c) => c.status === 'SUSPENDU');
  const sans = actifs.filter((c) => !c.twoFactorEnabled);
  const attendu = {
    actifs: actifs.length,
    suspendus: susp.length,
    suspendusDemonstration: susp.filter((c) => c.email.endsWith('@demo.dnpec.test')).length,
    inscriptionsAExaminer: await prisma.user.count({ where: { status: 'EN_ATTENTE' } }),
    actifsSansDoubleAuthentification: sans.length,
    droitsElevesSansDoubleAuthentification: sans.filter((c) => ['ADMIN_SYSTEME', 'DN', 'DNA', 'DRH'].includes(c.role)).length,
    jamaisConnectes: actifs.filter((c) => !vus.has(c.id)).length,
  };
  check('les sept valeurs des chiffres sont celles de la base', JSON.stringify(b.chiffres) === JSON.stringify(attendu), `${JSON.stringify(b.chiffres)} / ${JSON.stringify(attendu)}`);
  check('suspendus dont démonstration : au moins le compte de test', b.chiffres.suspendusDemonstration >= 1);
  check('droits élevés sans 2FA : le DRH compté', b.chiffres.droitsElevesSansDoubleAuthentification >= 1);

  console.log('— Lignes : sécurité, unité, démonstration');
  const l = (id) => b.comptes.find((c) => c.id === id);
  check('agent1 : dernière connexion connue (journal des connexions)', !!l(ids.agent1).derniereConnexion && !l(ids.agent1).renvoyerInvitation);
  check('compte neuf : jamais connecté, « Renvoyer l’invitation » permis', l(neuf.body.id).derniereConnexion === null && l(neuf.body.id).renvoyerInvitation === true);
  check('compte neuf : sigle d’unité « DPE · SSR »', l(neuf.body.id).sigleUnite === 'DPE · SSR', l(neuf.body.id).sigleUnite);
  check('DRH : droits élevés ; agent1 : non', l(ids.drh).droitsEleves === true && l(ids.agent1).droitsEleves === false);
  check('compte @demo.dnpec.test marqué « démonstration » ; agent1 non', l(demo.id).demonstration === true && l(ids.agent1).demonstration === false);
  check('compte suspendu : pas d’invitation à renvoyer', l(demo.id).renvoyerInvitation === false);
  check('administrateur : rappel, inscriptions, ouverture permis', b.droits.envoyerRappel && b.droits.examinerInscriptions && b.droits.ouvrirCompte);
  const d = (await call('dn', 'GET', URL)).body;
  check('DN : lecture seule (aucune action, aucune invitation à renvoyer)', !d.droits.envoyerRappel && !d.droits.examinerInscriptions && d.comptes.every((c) => !c.renvoyerInvitation));
  check('aucun secret de double authentification dans la réponse', !/twoFactorSecret|passwordHash/.test(JSON.stringify(b)));
  for (const k of ['agent1', 'drh', 'chefdpe']) expect(`${k} : synthèse refusée`, await call(k, 'GET', URL), 403);

  console.log('— « Envoyer un rappel »');
  for (const k of ['dn', 'dna', 'drh', 'agent1']) expect(`${k} : rappel refusé`, await call(k, 'POST', '/api/v1/comptes/rappel-double-authentification'), 403);
  const avant = new Date();
  const rap = await call('admin', 'POST', '/api/v1/comptes/rappel-double-authentification');
  expect('administrateur : rappel envoyé', rap, 200);
  const cibles = (await prisma.user.findMany({ where: { status: 'ACTIF', twoFactorEnabled: false }, select: { email: true } })).filter((u) => !u.email.endsWith('@demo.dnpec.test')).length;
  check(`nombre de personnes prévenues : ${cibles} (comptes actifs sans 2FA, hors démonstration)`, rap.body.personnes === cibles, rap.body.personnes);
  const n = await prisma.notification.findMany({ where: { userId: ids.drh, createdAt: { gte: avant }, title: 'Activez la double authentification' } });
  check('DRH : notification et e-mail immédiat, lien « Mon profil »', n.some((x) => x.channel === 'IN_APP' && x.link === '/compte?section=securite') && n.some((x) => x.channel === 'EMAIL' && !!x.sentAt) && /Mon profil/.test(n[0].body));
  const a = await prisma.auditLog.findFirst({ where: { createdAt: { gte: avant }, entityType: 'User', metadata: { path: ['event'], equals: 'rappel_double_authentification' } } });
  check('rappel inscrit au journal (nombre de personnes)', !!a && a.metadata.personnes === cibles);
  const j = (await call('admin', 'GET', '/api/v1/journal-audit?q=compte')).body;
  check('journal : phrase « a envoyé un rappel de double authentification »', j.entrees.some((e) => /a envoyé un rappel de double authentification/.test(e.phrase)));

  console.log('— « Renvoyer l’invitation »');
  const url = (id) => `/api/v1/comptes/${id}/renvoyer-invitation`;
  for (const k of ['dn', 'drh']) expect(`${k} : renvoi refusé`, await call(k, 'POST', url(neuf.body.id)), 403);
  const jetons = await prisma.passwordResetToken.count({ where: { userId: neuf.body.id } });
  expect('administrateur : invitation renvoyée', await call('admin', 'POST', url(neuf.body.id)), 200);
  check('un nouveau lien de premier accès (7 jours) est créé', (await prisma.passwordResetToken.count({ where: { userId: neuf.body.id, expiresAt: { gt: new Date(Date.now() + 6 * 864e5) } } })) >= 1 && (await prisma.passwordResetToken.count({ where: { userId: neuf.body.id } })) === jetons + 1);
  check('renvoi inscrit au journal', !!(await prisma.auditLog.findFirst({ where: { entityId: neuf.body.id, metadata: { path: ['event'], equals: 'invitation_renvoyee' } } })));
  expect('agent1 (déjà connecté) : 409', await call('admin', 'POST', url(ids.agent1)), 409);
  expect('compte suspendu : 409', await call('admin', 'POST', url(demo.id)), 409);
  expect('compte inconnu : 404', await call('admin', 'POST', url('inconnu')), 404);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
