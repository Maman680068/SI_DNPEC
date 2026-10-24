// Domaine B, lot B1, sous Chromium (maquettes mod-1 à mod-4) : menu Modélisation (rôle ou administrateur),
// liste des modèles, dépôt en 4 étapes dans une fenêtre centrée (case « données publiées », réveil du
// service de calcul, contrôles, manettes, envoi), fiche et approbation, dérogation à deux (demande du
// responsable, confirmation de l'administrateur), rôles de modélisation depuis Utilisateurs → « ⋯ »,
// supervision ; téléphone 390 px ; audit axe (aucune violation grave ou critique).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { AxeBuilder } = require('@axe-core/playwright');
const { browser, loginPage, check, bilan, WEB, ouvrirPlus, entreesMenu, cliquerMenu } = require('./helpers');
const { call, ids, login } = require('../lib');
const E = require('../config');

const BUREAU = { width: 1440, height: 900 };
const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5).toUpperCase();
const GRAVES = ['serious', 'critical'];
const RELAIS = 'http://localhost:3301';
const DOSSIER = E.tmp('b1_ui');
fs.mkdirSync(DOSSIER, { recursive: true });
const PY = process.env.CALCUL_PYTHON || 'python3';
let n = 0;
function paquet(fiche) {
  const sortie = path.join(DOSSIER, `TEST_UI_${S}_${++n}.zip`);
  execFileSync(PY, [path.join(E.RACINE, 'apps/calcul/exemples/construire_paquet.py'), path.join(E.RACINE, 'apps/calcul/exemples/paquet_factice'), sortie, '--fiche', JSON.stringify(fiche)]);
  return sortie;
}
async function axe(p, quoi) {
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const g = r.violations.filter((v) => GRAVES.includes(v.impact));
  check(`axe (${quoi}) : aucune violation grave ou critique`, g.length === 0, g.map((v) => `${v.id} : ${v.nodes[0]?.target?.join(' ')}`).join(' ; '));
}
const sansDebord = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
/** Le texte apparaît dans la zone (fiche rechargée après l'action). */
const apparait = (zone, texte) => zone.getByText(texte).first().waitFor({ timeout: 15000 }).then(() => true, () => false);

(async () => {
  const b = await browser();
  const motif = 'Décision du chef de la DPE (note du 6 octobre 2026)';

  console.log('— Menu : rôle de modélisation ou administrateur');
  let p = await loginPage(b, 'agentdee', BUREAU);
  await p.waitForTimeout(800);
  check('agent sans rôle : ni groupe « Modélisation » ni entrée « Modèles » dans le menu', (await p.locator('[data-testid=onglet-groupe]', { hasText: 'Modélisation' }).count()) === 0 && !(await entreesMenu(p)).some((e) => e.href === '/modelisation'));
  await p.goto(`${WEB}/modelisation`);
  check('agent sans rôle : page refusée avec un message en français', await p.getByText(/réservée aux personnes qui ont un rôle de modélisation/).waitFor({ timeout: 10000 }).then(() => true, () => false));
  await p.context().close();

  p = await loginPage(b, 'admin', BUREAU);
  await cliquerMenu(p, '/modelisation');
  await p.getByRole('heading', { name: 'Modèles' }).waitFor();
  check('administrateur : « Modèles » dans le groupe Modélisation, « Déposer un modèle »', await p.getByRole('button', { name: /Déposer un modèle/ }).waitFor().then(() => true, () => false));
  check('les 4 étapes d’intégration sont présentées', (await p.getByRole('list', { name: 'Intégrer un modèle en quatre étapes' }).getByRole('listitem').count()) === 4);

  console.log('— Dépôt en 4 étapes (fenêtre centrée)');
  await p.getByRole('button', { name: /Déposer un modèle/ }).click();
  const fen = p.getByTestId('fenetre-depot');
  await fen.waitFor();
  check('fenêtre centrée : « Déposer un modèle », 4 étapes', (await fen.getByRole('list', { name: 'Étapes du dépôt' }).getByRole('listitem').count()) === 4);
  const zip = paquet({ code: `TEST_UI_${S}`, nom: `TEST — Modèle UI ${S}` });
  await fen.locator('#paquet').setInputFiles(zip);
  await fen.getByRole('button', { name: /Déposer et vérifier/ }).click();
  check('sans la case « données publiées ou autorisées » : rien n’est envoyé', /Cochez la confirmation/.test(await fen.getByTestId('erreur-formulaire').innerText()));
  await fen.getByLabel(/Je confirme que les données de ce paquet sont publiées ou autorisées/).check();
  await fetch(RELAIS + '/__relais/mode', { method: 'POST', body: JSON.stringify({ mode: 'endormi', delaiMs: 3000 }) });
  await fen.getByRole('button', { name: /Déposer et vérifier/ }).click();
  await fen.getByTestId('verification-en-cours').waitFor({ timeout: 15000 });
  check('service endormi : « Réveil du service de calcul… » sans erreur', /Réveil du service de calcul…/.test(await fen.getByTestId('verification-en-cours').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/b1_reveil.png` });
  await fen.getByTestId('controles').waitFor({ timeout: 60000 });
  const etats = await fen.getByTestId('controle').evaluateAll((l) => l.map((x) => x.getAttribute('data-etat')));
  check('contrôles affichés : 3 réussis, 1 alerte', etats.filter((x) => x === 'ok').length === 3 && etats.filter((x) => x === 'alerte').length === 1, etats.join(','));
  check('« Lu dans le paquet » : famille, manettes, compteurs', /Démonstration/.test(await fen.getByLabel('Lu dans le paquet').innerText()));
  check('titre : nom du modèle et numéro de version', (await fen.getByRole('heading', { level: 2 }).innerText()) === `TEST — Modèle UI ${S} — version 1`);
  await p.screenshot({ path: `${E.SHOTS}/b1_verification.png` });
  await axe(p, 'dépôt, vérification');
  await fen.getByRole('button', { name: /Continuer/ }).click();
  await fen.getByTestId('tableau-manettes').waitFor();
  check('manettes pré-remplies depuis la fiche (4)', (await fen.getByTestId('manette').count()) === 4);
  await fen.getByLabel('Proposer « Croissance démographique (dynamique) » aux analystes').uncheck();
  const max = fen.getByLabel(/Maximum de « Prix mondial du pétrole »/);
  await max.fill('60');
  await fen.getByRole('button', { name: 'Consommation finale' }).click();
  check('compteur décoché (bouton à bascule), les autres gardés', (await fen.getByRole('button', { name: 'Consommation finale' }).getAttribute('aria-pressed')) === 'false' && (await fen.getByRole('button', { name: 'Importations et exportations' }).getAttribute('aria-pressed')) === 'true');
  await p.screenshot({ path: `${E.SHOTS}/b1_manettes.png` });
  await axe(p, 'dépôt, manettes');
  await max.fill('500');
  await fen.getByRole('button', { name: /Envoyer au responsable/ }).click();
  await fen.getByTestId('erreur-formulaire').waitFor();
  check('borne au-delà de celle du paquet : refus en français, dans la fenêtre', /celles du paquet/.test(await fen.getByTestId('erreur-formulaire').innerText()));
  await max.fill('60');
  await fen.getByRole('button', { name: /Envoyer au responsable/ }).click();
  await fen.getByTestId('envoi-termine').waitFor();
  check('étape 4 : responsable pas encore désigné, il sera prévenu', /n’est pas encore désigné/.test(await fen.getByTestId('envoi-termine').innerText()));
  await fen.getByRole('button', { name: /Voir la fiche du modèle/ }).click();
  await p.waitForURL('**/modelisation/*');
  const lienFiche = p.url();
  const modeleId = lienFiche.split('/').pop();
  await p.getByTestId('versions').waitFor();
  check('fiche : version 1 « en attente d’approbation », pour l’administrateur sans bouton d’approbation', /en attente de l’approbation du responsable/.test(await p.getByTestId('bandeau-approbation').innerText()) && (await p.getByRole('button', { name: /Approuver et activer/ }).count()) === 0);
  check('fiche : manettes actives (3) et compteurs (3) réglés', /3 actives/.test(await p.getByTestId('utilisation').innerText()));

  console.log('— Désignation du responsable et du suppléant (fiche)');
  await p.getByRole('button', { name: 'Désigner le responsable du modèle' }).click();
  const des = p.getByTestId('fenetre-designation');
  await des.getByRole('button', { name: 'Désigner' }).click();
  check('désignation sans personne ni motif : messages sous les champs', (await des.getByTestId('erreur-champ').count()) >= 2);
  await des.getByLabel('Responsable du modèle').fill('CHEFSSR');
  await p.getByRole('option', { name: /CHEFSSR Test/ }).click();
  await des.getByLabel(/Motif/).fill(motif);
  await p.screenshot({ path: `${E.SHOTS}/b1_designation.png` });
  await axe(p, 'désignation');
  await des.getByRole('button', { name: 'Désigner' }).click();
  await p.getByTestId('toast').waitFor();
  check('responsable désigné (toast), affiché dans la gouvernance', await apparait(p.getByTestId('gouvernance'), 'CHEFSSR Test'));
  await p.getByRole('button', { name: 'Désigner le suppléant du responsable' }).click();
  await p.getByTestId('fenetre-designation').getByLabel('Suppléant du responsable').fill('CHEFSFP');
  await p.getByRole('option', { name: /CHEFSFP Test/ }).click();
  await p.getByTestId('fenetre-designation').getByLabel(/Motif/).fill(motif);
  await p.getByTestId('fenetre-designation').getByRole('button', { name: 'Désigner' }).click();
  await p.getByTestId('fenetre-designation').waitFor({ state: 'detached' });
  check('suppléant désigné', await apparait(p.getByTestId('gouvernance'), 'CHEFSFP Test'));

  console.log('— Rôles de modélisation depuis Utilisateurs → « ⋯ »');
  await p.goto(`${WEB}/users`);
  const ligne = p.locator('tr', { hasText: 'chefdpe@test.local' });
  await ligne.waitFor();
  await ligne.getByRole('button', { name: 'Plus d’actions' }).click();
  await p.getByRole('menuitem', { name: 'Rôles de modélisation' }).click();
  const roles = p.getByTestId('fenetre-roles-modelisation');
  await roles.waitFor();
  await roles.getByRole('radio', { name: 'Analyste' }).click();
  await roles.getByRole('button', { name: 'Attribuer le rôle' }).click();
  check('motif obligatoire', (await roles.getByTestId('erreur-champ').count()) >= 1);
  await roles.getByLabel(/Motif/).fill(motif);
  await roles.getByRole('button', { name: 'Attribuer le rôle' }).click();
  await roles.getByTestId('roles-en-cours').waitFor();
  check('analyste attribué : affiché dans « Rôles en cours »', /Analyste/.test(await roles.getByTestId('roles-en-cours').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/b1_roles_modelisation.png` });
  await axe(p, 'rôles de modélisation');
  await roles.getByRole('button', { name: 'Fermer' }).first().click();

  console.log('— Supervision : service de calcul et paquets');
  await p.goto(`${WEB}/parametrage?onglet=supervision`);
  const calcul = p.locator('[data-testid="service"][data-cle="calcul"], [data-testid="service"]', { hasText: 'Service de calcul' }).first();
  await calcul.waitFor({ timeout: 15000 });
  check('supervision : « Service de calcul (modèles) » éveillé, dernier appel, durée moyenne', /Éveillé — dernier appel/.test(await calcul.innerText()) && /durée moyenne/.test(await calcul.innerText()));
  check('supervision : « Paquets de modèles » (espace occupé)', /Mo occupés par \d+ paquet/.test(await p.locator('[data-testid="service"]', { hasText: 'Paquets de modèles' }).first().innerText()));
  await p.context().close();

  console.log('— Responsable : approbation');
  p = await loginPage(b, 'chefssr', BUREAU);
  await p.waitForTimeout(800);
  const entree = p.locator('[data-testid=onglet-groupe]', { hasText: 'Modélisation' });
  check('responsable : groupe « Modélisation » dans le menu, avec pastille', (await entree.count()) === 1 && /1/.test(await entree.innerText()));
  await entree.click();
  check('responsable : sous-onglet « Modèles » avec sa pastille', /^Modèles\s*1$/.test((await p.locator('[data-testid=sous-onglets] a[href="/modelisation"]').innerText()).trim()));
  await p.goto(lienFiche);
  const bandeau = p.getByTestId('bandeau-approbation');
  await bandeau.waitFor();
  check('bandeau « Version 1 en attente de votre approbation »', /en attente de votre approbation/.test(await bandeau.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/b1_fiche_responsable.png`, fullPage: true });
  await axe(p, 'fiche, approbation');
  await bandeau.getByRole('button', { name: /Approuver et activer/ }).click();
  await p.getByTestId('toast').waitFor();
  check('version 1 approuvée et activée', (await apparait(p.getByTestId('versions'), 'Active')) && (await p.getByTestId('bandeau-approbation').count()) === 0);
  await p.context().close();

  console.log('— Dérogation à deux (version 2, contrôle bloquant en échec)');
  const fd = new FormData();
  fd.append('donneesConfirmees', 'true');
  fd.append('paquet', new Blob([fs.readFileSync(paquet({ code: `TEST_UI_${S}`, nom: `TEST — Modèle UI ${S}`, essai: { controle_en_echec: 'equilibre' } }))], { type: 'application/zip' }), 'v2.zip');
  const d2 = await (await fetch(`http://localhost:3000/api/v1/modeles/versions`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('admin')) }, body: fd })).json();
  for (let i = 0; i < 100 && (await call('admin', 'GET', `/api/v1/modeles/versions/${d2.id}`)).body.statut === 'DEPOSEE'; i++) await attendre(300);
  await call('admin', 'POST', `/api/v1/modeles/versions/${d2.id}/envoi`);
  p = await loginPage(b, 'chefssr', BUREAU);
  await p.goto(lienFiche);
  await p.getByTestId('bandeau-approbation').waitFor();
  check('approbation impossible tant que le contrôle bloquant n’a pas de dérogation confirmée', (await p.getByRole('button', { name: /Approuver et activer/ }).isDisabled()) && /sans dérogation confirmée/.test(await p.getByTestId('bandeau-approbation').innerText()));
  await p.getByRole('button', { name: 'Demander une dérogation…' }).click();
  const der = p.getByTestId('fenetre-derogation');
  await der.getByRole('button', { name: 'Demander la dérogation' }).click();
  check('dérogation : motif écrit obligatoire', (await der.getByTestId('erreur-champ').count()) === 1);
  await der.getByLabel(/Motif écrit/).fill('Écart de 0,42 % expliqué par l’arrondi de la MCS publiée');
  await p.screenshot({ path: `${E.SHOTS}/b1_derogation.png` });
  await axe(p, 'demande de dérogation');
  await der.getByRole('button', { name: 'Demander la dérogation' }).click();
  await p.getByTestId('derogation').waitFor();
  check('dérogation demandée : en attente de la confirmation de l’administrateur', /En attente de la confirmation/.test(await p.getByTestId('derogation').innerText()));
  await p.context().close();
  p = await loginPage(b, 'admin', BUREAU);
  await p.goto(lienFiche);
  await p.getByRole('button', { name: 'Confirmer la dérogation…' }).click();
  const conf = p.getByTestId('fenetre-confirmation-derogation');
  check('administrateur : il voit le contrôle et l’écart', /Équilibre emplois-ressources/.test(await conf.innerText()) && /écart 0\.42 %/.test(await conf.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/b1_confirmation_derogation.png` });
  await axe(p, 'confirmation de dérogation');
  await conf.getByRole('button', { name: 'Confirmer la dérogation' }).click();
  await p.getByTestId('toast').waitFor();
  check('dérogation confirmée', await apparait(p.getByTestId('derogation'), /Confirmée par ADMIN Test/));
  await p.context().close();
  p = await loginPage(b, 'chefsfp', BUREAU);
  await p.goto(lienFiche);
  await p.getByRole('button', { name: /Approuver et activer/ }).click();
  await p.getByTestId('toast').waitFor();
  check('suppléant : version 2 « Active (avec dérogation) », version 1 archivée', (await apparait(p.getByTestId('versions'), 'Active (avec dérogation)')) && /Archivée/.test(await p.getByTestId('versions').innerText()));
  await p.context().close();

  console.log('— Téléphone (390 px)');
  p = await loginPage(b, 'admin', TELEPHONE);
  await p.goto(`${WEB}/modelisation`);
  await p.getByTestId('liste-modeles').waitFor();
  check('liste : pas de défilement horizontal', await sansDebord(p));
  await p.screenshot({ path: `${E.SHOTS}/b1_liste_telephone.png`, fullPage: true });
  await p.goto(lienFiche);
  await p.getByTestId('versions').waitFor();
  check('fiche : pas de défilement horizontal', await sansDebord(p));
  await axe(p, 'fiche, téléphone');
  await p.goto(`${WEB}/modelisation`);
  await p.getByRole('button', { name: /Déposer un modèle/ }).click();
  await p.getByTestId('fenetre-depot').waitFor();
  check('dépôt : fenêtre sans défilement horizontal', await sansDebord(p));
  await p.context().close();

  console.log('— Liste (bureau)');
  p = await loginPage(b, 'admin', BUREAU);
  await p.goto(`${WEB}/modelisation`);
  const ligneModele = p.getByTestId('ligne-modele').filter({ hasText: `TEST — Modèle UI ${S}` });
  await ligneModele.waitFor();
  check('liste : version active 2 (dérogation), responsable, « Démonstration »', /v2 \(dérogation\)/.test(await ligneModele.innerText()) && /CHEFSSR Test/.test(await ligneModele.innerText()) && /Démonstration/.test(await ligneModele.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/b1_liste.png` });
  await axe(p, 'liste des modèles');
  void modeleId;
  void ids;
  void ouvrirPlus;
  await p.context().close();

  await b.close();
  bilan();
})().catch(async (e) => {
  console.error(e);
  await fetch(RELAIS + '/__relais/mode', { method: 'POST', body: JSON.stringify({ mode: 'normal' }) }).catch(() => null);
  process.exit(1);
});
