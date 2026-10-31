// S3 — messagerie (Chromium, bureau) : trombone à deux choix ; « Depuis mon ordinateur » envoie un PDF,
// « Télécharger » le récupère, « Classer dans les Archives » ouvre le dépôt normal avec le fichier ;
// « Depuis les Archives » liste les documents dès l'ouverture.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { ids } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const PDF = Buffer.from(`%PDF-1.4\n% essai ${S}\n%%EOF\n`);

(async () => {
  const b = await browser();
  const p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/communication?with=${ids.agent2}`);
  await p.locator('[data-testid=echange]').waitFor();
  const joindre = p.getByRole('button', { name: 'Joindre', exact: true });
  await joindre.waitFor();
  await joindre.click();
  const menu = p.getByTestId('menu-joindre');
  check('trombone : « Depuis mon ordinateur » et « Depuis les Archives »', (await menu.getByRole('menuitem').allInnerTexts()).map((t) => t.trim()).join('|') === 'Depuis mon ordinateur|Depuis les Archives');
  const fc = p.waitForEvent('filechooser');
  await menu.getByRole('menuitem', { name: 'Depuis mon ordinateur' }).click();
  await (await fc).setFiles({ name: `Rapport_${S}.pdf`, mimeType: 'application/pdf', buffer: PDF });
  await p.getByTestId('fichier-joint').waitFor();
  check('fichier choisi rappelé avant l’envoi', (await p.getByTestId('fichier-joint').innerText()).includes(`Rapport_${S}.pdf`));
  await p.getByRole('button', { name: 'Envoyer' }).click();
  const carte = p.locator('[data-testid=piece-jointe]', { hasText: `Rapport_${S}.pdf` });
  await carte.waitFor();
  check('message envoyé : pièce jointe avec « Télécharger » et « Classer dans les Archives »', (await carte.getByRole('button', { name: 'Télécharger' }).count()) === 1 && (await carte.getByRole('button', { name: 'Classer dans les Archives' }).count()) === 1);
  const dl = p.waitForEvent('download');
  await carte.getByRole('button', { name: 'Télécharger' }).click();
  const fichier = await dl;
  check('« Télécharger » : le fichier arrive sous son nom', fichier.suggestedFilename() === `Rapport_${S}.pdf`);
  await carte.getByRole('button', { name: 'Classer dans les Archives' }).click();
  const depot = p.getByTestId('fenetre-depot');
  await depot.waitFor();
  check('« Classer dans les Archives » : dépôt normal, fichier déjà choisi, titre proposé', (await depot.getByTestId('fichiers-choisis').innerText()).includes(`Rapport_${S}.pdf`) && (await depot.getByLabel('Titre', { exact: true }).inputValue()) === `Rapport_${S}`);
  await depot.getByRole('button', { name: 'Annuler' }).click();
  await joindre.click();
  await p.getByRole('menuitem', { name: 'Depuis les Archives' }).click();
  const choix = p.getByTestId('choix-document');
  await choix.waitFor();
  check('« Citer un document des Archives » : titre du panneau', /Citer un document des Archives/.test(await choix.innerText()));
  await choix.getByTestId('document-a-citer').first().waitFor({ timeout: 8000 }).catch(() => {});
  check('liste dès l’ouverture, avec emplacement', (await choix.getByTestId('document-a-citer').count()) > 0 && /Archives/.test(await choix.getByTestId('document-a-citer').first().innerText()));
  await b.close();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
