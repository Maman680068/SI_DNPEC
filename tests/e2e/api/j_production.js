// J — configuration de production de l'API vue par le navigateur (cause des « Failed to fetch ») :
// CORS strict (CORS_ORIGIN posé par run_all.sh avec barre finale et espaces, comme une saisie
// dans Render), origines refusées journalisées, version déployée lisible (API /health et web
// /api/version, variables RENDER_GIT_* de Render). Puis une API à part (port 3002) : CORS_ORIGIN
// vide (toute origine) et version renseignée comme sur Render.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const JOURNAL = path.join(E.OUT, 'logs', 'api-normal.log');
const WEB = 'http://localhost:3100';

/** Pré-vol CORS tel que l'envoie Chromium avant l'appel de la cloche. */
const prevol = (base, origine) => fetch(`${base}/notifications`, {
  method: 'OPTIONS',
  headers: { Origin: origine, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type,x-interim-for' },
});
const attendre = async (f, n = 40) => { for (let i = 0; i < n; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };

(async () => {
  console.log(`— API de la suite : CORS_ORIGIN=${JSON.stringify(process.env.CORS_ORIGIN)}`);
  const journal = () => fs.readFileSync(JOURNAL, 'utf8');
  check('démarrage : origines autorisées journalisées, normalisées (sans « / » final ni espaces)', journal().includes('Origines autorisées : http://localhost:3100, https://preproduction.exemple.invalid'));

  const ok = await prevol('http://localhost:3000', WEB);
  check(`origine du web (${WEB}) acceptée malgré la barre finale saisie → ${ok.headers.get('access-control-allow-origin')}`, ok.headers.get('access-control-allow-origin') === WEB);
  check('en-têtes de la cloche autorisés (Authorization, Content-Type, X-Interim-For)', /authorization/.test(ok.headers.get('access-control-allow-headers') || '') && /x-interim-for/.test(ok.headers.get('access-control-allow-headers') || ''));
  const second = await prevol('http://localhost:3000', 'https://preproduction.exemple.invalid');
  check('seconde origine de la liste acceptée', second.headers.get('access-control-allow-origin') === 'https://preproduction.exemple.invalid');
  const get = await fetch('http://localhost:3000/notifications', { headers: { Origin: WEB, Authorization: 'Bearer x' } });
  check(`réponse d'erreur (401) lisible par le web : en-tête CORS présent → ${get.status}`, get.status === 401 && get.headers.get('access-control-allow-origin') === WEB);
  check('Content-Disposition exposé (attestations, D6)', /content-disposition/i.test(get.headers.get('access-control-expose-headers') || ''));

  const intrus = 'https://intrus.exemple.invalid';
  const refus = await prevol('http://localhost:3000', intrus);
  check('origine absente de la liste : aucun en-tête d’autorisation (le navigateur bloque)', refus.headers.get('access-control-allow-origin') === null);
  await prevol('http://localhost:3000', intrus);
  check('refus journalisé, une seule fois par origine', await attendre(async () => journal().split(`Origine refusée : ${intrus}`).length === 2));
  check('appel sans origine (Route Handlers du web, sonde Render) accepté', (await fetch('http://localhost:3000/health')).ok);

  console.log('— Version déployée');
  const h = await (await fetch('http://localhost:3000/health')).json();
  check('API /health : status ok + version (null hors Render)', h.status === 'ok' && h.version && h.version.commit === null && h.version.branche === null, JSON.stringify(h));
  const v = await fetch(`${WEB}/api/version`);
  const vj = await v.json();
  check(`web /api/version → ${v.status} ${JSON.stringify(vj)}`, v.status === 200 && 'commit' in vj && 'branche' in vj);

  console.log('— API comme sur Render : RENDER_GIT_COMMIT/BRANCH renseignés, CORS_ORIGIN vide');
  const log2 = path.join(E.OUT, 'logs', 'api-render.log');
  const sortie = fs.openSync(log2, 'w');
  const env = { ...process.env, PORT: '3002', CORS_ORIGIN: '', NODE_ENV: 'production', RENDER_GIT_COMMIT: 'f96254d0000000000000000000000000000000ab', RENDER_GIT_BRANCH: 'main' };
  const proc = spawn('node', ['dist/main.js'], { cwd: E.API_DIR, env, stdio: ['ignore', sortie, sortie] });
  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) { await new Promise((r) => setTimeout(r, 1000)); pret = await fetch('http://localhost:3002/health').then((r) => r.ok, () => false); }
    check('API de test démarrée', pret);
    const h2 = await (await fetch('http://localhost:3002/health')).json();
    check('version lue dans les variables de Render', h2.version.commit === env.RENDER_GIT_COMMIT && h2.version.branche === env.RENDER_GIT_BRANCH, JSON.stringify(h2.version));
    const tout = await prevol('http://localhost:3002', intrus);
    check('CORS_ORIGIN vide : toute origine acceptée (comportement historique)', tout.headers.get('access-control-allow-origin') === intrus);
    check('… et annoncé au démarrage', fs.readFileSync(log2, 'utf8').includes('CORS_ORIGIN vide : toute origine est autorisée'));
  } finally {
    proc.kill();
  }

  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
