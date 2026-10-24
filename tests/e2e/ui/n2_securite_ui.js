// N2 — écrans de sécurité sous Chromium, bureau (1366) et téléphone (390) : réauthentification avant
// le niveau 2 du dossier du personnel (mot de passe faux puis juste), journal d'audit (portée,
// vérification d'intégrité, fenêtre de détail d'une entrée, filtre sur l'auteur), « Paramétrage et supervision »
// (rubriques, paramètre saisi puis « Enregistrer » par l'administrateur, refus hors bornes, lecture seule pour le
// DN, compteur de l'onglet Supervision, services, test de restauration déclaré), menus selon le rôle.
const { browser, loginPage, check, bilan, WEB, ouvrirPlus } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const b = await browser();

  console.log('— Réauthentification (bureau)');
  let p = await loginPage(b, 'agent1');
  await ouvrirPlus(p);
  check('menu : « Journal d’audit » (ses propres actions), pas de paramétrage', (await p.locator('a[href="/journal-audit"]').count()) === 1 && (await p.locator('a[href="/parametrage"]').count()) === 0);
  await p.goto(`${WEB}/personnel/${ids.agent1}`);
  const verrou = p.locator('[data-testid=niveau-2-verrouille]');
  await verrou.waitFor();
  check('niveau 2 verrouillé à l’ouverture, rien de sensible affiché', (await p.locator('[data-testid=niveau-2]').count()) === 0);
  await verrou.getByRole('button', { name: 'Afficher les données protégées' }).click();
  const f = p.getByRole('dialog', { name: 'Confirmez votre identité' });
  await f.getByLabel('Votre mot de passe').fill('mauvais');
  await f.getByRole('button', { name: 'Confirmer' }).click();
  await f.getByRole('alert').waitFor();
  check('mot de passe faux : message dans la fenêtre', /incorrect/i.test(await f.getByRole('alert').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n2_reauth_bureau.png` });
  await f.getByLabel('Votre mot de passe').fill('Password123!');
  await f.getByRole('button', { name: 'Confirmer' }).click();
  await p.locator('[data-testid=niveau-2]').waitFor();
  check('mot de passe juste : informations personnelles affichées', (await p.locator('[data-testid=niveau-2]').count()) === 1 && (await verrou.count()) === 0);
  await p.goto(`${WEB}/journal-audit`);
  await p.locator('[data-testid=entree-audit]').first().waitFor();
  const texte = await p.locator('main, body').first().innerText();
  check('journal : « Vos propres actions », consultation de l’élément protégé visible', /Vos propres actions/.test(texte) && /Consultation d’un élément protégé/.test(texte));
  check('… pas de vérification d’intégrité pour un agent', (await p.getByRole('button', { name: 'Vérifier l’intégrité' }).count()) === 0);
  await p.context().close();

  console.log('— Paramétrage et supervision (administrateur, bureau)');
  p = await loginPage(b, 'admin');
  await ouvrirPlus(p);
  check('menu Administration : « Paramétrage et supervision » et « Journal d’audit »', (await p.locator('a[href="/parametrage"]').count()) === 1 && (await p.locator('a[href="/journal-audit"]').count()) === 1);
  await p.goto(`${WEB}/parametrage`);
  await p.locator('[data-testid=parametre]').first().waitFor();
  // Refonte (étape 8) : rubriques à gauche avec leur nombre de paramètres, lignes de la rubrique choisie à droite,
  // champ avec unité, « Enregistrer » en haut de page.
  const rubriques = await p.getByTestId('rubrique-parametres').allInnerTexts();
  check('9 paramètres répartis en rubriques (Congés, Personnel et RH, Sécurité, Modélisation)', rubriques.reduce((n, t) => n + Number(t.match(/(\d+)\s*$/)?.[1] ?? 0), 0) === 9 && /^Congés/.test(rubriques[0]) && rubriques.some((t) => /^Sécurité/.test(t)) && rubriques.some((t) => /^Modélisation\s*2$/.test(t)), rubriques.join(' | '));
  check('« Enregistrer » inactif tant que rien n’est modifié', await p.getByTestId('enregistrer-parametres').isDisabled());
  await p.getByTestId('rubrique-parametres').filter({ hasText: 'Sécurité' }).click();
  const conservation = p.locator('[data-cle="connexions.conservationMois"]');
  await conservation.waitFor();
  check('rubrique Sécurité : 3 paramètres, bornes, état « Valeur par défaut » ou « Modifié le … »', (await p.locator('[data-testid=parametre]').count()) === 3 && /6 à 36 mois/.test(await conservation.innerText()) && /^(Valeur par défaut|Modifié le .+)/.test((await conservation.getByTestId('etat-parametre').innerText()).trim()));
  await conservation.getByLabel('Conservation des journaux de connexion').fill('40');
  await p.getByTestId('enregistrer-parametres').click();
  await conservation.getByRole('alert').waitFor();
  check('valeur hors bornes : refus du serveur affiché sous la ligne', /entre 6 et 36/.test(await conservation.getByRole('alert').innerText()));
  await conservation.getByLabel('Conservation des journaux de connexion').fill('24');
  await p.getByTestId('enregistrer-parametres').click();
  // Refonte (étape 9) : confirmation par un message (toast) avec « Annuler » (même route, valeur d'avant).
  await p.getByTestId('toast').getByText('1 paramètre enregistré').waitFor();
  check('message « 1 paramètre enregistré » avec « Annuler »', (await p.getByTestId('toast').getByRole('button', { name: 'Annuler' }).count()) === 1);
  check('valeur enregistrée : 24 mois, « Modifié le … par ADMIN Test »', (await conservation.getByTestId('champ-valeur').inputValue()) === '24' && /Modifié le .+\s*par ADMIN Test/.test(await conservation.getByTestId('etat-parametre').innerText()) && (await conservation.getByRole('alert').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n2_parametres_bureau.png`, fullPage: true });
  const ongletSupervision = await p.getByRole('tab', { name: /Supervision/ }).innerText();
  await p.getByRole('tab', { name: /Supervision/ }).click();
  await p.locator('[data-testid=service]').first().waitFor();
  check('supervision : 11 services (dont espace disque, taille de la base, quota d’emails, fonction et rôle des comptes, service de calcul, paquets de modèles), base « fonctionne normalement », emails « à traiter » (sans serveur d’envoi)', (await p.locator('[data-testid=service]').count()) === 11 && (await p.locator('[data-testid=services-normaux] [data-cle=base]').count()) === 1 && (await p.locator('[data-testid=services-a-traiter] [data-cle=email]').count()) === 1);
  const aTraiterApi = (await call('admin', 'GET', '/api/v1/supervision')).body.services.filter((x) => x.etat !== 'NOMINAL').length;
  check(`onglet « Supervision » : compteur ${aTraiterApi} (services à traiter)`, aTraiterApi === 0 ? !/\d/.test(ongletSupervision) : new RegExp(`Supervision\\s*${aTraiterApi}$`).test(ongletSupervision.trim()), ongletSupervision);
  check(`bandeau d’état : « ${aTraiterApi} point(s) » = services à traiter de l’API`, (await p.locator('[data-testid=services-a-traiter] [data-testid=service]').count()) === aTraiterApi && new RegExp(`^${aTraiterApi} points? demande`).test(await p.getByTestId('etat-global').locator('b').innerText()));
  check('onglet « Journal d’audit » présent', (await p.getByRole('tab', { name: 'Journal d’audit' }).count()) === 1);
  await p.getByRole('button', { name: 'Déclarer un test de restauration' }).click();
  const ft = p.getByRole('dialog', { name: 'Test de restauration' });
  await ft.getByLabel('Commentaire (facultatif)').fill('Restauration vérifiée sur une base de test');
  await ft.getByRole('button', { name: 'Déclarer' }).click();
  await ft.waitFor({ state: 'detached' });
  await p.waitForFunction(() => /réussi/.test(document.querySelector('[data-testid=sauvegardes]')?.textContent ?? ''));
  check('message « Test de restauration déclaré »', /Test de restauration déclaré/.test(await p.getByTestId('toast').innerText()));
  check('test de restauration déclaré : affiché « réussi »', true);
  await p.screenshot({ path: `${E.SHOTS}/n2_supervision_bureau.png`, fullPage: true });
  await p.goto(`${WEB}/journal-audit`);
  await p.getByRole('button', { name: 'Vérifier l’intégrité' }).click();
  await p.locator('[data-testid=verification-audit]').waitFor();
  check('vérification d’intégrité : chaîne intacte', /Chaîne intacte/.test(await p.locator('[data-testid=verification-audit]').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n2_journal_bureau.png` });
  // Refonte (étape 8) : fenêtre de détail d'une entrée (« Voir »), sans métadonnées brutes, et filtre sur l'auteur.
  const ligneParam = p.locator('[data-testid=entree-audit]').filter({ hasText: 'Paramètre modifié' }).first();
  await ligneParam.getByRole('button', { name: /^Voir l’entrée n° \d+$/ }).click();
  const fe = p.getByTestId('fenetre-entree-audit');
  await fe.waitFor();
  const texteFe = await fe.innerText();
  check('détail d’une entrée : libellé, objet et identifiant complet, auteur, scellement — sans ancienne ni nouvelle valeur', /Paramètre modifié — Parametre/.test(texteFe) && /connexions\.conservationMois/.test(texteFe) && /ADMIN Test/.test(texteFe) && /Scellée|En attente de scellement/.test(texteFe) && !/avant|apres/.test(texteFe), texteFe.replace(/\n/g, ' / ').slice(0, 300));
  await p.screenshot({ path: `${E.SHOTS}/n2_journal_detail_bureau.png` });
  await fe.getByRole('button', { name: 'Voir les actions de cet auteur' }).click();
  await p.getByTestId('filtre-auteur').waitFor();
  await p.waitForFunction(() => [...document.querySelectorAll('[data-testid=entree-audit]')].every((l) => /ADMIN Test/.test(l.textContent ?? '')));
  check('« Voir les actions de cet auteur » : filtre « Auteur : ADMIN Test », seules ses entrées', /Auteur : ADMIN Test/.test(await p.getByTestId('filtre-auteur').innerText()) && (await p.locator('[data-testid=entree-audit]').count()) >= 1);
  await p.getByTestId('filtre-auteur').click();
  await p.getByTestId('filtre-auteur').waitFor({ state: 'detached' });
  await p.context().close();
  await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 12 });

  console.log('— Indicateurs de succès (administrateur : cibles modifiables)');
  p = await loginPage(b, 'admin');
  await p.goto(`${WEB}/parametrage?onglet=indicateurs`);
  const tabInd = p.getByTestId('indicateurs-succes');
  await tabInd.locator('[data-testid=indicateur]').first().waitFor();
  const apiInd = (await call('admin', 'GET', '/api/v1/indicateurs-succes')).body;
  check('onglet « Indicateurs de succès » : 5 lignes (indicateur, cible, valeur, atteint, période)', (await tabInd.locator('[data-testid=indicateur]').count()) === 5 && (await p.getByRole('tab', { name: 'Indicateurs de succès' }).getAttribute('aria-selected')) === 'true');
  const ligneT = tabInd.locator('[data-testid=indicateur]', { hasText: 'Tâches terminées dans les délais' });
  const apiT = apiInd.indicateurs.find((i) => i.cle === 'tachesDansLesDelais');
  check('valeur et « Atteint » = API', (await ligneT.getByTestId('valeur').innerText()).startsWith(apiT.valeur === null ? 'Non mesurable' : `${apiT.valeur.toLocaleString('fr-FR')} %`) && (await ligneT.getByTestId('atteint').innerText()).trim() === (apiT.atteint === null ? '—' : apiT.atteint ? 'Oui' : 'Non'));
  await ligneT.getByLabel(/^Cible — Tâches terminées dans les délais/).fill('65');
  await ligneT.getByRole('button', { name: 'Enregistrer' }).click();
  await p.getByTestId('toast').getByText('Cible enregistrée').waitFor();
  check('cible enregistrée (65 %), relue par l’API', (await call('dn', 'GET', '/api/v1/indicateurs-succes')).body.indicateurs.find((i) => i.cle === 'tachesDansLesDelais').cible === 65);
  await p.screenshot({ path: `${E.SHOTS}/n2_indicateurs_bureau.png`, fullPage: true });
  await call('admin', 'PATCH', '/api/v1/parametres/indicateurs.cibleTachesPct', { valeur: 75 });
  await p.context().close();

  console.log('— DN : lecture seule');
  p = await loginPage(b, 'dn');
  await p.goto(`${WEB}/parametrage?onglet=indicateurs`);
  await p.getByTestId('indicateurs-succes').locator('[data-testid=indicateur]').first().waitFor();
  check('DN : indicateurs lisibles, aucune cible modifiable', (await p.getByTestId('indicateurs-succes').locator('[data-testid=indicateur]').count()) === 5 && (await p.getByTestId('indicateurs-succes').locator('input').count()) === 0 && (await p.getByTestId('cible').count()) === 5);
  await p.goto(`${WEB}/parametrage`);
  await p.locator('[data-testid=parametre]').first().waitFor();
  check('DN : paramètres lisibles (valeur et unité), ni champ de saisie ni « Enregistrer »', (await p.locator('[data-testid=parametre] [data-testid=valeur]').count()) >= 1 && (await p.getByTestId('champ-valeur').count()) === 0 && (await p.getByTestId('enregistrer-parametres').count()) === 0 && (await p.getByRole('button', { name: 'Enregistrer' }).count()) === 0);
  await p.context().close();

  console.log('— Téléphone (390 px)');
  p = await loginPage(b, 'admin', TELEPHONE);
  await p.goto(`${WEB}/parametrage?onglet=supervision`);
  await p.locator('[data-testid=service]').first().waitFor();
  check('lien des alertes (?onglet=supervision) : supervision ouverte, sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n2_supervision_mobile.png`, fullPage: true });
  await p.goto(`${WEB}/journal-audit`);
  await p.locator('[data-testid=entree-audit]').first().waitFor();
  check('journal d’audit sur téléphone : sans défilement horizontal de la page', await sansDefilementHorizontal(p));
  check('journal d’audit sur téléphone : filtres (dates, objet, action) repliés derrière « Filtres »', (await p.getByTestId('bouton-filtres').innerText()).trim() === 'Filtres' && !(await p.getByLabel('Action', { exact: true }).isVisible()));
  await p.screenshot({ path: `${E.SHOTS}/n2_journal_mobile.png` });
  await p.locator('[data-testid=entree-audit]').first().getByRole('button', { name: /^Voir/ }).click();
  await p.getByTestId('fenetre-entree-audit').waitFor();
  check('détail d’une entrée sur téléphone : sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.goto(`${WEB}/parametrage`);
  await p.locator('[data-testid=parametre]').first().waitFor();
  check('paramètres sur téléphone : sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n2_parametres_mobile.png`, fullPage: true });
  await p.context().close();
  p = await loginPage(b, 'drh', TELEPHONE);
  await p.goto(`${WEB}/personnel/${ids.agent1}`);
  await p.locator('[data-testid=niveau-2-verrouille]').getByRole('button', { name: 'Afficher les données protégées' }).click();
  await p.getByRole('dialog', { name: 'Confirmez votre identité' }).waitFor();
  check('fenêtre de réauthentification sur téléphone : lisible, sans défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n2_reauth_mobile.png` });
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
