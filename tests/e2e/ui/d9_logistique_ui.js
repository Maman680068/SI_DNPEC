// D9 — écrans de la logistique sous Chromium (bureau et mobile) : administration (catégories,
// habilitations = liste de l'API), gestionnaire (article, stock, bien numéroté, affectation, file à
// traiter, ressource), agent mobile (demande, panne, réservation), chef (validation, priorité
// hiérarchique annoncée = API), réunion avec salle prise en priorité, stagiaire sans logistique. Étape 9 :
// fenêtres au nouveau modèle (champs vérifiés dans la fenêtre, sélecteur de personnes, dates en français),
// messages de confirmation (dont « Annuler » d'une demande), filtres repliés sur téléphone.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB, ouvrirPlus } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const MOBILE = { width: 390, height: 844 };
const dlg = (p) => p.locator('div[role=dialog]:has(> form)');
const pan = (p) => p.locator('div[role=dialog]:not(:has(> form))');
const toast = async (p, motif) => { const t = p.getByTestId('toast').filter({ hasText: motif }); await t.waitFor(); return t.innerText(); };
// Recherche de disponibilités : jour (date en français, déjà rempli : cliquer puis remplir), heures.
async function creneau(p, de, a) {
  await p.getByLabel('Jour', { exact: true }).click();
  await p.getByLabel('Jour', { exact: true }).fill(JOUR);
  await p.getByLabel('De', { exact: true }).fill(de);
  await p.getByLabel('À', { exact: true }).fill(a);
}
const J = new Date(Date.UTC(new Date().getUTCFullYear() + 3, 2, 3) + Math.floor(Math.random() * 250) * 864e5);
const JOUR = J.toISOString().slice(0, 10);
const sansDefilement = async (p) => (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390;

(async () => {
  for (const h of await prisma.habilitationLogistique.findMany({ where: { revoqueeAt: null } })) await call('admin', 'POST', `/logistique/habilitations/${h.id}/revoquer`);
  const b = await browser();

  console.log('— Administrateur (bureau) : catégories et habilitation');
  const adm = await loginPage(b, 'admin');
  await ouvrirPlus(adm);
  await adm.locator('a[href="/logistique/administration"]').click();
  await adm.waitForURL('**/logistique/administration');
  await adm.getByTestId('categorie').first().waitFor();
  await adm.getByRole('button', { name: 'Habiliter', exact: true }).click();
  await dlg(adm).getByRole('button', { name: 'Habiliter', exact: true }).click();
  check('habilitation sans personne : message sous le champ', (await dlg(adm).getByTestId('erreur-champ').innerText()) === 'Choisissez la personne à habiliter.');
  const choixHab = dlg(adm).getByRole('combobox', { name: 'Personne à habiliter' });
  await choixHab.click();
  await dlg(adm).getByRole('option').first().waitFor();
  // Liste limitée à 30 suggestions : on compare au nombre renvoyé par l'API (borné à 30).
  const opts = await dlg(adm).getByRole('option').count();
  const cands = (await call('admin', 'GET', '/logistique/habilitations/candidats')).body;
  check(`personnes proposées = liste de l’API (${cands.length})`, opts === Math.min(30, cands.length), `${opts} affichées`) && check('aucun stagiaire proposé', true && !cands.some((c) => c.role === 'STAGIAIRE'));
  await choixHab.fill('AGENTSAF');
  await dlg(adm).getByRole('option', { name: /AGENTSAF/ }).first().click();
  await dlg(adm).getByRole('button', { name: 'Habiliter', exact: true }).click();
  await toast(adm, 'Habilitation accordée');
  for (const [code, lib, nature] of [[`PA${L}`, `Papeterie ${S}`, 'Fournitures'], [`IN${L}`, `Informatique ${S}`, 'Biens inventoriés']]) {
    await adm.getByRole('button', { name: 'Nouvelle catégorie' }).click();
    await dlg(adm).getByLabel('Code', { exact: true }).fill(code);
    await dlg(adm).getByLabel('Libellé', { exact: true }).fill(lib);
    await dlg(adm).getByRole('radio', { name: nature }).click();
    await dlg(adm).getByRole('button', { name: 'Créer la catégorie' }).click();
    await adm.getByTestId('categorie').filter({ hasText: code }).waitFor();
  }
  check('toast « Catégorie créée »', /Catégorie créée/.test(await toast(adm, 'Catégorie créée')));
  check('catégories créées avec validation du chef', (await prisma.categorieLogistique.count({ where: { code: { in: [`PA${L}`, `IN${L}`] }, validationChefRequise: true } })) === 2);
  await adm.screenshot({ path: `${SHOTS}/d9_administration_desktop.png`, fullPage: true });

  console.log('— Gestionnaire (bureau) : article, stock, bien, affectation, ressource');
  const g = await loginPage(b, 'agentsaf');
  await g.goto(`${WEB}/logistique`);
  await g.getByRole('heading', { name: 'Logistique' }).waitFor();
  check('onglets du gestionnaire', (await g.getByRole('tab', { name: /^Fournitures/ }).count()) === 1 && (await g.getByRole('tab', { name: 'Inventaire' }).count()) === 1);
  // Refonte (étape 7) : bande de compteurs du gestionnaire = API (file à traiter, réservations du jour, stock, véhicules).
  const tbG = (await call('agentsaf', 'GET', '/logistique/tableau-de-bord')).body;
  const bande = (await g.getByRole('region', { name: 'Logistique en un coup d’œil' }).innerText()).replace(/\s+/g, ' ');
  check('bande du gestionnaire : 4 compteurs de l’API', bande.includes(`${tbG.aTraiter} Demandes à traiter`) && bande.includes(`${tbG.reservationsDuJour} Réservations aujourd’hui`) && bande.includes(`${tbG.stockBas} Fournitures sous le seuil`) && bande.includes(`${tbG.vehicules.disponibles} / ${tbG.vehicules.total} Véhicules disponibles`), bande);
  await g.getByRole('tab', { name: /^Fournitures/ }).click();
  await g.getByRole('button', { name: 'Nouvel article' }).click();
  await dlg(g).getByRole('button', { name: 'Créer l’article' }).click();
  check('article vide : messages sous les champs, rien d’envoyé', (await dlg(g).getByTestId('erreur-champ').allInnerTexts()).includes('Choisissez la catégorie.'));
  await dlg(g).getByLabel('Catégorie').selectOption({ label: `Papeterie ${S}` });
  await dlg(g).getByLabel('Libellé').fill(`Ramette A4 ${S}`);
  await dlg(g).getByLabel('Unité').fill('ramette');
  await dlg(g).getByLabel(/Suivre le stock/).check();
  await dlg(g).getByLabel('Seuil d’alerte (facultatif)').fill('5');
  await dlg(g).getByRole('button', { name: 'Créer l’article' }).click();
  await toast(g, 'Article créé');
  await g.getByText(`Ramette A4 ${S}`).click();
  await pan(g).getByRole('button', { name: 'Entrée' }).click();
  await dlg(g).getByLabel('Quantité (ramette)').fill('10');
  await dlg(g).getByRole('button', { name: 'Enregistrer l’entrée' }).click();
  check('toast « Entrée en stock enregistrée — Stock : 10 ramette »', /Stock : 10 ramette/.test(await toast(g, 'Entrée en stock enregistrée')));
  await pan(g).getByRole('button', { name: 'Sortie' }).click();
  await dlg(g).getByLabel('Quantité (ramette)').fill('50');
  await dlg(g).getByLabel('Motif').fill('Test');
  await dlg(g).getByRole('button', { name: 'Enregistrer la sortie' }).click();
  check('sortie supérieure au stock : refusée dans la fenêtre (message sous la quantité)', /Le stock ne compte que 10 ramette/.test(await dlg(g).getByTestId('erreur-champ').innerText()));
  await dlg(g).getByRole('button', { name: 'Annuler' }).click();
  await g.keyboard.press('Escape');
  await g.goto(`${WEB}/logistique?onglet=inventaire`);
  await g.getByRole('button', { name: 'Nouveau bien' }).click();
  await dlg(g).getByLabel('Catégorie').selectOption({ label: `IN${L} — Informatique ${S}` });
  await dlg(g).getByLabel('Désignation').fill(`Ordinateur portable ${S}`);
  await dlg(g).getByLabel('Marque').fill('Dell');
  await dlg(g).getByRole('button', { name: 'Enregistrer le bien' }).click();
  const an = new Date().getFullYear();
  check(`numéro attribué : IN${L}-${an}-0001 (message de confirmation)`, (await toast(g, 'Bien enregistré')).includes(`IN${L}-${an}-0001`));
  await pan(g).getByRole('button', { name: 'Affecter' }).click();
  await dlg(g).getByRole('button', { name: 'Affecter', exact: true }).click();
  check('affectation sans personne : message sous le champ', (await dlg(g).getByTestId('erreur-champ').innerText()) === 'Choisissez la personne.');
  await dlg(g).getByRole('combobox', { name: 'Personne' }).fill('AGENT1');
  await dlg(g).getByRole('option', { name: /AGENT1 Test/ }).first().click();
  await dlg(g).getByRole('button', { name: 'Affecter', exact: true }).click();
  check('toast « Bien affecté … AGENT1 Test »', /AGENT1 Test/.test(await toast(g, 'Bien affecté')));
  check('historique : entrée à l’inventaire puis affectation', /Entrée à l’inventaire[\s\S]*|Affectation/.test(await pan(g).getByTestId('historique-bien').innerText()) && (await pan(g).getByTestId('historique-bien').locator('li').count()) === 2);
  await g.screenshot({ path: `${SHOTS}/d9_fiche_bien_desktop.png`, fullPage: true });
  await pan(g).getByRole('button', { name: 'Fermer' }).click();
  await g.goto(`${WEB}/logistique?onglet=reservations`);
  await g.getByRole('button', { name: 'Ressources' }).click();
  await g.getByRole('button', { name: 'Nouvelle ressource' }).click();
  await dlg(g).getByLabel('Nom').fill(`Salle de conférence ${S}`);
  await dlg(g).getByLabel('Capacité (facultatif)').fill('30');
  await dlg(g).getByRole('button', { name: 'Créer la ressource' }).click();
  await toast(g, 'Ressource créée');
  await g.getByText(`Salle de conférence ${S}`).waitFor();
  const salle = await prisma.ressourceReservable.findUnique({ where: { nom: `Salle de conférence ${S}` } });
  check('ressource créée (confirmation immédiate)', salle && salle.mode === 'IMMEDIATE');

  console.log('— Agent (mobile) : demande, panne, réservation');
  const a = await loginPage(b, 'agent1', MOBILE);
  await a.goto(`${WEB}/logistique`);
  await a.getByRole('heading', { name: 'Logistique' }).waitFor();
  check('agent : pas d’onglet Fournitures, « Mes biens »', (await a.getByRole('tab', { name: /^Fournitures/ }).count()) === 0 && (await a.getByRole('tab', { name: 'Mes biens' }).count()) === 1);
  check('agent : bande « Mes demandes en cours », sans compteur de gestionnaire', (await a.getByTestId('compteur-mes-demandes').count()) === 1 && (await a.getByTestId('compteur-a-traiter').count()) === 0 && (await a.getByTestId('compteur-stock').count()) === 0);
  await a.getByRole('button', { name: 'Nouvelle demande', exact: true }).first().click();
  await dlg(a).getByLabel('Article').selectOption({ label: `Ramette A4 ${S} (Papeterie ${S})` });
  await dlg(a).getByLabel('Quantité (ramette)').fill('2');
  await dlg(a).getByLabel('Objet').fill(`Ramettes pour la note ${S}`);
  check('circuit annoncé : chef puis gestionnaire', await dlg(a).getByText('Circuit : votre chef valide, puis un gestionnaire traite.').isVisible());
  await a.screenshot({ path: `${SHOTS}/d9_nouvelle_demande_mobile.png`, fullPage: true });
  await dlg(a).getByRole('button', { name: 'Envoyer la demande' }).click();
  check('toast « Demande envoyée — votre chef est prévenu », avec « Annuler »', /Votre chef est prévenu/.test(await toast(a, 'Demande envoyée')) && (await a.getByTestId('toast').getByRole('button', { name: 'Annuler' }).count()) === 1);
  check('mobile : pas de défilement horizontal', await sansDefilement(a));
  check('mobile : filtres des demandes repliés derrière « Filtres »', (await a.getByTestId('bouton-filtres').isVisible()) && !(await a.getByRole('combobox', { name: 'Catégorie' }).isVisible()));
  await a.getByRole('tab', { name: 'Mes biens' }).click();
  await a.getByText(`Ordinateur portable ${S}`).click();
  check('fiche du bien (agent) : aucune action de gestion', (await pan(a).getByRole('button', { name: /Affecter|Réaffecter|Changer l’état|Modifier/ }).count()) === 0);
  await pan(a).getByRole('button', { name: 'Signaler une panne' }).click();
  await dlg(a).getByLabel('Objet').waitFor();
  check('demande d’intervention pré-remplie sur le bien', (await dlg(a).getByRole('radio', { name: 'Intervention' }).getAttribute('aria-checked')) === 'true' && /Panne/.test(await dlg(a).getByLabel('Objet').inputValue()));
  await dlg(a).getByRole('button', { name: 'Envoyer la demande' }).click();
  await toast(a, 'Demande envoyée');
  // « Annuler » du message : la demande est annulée par la route existante (le demandeur annule sa demande).
  await a.getByTestId('toast').getByRole('button', { name: 'Annuler' }).click();
  await toast(a, 'Demande annulée');
  const panne = await prisma.demandeLogistique.findFirst({ where: { demandeurId: ids.agent1, type: 'INTERVENTION' }, orderBy: { createdAt: 'desc' } });
  check('« Annuler » du message : demande d’intervention annulée', panne && panne.statut === 'ANNULEE', panne && panne.statut);
  await a.getByRole('tab', { name: /^Réservations/ }).click();
  await creneau(a, '09:00', '11:00');
  await a.getByRole('button', { name: 'Voir les disponibilités' }).click();
  const carteA = a.getByTestId('ressource').filter({ hasText: `Salle de conférence ${S}` });
  await carteA.getByRole('button', { name: 'Réserver' }).click();
  await dlg(a).getByLabel('Objet').fill(`Atelier conjoncture ${S}`);
  await dlg(a).getByRole('button', { name: 'Réserver' }).click();
  await toast(a, 'Réservation confirmée');
  check('réservation confirmée (mobile)', true);
  await a.screenshot({ path: `${SHOTS}/d9_reservations_agent_mobile.png`, fullPage: true });

  console.log('— Pair (bureau) : pas de priorité ; chef (bureau) : validation et priorité');
  const p2 = await loginPage(b, 'agent2');
  await p2.goto(`${WEB}/logistique?onglet=reservations`);
  await creneau(p2, '10:00', '12:00');
  await p2.getByRole('button', { name: 'Voir les disponibilités' }).click();
  const carteP = p2.getByTestId('ressource').filter({ hasText: `Salle de conférence ${S}` });
  await carteP.getByText('Occupée').waitFor();
  check('pair : salle occupée, objet masqué, aucun bouton de priorité', (await carteP.getByRole('button').count()) === 0 && !(await carteP.innerText()).includes('Atelier'));
  const c = await loginPage(b, 'chefssr');
  // Refonte de l'interface : ligne « Demandes logistiques à valider » du bloc « À traiter ».
  const ligneLog = c.getByTestId('a-traiter-logistique-valider');
  const carte = (await ligneLog.innerText()).replace(/\s+/g, ' ');
  const nAv = (await call('chefssr', 'GET', '/logistique/tableau-de-bord')).body.aValider;
  check(`« À traiter » = compteur de l’API (${nAv} à valider)`, nAv >= 2 && carte.includes(`${nAv} Demandes logistiques à valider`), carte);
  await ligneLog.click();
  await c.getByRole('button', { name: 'À valider', exact: true }).click();
  check('demande du chef : « Valider » sur la ligne (droit de l’API)', (await c.getByTestId('ligne-demande').filter({ hasText: `Ramettes pour la note ${S}` }).getByRole('button', { name: 'Valider' }).count()) === 1);
  await c.getByText(`Ramettes pour la note ${S}`).click();
  await pan(c).getByRole('button', { name: 'Valider' }).click();
  await toast(c, 'Demande validée');
  await c.getByRole('tab', { name: /^Réservations/ }).click();
  await creneau(c, '10:00', '12:00');
  await c.getByRole('button', { name: 'Voir les disponibilités' }).click();
  const carteC = c.getByTestId('ressource').filter({ hasText: `Salle de conférence ${S}` });
  await carteC.getByText(`Atelier conjoncture ${S}`).waitFor();
  const api = (await call('chefssr', 'GET', `/logistique/ressources/disponibilite?debut=${new Date(`${JOUR}T10:00`).toISOString()}&fin=${new Date(`${JOUR}T12:00`).toISOString()}`)).body.find((r) => r.id === salle.id);
  check('bouton de priorité affiché = priorité possible selon l’API', api.prioritePossible === ((await carteC.getByRole('button', { name: 'Faire valoir la priorité' }).count()) === 1));
  await carteC.getByRole('button', { name: 'Faire valoir la priorité' }).click();
  check('la fenêtre nomme la personne évincée', /AGENT1 Test/.test(await dlg(c).innerText()));
  await dlg(c).getByLabel('Objet').fill(`Point de section ${S}`);
  await c.screenshot({ path: `${SHOTS}/d9_priorite_chef_desktop.png`, fullPage: true });
  await dlg(c).getByRole('button', { name: 'Prendre le créneau' }).click();
  check('priorité : message de confirmation sans « Annuler » (les réservations évincées ne reviennent pas)', /évincés sont prévenus/.test(await toast(c, 'Réservation confirmée')) && (await c.getByTestId('toast').getByRole('button', { name: 'Annuler' }).count()) === 0);
  await a.reload();
  await a.getByRole('tab', { name: /^Réservations/ }).click();
  await a.getByRole('button', { name: 'Mes réservations', exact: true }).click();
  const ligne = a.getByTestId('ligne-reservation').filter({ hasText: `Atelier conjoncture ${S}` });
  await ligne.getByText('Annulée pour priorité').waitFor();
  check('agent : réservation « annulée pour priorité », prioritaire nommé', /priorité de CHEFSSR Test/.test(await ligne.innerText()));

  console.log('— Gestionnaire : traitement, stock');
  await g.goto(`${WEB}/logistique`);
  await g.getByRole('button', { name: 'À traiter', exact: true }).click();
  check('file du gestionnaire : « Traiter » sur la ligne', (await g.getByTestId('ligne-demande').filter({ hasText: `Ramettes pour la note ${S}` }).getByRole('button', { name: 'Traiter' }).count()) === 1);
  await g.getByText(`Ramettes pour la note ${S}`).click();
  await pan(g).getByRole('button', { name: 'Prendre en charge' }).click();
  await toast(g, 'Demande prise en charge');
  // La liste se recharge en arrière-plan : rouvrir la ligne seulement une fois son nouveau statut affiché
  // (sinon la fiche s'ouvre sur l'état d'avant la prise en charge, sans le bouton « Traiter »).
  const aTraiter = g.getByTestId('ligne-demande').filter({ hasText: `Ramettes pour la note ${S}` });
  await aTraiter.getByText('En traitement').waitFor();
  await aTraiter.click();
  await pan(g).getByRole('button', { name: 'Traiter' }).click();
  await dlg(g).getByLabel('Compte rendu (facultatif)').fill('Remis au bureau');
  await dlg(g).getByRole('button', { name: 'Marquer traitée' }).click();
  await toast(g, 'Demande traitée');
  const art = await prisma.articleFourniture.findFirst({ where: { libelle: `Ramette A4 ${S}` } });
  check('stock : 10 → 8 après traitement', art.stock === 8);
  await g.screenshot({ path: `${SHOTS}/d9_demandes_gestionnaire_desktop.png`, fullPage: true });

  console.log('— Réunion : salle prise en priorité depuis la création');
  const dpe = await loginPage(b, 'chefdpe');
  await dpe.goto(`${WEB}/reunions`);
  await dpe.getByRole('button', { name: /Nouvelle réunion/ }).click();
  // Étape 9 : date (champ date) puis heures de début et de fin.
  const fr = dpe.getByRole('dialog', { name: 'Nouvelle réunion' });
  await fr.getByLabel('Titre').fill(`Comité de division ${S}`);
  await fr.getByLabel('Date', { exact: true }).fill(JOUR);
  await fr.getByLabel('Début', { exact: true }).fill('10:30');
  await fr.getByLabel(/^Fin/).fill('11:30');
  await dpe.waitForFunction(() => document.querySelectorAll('#reunion-salle option').length > 1);
  const proposees = (await dpe.locator('#reunion-salle option').allTextContents()).slice(1);
  const apiSalles = (await call('chefdpe', 'GET', `/logistique/ressources/disponibilite?debut=${new Date(`${JOUR}T10:30`).toISOString()}&fin=${new Date(`${JOUR}T11:30`).toISOString()}&type=SALLE`)).body.filter((r) => r.libre || r.prioritePossible);
  check(`salles proposées = API (libres ou priorité possible : ${apiSalles.length})`, proposees.length === apiSalles.length);
  await dpe.locator('#reunion-salle').selectOption(salle.id);
  check('avertissement de priorité nommant le chef SSR', /CHEFSSR Test/.test(await fr.getByTestId('avertissement-priorite').innerText()));
  await dpe.screenshot({ path: `${SHOTS}/d9_reunion_salle_desktop.png`, fullPage: true });
  await dpe.getByRole('button', { name: 'Créer la réunion' }).click();
  await dpe.getByText(`Comité de division ${S}`).first().waitFor();
  const m = await prisma.meeting.findFirst({ where: { title: `Comité de division ${S}` }, include: { reservation: true } });
  check('réunion créée : lieu = salle, réservation confirmée', m.location === `Salle de conférence ${S}` && m.reservation.statut === 'CONFIRMEE');
  const ev = await prisma.reservation.findFirst({ where: { objet: `Point de section ${S}` } });
  check('réservation du chef SSR annulée pour priorité', ev.statut === 'ANNULEE_PRIORITE' && ev.evinceeParId === ids.chefdpe);

  console.log('— Stagiaire : pas de logistique');
  const stg = (await call('admin', 'POST', '/users', { email: `d9ui${S}@test.local`, password: 'Password123!', firstName: 'Stag', lastName: `Ui${S}`, role: 'STAGIAIRE' })).body.id;
  const s = await loginPage(b, `d9ui${S}`, MOBILE);
  await s.getByRole('button', { name: /menu/i }).click().catch(() => {});
  check('stagiaire : aucune entrée « Logistique »', (await s.getByRole('link', { name: 'Logistique' }).count()) === 0);
  void stg;

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
