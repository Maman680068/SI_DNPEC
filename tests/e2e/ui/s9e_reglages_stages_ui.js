// S9e — réglages des stages (Chromium) : capacités en tableau (barre d'occupation « n / max », « complet » en
// rouge, limite sur la ligne, « Sans limite », « Afficher toutes les unités »), planning visuel sur six mois
// (trait d'aujourd'hui, barres cliquables vers le stage ; jamais pour l'administrateur), modèle d'attestation
// (aperçu fictif, champs copiables, contrôle avant activation, historique) ; téléphone.
const fs = require('fs');
const { execSync } = require('child_process');
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const TMP = `${E.OUT}/s9e-ui-${S}`;

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  execSync(`python3 -c "import docx; d=docx.Document(); d.add_paragraph('{{NOM_COMPLET}} {{SERVICE}}'); d.save('${TMP}/mauvais.docx')"`);
  execSync(`python3 -c "import docx; d=docx.Document(); d.add_paragraph('Attestation {{NUMERO}} : {{NOM_COMPLET}}, du {{DATE_DEBUT}} au {{DATE_FIN}}.'); d.save('${TMP}/bon-${S}.docx')"`);
  const caps = (await call('drh', 'GET', '/stages/capacites')).body;
  const avait = !!(await call('drh', 'GET', '/stages/modele-attestation')).body.modele;
  const cel = caps.unites.find((u) => u.niveau === 'CELLULE' && u.maximum === null);
  const b = await browser();
  const p = await loginPage(b, 'drh', { width: 1440, height: 900 });
  await p.goto(`${WEB}/stages/parametres`);
  await p.getByTestId('capacites').waitFor();

  console.log('— Capacités');
  const limite = p.getByLabel(`Limite — ${cel.sigle}`, { exact: true });
  if (!(await limite.count())) await p.getByTestId('toutes-unites').click();
  await limite.waitFor();
  check('« Afficher toutes les unités » : chaque unité a sa ligne', (await p.getByTestId('capacite').count()) === caps.unites.length);
  await limite.fill(String(cel.occupation));
  const ligne = p.getByTestId('capacite').filter({ has: limite });
  await ligne.getByRole('button', { name: 'Enregistrer' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Capacité enregistrée' }).waitFor();
  await ligne.getByText('complet').waitFor();
  check(`ligne ${cel.sigle} : « ${cel.occupation} / ${cel.occupation} » et « complet » en rouge`, (await ligne.getByTestId('occupation').innerText()).includes(`${cel.occupation} / ${cel.occupation}`));
  await p.screenshot({ path: `${E.SHOTS}/s9e_capacites_bureau.png` });
  await ligne.getByRole('button', { name: 'Sans limite' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Limite retirée' }).waitFor();
  await ligne.getByText('complet').waitFor({ state: 'detached' });
  check('« Sans limite » : plus de limite ni de « complet »', (await limite.inputValue()) === '');

  console.log('— Planning sur six mois');
  const planning = p.getByTestId('planning');
  await planning.getByRole('heading', { name: /^Planning du/ }).waitFor();
  const barres = planning.getByTestId('barre-periode');
  if (await barres.count()) {
    check('trait d’aujourd’hui sur chaque ligne', (await planning.getByTestId('trait-aujourdhui').count()) === (await planning.getByTestId('planning-unite').count()));
    const href = await barres.first().getAttribute('href');
    await barres.first().click();
    await p.waitForURL(`**${href}`);
    check('clic sur une barre : ouvre le stage', /\/stages\/[^/]+$/.test(href));
    await p.goBack();
    await p.getByTestId('modele').waitFor();
  } else check('planning : aucune période sur six mois, message', /Aucune période/.test(await planning.innerText()));

  console.log('— Modèle d’attestation');
  const modele = p.getByTestId('modele');
  check('14 champs en étiquettes', (await modele.getByTestId('champ-modele').count()) === 14);
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await modele.getByTestId('champ-modele').filter({ hasText: '{{NOM_COMPLET}}' }).click();
  const copie = await modele.getByTestId('champ-modele').filter({ hasText: 'copié' }).waitFor({ timeout: 3000 }).then(() => true, () => false);
  check('clic sur un champ : « copié »', copie);
  const [apercu] = await Promise.all([p.waitForEvent('download'), modele.getByRole('button', { name: 'Aperçu avec un stagiaire fictif' }).click()]);
  check('« Aperçu avec un stagiaire fictif » : fichier téléchargé', fs.statSync(await apercu.path()).size > 100);
  await p.getByLabel('Remplacer le modèle (.docx, ou .pdf à champs)').setInputFiles(`${TMP}/mauvais.docx`);
  await modele.getByTestId('verification-modele').filter({ hasText: 'SERVICE' }).waitFor();
  check('modèle avec un champ inconnu : signalé, « Activer » impossible', await modele.getByRole('button', { name: 'Activer ce modèle' }).isDisabled());
  await p.getByLabel('Remplacer le modèle (.docx, ou .pdf à champs)').setInputFiles(`${TMP}/bon-${S}.docx`);
  await modele.getByTestId('verification-modele').filter({ hasText: 'Modèle valide' }).waitFor();
  await modele.getByRole('button', { name: 'Activer ce modèle' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Modèle importé' }).waitFor();
  await modele.getByText(`bon-${S}.docx`).first().waitFor();
  check('modèle activé ; l’ancien (s’il y en avait un) dans « Modèles précédents »', (await modele.getByTestId('historique-modeles').count()) === (avait ? 1 : 0));
  await p.screenshot({ path: `${E.SHOTS}/s9e_reglages_stages_bureau.png`, fullPage: true });

  console.log('— Administrateur ; téléphone');
  const a = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await a.goto(`${WEB}/stages/parametres`);
  await a.getByTestId('capacites').waitFor();
  check('administrateur : capacités et modèle, aucun planning', (await a.getByTestId('planning').count()) === 0 && (await a.getByTestId('modele').count()) === 1);
  const m = await loginPage(b, 'drh', { width: 390, height: 844 });
  await m.goto(`${WEB}/stages/parametres`);
  await m.getByTestId('capacites').waitFor();
  check('390 px : sans défilement horizontal de la page', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await b.close();
  process.exitCode = bilan() ? 1 : 0;
})().catch(async (e) => { console.error(e); process.exit(2); });
