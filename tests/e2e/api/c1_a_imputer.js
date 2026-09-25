// Complément 1 — notification « nouveau courrier à imputer ».
const E = require('../config');
const { call, upload, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36);
const nom = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
const arrivee = (k, f) => upload(k, '/courrier/arrivees', { dateReception: new Date().toISOString(), expediteur: 'Test à imputer', ...f });
const notifs = async (id) => prisma.notification.findMany({ where: { type: 'COURRIER_A_IMPUTER', link: `/courrier?arrivee=${id}` } });
const dest = (n) => [...new Set(n.map((x) => nom[x.userId] || x.userId))].sort().join(',');
(async () => {
  const ctscm = await prisma.cellule.findUnique({ where: { code: 'CTSCM' } });
  const smtpKo = process.env.SMTP_KO === '1';
  if (smtpKo) {
    const r = await arrivee('secdg', { registreId: reg.ARR, objet: `SMTP en panne ${S}`, confidentialite: 'ORDINAIRE' });
    expect('SMTP injoignable : l’enregistrement réussit quand même', r, 201);
    const n = await notifs(r.body.id);
    check('notifications in-app créées malgré l’échec d’envoi des emails', n.filter((x) => x.channel === 'IN_APP').length === 2, dest(n));
    check('le courrier est bien en base, numéroté', !!(await prisma.courrierArrivee.findUnique({ where: { id: r.body.id } })));
    await prisma.$disconnect(); return bilan();
  }
  const hab = (await call('admin', 'GET', '/courrier/habilitations')).body;
  if (!hab.some((h) => h.userId === ids.secdg && h.uniteKey === `CEL:${ctscm.id}` && !h.revoqueeAt))
    await call('admin', 'POST', '/courrier/habilitations', { userId: ids.secdg, registreId: reg.ARRU, uniteKey: `CEL:${ctscm.id}` });

  const o = (await arrivee('secdg', { registreId: reg.ARR, objet: `Demande du ministre ${S}`, confidentialite: 'ORDINAIRE' })).body;
  let n = await notifs(o.id);
  check('registre DIRECTION : DN et DNA (in-app + email), pas le secrétariat', dest(n) === 'dn,dna' && n.length === 4, dest(n));
  check('ORDINAIRE : objet dans l’email, lien /courrier?arrivee=', n.every((x) => x.body.includes(`Demande du ministre ${S}`) && x.link === `/courrier?arrivee=${o.id}`), n[0].body);

  const c = (await arrivee('secdg', { registreId: reg.ARR, objet: `Affaire réservée ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  n = await notifs(c.id);
  check('CONFIDENTIEL : DN et DNA', dest(n) === 'dn,dna');
  check('CONFIDENTIEL : ni titre ni corps ne contiennent l’objet', n.every((x) => !`${x.title} ${x.body}`.includes('Affaire réservée')), `${n[0].title} / ${n[0].body}`);

  const u = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `Courrier pour la DPE ${S}`, confidentialite: 'ORDINAIRE' })).body;
  check('registre UNITE (DPE) : le chef de la division seulement', dest(await notifs(u.id)) === 'chefdpe', dest(await notifs(u.id)));

  const t = await arrivee('secdg', { registreId: reg.ARRU, uniteKey: `CEL:${ctscm.id}`, objet: `Courrier CTSCM ${S}`, confidentialite: 'ORDINAIRE' });
  expect('enregistrement dans l’unité CTSCM (sans chef)', t, 201);
  check('unité sans chef (CTSCM) : DN et DNA', dest(await notifs(t.body.id)) === 'dn,dna', dest(await notifs(t.body.id)));

  const p = (await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe })).body;
  check('pli PERSONNEL : aucune notification « à imputer »', (await notifs(p.id)).length === 0);
  const pli = await prisma.notification.count({ where: { type: 'PLI_PERSONNEL_RECU', userId: ids.chefdpe, link: `/courrier?arrivee=${p.id}` } });
  check('pli PERSONNEL : seul le destinataire est prévenu (comme avant)', pli === 2);

  const h = await call('admin', 'POST', '/courrier/habilitations', { userId: ids.dna, registreId: reg.ARR });
  const parDna = (await arrivee('dna', { registreId: reg.ARR, objet: `Enregistré par la DNA ${S}`, confidentialite: 'ORDINAIRE' })).body;
  check('jamais la personne qui enregistre : la DNA enregistre → seul le DN est notifié', dest(await notifs(parDna.id)) === 'dn', dest(await notifs(parDna.id)));
  await call('admin', 'POST', `/courrier/habilitations/${h.body.id}/revoquer`);
  await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(1); });
