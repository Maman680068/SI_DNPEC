// C2 — page /courrier (refonte de l'interface, étape 5) : lien de navigation, en-tête, bande de compteurs du
// registre, onglets à compteur, rubriques de « À faire », tableaux de registre, filtres compacts, mobile.
const { browser, loginPage, check, bilan, WEB, entreesMenu, cliquerMenu } = require('./helpers');
const { call, ids } = require('../lib');
(async () => {
  const b = await browser();
  const admin = await loginPage(b, 'admin');
  check('témoin : le lien « Tableau de bord » est trouvé', (await admin.getByRole('link', { name: /^\S*\s*Tableau de bord$/ }).count()) === 1);
  // Menu en haut : « Courrier » dans le groupe Échanges, « Courrier (administration) » dans le groupe Administration.
  const entrees = await entreesMenu(admin);
  check('ADMIN_SYSTEME : lien « Courrier » (son courrier personnel) et Administration → Courrier', entrees.filter((e) => e.href === '/courrier' && e.groupe === 'Échanges').length === 1 && entrees.filter((e) => e.href === '/courrier/administration' && e.groupe === 'Administration').length === 1, JSON.stringify(entrees.filter((e) => e.href.startsWith('/courrier'))));
  await admin.goto(WEB + '/courrier/administration');
  await admin.locator('[data-testid=registre]').first().waitFor();
  const allumes = await admin.locator('[data-testid=menu-haut] a[aria-current=page]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const groupe = await admin.locator('[data-testid=onglet-groupe][aria-current=true]').innerText();
  check('menu en haut : seule l’entrée Administration → Courrier est active, groupe Administration souligné', allumes.join() === '/courrier/administration' && /^Administration/.test(groupe), `${allumes.join()} / ${groupe}`);
  await admin.locator('[data-testid=onglet-groupe]', { hasText: 'Échanges' }).click();
  await admin.locator('[data-testid=sous-onglets] a[href="/courrier"]').click();
  await admin.getByRole('heading', { name: 'Mon courrier' }).waitFor();
  // Onglets : libellé suivi de son compteur éventuel (« Mes actes 2 »).
  const onglets = (await admin.getByRole('tab').allInnerTexts()).map((t) => t.replace(/\s*\d+$/, '').trim());
  check('administrateur : page « Mon courrier », onglets personnels', onglets.join('|') === 'À faire|Mes plis personnels|Mes actes', onglets.join('|'));
  check('administrateur : pas de bande de compteurs du registre', (await admin.locator('[data-testid^=carte-]').count()) === 0);
  await admin.getByRole('tab', { name: 'Mes plis personnels' }).click();
  await admin.waitForTimeout(1200);
  const apiArr = (await call('admin', 'GET', '/courrier/arrivees')).body;
  const lignes = await admin.locator('[data-testid=ligne-arrivee]').count();
  check('« Mes plis personnels » : exactement ses plis (API), aucun autre', lignes === apiArr.length && apiArr.every((a) => a.destinataireId === ids.admin), `${lignes} ligne(s)`);
  check('administrateur : pas de bouton « Enregistrer un courrier »', (await admin.getByRole('button', { name: 'Enregistrer un courrier' }).count()) === 0);
  await admin.getByRole('tab', { name: 'Mes actes' }).click();
  await admin.waitForTimeout(1200);
  const apiAct = (await call('admin', 'GET', '/courrier/actes')).body;
  check('« Mes actes » : exactement ses actes (API)', (await admin.locator('[data-testid=ligne-acte]').count()) === apiAct.length && apiAct.every((a) => a.redacteurId === ids.admin || a.beneficiaireId === ids.admin));

  const p = await loginPage(b, 'dn');
  await cliquerMenu(p, '/courrier');
  await p.getByRole('heading', { name: 'Courrier et actes' }).waitFor();
  await p.locator('[data-rubrique]').first().waitFor();
  check('en-tête : « Exporter » présent ; DN sans habilitation : pas de « Enregistrer un courrier »', (await p.getByRole('button', { name: 'Exporter', exact: true }).count()) === 1 && (await p.getByRole('button', { name: 'Enregistrer un courrier' }).count()) === 0);
  const tbDn = (await call('dn', 'GET', '/courrier/tableau-de-bord')).body;
  const cartes = await p.locator('[data-testid^=carte-]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') + '=' + e.querySelector('span').innerText));
  const cartesApi = ['arriveesEnAttente', 'visasEnCours', 'actesASigner', 'actesAExpedier'].map((k) => `carte-${k}=${tbDn[k]}`);
  check('bande de compteurs : À imputer, Visas en cours, À signer, À expédier = API', cartes.join() === cartesApi.join(), cartes.join());
  const ongletAFaire = await p.getByRole('tab', { name: /^À faire/ }).innerText();
  const totalAFaire = ['aImputer', 'aTraiter', 'aViser', 'aSigner', 'aExpedier', 'priseDeConnaissance', 'brouillons'].reduce((s, k) => s + tbDn[k], 0);
  check('onglet « À faire » : compteur = éléments en attente (API)', ongletAFaire.replace(/\s+/g, ' ').trim() === `À faire ${totalAFaire}`, ongletAFaire);
  const pastilles = await p.getByTestId('rubriques').getByRole('button', { name: /à imputer|à signer|à traiter/ }).allInnerTexts();
  check('DN : compteurs non nuls affichés', pastilles.length > 0, pastilles.join(' · '));
  await p.getByTestId('rubriques').getByRole('button', { name: /à imputer/ }).first().click();
  await p.waitForURL('**/courrier?rubrique=aImputer');
  const sections = await p.locator('[data-rubrique]').evaluateAll((els) => els.map((e) => e.getAttribute('data-rubrique')));
  check('compteur cliqué : seule la rubrique « à imputer »', sections.join() === 'aImputer', sections.join());
  const n = await p.locator('[data-rubrique=aImputer] [data-testid=ligne-arrivee]').count();
  const libelle = await p.getByTestId('rubriques').getByRole('button', { name: /à imputer/ }).first().innerText();
  check('rubrique : autant de lignes que le compteur', String(n) === libelle.split(' ')[0], `${n} lignes, compteur « ${libelle} »`);

  await p.getByRole('tab', { name: /^Arrivées/ }).click();
  await p.waitForURL('**/courrier?onglet=arrivees');
  await p.locator('[data-testid=ligne-arrivee]').first().waitFor();
  const total = await p.locator('[data-testid=ligne-arrivee]').count();
  const nArr = (await call('dn', 'GET', '/courrier/arrivees')).body.length;
  check('onglet « Arrivées » : compteur = liste de l’API', (await p.getByRole('tab', { name: /^Arrivées/ }).innerText()).replace(/\s+/g, ' ').trim() === `Arrivées ${nArr}` && total === nArr, `${total} / ${nArr}`);
  check('pied du registre : « N courriers affichés » et « Numérotation continue, sans trou »', (await p.getByTestId('registre-arrivees').innerText()).includes(`${total} courrier`) && (await p.getByText('Numérotation continue, sans trou').count()) === 1);
  check('n° d’ordre en Montserrat 700, chiffres tabulaires', await p.locator('[data-testid=ligne-arrivee] .font-heading').first().evaluate((e) => getComputedStyle(e).fontWeight === '700' && getComputedStyle(e).fontVariantNumeric.includes('tabular-nums')));
  await p.getByLabel('Rechercher').fill('C2 unité');
  await p.getByLabel('Rechercher').press('Enter');
  await p.waitForTimeout(800);
  const filtre = await p.locator('[data-testid=ligne-arrivee]').count();
  check('recherche : la liste se restreint', filtre > 0 && filtre < total, `${total} → ${filtre}`);
  await p.getByLabel('Rechercher').fill('');
  await p.waitForTimeout(900);
  // « Imputé à » : filtre de la liste affichée sur une personne imputée.
  const choix = (await p.getByLabel('Imputé à').locator('option').allInnerTexts()).slice(1);
  if (choix.length > 0) {
    await p.getByLabel('Imputé à').selectOption({ label: choix[0] });
    await p.waitForTimeout(300);
    const nImp = await p.locator('[data-testid=ligne-arrivee]').count();
    const apiImp = (await call('dn', 'GET', '/courrier/arrivees')).body.filter((x) => x.imputations.some((i) => !i.parentId && `${x.personnes[i.imputeAId].firstName} ${x.personnes[i.imputeAId].lastName}` === choix[0])).length;
    check('« Imputé à » : exactement ses courriers (imputations de premier niveau)', nImp > 0 && nImp === apiImp, `${choix[0]} : ${nImp} / ${apiImp}`);
    await p.getByLabel('Imputé à').selectOption('');
  }
  await p.getByLabel('Période').selectOption(String(new Date().getFullYear() - 3));
  await p.waitForTimeout(800);
  check('année sans courrier : message vide', await p.getByText('Aucun courrier arrivée pour ces critères.').isVisible());
  await p.getByLabel('Période').selectOption('');
  // Compteur « Visas en cours » : registre des départs et actes filtré sur « En visa ».
  await p.getByTestId('carte-visasEnCours').click();
  await p.waitForURL('**/courrier?onglet=actes');
  await p.waitForTimeout(1000);
  const statuts = await p.locator('[data-testid=ligne-acte]').allInnerTexts();
  check('compteur « Visas en cours » : actes en visa seulement, autant que le compteur', statuts.length === tbDn.visasEnCours && statuts.every((t) => t.includes('En visa')) && (await p.getByLabel('Statut').inputValue()) === 'EN_VISA', `${statuts.length} / ${tbDn.visasEnCours}`);
  await p.getByTestId('carte-visasEnCours').click();
  await p.waitForTimeout(800);
  await p.getByRole('tab', { name: /^Départs et actes/ }).click();
  await p.locator('[data-testid=ligne-acte]').first().waitFor();
  check('onglet Départs et actes : actes listés', (await p.locator('[data-testid=ligne-acte]').count()) > 0);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exporter', exact: true }).click()]);
  check('export Excel téléchargé', /departs_actes_.*\.xlsx/.test(dl.suggestedFilename()), dl.suggestedFilename());

  const m = await loginPage(b, 'secdpe', { width: 390, height: 844 });
  await m.goto(WEB + '/courrier?onglet=arrivees');
  await m.locator('[data-testid=ligne-arrivee]').first().waitFor();
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  check('mobile 390 px : pas de défilement horizontal', sw <= 390, `scrollWidth ${sw}`);
  check('mobile : bouton « Enregistrer un courrier » (secrétariat habilité)', (await m.getByRole('button', { name: 'Enregistrer un courrier' }).first().isVisible()));
  await m.screenshot({ path: `${require('../config').SHOTS}/c2_page_arrivees_mobile.png`, fullPage: true });
  const d = await loginPage(b, 'secdpe');
  await d.goto(WEB + '/courrier?onglet=arrivees');
  await d.locator('[data-testid=ligne-arrivee]').first().waitFor();
  await d.screenshot({ path: `${require('../config').SHOTS}/c2_page_arrivees_desktop.png`, fullPage: true });
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
