// S8 — Organisation (Chromium) : schéma (DN, DNA, cellules sur le côté en pointillés, case « auprès du DN »,
// divisions et sections, bord rouge sans responsable, filtres, zoom, fiche au clic), Divisions & Sections,
// Cellules (groupes DN / DNA, nature, rôles) ; l'agent consulte sans action ; liste d'office sur téléphone.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');

(async () => {
  const b = await browser();
  let p = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await p.goto(`${WEB}/organisation`);
  const schema = p.getByTestId('schema-organigramme');
  await schema.waitFor();
  check('schéma par défaut : DN, DNA, case « auprès du DN »', (await schema.getByTestId('case-dn').count()) === 1 && (await schema.getByTestId('case-dna').count()) === 1 && (await schema.getByTestId('case-aupres-dn').count()) === 1);
  check('cellules sur le côté (cases pointillées), divisions sur la barre, sections dessous', (await schema.getByTestId('case-cellule').count()) >= 5 && (await schema.getByTestId('barre-divisions').getByTestId('case-division').count()) >= 1 && (await schema.getByTestId('case-section').count()) >= 1);
  check('cellule en pointillés, division en trait plein', /dashed/.test(await schema.getByTestId('case-cellule').first().evaluate((e) => getComputedStyle(e).borderStyle)) && /solid/.test(await schema.getByTestId('case-division').first().evaluate((e) => getComputedStyle(e).borderStyle)));
  const sansChef = await schema.locator('[data-sans-chef=oui]').count();
  await p.getByRole('group', { name: 'Filtrer les unités' }).getByRole('button', { name: 'Sans responsable' }).click();
  check(`filtre « Sans responsable » : seules les ${sansChef} unités sans responsable restent nettes`, (await schema.locator('[data-testid^=case-]:not([data-sans-chef=oui]).opacity-25').count()) >= 1 || sansChef === 0);
  await p.getByRole('group', { name: 'Filtrer les unités' }).getByRole('button', { name: 'Toutes' }).click();
  await p.getByRole('button', { name: 'Agrandir' }).click();
  check('zoom : 110 %', (await p.getByTestId('zoom').innerText()).includes('110'));
  await p.screenshot({ path: `${E.SHOTS}/s8_organigramme_schema.png`, fullPage: true });
  await schema.getByTestId('case-division').first().click();
  const fiche = p.getByTestId('fiche-unite');
  await fiche.waitFor();
  check('fiche au clic : responsable, suppléance, agents, « Voir les agents », « Changer » ou « Désigner un chef »', /Responsable/.test(await fiche.innerText()) && /Suppléance en cours/.test(await fiche.innerText()) && (await fiche.getByRole('link', { name: 'Voir les agents' }).count()) === 1 && (await fiche.getByRole('button', { name: /Désigner un chef|Changer le chef/ }).count()) === 1);
  await p.keyboard.press('Escape');

  await p.getByRole('tab', { name: 'Divisions & Sections' }).click();
  await p.getByTestId('fiche-division').waitFor();
  check('Divisions & Sections : liste des divisions, fiche avec quatre chiffres et tableau des sections', (await p.getByTestId('liste-divisions').getByRole('button').count()) >= 2 && /Sections actives/.test(await p.getByTestId('fiche-division').innerText()) && (await p.getByTestId('ligne-section').count()) >= 1);
  check('administrateur : « Nouvelle division », « Nouvelle section »', (await p.getByRole('button', { name: 'Nouvelle division' }).count()) === 1 && (await p.getByRole('button', { name: 'Nouvelle section' }).count()) === 1);

  await p.getByRole('tab', { name: 'Cellules' }).click();
  await p.getByTestId('groupe-DN').waitFor();
  check('Cellules : CTSCM et CNC rattachées au DN, SAF à la DNA', /CTSCM/.test(await p.getByTestId('groupe-DN').innerText()) && /CNC/.test(await p.getByTestId('groupe-DN').innerText()) && /SAF/.test(await p.getByTestId('groupe-DNA').innerText()));
  check('CNC : nature « Instance »', /Instance/.test(await p.locator('[data-testid=carte-cellule]', { hasText: 'CNC' }).innerText()));
  await p.screenshot({ path: `${E.SHOTS}/s8_cellules.png`, fullPage: true });
  await p.context().close();

  p = await loginPage(b, 'agent1', { width: 1440, height: 900 });
  await p.goto(`${WEB}/organisation`);
  await p.getByTestId('schema-organigramme').waitFor();
  await p.getByRole('tab', { name: 'Cellules' }).click();
  await p.getByTestId('groupe-DN').waitFor();
  check('agent : consultation sans action (ni menu ⋯, ni « Désigner »)', (await p.getByRole('button', { name: /Plus d’actions|Désigner|Nouvelle cellule/ }).count()) === 0);
  await p.context().close();

  p = await loginPage(b, 'agent1', { width: 390, height: 844 });
  await p.goto(`${WEB}/organisation`);
  await p.locator('[data-testid=unite][data-code=DPE]').first().waitFor();
  check('téléphone : liste automatique (pas de schéma)', (await p.getByTestId('schema-organigramme').count()) === 0);
  await b.close();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
