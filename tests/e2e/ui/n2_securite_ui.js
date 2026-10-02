// N2 — écrans de sécurité sous Chromium, bureau (1366) et téléphone (390) : réauthentification avant
// le niveau 2 du dossier du personnel (mot de passe faux puis juste), journal d'audit (portée,
// vérification d'intégrité), « Paramétrage et supervision » (paramètre modifié par l'administrateur,
// lecture seule pour le DN, services, test de restauration déclaré), menus selon le rôle.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const b = await browser();

  console.log('— Réauthentification (bureau)');
  let p = await loginPage(b, 'agent1');
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
  check('menu Administration : « Paramétrage et supervision » et « Journal d’audit »', (await p.locator('a[href="/parametrage"]').count()) === 1 && (await p.locator('a[href="/journal-audit"]').count()) === 1);
  await p.goto(`${WEB}/parametrage`);
  await p.locator('[data-testid=parametre]').first().waitFor();
  check('6 paramètres affichés avec leurs bornes', (await p.locator('[data-testid=parametre]').count()) === 6 && /Bornes : 6 à 36 mois/.test(await p.locator('[data-cle="connexions.conservationMois"]').innerText()));
  await p.locator('[data-cle="connexions.conservationMois"]').getByRole('button', { name: 'Modifier' }).click();
  const fp = p.getByRole('dialog', { name: 'Conservation des journaux de connexion' });
  await fp.getByLabel(/Valeur/).fill('40');
  await fp.getByRole('button', { name: 'Enregistrer' }).click();
  await fp.getByRole('alert').waitFor();
  check('valeur hors bornes : refus du serveur affiché', /entre 6 et 36/.test(await fp.getByRole('alert').innerText()));
  await fp.getByLabel(/Valeur/).fill('24');
  await fp.getByRole('button', { name: 'Enregistrer' }).click();
  await fp.waitFor({ state: 'detached' });
  check('valeur enregistrée : 24 mois, « modifié par »', /24\s*mois/.test(await p.locator('[data-cle="connexions.conservationMois"] [data-testid=valeur]').innerText()) && /modifié le/.test(await p.locator('[data-cle="connexions.conservationMois"]').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n2_parametres_bureau.png`, fullPage: true });
  await p.getByRole('tab', { name: 'Supervision' }).click();
  await p.locator('[data-testid=service]').first().waitFor();
  check('supervision : 7 services (dont espace disque et taille de la base), base nominale, emails dégradés (sans serveur d’envoi)', (await p.locator('[data-testid=service]').count()) === 7 && /NOMINAL/.test(await p.locator('[data-cle=base]').innerText()) && /DÉGRADÉ/.test(await p.locator('[data-cle=email]').innerText()));
  await p.getByRole('button', { name: 'Déclarer un test de restauration' }).click();
  const ft = p.getByRole('dialog', { name: 'Test de restauration' });
  await ft.getByLabel('Commentaire (facultatif)').fill('Restauration vérifiée sur une base de test');
  await ft.getByRole('button', { name: 'Déclarer' }).click();
  await ft.waitFor({ state: 'detached' });
  await p.waitForFunction(() => /réussi/.test(document.querySelector('[data-testid=sauvegardes]')?.textContent ?? ''));
  check('test de restauration déclaré : affiché « réussi »', true);
  await p.screenshot({ path: `${E.SHOTS}/n2_supervision_bureau.png`, fullPage: true });
  await p.goto(`${WEB}/journal-audit`);
  await p.getByRole('button', { name: 'Vérifier l’intégrité' }).click();
  await p.locator('[data-testid=verification-audit]').waitFor();
  check('vérification d’intégrité : chaîne intacte', /Chaîne intacte/.test(await p.locator('[data-testid=verification-audit]').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n2_journal_bureau.png` });
  await p.context().close();
  await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 12 });

  console.log('— DN : lecture seule');
  p = await loginPage(b, 'dn');
  await p.goto(`${WEB}/parametrage`);
  await p.locator('[data-testid=parametre]').first().waitFor();
  check('DN : paramètres lisibles, aucun bouton « Modifier »', (await p.locator('[data-testid=parametre]').getByRole('button', { name: 'Modifier' }).count()) === 0);
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
  await p.screenshot({ path: `${E.SHOTS}/n2_journal_mobile.png` });
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
