// C2 — contrôle des dates dans les fenêtres Enregistrer et Corriger (Chromium).
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const SHOTS = E.SHOTS;
const dlg = (p) => p.locator('form[role=dialog]');
const champ = (p, label) => dlg(p).getByLabel(label, { exact: true });
const jour = (dj) => { const d = new Date(Date.now() + dj * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const S = Date.now().toString(36);
(async () => {
  const b = await browser();
  for (const [vp, suffixe] of [[undefined, 'desktop'], [{ width: 390, height: 844 }, 'mobile']]) {
    const p = await loginPage(b, 'secdg', vp);
    await p.goto(WEB + '/courrier?onglet=arrivees');
    await p.getByRole('button', { name: '+ Enregistrer un courrier' }).click();
    await champ(p, 'Expéditeur').fill('Ministère du Plan');
    await champ(p, 'Objet').fill(`Dates UI ${suffixe} ${S}`);
    check(`${suffixe} : dates normales, pas d’avertissement`, (await p.locator('[data-testid=controle-dates]').count()) === 0);
    await champ(p, 'Date de réception').fill(jour(2));
    await p.locator('[data-testid=controle-dates]').waitFor();
    check(`${suffixe} : réception future → avertissement, motif masqué`, /dans le futur/.test(await p.locator('[data-testid=controle-dates]').innerText()) && (await champ(p, 'Motif de la dérogation (obligatoire)').count()) === 0);
    if (suffixe === 'desktop') {
      await dlg(p).getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await dlg(p).getByRole('alert').waitFor();
      check('sans confirmation : refus 400 de l’API affiché', /réception est dans le futur/.test(await dlg(p).getByRole('alert').innerText()), await dlg(p).getByRole('alert').innerText());
    }
    await dlg(p).getByLabel('Je confirme cette date').check();
    check(`${suffixe} : case cochée → champ motif obligatoire`, await champ(p, 'Motif de la dérogation (obligatoire)').evaluate((e) => e.required));
    await dlg(p).getByRole('button', { name: 'Enregistrer', exact: true }).click();
    check(`${suffixe} : motif vide → formulaire bloqué`, await champ(p, 'Motif de la dérogation (obligatoire)').evaluate((e) => !e.checkValidity()));
    await champ(p, 'Motif de la dérogation (obligatoire)').fill('Remis par porteur avant la date inscrite.');
    await p.screenshot({ path: `${SHOTS}/c2_dates_derogation_${suffixe}.png` });
    await dlg(p).getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await p.waitForURL(/arrivee=/);
    await p.locator('[data-testid=derogation-date]').waitFor();
    check(`${suffixe} : enregistré, fiche avec la dérogation et son motif`, (await p.locator('[data-testid=derogation-date]').innerText()).includes('Remis par porteur'));
    if (suffixe === 'desktop') {
      await p.getByRole('button', { name: 'Corriger' }).click();
      await champ(p, 'Date de réception').fill(jour(-5));
      await champ(p, 'Date du courrier').fill(jour(-2));
      await p.locator('[data-testid=controle-dates]').waitFor();
      check('correction : courrier daté après la réception → avertissement', /postérieure/.test(await p.locator('[data-testid=controle-dates]').innerText()));
      await dlg(p).getByRole('button', { name: 'Enregistrer la correction' }).click();
      await dlg(p).getByRole('alert').waitFor();
      check('correction sans confirmation : refus 400 affiché', /postérieure/.test(await dlg(p).getByRole('alert').innerText()));
      await dlg(p).getByLabel('Je confirme cette date').check();
      await champ(p, 'Motif de la dérogation (obligatoire)').fill('Date de l’original vérifiée.');
      await dlg(p).getByRole('button', { name: 'Enregistrer la correction' }).click();
      await p.locator('[data-testid=derogation-date]', { hasText: 'Date de l’original vérifiée.' }).waitFor();
      check('correction avec dérogation : nouveau motif affiché', true);
      await p.getByRole('button', { name: 'Corriger' }).click();
      await champ(p, 'Date du courrier').fill(jour(-6));
      check('correction qui supprime l’anomalie : plus d’avertissement', (await p.locator('[data-testid=controle-dates]').count()) === 0);
      await dlg(p).getByRole('button', { name: 'Enregistrer la correction' }).click();
      await p.locator('[data-testid=derogation-date]').waitFor({ state: 'detached' });
      check('… mention de dérogation retirée de la fiche', true);
    } else {
      check('mobile : pas de défilement horizontal', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    }
  }
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
