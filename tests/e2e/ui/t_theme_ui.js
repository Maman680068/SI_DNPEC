// Thème sombre (choix « Thème : clair / sombre » du menu du compte et de « Mon profil », gardé dans le
// navigateur) : bascule, mémorisation après rechargement, accueil et connexion inchangés, puis tour des pages
// principales en sombre (bureau 1440 et téléphone 390) — captures (out/shots/theme_sombre_*.png) pour la
// revue à l'œil, et contrôle automatique « aucun fond blanc oublié » (élément visible de plus de 24 × 24 px
// sur fond blanc pur) dans les pages, fenêtres, listes déroulantes, calendrier, menus et squelettes.
// Le contraste AA des deux thèmes est audité par n6_accessibilite_ui.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');

const BUREAU = { width: 1440, height: 900 };
const TELEPHONE = { width: 390, height: 844 };
const theme = (p) => p.evaluate(() => document.querySelector('.contraste-aa')?.getAttribute('data-theme'));
/** Éléments visibles assez grands sur fond blanc pur, dans l'application (hors images, logo, interrupteur). */
const fondsBlancs = (p) =>
  p.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll('.contraste-aa *')) {
      if (['IMG', 'SVG', 'IFRAME', 'CANVAS', 'VIDEO', 'path'].includes(el.tagName)) continue;
      const cs = getComputedStyle(el);
      if (cs.backgroundColor !== 'rgb(255, 255, 255)' || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24 || r.bottom < 0 || r.top > innerHeight * 3) continue;
      if (el.closest('[data-apercu-papier]')) continue; // aperçu d'une feuille imprimée : blanche à dessein
      res.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')} (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
    return res.slice(0, 5);
  });

(async () => {
  const b = await browser();

  console.log('— Bascule depuis le menu du compte (bureau), mémorisée dans le navigateur');
  let p = await loginPage(b, 'agent1', BUREAU);
  check('thème clair par défaut', (await theme(p)) === 'clair');
  await p.getByRole('button', { name: 'Mon compte' }).click();
  await p.getByTestId('choix-theme').getByRole('button', { name: 'Sombre' }).click();
  check('menu du compte : « Sombre » appliqué aussitôt', (await theme(p)) === 'sombre' && (await p.getByTestId('choix-theme').getByRole('button', { name: 'Sombre' }).getAttribute('aria-pressed')) === 'true');
  const fond = await p.evaluate(() => getComputedStyle(document.querySelector('.contraste-aa')).backgroundColor);
  check(`fond bleu nuit #0E151E (${fond})`, fond === 'rgb(14, 21, 30)');
  await p.reload();
  await p.locator('main').waitFor();
  check('après rechargement : toujours sombre', (await theme(p)) === 'sombre');
  await p.goto(`${WEB}/compte`);
  const ligne = p.getByTestId('ligne-theme');
  await ligne.waitFor();
  check('« Mon profil » → Affichage : « Sombre » coché', (await ligne.getByRole('button', { name: 'Sombre' }).getAttribute('aria-pressed')) === 'true');
  await ligne.getByRole('button', { name: 'Clair' }).click();
  check('« Mon profil » : retour au clair', (await theme(p)) === 'clair');
  await ligne.getByRole('button', { name: 'Sombre' }).click();
  await p.goto(`${WEB}/`);
  const accueil = await p.evaluate(() => ({ aa: document.querySelectorAll('.contraste-aa').length, fond: getComputedStyle(document.body).backgroundColor, sage: getComputedStyle(document.body).getPropertyValue('--couleur-sage').trim() }));
  check('accueil inchangé en thème sombre (couleurs de la maquette)', accueil.aa === 0 && accueil.sage === '#1c8b4b' && accueil.fond !== 'rgb(14, 21, 30)', JSON.stringify(accueil));
  await p.context().close();

  console.log('— Stockage indisponible : thème clair, aucune erreur');
  p = await loginPage(b, 'agent1', BUREAU);
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.context().addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('stockage refusé'); } }));
  await p.goto(`${WEB}/dashboard`);
  await p.locator('main').waitFor();
  check('stockage refusé : clair, page affichée sans erreur', (await theme(p)) === 'clair' && erreurs.length === 0, erreurs.join(' | '));
  await p.context().close();

  for (const [nom, vue, comptes] of [
    ['bureau', BUREAU, [
      ['agent1', ['/dashboard', '/tasks', '/tasks?vue=kanban', '/plan-travail', '/leaves', '/documents', '/communication', '/reunions', '/logistique', '/annuaire', '/suggestions', '/compte', '/recherche?q=note', '/aide', '/personnel', '/documents-generes']],
      ['dn', ['/courrier', '/instructions', '/rh?onglet=effectifs', '/organisation', '/journal-audit']],
      ['admin', ['/users', '/parametrage', '/parametrage?onglet=supervision', '/parametrage?onglet=indicateurs', '/modelisation']],
    ]],
    ['téléphone', TELEPHONE, [['agent1', ['/dashboard', '/tasks', '/leaves', '/communication']]]],
  ]) {
    console.log(`— Tour des pages en sombre (${nom})`);
    const fautes = [];
    let n = 0;
    for (const [compte, urls] of comptes) {
      p = await loginPage(b, compte, vue);
      await p.context().addInitScript(() => window.localStorage.setItem('dnpec.theme', 'sombre'));
      for (const url of urls) {
        await p.goto(WEB + url);
        await p.waitForLoadState('networkidle').catch(() => {});
        await p.waitForTimeout(500);
        const f = await fondsBlancs(p);
        if (f.length) fautes.push(`${compte} ${url} : ${f.join(', ')}`);
        await p.screenshot({ path: `${E.SHOTS}/theme_sombre_${nom === 'bureau' ? 'b' : 't'}_${compte}${url.replace(/\W+/g, '_')}.png`, fullPage: false });
        n++;
      }
      if (compte === 'agent1' && nom === 'bureau') {
        // Fenêtre de formulaire, liste déroulante, calendrier, menu « Créer », squelette.
        await p.goto(`${WEB}/tasks?nouvelle=1`);
        const d = p.getByRole('dialog', { name: 'Nouvelle tâche' });
        await d.waitFor();
        await d.getByLabel('Échéance', { exact: true }).click();
        await p.waitForTimeout(300);
        let f = await fondsBlancs(p);
        if (f.length) fautes.push(`fenêtre « Nouvelle tâche » et calendrier : ${f.join(', ')}`);
        await p.screenshot({ path: `${E.SHOTS}/theme_sombre_fenetre_calendrier.png` });
        await p.keyboard.press('Escape');
        await p.goto(`${WEB}/dashboard`);
        await p.getByRole('button', { name: 'Créer' }).click();
        f = await fondsBlancs(p);
        if (f.length) fautes.push(`menu « Créer » : ${f.join(', ')}`);
        await p.screenshot({ path: `${E.SHOTS}/theme_sombre_menu_creer.png` });
        await p.route('**/tasks?**', async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
        await p.goto(`${WEB}/tasks`);
        await p.getByTestId('squelette').first().waitFor({ timeout: 5000 }).catch(() => {});
        f = await fondsBlancs(p);
        if (f.length) fautes.push(`squelettes : ${f.join(', ')}`);
        await p.screenshot({ path: `${E.SHOTS}/theme_sombre_squelette.png` });
        await p.unroute('**/tasks?**');
      }
      await p.context().close();
    }
    check(`${nom} : ${n} pages en sombre, aucun fond blanc oublié (fenêtres, calendrier, menus, squelettes compris)`, fautes.length === 0, fautes.slice(0, 6).join(' | '));
  }
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
