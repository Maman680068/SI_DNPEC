// N6 — écrans sous Chromium, bureau (1366) et téléphone (390) : Ressources humaines (onglets selon le
// profil, effectifs, alertes, mouvement de carrière préparé puis appliqué à la signature de l'acte,
// fiche de poste, besoin de formation retenu), véhicules (ajout, plein, affectation à une mission,
// retour) et tableau de bord par rôle.
const { browser, loginPage, check, bilan, WEB, ouvrirPlus } = require('./helpers');
const { call, ids, login } = require('../lib');
const E = require('../config');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const API = 'http://localhost:3000';
const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const onglets = async (p) => (await p.getByRole('tab').allInnerTexts()).map((t) => t.trim());
// Refonte (étape 9) : choix d'une personne = taper le nom puis cliquer la suggestion ; message de confirmation (toast).
async function choisirPersonne(d, label, nom) {
  await d.getByRole('combobox', { name: label, exact: true }).fill(nom);
  await d.getByRole('option', { name: nom }).first().click();
}
const toast = (p) => p.getByTestId('toast');

/** Soumet l'acte au circuit du Courrier, fait viser, puis le DN signe (scan joint). */
async function signerActe(acteId) {
  await call('drh', 'POST', `/courrier/actes/${acteId}/soumettre`);
  let a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a.statut === 'EN_VISA' && i < 4; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'signe.pdf');
  return fetch(`${API}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
}

(async () => {
  // La famille « Décision de nomination » doit avoir son registre (séquence) : la suite n6_rh le
  // choisit ; lancée seule, celle-ci en crée un.
  const fam = (await call('drh', 'GET', '/api/v1/rh/familles-actes')).body.familles.find((f) => f.code === 'DECISION_NOMINATION');
  if (!fam.registre) {
    const reg = (await call('admin', 'POST', '/courrier/registres', { code: `UNO${L}`, libelle: `Décisions de nomination ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'UNO/{seq:3}/{annee}' })).body;
    await call('drh', 'PATCH', '/api/v1/rh/familles-actes/DECISION_NOMINATION', { registreId: reg.id });
  }
  const b = await browser();

  console.log('— DRH (bureau) : onglets, effectifs, alertes');
  let p = await loginPage(b, 'drh');
  await ouvrirPlus(p);
  check('menu : « Ressources humaines »', (await p.locator('a[href="/rh"]').count()) === 1);
  await p.goto(`${WEB}/rh?onglet=effectifs`);
  await p.locator('[data-testid=effectifs]').waitFor();
  const ongletsDrh = await onglets(p);
  check('DRH : 6 onglets (effectifs, alertes, carrière, fiches, formation, pièces)', ongletsDrh.length === 6 && ongletsDrh.includes('Pièces requises'), ongletsDrh.join(', '));
  check('effectifs : répartitions par unité, par statut et catégorie', (await p.getByRole('region', { name: 'Par unité' }).count()) === 1 && (await p.getByRole('region', { name: 'Par statut et catégorie' }).count()) === 1);
  // Refonte (étape 8, maquette « Effectifs ») : 4 indicateurs, Exporter, panneau Alertes RH (DRH), onglet Alertes à compteur.
  const effApi = (await call('drh', 'GET', '/api/v1/rh/effectifs')).body;
  const alertesApi = (await call('drh', 'GET', '/api/v1/rh/alertes')).body;
  const chiffre = async (t) => (await p.getByTestId(t).locator('span').first().innerText()).replace(/\D/g, '');
  check('bande : 4 indicateurs, total et départs prévus = API', (await p.locator('[data-testid^=indicateur-]').count()) === 4 && (await chiffre('indicateur-total')) === String(effApi.total) && (await chiffre('indicateur-departs')) === String(effApi.departsPrevus));
  check('en-tête : bouton « Exporter »', (await p.getByRole('button', { name: 'Exporter' }).count()) === 1);
  check('onglet Alertes : compteur = nombre d’alertes de l’API', alertesApi.length === 0 || (await p.getByRole('tab', { name: 'Alertes' }).innerText()).includes(String(alertesApi.length)));
  check('panneau « Alertes RH » (DRH)', (await p.getByTestId('effectifs-alertes').count()) === 1);
  check('phrase « Calculé le … à partir des dossiers ; rien n’est saisi ici »', (await p.getByText(/Calculé le .* à partir des dossiers ; rien n’est saisi ici/).count()) === 1);
  const [telechargement] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exporter' }).click()]);
  check('Exporter : fichier Excel des effectifs', /^effectifs_\d{4}-\d{2}-\d{2}\.xlsx$/.test(telechargement.suggestedFilename()), telechargement.suggestedFilename());
  await p.screenshot({ path: `${E.SHOTS}/n6_effectifs_bureau.png`, fullPage: true });
  const voir = p.getByTestId('effectifs-alertes').getByRole('button', { name: /^Voir/ }).first();
  if (await voir.count()) {
    await voir.click();
    await p.locator('[data-testid=alertes-rh]').waitFor();
    check('« Voir » d’un groupe d’alertes : onglet Alertes filtré sur cette nature', /onglet=alertes/.test(p.url()) && (await p.getByLabel('Nature de l’alerte').inputValue()) !== '');
    await p.getByRole('tab', { name: 'Effectifs' }).click();
    await p.locator('[data-testid=effectifs]').waitFor();
  }
  await p.getByRole('tab', { name: 'Alertes' }).click();
  await p.locator('[data-testid=alertes-rh]').or(p.getByText(/Aucune alerte/)).first().waitFor();
  check('alertes : onglet ouvert, adresse mise à jour', /onglet=alertes/.test(p.url()));
  check('alertes : action « Voir » sur la ligne', (await p.locator('[data-testid=alerte-rh]').count()) === 0 || (await p.locator('[data-testid=alerte-rh]').first().getByRole('link', { name: /^Voir/ }).count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n6_alertes_bureau.png` });

  console.log('— Mouvement de carrière : préparé, acte, signature, appliqué');
  // Squelette pendant le chargement de l'onglet (réponse de l'API retardée).
  await p.route('**/api/v1/rh/mouvements*', async (r) => { await new Promise((x) => setTimeout(x, 1200)); await r.continue().catch(() => undefined); }, { times: 1 });
  await p.getByRole('tab', { name: 'Carrière et actes' }).click();
  check('chargement : squelette à la place de « Chargement… »', await p.getByTestId('squelette').first().isVisible().catch(() => false));
  await p.locator('[data-testid=familles-actes]').waitFor();
  check('familles d’actes affichées avec leur signataire', /signataire/.test(await p.locator('[data-testid=familles-actes]').innerText()));
  const ag1 = await prisma.user.findUnique({ where: { id: ids.agent1 } });
  const nomAg1 = `${ag1.firstName} ${ag1.lastName}`;
  await p.getByRole('button', { name: 'Préparer un mouvement', exact: true }).click();
  let d = p.getByRole('dialog');
  const avantVide = await prisma.mouvementCarriere.count();
  await d.getByRole('button', { name: 'Préparer le mouvement' }).click();
  await d.getByText('Choisissez l’agent concerné.').waitFor();
  check('envoi vide : message sous le champ « Agent », rien d’envoyé', (await d.getByTestId('erreur-champ').count()) >= 1 && (await prisma.mouvementCarriere.count()) === avantVide);
  await choisirPersonne(d, 'Agent', nomAg1);
  await d.getByRole('radio', { name: 'Nomination' }).click();
  await d.getByLabel('Nouvelle fonction').fill(`Chargé d’études principal ${S}`);
  await p.screenshot({ path: `${E.SHOTS}/n6_mouvement_fenetre_bureau.png` });
  await d.getByRole('button', { name: 'Préparer le mouvement' }).click();
  const mouvement = p.locator('[data-testid=mouvement]', { hasText: `Chargé d’études principal ${S}` });
  await mouvement.waitFor();
  check('mouvement listé « Préparé », avant → après', /Préparé/.test(await mouvement.innerText()) && /Fonction/.test(await mouvement.innerText()));
  check('message de confirmation « Mouvement préparé » avec « Annuler »', /Mouvement préparé/.test(await toast(p).innerText()) && (await toast(p).getByRole('button', { name: 'Annuler' }).count()) === 1);
  await mouvement.getByRole('button', { name: 'Préparer l’acte' }).click();
  await mouvement.getByRole('link', { name: 'Voir l’acte' }).waitFor();
  check('message de confirmation « Acte préparé »', /Acte préparé/.test(await toast(p).innerText()));
  check('acte préparé : lien vers l’acte du Courrier', (await mouvement.getByRole('link', { name: 'Voir l’acte' }).getAttribute('href')).startsWith('/courrier?acte='));
  check('acte en cours : plus de « Préparer l’acte » ni d’« Annuler »', (await mouvement.getByRole('button').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/n6_carriere_bureau.png` });
  const mv = await prisma.mouvementCarriere.findFirst({ where: { userId: ids.agent1, type: 'NOMINATION', statut: 'EN_ACTE' }, orderBy: { createdAt: 'desc' } });
  const r = await signerActe(mv.acteId);
  check('le DN signe l’acte', r.status === 201, r.status);
  await p.reload();
  await mouvement.waitFor();
  check('après signature : mouvement « Appliqué », numéro d’acte affiché', /Appliqué/.test(await mouvement.innerText()) && /acte n°/.test(await mouvement.innerText()));

  console.log('— Fiche de poste (DRH)');
  await p.getByRole('tab', { name: 'Fiches de poste' }).click();
  await p.getByRole('button', { name: 'Nouvelle fiche de poste', exact: true }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Fonction').fill(`Statisticien ${S}`);
  await d.getByLabel('Missions').fill('Produire les indicateurs de conjoncture.');
  await d.getByRole('button', { name: 'Créer la fiche' }).click();
  await p.locator('[data-testid=fiches-poste]').getByText(`Statisticien ${S}`).waitFor();
  check('fiche de poste listée, message « Fiche de poste créée »', /Fiche de poste créée/.test(await toast(p).innerText()));
  await p.context().close();

  console.log('— DN (téléphone) : effectifs sans alertes nominatives');
  p = await loginPage(b, 'dn', TELEPHONE);
  await p.goto(`${WEB}/rh?onglet=effectifs`);
  await p.locator('[data-testid=effectifs]').waitFor();
  check('DN : effectifs et Exporter, sans panneau ni onglet Alertes', (await p.getByRole('button', { name: 'Exporter' }).count()) === 1 && (await p.getByTestId('effectifs-alertes').count()) === 0 && !(await onglets(p)).some((t) => t.startsWith('Alertes')));
  check('téléphone : sans défilement horizontal (effectifs)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n6_effectifs_mobile.png`, fullPage: true });
  await p.context().close();

  console.log('— Chef de division (bureau) : besoin de formation ; le DRH le retient');
  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/rh?onglet=formation`);
  await p.getByRole('button', { name: 'Exprimer un besoin', exact: true }).waitFor();
  const ongletsChef = await onglets(p);
  check('chef : carrière, fiches et formation seulement', ongletsChef.join('|') === 'Carrière et actes|Fiches de poste|Formation', ongletsChef.join(', '));
  await p.getByRole('button', { name: 'Exprimer un besoin', exact: true }).click();
  d = p.getByRole('dialog');
  await d.getByRole('button', { name: 'Exprimer le besoin' }).click();
  check('envoi vide : « Ce champ est obligatoire. » sous l’intitulé', (await d.getByText('Ce champ est obligatoire.').count()) === 1);
  await d.getByLabel('Intitulé de la formation').fill(`Prévision macroéconomique ${S}`);
  await d.getByRole('radio', { name: 'Haute' }).click();
  await d.getByRole('button', { name: 'Exprimer le besoin' }).click();
  await p.locator('[data-testid=besoin]', { hasText: `Prévision macroéconomique ${S}` }).waitFor();
  check('besoin listé pour l’unité du chef (priorité haute), message « Besoin exprimé »', /Priorité haute/.test(await p.locator('[data-testid=besoin]', { hasText: `Prévision macroéconomique ${S}` }).innerText()) && /Besoin exprimé/.test(await toast(p).innerText()));
  await p.context().close();
  p = await loginPage(b, 'drh');
  await p.goto(`${WEB}/rh?onglet=formation`);
  const besoin = p.locator('[data-testid=besoin]', { hasText: `Prévision macroéconomique ${S}` });
  await besoin.waitFor();
  await besoin.getByLabel(`Statut du besoin Prévision macroéconomique ${S}`).selectOption('RETENU');
  await toast(p).waitFor();
  check('message « Besoin retenu » avec « Annuler » (même route)', /Besoin retenu/.test(await toast(p).innerText()) && (await toast(p).getByRole('button', { name: 'Annuler' }).count()) === 1);
  const enBase = await prisma.besoinFormation.findFirst({ where: { intitule: `Prévision macroéconomique ${S}` } });
  check('le DRH retient le besoin dans le plan de formation', enBase.statut === 'RETENU', enBase.statut);
  // Plan de formation individuel : le DRH planifie une session depuis le besoin retenu.
  await besoin.getByTestId('planifier-besoin').click();
  d = p.getByRole('dialog', { name: /Planifier une formation/ });
  await d.waitFor();
  check('« Planifier une formation » : intitulé repris du besoin retenu', (await d.getByLabel('Intitulé de la formation').inputValue()) === `Prévision macroéconomique ${S}` && (await d.getByLabel('Besoin d’origine').inputValue()) === enBase.id);
  await d.getByLabel('Agent', { exact: true }).selectOption(ids.agent1);
  await d.getByLabel('Date de début', { exact: true }).fill(jour(20));
  await d.getByLabel('Durée (jours)').fill('4');
  await d.getByLabel('Organisme').fill('ENA');
  await d.getByRole('button', { name: 'Planifier', exact: true }).click();
  await d.waitFor({ state: 'detached' });
  const ligneSession = p.locator('[data-testid=session-formation]', { hasText: `Prévision macroéconomique ${S}` });
  await ligneSession.waitFor();
  check('tableau « Plan de formation » au-dessus des besoins : agent, durée, état « Planifiée », actions du DRH', /4 j/.test(await ligneSession.innerText()) && /Planifiée/.test(await ligneSession.innerText()) && (await ligneSession.getByRole('button', { name: 'Annuler' }).count()) === 1 && (await p.getByTestId('plan-sessions-formation').evaluate((t) => !!(t.compareDocumentPosition(document.querySelector('[data-testid=besoins-formation]')) & Node.DOCUMENT_POSITION_FOLLOWING))));
  await p.screenshot({ path: `${E.SHOTS}/n6_formation_bureau.png` });
  await p.goto(`${WEB}/dashboard`);
  // Refonte de l'interface : décisions de congé dans « À traiter », alertes RH en ligne compacte (masquée à zéro).
  await p.getByTestId('a-traiter').waitFor();
  await p.waitForTimeout(1000);
  const tbDrh = (await call('drh', 'GET', '/api/v1/tableau-de-bord')).body;
  const navDrh = (await call('drh', 'GET', '/api/v1/navigation')).body;
  const nAlertes = tbDrh.blocs.find((x) => x.cle === 'alertes-rh').valeur;
  const nDecisions = (navDrh.aTraiter.find((x) => x.cle === 'conges-decision') || { nombre: 0 }).nombre;
  check(`tableau de bord du DRH : alertes RH (${nAlertes}) et décisions de congé (${nDecisions}) = API`, (await p.locator('[data-testid=bloc-alertes-rh]').count()) === (nAlertes > 0 ? 1 : 0) && (await p.getByTestId('a-traiter-conges-decision').count()) === (nDecisions > 0 ? 1 : 0));
  await p.screenshot({ path: `${E.SHOTS}/n6_tableau_bord_bureau.png` });
  await p.context().close();

  console.log('— Agent (téléphone) : sa carrière, les fiches, son tableau de bord');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/rh`);
  await p.locator('[data-testid=mouvement]', { hasText: `Chargé d’études principal ${S}` }).waitFor();
  const ongletsAgent = await onglets(p);
  check('agent : carrière et fiches de poste seulement', ongletsAgent.join('|') === 'Carrière et actes|Fiches de poste', ongletsAgent.join(', '));
  check('agent : sa nomination appliquée, sans bouton d’instruction', (await p.getByRole('button', { name: 'Préparer un mouvement', exact: true }).count()) === 0);
  check('téléphone : sans défilement horizontal (RH)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n6_carriere_mobile.png`, fullPage: true });
  await p.context().close();
  console.log('— Agent : « Mes formations » dans Mon profil');
  p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/compte?section=formations`);
  const maFormation = p.locator('[data-testid=ma-formation]', { hasText: `Prévision macroéconomique ${S}` });
  await maFormation.waitFor();
  check('agent : sa session planifiée, sans action', /Planifiée/.test(await maFormation.innerText()) && (await maFormation.getByRole('button').count()) === 0);
  await p.goto(`${WEB}/rh?onglet=formation`);
  await p.waitForTimeout(800);
  check('agent : aucun plan de formation à l’écran', (await p.getByTestId('plan-sessions-formation').count()) === 0);
  await p.context().close();

  console.log('— Chef de division (téléphone) : filtres de la formation repliés');
  p = await loginPage(b, 'chefdpe', TELEPHONE);
  await p.goto(`${WEB}/rh?onglet=formation`);
  await p.getByTestId('bouton-filtres').waitFor();
  check('téléphone : bouton « Filtres », année masquée', (await p.getByTestId('bouton-filtres').innerText()).trim() === 'Filtres' && !(await p.getByLabel('Année').isVisible()));
  await p.getByTestId('bouton-filtres').click();
  await p.getByLabel('Année').selectOption(String(new Date().getFullYear() - 1));
  await p.getByRole('button', { name: 'Appliquer' }).click();
  check('téléphone : « Filtres (1) » après le choix d’une autre année, sans défilement horizontal', (await p.getByTestId('bouton-filtres').innerText()).trim() === 'Filtres (1)' && (await sansDefilementHorizontal(p)));
  await p.context().close();
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/dashboard`);
  // Refonte de l'interface : solde et demandes (« Mes congés »), réunions (« Agenda ») en colonne droite.
  await p.getByTestId('boite-conges').waitFor();
  check('tableau de bord de l’agent : congés, agenda, sans alertes RH', (await p.getByTestId('boite-agenda').count()) === 1 && (await p.locator('[data-testid=bloc-alertes-rh]').count()) === 0);
  check('téléphone : sans défilement horizontal (tableau de bord)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n6_tableau_bord_mobile.png`, fullPage: true });
  await p.context().close();

  console.log('— Gestionnaire logistique (bureau) : véhicule, plein, mission, retour');
  const objet = `Enquête prix ${S}`;
  const om = await call('chefssr', 'POST', '/api/v1/ordres-mission', { agentId: ids.agent1, objet, destination: 'Kindia', dateDepart: jour(30), dateRetour: jour(32), transport: 'Véhicule de service', fraisMontant: 150000 });
  check('ordre de mission créé (API)', om.status === 201, om.status);
  p = await loginPage(b, 'agentsaf');
  await p.goto(`${WEB}/logistique?onglet=vehicules`);
  await p.getByRole('button', { name: 'Nouveau véhicule' }).click();
  d = p.getByRole('dialog');
  const immat = `UI ${L.slice(0, 4)} B`;
  await d.getByLabel('Immatriculation').fill(immat);
  await d.getByLabel('Marque').fill('Toyota');
  await d.getByLabel('Modèle').fill('Land Cruiser');
  await d.getByLabel('Kilométrage du compteur').fill('15000');
  await d.getByRole('button', { name: 'Ajouter le véhicule' }).click();
  const vehicule = p.locator('[data-testid=vehicule]', { hasText: immat });
  await vehicule.waitFor();
  check('véhicule listé « En service », 15 000 km', /En service/.test(await vehicule.innerText()) && /15\s000 km/.test(await vehicule.innerText()));
  await vehicule.click();
  const fiche = p.locator('[data-testid=fiche-vehicule]');
  await fiche.waitFor();
  // Étape 9 : le plein se saisit dans une fenêtre (date en français, litres, compteur ; vérifiés avant l'envoi).
  await fiche.getByRole('button', { name: 'Ajouter un plein' }).click();
  const fp = p.locator('div[role=dialog]:has(> form)');
  await fp.getByLabel('Compteur (km)', { exact: true }).fill('14000');
  await fp.getByRole('button', { name: 'Ajouter le plein' }).click();
  check('plein : litres obligatoires et compteur qui recule refusés dans la fenêtre', (await fp.getByTestId('erreur-champ').allInnerTexts()).some((t) => /litres/.test(t)) && (await fp.getByTestId('erreur-champ').allInnerTexts()).some((t) => /inférieur/.test(t)));
  await fp.getByLabel('Date', { exact: true }).click();
  await fp.getByLabel('Date', { exact: true }).fill(jour(0));
  await fp.getByLabel('Litres', { exact: true }).fill('60');
  await fp.getByLabel('Compteur (km)', { exact: true }).fill('15400');
  await fp.getByRole('button', { name: 'Ajouter le plein' }).click();
  await fiche.getByText(/15\s400 km/).first().waitFor();
  check('plein ajouté : compteur à 15 400 km, toast « Plein enregistré »', /Plein enregistré/.test(await p.getByTestId('toast').innerText()));
  await p.keyboard.press('Escape');
  await p.getByRole('dialog').waitFor({ state: 'detached' }).catch(() => {});
  const mission = p.locator('[data-testid=mission-vehicule]', { hasText: objet });
  await mission.getByLabel(`Véhicule de la mission ${objet}`).selectOption({ label: immat });
  await mission.getByRole('button', { name: 'Enregistrer le retour' }).waitFor();
  check('toast « Véhicule affecté », avec « Annuler » (même route, véhicule précédent)', /Véhicule affecté/.test(await p.getByTestId('toast').innerText()) && (await p.getByTestId('toast').getByRole('button', { name: 'Annuler' }).count()) === 1);
  check('véhicule affecté à la mission (kilométrage au départ relevé)', (await prisma.ordreMission.findUnique({ where: { id: om.body.id } })).kilometrageDepart === 15400);
  await mission.getByRole('button', { name: 'Enregistrer le retour' }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Kilométrage au retour').fill('15680');
  await d.getByRole('button', { name: 'Enregistrer le retour' }).click();
  await mission.getByText('Retour enregistré').waitFor();
  check('retour : 280 km parcourus', /280 km parcourus/.test(await mission.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/n6_vehicules_bureau.png`, fullPage: true });
  await p.context().close();

  console.log('— Agent (téléphone) : parc en lecture');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/logistique?onglet=vehicules`);
  await p.locator('[data-testid=vehicule]', { hasText: immat }).waitFor();
  check('agent : parc lisible, sans « Nouveau véhicule » ni missions à équiper', (await p.getByRole('button', { name: 'Nouveau véhicule' }).count()) === 0 && (await p.locator('[data-testid=missions-vehicules]').count()) === 0);
  check('téléphone : sans défilement horizontal (véhicules)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n6_vehicules_mobile.png`, fullPage: true });
  await p.context().close();

  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
