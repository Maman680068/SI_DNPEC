// Correctif d'affichage — mise en page commune : le menu (en haut sur écran large, tiroir sur téléphone) reste
// en place ; seule la zone de contenu défile ; la fenêtre ne défile jamais au-delà du contenu.
// Cause corrigée : un élément en position absolue (texte « sr-only » des lecteurs d'écran…) sans ancêtre
// positionné échappait à overflow-hidden et allongeait la page (Paramétrage → Supervision après le lot B1).
// Chaque page du menu administrateur et du lot B1 (Modélisation), bureau 1440 px et téléphone 390 px :
//   1. contenu défilé jusqu'en bas : la fenêtre ne défile pas ; bureau : le menu en haut reste collé en haut
//      de l'écran et le contenu descend jusqu'en bas ; téléphone : la barre du haut reste en haut ;
//   2. même chose avec un élément absolu ajouté tout en bas du contenu (garantie de la mise en page,
//      indépendante des données de la page) ;
//   3. téléphone : le menu ouvert occupe toute la hauteur ;
//   4. bureau étroit (1024 px) : les onglets qui dépassent défilent dans leur rangée, jamais la page.
const { browser, loginPage, check, bilan, entreesMenu, WEB } = require('./helpers');
const fs = require('fs');
const path = require('path');
const { call, upload } = require('../lib');
const E = require('../config');

const VUES = [['bureau', { width: 1440, height: 900 }], ['téléphone', { width: 390, height: 844 }]];

/** Fait défiler le contenu puis la fenêtre au maximum, et mesure. */
const mesurer = (p, injecter) => p.evaluate((injecter) => {
  const main = document.querySelector('main');
  if (injecter && main && !document.getElementById('sonde-absolue')) {
    const s = document.createElement('span');
    s.id = 'sonde-absolue'; s.className = 'sr-only'; s.textContent = 'sonde';
    (main.lastElementChild ?? main).appendChild(s);
  }
  if (main) main.scrollTop = main.scrollHeight;
  window.scrollTo(0, document.scrollingElement.scrollHeight);
  // Bureau : menu en haut, collé en haut ; téléphone : barre du haut. Le contenu va jusqu'en bas de l'écran.
  const menu = (document.querySelector('[data-testid=menu-haut]') ?? document.querySelector('header')).getBoundingClientRect();
  const r = {
    depasse: document.scrollingElement.scrollHeight - window.innerHeight,
    fenetre: Math.round(window.scrollY),
    menu: [Math.round(menu.top), Math.round(main.getBoundingClientRect().bottom)],
    hauteur: window.innerHeight,
  };
  document.getElementById('sonde-absolue')?.remove();
  if (main) main.scrollTop = 0;
  window.scrollTo(0, 0);
  return r;
}, injecter);

(async () => {
  // Une fiche de modèle à vérifier : celle des suites B1, sinon le paquet de démonstration livré, déposé ici.
  let modele = (await call('admin', 'GET', '/api/v1/modeles')).body?.modeles?.[0];
  if (!modele) {
    const zip = fs.readFileSync(path.join(E.RACINE, 'apps/api/assets/paquet-demonstration.zip'));
    await upload('admin', '/api/v1/modeles/versions', { donneesConfirmees: 'true' }, [{ field: 'paquet', name: 'paquet.zip', content: zip }]);
    modele = (await call('admin', 'GET', '/api/v1/modeles')).body?.modeles?.[0];
  }
  const b = await browser();
  let pages = null;
  for (const [nom, vue] of VUES) {
    console.log(`— ${nom} (${vue.width} px)`);
    const p = await loginPage(b, 'admin', vue);
    if (!pages) {
      pages = [...new Set((await entreesMenu(p)).map((e) => e.href))];
      for (const u of ['/modelisation', modele && `/modelisation/${modele.id}`, '/parametrage?onglet=supervision']) if (u && !pages.includes(u)) pages.push(u);
      check(`pages du menu administrateur et du lot B1 trouvées (${pages.length})`, pages.length >= 20 && pages.includes('/users') && pages.includes('/modelisation') && pages.some((u) => u.startsWith('/modelisation/')), pages.join(' '));
    }
    const fautes = [];
    for (const url of pages) {
      await p.goto(WEB + url);
      await p.waitForLoadState('networkidle').catch(() => {});
      await p.locator('main').waitFor();
      await p.waitForTimeout(300);
      for (const injecter of [false, true]) {
        const m = await mesurer(p, injecter);
        const bon = m.depasse <= 1 && m.fenetre === 0 && m.menu[0] === 0 && m.menu[1] === m.hauteur;
        if (!bon) fautes.push(`${url}${injecter ? ' (élément absolu en bas)' : ''} ${JSON.stringify(m)}`);
      }
    }
    check(`${nom} : sur chaque page, la fenêtre ne défile jamais au-delà du contenu, le menu reste en haut et le contenu va jusqu'en bas (${pages.length} pages, avec et sans élément absolu en bas)`, fautes.length === 0, fautes.slice(0, 5).join(' | '));
    if (vue.width < 768) {
      await p.goto(WEB + '/parametrage?onglet=supervision');
      await p.locator('[data-testid=service]').first().waitFor();
      await p.getByRole('button', { name: 'Ouvrir le menu' }).click();
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => { const a = document.querySelector('[data-testid=tiroir-menu]').getBoundingClientRect(); return [Math.round(a.left), Math.round(a.top), Math.round(a.bottom), innerHeight]; });
      check('téléphone : menu ouvert de haut en bas de l’écran', r[0] === 0 && r[1] === 0 && r[2] === r[3], JSON.stringify(r));
    }
    if (vue.width >= 768) {
      // Bureau étroit : la rangée d'onglets la plus longue (Administration) défile dans sa rangée.
      await p.setViewportSize({ width: 1024, height: 768 });
      await p.goto(WEB + '/users');
      await p.locator('[data-testid=sous-onglets]').waitFor();
      const r = await p.evaluate(() => {
        const nav = document.querySelector('[data-testid=sous-onglets] nav');
        const actif = nav.querySelector('[aria-current=page]').getBoundingClientRect();
        return { deborde: nav.scrollWidth > nav.clientWidth, page: document.scrollingElement.scrollWidth - innerWidth, actifVisible: actif.left >= 0 && actif.right <= innerWidth };
      });
      check('bureau 1024 px : sous-onglets trop longs défilés dans leur rangée, page sans défilement horizontal, onglet actif visible', r.deborde && r.page <= 0 && r.actifVisible, JSON.stringify(r));
      await p.screenshot({ path: `${E.SHOTS}/x_menu_haut_1024.png` });
    }
    await p.context().close();
  }
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(1); });
