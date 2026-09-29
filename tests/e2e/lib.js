// Aide de test HTTP (jetable, hors dépôt).
const BASE = process.env.BASE || 'http://localhost:3000';
const E = require('./config');
const ids = require(E.etat('ids.json'));
const tokens = {};
async function login(key) {
  if (tokens[key]) return tokens[key];
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${key}@test.local`, password: 'Password123!' }) });
  const b = await r.json(); if (!b.accessToken) throw new Error('login ' + key + ' ' + JSON.stringify(b));
  return (tokens[key] = b.accessToken);
}
// Socle N2 : le niveau 2 du dossier du personnel exige une réauthentification. Les suites qui ne
// testent pas ce point reçoivent une preuve automatiquement ; passer { 'X-Reauth': '' } pour s'en passer.
const preuves = {};
async function preuve(key) {
  if (preuves[key] && preuves[key].exp > Date.now() + 30e3) return preuves[key].preuve;
  const r = await fetch(BASE + '/api/v1/reauthentification', { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(key)), 'Content-Type': 'application/json' }, body: JSON.stringify({ motDePasse: 'Password123!' }) });
  const b = await r.json(); if (!b.preuve) throw new Error('réauthentification ' + key + ' ' + JSON.stringify(b));
  preuves[key] = { preuve: b.preuve, exp: new Date(b.expireLe).getTime() };
  return b.preuve;
}
const avecPreuve = async (key, path, headers) => (path.startsWith('/personnel-files') && !('X-Reauth' in headers) ? { 'X-Reauth': await preuve(key) } : {});
async function call(key, method, path, body, headers = {}) {
  const h = { Authorization: 'Bearer ' + (await login(key)), ...(await avecPreuve(key, path, headers)), ...headers };
  if (h['X-Reauth'] === '') delete h['X-Reauth'];
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
module.exports = { call, ids, login, preuve };

// Envoi multipart (fichiers en mémoire) — ajouté pour D7.
async function upload(key, path, fields = {}, files = [], headers = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, String(v));
  for (const f of files) fd.append(f.field || 'files', new Blob([f.content || 'contenu ' + Math.random()], { type: 'text/plain' }), f.name);
  const r = await fetch((process.env.BASE || 'http://localhost:3000') + path, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(key)), ...(await avecPreuve(key, path, headers)), ...headers }, body: fd });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
let ok = 0, ko = 0;
function check(label, cond, detail = '') { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO!'} ${label}${detail !== '' ? ' — ' + detail : ''}`); return cond; }
function expect(label, r, status) { return check(`${label} → ${r.status}`, r.status === status, r.status === status ? (r.status >= 400 ? '« ' + (r.body && r.body.message) + ' »' : '') : `attendu ${status} : ${JSON.stringify(r.body).slice(0, 200)}`); }
function bilan() { console.log(`\nBilan : ${ok} conformes, ${ko} non conformes`); return ko; }
module.exports.upload = upload; module.exports.check = check; module.exports.expect = expect; module.exports.bilan = bilan;
