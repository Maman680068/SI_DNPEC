// Refonte de l'interface (étape 8, annuaire repensé S4) — Annuaire (vue « Par unité » : blocs, chef en tête,
// sigles, fiche à droite ; vue « Liste » ; recherche sans accents ; bouton Message, aucune adresse email) et Boîte à suggestions (dépôt, fenêtre de
// décision de la Direction, lecture seule pour l'auteur, filtres), bureau 1440 et téléphone 390.
// Mêmes droits qu'avant : l'agent ne voit pas la boîte de réception, n'assigne pas de tâche.
// Finitions (étape 9) : filtres repliés derrière « Filtres (N) » sur téléphone, squelette de chargement,
// nouvelle suggestion en fenêtre de formulaire (validation dans la fenêtre), statut en un clic,
// messages de confirmation.
const { browser, loginPage, check, bilan, WEB, entreesMenu } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const BUREAU = { width: 1440, height: 900 };
const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const attendre = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 8000 }).then(() => true, () => false);

(async () => {
  const b = await browser();
  const annuaire = (await call('agent1', 'GET', '/users/directory')).body;
  const divisions = (await call('agent1', 'GET', '/org/divisions')).body;
  const dpe = divisions.find((d) => d.id === ids.DPE);
  const chefdpe = annuaire.find((x) => x.id === ids.chefdpe);

  console.log('— Menu : « Boîte à suggestions » dans « Échanges », après « Annuaire »');
  let p = await loginPage(b, 'agent1', BUREAU);
  for (const [k, vue] of [['agent1', BUREAU], ['dn', BUREAU], ['agent1', TELEPHONE]]) {
    const q = k === 'agent1' && vue === BUREAU ? p : await loginPage(b, k, vue);
    const e = await entreesMenu(q);
    const echanges = e.filter((x) => x.groupe === 'Échanges').map((x) => x.href);
    const telephone = vue === TELEPHONE;
    const ordre = telephone ? e.map((x) => x.href) : echanges;
    check(`${k} (${telephone ? 'téléphone' : 'bureau'}) : suggestions juste après l’annuaire${telephone ? '' : ' dans « Échanges »'}, une seule fois`, e.filter((x) => x.href === '/suggestions').length === 1 && ordre.indexOf('/suggestions') === ordre.indexOf('/annuaire') + 1, ordre.join(' '));
    if (q !== p) await q.context().close();
  }

  console.log('— Annuaire (agent, bureau) : vue « Par unité »');
  const api = (await call('agent1', 'GET', '/api/v1/annuaire')).body;
  // Squelette pendant le chargement (réponse de l'annuaire retardée).
  await p.route(/\/api\/v1\/annuaire\?q=$/, async (r) => { await new Promise((x) => setTimeout(x, 800)); await r.continue(); });
  await p.goto(`${WEB}/annuaire`);
  await p.getByRole('heading', { name: 'Annuaire', exact: true }).waitFor();
  check('chargement : squelette (pas de « Chargement… »)', (await p.locator('[data-testid=squelette]').count()) >= 1 && (await p.getByText('Chargement…').count()) === 0);
  await p.locator('[data-testid=personne-annuaire]').first().waitFor();
  await p.unroute(/\/api\/v1\/annuaire\?q=$/);
  check(`en-tête : « ${api.total} personnes · ${api.disponibles} disponibles aujourd’hui » (API)`, (await p.getByTestId('compteur-disponibles').innerText()).includes(`${api.disponibles} disponible`));
  check('vue « Par unité » par défaut', (await p.getByRole('button', { name: 'Par unité' }).getAttribute('aria-pressed')) === 'true');
  const vues = api.unites.filter((u) => u.nombre > 0);
  check(`un bloc par unité non vide (${vues.length}), une carte par personne (${api.total})`, (await p.getByTestId('bloc-unite').count()) === vues.length && (await p.locator('[data-testid=personne-annuaire]').count()) === api.total);
  const sigles = p.getByTestId('sigles-unites');
  check('colonne des sigles : unités non vides seulement', (await sigles.getByRole('link').count()) === vues.length);
  if (api.unites.some((u) => u.nombre === 0)) check('unités vides repliées sous « Unités sans agent (n) »', /Unités sans agent \(\d+\)/.test(await p.getByTestId('unites-vides').innerText()));
  const bloc = p.locator('[data-testid=bloc-unite]', { hasText: dpe.name });
  check('bloc DPE : sigle, chef, nombre d’agents ; chef en tête sur fond doré avec badge', /DPE/.test(await bloc.innerText()) && (await bloc.getByText(`Chef : ${chefdpe.firstName} ${chefdpe.lastName}`).count()) === 1 && (await bloc.locator('[data-testid=personne-annuaire]').first().getAttribute('data-chef')) === 'oui' && /Chef de division/.test(await bloc.locator('[data-testid=personne-annuaire]').first().innerText()));
  const carte = p.locator('[data-testid=personne-annuaire]', { hasText: `${chefdpe.firstName} ${chefdpe.lastName}` });
  check('carte : bouton « Message » vers la messagerie (nom accessible)', (await carte.getByRole('link', { name: `Envoyer un message à ${chefdpe.firstName} ${chefdpe.lastName}` }).getAttribute('href')) === `/communication?with=${chefdpe.id}`);
  check('carte : aucune adresse email (annuaire sans champ sensible, inchangé)', (await p.locator('main a[href^="mailto:"]').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/u_annuaire_cartes_bureau.png` });
  await carte.getByRole('button', { name: `Voir la fiche de ${chefdpe.firstName} ${chefdpe.lastName}` }).click();
  const fiche = p.getByTestId('fiche-annuaire');
  await fiche.waitFor();
  check('fiche à droite : unité complète, « rend compte à », équipe, bouton Message', /Rend compte à/.test(await fiche.innerText()) && /Équipe/.test(await fiche.innerText()) && (await fiche.getByTestId('fiche-message').count()) === 1 && (await p.getByTestId('fiche-annuaire-colonne').count()) === 1);
  check('agent : pas d’« Assigner une tâche » (droit de l’API)', (await fiche.getByRole('button', { name: 'Assigner une tâche' }).count()) === 0);
  await p.getByLabel('Rechercher un nom, une fonction, une unité ou un sigle').fill(chefdpe.lastName.toLowerCase());
  await attendre(p, () => document.querySelectorAll('[data-testid=personne-annuaire]').length <= 3);
  check('recherche à chaque lettre (sans majuscules) : cartes filtrées, nom en gras', (await p.locator('[data-testid=personne-annuaire]', { hasText: `${chefdpe.firstName} ${chefdpe.lastName}` }).count()) === 1 && (await carte.locator('b b').count()) >= 1);
  await p.getByLabel('Rechercher un nom, une fonction, une unité ou un sigle').fill('');
  await p.getByRole('button', { name: 'Liste', exact: true }).click();
  await p.getByRole('table', { name: 'Annuaire' }).waitFor();
  check('vue « Liste » conservée : tableau (Personne, Fonction, Unité, Aujourd’hui), une ligne par personne', (await p.getByRole('columnheader', { name: 'Fonction' }).count()) === 1 && (await p.locator('[data-testid=personne-annuaire]').count()) === api.total);
  await p.getByLabel('Rechercher un nom, une fonction, une unité ou un sigle').fill(`introuvable${S}`);
  await attendre(p, () => !document.querySelector('[data-testid=personne-annuaire]'));
  check('recherche sans résultat : état vide', (await p.getByText('Aucune personne ne correspond.').count()) === 1);
  await p.context().close();

  p = await loginPage(b, 'chefdpe', BUREAU);
  await p.goto(`${WEB}/annuaire`);
  const carteAgent = p.locator('[data-testid=personne-annuaire]', { hasText: 'AGENT1' }).first();
  await carteAgent.waitFor();
  await carteAgent.getByRole('button').first().click();
  await p.getByTestId('fiche-annuaire').waitFor();
  check('chef de division : « Assigner une tâche » sur un agent de sa division (droit de l’API)', (await p.getByTestId('fiche-annuaire').getByRole('button', { name: 'Assigner une tâche' }).count()) === 1);
  await p.context().close();

  console.log('— Annuaire (téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/annuaire?q=${encodeURIComponent(chefdpe.lastName)}`);
  await p.locator('[data-testid=personne-annuaire]').first().waitFor();
  check('?q= : recherche pré-remplie', (await p.getByLabel('Rechercher un nom, une fonction, une unité ou un sigle').inputValue()) === chefdpe.lastName);
  check('téléphone : unités en boutons qui défilent (rangée horizontale)', await p.getByTestId('sigles-unites').evaluate((e) => getComputedStyle(e).overflowX === 'auto' && getComputedStyle(e).display === 'flex'));
  check('téléphone : sans défilement horizontal de la page (cartes empilées)', await sansDefilementHorizontal(p));
  const boutonsVisibles = await p.locator('[data-testid=personne-annuaire]').first().getByRole('link').evaluateAll((els) => els.every((e) => e.getBoundingClientRect().right <= window.innerWidth));
  check('téléphone : bouton Message dans l’écran', boutonsVisibles);
  await p.locator('[data-testid=personne-annuaire]').first().getByRole('button').first().click();
  await p.getByTestId('fiche-annuaire').waitFor();
  check('téléphone : fiche en fenêtre', (await p.getByTestId('fiche-annuaire').isVisible()));
  await p.screenshot({ path: `${E.SHOTS}/u_annuaire_mobile.png` });
  await p.context().close();

  console.log('— Boîte à suggestions : dépôt (agent), décision (DN), lecture (agent)');
  p = await loginPage(b, 'agent1', BUREAU);
  await p.goto(`${WEB}/suggestions`);
  await p.getByRole('heading', { name: 'Boîte à suggestions' }).waitFor();
  check('agent : pas d’onglet « Boîte de réception »', (await p.getByRole('tab', { name: /Boîte de réception/ }).count()) === 0);
  await p.getByRole('button', { name: 'Nouvelle suggestion' }).click();
  let d = p.getByRole('dialog', { name: 'Nouvelle suggestion' });
  const nbMiennes = async () => (await call('agent1', 'GET', '/suggestions/mine')).body.length;
  const avant = await nbMiennes();
  await d.getByRole('button', { name: 'Envoyer la suggestion' }).click();
  check('envoi vide : « Écrivez votre suggestion. » sous le champ, rien d’envoyé', (await d.locator('[data-testid=erreur-champ]').innerText()) === 'Écrivez votre suggestion.' && (await nbMiennes()) === avant);
  await d.getByLabel('Votre suggestion, à destination de la Direction').fill(`Salle de lecture ${S}`);
  await d.getByRole('button', { name: 'Envoyer la suggestion' }).click();
  const mienne = p.locator('[data-testid=ma-suggestion]', { hasText: `Salle de lecture ${S}` });
  await mienne.waitFor();
  check('suggestion listée « Reçue »', /Reçue/.test(await mienne.innerText()));
  check('message de confirmation « Suggestion envoyée »', /Suggestion envoyée/.test(await p.locator('[data-testid=toast]').innerText()));
  await p.context().close();

  p = await loginPage(b, 'dn', BUREAU);
  await p.goto(`${WEB}/suggestions`);
  const recue = p.locator('[data-testid=suggestion]', { hasText: `Salle de lecture ${S}` });
  await recue.waitFor();
  check('DN : onglet « Boîte de réception » actif, bande par statut', (await p.getByRole('tab', { name: /Boîte de réception/ }).getAttribute('aria-selected')) === 'true' && (await p.getByRole('region', { name: 'Suggestions par statut' }).count()) === 1);
  await p.getByLabel('Statut', { exact: true }).selectOption('RETENUE');
  check('filtre Statut « Retenue » : la suggestion reçue est masquée', await attendre(p, (t) => ![...document.querySelectorAll('[data-testid=suggestion]')].some((e) => e.textContent.includes(t)), `Salle de lecture ${S}`));
  await p.getByLabel('Statut', { exact: true }).selectOption('');
  await recue.getByRole('button', { name: /^Voir la suggestion/ }).click();
  const f = p.locator('[data-testid=fiche-suggestion]');
  await f.waitFor();
  check('fenêtre : circuit Reçue → En étude → Retenue en en-tête', (await f.getByRole('list', { name: 'Suivi de la suggestion' }).count()) === 1);
  await f.getByRole('radio', { name: 'Retenue', exact: true }).click();
  await f.getByLabel(/^Réponse/).fill(`Retenue pour 2027 ${S}`);
  await f.getByRole('button', { name: 'Enregistrer' }).click();
  await f.waitFor({ state: 'detached' });
  check('message de confirmation « Suggestion retenue » (auteur notifié)', /Suggestion retenue[\s\S]*auteur est notifié/.test(await p.locator('[data-testid=toast]').innerText()));
  check('après enregistrement : ligne « Retenue »', await attendre(p, (t) => [...document.querySelectorAll('[data-testid=suggestion]')].some((e) => e.textContent.includes(t) && e.textContent.includes('Retenue')), `Salle de lecture ${S}`));
  await p.context().close();

  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/suggestions`);
  const lue = p.locator('[data-testid=ma-suggestion]', { hasText: `Salle de lecture ${S}` });
  await lue.waitFor();
  await lue.getByRole('button', { name: /^Voir ma suggestion/ }).click();
  const fl = p.locator('[data-testid=fiche-suggestion]');
  await fl.waitFor();
  check('auteur : fenêtre en lecture seule avec la réponse, sans champ « Statut »', (await fl.innerText()).includes(`Retenue pour 2027 ${S}`) && (await fl.getByRole('radiogroup').count()) === 0);
  check('téléphone : sans défilement horizontal (suggestions)', await sansDefilementHorizontal(p));
  await fl.getByRole('button', { name: 'Fermer', exact: true }).first().click();
  check('téléphone : filtre Statut replié derrière « Filtres »', (await p.getByRole('button', { name: 'Filtres', exact: true }).isVisible()) && !(await p.getByLabel('Statut', { exact: true }).isVisible()));
  await p.screenshot({ path: `${E.SHOTS}/u_suggestion_mobile.png` });
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
