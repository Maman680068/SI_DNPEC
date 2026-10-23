// Refonte de l'interface (étape 8) — Annuaire (cartes, arbre des unités, filtre Fonction, vue Liste,
// bouton Message (aucune adresse email exposée, comme avant), fiche en fenêtre deux colonnes) et Boîte à suggestions (dépôt, fenêtre de
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

  console.log('— Annuaire (agent, bureau)');
  // Squelette pendant le chargement (réponse de l'annuaire retardée).
  await p.route('**/users/directory', async (r) => { await new Promise((x) => setTimeout(x, 800)); await r.continue(); });
  await p.goto(`${WEB}/annuaire`);
  await p.getByRole('heading', { name: 'Annuaire', exact: true }).waitFor();
  check('chargement : squelette (pas de « Chargement… »)', (await p.locator('[data-testid=squelette]').count()) >= 1 && (await p.getByText('Chargement…').count()) === 0);
  await p.locator('[data-testid=personne-annuaire]').first().waitFor();
  await p.unroute('**/users/directory');
  check('en-tête : « N personnes · N divisions · N cellules »', (await p.getByText(/^\d+ personnes · \d+ divisions? · \d+ cellules?$/).count()) === 1);
  check(`cartes : une par personne active (${annuaire.length})`, (await p.locator('[data-testid=personne-annuaire]').count()) === annuaire.length);
  const arbre = p.getByRole('navigation', { name: 'Unités' });
  check('arbre des unités avec compteurs (Direction, divisions, sections, cellules)', (await arbre.getByRole('button').count()) >= 4 && /Direction\s*\d+/.test(await arbre.innerText()));
  await arbre.getByRole('button', { name: new RegExp(`^${dpe.name}`) }).click();
  const nbDpe = annuaire.filter((x) => x.divisionId === ids.DPE).length;
  check(`arbre : « ${dpe.name} » → ${nbDpe} cartes, chef affiché`, await attendre(p, (n) => document.querySelectorAll('[data-testid=personne-annuaire]').length === n, nbDpe) && (await p.getByText(`Chef : ${chefdpe.firstName} ${chefdpe.lastName}`).count()) === 1);
  const carte = p.locator('[data-testid=personne-annuaire]', { hasText: `${chefdpe.firstName} ${chefdpe.lastName}` });
  check('carte : bouton « Message » vers la messagerie (nom accessible)', (await carte.getByRole('link', { name: `Envoyer un message à ${chefdpe.firstName} ${chefdpe.lastName}` }).getAttribute('href')) === `/communication?with=${chefdpe.id}`);
  check('carte : aucune adresse email (annuaire sans champ sensible, inchangé)', (await p.locator('main a[href^="mailto:"]').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/u_annuaire_cartes_bureau.png` });
  await p.getByLabel('Fonction', { exact: true }).selectOption({ index: 1 });
  check('filtre Fonction : encadré (actif), cartes filtrées', (await p.locator('[data-testid=personne-annuaire]').count()) <= nbDpe);
  await p.getByLabel('Fonction', { exact: true }).selectOption('');
  await p.getByRole('button', { name: 'Liste', exact: true }).click();
  await p.getByRole('table', { name: 'Annuaire' }).waitFor();
  check('vue Liste : tableau (Personne, Fonction, Unité), même nombre de lignes', (await p.getByRole('columnheader', { name: 'Fonction' }).count()) === 1 && (await p.locator('[data-testid=personne-annuaire]').count()) === nbDpe);
  check('bascule : « Liste » pressé', (await p.getByRole('button', { name: 'Liste', exact: true }).getAttribute('aria-pressed')) === 'true');
  await p.locator('[data-testid=personne-annuaire]', { hasText: `${chefdpe.firstName} ${chefdpe.lastName}` }).click();
  const fiche = p.locator('[data-testid=fiche-personne]');
  await fiche.waitFor();
  const ficheT = await fiche.innerText();
  check('fiche en fenêtre : fonction, unité, « Envoyer un message », sans email', ficheT.includes('Fonction') && (await fiche.getByRole('button', { name: 'Envoyer un message' }).count()) === 1 && (await fiche.locator('a[href^="mailto:"]').count()) === 0);
  check('agent : pas d’« Assigner une tâche » (inchangé)', (await fiche.getByRole('button', { name: 'Assigner une tâche' }).count()) === 0);
  await fiche.getByRole('button', { name: 'Fermer', exact: true }).click();
  await p.getByLabel('Rechercher un nom, un poste ou une unité').fill(`introuvable${S}`);
  check('recherche sans résultat : état vide qui propose d’effacer les filtres', (await p.getByRole('button', { name: 'Effacer les filtres' }).count()) === 1);
  await p.context().close();

  console.log('— Annuaire (téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/annuaire?q=${encodeURIComponent(chefdpe.lastName)}`);
  await p.locator('[data-testid=personne-annuaire]').first().waitFor();
  check('?q= : recherche pré-remplie', (await p.getByLabel('Rechercher un nom, un poste ou une unité').inputValue()) === chefdpe.lastName);
  check('téléphone : filtres repliés derrière « Filtres » (unité masquée, arbre masqué)', (await p.getByRole('button', { name: 'Filtres', exact: true }).isVisible()) && !(await p.getByLabel('Unité', { exact: true }).isVisible()) && !(await p.getByRole('navigation', { name: 'Unités' }).isVisible()));
  await p.getByRole('button', { name: 'Filtres', exact: true }).click();
  const panneau = p.getByRole('dialog', { name: 'Filtres' });
  await panneau.getByLabel('Unité', { exact: true }).selectOption(`division:${ids.DPE}`);
  await panneau.getByRole('button', { name: 'Appliquer' }).click();
  check('téléphone : unité choisie dans le panneau → bouton « Filtres (1) »', (await p.getByRole('button', { name: 'Filtres (1)' }).count()) === 1);
  await p.getByRole('button', { name: 'Filtres (1)' }).click();
  await panneau.getByRole('button', { name: 'Effacer les filtres' }).click();
  await panneau.getByRole('button', { name: 'Appliquer' }).click();
  check('téléphone : « Effacer les filtres » → « Filtres » sans compteur', (await p.getByRole('button', { name: 'Filtres', exact: true }).count()) === 1);
  check('téléphone : sans défilement horizontal (cartes)', await sansDefilementHorizontal(p));
  const boutonsVisibles = await p.locator('[data-testid=personne-annuaire]').first().getByRole('link').evaluateAll((els) => els.every((e) => e.getBoundingClientRect().right <= window.innerWidth));
  check('téléphone : boutons Message et Email dans l’écran', boutonsVisibles);
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
