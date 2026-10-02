// Revue de sécurité (octobre 2026) — corrections vérifiées de bout en bout :
//   congés maladie (filtre sur le type, motif seulement dans le détail tracé, textes libres masqués,
//   destinataires et libellé des notifications, journal sans texte libre) ; verrouillage par adresse
//   IP des connexions relayées (secret partagé web → API) ; déconnexion qui révoque la session ;
//   quotas du mot de passe oublié et de l'inscription ; codes 2FA comptés et journalisés ; lien de
//   réinitialisation à usage unique et remplacé par le suivant ; sessions révoquées à la suspension ;
//   type servi au téléchargement ; mot de passe démesuré ; en-têtes de sécurité du web.
const crypto = require('crypto');
const { call, ids, login, preuve, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const WEB = 'http://localhost:3100';
const S = Date.now().toString(36).slice(-5);
const SECRET = process.env.WEB_PROXY_SECRET || 'secret-proxy-e2e-uniquement-local';
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function http(method, path, body, entetes = {}) {
  const h = { 'Content-Type': 'application/json', ...entetes };
  const r = await fetch(API + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, headers: r.headers };
}
/** Requête relayée par le web (adresse du client transmise, avec ou sans le secret partagé). */
const relayee = (ip, avecSecret = true) => ({ 'X-Client-IP': ip, ...(avecSecret ? { 'X-Proxy-Secret': SECRET } : {}) });
const IP = (n) => `203.0.113.${(parseInt(S, 36) % 200) + n}`;

(async () => {
  console.log('— Congés maladie : rien ne révèle le motif à la cascade');
  if (!(await call('agent1', 'GET', '/leave-types')).body.some((x) => x.code === 'CONGE_MALADIE')) await call('admin', 'POST', '/leave-types', { code: 'CONGE_MALADIE', name: 'Congé maladie' });
  const maladie = (await call('agent1', 'GET', '/leave-types')).body.find((x) => x.code === 'CONGE_MALADIE');
  const notifsAvant = await prisma.notification.count({ where: { userId: { in: [ids.dn, ids.dna] } } });
  const cm = (await call('agent1', 'POST', '/leaves', { leaveTypeId: maladie.id, startDate: jour(40), endDate: jour(41), reason: `Hospitalisation ${S}` })).body;
  check('demande de congé maladie créée', !!cm.id, JSON.stringify(cm).slice(0, 200));
  const notifs = await prisma.notification.findMany({ where: { createdAt: { gte: new Date(Date.now() - 60e3) }, link: `/leaves?id=${cm.id}` } });
  check('notifications de la demande : jamais « maladie », le libellé « Absence — motif protégé »', notifs.length > 0 && notifs.every((n) => !/maladie/i.test(`${n.title} ${n.body} ${n.subjectDetail ?? ''}`) && /motif protégé/.test(n.body)), notifs.map((n) => n.body).join(' | '));
  check('ni le DN ni la DNA ne sont notifiés (ils ne décident pas de la demande d’un agent)', (await prisma.notification.count({ where: { userId: { in: [ids.dn, ids.dna] } } })) === notifsAvant);
  expect('avis du chef avec un texte libre', await call('chefssr', 'POST', `/leaves/${cm.id}/avis`, { avis: 'FAVORABLE', motif: `Opération prévue ${S}` }), 201);
  const filtre = (await call('dn', 'GET', `/leaves?leaveTypeId=${maladie.id}`)).body;
  check('DN : le filtre « Congé maladie » ne renvoie aucune ligne masquée (le type ne se déduit pas)', Array.isArray(filtre) && !filtre.some((r) => r.id === cm.id));
  const vueDn = (await call('dn', 'GET', '/leaves')).body.find((r) => r.id === cm.id);
  check('DN : ligne « Absence — motif protégé », sans motif ni texte libre du chef', !!vueDn && vueDn.leaveTypeId === null && vueDn.reason === null && vueDn.avisMotif === null && vueDn.decisionComment === null, JSON.stringify(vueDn && { t: vueDn.leaveType, a: vueDn.avisMotif }));
  const listeDrh = (await call('drh', 'GET', '/leaves', undefined, { 'X-Reauth': await preuve('drh') })).body.find((r) => r.id === cm.id);
  check('DRH : dans la liste, le motif n’apparaît pas (il se lit dans le détail, lecture tracée)', !!listeDrh && listeDrh.reason === null && listeDrh.leaveType.code === 'CONGE_MALADIE');
  const traces = await prisma.auditLog.count({ where: { entityId: cm.id, metadata: { path: ['event'], equals: 'acces_objet_protege' } } });
  const detailDrh = (await call('drh', 'GET', `/leaves/${cm.id}`, undefined, { 'X-Reauth': await preuve('drh') })).body;
  check('DRH : le détail montre le motif, et sa lecture est tracée', detailDrh.reason === `Hospitalisation ${S}` && (await prisma.auditLog.count({ where: { entityId: cm.id, metadata: { path: ['event'], equals: 'acces_objet_protege' } } })) === traces + 1);
  const avis = await prisma.auditLog.findFirst({ where: { entityId: cm.id, metadata: { path: ['event'], equals: 'avis_conge' } } });
  check('journal d’audit : l’avis ne garde pas le texte libre du chef', avis && avis.metadata.motif === true && !JSON.stringify(avis.metadata).includes(S));
  expect('le DRH refuse avec un commentaire', await call('drh', 'POST', `/leaves/${cm.id}/reject`, { comment: `Justificatif médical ${S} illisible` }), 201);
  const refus = await prisma.auditLog.findFirst({ where: { entityId: cm.id, action: 'REJET' } });
  check('journal d’audit : le refus ne garde pas le commentaire', refus && refus.metadata.commentaire === true && !JSON.stringify(refus.metadata).includes(S));

  console.log('— Connexion relayée par le web : verrouillage par adresse IP réelle');
  const A = IP(1), B = IP(2);
  for (let i = 0; i < 5; i++) await http('POST', '/auth/login', { email: `inconnu${i}${S}@test.local`, password: 'mauvais' }, relayee(A));
  const bloquee = await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' }, relayee(A));
  check('5 échecs depuis l’adresse A : A verrouillée (429), même pour un bon mot de passe', bloquee.status === 429, bloquee.status);
  const autre = await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' }, relayee(B));
  check('… l’adresse B se connecte normalement (plus de verrou commun à tout le web)', autre.status === 200, autre.status);
  const journal = await prisma.journalConnexion.findFirst({ where: { email: `inconnu0${S}@test.local` } });
  check('journal des connexions : l’adresse réelle du client (A), pas celle du web', journal && journal.ip === A, journal && journal.ip);
  const C = IP(3);
  for (let i = 0; i < 6; i++) await http('POST', '/auth/login', { email: `faux${i}${S}@test.local`, password: 'mauvais' }, relayee(C, false));
  const sansSecret = await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' }, relayee(C, false));
  check('adresse transmise sans le secret : ignorée pour le verrou (aucun verrou commun), connexion possible', sansSecret.status === 200, sansSecret.status);
  const inconnu = await http('POST', '/auth/login', { email: `personne${S}@test.local`, password: 'Password123!' }, relayee(IP(4)));
  const faux = await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'mauvais' }, relayee(IP(4)));
  check('compte inconnu ou mot de passe faux : même réponse (aucune énumération)', inconnu.status === 401 && faux.status === 401 && inconnu.body.message === faux.body.message);
  expect('mot de passe de plus de 200 caractères', await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'x'.repeat(201) }), 400);

  console.log('— Déconnexion : la session est réellement révoquée');
  const s1 = await http('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' }, relayee(IP(5)));
  expect('déconnexion avec le seul jeton de renouvellement (comme le web)', await http('POST', '/auth/logout', { refreshToken: s1.body.refreshToken }), 204);
  expect('renouvellement avec le jeton révoqué', await http('POST', '/auth/refresh', { refreshToken: s1.body.refreshToken }), 401);

  console.log('— Mot de passe oublié et inscription : quotas');
  const D = IP(6);
  const oubli = [];
  for (let i = 0; i < 6; i++) oubli.push((await http('POST', '/auth/forgot-password', { email: `quota${S}@test.local` }, relayee(IP(10 + i)))).status);
  check('même adresse email : 5 demandes par heure, la 6e refusée (429)', oubli.slice(0, 5).every((x) => x === 200) && oubli[5] === 429, oubli.join(','));
  const parIp = [];
  for (let i = 0; i < 11; i++) parIp.push((await http('POST', '/auth/forgot-password', { email: `ip${i}${S}@test.local` }, relayee(D))).status);
  check('même adresse IP : 10 demandes par heure, la 11e refusée (429)', parIp.slice(0, 10).every((x) => x === 200) && parIp[10] === 429, parIp.join(','));
  const E = IP(7);
  const inscr = [];
  for (let i = 0; i < 31; i++) inscr.push((await http('POST', '/auth/register', { email: 'agent2@test.local', password: 'Password123!', firstName: 'X', lastName: 'Y', declaredRole: 'AGENT', declaredDivisionId: ids.DPE }, relayee(E))).status);
  check('inscriptions depuis une même adresse : 30 par heure, la 31e refusée (429)', inscr.slice(0, 30).every((x) => x === 409) && inscr[30] === 429, inscr.slice(28).join(','));

  console.log('— Lien de réinitialisation : un seul valable, usage unique');
  const cible = await prisma.user.findUnique({ where: { email: 'agent2@test.local' } });
  const lien = () => { const p = crypto.randomBytes(32).toString('base64url'); return { p, h: crypto.createHash('sha256').update(p).digest('hex') }; };
  const l1 = lien(), l2 = lien();
  await prisma.passwordResetToken.create({ data: { userId: cible.id, tokenHash: l1.h, expiresAt: new Date(Date.now() + 3600e3) } });
  await prisma.passwordResetToken.create({ data: { userId: cible.id, tokenHash: l2.h, expiresAt: new Date(Date.now() + 3600e3) } });
  const deux = await Promise.all([1, 2].map(() => http('POST', '/auth/reset-password', { token: l2.p, newPassword: 'Password123!' })));
  check('deux utilisations simultanées du même lien : une seule aboutit', deux.filter((r) => r.status === 200).length === 1 && deux.filter((r) => r.status === 401).length === 1, deux.map((r) => r.status).join(','));
  expect('lien plus ancien après usage d’un autre (révoqué par la réinitialisation)', await http('POST', '/auth/reset-password', { token: l1.p, newPassword: 'Password123!' }), 401);
  await http('POST', '/auth/forgot-password', { email: 'agent2@test.local' }, relayee(IP(20)));
  check('nouvelle demande : les liens précédents du compte sont tous invalidés', (await prisma.passwordResetToken.count({ where: { userId: cible.id, usedAt: null } })) === 1);

  console.log('— Double authentification : codes comptés et journalisés');
  const email2fa = `s2fa${S}@test.local`;
  await call('admin', 'POST', '/users', { email: email2fa, password: 'Password123!', firstName: 'Code', lastName: `Faux${S}`, role: 'AGENT' });
  const t2 = (await http('POST', '/auth/login', { email: email2fa, password: 'Password123!' }, relayee(IP(21)))).body.accessToken;
  const p2 = (await http('POST', '/api/v1/reauthentification', { motDePasse: 'Password123!' }, { Authorization: `Bearer ${t2}` })).body.preuve;
  await http('POST', '/auth/2fa/setup', undefined, { Authorization: `Bearer ${t2}`, 'X-Reauth': p2 });
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await http('POST', '/auth/2fa/activate', { code: '000000' }, { Authorization: `Bearer ${t2}` })).status);
  check('5 codes faux à l’activation : compte verrouillé (6e : 429)', codes.slice(0, 5).every((x) => x === 401) && codes[5] === 429, codes.join(','));
  check('échecs de code 2FA dans le journal des connexions', (await prisma.journalConnexion.count({ where: { email: email2fa, motif: 'code 2FA (activation)' } })) >= 5);

  console.log('— Suspension : sessions révoquées, même après réactivation');
  const emailSus = `s2sus${S}@test.local`;
  const us = (await call('admin', 'POST', '/users', { email: emailSus, password: 'Password123!', firstName: 'Sus', lastName: `Pendu${S}`, role: 'AGENT' })).body;
  const ss = (await http('POST', '/auth/login', { email: emailSus, password: 'Password123!' }, relayee(IP(22)))).body;
  expect('suspension du compte par l’administrateur', await call('admin', 'PATCH', `/users/${us.id}/status`, { status: 'SUSPENDU' }), 200);
  expect('réactivation', await call('admin', 'PATCH', `/users/${us.id}/status`, { status: 'ACTIF' }), 200);
  expect('ancien jeton de renouvellement après suspension puis réactivation', await http('POST', '/auth/refresh', { refreshToken: ss.refreshToken }), 401);

  console.log('— Téléchargement : type servi');
  const t = (await call('agent1', 'POST', '/tasks', { title: `Pièce HTML ${S}`, divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const fd = new FormData(); fd.append('files', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'piege.html');
  const pj = await (await fetch(`${API}/tasks/${t.id}/attachments`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('agent1')) }, body: fd })).json();
  const idPj = (Array.isArray(pj) ? pj[0] : pj).id;
  const dl = await fetch(`${API}/tasks/${t.id}/attachments/${idPj}/download`, { headers: { Authorization: 'Bearer ' + (await login('agent1')) } });
  check('fichier HTML déposé : servi en application/octet-stream, en pièce jointe', dl.status === 200 && dl.headers.get('content-type').startsWith('application/octet-stream') && /attachment/.test(dl.headers.get('content-disposition')), `${dl.status} ${dl.headers.get('content-type')}`);

  console.log('— En-têtes de sécurité du web');
  for (const page of ['/', '/login', '/dashboard']) {
    const r = await fetch(WEB + page, { redirect: 'manual' });
    const csp = r.headers.get('content-security-policy') || '';
    check(`${page} : CSP (frame-ancestors 'none', object-src 'none'), X-Frame-Options, nosniff, sans référent, sans « X-Powered-By »`,
      /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && r.headers.get('x-frame-options') === 'DENY' && r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('referrer-policy') === 'no-referrer' && !r.headers.get('x-powered-by'),
      csp.slice(0, 120));
  }
  const api = await fetch(`${API}/health`);
  check('API : en-têtes de helmet (nosniff, HSTS, frame-ancestors)', api.headers.get('x-content-type-options') === 'nosniff' && !!api.headers.get('strict-transport-security') && /frame-ancestors/.test(api.headers.get('content-security-policy') || ''));

  await prisma.$disconnect();
  bilan();
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
