// Écrans du paramétrage : réglages des stages par l'administrateur (sans planning) et le DRH,
// modèle par défaut affiché, renommage d'une catégorie logistique.
const { browser, loginPage, check, bilan, WEB, ouvrirPlus } = require('./helpers');
const E = require('../config');
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
(async () => {
  const b = await browser();
  const adm = await loginPage(b, 'admin');
  await ouvrirPlus(adm);
  await adm.locator('a[href="/stages/parametres"]').click();
  await adm.getByRole('heading', { name: 'Réglages des stages' }).waitFor();
  // S9e : une ligne par unité, limite modifiable sur la ligne.
  await adm.getByTestId('capacites').getByLabel('Limite — DPE', { exact: true }).waitFor();
  check('admin : capacités affichées et modifiables', (await adm.getByLabel('Limite — DPE', { exact: true }).inputValue()) !== '');
  check('admin : aucun planning, aucun lien vers les stages', (await adm.getByTestId('planning').count()) === 0 && (await adm.getByRole('link', { name: '← Stagiaires' }).count()) === 0);
  { const t = await adm.getByTestId('modele').innerText(); check('admin : modèle actif affiché (importé à l’écran après le paramétrage)', /Mon modele.docx/.test(t) && /importé le .* par ADMIN Test/.test(t), t.slice(0, 160)); }
  await adm.screenshot({ path: `${SHOTS}/p_reglages_stages_admin.png`, fullPage: true });
  await adm.goto(`${WEB}/logistique/administration`);
  const ligne = adm.getByTestId('categorie').filter({ hasText: 'Mobilier' }).first();
  // S9d : « Renommer » dans le menu de la ligne.
  await ligne.getByRole('button', { name: 'Plus d’actions' }).click();
  await adm.getByRole('menu').getByRole('menuitem', { name: 'Renommer' }).click();
  // Étape 9 : renommage dans une fenêtre ; message de confirmation (toast).
  const fr = adm.locator('div[role=dialog]:has(> form)');
  await fr.getByLabel('Nouveau libellé', { exact: true }).fill(`Mobilier et rangement ${S}`);
  await fr.getByRole('button', { name: 'Enregistrer' }).click();
  await adm.getByTestId('toast').filter({ hasText: 'Catégorie renommée' }).waitFor();
  // Le message peut précéder le rechargement de la liste : attendre le nouveau libellé.
  const renommee = await adm.getByTestId('categorie').getByText(`Mobilier et rangement ${S}`).waitFor({ timeout: 10000 }).then(() => true, () => false);
  check('catégorie renommée à l’écran', renommee && (await adm.getByTestId('categorie').getByText(`Mobilier et rangement ${S}`).count()) === 1);
  const drh = await loginPage(b, 'drh');
  await drh.goto(`${WEB}/stages/parametres`);
  await drh.getByTestId('planning').waitFor();
  check('DRH : capacités et planning', (await drh.getByLabel('Limite — DPE', { exact: true }).count()) === 1);
  await b.close(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
