// Écrans du paramétrage : réglages des stages par l'administrateur (sans planning) et le DRH,
// modèle par défaut affiché, renommage d'une catégorie logistique.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
(async () => {
  const b = await browser();
  const adm = await loginPage(b, 'admin');
  await adm.locator('a[href="/stages/parametres"]').click();
  await adm.getByRole('heading', { name: 'Réglages des stages' }).waitFor();
  await adm.getByTestId('capacites').getByText(/Division Prévisions : /).waitFor();
  check('admin : capacités affichées et modifiables', (await adm.getByRole('button', { name: 'Fixer la capacité' }).count()) === 1);
  check('admin : aucun planning, aucun lien vers les stages', (await adm.getByTestId('planning').count()) === 0 && (await adm.getByRole('link', { name: '← Stagiaires' }).count()) === 0);
  { const t = await adm.getByTestId('modele').innerText(); check('admin : modèle actif affiché (importé à l’écran après le paramétrage)', /Mon modele.docx/.test(t) && /importé le .* par ADMIN Test/.test(t), t.slice(0, 160)); }
  await adm.screenshot({ path: `${SHOTS}/p_reglages_stages_admin.png`, fullPage: true });
  await adm.goto(`${WEB}/logistique/administration`);
  const ligne = adm.getByTestId('categorie').filter({ hasText: 'Mobilier' }).first();
  await ligne.getByRole('button', { name: 'Renommer' }).click();
  await adm.getByLabel('Nouveau libellé de MOB').fill(`Mobilier et rangement ${S}`);
  await adm.getByTestId('categorie').filter({ has: adm.getByLabel('Nouveau libellé de MOB') }).getByRole('button', { name: 'Enregistrer' }).click();
  await adm.getByText('Catégorie renommée.').waitFor();
  check('catégorie renommée à l’écran', (await adm.getByText(`Mobilier et rangement ${S}`).count()) === 1);
  const drh = await loginPage(b, 'drh');
  await drh.goto(`${WEB}/stages/parametres`);
  await drh.getByTestId('planning').waitFor();
  check('DRH : capacités et planning', (await drh.getByRole('button', { name: 'Fixer la capacité' }).count()) === 1);
  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
