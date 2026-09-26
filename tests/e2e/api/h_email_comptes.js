// H — emails du cycle de vie d'un compte : inscription approuvée (rôle, unité, « Se connecter »),
// rejetée (sobre, motif seulement s'il est saisi), compte créé par l'administrateur (lien pour
// choisir son mot de passe, 7 jours). Aucun email réel en test : le contenu est lu dans le journal
// de l'API (transport local). Puis un SMTP injoignable (API lancée à part, port 3002) : aucune
// action n'échoue, l'erreur est journalisée (A7).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const E = require('../config');
const { call, ids, check, expect, bilan, login } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const JOURNAL = path.join(E.OUT, 'logs', 'api-normal.log');

async function http(base, method, p, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
const api = (m, p, b, t) => http('http://localhost:3000', m, p, b, t);

/** Dernier email journalisé pour ce destinataire (sujet + texte), ou null. */
async function dernierEmail(journal, email, sujet) {
  for (let i = 0; i < 20; i++) {
    const s = fs.readFileSync(journal, 'utf8');
    const debut = s.lastIndexOf(`destinataire=${email}, sujet="${sujet}"`);
    if (debut >= 0) {
      const fin = s.indexOf('[Nest]', debut + 10);
      return s.slice(debut, fin < 0 ? undefined : fin);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
async function inscrire(email, prenom) {
  const r = await api('POST', '/auth/register', { email, password: 'Password123!', firstName: prenom, lastName: `Demandeur${S}`, declaredRole: 'AGENT', declaredDivisionId: ids.DPE });
  if (r.status !== 201) throw new Error('inscription impossible : ' + JSON.stringify(r.body));
  return (await prisma.user.findUnique({ where: { email } })).id;
}

(async () => {
  const dpe = await prisma.division.findUnique({ where: { id: ids.DPE } });
  const sfp = await prisma.section.findUnique({ where: { id: ids.SFP } });

  console.log('— Inscription approuvée');
  const e1 = `appro${S}@test.local`;
  const id1 = await inscrire(e1, 'Awa');
  expect('un chef ne peut pas approuver', await call('chefdpe', 'POST', `/users/${id1}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 403);
  check('aucun email tant que rien n’est approuvé', (await dernierEmail(JOURNAL, e1, 'Votre compte SI DNPEC est activé')) === null);
  expect('l’administrateur approuve', await call('admin', 'POST', `/users/${id1}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 201);
  const m1 = await dernierEmail(JOURNAL, e1, 'Votre compte SI DNPEC est activé');
  check('email d’approbation envoyé à la personne', !!m1);
  check('formule d’appel avec le prénom', !!m1 && m1.includes('Bonjour Awa,'));
  check('rôle indiqué', !!m1 && m1.includes('Rôle : Agent / Chargé d’Études.'));
  check(`unité indiquée (${dpe.name} — ${sfp.name})`, !!m1 && m1.includes(`Unité : ${dpe.name} — ${sfp.name}.`));
  check('bouton « Se connecter » vers la page de connexion', !!m1 && /Se connecter : http:\/\/localhost:3100\/login/.test(m1));
  expect('approbation rejouée', await call('admin', 'POST', `/users/${id1}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 409);
  check('connexion possible', (await api('POST', '/auth/login', { email: e1, password: 'Password123!' })).status === 200);

  console.log('— Inscription rejetée, avec et sans motif');
  const e2 = `rejm${S}@test.local`;
  const id2 = await inscrire(e2, 'Binta');
  expect('un DN ne peut pas rejeter', await call('dn', 'POST', `/users/${id2}/reject`, {}), 403);
  expect('motif trop long (> 500)', await call('admin', 'POST', `/users/${id2}/reject`, { motif: 'x'.repeat(501) }), 400);
  expect('champ inconnu refusé', await call('admin', 'POST', `/users/${id2}/reject`, { raison: 'x' }), 400);
  expect('rejet avec motif', await call('admin', 'POST', `/users/${id2}/reject`, { motif: '  Adresse personnelle : utilisez votre email professionnel.  ' }), 201);
  const m2 = await dernierEmail(JOURNAL, e2, 'Votre demande d’accès au SI DNPEC');
  check('email de rejet envoyé', !!m2 && m2.includes('Bonjour Binta,') && m2.includes('n’a pas été retenue'));
  check('motif repris (sans espaces autour)', !!m2 && m2.includes('Motif indiqué par l’administrateur : Adresse personnelle : utilisez votre email professionnel.\n'));
  check('invitation à refaire une demande', !!m2 && m2.includes('nouvelle demande') && m2.includes('http://localhost:3100/register'));
  check('email sobre : aucun bouton', !!m2 && !/ : http:\/\/localhost:3100\/(login|reset)/.test(m2));
  check('demande supprimée', (await prisma.user.findUnique({ where: { email: e2 } })) === null);
  check('rejet tracé avec son motif', (await prisma.auditLog.count({ where: { entityId: id2, action: 'REJET', metadata: { path: ['motif'], equals: 'Adresse personnelle : utilisez votre email professionnel.' } } })) === 1);
  expect('rejet rejoué (demande déjà supprimée)', await call('admin', 'POST', `/users/${id2}/reject`, {}), 404);
  const e3 = `rejs${S}@test.local`;
  const id3 = await inscrire(e3, 'Cheick');
  const r3 = await fetch(`http://localhost:3000/users/${id3}/reject`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('admin')) } });
  check('rejet sans corps ni motif → 201', r3.status === 201);
  const m3 = await dernierEmail(JOURNAL, e3, 'Votre demande d’accès au SI DNPEC');
  check('email de rejet sans motif : aucune ligne « Motif »', !!m3 && m3.includes('n’a pas été retenue') && !m3.includes('Motif'));
  const e3b = `rejv${S}@test.local`;
  const id3b = await inscrire(e3b, 'Djeneba');
  expect('motif vide (espaces seuls)', await call('admin', 'POST', `/users/${id3b}/reject`, { motif: '   ' }), 201);
  const m3b = await dernierEmail(JOURNAL, e3b, 'Votre demande d’accès au SI DNPEC');
  check('motif vide : aucune ligne « Motif »', !!m3b && !m3b.includes('Motif'));
  expect('la personne peut refaire une demande avec la même adresse', await api('POST', '/auth/register', { email: e2, password: 'Password123!', firstName: 'Binta', lastName: `Demandeur${S}`, declaredRole: 'AGENT', declaredDivisionId: ids.DPE }), 201);

  console.log('— Compte créé par l’administrateur');
  const e4 = `cree${S}@test.local`;
  expect('un DRH ne crée pas de compte ici', await call('drh', 'POST', '/users', { email: `x${e4}`, password: 'Provisoire123!', firstName: 'X', lastName: 'Y', role: 'AGENT', divisionId: ids.DPE }), 403);
  const c4 = await call('admin', 'POST', '/users', { email: e4, password: 'Provisoire123!', firstName: 'Fanta', lastName: `Cree${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP });
  expect('l’administrateur crée le compte', c4, 201);
  const m4 = await dernierEmail(JOURNAL, e4, 'Votre compte SI DNPEC a été créé');
  check('email « votre compte a été créé »', !!m4 && m4.includes('Bonjour Fanta,'));
  check('rôle et unité', !!m4 && m4.includes('Rôle : Agent / Chargé d’Études.') && m4.includes(`Unité : ${dpe.name} — ${sfp.name}.`));
  const lien = m4 && m4.match(/Choisir mon mot de passe : http:\/\/localhost:3100\/reset-password\?token=([A-Za-z0-9_-]+)/);
  check('lien pour choisir son mot de passe', !!lien);
  const jeton = lien && (await prisma.passwordResetToken.findFirst({ where: { userId: c4.body.id }, orderBy: { createdAt: 'desc' } }));
  check('lien valable 7 jours', !!jeton && Math.abs(jeton.expiresAt - Date.now() - 7 * 864e5) < 60e3);
  check('le mot de passe provisoire fonctionne', (await api('POST', '/auth/login', { email: e4, password: 'Provisoire123!' })).status === 200);
  expect('choix du mot de passe par le lien', await api('POST', '/auth/reset-password', { token: lien ? lien[1] : 'x', newPassword: 'MonPropre123!' }), 200);
  check('connexion avec son propre mot de passe', (await api('POST', '/auth/login', { email: e4, password: 'MonPropre123!' })).status === 200);
  expect('lien rejoué (usage unique)', await api('POST', '/auth/reset-password', { token: lien ? lien[1] : 'x', newPassword: 'Encore12345!' }), 401);
  expect('adresse déjà utilisée : aucun second compte', await call('admin', 'POST', '/users', { email: e4, password: 'Provisoire123!', firstName: 'X', lastName: 'Y', role: 'AGENT', divisionId: ids.DPE }), 409);

  console.log('— Serveur d’email injoignable : aucune action bloquée (A7)');
  const journalEchec = path.join(E.OUT, 'logs', 'api-smtp-injoignable.log');
  const sortie = fs.openSync(journalEchec, 'w');
  const proc = spawn('node', ['dist/main.js'], { cwd: E.API_DIR, env: { ...process.env, PORT: '3002', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: '' }, stdio: ['ignore', sortie, sortie] });
  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) { await new Promise((r) => setTimeout(r, 1000)); pret = await fetch('http://localhost:3002/health').then((r) => r.ok, () => false); }
    check('API de test démarrée avec un SMTP injoignable', pret);
    const b = (m, p, body) => login('admin').then((t) => http('http://localhost:3002', m, p, body, t));
    const e5 = `smtpa${S}@test.local`; const id5 = await inscrire(e5, 'Hawa');
    expect('approbation malgré l’échec d’envoi', await b('POST', `/users/${id5}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 201);
    check('le compte est bien actif', (await prisma.user.findUnique({ where: { id: id5 } })).status === 'ACTIF');
    const e6 = `smtpr${S}@test.local`; const id6 = await inscrire(e6, 'Ibrahima');
    expect('rejet malgré l’échec d’envoi', await b('POST', `/users/${id6}/reject`, { motif: 'Doublon' }), 201);
    check('la demande est bien supprimée', (await prisma.user.findUnique({ where: { id: id6 } })) === null);
    const c7 = await b('POST', '/users', { email: `smtpc${S}@test.local`, password: 'Provisoire123!', firstName: 'Kadia', lastName: `Smtp${S}`, role: 'AGENT', divisionId: ids.DPE });
    expect('création malgré l’échec d’envoi', c7, 201);
    await new Promise((r) => setTimeout(r, 500));
    const j = fs.readFileSync(journalEchec, 'utf8');
    for (const [quoi, qui] of [['approbation', id5], ['rejet', e6], ['creation', c7.body.id]]) {
      check(`échec d’envoi journalisé (${quoi})`, j.includes(`Échec d'envoi de l'email de compte (${quoi}) pour ${qui}`));
    }
  } finally {
    proc.kill();
  }

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
