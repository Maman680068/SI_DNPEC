// Outils des tests de la démonstration (prisma/demo.ts) : lancement du script comme le fait
// db-demo.yml, empreinte de la base (une ligne modifiée ou supprimée change l'empreinte),
// connexion d'un compte de démonstration.
const { spawnSync } = require('child_process');
const E = require('./config');

const MDP = 'Demo-Test-2026!';
const DOMAINE = 'demo.dnpec.test';
const API = 'http://localhost:3000';

/** Lance « pnpm run db:demo <mode> » ; renvoie { code, sortie }. */
function lancerDemo(mode, env = {}) {
  const r = spawnSync('pnpm', ['run', '-s', 'db:demo', mode], {
    cwd: E.API_DIR,
    env: { ...process.env, DEMO_PASSWORD: MDP, ...env },
    encoding: 'utf8',
    timeout: 600000,
  });
  return { code: r.status, sortie: `${r.stdout || ''}${r.stderr || ''}` };
}

// Tables hors empreinte : les connexions des tests y écrivent (sessions, jetons).
const HORS_EMPREINTE = new Set(['user_sessions', 'password_reset_tokens']);

/** Empreinte de la base : table → liste des md5 de chaque ligne. */
async function empreinte(prisma) {
  const tables = await prisma.$queryRawUnsafe("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1");
  const res = {};
  for (const { t } of tables) {
    if (HORS_EMPREINTE.has(t)) continue;
    // audit_logs : le scellement (socle N2) complète rang et empreintes, sans rien changer d'autre.
    const expr = t === 'audit_logs' ? "md5((to_jsonb(x) - 'rang' - 'empreinte' - 'empreintePrecedente')::text)" : 'md5(x::text)';
    const lignes = await prisma.$queryRawUnsafe(`SELECT ${expr} AS h FROM "${t}" x`);
    res[t] = lignes.map((l) => l.h);
  }
  return res;
}

/** Lignes de `avant` absentes de `apres` (modifiées ou supprimées), par table. */
function lignesDisparues(avant, apres) {
  const out = [];
  for (const [t, hs] of Object.entries(avant)) {
    const reste = new Map();
    for (const h of apres[t] || []) reste.set(h, (reste.get(h) || 0) + 1);
    let n = 0;
    for (const h of hs) {
      const c = reste.get(h) || 0;
      if (c > 0) reste.set(h, c - 1);
      else n++;
    }
    if (n) out.push(`${t} : ${n}`);
  }
  return out;
}

async function connexion(email, mdp = MDP) {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: mdp }) });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, token: b.accessToken };
}

async function appel(token, method, p, body) {
  const h = { Authorization: 'Bearer ' + token };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(API + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}

module.exports = { MDP, DOMAINE, lancerDemo, empreinte, lignesDisparues, connexion, appel, email: (local) => `${local}@${DOMAINE}` };
