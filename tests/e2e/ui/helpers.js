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
// Menu en haut (écran large) : un onglet par groupe du menu, puis les sous-onglets du groupe ouvert ;
// le dossier du personnel, la RH, les stagiaires, l'administration… sont dans le dernier groupe
// (« Personnel et RH » ou « Administration »). Sur téléphone : tiroir du menu, groupe repliable « Plus ».
// Le menu dépend aussi de GET api/v1/navigation (groupe « Modélisation », pastilles) : attendre qu'elle soit lue.
const menuHaut = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  return (await page.locator('[data-testid=menu-haut]').count()) > 0;
};
async function ouvrirGroupe(page, nom) {
  const onglet = page.locator('[data-testid=onglet-groupe]').filter({ hasText: nom }).first();
  if ((await onglet.getAttribute('aria-current')) !== 'true') {
    const vise = await onglet.getAttribute('href');
    await onglet.click();
    await page.waitForURL((u) => u.pathname === vise);
  }
  await page.locator('[data-testid=sous-onglets]').waitFor();
}
async function ouvrirPlus(page) {
  if (await menuHaut(page)) return ouvrirGroupe(page, /^(Personnel et RH|Administration)/);
  const bouton = page.getByRole('button', { name: /^(Personnel et RH|Administration)$/ });
  if ((await bouton.count()) && (await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click();
}
/** Toutes les entrées du menu (liens), groupe par groupe : [{ groupe, label, href }]. */
async function entreesMenu(page) {
  if (await menuHaut(page)) {
    const groupes = await page.locator('[data-testid=onglet-groupe]').allInnerTexts();
    const res = [];
    for (const g of groupes) {
      const nom = g.replace(/\s*\d+\+?$/, '').trim();
      await ouvrirGroupe(page, nom);
      for (const e of await page.locator('[data-testid=sous-onglets] a').evaluateAll((as) => as.map((a) => ({ label: a.innerText.replace(/\s*\d+\+?$/, '').trim(), href: a.getAttribute('href') }))))
        res.push({ groupe: nom, ...e });
    }
    res.push({ groupe: 'Aide', label: 'Aide', href: '/aide' });
    return res;
  }
  if (((await page.getByTestId('tiroir-menu').boundingBox())?.x ?? -1) < 0) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await ouvrirPlus(page);
  return (await page.locator('[data-testid=tiroir-menu] a[href^="/"]').evaluateAll((as) => as.map((a) => ({ label: a.innerText.replace(/\s*\d+\+?$/, '').trim(), href: a.getAttribute('href') }))));
}
/** Ouvre une entrée du menu par son adresse (onglet du groupe puis sous-onglet, ou tiroir). */
async function cliquerMenu(page, href) {
  if (await menuHaut(page)) {
    const sous = page.locator(`[data-testid=sous-onglets] a[href="${href}"]`);
    if (!(await sous.count())) {
      for (const g of await page.locator('[data-testid=onglet-groupe]').allInnerTexts()) {
        await ouvrirGroupe(page, g.replace(/\s*\d+\+?$/, '').trim());
        if (await sous.count()) break;
      }
    }
    await sous.click();
  } else {
    if (((await page.getByTestId('tiroir-menu').boundingBox())?.x ?? -1) < 0) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await ouvrirPlus(page);
    await page.locator(`[data-testid=tiroir-menu] a[href="${href}"]`).click();
  }
  await page.waitForURL((u) => u.pathname === href);
}
/** Liens du menu affichés en ce moment (sous-onglets du groupe ouvert, ou tiroir). */
const liensVisiblesMenu = (page) => page.locator('[data-testid=menu-haut] a[href^="/"], [data-testid=tiroir-menu] a[href^="/"]');
/** Déconnexion : menu du compte (écran large) ou bouton du tiroir (téléphone). */
async function seDeconnecter(page) {
  if (await menuHaut(page)) {
    await page.getByRole('button', { name: 'Mon compte' }).click();
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
  } else {
    if (((await page.getByTestId('tiroir-menu').boundingBox())?.x ?? -1) < 0) await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByTitle('Se déconnecter').click();
  }
}
let ok = 0, ko = 0;
function check(label, cond, detail = '') { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO!'} ${label}${detail ? ' — ' + detail : ''}`); }
function bilan() { console.log(`\nBilan : ${ok} conformes, ${ko} non conformes`); }
module.exports = { browser, loginPage, check, bilan, WEB, ouvrirPlus, ouvrirGroupe, entreesMenu, cliquerMenu, liensVisiblesMenu, seDeconnecter, menuHaut };
