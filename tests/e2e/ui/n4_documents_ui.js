// N4 — écrans sous Chromium, bureau (1366) et téléphone (390) : dépôt dans la GED avec les
// métadonnées obligatoires (refonte : dossier, glisser-déposer, tableau, bandeau « à valider », fenêtre
// du document), statut de diffusion (marquer final, valider, historique), dépôt direct
// depuis une tâche, écran « Documents générés » (attestation de travail : aperçu fidèle et Word ;
// ordre de mission avec frais en toutes lettres ; rapport d'activité sur téléphone). Étape 9 : fenêtres au
// nouveau modèle (zone de dépôt, dates en français, sélecteur de personnes), champs vérifiés dans la fenêtre,
// messages de confirmation, filtres repliés sur téléphone.
const fs = require('fs');
const path = require('path');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const dlg = (p) => p.locator('div[role=dialog]:has(> form)');
const toast = async (p) => { const t = p.getByTestId('toast'); await t.waitFor(); return t.innerText(); };
async function choisirPersonne(p, label, nom) {
  await dlg(p).getByRole('combobox', { name: label, exact: true }).fill(nom);
  await dlg(p).getByRole('option', { name: new RegExp(nom) }).first().click();
}

(async () => {
  const b = await browser();
  const fichier = path.join(E.OUT, 'tmp', `note_${S}.txt`);
  fs.writeFileSync(fichier, `Note de conjoncture ${S}`);

  console.log('— GED : dossier, glisser-déposer, dépôt avec métadonnées (bureau)');
  let p = await loginPage(b, 'agent1');
  // Squelette pendant la lecture de la liste (réponse de l'API retardée une fois).
  await p.route((u) => u.pathname === '/documents' && u.searchParams.has('visibility'), async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue().catch(() => undefined); }, { times: 1 });
  await p.goto(`${WEB}/documents`);
  check('chargement de la liste : squelette à la place de « Chargement… »', await p.getByTestId('squelette').first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  const arbre = p.locator('[data-testid=arborescence-dossiers]');
  await arbre.getByRole('button', { name: /Tous les documents/ }).waitFor();
  await p.getByRole('tab', { name: /^Espace de la Division/ }).waitFor().catch(() => {}); // libellé posé une fois les unités chargées
  check('onglets : espace de la division et « Publiés pour toute la DNPEC »', (await p.getByRole('tab', { name: /^Espace de la Division/ }).count()) === 1 && (await p.getByRole('tab', { name: /Publiés pour toute la DNPEC/ }).count()) === 1);
  check('agent : aucun document n’attend sa validation (pas de bandeau)', (await p.locator('[data-testid=bandeau-a-valider]').count()) === 0);
  await p.getByRole('button', { name: 'Nouveau dossier', exact: true }).first().click();
  await dlg(p).getByRole('button', { name: 'Créer le dossier' }).click();
  check('nouveau dossier sans nom : message sous le champ, rien d’envoyé', (await dlg(p).getByTestId('erreur-champ').innerText()) === 'Indiquez le nom du dossier.');
  await dlg(p).getByLabel('Nom du dossier', { exact: true }).fill(`Notes N4 ${S}`);
  await dlg(p).getByRole('button', { name: 'Créer le dossier' }).click();
  check('toast « Dossier créé »', /Dossier créé/.test(await toast(p)));
  await arbre.getByRole('button', { name: new RegExp(`Notes N4 ${S}`) }).click();
  const zone = p.locator('[data-testid=zone-depot]');
  check('zone de dépôt : « … dans « dossier » »', new RegExp(`déposer dans « Notes N4 ${S} »`).test(await zone.innerText()), await zone.innerText());
  const glisse = await p.evaluateHandle((nom) => { const d = new DataTransfer(); d.items.add(new File(['note'], nom, { type: 'text/plain' })); return d; }, `glisse_${S}.txt`);
  await zone.dispatchEvent('drop', { dataTransfer: glisse });
  await dlg(p).getByTestId('fichiers-choisis').waitFor();
  check('fichier glissé : formulaire de dépôt ouvert avec le fichier et le titre proposé', (await dlg(p).getByLabel('Titre', { exact: true }).inputValue()) === `glisse_${S}` && (await dlg(p).getByTestId('fichiers-choisis').innerText()).includes(`glisse_${S}.txt`));
  await dlg(p).getByRole('button', { name: 'Déposer le document' }).click();
  const messages = await dlg(p).getByTestId('erreur-champ').allInnerTexts();
  check('… métadonnées obligatoires exigées : messages sous le type et la période, rien d’envoyé', messages.includes('Choisissez le type du document.') && messages.includes('Indiquez le début de la période couverte.') && messages.includes('Indiquez la fin de la période couverte.') && (await dlg(p).count()) === 1, messages.join(' | '));
  await dlg(p).getByRole('button', { name: 'Annuler' }).click();
  await p.getByRole('button', { name: 'Déposer un document', exact: true }).click();
  await p.getByLabel('Titre', { exact: true }).fill(`Note N4 ${S}`);
  const envoyer = dlg(p).getByRole('button', { name: 'Déposer le document' });
  await p.getByLabel('Fichier', { exact: true }).setInputFiles(fichier);
  await p.locator('#doc-type').selectOption('NOTE_CONJONCTURE');
  await p.locator('#doc-debut').fill('2026-09-30');
  await p.locator('#doc-fin').fill('2026-07-01');
  await envoyer.click();
  check('période à l’envers : « La fin de la période ne peut pas précéder son début. »', (await dlg(p).getByTestId('erreur-champ').allInnerTexts()).some((t) => /précéder son début|au plus tôt le 30\/09\/2026|Indiquez la fin/.test(t)));
  await p.locator('#doc-debut').click();
  await p.locator('#doc-debut').fill('2026-07-01');
  await p.locator('#doc-fin').fill('2026-09-30');
  await p.locator('#doc-fin').click();
  await p.locator('#doc-fin').fill('2026-09-30');
  await p.screenshot({ path: `${E.SHOTS}/n4_depot_bureau.png` });
  await envoyer.click();
  check('toast « Document déposé »', /Document déposé/.test(await toast(p)));
  const ligneDoc = p.locator('[data-testid=ligne-document]', { hasText: `Note N4 ${S}` });
  await ligneDoc.waitFor();
  check('tableau : chemin du dossier, type, période couverte, Brouillon, v1', new RegExp(`Notes N4 ${S}`).test(await ligneDoc.innerText()) && /Note de conjoncture/.test(await ligneDoc.innerText()) && /juil\. – sept\. 2026/.test(await ligneDoc.innerText()) && /Brouillon/.test(await ligneDoc.innerText()) && /v1/.test(await ligneDoc.innerText()), await ligneDoc.innerText());
  check('arborescence : 1 document dans le nouveau dossier', /\b1\b/.test(await arbre.getByRole('button', { name: new RegExp(`Notes N4 ${S}`) }).innerText()));
  await ligneDoc.click();
  const fenetre = p.locator('[data-testid=fenetre-document]');
  const statut = p.locator('[data-testid=statut-document]');
  await statut.waitFor();
  check('fenêtre : fil d’Ariane unité › dossier, étapes du statut', new RegExp(`Notes N4 ${S}`).test(await fenetre.getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()) && (await fenetre.getByRole('list', { name: 'Étapes du statut de diffusion' }).count()) === 1);
  check('document déposé : Brouillon, type et période affichés', /Brouillon/.test(await statut.innerText()) && /Note de conjoncture/.test(await p.locator('[data-testid=metadonnees]').innerText()) && /30 septembre 2026/.test(await p.locator('[data-testid=metadonnees]').innerText()));
  check('aperçu stylisé : bandeau « BROUILLON — non validé »', /BROUILLON — non validé/.test(await p.locator('[data-testid=apercu-statut]').innerText()));
  check('agent : aucune action de statut', (await p.locator('[data-testid=actions-statut]').count()) === 0);
  check('pas encore Final : la phrase dit ce qui manque', /marqué « Final »/.test(await p.locator('[data-testid=phrase-validation]').innerText()));
  await p.getByRole('button', { name: 'Marquer comme final' }).click();
  await fenetre.getByText('Final', { exact: true }).first().waitFor();
  check('toast « Document marqué final »', /Document marqué final/.test(await toast(p)));
  await p.context().close();

  console.log('— Statut : validation par le chef de division (bureau)');
  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/documents`);
  const bandeau = p.locator('[data-testid=bandeau-a-valider]');
  await bandeau.waitFor();
  check('bandeau : « N document(s) attend(ent) votre validation … marqué Final par … »', /attendent? votre validation/.test(await bandeau.innerText()) && /marqué Final/.test(await bandeau.innerText()), await bandeau.innerText());
  await p.locator('[data-testid=ligne-document]', { hasText: `Note N4 ${S}` }).click(); // pas le bandeau, qui peut citer le même titre
  await p.locator('[data-testid=fenetre-document]').waitFor();
  check('phrase : « la validation est possible »', /la validation est possible/.test(await p.locator('[data-testid=phrase-validation]').innerText()));
  const publier = p.getByRole('button', { name: 'Publier pour toute la DNPEC' });
  check('« Publier » grisé avant validation (« Disponible après validation. »)', (await publier.isDisabled()) && (await p.getByText('Disponible après validation.').count()) === 1);
  await p.getByRole('button', { name: 'Valider le document' }).click();
  await p.waitForFunction(() => /Validé/.test(document.querySelector('[data-testid=statut-document]')?.textContent ?? ''));
  check('toast « Document validé »', /Document validé/.test(await toast(p)));
  await p.locator('[data-testid=historique-statut]').waitFor();
  check('validé : badge « Validé », historique (Brouillon → Validé, auteur)', /Brouillon → Validé/.test(await p.locator('[data-testid=historique-statut]').innerText()));
  check('validé : aperçu « VALIDÉ », « Publier » disponible', /VALIDÉ/.test(await p.locator('[data-testid=apercu-statut]').innerText()) && !(await publier.isDisabled()));
  check('chef de division : pas de « Rendre diffusable » (DN, DNA)', (await p.getByRole('button', { name: 'Rendre diffusable' }).count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n4_statut_bureau.png` });
  await p.context().close();

  console.log('— Dépôt direct depuis une tâche');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Synthèse N4 ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/tasks/${t.id}`);
  const issus = p.locator('[data-testid=documents-issus]');
  await issus.waitFor();
  await issus.getByRole('button', { name: 'Déposer un document' }).click();
  check('formulaire prérempli : « Issu de : tâche … »', new RegExp(`Synthèse N4 ${S}`).test(await p.locator('[data-testid=source-depot]').innerText()));
  await p.getByLabel('Titre', { exact: true }).fill(`Livrable ${S}`);
  await p.locator('#doc-type').selectOption('RAPPORT');
  await p.getByLabel('Fichier', { exact: true }).setInputFiles(fichier);
  await dlg(p).getByRole('button', { name: 'Déposer le document' }).click();
  await issus.getByText(`Livrable ${S}`).waitFor();
  check('document listé dans la tâche, lien vers la GED', (await issus.getByRole('link', { name: `Livrable ${S}` }).getAttribute('href')).startsWith('/documents?id='));
  await issus.getByRole('link', { name: `Livrable ${S}` }).click();
  await p.locator('[data-testid=source-document]').waitFor();
  check('fiche du document : « Issu de : Tâche … »', new RegExp(`Synthèse N4 ${S}`).test(await p.locator('[data-testid=source-document]').innerText()));
  await p.context().close();

  console.log('— Documents générés : attestation de travail (DRH, bureau)');
  p = await loginPage(b, 'drh');
  check('menu : « Documents générés »', (await p.locator('a[href="/documents-generes"]').count()) === 1);
  await p.goto(`${WEB}/documents-generes`);
  await p.getByRole('tab', { name: 'Attestations de travail' }).waitFor();
  await p.getByText('Créée le', { exact: false }).first().waitFor({ timeout: 5000 }).catch(() => {});
  const avant = await p.locator('[data-testid=attestation-travail]').count();
  await p.getByRole('button', { name: 'Nouvelle attestation de travail' }).first().click();
  await dlg(p).getByRole('button', { name: 'Créer l’attestation' }).click();
  check('attestation sans agent : « Choisissez l’agent. » sous le champ', (await dlg(p).getByTestId('erreur-champ').innerText()) === 'Choisissez l’agent.');
  await choisirPersonne(p, 'Agent', 'AGENT1');
  await dlg(p).getByRole('button', { name: 'Créer l’attestation' }).click();
  check('toast « Attestation créée »', /Attestation créée/.test(await toast(p)));
  await p.waitForFunction((n) => document.querySelectorAll('[data-testid=attestation-travail]').length > n, avant);
  const att = p.locator('[data-testid=attestation-travail]').first();
  check('attestation créée : « Projet — acte non préparé »', /Projet/.test(await att.innerText()));
  await att.getByRole('button', { name: 'Aperçu' }).click();
  await p.locator('[data-testid=apercu-document]').waitFor();
  check('aperçu fidèle : le PDF produit s’affiche', /^blob:/.test(await p.locator('[data-testid=apercu-document]').getAttribute('src')));
  await p.waitForTimeout(4000); // rendu du PDF par la visionneuse de Chromium
  await p.screenshot({ path: `${E.SHOTS}/n4_apercu_bureau.png` });
  await p.getByRole('button', { name: 'Fermer l’aperçu' }).click();
  // Refonte (étape 8) : la ligne ouvre une fenêtre deux colonnes (informations, puis actions à droite).
  check('bande de synthèse : attestations, ordres, actes à préparer, en circuit', (await p.getByRole('region', { name: 'Synthèse des documents générés' }).locator('[data-testid^=compteur-]').count()) === 4);
  await att.getByRole('button', { name: /^Voir l’attestation/ }).click();
  const ficheAtt = p.locator('[data-testid=fiche-document-genere]');
  await ficheAtt.waitFor();
  check('fenêtre de l’attestation : agent et état de l’acte', /Projet — acte non préparé/.test(await ficheAtt.innerText()));
  const [dl] = await Promise.all([p.waitForEvent('download'), ficheAtt.getByRole('button', { name: 'Word' }).click()]);
  check('téléchargement Word (.docx)', /\.docx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('Préparer l’acte proposé au DRH', (await ficheAtt.getByRole('button', { name: 'Préparer l’acte' }).count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n4_attestation_fenetre_bureau.png` });
  await p.context().close();

  console.log('— Ordre de mission (chef de section, téléphone)');
  p = await loginPage(b, 'chefssr', TELEPHONE);
  await p.goto(`${WEB}/documents-generes?onglet=ordres`);
  await p.getByRole('button', { name: 'Nouvel ordre de mission', exact: true }).click();
  await choisirPersonne(p, 'Agent', 'AGENT1');
  await p.getByLabel('Destination').fill('Labé');
  await p.getByLabel('Objet de la mission').fill(`Enquête de conjoncture ${S}`);
  await p.getByLabel('Départ', { exact: true }).fill('2026-11-12');
  await p.getByLabel('Retour', { exact: true }).fill('2026-11-10');
  await p.getByLabel(/Frais de mission/).fill('281000');
  await p.getByRole('button', { name: 'Enregistrer l’ordre de mission' }).click();
  check('téléphone : retour avant le départ refusé dans la fenêtre', (await dlg(p).count()) === 1 && (await dlg(p).getByTestId('erreur-champ').count()) >= 1);
  await p.getByLabel('Départ', { exact: true }).click();
  await p.getByLabel('Départ', { exact: true }).fill('2026-11-10');
  await p.getByLabel('Retour', { exact: true }).click();
  await p.getByLabel('Retour', { exact: true }).fill('2026-11-12');
  await p.screenshot({ path: `${E.SHOTS}/n4_ordre_fenetre_mobile.png` });
  await p.getByRole('button', { name: 'Enregistrer l’ordre de mission' }).click();
  check('toast « Ordre de mission enregistré »', /Ordre de mission enregistré/.test(await toast(p)));
  const om = p.locator('[data-testid=ordre-mission]', { hasText: `Enquête de conjoncture ${S}` });
  await om.waitFor();
  check('téléphone : sans défilement horizontal', await sansDefilementHorizontal(p));
  await om.getByRole('button', { name: /^Voir l’ordre de mission/ }).click();
  const ficheOm = p.locator('[data-testid=fiche-document-genere]');
  await ficheOm.waitFor();
  check('frais en toutes lettres : « deux cent quatre-vingt-un mille »', /deux cent quatre-vingt-un mille \(281 000\) francs guinéens/.test(await ficheOm.innerText()), await ficheOm.innerText());
  check('fenêtre sur téléphone : pleine largeur, sans défilement horizontal', (await ficheOm.evaluate((el) => el.getBoundingClientRect().width)) <= 390 && (await sansDefilementHorizontal(p)));
  await ficheOm.getByRole('button', { name: 'Fermer', exact: true }).click();
  await p.screenshot({ path: `${E.SHOTS}/n4_ordre_mission_mobile.png`, fullPage: true });
  await p.context().close();

  console.log('— Rapport d’activité (agent, téléphone)');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/documents-generes`);
  check('agent : seul l’onglet « Rapport d’activité » (et l’ordre qui le concerne)', (await p.getByRole('tab', { name: 'Attestations de travail' }).count()) === 0);
  await p.getByRole('tab', { name: 'Rapport d’activité' }).click();
  await p.getByRole('button', { name: 'Aperçu' }).click();
  await p.locator('[data-testid=apercu-document]').waitFor();
  check('rapport : aperçu affiché sur téléphone', true);
  await p.waitForTimeout(4000); // rendu du PDF par la visionneuse de Chromium
  await p.screenshot({ path: `${E.SHOTS}/n4_rapport_mobile.png` });
  await p.context().close();

  console.log('— Document d’une cellule rattachée à la Direction : dépôt (téléphone), validation par le chef de cellule (bureau)');
  p = await loginPage(b, 'agentsaf', TELEPHONE);
  await p.goto(`${WEB}/documents`);
  const ongletCellule = p.getByRole('tab', { name: /^Espace d/ });
  await ongletCellule.waitFor();
  await p.locator('[data-testid=zone-depot]').waitFor();
  check('agent de cellule : onglet « Espace … » de sa cellule, sans dossiers (propres aux divisions)', (await ongletCellule.getAttribute('aria-selected')) === 'true' && (await p.locator('[data-testid=arborescence-dossiers]').count()) === 0);
  check('téléphone : filtres repliés derrière « Filtres »', (await p.getByTestId('bouton-filtres').isVisible()) && !(await p.getByRole('combobox', { name: 'Statut' }).isVisible()));
  await p.getByTestId('bouton-filtres').click();
  await p.getByRole('dialog', { name: 'Filtres' }).getByRole('combobox', { name: 'Type' }).selectOption('RAPPORT');
  await p.getByRole('dialog', { name: 'Filtres' }).getByRole('button', { name: 'Appliquer' }).click();
  check('téléphone : « Filtres (1) » après un filtre, sans débordement', (await p.getByTestId('bouton-filtres').innerText()).trim() === 'Filtres (1)' && (await sansDefilementHorizontal(p)));
  await p.getByTestId('bouton-filtres').click();
  await p.getByRole('dialog', { name: 'Filtres' }).getByRole('button', { name: 'Effacer les filtres' }).click();
  await p.getByRole('dialog', { name: 'Filtres' }).getByRole('button', { name: 'Appliquer' }).click();
  await p.getByRole('button', { name: 'Déposer un document', exact: true }).click();
  await p.getByLabel('Titre', { exact: true }).fill(`Note SAF ${S}`);
  await p.getByLabel('Fichier', { exact: true }).setInputFiles(fichier);
  await p.locator('#doc-type').selectOption('NOTE_TECHNIQUE');
  await p.locator('#doc-debut').fill('2026-07-01');
  await p.locator('#doc-fin').fill('2026-09-30');
  await dlg(p).getByRole('button', { name: 'Déposer le document' }).click();
  await p.getByText(`Note SAF ${S}`).first().click();
  await p.locator('[data-testid=statut-document]').waitFor();
  await p.getByRole('button', { name: 'Marquer comme final' }).click();
  await p.locator('[data-testid=fenetre-document]').getByText('Final', { exact: true }).first().waitFor();
  check('téléphone : pas de défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n4_cellule_mobile.png` });
  await p.context().close();
  p = await loginPage(b, 'chefsaf');
  await p.goto(`${WEB}/documents`);
  await p.locator('[data-testid=ligne-document]', { hasText: `Note SAF ${S}` }).click();
  await p.getByRole('button', { name: 'Valider le document' }).click();
  await p.waitForFunction(() => /Validé/.test(document.querySelector('[data-testid=statut-document]')?.textContent ?? ''));
  check('le chef de la cellule valide le document de sa cellule', true);
  await p.screenshot({ path: `${E.SHOTS}/n4_cellule_chef_bureau.png` });
  await p.context().close();
  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/documents`);
  await p.waitForTimeout(800);
  check('un chef de division ne voit pas le document privé de la cellule', !(await p.locator('body').innerText()).includes(`Note SAF ${S}`));
  await p.context().close();

  fs.rmSync(fichier, { force: true });
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
