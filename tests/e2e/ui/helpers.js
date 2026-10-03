// Aides Playwright jetables (hors dépôt).
const { chromium } = require('playwright');
const WEB = 'http://localhost:3100';
// Chromium : PW_CHROMIUM si fourni, sinon celui installé par « playwright install ».
async function browser() { return chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); }
async function loginPage(b, key, viewport = { width: 1366, height: 860 }) {
  const ctx = await b.newContext({ viewport, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('   [erreur page]', e.message));
  await page.goto(WEB + '/login');
  await page.getByLabel('Adresse e-mail').fill(`${key}@test.local`);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: /connecter/i }).click();
  await page.waitForURL('**/dashboard');
  return page;
}
// Refonte de l'interface : dossier du personnel, RH, stagiaires, administration… sont dans le groupe
// repliable « Plus » du menu ; l'ouvrir avant d'y cliquer un lien.
async function ouvrirPlus(page) {
  const bouton = page.getByRole('button', { name: /^(Personnel et RH|Administration)$/ });
  if ((await bouton.count()) && (await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click();
}
let ok = 0, ko = 0;
function check(label, cond, detail = '') { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO!'} ${label}${detail ? ' — ' + detail : ''}`); }
function bilan() { console.log(`\nBilan : ${ok} conformes, ${ko} non conformes`); }
module.exports = { browser, loginPage, check, bilan, WEB, ouvrirPlus };
