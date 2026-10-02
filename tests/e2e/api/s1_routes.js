// Revue de sécurité (octobre 2026) — inventaire des routes de l'API et garde d'habilitation.
//   1. Liste exacte des routes publiques (@Public) : toute nouvelle route publique fait échouer la suite.
//   2. Chaque autre route, appelée sans jeton, avec un jeton forgé ou expiré, répond 401.
//   3. Inventaire écrit dans $E2E_OUT/routes_securite.md : garde grossier de chaque route (@Roles,
//      @RolesFonctionnels, ouverture aux stagiaires) ; le contrôle fin (403) est dans les services et
//      joué par les suites de chaque module (refus du stagiaire : d6_role_stagiaire).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('../config');
const { check, bilan } = require('../lib');
const API = 'http://localhost:3000';
const SRC = path.join(E.RACINE, 'apps/api/src');

const PUBLIQUES = new Set([
  'GET /health', 'GET /health/dependances',
  'POST /auth/register', 'GET /auth/register/org-options', 'GET /auth/register/supervisor-options',
  'POST /auth/forgot-password', 'POST /auth/reset-password', 'POST /auth/login', 'POST /auth/login/2fa',
  'POST /auth/2fa/setup', 'POST /auth/2fa/enable', 'POST /auth/refresh', 'POST /auth/logout',
]);

function fichiers(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiers(p, acc); else if (p.endsWith('.controller.ts')) acc.push(p);
  }
  return acc;
}

/** Routes déclarées : méthode, chemin, décorateurs de la méthode et de la classe. */
function routes() {
  const r = [];
  for (const f of fichiers(SRC)) {
    const s = fs.readFileSync(f, 'utf8');
    const ctrl = s.match(/((?:@[A-Za-z]+\([^)]*\)\s*)*)@Controller\((?:'([^']*)')?\)/);
    if (!ctrl) continue;
    const prefixe = ctrl[2] ? '/' + ctrl[2] : '';
    const classe = ctrl[1] || '';
    const re = /((?:\s*@[A-Za-z]+\((?:[^()]|\([^)]*\))*\))*)\s*@(Get|Post|Patch|Delete|Put)\((?:'([^']*)')?\)/g;
    for (const x of s.matchAll(re)) {
      const deco = x[1] || '';
      const chemin = (prefixe + (x[3] ? '/' + x[3] : '')) || '/';
      r.push({
        cle: `${x[2].toUpperCase()} ${chemin}`, methode: x[2].toUpperCase(), chemin,
        publique: /@Public\(\)/.test(deco),
        roles: (deco.match(/@Roles\(([^)]*)\)/) || classe.match(/@Roles\(([^)]*)\)/) || [])[1] || '',
        rolesFonctionnels: (deco.match(/@RolesFonctionnels\(([^)]*)\)/) || classe.match(/@RolesFonctionnels\(([^)]*)\)/) || [])[1] || '',
        stagiaires: /@OuvertAuxStagiaires\(\)/.test(deco) || /@OuvertAuxStagiaires\(\)/.test(classe),
        fichier: path.relative(E.RACINE, f),
      });
    }
  }
  return r;
}

/** Jeton signé avec un secret inconnu de l'API (forgé), et jeton expiré signé avec le bon secret. */
function jeton(secret, expDans) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const maintenant = Math.floor(Date.now() / 1000);
  const corps = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'inexistant', role: 'ADMIN_SYSTEME', iat: maintenant - 7200, exp: maintenant + expDans })}`;
  return `${corps}.${crypto.createHmac('sha256', secret).update(corps).digest('base64url')}`;
}

(async () => {
  const liste = routes();
  const publiques = liste.filter((r) => r.publique).map((r) => r.cle).sort();
  check(`routes publiques : exactement les ${PUBLIQUES.size} attendues (santé, inscription, connexion, mot de passe oublié, 2FA, renouvellement)`,
    publiques.length === PUBLIQUES.size && publiques.every((c) => PUBLIQUES.has(c)), publiques.filter((c) => !PUBLIQUES.has(c)).join(', '));

  const forge = jeton('secret-inconnu-de-l-api', 3600);
  const expire = jeton(process.env.JWT_ACCESS_SECRET || 'secret-de-test-e2e-uniquement-local', -60);
  const anomalies = { sans: [], forge: [], expire: [] };
  for (const r of liste.filter((x) => !x.publique)) {
    const url = API + r.chemin.replace(/:[A-Za-z]+/g, 'inexistant');
    const corps = r.methode === 'GET' || r.methode === 'DELETE' ? undefined : '{}';
    for (const [cas, entete] of [['sans', null], ['forge', forge], ['expire', expire]]) {
      const h = { 'Content-Type': 'application/json' };
      if (entete) h.Authorization = `Bearer ${entete}`;
      const res = await fetch(url, { method: r.methode, headers: h, body: corps });
      if (res.status !== 401) anomalies[cas].push(`${r.cle} → ${res.status}`);
    }
  }
  const n = liste.length - publiques.length;
  check(`${n} routes protégées appelées sans jeton : 401`, anomalies.sans.length === 0, anomalies.sans.join(' ; '));
  check(`${n} routes protégées appelées avec un jeton forgé (secret inconnu, rôle administrateur) : 401`, anomalies.forge.length === 0, anomalies.forge.join(' ; '));
  check(`${n} routes protégées appelées avec un jeton expiré : 401`, anomalies.expire.length === 0, anomalies.expire.join(' ; '));
  const alg = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${forge.split('.').slice(0, 2).join('.').replace(/^[^.]+/, Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'))}.` } });
  check('jeton « alg: none » (sans signature) : 401', alg.status === 401, alg.status);

  const md = [
    '# Inventaire des routes de l’API (revue de sécurité, octobre 2026)',
    '',
    `${liste.length} routes, dont ${publiques.length} publiques. Toutes les autres exigent un jeton valide (401 sinon, vérifié par \`s1_routes\`) ;`,
    'un stagiaire est refusé (403) partout sauf « ouverte aux stagiaires » (vérifié par `d6_role_stagiaire`). Le contrôle fin',
    '(périmètre, besoin d’en connaître) est dans le service de chaque route et joué par la suite du module.',
    '',
    '| Route | Garde grossier | Stagiaire | Fichier |',
    '|---|---|---|---|',
    ...liste.map((r) => `| \`${r.cle}\` | ${r.publique ? '**publique**' : [r.roles && `@Roles(${r.roles.replace(/SystemRole\./g, '')})`, r.rolesFonctionnels && `@RolesFonctionnels(${r.rolesFonctionnels})`].filter(Boolean).join(' ') || 'service'} | ${r.publique ? '—' : r.stagiaires ? 'ouverte' : 'refusée'} | ${r.fichier} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(E.OUT, 'routes_securite.md'), md);
  console.log(`Inventaire écrit : ${liste.length} routes.`);
  bilan();
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
