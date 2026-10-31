// S6 — jours fériés (Chromium, bureau, administrateur) : navigation ‹ année ›, quatre chiffres, liste par
// mois (Modifier / Supprimer dans le menu ⋯), vue annuelle (12 mini-calendriers), « Vérifier et ajouter »
// prérempli (lundi de Pâques calculé).
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call } = require('../lib');
const E = require('../config');
const AN = 2030;

(async () => {
  for (const j of (await call('admin', 'GET', `/api/v1/jours-feries?annee=${AN}`)).body.jours) await call('admin', 'DELETE', `/api/v1/jours-feries/${j.id}`);
  await call('admin', 'POST', '/api/v1/jours-feries/fetes-fixes', { annee: AN });
  const b = await browser();
  const p = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await p.goto(`${WEB}/leaves?onglet=feries&annee=${AN}`);
  const cal = p.getByTestId('jours-feries');
  await cal.getByTestId('jour-ferie').first().waitFor();
  check(`titre « Jours fériés ${AN} », navigation ‹ année ›, « Préparer ${AN + 1} »`, (await cal.getByTestId('annee-feries').innerText()).includes(String(AN)) && (await cal.getByRole('button', { name: 'Année précédente' }).count()) === 1 && (await cal.getByRole('button', { name: `Préparer ${AN + 1}` }).count()) === 1);
  check('quatre chiffres : prochain, saisis, en semaine, en week-end', /Prochain jour férié[\s\S]*Jours saisis[\s\S]*En semaine[\s\S]*En week-end/.test(await cal.innerText()));
  check('liste groupée par mois, badge « Fête fixe »', /janvier/i.test(await cal.innerText()) && (await cal.getByText('Fête fixe').count()) >= 1);
  const premier = cal.getByTestId('jour-ferie').first();
  await premier.getByRole('button', { name: /Actions sur/ }).click();
  check('menu ⋯ : Modifier et Supprimer', (await p.getByRole('menuitem', { name: 'Modifier' }).count()) === 1 && (await p.getByRole('menuitem', { name: 'Supprimer' }).count()) === 1);
  await p.keyboard.press('Escape');
  await cal.getByRole('button', { name: 'Vérifier et ajouter' }).click();
  const f = p.getByTestId('fenetre-religieuses');
  await f.waitFor();
  check('« Vérifier et ajouter » : lundi de Pâques calculé et prérempli', (await f.locator('#rel-date-LUNDI_PAQUES').inputValue()).length > 0 && /Calculée/.test(await f.innerText()));
  await f.getByRole('button', { name: 'Ajouter les fêtes cochées' }).click();
  await f.waitFor({ state: 'detached' });
  await cal.getByText('Lundi de Pâques').waitFor();
  check('fête cochée ajoutée, badge « Fête religieuse »', (await cal.getByText('Fête religieuse').count()) >= 1);
  await cal.getByRole('button', { name: 'Vue annuelle' }).click();
  await cal.getByTestId('vue-annuelle').waitFor();
  check('vue annuelle : 12 mini-calendriers, fériés colorés', (await cal.getByTestId('vue-annuelle').locator('section').count()) === 12 && (await cal.locator('[data-ferie=FIXE]').count()) === 6 && (await cal.locator('[data-ferie=RELIGIEUX]').count()) >= 1);
  await p.screenshot({ path: `${E.SHOTS}/s6_jours_feries_annee.png`, fullPage: true });
  await b.close();
  for (const j of (await call('admin', 'GET', `/api/v1/jours-feries?annee=${AN}`)).body.jours) await call('admin', 'DELETE', `/api/v1/jours-feries/${j.id}`);
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
