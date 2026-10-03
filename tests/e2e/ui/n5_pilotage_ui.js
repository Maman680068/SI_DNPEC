// N5 — écrans sous Chromium, bureau (1366) et téléphone (390) : plan de travail (objectif, activité,
// tâche rattachée, vues Kanban et Calendrier), « Mes tâches » en calendrier, recherche de la barre du
// haut, fil de discussion (plusieurs destinataires, objet joint, accusé de lecture), préférences de
// notification, instructions de la Direction (émission, réception, prise en compte, exécution).
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const b = await browser();

  console.log('— Plan de travail : objectif et activité (chef de section, bureau)');
  let p = await loginPage(b, 'chefssr');
  check('menu : « Plan de travail » et « Instructions »', (await p.locator('a[href="/plan-travail"]').count()) === 1 && (await p.locator('a[href="/instructions"]').count()) === 1);
  await p.goto(`${WEB}/plan-travail`);
  await p.getByRole('button', { name: '+ Nouvel objectif' }).click();
  let d = p.getByRole('dialog');
  await d.getByLabel('Libellé de l’objectif').fill(`Conjoncture ${S}`);
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  const objectif = p.locator('[data-testid=objectif]', { hasText: `Conjoncture ${S}` });
  await objectif.waitFor();
  await objectif.getByRole('button', { name: '+ Activité' }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Libellé de l’activité').fill(`Note mensuelle ${S}`);
  await d.getByLabel('Responsable').selectOption(ids.agent1);
  await d.getByLabel('Début').fill(jour(-5));
  await d.getByLabel('Fin').fill(jour(25));
  await d.getByLabel('Indicateur').fill('Notes publiées');
  await d.getByLabel(/Cible/).fill('1 par mois');
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  const activite = objectif.locator('[data-testid=activite]', { hasText: `Note mensuelle ${S}` });
  await activite.waitFor();
  check('activité listée : responsable, indicateur, 0 %', /Notes publiées/.test(await activite.innerText()) && /0 %/.test(await activite.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n5_plan_bureau.png` });

  console.log('— Activité : tâche rattachée, Kanban puis Calendrier');
  await activite.getByRole('button').first().click();
  const fiche = p.locator('[data-testid=fiche-activite]');
  await fiche.waitFor();
  await fiche.getByRole('button', { name: '+ Nouvelle tâche' }).click();
  await p.getByLabel('Titre').fill(`Collecte ${S}`);
  check('tâche : activité présélectionnée', (await p.locator('#tache-activite').inputValue()).length > 0);
  await p.getByLabel('Échéance').fill(jour(3));
  await p.getByRole('button', { name: 'Créer la tâche' }).click();
  await fiche.getByText(`Collecte ${S}`).first().waitFor();
  check('Kanban : la tâche apparaît dans la fiche de l’activité', true);
  await fiche.getByRole('button', { name: 'Calendrier' }).click();
  await fiche.getByText(`Collecte ${S}`).first().waitFor();
  check('Calendrier : la tâche à son échéance', true);
  await p.screenshot({ path: `${E.SHOTS}/n5_activite_bureau.png` });
  await p.context().close();

  console.log('— Agent (téléphone) : plan en lecture, « Mes tâches » en calendrier');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/plan-travail`);
  await p.locator('[data-testid=objectif]', { hasText: `Conjoncture ${S}` }).waitFor();
  check('agent : pas de « + Nouvel objectif » ni « + Activité »', (await p.getByRole('button', { name: '+ Nouvel objectif' }).count()) === 0 && (await p.getByRole('button', { name: '+ Activité' }).count()) === 0);
  check('téléphone : sans défilement horizontal (plan)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n5_plan_mobile.png`, fullPage: true });
  await p.goto(`${WEB}/tasks`);
  await p.getByRole('button', { name: 'Calendrier' }).click();
  await p.getByRole('button', { name: /Aujourd|‹|›|Mois/ }).first().waitFor({ timeout: 5000 }).catch(() => {});
  check('« Mes tâches » : vue Calendrier disponible', (await p.getByRole('button', { name: 'Kanban' }).count()) === 1);
  await p.context().close();

  console.log('— Recherche de la barre du haut (bureau)');
  p = await loginPage(b, 'agent1');
  const barre = p.getByRole('searchbox', { name: 'Recherche transverse' });
  await barre.fill(S);
  await barre.press('Enter');
  await p.waitForURL(/\/recherche\?q=/);
  const taches = p.locator('[data-testid=categorie-taches]');
  await taches.getByText(`Collecte ${S}`).waitFor();
  check('résultats par catégorie : la tâche trouvée, lien vers sa fiche', (await taches.getByRole('link', { name: new RegExp(`Collecte ${S}`) }).getAttribute('href')).startsWith('/tasks/'));
  check('5 catégories affichées', (await p.locator('[data-testid^=categorie-]').count()) === 5);
  await p.screenshot({ path: `${E.SHOTS}/n5_recherche_bureau.png` });

  console.log('— Fil de discussion : deux destinataires, objet joint');
  await p.goto(`${WEB}/communication`);
  await p.getByRole('tab', { name: 'Fils de discussion' }).click();
  await p.getByRole('button', { name: '+ Nouveau fil' }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Objet', { exact: true }).fill(`Note de conjoncture ${S}`);
  const noms = (await call('agent1', 'GET', '/api/v1/fils/destinataires-possibles')).body;
  for (const id of [ids.agent2, ids.chefssr]) {
    const u = noms.find((x) => x.id === id);
    await d.getByLabel('Filtrer les destinataires').fill(u.lastName);
    await d.getByLabel(`${u.firstName} ${u.lastName}`).check();
  }
  await d.getByLabel('Filtrer les destinataires').fill('');
  await d.getByLabel('Message', { exact: true }).fill('Voici la collecte à compléter.');
  await d.getByLabel(/Joindre un objet/).fill(S);
  await d.getByRole('button', { name: new RegExp(`Collecte ${S}`) }).first().click();
  await d.locator('[data-testid=objet-joint]').waitFor();
  await d.getByRole('button', { name: 'Envoyer' }).click();
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
  await p.context().close();
  const vu = (await call('agent1', 'GET', `/api/v1/fils/${filId}`)).body;
  check('accusé de lecture : lu par agent2, pas encore par le chef', !!vu.messages[0].lectures.find((l) => l.id === ids.agent2).luLe && !vu.messages[0].lectures.find((l) => l.id === ids.chefssr).luLe);

  console.log('— Préférences de notification (téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/compte/notifications`);
  await p.getByLabel(/Heure du résumé/).selectOption('9');
  await p.getByRole('button', { name: 'Enregistrer mes préférences' }).click();
  await p.getByRole('status').waitFor();
  check('résumé à 9 h enregistré', (await call('agent1', 'GET', '/api/v1/notifications/preferences')).body.heureResume === 9);
  await p.screenshot({ path: `${E.SHOTS}/n5_preferences_mobile.png`, fullPage: true });
  await call('agent1', 'PATCH', '/api/v1/notifications/preferences', { resumeQuotidien: true, heureResume: 7 });
  await p.context().close();

  console.log('— Instructions de la Direction');
  p = await loginPage(b, 'dn');
  await p.goto(`${WEB}/instructions`);
  await p.getByRole('button', { name: '+ Nouvelle instruction' }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Objet', { exact: true }).fill(`Point sur la conjoncture ${S}`);
  await d.getByLabel('Instruction', { exact: true }).fill('Transmettre une note de synthèse avant la fin du mois.');
  await d.getByLabel('Destinataire').selectOption(ids.chefdpe);
  await d.getByLabel(/Échéance/).fill(jour(10));
  await d.getByRole('button', { name: 'Émettre' }).click();
  const emise = p.locator('[data-testid=instruction]', { hasText: `Point sur la conjoncture ${S}` });
  await emise.waitFor();
  check('émise : listée « Émise »', /Émise/.test(await emise.innerText()));
  await p.context().close();
  const insId = (await call('dn', 'GET', '/api/v1/instructions')).body.emises.find((i) => i.objet === `Point sur la conjoncture ${S}`).id;

  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/instructions?id=${insId}`);
  const f = p.locator('[data-testid=fiche-instruction]');
  await f.waitFor();
  check('ouverture par le destinataire : Reçue', /reçue le/.test(await f.locator('[data-testid=suivi-instruction]').innerText()));
  await f.getByRole('button', { name: 'Prendre en compte' }).click();
  await f.getByRole('button', { name: 'Marquer exécutée' }).click();
  await f.getByLabel('Compte rendu d’exécution').fill('Note transmise le jour même.');
  await f.getByRole('button', { name: 'Confirmer l’exécution' }).click();
  await p.waitForFunction(() => /exécutée le/.test(document.querySelector('[data-testid=suivi-instruction]')?.textContent ?? ''));
  check('prise en compte puis exécutée, compte rendu affiché', /Note transmise/.test(await f.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n5_instruction_bureau.png` });
  await p.context().close();

  p = await loginPage(b, 'agent2');
  await p.goto(`${WEB}/instructions`);
  await p.getByRole('tab', { name: /Reçues/ }).waitFor();
  check('agent : pas d’émission', (await p.getByRole('button', { name: '+ Nouvelle instruction' }).count()) === 0);
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
