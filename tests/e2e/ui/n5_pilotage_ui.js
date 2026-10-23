// N5 — écrans sous Chromium, bureau (1366) et téléphone (390) : plan de travail (objectif, activité,
// tâche rattachée, vues Kanban et Calendrier), « Mes tâches » en calendrier, recherche de la barre du
// haut, fil de discussion (plusieurs destinataires, objet joint, accusé de lecture), préférences de
// notification, instructions de la Direction (émission, réception, prise en compte, exécution).
// Refonte de l'interface (étape 6) : plan « Plan de travail [année] », bande de synthèse, anneau par
// objectif, frise de janvier à décembre ; fiche d'une activité en fenêtre deux colonnes.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
// Étape 9 : message de confirmation (toast) ; personne choisie dans le sélecteur (taper le nom, cliquer l'option).
const toast = (p, titre) => p.getByTestId('toast').filter({ hasText: titre }).waitFor({ timeout: 10000 }).then(() => true, () => false);
async function choisirPersonne(d, label, nom) {
  await d.getByRole('combobox', { name: label }).fill(nom.split(' ').pop());
  await d.getByRole('option', { name: nom }).first().click();
}

(async () => {
  const b = await browser();

  console.log('— Plan de travail : objectif et activité (chef de section, bureau)');
  let p = await loginPage(b, 'chefssr');
  check('menu : « Plan de travail » et « Instructions »', (await p.locator('a[href="/plan-travail"]').count()) === 1 && (await p.locator('a[href="/instructions"]').count()) === 1);
  await p.goto(`${WEB}/plan-travail`);
  await p.getByRole('heading', { name: `Plan de travail ${new Date().getFullYear()}` }).waitFor();
  const synthese = p.getByRole('region', { name: /Synthèse du plan de travail/ });
  const synthese_t = await synthese.innerText();
  check('bande de synthèse : objectifs, activités, avancement moyen, retards', (await synthese.locator('[data-testid^=synthese-]').count()) === 4 && ['dans votre périmètre', 'terminée', 'Avancement moyen', 'calculé sur les tâches', 'échéance dépassée'].every((x) => synthese_t.includes(x)), synthese_t.replace(/\n/g, ' | '));
  const objectifsAvant = Number((await p.locator('[data-testid=synthese-objectifs]').innerText()).match(/\d+/)[0]);
  await p.getByRole('button', { name: 'Nouvel objectif' }).first().click();
  let d = p.getByRole('dialog', { name: /Nouvel objectif/ });
  await d.getByRole('button', { name: 'Créer l’objectif' }).click();
  check('objectif vide : message sous le libellé, rien d’envoyé', (await d.getByText('Indiquez le libellé de l’objectif.').count()) === 1 && (await d.isVisible()));
  await d.getByLabel('Libellé de l’objectif').fill(`Conjoncture ${S}`);
  await d.getByRole('button', { name: 'Créer l’objectif' }).click();
  const objectif = p.locator('[data-testid=objectif]', { hasText: `Conjoncture ${S}` });
  await objectif.waitFor();
  check('message de confirmation « Objectif créé »', await toast(p, 'Objectif créé'));
  check('synthèse : un objectif de plus', await p.waitForFunction((n) => Number(document.querySelector('[data-testid=synthese-objectifs]').textContent.match(/\d+/)[0]) === n + 1, objectifsAvant).then(() => true, () => false));
  check('panneau de l’objectif : anneau d’avancement à 0 %', (await objectif.getByRole('img', { name: /Avancement de l’objectif : 0 %/ }).count()) === 1);
  await objectif.getByRole('button', { name: 'Activité', exact: true }).click();
  d = p.getByRole('dialog', { name: 'Nouvelle activité' });
  await d.getByLabel('Libellé de l’activité').fill(`Note mensuelle ${S}`);
  const resp = (await call('chefssr', 'GET', '/users/directory')).body.find((u) => u.id === ids.agent1);
  await choisirPersonne(d, 'Responsable', `${resp.firstName} ${resp.lastName}`);
  await d.getByLabel('Fin', { exact: true }).fill(jour(-5));
  await d.getByLabel('Début', { exact: true }).fill(jour(25));
  await d.getByLabel('Indicateur').fill('Notes publiées');
  await d.getByLabel(/Cible/).fill('1 par mois');
  await d.getByRole('button', { name: 'Créer l’activité' }).click();
  check('activité : fin avant le début refusée dans la fenêtre', (await d.getByText('La fin doit être postérieure ou égale au début.').count()) === 1);
  // Champ date déjà rempli : le mettre au point avant de le remplir à nouveau.
  await d.getByLabel('Début', { exact: true }).click();
  await d.getByLabel('Début', { exact: true }).fill(jour(-5));
  await d.getByLabel('Fin', { exact: true }).click();
  await d.getByLabel('Fin', { exact: true }).fill(jour(25));
  await d.getByRole('button', { name: 'Créer l’activité' }).click();
  check('message de confirmation « Activité créée »', await toast(p, 'Activité créée'));
  const activite = objectif.locator('[data-testid=activite]', { hasText: `Note mensuelle ${S}` });
  await activite.waitFor();
  check('activité listée : responsable, indicateur, 0 %', /Notes publiées/.test(await activite.innerText()) && /0 %/.test(await activite.innerText()));
  check('frise : barre de l’activité « en cours » (de son début à sa fin)', (await activite.getByRole('img', { name: /^Du .* au .*, en cours$/ }).count()) === 1);
  check('en-têtes : J F M A M J J A S O N D', (await objectif.getByRole('columnheader').allInnerTexts()).some((t) => t.replace(/\s+/g, '').startsWith('JFMAMJJASOND')));
  await p.screenshot({ path: `${E.SHOTS}/n5_plan_bureau.png` });

  console.log('— Activité : tâche rattachée, Kanban puis Calendrier');
  await activite.getByRole('button').first().click();
  const fiche = p.locator('[data-testid=fiche-activite]');
  await fiche.waitFor();
  await fiche.getByRole('heading', { name: `Note mensuelle ${S}` }).waitFor();
  check('fiche en fenêtre : titre de l’activité, informations à droite', (await fiche.getByRole('heading', { name: `Note mensuelle ${S}` }).count()) === 1 && /Responsable/.test(await fiche.innerText()) && /Notes publiées/.test(await fiche.innerText()));
  await fiche.getByRole('button', { name: 'Nouvelle tâche' }).click();
  const ft = p.getByRole('dialog', { name: 'Nouvelle tâche' });
  await ft.getByLabel('Titre').fill(`Collecte ${S}`);
  check('tâche : activité présélectionnée', (await p.locator('#tache-activite').inputValue()).length > 0);
  await ft.getByLabel('Échéance', { exact: true }).fill(jour(3));
  await ft.getByRole('radio', { name: 'Haute' }).click();
  await ft.getByRole('button', { name: 'Créer la tâche' }).click();
  await fiche.getByText(`Collecte ${S}`).first().waitFor();
  check('message de confirmation « Tâche créée »', await toast(p, 'Tâche créée'));
  check('Kanban : la tâche apparaît dans la fiche de l’activité', true);
  await fiche.getByRole('button', { name: 'Calendrier' }).click();
  await fiche.getByText(`Collecte ${S}`).first().waitFor();
  check('Calendrier : la tâche à son échéance', true);
  await p.screenshot({ path: `${E.SHOTS}/n5_activite_bureau.png` });
  await p.context().close();

  console.log('— Agent (téléphone) : plan en lecture, « Mes tâches » en calendrier');
  p = await loginPage(b, 'agent1', TELEPHONE);
  // Tableau de bord : panneau « Plan de travail — avancement des activités », juste après « À traiter ».
  const panneauPlan = p.getByTestId('avancement-activites');
  await panneauPlan.waitFor();
  const ligne = panneauPlan.locator('[data-testid=ligne-activite]', { hasText: `Note mensuelle ${S}` });
  const apiAct = (await call('agent1', 'GET', `/api/v1/plan-travail?annee=${new Date().getFullYear()}`)).body.objectifs.flatMap((o) => o.activites).find((a) => a.libelle === `Note mensuelle ${S}`);
  check('tableau de bord : l’activité, son sigle d’unité et son pourcentage', (await ligne.count()) === 1 && (await ligne.innerText()).includes(`${apiAct.avancement} %`) && (await ligne.innerText()).includes(apiAct.uniteSigle));
  check(`barre de la couleur de l’état calculé par l’API (${apiAct.etatAvancement})`, (await ligne.getAttribute('data-etat')) === apiAct.etatAvancement && (await ligne.locator('[role=progressbar] i').getAttribute('class')).includes(apiAct.etatAvancement === 'EN_RETARD' ? 'bg-clay' : apiAct.etatAvancement === 'EN_DECALAGE' ? 'bg-gold' : 'bg-sage'));
  check('ligne : lien vers l’activité dans le Plan de travail', (await ligne.locator('a').getAttribute('href')) === `/plan-travail?activite=${apiAct.id}`);
  check('panneau placé juste après « À traiter » (ou en tête)', await p.evaluate(() => { const x = document.querySelector('[data-testid=avancement-activites]'); const prec = x.previousElementSibling; return !prec || prec.getAttribute('data-testid') === 'a-traiter'; }));
  check('l’ancienne section « Mes activités du plan de travail » a disparu', (await p.getByTestId('mes-activites').count()) === 0);
  await p.goto(`${WEB}/plan-travail`);
  await p.locator('[data-testid=objectif]', { hasText: `Conjoncture ${S}` }).waitFor();
  check('agent : pas de « Nouvel objectif » ni « Activité »', (await p.getByRole('button', { name: 'Nouvel objectif' }).count()) === 0 && (await p.getByRole('button', { name: 'Activité', exact: true }).count()) === 0);
  check('téléphone : sans défilement horizontal (plan)', await sansDefilementHorizontal(p));
  check('téléphone : unité et année repliées derrière « Filtres »', (await p.getByTestId('bouton-filtres').isVisible()) && !(await p.getByLabel('Unité', { exact: true }).isVisible()));
  await p.screenshot({ path: `${E.SHOTS}/n5_plan_mobile.png`, fullPage: true });
  // Bouton « Rapport d'activité » : ouvre le formulaire existant de « Documents générés » (lien profond).
  const perimetresRapport = (await call('agent1', 'GET', '/api/v1/documents-generes/catalogue')).body.rapportActivite.perimetres;
  check('bouton « Rapport d’activité » présent (l’API ouvre un périmètre de rapport)', perimetresRapport.length > 0 && (await p.getByTestId('bouton-rapport-activite').count()) === 1);
  await p.getByTestId('bouton-rapport-activite').click();
  await p.waitForURL('**/documents-generes?onglet=rapport**');
  await p.getByRole('region', { name: 'Rapport d’activité' }).waitFor();
  check('« Documents générés » ouvert sur le formulaire du rapport, période depuis le 1er janvier', (await p.getByRole('tab', { name: 'Rapport d’activité' }).getAttribute('aria-selected')) === 'true' && new URL(p.url()).searchParams.get('debut') === `${new Date().getFullYear()}-01-01`);
  await p.goto(`${WEB}/tasks`);
  await p.getByRole('button', { name: 'Calendrier' }).click();
  await p.getByRole('button', { name: /Aujourd|‹|›|Mois/ }).first().waitFor({ timeout: 5000 }).catch(() => {});
  check('« Mes tâches » : vue Calendrier disponible', (await p.getByRole('button', { name: 'Kanban' }).count()) === 1);
  await p.context().close();

  console.log('— Mes tâches (étape 9) : fenêtre « Nouvelle tâche », circuit avec messages de confirmation');
  const a1 = (await call('chefssr', 'GET', '/users/directory')).body.find((u) => u.id === ids.agent1);
  const nomA1 = `${a1.firstName} ${a1.lastName}`;
  p = await loginPage(b, 'chefssr', { width: 1440, height: 900 });
  await p.goto(`${WEB}/tasks?nouvelle=1`);
  const nt = p.getByRole('dialog', { name: 'Nouvelle tâche' });
  await nt.waitFor();
  const nbTaches = (await call('chefssr', 'GET', `/tasks?createdById=${ids.chefssr}`)).body.length;
  await nt.getByRole('button', { name: 'Créer la tâche' }).click();
  check('tâche vide : « Donnez un titre à la tâche. » sous le titre, rien d’envoyé', (await nt.getByText('Donnez un titre à la tâche.').count()) === 1 && (await call('chefssr', 'GET', `/tasks?createdById=${ids.chefssr}`)).body.length === nbTaches);
  check('pied : « Les personnes assignées sont prévenues immédiatement. »', (await nt.getByText('Les personnes assignées sont prévenues immédiatement.').count()) === 1);
  await nt.getByLabel('Titre').fill(`Circuit ${S}`);
  await nt.getByRole('radio', { name: 'Haute' }).click();
  await nt.getByLabel('Échéance', { exact: true }).fill(jour(6));
  await choisirPersonne(nt, 'Assigner à', nomA1);
  check('assignée en étiquette', (await nt.locator('[data-testid=personne-choisie]').count()) === 1);
  await nt.getByLabel('Documents de référence').setInputFiles({ name: `consignes_${S}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Consignes') });
  await nt.getByLabel(/Un document est obligatoire/).check();
  await nt.getByRole('button', { name: 'Créer la tâche' }).click();
  check(`« Tâche créée » : ${nomA1} prévenu`, (await toast(p, 'Tâche créée')) && (await p.getByTestId('toast').innerText()).includes(nomA1));
  const tache = (await call('chefssr', 'GET', `/tasks?createdById=${ids.chefssr}`)).body.find((t) => t.title === `Circuit ${S}`);
  check('tâche enregistrée : priorité haute, document obligatoire, document de référence joint', tache && tache.priority === 'URGENT' && tache.documentRequired && (await call('chefssr', 'GET', `/tasks/${tache.id}/attachments`)).body.length === 1);
  await p.context().close();

  p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/tasks/${tache.id}`);
  const ftache = p.getByTestId('fenetre-tache');
  await ftache.getByRole('button', { name: 'Démarrer' }).click();
  check('« Tâche démarrée »', await toast(p, 'Tâche démarrée'));
  await ftache.getByRole('textbox', { name: 'Ajouter une sous-tâche' }).fill(`Relire ${S}`);
  await ftache.getByRole('textbox', { name: 'Ajouter une sous-tâche' }).press('Enter');
  check('sous-tâche refusée par l’API à l’assignée : message d’erreur en français (toast)', (await p.getByTestId('toast').filter({ hasText: 'Action impossible' }).waitFor({ timeout: 10000 }).then(() => true, () => false)) && (await p.getByTestId('toast').getAttribute('data-ton')) === 'erreur');
  await call('chefssr', 'POST', `/tasks/${tache.id}/subtasks`, { title: `Relire ${S}`, assignees: [{ userId: ids.agent1 }] });
  await p.reload();
  await ftache.getByRole('checkbox', { name: 'Cocher comme terminée' }).click();
  check('« Sous-tâche terminée » avec « Annuler » (même route)', (await toast(p, 'Sous-tâche terminée')) && (await p.getByTestId('toast').getByRole('button', { name: 'Annuler' }).count()) === 1);
  await ftache.getByRole('button', { name: 'Soumettre pour validation' }).click();
  check('« Tâche soumise pour validation » : le créateur prévenu', (await toast(p, 'Tâche soumise pour validation')) && /a été prévenu/.test(await p.getByTestId('toast').innerText()));
  await p.context().close();

  p = await loginPage(b, 'chefssr');
  await p.goto(`${WEB}/tasks/${tache.id}`);
  const fv = p.getByTestId('fenetre-tache');
  await fv.getByRole('button', { name: 'Rejeter avec un motif' }).click();
  const rj = p.getByRole('dialog', { name: 'Rejeter la tâche' });
  await rj.getByRole('button', { name: 'Rejeter la tâche' }).click();
  check('rejet sans motif : refusé dans la fenêtre', (await rj.locator('[data-testid=erreur-champ]').count()) === 1 && (await call('chefssr', 'GET', `/tasks/${tache.id}`)).body.status === 'SOUMISE_VALIDATION');
  await rj.getByLabel('Motif du rejet').fill('Ajouter les sources');
  await rj.getByRole('button', { name: 'Rejeter la tâche' }).click();
  check('« Tâche rejetée » : retour « En cours »', (await toast(p, 'Tâche rejetée')) && (await call('chefssr', 'GET', `/tasks/${tache.id}`)).body.status === 'EN_COURS');
  await call('agent1', 'POST', `/tasks/${tache.id}/submit`);
  await p.goto(`${WEB}/tasks/${tache.id}`);
  await fv.getByRole('button', { name: 'Valider la tâche' }).click();
  check(`« Tâche validée » : « ${nomA1} a été prévenu. »`, (await toast(p, 'Tâche validée')) && (await p.getByTestId('toast').innerText()).includes(`${nomA1} a été prévenu.`));
  await p.context().close();

  p = await loginPage(b, 'chefssr', TELEPHONE);
  await p.goto(`${WEB}/tasks`);
  await p.getByTestId('bouton-filtres').waitFor();
  check('Mes tâches (téléphone) : filtres repliés derrière « Filtres », sans défilement horizontal', !(await p.getByLabel('Priorité', { exact: true }).isVisible()) && (await sansDefilementHorizontal(p)));
  await p.getByTestId('bouton-filtres').click();
  await p.getByRole('dialog', { name: 'Filtres' }).getByLabel('Priorité', { exact: true }).selectOption('URGENT');
  await p.getByRole('button', { name: 'Appliquer' }).click();
  check('« Filtres (1) » après le choix d’une priorité', /Filtres \(1\)/.test(await p.getByTestId('bouton-filtres').innerText()));
  await p.context().close();

  console.log('— Recherche de la barre du haut (bureau)');
  p = await loginPage(b, 'agent1');
  const barre = p.getByRole('combobox', { name: 'Recherche transverse' });
  await barre.fill(S);
  await barre.press('Enter');
  await p.waitForURL(/\/recherche\?q=/);
  const taches = p.locator('[data-testid=categorie-taches]');
  await taches.getByText(`Collecte ${S}`).waitFor();
  check('résultats par catégorie : la tâche trouvée, lien vers sa fiche', (await taches.getByRole('link', { name: new RegExp(`Collecte ${S}`) }).getAttribute('href')).startsWith('/tasks/'));
  check('6 catégories affichées (dont « Plan de travail »)', (await p.locator('[data-testid^=categorie-]').count()) === 6);
  await p.screenshot({ path: `${E.SHOTS}/n5_recherche_bureau.png` });

  console.log('— Fil de discussion : deux destinataires, objet joint');
  await p.goto(`${WEB}/communication`);
  await p.getByRole('tab', { name: 'Fils de discussion' }).click();
  await p.getByRole('button', { name: 'Nouveau fil' }).click();
  d = p.getByRole('dialog', { name: 'Nouveau fil de discussion' });
  const nbFils = async () => (await call('agent1', 'GET', '/api/v1/fils')).body.length;
  const filsAvant = await nbFils();
  // Étape 9 : validation dans la fenêtre (objet, destinataires, message), rien d'envoyé.
  await d.getByRole('button', { name: 'Démarrer le fil' }).click();
  check('fil vide : messages sous Objet, Destinataires et Message, rien d’envoyé', (await d.locator('[data-testid=erreur-champ]').count()) === 3 && (await d.getByText('Choisissez au moins un destinataire.').count()) === 1 && (await nbFils()) === filsAvant);
  await d.getByLabel('Objet', { exact: true }).fill(`Note de conjoncture ${S}`);
  const noms = (await call('agent1', 'GET', '/api/v1/fils/destinataires-possibles')).body;
  for (const id of [ids.agent2, ids.chefssr]) {
    const u = noms.find((x) => x.id === id);
    await d.getByRole('combobox', { name: 'Destinataires' }).fill(u.lastName);
    await d.getByRole('option', { name: `${u.firstName} ${u.lastName}` }).click();
  }
  check('deux destinataires en étiquettes', (await d.locator('[data-testid=personne-choisie]').count()) === 2);
  await d.getByLabel('Message', { exact: true }).fill('Voici la collecte à compléter.');
  await d.getByLabel(/Joindre un objet/).fill(S);
  await d.getByRole('button', { name: new RegExp(`Collecte ${S}`) }).first().click();
  await d.locator('[data-testid=objet-joint]').waitFor();
  await d.getByRole('button', { name: 'Démarrer le fil' }).click();
  await p.locator('[data-testid=toast]').filter({ hasText: 'Fil de discussion démarré' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('message de confirmation « Fil de discussion démarré » (2 destinataires prévenus)', /2 destinataires prévenus/.test(await p.locator('[data-testid=toast]').innerText().catch(() => '')));
  const msg = p.locator('[data-testid=message-fil]').first();
  await msg.waitFor();
  check('fil ouvert : objet joint cliquable, deux « non lu »', (await msg.locator('a[data-testid=lien-objet]').count()) === 1 && ((await msg.locator('[data-testid=accuses]').innerText()).match(/Non lu/g) || []).length === 2);
  const filId = (await call('agent1', 'GET', '/api/v1/fils')).body.find((f) => f.objet === `Note de conjoncture ${S}`).id;
  await p.context().close();

  p = await loginPage(b, 'agent2', TELEPHONE);
  await p.goto(`${WEB}/communication?fil=${filId}`);
  await p.locator('[data-testid=message-fil]').first().waitFor();
  check('destinataire (lien de la notification) : fil ouvert, objet joint visible', (await p.locator('[data-testid=lien-objet]').count()) === 1);
  check('téléphone : sans défilement horizontal (fil)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n5_fil_mobile.png` });
  await p.getByLabel('Votre message', { exact: true }).fill(`Bien reçu ${S}`);
  await p.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await p.locator('[data-testid=toast]').filter({ hasText: 'Réponse envoyée' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('réponse au fil : « Réponse envoyée » (2 participants prévenus)', /Réponse envoyée[\s\S]*2 participants prévenus/.test(await p.locator('[data-testid=toast]').innerText().catch(() => '')));
  // Page de résultats de la recherche sur téléphone : filtre Catégorie replié derrière « Filtres ».
  await p.goto(`${WEB}/recherche?q=${S}`);
  await p.locator('[data-testid^=categorie-]').first().waitFor();
  check('recherche (téléphone) : « Filtres » à la place du filtre Catégorie, sans défilement horizontal', (await p.getByRole('button', { name: 'Filtres', exact: true }).isVisible()) && !(await p.getByLabel('Catégorie', { exact: true }).isVisible()) && (await sansDefilementHorizontal(p)));
  await p.getByRole('button', { name: 'Filtres', exact: true }).click();
  await p.getByRole('dialog', { name: 'Filtres' }).getByLabel('Catégorie', { exact: true }).selectOption('taches');
  await p.getByRole('dialog', { name: 'Filtres' }).getByRole('button', { name: 'Appliquer' }).click();
  check('recherche : catégorie « Tâches » seule, bouton « Filtres (1) »', (await p.locator('[data-testid^=categorie-]').count()) === 1 && (await p.getByRole('button', { name: 'Filtres (1)' }).count()) === 1);
  await p.context().close();
  const vu = (await call('agent1', 'GET', `/api/v1/fils/${filId}`)).body;
  check('accusé de lecture : lu par agent2, pas encore par le chef', !!vu.messages[0].lectures.find((l) => l.id === ids.agent2).luLe && !vu.messages[0].lectures.find((l) => l.id === ids.chefssr).luLe);

  console.log('— Préférences de notification (téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  // Étape 9 : préférences dans « Mon profil » (/compte?section=notifications), enregistrement immédiat.
  await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { resumeQuotidien: true, heureResume: 7 });
  await p.goto(`${WEB}/compte?section=notifications`);
  check('résumé quotidien : interrupteur « Résumé quotidien par email »', await p.getByRole('switch', { name: 'Résumé quotidien par email' }).waitFor().then(() => true, () => false));
  await p.getByLabel('Heure du résumé', { exact: true }).selectOption('9');
  check('message « Préférences enregistrées »', await toast(p, 'Préférences enregistrées'));
  check('résumé à 9 h enregistré', (await call('agent1', 'GET', '/api/v1/notifications/preferences')).body.heureResume === 9);
  await p.screenshot({ path: `${E.SHOTS}/n5_preferences_mobile.png`, fullPage: true });
  await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { resumeQuotidien: true, heureResume: 7 });
  await p.context().close();

  console.log('— Instructions de la Direction');
  p = await loginPage(b, 'dn');
  await p.goto(`${WEB}/instructions`);
  await p.getByRole('button', { name: 'Nouvelle instruction', exact: true }).click();
  d = p.getByRole('dialog', { name: 'Nouvelle instruction' });
  const nbEmises = (await call('dn', 'GET', '/api/v1/instructions')).body.emises.length;
  await d.getByRole('button', { name: 'Émettre l’instruction' }).click();
  check('instruction vide : messages sous Objet, Instruction et « Choisissez un destinataire. », rien d’envoyé', (await d.getByText('Choisissez un destinataire.').count()) === 1 && (await d.locator('[data-testid=erreur-champ]').count()) === 3 && (await call('dn', 'GET', '/api/v1/instructions')).body.emises.length === nbEmises);
  await d.getByLabel('Objet', { exact: true }).fill(`Point sur la conjoncture ${S}`);
  await d.getByLabel('Instruction', { exact: true }).fill('Transmettre une note de synthèse avant la fin du mois.');
  const chefDpe = (await call('dn', 'GET', '/api/v1/instructions')).body.personnesPossibles.find((x) => x.id === ids.chefdpe);
  await choisirPersonne(d, 'Destinataire', chefDpe.nom);
  await d.getByLabel(/^Échéance/).fill(jour(10));
  await d.getByRole('button', { name: 'Émettre l’instruction' }).click();
  const emise = p.locator('[data-testid=instruction]', { hasText: `Point sur la conjoncture ${S}` });
  await emise.waitFor();
  check('émise : listée « Émise », message « Instruction émise » nommant le destinataire', /Émise/.test(await emise.innerText()) && (await toast(p, 'Instruction émise')) && (await p.getByTestId('toast').innerText()).includes(chefDpe.nom));
  // Refonte (étape 8) : bande de 4 compteurs, onglets à compteur, circuit, filtres, action « Voir », export Excel.
  const bandeIns = await p.getByRole('region', { name: 'Synthèse des instructions' }).innerText();
  check('bande : En cours, En retard, Exécutées en <année>, Rejetées', ['En cours', 'En retard', `Exécutées en ${new Date().getFullYear()}`, 'avec motif'].every((x) => bandeIns.includes(x)), bandeIns.replace(/\n/g, ' | '));
  check('onglets : « Émises par la Direction » (actif), « Reçues », « Archivées »', (await p.getByRole('tab', { name: /^Émises par la Direction/ }).getAttribute('aria-selected')) === 'true' && (await p.getByRole('tab', { name: /^Reçues/ }).count()) === 1 && (await p.getByRole('tab', { name: /^Archivées/ }).count()) === 1);
  check('circuit rappelé à droite des onglets', /Émise → Reçue → Prise en compte → Exécutée/.test(await p.locator('[data-testid=circuit-instructions]').innerText()));
  check('ligne : action « Voir »', (await emise.getByRole('button', { name: `Voir l’instruction « Point sur la conjoncture ${S} »` }).count()) === 1);
  await p.getByLabel('Statut', { exact: true }).selectOption('EMISE');
  check('filtre Statut « Émise » : l’instruction reste affichée', (await emise.count()) === 1);
  await p.getByLabel('Échéance', { exact: true }).selectOption('sans');
  check('filtre Échéance « Sans échéance » : l’instruction (échéance à 10 jours) est masquée', await p.waitForFunction((o) => ![...document.querySelectorAll('[data-testid=instruction]')].some((e) => e.textContent.includes(o)), `Point sur la conjoncture ${S}`).then(() => true, () => false));
  await p.getByLabel('Échéance', { exact: true }).selectOption('toutes');
  const [xl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exporter' }).click()]);
  check('« Exporter » : classeur Excel des instructions', /^instructions_.*\.xlsx$/.test(xl.suggestedFilename()), xl.suggestedFilename());
  await p.context().close();
  const insId = (await call('dn', 'GET', '/api/v1/instructions')).body.emises.find((i) => i.objet === `Point sur la conjoncture ${S}`).id;

  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/instructions?id=${insId}`);
  const f = p.locator('[data-testid=fiche-instruction]');
  await f.waitFor();
  check('ouverture par le destinataire : Reçue', /reçue le/.test(await f.locator('[data-testid=suivi-instruction]').innerText()));
  await f.getByRole('button', { name: 'Prendre en compte' }).click();
  check('message « Instruction prise en compte »', await toast(p, 'Instruction prise en compte'));
  await f.getByRole('button', { name: 'Marquer exécutée' }).click();
  const fx = p.getByRole('dialog', { name: 'Marquer l’instruction exécutée' });
  await fx.getByRole('button', { name: 'Confirmer l’exécution' }).click();
  check('exécution sans compte rendu : message dans la fenêtre', (await fx.getByText('Rédigez le compte rendu d’exécution.').count()) === 1);
  await fx.getByLabel('Compte rendu d’exécution').fill('Note transmise le jour même.');
  await fx.getByRole('button', { name: 'Confirmer l’exécution' }).click();
  check('message « Instruction exécutée »', await toast(p, 'Instruction exécutée'));
  await p.waitForFunction(() => /exécutée le/.test(document.querySelector('[data-testid=suivi-instruction]')?.textContent ?? ''));
  check('prise en compte puis exécutée, compte rendu affiché', /Note transmise/.test(await f.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n5_instruction_bureau.png` });
  await p.context().close();

  p = await loginPage(b, 'dn', TELEPHONE);
  await p.goto(`${WEB}/instructions`);
  await p.getByRole('tab', { name: /^Archivées/ }).click();
  const archivee = p.locator('[data-testid=instruction]', { hasText: `Point sur la conjoncture ${S}` });
  await archivee.waitFor();
  check('DN : l’instruction exécutée passe dans « Archivées » (pastille « Exécutée »)', /Exécutée/.test(await archivee.innerText()));
  check('téléphone : sans défilement horizontal (instructions)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n5_instructions_mobile.png` });
  await p.context().close();

  p = await loginPage(b, 'agent2');
  await p.goto(`${WEB}/instructions`);
  await p.getByRole('tab', { name: /Reçues/ }).waitFor();
  check('agent : pas d’émission', (await p.getByRole('button', { name: 'Nouvelle instruction', exact: true }).count()) === 0);
  await p.getByRole('tab', { name: /^Reçues/ }).click();
  const vide = p.locator('[data-testid=tableau-instructions]');
  if ((await p.locator('[data-testid=instruction]').count()) === 0)
    check('agent : onglet vide expliqué (sans bouton d’émission)', /apparaît ici dès son émission/.test(await vide.innerText()) && (await vide.getByRole('button', { name: /Nouvelle instruction/ }).count()) === 0);
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
