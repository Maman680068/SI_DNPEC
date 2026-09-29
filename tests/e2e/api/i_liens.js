// I — liens produits par l'API vers le web (notifications, emails) : chacun doit mener à une page
// qui existe et qui lit ses paramètres. Trois sources :
//   1. le code de l'API (toute chaîne « /… » de apps/api/src, et « ${webAppUrl}/… ») ;
//   2. les notifications réellement enregistrées par les suites précédentes (table notifications) ;
//   3. les emails réellement journalisés par l'API pendant la suite (out/logs/api-*.log).
// Référence : les pages de apps/web/app (page.tsx, groupes « (x) » ignorés, « [x] » = segment
// variable), les paramètres qu'elles lisent (.get('x')), et les redirections des anciens formats
// (apps/web/anciens-liens.json, lues par next.config.ts). Puis appels HTTP réels au web (3100) :
// chaque forme de lien répond (jamais 404), chaque ancien format redirige, une adresse inconnue
// affiche la page 404 en français.
const fs = require('fs');
const path = require('path');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const WEB = 'http://localhost:3100';
const WEB_DIR = path.join(E.RACINE, 'apps/web');
const APP_DIR = path.join(WEB_DIR, 'app');
const VAR = '§'; // valeur calculée à l'exécution (${…} dans le code, identifiant dans la base)

function fichiers(dir, filtre, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') fichiers(p, filtre, acc); } else if (filtre(p)) acc.push(p);
  }
  return acc;
}

/** Fichier local importé par `depuis` (./ ou ../), ou null. */
function resoudreImport(depuis, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(depuis), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Texte d'une page et des modules locaux qu'elle importe (2 niveaux : composants, bibliothèques). */
function sourcesDePage(page) {
  const vus = new Set(); let niveau = [page];
  for (let n = 0; n < 3 && niveau.length; n++) {
    const suivant = [];
    for (const f of niveau) {
      if (vus.has(f)) continue; vus.add(f);
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/from\s+'([^']+)'/g)) { const r = resoudreImport(f, m[1]); if (r) suivant.push(r); }
    }
    niveau = suivant;
  }
  return [...vus].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

// ── Pages du web
const routes = fichiers(APP_DIR, (p) => path.basename(p) === 'page.tsx').map((f) => {
  const segments = path.relative(APP_DIR, path.dirname(f)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s));
  const src = sourcesDePage(f);
  return {
    chemin: '/' + segments.join('/'),
    segments,
    fichier: path.relative(E.RACINE, f),
    params: new Set([...src.matchAll(/\.get\(\s*'([A-Za-z_]+)'\s*\)/g)].map((m) => m[1])),
    src,
  };
});
const anciens = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'anciens-liens.json'), 'utf8'));

function routeDe(chemin) {
  const s = chemin.split('/').filter(Boolean);
  return routes.find((r) => r.segments.length === s.length && r.segments.every((x, i) => /^\[.+\]$/.test(x) || x === s[i])) || null;
}
function redirectionDe(chemin) {
  const s = chemin.split('/').filter(Boolean);
  return anciens.find((a) => { const m = a.source.split('/').filter(Boolean); return m.length === s.length && m.every((x, i) => x.startsWith(':') || x === s[i]); }) || null;
}

/** Vérifie un lien « /chemin?cle=valeur » ; renvoie null s'il est bon, sinon la raison. */
function probleme(lien, { redirectionPermise = false } = {}) {
  if (!lien.startsWith('/') || lien.startsWith('//')) return 'pas un chemin interne';
  const [chemin, requete = ''] = lien.split('?');
  const route = routeDe(chemin);
  if (!route) {
    const a = redirectionPermise && redirectionDe(chemin);
    if (!a) return `aucune page web pour « ${chemin} »`;
    const cible = a.destination.replace(/:([A-Za-z]+)/g, VAR);
    return probleme(cible + (requete ? (cible.includes('?') ? '&' : '?') + requete : ''));
  }
  for (const [cle, valeur] of new URLSearchParams(requete)) {
    if (!route.params.has(cle)) return `paramètre « ${cle} » non lu par ${route.fichier}`;
    if (valeur !== VAR && !route.src.includes(`'${valeur}'`)) return `valeur « ${cle}=${valeur} » inconnue de ${route.fichier}`;
  }
  return null;
}

(async () => {
  console.log(`— Référence : ${routes.length} pages web, ${anciens.length} anciens formats redirigés`);
  check('les pages sont bien trouvées (tableau de bord, tâche, communication)', ['/dashboard', '/tasks/[id]', '/communication'].every((c) => routes.some((r) => r.chemin === c)));
  check('paramètres lus par /communication : with, announcementId, pollId', ['with', 'announcementId', 'pollId'].every((p) => routeDe('/communication').params.has(p)));
  check('paramètre lu par /reset-password (via son formulaire) : token', routeDe('/reset-password').params.has('token'));

  console.log('— 1. Liens écrits dans le code de l’API');
  const statiques = [];
  for (const f of fichiers(E.API_SRC, (p) => p.endsWith('.ts'))) {
    const lignes = fs.readFileSync(f, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      const ou = `${path.relative(E.RACINE, f)}:${i + 1}`;
      // Chaîne ou gabarit commençant par « /mot » (jamais un chemin système).
      for (const m of l.matchAll(/`(\/[a-z][^`\s]*)`|'(\/[a-z][^'\s]*)'/g)) {
        const brut = m[1] || m[2];
        // Chemins système et routes de l’API elle-même (/api/v1/…) : jamais des liens vers le web.
        if (/^\/(var|tmp|etc|usr|home|opt|app|proc|dev|api)\b/.test(brut)) continue;
        statiques.push({ lien: brut.replace(/\$\{[^}]*\}/g, VAR), ou });
      }
      // Adresse complète d'un email : `${…webAppUrl…}/chemin…`.
      for (const m of l.matchAll(/\$\{[^}]*(?:webAppUrl|WEB_APP_URL)[^}]*\}(\/[^`'\s]*)/g)) {
        statiques.push({ lien: m[1].replace(/\$\{[^}]*\}/g, VAR), ou });
      }
    });
  }
  check(`liens trouvés dans le code (${statiques.length}, attendu ≥ 40)`, statiques.length >= 40);
  const formes = [...new Set(statiques.map((s) => s.lien))].sort();
  console.log('   formes : ' + formes.join('  '));
  for (const s of statiques) {
    const p = probleme(s.lien);
    if (p) check(`${s.lien} (${s.ou})`, false, p);
  }
  check('chaque lien du code mène à une page existante, avec des paramètres lus par la page', statiques.every((s) => !probleme(s.lien)));
  check('aucun ancien format dans le code (/messages/with, /announcements)', !statiques.some((s) => redirectionDe(s.lien.split('?')[0])));

  console.log('— 2. Anciens formats redirigés (apps/web/anciens-liens.json)');
  for (const attendu of ['/messages/with/:id', '/announcements/:id']) check(`${attendu} fait partie des redirections`, anciens.some((a) => a.source === attendu));
  for (const a of anciens) {
    check(`${a.source} : n’est plus une page (sinon la redirection masquerait une page)`, !routeDe(a.source.replace(/:[A-Za-z]+/g, 'x')));
    const p = probleme(a.destination.replace(/:[A-Za-z]+/g, VAR));
    check(`${a.source} → ${a.destination} : cible valide`, !p, p || '');
  }

  // Un lien réel est couvert s'il a la forme d'un lien du code (déjà vérifié), directement
  // ou après la redirection d'un ancien format.
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const motifs = formes.map((f) => ({ f, re: new RegExp('^' + f.split(VAR).map(esc).join('[^/?&]+') + '$') }));
  const formeDe = (l) => motifs.find((m) => m.re.test(l))?.f ?? null;
  const rediriger = (l) => {
    const [c, q] = l.split('?'); const a = redirectionDe(c); if (!a) return null;
    const s = c.split('/').filter(Boolean); const v = {};
    a.source.split('/').filter(Boolean).forEach((x, i) => { if (x.startsWith(':')) v[x.slice(1)] = s[i]; });
    const d = a.destination.replace(/:([A-Za-z]+)/g, (_, k) => v[k]);
    return d + (q ? (d.includes('?') ? '&' : '?') + q : '');
  };
  const couvert = (l) => formeDe(l) || formeDe(rediriger(l) ?? '');
  const verifierReels = (quoi, liens) => {
    const sans = liens.filter((l) => !couvert(l));
    for (const l of sans.slice(0, 10)) check(l, false, 'forme inconnue du code de l’API');
    check(`chaque lien ${quoi} a la forme d’un lien vérifié du code`, sans.length === 0);
    const vues = [...new Set(liens.map(couvert).filter(Boolean))].sort();
    console.log(`   formes rencontrées (${vues.length}) : ${vues.join('  ')}`);
    return vues;
  };

  console.log('— 3. Notifications enregistrées par les suites précédentes');
  const enBase = (await prisma.notification.findMany({ where: { link: { not: null } }, select: { link: true }, distinct: ['link'] })).map((n) => n.link);
  check(`liens distincts en base (${enBase.length}, attendu ≥ 20)`, enBase.length >= 20);
  const vuesBase = verifierReels('enregistré en base', enBase);
  check(`formes variées en base (${vuesBase.length}, attendu ≥ 10)`, vuesBase.length >= 10);

  console.log('— 4. Emails journalisés par l’API pendant la suite');
  const journaux = fichiers(path.join(E.OUT, 'logs'), (p) => /api-.*\.log$/.test(p)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const dansEmails = [...new Set([...journaux.matchAll(/http:\/\/localhost:3100(\/[^\s"'<>)]*)/g)].map((m) => m[1].replace(/[.,;]$/, '')))];
  check(`liens distincts dans les emails (${dansEmails.length}, attendu ≥ 20)`, dansEmails.length >= 20);
  const vuesEmails = verifierReels('d’email', dansEmails);
  check('emails de compte vus : /login, /register, /reset-password', ['/login', '/register', `/reset-password?token=${VAR}`].every((f) => vuesEmails.includes(f)));

  console.log('— 5. Appels réels au web (port 3100)');
  const exemple = (l) => l.split(VAR).join('lien-test-123');
  const get = (u) => fetch(WEB + u, { redirect: 'manual' });
  for (const l of formes) {
    const r = await get(exemple(l));
    // /dashboard sans session : l'intergiciel renvoie vers l'accueil (307), jamais une 404.
    check(`GET ${exemple(l)} → ${r.status}`, r.status === 200 || (r.status === 307 && l.startsWith('/dashboard')));
  }
  for (const a of anciens) {
    const src = a.source.replace(/:[A-Za-z]+/g, 'ancien-id-42');
    const r = await get(src);
    const attendu = a.destination.replace(/:[A-Za-z]+/g, 'ancien-id-42');
    check(`GET ${src} → ${r.status} vers ${r.headers.get('location')}`, r.status === 307 && r.headers.get('location') === attendu, `attendu 307 vers ${attendu}`);
    const suivi = await fetch(WEB + src);
    check(`  … la page cible répond (${suivi.status})`, suivi.status === 200 && new URL(suivi.url).pathname + new URL(suivi.url).search === attendu);
  }
  const inconnue = await get('/adresse/qui-n-existe-pas');
  const html = await inconnue.text();
  check(`adresse inconnue → ${inconnue.status}`, inconnue.status === 404);
  check('page 404 en français : « Page introuvable »', html.includes('Page introuvable') && !html.includes('This page could not be found'));
  check('page 404 : bouton « Retour au tableau de bord » vers /dashboard', /href="\/dashboard"[^>]*>Retour au tableau de bord/.test(html));
  check('page 404 : logo DNPEC', html.includes('/logo-dnpec.png'));

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
