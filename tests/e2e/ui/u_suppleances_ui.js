// Suppléances (Chromium, bureau) : onglet « Toutes les suppléances en cours » pour le DN (droit donné par
// l'API), tableau en lecture seule ; un chef n'a pas l'onglet.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');
const t = (n) => new Date(Date.now() + n).toISOString();

(async () => {
  const s = (await call('chefsfp', 'POST', '/suppleances', { titulaireId: ids.chefsfp, suppleantId: ids.chefssr, startDate: t(-60e3), endDate: t(2 * 864e5) })).body;
  const b = await browser();
  let p = await loginPage(b, 'dn', { width: 1440, height: 900 });
  await p.goto(`${WEB}/suppleances`);
  await p.getByRole('tab', { name: 'Toutes les suppléances en cours' }).click();
  const tableau = p.getByTestId('suppleances-en-cours');
  await tableau.waitFor();
  const ligne = tableau.locator('[data-testid=suppleance-en-cours]').first();
  await ligne.waitFor();
  check('DN : onglet et tableau (unité, titulaire, suppléant, période, statut)', (await tableau.getByRole('columnheader').allInnerTexts()).join('|') === 'Unité|Titulaire|Suppléant|Période|Statut' && /En cours/.test(await tableau.innerText()));
  check('lecture seule : aucun bouton dans le tableau, pas de « Désigner un suppléant »', (await tableau.getByRole('button').count()) === 0 && (await p.getByRole('button', { name: 'Désigner un suppléant' }).count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/u_suppleances_toutes.png`, fullPage: true });
  await p.goto(`${WEB}/suppleances?onglet=toutes`);
  await p.getByTestId('suppleances-en-cours').waitFor();
  check('lien ?onglet=toutes : onglet ouvert', (await p.getByRole('tab', { name: 'Toutes les suppléances en cours' }).getAttribute('aria-selected')) === 'true');
  await p.context().close();
  p = await loginPage(b, 'chefssr', { width: 1440, height: 900 });
  await p.goto(`${WEB}/suppleances?onglet=toutes`);
  await p.getByRole('heading', { name: 'Mes intérims' }).waitFor();
  check('chef : pas d’onglet ni de vue d’ensemble', (await p.getByRole('tab', { name: 'Toutes les suppléances en cours' }).count()) === 0 && (await p.getByTestId('suppleances-en-cours').count()) === 0);
  await p.context().close();
  await call('chefsfp', 'POST', `/suppleances/${s.id}/revoke`);
  await b.close();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
