// G3 — double authentification de bout en bout (API) : état, configuration, activation
// (code faux 401, vrai 200), reconfiguration refusée une fois active (409), connexion en deux
// temps, désactivation qui exige un code, réinitialisation par l'administrateur (sessions
// fermées), jamais sur soi-même, jamais par un non-administrateur. Compte dédié : les échecs
// volontaires ne verrouillent aucun compte partagé.
const E = require('../config');
const { call, check, expect, bilan } = require('../lib');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const EMAIL = `g3fa${S}@test.local`;

/** Code TOTP valide, jamais dans les 2 dernières secondes d'une fenêtre de 30 s. */
async function code(secret) {
  const reste = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (reste <= 2) await new Promise((r) => setTimeout(r, (reste + 0.5) * 1000));
  return authenticator.generate(secret);
}
async function http(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
const connexion = () => http('POST', '/auth/login', { email: EMAIL, password: 'Password123!' });

(async () => {
  void E;
  const u = await call('admin', 'POST', '/users', { email: EMAIL, password: 'Password123!', firstName: 'Deux', lastName: `Facteurs${S}`, role: 'AGENT' });
  check('compte dédié créé', u.status === 201);
  let s = (await connexion()).body;
  check('connexion sans 2FA : session directe', !!s.accessToken && !s.challengeToken);
  let tok = s.accessToken;

  console.log('— Activation');
  check('état initial : désactivée', (await http('GET', '/auth/2fa/status', null, tok)).body.enabled === false);
  expect('activer sans configuration', await http('POST', '/auth/2fa/activate', { code: '123456' }, tok), 409);
  const conf = await http('POST', '/auth/2fa/setup', null, tok);
  check('configuration : secret et QR code', conf.status === 201 && !!conf.body.secret && /^data:image\/png;base64,/.test(conf.body.qrCodeDataUrl));
  check('état : en attente, pas encore active', JSON.stringify((await http('GET', '/auth/2fa/status', null, tok)).body) === JSON.stringify({ enabled: false, pending: true }));
  expect('activation avec un code faux', await http('POST', '/auth/2fa/activate', { code: '000000' }, tok), 401);
  expect('activation sans session', await http('POST', '/auth/2fa/activate', { code: await code(conf.body.secret) }), 401);
  expect('activation avec le bon code', await http('POST', '/auth/2fa/activate', { code: await code(conf.body.secret) }, tok), 200);
  check('état : activée', (await http('GET', '/auth/2fa/status', null, tok)).body.enabled === true);
  expect('reconfiguration une fois active (bloquerait le compte)', await http('POST', '/auth/2fa/setup', null, tok), 409);
  expect('seconde activation', await http('POST', '/auth/2fa/activate', { code: await code(conf.body.secret) }, tok), 409);
  check('activation tracée dans le journal', (await prisma.auditLog.count({ where: { entityId: u.body.id, metadata: { path: ['event'], equals: 'two_fa_enabled' } } })) === 1);

  console.log('— Connexion en deux temps');
  const c1 = (await connexion()).body;
  check('mot de passe seul : défi 2FA, aucune session', c1.status === 'two_fa_challenge_required' && !!c1.challengeToken && !c1.accessToken);
  expect('code faux', await http('POST', '/auth/login/2fa', { challengeToken: c1.challengeToken, code: '111111' }), 401);
  expect('jeton de défi falsifié', await http('POST', '/auth/login/2fa', { challengeToken: c1.challengeToken + 'x', code: await code(conf.body.secret) }), 401);
  const c2 = await http('POST', '/auth/login/2fa', { challengeToken: c1.challengeToken, code: await code(conf.body.secret) });
  check('bon code : session ouverte', c2.status === 200 && !!c2.body.accessToken && !!c2.body.refreshToken);
  tok = c2.body.accessToken;
  expect('le jeton de défi ne donne accès à rien', await http('GET', '/auth/me', null, c1.challengeToken), 401);

  console.log('— Désactivation par la personne');
  expect('désactivation sans code', await http('POST', '/auth/2fa/disable', {}, tok), 400);
  expect('désactivation avec un code faux', await http('POST', '/auth/2fa/disable', { code: '222222' }, tok), 401);
  expect('désactivation avec un code valide', await http('POST', '/auth/2fa/disable', { code: await code(conf.body.secret) }, tok), 200);
  check('désactivée : secret effacé', (await prisma.user.findUnique({ where: { id: u.body.id } })).twoFactorSecret === null);
  expect('désactivation rejouée', await http('POST', '/auth/2fa/disable', { code: '333333' }, tok), 409);
  s = (await connexion()).body;
  check('connexion de nouveau directe', !!s.accessToken);
  tok = s.accessToken;

  console.log('— Réinitialisation par l’administrateur (téléphone perdu)');
  const conf2 = (await http('POST', '/auth/2fa/setup', null, tok)).body;
  await http('POST', '/auth/2fa/activate', { code: await code(conf2.secret) }, tok);
  const c3 = (await connexion()).body;
  const session = (await http('POST', '/auth/login/2fa', { challengeToken: c3.challengeToken, code: await code(conf2.secret) })).body;
  for (const k of ['dn', 'drh', 'chefdpe', 'agent1']) expect(`${k} ne peut pas réinitialiser`, await call(k, 'POST', `/users/${u.body.id}/2fa/reset`), 403);
  expect('l’administrateur sur son propre compte', await call('admin', 'POST', `/users/${require('../lib').ids.admin}/2fa/reset`), 403);
  expect('l’administrateur réinitialise', await call('admin', 'POST', `/users/${u.body.id}/2fa/reset`), 200);
  const apres = await prisma.user.findUnique({ where: { id: u.body.id } });
  check('2FA désactivée, secret effacé', apres.twoFactorEnabled === false && apres.twoFactorSecret === null);
  expect('les sessions de la personne sont fermées (rafraîchissement refusé)', await http('POST', '/auth/refresh', { refreshToken: session.refreshToken }), 401);
  check('réinitialisation tracée (auteur : administrateur)', (await prisma.auditLog.count({ where: { entityId: u.body.id, actorId: require('../lib').ids.admin, metadata: { path: ['event'], equals: 'admin_reset_two_fa' } } })) === 1);
  expect('réinitialisation rejouée (rien à réinitialiser)', await call('admin', 'POST', `/users/${u.body.id}/2fa/reset`), 409);
  s = (await connexion()).body;
  check('la personne se reconnecte avec son seul mot de passe', !!s.accessToken && !s.challengeToken);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
