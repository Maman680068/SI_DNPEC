// Test de charge (octobre 2026) — API locale uniquement, sur une base gonflée par volume.js.
// 100 utilisateurs simultanés (par défaut) : les 18 comptes du jeu de test (Direction, chefs, DRH,
// secrétariats…) et des comptes de volume vol<n>@test.local. Chacun ouvre les écrans courants
// (tableau de bord, tâches, congés, notifications, GED, courrier, réunions, annuaire, recherche),
// avec un temps de réflexion aléatoire entre deux écrans. Mesure p50/p95/p99 par route.
//   BASE=http://localhost:3000 UTILISATEURS=100 DUREE=60 REFLEXION_MS=1000 node tests/e2e/outils/charge.js
//   SORTIE=fichier.json pour garder les mesures.
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:3000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) {
  console.error('Refusé : BASE ne pointe pas vers une API locale.');
  process.exit(1);
}
const N = Number(process.env.UTILISATEURS || 100);
const DUREE = Number(process.env.DUREE || 60) * 1000;
const REFLEXION = Number(process.env.REFLEXION_MS || 1000);

const COMPTES_TEST = ['dn', 'dna', 'drh', 'admin', 'chefdee', 'chefdpe', 'chefse', 'chefssr', 'chefsfp', 'chefsaf', 'agent1', 'agent2', 'agentdee', 'agentsaf', 'secdg', 'secdpe', 'asssaf', 'assdn'];
const comptes = [...COMPTES_TEST, ...Array.from({ length: Math.max(0, N - COMPTES_TEST.length) }, (_, i) => `vol${i + 1}`)].slice(0, N);

// Écrans courants, pondérés selon leur fréquence d'ouverture.
const ECRANS = [
  ['tableau-de-bord', '/api/v1/tableau-de-bord', 3],
  ['notifications (compteur)', '/notifications/unread-count', 4],
  ['notifications', '/notifications', 2],
  // Écran d'accueil (suivi des tâches) : avant la PR « performance », le web demandait /tasks entier
  // (CHARGE_AVANT=1 pour rejouer cette mesure).
  ['tâches (liste)', process.env.CHARGE_AVANT ? '/tasks' : '/tasks?suivi=true&limite=301', 3],
  ['tâches (synthèse)', '/tasks/dashboard', 1],
  ['congés', '/leaves', 2],
  ['GED', '/documents', 2],
  ['courrier arrivée', '/courrier/arrivees', 1],
  ['réunions', '/meetings', 1],
  ['annuaire', '/users/directory', 1],
  ['recherche', '/api/v1/recherche?q=conjoncture', 1],
];
const tirage = ECRANS.flatMap((e) => Array(e[2]).fill(e));

const mesures = {}; // nom → durées (ms)
const statuts = {}; // nom → { code: nombre }
const tailles = {}; // nom → octets (dernière réponse)
let erreurs = 0;

async function connexion(cle) {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${cle}@test.local`, password: 'Password123!' }) });
  const b = await r.json();
  if (!b.accessToken) throw new Error(`connexion ${cle} : ${JSON.stringify(b)}`);
  return b.accessToken;
}

async function appel(jeton, nom, chemin) {
  const t = performance.now();
  try {
    const r = await fetch(BASE + chemin, { headers: { Authorization: 'Bearer ' + jeton } });
    const corps = await r.arrayBuffer();
    const d = performance.now() - t;
    (mesures[nom] ||= []).push(d);
    (statuts[nom] ||= {})[r.status] = ((statuts[nom] || {})[r.status] || 0) + 1;
    tailles[nom] = Math.max(tailles[nom] || 0, corps.byteLength);
    if (r.status >= 500) erreurs++;
  } catch (e) {
    erreurs++;
    (statuts[nom] ||= {})[`échec ${e.cause?.code || e.name}`] = ((statuts[nom] || {})[`échec ${e.cause?.code || e.name}`] || 0) + 1;
  }
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const centile = (t, p) => (t.length ? t[Math.min(t.length - 1, Math.floor((p / 100) * t.length))] : 0);

(async () => {
  console.log(`Connexion de ${comptes.length} comptes…`);
  const jetons = [];
  for (const c of comptes) jetons.push(await connexion(c));
  const fin = Date.now() + DUREE;
  const t0 = performance.now();
  await Promise.all(
    jetons.map(async (jeton, i) => {
      await pause(Math.random() * REFLEXION); // arrivées étalées
      // Chaque session commence par l'écran d'accueil de l'application.
      await appel(jeton, 'tableau-de-bord', '/api/v1/tableau-de-bord');
      while (Date.now() < fin) {
        const [nom, chemin] = tirage[Math.floor(Math.random() * tirage.length)];
        await appel(jeton, nom, chemin);
        await pause(REFLEXION * (0.5 + Math.random()));
      }
      return i;
    }),
  );
  const secondes = (performance.now() - t0) / 1000;
  const lignes = [];
  let total = 0;
  const toutes = [];
  for (const [nom] of ECRANS) {
    const t = (mesures[nom] || []).sort((a, b) => a - b);
    total += t.length;
    toutes.push(...t);
    lignes.push({ ecran: nom, requetes: t.length, p50: Math.round(centile(t, 50)), p95: Math.round(centile(t, 95)), p99: Math.round(centile(t, 99)), max: Math.round(t[t.length - 1] || 0), ko: Math.round((tailles[nom] || 0) / 1024), statuts: statuts[nom] || {} });
  }
  toutes.sort((a, b) => a - b);
  const resume = { utilisateurs: comptes.length, dureeS: Math.round(secondes), requetes: total, debit: +(total / secondes).toFixed(1), p50: Math.round(centile(toutes, 50)), p95: Math.round(centile(toutes, 95)), p99: Math.round(centile(toutes, 99)), erreurs };
  console.log('\nÉcran                       requêtes   p50   p95   p99    max (ms)  taille max (Ko)  statuts');
  for (const l of lignes) console.log(`${l.ecran.padEnd(27)} ${String(l.requetes).padStart(8)} ${String(l.p50).padStart(5)} ${String(l.p95).padStart(5)} ${String(l.p99).padStart(5)} ${String(l.max).padStart(6)}  ${String(l.ko).padStart(15)}  ${JSON.stringify(l.statuts)}`);
  console.log(`\nTotal : ${resume.requetes} requêtes en ${resume.dureeS} s (${resume.debit}/s) — p50 ${resume.p50} ms, p95 ${resume.p95} ms, p99 ${resume.p99} ms — erreurs (5xx ou échec réseau) : ${resume.erreurs}`);
  if (process.env.SORTIE) fs.writeFileSync(process.env.SORTIE, JSON.stringify({ resume, lignes }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
