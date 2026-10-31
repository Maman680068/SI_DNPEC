// S2 — messagerie (Chromium, bureau) : dès le clic dans « Nouveau message », correspondants récents puis
// tout le personnel ; filtrage à chaque lettre sans accents (lettres trouvées en gras) ; une personne avec
// qui une conversation existe ouvre cette conversation.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);

(async () => {
  const u = (await call('admin', 'POST', '/users', { email: `s2ui${S}@test.local`, password: 'Password123!', firstName: 'Fatoumata', lastName: `Sôw${L}`, role: 'AGENT', jobTitle: 'Économiste', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  await call('agent1', 'POST', '/messages', { recipientId: u.id, body: `Premier échange ${S}` });
  const b = await browser();
  const p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/communication`);
  await p.getByRole('button', { name: 'Nouveau message' }).click();
  const champ = p.getByRole('combobox', { name: /Nouvelle conversation/ });
  await champ.click();
  const liste = p.getByRole('listbox', { name: 'Destinataires possibles' });
  await liste.waitFor();
  await liste.getByTestId('personne-trouvee').first().waitFor();
  check('dès le clic : « Récents » puis « Tout le personnel »', /Récents/i.test(await liste.innerText()) && /Tout le personnel/i.test(await liste.innerText()));
  check('premier récent : la dernière personne écrite (initiales, nom, fonction, unité)', /Fatoumata Sôw/.test(await liste.getByTestId('personne-trouvee').first().innerText()) && /Économiste · SSR/.test(await liste.getByTestId('personne-trouvee').first().innerText()));
  await champ.pressSequentially(`sow${L.toLowerCase().slice(0, 3)}`, { delay: 40 });
  await p.waitForFunction(() => document.querySelectorAll('[data-testid=personne-trouvee]').length === 1, null, { timeout: 5000 }).catch(() => {});
  const lignes = liste.getByTestId('personne-trouvee');
  check('à chaque lettre : liste filtrée, « sow… » sans accent trouve « Sôw… »', (await lignes.count()) === 1 && /Fatoumata Sôw/.test(await lignes.first().innerText()), await lignes.count());
  check('lettres trouvées en gras', /^Sôw/i.test((await lignes.first().locator('b').first().innerText()).trim()));
  await lignes.first().click();
  await p.locator('[data-testid=echange]').waitFor();
  await p.getByText(`Premier échange ${S}`).waitFor({ timeout: 5000 }).catch(() => {});
  check('conversation existante : ouverte avec son historique', (await p.getByText(`Premier échange ${S}`).count()) >= 1);
  await b.close();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
