// Sessions — renouvellements simultanés (deux onglets, deux chargements de page rapprochés) :
// la personne n'est plus déconnectée. Le jeton tout juste remplacé reste accepté un court
// instant, sans nouvelle rotation, et jamais pour une session révoquée ; passé ce délai,
// il est refusé. Vérifié sur l'API et à travers le relais du web (cookie httpOnly).
const { check, expect, bilan } = require('../lib');
const API = 'http://localhost:3000';
const WEB = 'http://localhost:3100';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, path, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
const connexion = async () => (await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' })).body;
const renouveler = (jeton) => http('POST', '/auth/refresh', { refreshToken: jeton });
/** Renouvellement par le relais du web, comme le navigateur (cookie du jeton). */
async function renouvelerWeb(jeton) {
  const r = await fetch(WEB + '/api/auth/refresh', { method: 'POST', headers: { Cookie: `dnpec_refresh_token=${jeton}` } });
  return { status: r.status, cookie: r.headers.get('set-cookie') || '' };
}

(async () => {
  console.log('— API : deux renouvellements simultanés avec le même jeton');
  const s = await connexion();
  check('connexion', !!s.refreshToken && !!s.accessToken);
  const [a, b] = await Promise.all([renouveler(s.refreshToken), renouveler(s.refreshToken)]);
  check('les deux renouvellements réussissent (aucune déconnexion)', a.status === 200 && b.status === 200, `${a.status}/${b.status}`);
  check('les deux reçoivent un jeton d’accès', !!a.body.accessToken && !!b.body.accessToken);
  const nouveaux = [a, b].map((r) => r.body.refreshToken).filter(Boolean);
  check('une seule rotation : un seul nouveau jeton de renouvellement', nouveaux.length === 1, String(nouveaux.length));
  const t1 = nouveaux[0];
  expect('le nouveau jeton fonctionne ensuite', await renouveler(t1), 200);

  console.log('— Jeton tout juste remplacé : accepté sans rotation, puis refusé après le délai');
  const s2 = await connexion();
  const r1 = await renouveler(s2.refreshToken);
  const tardif = await renouveler(s2.refreshToken);
  check('ancien jeton juste après la rotation : accepté', tardif.status === 200, String(tardif.status));
  check('… sans nouveau jeton de renouvellement (pas de seconde rotation)', !tardif.body.refreshToken);
  expect('le jeton remis par la rotation reste valable', await renouveler(r1.body.refreshToken), 200);
  await attendre(31_000);
  expect('ancien jeton après le délai de grâce (30 s) : refusé', await renouveler(s2.refreshToken), 401);

  console.log('— Session révoquée : aucun délai de grâce');
  const s3 = await connexion();
  const r3 = await renouveler(s3.refreshToken);
  expect('déconnexion avec le nouveau jeton', await http('POST', '/auth/logout', { refreshToken: r3.body.refreshToken }), 204);
  expect('ancien jeton après la déconnexion : refusé', await renouveler(s3.refreshToken), 401);
  expect('nouveau jeton après la déconnexion : refusé', await renouveler(r3.body.refreshToken), 401);
  const s4 = await connexion();
  await renouveler(s4.refreshToken);
  expect('déconnexion avec le jeton tout juste remplacé (cookie d’un autre onglet)', await http('POST', '/auth/logout', { refreshToken: s4.refreshToken }), 204);
  const nouveauS4 = await renouveler(s4.refreshToken);
  check('… la session qu’il désignait est révoquée', nouveauS4.status === 401, String(nouveauS4.status));

  console.log('— Web : deux chargements de page simultanés (relais /api/auth/refresh)');
  const s5 = await connexion();
  const [w1, w2] = await Promise.all([renouvelerWeb(s5.refreshToken), renouvelerWeb(s5.refreshToken)]);
  check('les deux chargements restent connectés', w1.status === 200 && w2.status === 200, `${w1.status}/${w2.status}`);
  const poses = [w1, w2].filter((w) => /dnpec_refresh_token=[^;]+/.test(w.cookie) && !/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(w.cookie));
  check('un seul nouveau cookie posé, aucun cookie effacé', poses.length === 1 && ![w1, w2].some((w) => /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(w.cookie)), [w1.cookie, w2.cookie].map((c) => c.slice(0, 40)).join(' | '));

  process.exit(bilan() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
