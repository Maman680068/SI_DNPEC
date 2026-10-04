// G4 — page /aide sous Chromium : chaque profil ne voit que ses guides (et « Premiers pas »),
// captures chargées, lien « Aide » dans le menu (stagiaire compris), mobile sans défilement.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const MOBILE = { width: 390, height: 844 };
const guidesVus = async (p) => (await p.locator('article[data-testid^="guide-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('guide-', '')))).sort();
(async () => {
  const b = await browser();
  const attendus = {
    agent1: ['charge-etudes', 'premiers-pas'],
    chefssr: ['chef-section', 'premiers-pas'],
    chefdpe: ['chef-division-cellule', 'premiers-pas'],
    dn: ['direction', 'premiers-pas'],
    drh: ['drh', 'premiers-pas'],
    admin: ['administrateur', 'premiers-pas'],
    secdg: ['charge-etudes', 'premiers-pas', 'secretariat-courrier'],
  };
  for (const [k, g] of Object.entries(attendus)) {
    const p = await loginPage(b, k);
    await p.getByRole('link', { name: 'Aide' }).click();
    await p.locator('article[data-testid^="guide-"]').first().waitFor();
    const vus = await guidesVus(p);
    check(`${k} : guides ${vus.join(', ')}`, JSON.stringify(vus) === JSON.stringify(g.sort()));
    if (k === 'agent1') {
      const images = p.locator('article img');
      await images.last().scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      const ok = await images.evaluateAll((els) => els.every((i) => i.complete && i.naturalWidth > 0));
      check(`captures chargées (${await images.count()})`, ok);
      await p.screenshot({ path: `${require('../config').SHOTS}/g4_aide_agent_desktop.png`, fullPage: false });
    }
    await p.context().close();
  }
  const m = await loginPage(b, 'agent1', MOBILE);
  // Étape 9 : squelette pendant le chargement des profils (réponse retardée), plus de « Chargement… ».
  await m.route('**/aide/profils', async (r) => { await new Promise((x) => setTimeout(x, 800)); await r.continue(); });
  await m.goto(`${WEB}/aide`);
  await m.getByRole('heading', { name: 'Guides d’utilisation' }).waitFor();
  check('chargement : squelette, sans « Chargement… »', (await m.locator('[data-testid=squelette]').count()) === 1 && (await m.getByText('Chargement…').count()) === 0);
  await m.locator('article').first().waitFor();
  check('mobile : pas de défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
