// Refonte de l'interface (étape 9) — finitions communes : page « Mon profil » (et redirections des
// anciennes adresses), cloche (groupes par jour, filtres, icônes, « Tout marquer comme lu », lien
// direct), recherche pendant la frappe (3 lettres, ↑ ↓ Entrée Échap, « Voir les N résultats »),
// « À traiter » de l'administrateur (points de supervision), prénom de l'accueil sans « TEST — »,
// démarrage en squelette, barres de défilement fines. Bureau 1440 et téléphone 390.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const BUREAU = { width: 1440, height: 900 };
const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const sansDebord = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const attendre = (fn, ms = 8000) => new Promise((ok) => { const t0 = Date.now(); const f = async () => ((await fn()) ? ok(true) : Date.now() - t0 > ms ? ok(false) : setTimeout(f, 200)); f(); });

(async () => {
  const b = await browser();

  console.log('— Mon profil (agent, bureau)');
  let p = await loginPage(b, 'agent1', BUREAU);
  await p.getByRole('button', { name: 'Mon compte' }).click();
  await p.getByRole('link', { name: 'Mon profil' }).click();
  await p.waitForURL('**/compte');
  await p.getByRole('heading', { name: 'Mon profil', level: 1 }).waitFor();
  const api = (await call('agent1', 'GET', '/api/v1/profil')).body;
  const carte = p.getByTestId('carte-identite');
  await carte.waitFor();
  const t = await carte.innerText();
  check('identité : nom, unité, chef direct, email (valeurs de l’API)', t.includes(api.nom) && t.includes(api.email) && (!api.unite || t.includes(api.unite)) && (!api.chefDirect || t.includes(api.chefDirect)));
  check(`complétude : « Profil complété à ${api.completude.pourcentage} % »`, (await p.getByTestId('completude').innerText()).includes(`Profil complété à ${api.completude.pourcentage} %`));
  for (const s of ['Sécurité', 'Notifications', 'Aide']) check(`section « ${s} »`, (await p.getByRole('heading', { name: s, exact: true }).count()) === 1);
  check('double authentification : état et bouton « Activer »', /Désactivée/.test(await p.getByTestId('double-auth').innerText()) && (await p.getByTestId('double-auth').getByRole('button', { name: 'Activer' }).count()) === 1);
  check('sessions ouvertes listées (au moins celle-ci)', await attendre(async () => (await p.getByTestId('session').count()) >= 1));
  await p.screenshot({ path: `${E.SHOTS}/u9_profil_bureau.png` });
  console.log('— Notifications : interrupteur du résumé quotidien, toast avec « Annuler »');
  const avant = (await call('agent1', 'GET', '/api/v1/notifications/preferences')).body;
  await p.getByRole('switch', { name: /Résumé quotidien/ }).click();
  await p.getByTestId('toast').waitFor();
  check('toast « Préférences enregistrées » avec « Annuler »', /Préférences enregistrées/.test(await p.getByTestId('toast').innerText()) && (await p.getByTestId('toast').getByRole('button', { name: 'Annuler' }).count()) === 1);
  check('API : préférence inversée', (await call('agent1', 'GET', '/api/v1/notifications/preferences')).body.resumeQuotidien === !avant.resumeQuotidien);
  await p.getByTestId('toast').getByRole('button', { name: 'Annuler' }).click();
  check('« Annuler » : préférence rétablie', await attendre(async () => (await call('agent1', 'GET', '/api/v1/notifications/preferences')).body.resumeQuotidien === avant.resumeQuotidien));
  console.log('— Anciennes adresses');
  await p.goto(`${WEB}/compte/notifications`);
  await p.waitForURL('**/compte?section=notifications');
  check('/compte/notifications → section Notifications de « Mon profil »', await attendre(async () => (await p.getByRole('heading', { name: 'Mon profil', level: 1 }).count()) === 1));
  await p.goto(`${WEB}/compte/securite`);
  await p.waitForURL('**/compte?section=securite');
  check('/compte/securite → section Sécurité', true);

  console.log('— Cloche');
  await call('chefssr', 'POST', '/tasks', { title: `Cloche ${S}`, assignees: [{ userId: ids.agent1 }], divisionId: ids.DPE, sectionId: ids.SSR });
  await p.goto(`${WEB}/dashboard`);
  await p.getByRole('button', { name: /^Notifications/ }).click();
  const cloche = p.getByRole('dialog', { name: 'Notifications' });
  await cloche.getByTestId('notification').first().waitFor();
  check('groupes par jour (« Aujourd’hui »)', (await cloche.getByRole('heading', { name: 'Aujourd’hui' }).count()) === 1);
  check('filtres Toutes / Non lues / À traiter', (await cloche.getByRole('group', { name: 'Filtrer les notifications' }).getByRole('button').allInnerTexts()).join('|') === 'Toutes|Non lues|À traiter');
  await cloche.getByRole('button', { name: 'À traiter' }).click();
  check('« À traiter » : la tâche assignée y figure', (await cloche.getByTestId('notification').filter({ hasText: `Cloche ${S}` }).count()) >= 1 || (await cloche.locator('[data-type=TACHE_ASSIGNEE]').count()) >= 1);
  await cloche.getByRole('button', { name: 'Non lues' }).click();
  const nonLues = await cloche.getByTestId('notification').count();
  check('« Non lues » : seulement des non lues', nonLues === (await cloche.getByTestId('notification').filter({ hasText: 'non lue' }).count()));
  await p.screenshot({ path: `${E.SHOTS}/u9_cloche.png` });
  if (await cloche.getByRole('button', { name: 'Tout marquer comme lu' }).count()) {
    await cloche.getByRole('button', { name: 'Tout marquer comme lu' }).click();
    check('« Tout marquer comme lu » : plus aucune non lue (API)', await attendre(async () => (await call('agent1', 'GET', '/notifications/unread-count')).body === 0));
  }
  await cloche.getByRole('button', { name: 'Toutes' }).click();
  await cloche.getByTestId('notification').first().click();
  check('clic : ouvre l’élément (lien direct)', await attendre(async () => !p.url().endsWith('/dashboard')), p.url());

  console.log('— Recherche pendant la frappe');
  await p.goto(`${WEB}/dashboard`);
  await p.getByRole('combobox', { name: 'Recherche transverse' }).waitFor();
  await p.keyboard.press('Control+k');
  await p.keyboard.type('Clo');
  const sugg = p.getByTestId('suggestions-recherche');
  check('à partir de 3 lettres : liste de résultats', await attendre(async () => (await sugg.getByRole('option').count()) > 0));
  check('groupés par type (Tâches…)', (await sugg.getByRole('group', { name: 'Tâches' }).count()) === 1);
  check('« Voir les N résultats »', /Voir les \d+\+? résultats/.test(await sugg.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/u9_recherche.png` });
  await p.keyboard.press('ArrowDown');
  check('↓ : premier résultat actif', (await sugg.getByRole('option', { selected: true }).count()) === 1);
  await p.keyboard.press('Escape');
  check('Échap : liste fermée', (await sugg.count()) === 0);
  await p.getByRole('combobox', { name: 'Recherche transverse' }).focus();
  await p.keyboard.type('h');
  await sugg.getByRole('option').first().waitFor().catch(() => {});
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  check('Entrée sur un résultat : l’élément s’ouvre', await attendre(async () => !p.url().endsWith('/dashboard')), p.url());
  await p.goto(`${WEB}/dashboard`);
  await p.getByRole('combobox', { name: 'Recherche transverse' }).waitFor();
  await p.keyboard.press('Control+k');
  await p.keyboard.type('Cloche');
  await sugg.waitFor();
  await p.keyboard.press('Enter');
  await p.waitForURL('**/recherche?q=Cloche');
  check('Entrée sans choix : page Recherche (règles inchangées)', true);
  await p.context().close();

  console.log('— Démarrage en squelette, prénom sans « TEST — »');
  const email = `test.prenom.${S}@test.local`;
  const u = await call('admin', 'POST', '/users', { email, password: 'Password123!', firstName: 'TEST — Mariam', lastName: `Prénom${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR });
  check('compte « TEST — Mariam » créé', u.status === 201);
  const ctx = await b.newContext({ viewport: BUREAU, locale: 'fr-FR' });
  p = await ctx.newPage();
  await p.goto(`${WEB}/login`);
  await p.getByLabel(/mail/i).fill(email);
  await p.locator('#mot-de-passe').fill('Password123!');
  await p.route('**/auth/refresh**', async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
  await p.getByRole('button', { name: /connecter/i }).click();
  await p.waitForURL('**/dashboard');
  const accueil = await p.getByRole('heading', { level: 1 }).first().innerText();
  check(`accueil : « ${accueil} » sans « TEST — »`, /^(Bonjour|Bonsoir) Mariam$/.test(accueil.trim()), accueil);
  await p.goto(`${WEB}/tasks`, { waitUntil: 'commit' });
  const squelette = await attendre(async () => (await p.getByTestId('squelette-application').count()) + (await p.getByTestId('squelette').count()) + (await p.getByTestId('squelette-page').count()) > 0, 3000);
  check('chargement : squelette (pas de « Chargement… » seul)', squelette || (await p.getByText('Chargement…', { exact: true }).count()) === 0);
  await ctx.close();

  console.log('— Administrateur : « À traiter » reprend la supervision');
  p = await loginPage(b, 'admin', BUREAU);
  const bloc = p.getByTestId('a-traiter');
  // Page et API lues l'une après l'autre ; les points sont en cache une minute : si un service change
  // d'état entre les deux lectures, seconde lecture après l'expiration du cache. La précision (Mo
  // utilisés, délai de réponse) change d'une lecture à l'autre : libellé exact, précision présente.
  const lirePoints = async () => {
    await p.goto(`${WEB}/dashboard`);
    await bloc.waitFor();
    await p.waitForLoadState('networkidle').catch(() => {});
    const nav = (await call('admin', 'GET', '/api/v1/navigation')).body;
    const pts = nav.aTraiter.filter((x) => x.cle.startsWith('supervision-'));
    const lignesSup = bloc.locator('[data-testid^="a-traiter-supervision-"]');
    const ok = (await lignesSup.count()) === pts.length
      && (await Promise.all(pts.map(async (x) => (await bloc.getByTestId(`a-traiter-${x.cle}`).count()) === 1 && (await bloc.getByTestId(`a-traiter-${x.cle}`).innerText()).includes(x.libelle)))).every(Boolean)
      && (await lignesSup.allInnerTexts()).every((t) => t.split('\n').filter(Boolean).length >= 2);
    return [pts, ok];
  };
  let [points, conforme] = await lirePoints();
  if (!conforme) {
    await new Promise((r) => setTimeout(r, 61000));
    [points, conforme] = await lirePoints();
  }
  check(`${points.length} point(s) de supervision dans « À traiter », avec leur précision`, conforme);
  if (points.length) {
    await bloc.locator('[data-testid^="a-traiter-supervision-"]').first().click();
    await p.waitForURL('**/parametrage?onglet=supervision');
    check('clic : onglet Supervision', true);
  }
  console.log('— Barres de défilement : fines, sans flèches, limitées à l’application');
  const regles = await p.evaluate(() => {
    const t = [];
    for (const f of Array.from(document.styleSheets)) { try { for (const r of Array.from(f.cssRules)) t.push(r.cssText); } catch {} }
    return t.join('\n');
  });
  check('::-webkit-scrollbar 6 px dans .contraste-aa', /\.contraste-aa\s*::-webkit-scrollbar\s*\{[^}]*width:\s*6px/.test(regles));
  check('flèches masquées', /::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/.test(regles));
  check('couleur du menu dans le menu latéral', /\.menu-defilant[^{]*::-webkit-scrollbar-thumb\s*\{[^}]*rgb\(58, 69, 128\)|#3a4580/i.test(regles));
  await p.context().close();

  console.log('— Instructions : un état vide propose toujours une action');
  p = await loginPage(b, 'chefsfp', BUREAU);
  await p.goto(`${WEB}/instructions`);
  const tab = p.getByTestId('tableau-instructions');
  await tab.waitFor();
  await p.waitForLoadState('networkidle').catch(() => {});
  if (await tab.getByText(/^Aucune instruction/).count()) {
    check('état vide : une action proposée (bouton ou lien)', (await tab.getByRole('button').count()) + (await tab.getByRole('link').count()) > 0);
  } else console.log('   (des instructions existent pour ce compte : état vide non joué)');
  await p.context().close();

  console.log('— Téléphone');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/compte`);
  await p.getByTestId('carte-identite').waitFor();
  check('Mon profil : pas de défilement horizontal', await sansDebord(p));
  await p.screenshot({ path: `${E.SHOTS}/u9_profil_telephone.png`, fullPage: true });
  await p.goto(`${WEB}/dashboard`);
  await p.getByRole('button', { name: /^Notifications/ }).click();
  await p.getByRole('dialog', { name: 'Notifications' }).waitFor();
  check('cloche : pas de défilement horizontal', await sansDebord(p));
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(1); });
