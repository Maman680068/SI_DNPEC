// N6 — écrans sous Chromium, bureau (1366) et téléphone (390) : Ressources humaines (onglets selon le
// profil, effectifs, alertes, mouvement de carrière préparé puis appliqué à la signature de l'acte,
// fiche de poste, besoin de formation retenu), véhicules (ajout, plein, affectation à une mission,
// retour) et tableau de bord par rôle.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
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
  check('menu : « Ressources humaines »', (await p.locator('a[href="/rh"]').count()) === 1);
  await p.goto(`${WEB}/rh?onglet=effectifs`);
  await p.locator('[data-testid=effectifs]').waitFor();
  const ongletsDrh = await onglets(p);
  check('DRH : 6 onglets (effectifs, alertes, carrière, fiches, formation, pièces)', ongletsDrh.length === 6 && ongletsDrh.includes('Pièces requises'), ongletsDrh.join(', '));
  check('effectifs : répartitions par unité, statut et catégorie', (await p.getByRole('region', { name: 'Par unité' }).count()) === 1 && (await p.getByRole('region', { name: 'Par catégorie' }).count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n6_effectifs_bureau.png`, fullPage: true });
  await p.getByRole('tab', { name: 'Alertes' }).click();
  await p.locator('[data-testid=alertes-rh]').or(p.getByText(/Aucune alerte/)).first().waitFor();
  check('alertes : onglet ouvert, adresse mise à jour', /onglet=alertes/.test(p.url()));
  await p.screenshot({ path: `${E.SHOTS}/n6_alertes_bureau.png` });

  console.log('— Mouvement de carrière : préparé, acte, signature, appliqué');
  await p.getByRole('tab', { name: 'Carrière et actes' }).click();
  check('familles d’actes affichées avec leur signataire', /signataire/.test(await p.locator('[data-testid=familles-actes]').innerText()));
  await p.getByRole('button', { name: '+ Nouveau mouvement' }).click();
  let d = p.getByRole('dialog');
  await d.getByLabel('Agent').selectOption(ids.agent1);
  await d.getByLabel('Mouvement').selectOption('NOMINATION');
  await d.getByLabel('Nouvelle fonction').fill(`Chargé d’études principal ${S}`);
  await d.getByRole('button', { name: 'Préparer le mouvement' }).click();
  const mouvement = p.locator('[data-testid=mouvement]', { hasText: `Chargé d’études principal ${S}` });
  await mouvement.waitFor();
  check('mouvement listé « Préparé », avant → après', /Préparé/.test(await mouvement.innerText()) && /Fonction/.test(await mouvement.innerText()));
  await mouvement.getByRole('button', { name: 'Préparer l’acte' }).click();
  await mouvement.getByRole('link', { name: 'Voir l’acte' }).waitFor();
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
  await p.getByRole('button', { name: '+ Nouvelle fiche de poste' }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Fonction').fill(`Statisticien ${S}`);
  await d.getByLabel('Missions').fill('Produire les indicateurs de conjoncture.');
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await p.locator('[data-testid=fiches-poste]').getByText(`Statisticien ${S}`).waitFor();
  check('fiche de poste listée', true);
  await p.context().close();

  console.log('— Chef de division (bureau) : besoin de formation ; le DRH le retient');
  p = await loginPage(b, 'chefdpe');
  await p.goto(`${WEB}/rh?onglet=formation`);
  await p.getByRole('button', { name: '+ Exprimer un besoin' }).waitFor();
  const ongletsChef = await onglets(p);
  check('chef : carrière, fiches et formation seulement', ongletsChef.join('|') === 'Carrière et actes|Fiches de poste|Formation', ongletsChef.join(', '));
  await p.getByRole('button', { name: '+ Exprimer un besoin' }).click();
  d = p.getByRole('dialog');
  await d.getByLabel('Intitulé de la formation').fill(`Prévision macroéconomique ${S}`);
  await d.getByRole('button', { name: 'Exprimer le besoin' }).click();
  await p.locator('[data-testid=besoin]', { hasText: `Prévision macroéconomique ${S}` }).waitFor();
  check('besoin listé pour l’unité du chef', true);
  await p.context().close();
  p = await loginPage(b, 'drh');
  await p.goto(`${WEB}/rh?onglet=formation`);
  const besoin = p.locator('[data-testid=besoin]', { hasText: `Prévision macroéconomique ${S}` });
  await besoin.waitFor();
  await besoin.getByLabel(`Statut du besoin Prévision macroéconomique ${S}`).selectOption('RETENU');
  await p.waitForTimeout(600);
  const enBase = await prisma.besoinFormation.findFirst({ where: { intitule: `Prévision macroéconomique ${S}` } });
  check('le DRH retient le besoin dans le plan de formation', enBase.statut === 'RETENU', enBase.statut);
  await p.screenshot({ path: `${E.SHOTS}/n6_formation_bureau.png` });
  await p.goto(`${WEB}/dashboard`);
  await p.locator('[data-testid=blocs-role]').waitFor();
  check('tableau de bord du DRH : alertes RH et décisions de congé', (await p.locator('[data-testid=bloc-alertes-rh]').count()) === 1 && (await p.locator('[data-testid=bloc-conges-decision]').count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n6_tableau_bord_bureau.png` });
  await p.context().close();

  console.log('— Agent (téléphone) : sa carrière, les fiches, son tableau de bord');
  p = await loginPage(b, 'agent1', TELEPHONE);
  await p.goto(`${WEB}/rh`);
  await p.locator('[data-testid=mouvement]', { hasText: `Chargé d’études principal ${S}` }).waitFor();
  const ongletsAgent = await onglets(p);
  check('agent : carrière et fiches de poste seulement', ongletsAgent.join('|') === 'Carrière et actes|Fiches de poste', ongletsAgent.join(', '));
  check('agent : sa nomination appliquée, sans bouton d’instruction', (await p.getByRole('button', { name: '+ Nouveau mouvement' }).count()) === 0);
  check('téléphone : sans défilement horizontal (RH)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n6_carriere_mobile.png`, fullPage: true });
  await p.goto(`${WEB}/dashboard`);
  await p.locator('[data-testid=blocs-role]').waitFor();
  const blocsAgent = await p.locator('[data-testid=blocs-role] > article').evaluateAll((l) => l.map((e) => e.dataset.testid));
  check('tableau de bord de l’agent : solde, demandes, réunions (tâches déjà en tête), sans alertes RH', ['bloc-solde', 'bloc-demandes', 'bloc-reunions'].every((c) => blocsAgent.includes(c)) && !blocsAgent.includes('bloc-alertes-rh'), blocsAgent.join(', '));
  check('téléphone : sans défilement horizontal (tableau de bord)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n6_tableau_bord_mobile.png`, fullPage: true });
  await p.context().close();

  console.log('— Gestionnaire logistique (bureau) : véhicule, plein, mission, retour');
  const objet = `Enquête prix ${S}`;
  const om = await call('chefssr', 'POST', '/api/v1/ordres-mission', { agentId: ids.agent1, objet, destination: 'Kindia', dateDepart: jour(30), dateRetour: jour(32), transport: 'Véhicule de service', fraisMontant: 150000 });
  check('ordre de mission créé (API)', om.status === 201, om.status);
  p = await loginPage(b, 'agentsaf');
  await p.goto(`${WEB}/logistique?onglet=vehicules`);
  await p.getByRole('button', { name: '+ Nouveau véhicule' }).click();
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
  await fiche.getByLabel('Date', { exact: true }).fill(jour(0));
  await fiche.getByLabel('Litres', { exact: true }).fill('60');
  await fiche.getByLabel('Montant', { exact: true }).fill('720000');
  await fiche.getByLabel('Compteur', { exact: true }).fill('15400');
  await fiche.getByRole('button', { name: 'Ajouter le plein' }).click();
  await fiche.getByText(/15\s400 km/).first().waitFor();
  check('plein ajouté : compteur à 15 400 km', true);
  await p.keyboard.press('Escape');
  await p.getByRole('dialog').waitFor({ state: 'detached' }).catch(() => {});
  const mission = p.locator('[data-testid=mission-vehicule]', { hasText: objet });
  await mission.getByLabel(`Véhicule de la mission ${objet}`).selectOption({ label: immat });
  await mission.getByRole('button', { name: 'Enregistrer le retour' }).waitFor();
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
  check('agent : parc lisible, sans « + Nouveau véhicule » ni missions à équiper', (await p.getByRole('button', { name: '+ Nouveau véhicule' }).count()) === 0 && (await p.locator('[data-testid=missions-vehicules]').count()) === 0);
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
