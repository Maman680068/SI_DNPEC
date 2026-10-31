// C2 — administration du courrier dans Chromium (étape 9 : fenêtres au nouveau modèle, gabarit vérifié dans la
// fenêtre, sélecteur de personnes, messages de confirmation).
const E = require('../config');
const { browser, loginPage, check, bilan, WEB, cliquerMenu } = require('./helpers');
const { call, ids } = require('../lib');
const reg = require(E.etat('registres.json'));
const SHOTS = E.SHOTS;
const CODE = 'T' + Date.now().toString(36).slice(-5).toUpperCase();
const dlg = (p) => p.locator('div[role=dialog]:has(> form)');
const champ = (p, label) => dlg(p).getByLabel(label, { exact: true });
const refus = (p) => dlg(p).getByTestId('erreur-formulaire');
const toast = async (p) => { const t = p.getByTestId('toast'); await t.waitFor(); return t.innerText(); };
const an = new Date().getFullYear();
(async () => {
  const b = await browser();
  const dn = await loginPage(b, 'dn');
  await dn.goto(WEB + '/courrier/administration');
  await dn.getByText('Accès non autorisé').waitFor();
  check('non-administrateur : accès non autorisé', await dn.getByText('Accès non autorisé').isVisible());

  const p = await loginPage(b, 'admin');
  p.on('dialog', (d) => d.accept());
  await cliquerMenu(p, '/courrier/administration');
  await p.waitForURL('**/courrier/administration');
  await p.locator('[data-testid=registre]').first().waitFor();
  await p.screenshot({ path: `${SHOTS}/c2_administration_desktop.png` });

  console.log('— Registres : aperçu et validation du gabarit');
  await p.getByRole('button', { name: 'Nouveau registre' }).click();
  await champ(p, 'Code').fill(CODE);
  await champ(p, 'Libellé').fill('Registre de test C2');
  await champ(p, 'Gabarit du numéro').fill('{seq:3}-{code}/{annee}');
  check('aperçu en direct du prochain numéro', (await p.locator('[data-testid=apercu-numero]').innerText()).includes(`001-${CODE}/${an}`), await p.locator('[data-testid=apercu-numero]').innerText());
  await champ(p, 'Gabarit du numéro').fill('{seq:3}-{service}');
  check('variable inconnue signalée dans l’aperçu', (await p.locator('[data-testid=apercu-numero]').innerText()).includes('{service}'));
  await dlg(p).getByRole('button', { name: 'Créer le registre' }).click();
  check('gabarit inconnu : message sous le champ, rien d’envoyé', /inconnues/.test(await dlg(p).getByTestId('erreur-champ').first().innerText()) && (await p.locator('[data-testid=registre]', { hasText: CODE }).count()) === 0);
  await champ(p, 'Gabarit du numéro').fill('{seq:3}-{code}/{annee}');
  await dlg(p).getByRole('button', { name: 'Créer le registre' }).click();
  await p.locator('[data-testid=registre]', { hasText: CODE }).waitFor();
  check('registre créé et listé, toast « Registre … créé »', new RegExp(`Registre ${CODE} créé`).test(await toast(p)));
  const arrCompteur = (await call('admin', 'GET', `/courrier/registres/${reg.ARR}/compteurs`)).body.find((c) => c.annee === an && c.uniteKey === 'DNPEC');
  // S9c : actions de la ligne dans « Plus d’actions ».
  const menuRegistre = async (texte, action) => {
    await p.locator('[data-testid=registre]', { hasText: texte }).getByRole('button', { name: 'Plus d’actions' }).click();
    await p.getByRole('menu').getByRole('menuitem', { name: action }).click();
  };
  await menuRegistre('Courrier arrivée DNPEC', 'Modifier');
  await p.locator('[data-testid=apercu-numero] .font-heading').filter({ hasText: /\d/ }).waitFor();
  const ap = await p.locator('[data-testid=apercu-numero]').innerText();
  check('registre en service : aperçu = compteur réel + 1', ap.includes(String(arrCompteur.dernier + 1).padStart(4, '0')), `${ap.replace(/\n/g, ' ')} (dernier ${arrCompteur.dernier})`);
  await champ(p, 'Portée').selectOption('UNITE');
  await dlg(p).getByRole('button', { name: 'Enregistrer' }).click();
  await refus(p).waitFor();
  check('portée d’un registre utilisé : refus 409 affiché en bas de la fenêtre', /figées/.test(await refus(p).innerText()), await refus(p).innerText());
  await dlg(p).getByRole('button', { name: 'Annuler' }).click();

  console.log('— Habilitations');
  await p.getByRole('tab', { name: 'Habilitations' }).click();
  await p.locator('[data-testid=habilitation]').first().waitFor();
  const accorder = async () => {
    await p.getByRole('button', { name: 'Accorder une habilitation' }).click();
    await dlg(p).getByRole('combobox', { name: 'Personne' }).fill('AGENT2');
    await dlg(p).getByRole('option', { name: /AGENT2/ }).first().click();
    await champ(p, 'Registre').selectOption({ label: (await champ(p, 'Registre').locator('option').allInnerTexts()).find((t) => /^ARRU/.test(t)) });
    await champ(p, 'Unité').selectOption({ label: (await champ(p, 'Unité').locator('option').allInnerTexts()).find((t) => /Études/.test(t)) });
    await dlg(p).getByRole('button', { name: 'Accorder' }).click();
  };
  await accorder();
  await p.locator('[data-testid=habilitation]', { hasText: 'AGENT2' }).first().waitFor();
  check('toast « Habilitation accordée »', /Habilitation accordée/.test(await toast(p)));
  check('habilitation accordée (AGENT2, ARRU, Division Études)', (await p.locator('[data-testid=habilitation]', { hasText: 'AGENT2' }).first().innerText()).includes('ARRU'));
  await accorder();
  await refus(p).waitFor();
  check('habilitation en double : refus 409 affiché', /déjà habilitée/.test(await refus(p).innerText()));
  await dlg(p).getByRole('button', { name: 'Annuler' }).click();
  await p.locator('[data-testid=habilitation]', { hasText: 'AGENT2' }).first().getByRole('button', { name: 'Révoquer' }).click();
  // Plus aucune habilitation active d'AGENT2 (bouton « Révoquer ») ; attente du rechargement.
  const actives = p.locator('[data-testid=habilitation]', { hasText: 'AGENT2' }).filter({ has: p.getByRole('button', { name: 'Révoquer' }) });
  await actives.first().waitFor({ state: 'detached' });
  check('habilitation révoquée, passée dans l’historique de son registre', (await actives.count()) === 0 && (await p.locator('[data-testid=habilitations-registre]', { hasText: 'ARRU' }).getByText(/Historique/).count()) === 1);

  console.log('— Compteurs (S9c : dans le menu de chaque registre)');
  await p.getByRole('tab', { name: /Registres et numérotation/ }).click();
  await p.locator('[data-testid=registre]', { hasText: CODE }).waitFor();
  await menuRegistre(CODE, 'Voir les compteurs');
  await p.getByText('Aucun numéro encore attribué dans ce registre.').waitFor();
  await p.getByRole('dialog').getByRole('button', { name: /Fermer|Annuler/ }).first().click();
  await menuRegistre(CODE, 'Reprise d’un compteur');
  check('reprise : avertissement affiché', (await dlg(p).innerText()).includes('reprendre la numérotation papier'));
  await champ(p, 'Dernier numéro attribué').fill('41');
  check('reprise : aperçu du prochain numéro', (await p.locator('[data-testid=apercu-reprise]').innerText()).includes(`042-${CODE}/${an}`), await p.locator('[data-testid=apercu-reprise]').innerText());
  await dlg(p).getByRole('button', { name: 'Enregistrer la reprise' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Reprise enregistrée' }).waitFor();
  check('toast « Reprise enregistrée »', true);
  const ligneCode = p.locator('[data-testid=registre]', { hasText: CODE });
  await ligneCode.locator('[data-testid=prochain-numero]', { hasText: `042-${CODE}/${an}` }).waitFor();
  check('ligne : prochain numéro 042 et 41 numéros cette année', (await ligneCode.getByTestId('numeros-annee').innerText()).includes('41 numéro'));
  await menuRegistre(CODE, 'Voir les compteurs');
  await p.locator('[data-testid=compteur]').first().waitFor();
  check('compteur repris affiché (41)', (await p.locator('[data-testid=compteur]').first().innerText()).includes('41'));
  await p.getByRole('dialog').getByRole('button', { name: /Fermer|Annuler/ }).first().click();
  await menuRegistre('Courrier arrivée DNPEC', 'Reprise d’un compteur');
  await champ(p, 'Dernier numéro attribué').fill('5');
  await dlg(p).getByRole('button', { name: 'Enregistrer la reprise' }).click();
  await refus(p).waitFor();
  check('reprise sur un registre déjà numéroté : refus 409 affiché', /reprise impossible/.test(await refus(p).innerText()));
  await dlg(p).getByRole('button', { name: 'Annuler' }).click();

  const m = await loginPage(b, 'admin', { width: 390, height: 844 });
  await m.goto(WEB + '/courrier/administration');
  await m.locator('[data-testid=registre]').first().waitFor();
  check('mobile 390 px : pas de défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.screenshot({ path: `${SHOTS}/c2_administration_mobile.png` });
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
