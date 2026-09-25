// G4 — aide en ligne : profils calculés par l'API (rôle propre + habilitations), jamais le rôle
// emprunté en intérim ; ouverte à tous, stagiaire compris.
const { call, ids, check, expect, bilan } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const profils = async (k, h) => (await call(k, 'GET', '/aide/profils', undefined, h)).body.profils;
(async () => {
  const cas = { agent1: ['AGENT'], chefssr: ['CHEF_SECTION'], chefdpe: ['CHEF_DIVISION'], chefsaf: ['CHEF_CELLULE'], dn: ['DN'], dna: ['DNA'], assdn: ['ASSISTANT_DIRECTION'], drh: ['DRH'], admin: ['ADMIN_SYSTEME'] };
  for (const [k, attendu] of Object.entries(cas)) {
    const p = await profils(k);
    check(`${k} : profils ${p.join(', ')}`, attendu.every((x) => p.includes(x)) && !p.includes('GESTIONNAIRE_LOGISTIQUE'));
  }
  check('secrétariat habilité sur un registre : profil secrétariat courrier', (await profils('secdg')).includes('SECRETARIAT_COURRIER'));
  const h = await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agent2 });
  check('gestionnaire logistique habilité : profil gestionnaire', (await profils('agent2')).includes('GESTIONNAIRE_LOGISTIQUE'));
  if (h.status === 201) await call('admin', 'POST', `/logistique/habilitations/${h.body.id}/revoquer`);
  check('habilitation retirée : profil retiré', !(await profils('agent2')).includes('GESTIONNAIRE_LOGISTIQUE'));
  const st = (await call('admin', 'POST', '/users', { email: `aide${S}@test.local`, password: 'Password123!', firstName: 'Aide', lastName: `Stag${S}`, role: 'STAGIAIRE' })).body.id;
  const r = await fetch('http://localhost:3000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `aide${S}@test.local`, password: 'Password123!' }) });
  const tok = (await r.json()).accessToken;
  const rs = await fetch('http://localhost:3000/aide/profils', { headers: { Authorization: 'Bearer ' + tok } });
  check('stagiaire : aide ouverte, profil stagiaire seul', rs.status === 200 && JSON.stringify((await rs.json()).profils) === '["STAGIAIRE"]');
  void st;
  expect('sans session : refusé', await (async () => { const x = await fetch('http://localhost:3000/aide/profils'); return { status: x.status, body: {} }; })(), 401);
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
