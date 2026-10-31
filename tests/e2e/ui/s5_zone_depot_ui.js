// S5 — zone de dépôt de fichiers entièrement cliquable (Chromium, bureau) : un clic sur le texte « Glissez
// votre fichier ici », sur l'icône ou dans le cadre ouvre le choix du fichier ; Entrée au clavier aussi ;
// le fichier choisi est bien pris (une seule ouverture par clic).
const { browser, loginPage, check, bilan, WEB } = require('./helpers');

(async () => {
  const b = await browser();
  const p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/documents`);
  await p.getByRole('button', { name: 'Déposer un document', exact: true }).click();
  const dlg = p.getByRole('dialog');
  const zone = dlg.getByTestId('zone-depot');
  await zone.waitFor();
  let ouvertures = 0;
  p.on('filechooser', () => { ouvertures++; });
  const choix = async (action) => {
    const attente = p.waitForEvent('filechooser', { timeout: 5000 }).then(() => true).catch(() => false);
    await action();
    return attente;
  };
  check('clic sur « Glissez votre fichier ici » : choix du fichier ouvert', await choix(() => zone.getByText('Glissez votre fichier ici').click()));
  check('clic sur l’icône : choix du fichier ouvert', await choix(() => zone.getByTestId('zone-depot-icone').click({ force: true })));
  check('clic sur « parcourez votre ordinateur » : choix du fichier ouvert', await choix(() => zone.getByText('parcourez votre ordinateur').click()));
  check('clic dans le cadre (bord) : choix du fichier ouvert', await choix(() => zone.click({ position: { x: 4, y: 4 } })));
  await zone.focus();
  check('clavier : Entrée sur le cadre ouvre le choix du fichier', await choix(() => p.keyboard.press('Enter')));
  check('clavier : Espace aussi', await choix(() => p.keyboard.press(' ')));
  await p.waitForTimeout(300);
  check('une seule ouverture par action (pas de double ouverture)', ouvertures === 6, ouvertures);
  const fc = p.waitForEvent('filechooser');
  await zone.getByText('Glissez votre fichier ici').click();
  await (await fc).setFiles({ name: 'clic_zone.txt', mimeType: 'text/plain', buffer: Buffer.from('zone cliquable') });
  await dlg.getByTestId('fichiers-choisis').waitFor();
  check('fichier choisi par le cadre : pris dans le formulaire', (await dlg.getByTestId('fichiers-choisis').innerText()).includes('clic_zone.txt'));
  check('le libellé « Fichier » ne désigne que le champ (cadre nommé à part)', (await dlg.getByLabel('Fichier', { exact: true }).count()) === 1);
  check('curseur main sur le cadre', (await zone.evaluate((e) => getComputedStyle(e).cursor)) === 'pointer');
  await b.close();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
