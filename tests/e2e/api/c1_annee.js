// D7 — compteurs indépendants par année (instance API à horloge +1 an) et reprise des compteurs.
const E = require('../config');
const reg = require(E.etat('registres.json'));
const ids = require(E.etat('ids.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
let ok = 0, ko = 0; const check = (l, c, d = '') => { c ? ok++ : ko++; console.log(`${c ? 'OK ' : 'KO!'} ${l}${d ? ' — ' + d : ''}`); };
const tokens = {};
async function client(base, key, method, path, body, form) {
  const tk = `${base}|${key}`;
  if (!tokens[tk]) tokens[tk] = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${key}@test.local`, password: 'Password123!' }) })).json()).accessToken;
  const h = { Authorization: 'Bearer ' + tokens[tk] };
  let b;
  if (form) { b = new FormData(); for (const [k, v] of Object.entries(form)) b.append(k, v); }
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(base + path, { method, headers: h, body: b });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const N = 'http://localhost:3000', F = 'http://localhost:3001';
(async () => {
  const an = new Date().getFullYear();
  const suivante = an + 1;
  const deja = await prisma.courrierArrivee.count({ where: { registreId: reg.ARR, annee: suivante } });
  const dejaActe = await prisma.acteCourrier.count({ where: { registreId: reg.DEPU, uniteKey: `DIV:${ids.DPE}`, annee: suivante } });
  const dejaDee = await prisma.courrierArrivee.count({ where: { registreId: reg.ARRU, uniteKey: `DIV:${ids.DEE}`, annee: suivante } });
  const arr = (base, k, f) => client(base, k, 'POST', '/courrier/arrivees', undefined, { dateReception: new Date().toISOString(), expediteur: 'Test année', objet: 'Test année', confidentialite: 'ORDINAIRE', ...f });
  const now1 = (await arr(N, 'secdg', { registreId: reg.ARR })).body;
  const fut1 = (await arr(F, 'secdg', { registreId: reg.ARR })).body;
  const fut2 = (await arr(F, 'secdg', { registreId: reg.ARR })).body;
  const now2 = (await arr(N, 'secdg', { registreId: reg.ARR })).body;
  console.log('Numéros :', [now1, fut1, fut2, now2].map((x) => x.numero).join(' | '));
  check(`année ${suivante} (horloge serveur +1 an) : sa propre suite (${deja + 1}, ${deja + 2})`, fut1.annee === suivante && fut1.sequence === deja + 1 && fut2.sequence === deja + 2);
  check(`année ${an} : sa suite continue, sans interférence (${now1.sequence} → ${now2.sequence})`, now1.annee === an && now2.sequence === now1.sequence + 1);
  const a = (await client(F, 'agent1', 'POST', '/courrier/actes', { registreId: reg.DEPU, objet: 'Acte année suivante', confidentialite: 'ORDINAIRE' })).body;
  await client(F, 'agent1', 'POST', `/courrier/actes/${a.id}/soumettre`);
  await client(F, 'chefssr', 'POST', `/courrier/actes/${a.id}/viser`, {});
  const s = (await client(F, 'chefdpe', 'POST', `/courrier/actes/${a.id}/signer`)).body;
  check(`acte signé en ${suivante} : séquence ${dejaActe + 1} de la DPE pour ${suivante}`, s.annee === suivante && s.sequence === dejaActe + 1, s.numero);

  console.log('— Reprise des compteurs (numéros déjà consommés sur papier)');
  const init = (key, body) => client(N, key, 'POST', `/courrier/registres/${reg.ARRU}/compteurs/initialiser`, body);
  let r = await init('dn', { uniteKey: `DIV:${ids.DEE}`, annee: suivante, dernier: 120 });
  check('DN initialise un compteur → 403', r.status === 403);
  r = await init('admin', { uniteKey: `DIV:${ids.DEE}`, annee: suivante, dernier: 120 });
  if (dejaDee > 0) check('(rejeu) DEE déjà utilisé cette année-là : reprise refusée → 409', r.status === 409);
  else check('admin fixe le dernier numéro papier à 120 (DEE, année suivante, aucune entrée) → 201', r.status === 201);
  const reprise = (await arr(F, 'secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DEE}` })).body;
  check(`le système reprend à ${121 + dejaDee}`, reprise.sequence === 121 + dejaDee, reprise.numero);
  r = await init('admin', { uniteKey: `DIV:${ids.DEE}`, annee: suivante, dernier: 500 });
  check('reprise refusée dès qu’une entrée est numérotée par le système → 409', r.status === 409, r.body && r.body.message);
  r = await client(N, 'admin', 'POST', `/courrier/registres/${reg.ARR}/compteurs/initialiser`, { annee: an, dernier: 5 });
  check(`reprise refusée sur ARR ${an} (déjà utilisé) → 409`, r.status === 409);
  check('reprise auditée', (await prisma.auditLog.count({ where: { entityType: 'CompteurRegistre', metadata: { path: ['event'], equals: 'reprise_compteur' } } })) >= 1);
  await prisma.$disconnect();
  console.log(`\nBilan : ${ok} conformes, ${ko} non conformes`);
})().catch((e) => { console.error(e); process.exit(1); });
