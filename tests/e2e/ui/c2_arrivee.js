// C2 — fenêtre d'un courrier arrivé (refonte, étape 5 : étapes, scan, imputation dans la fenêtre, actions à
// droite, historique) et petites fenêtres, parcours réels dans Chromium. Étape 9 : formulaires validés dans
// la fenêtre (message sous le champ, rien d'envoyé), sélecteur de personnes, dates en français, messages de
// confirmation (toasts), squelettes, filtres repliés sur téléphone.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const S = Date.now().toString(36);
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const SHOTS = E.SHOTS;
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
const idDepuisUrl = (u) => new URL(u).searchParams.get('arrivee');
// Toujours dans la fenêtre de formulaire ouverte (la page a aussi ses filtres).
const dlg = (p) => p.locator('div[role=dialog]:has(> form)');
const champ = (p, label) => dlg(p).getByLabel(label, { exact: true });
const optionsDe = (p, label) => champ(p, label).locator('option').allInnerTexts();
// Sélecteur de personnes : options proposées (liste ouverte au clic), choix d'une personne par son nom.
const personne = (zone, label) => zone.getByRole('combobox', { name: label, exact: true });
async function proposes(zone, label) {
  await personne(zone, label).click();
  const l = zone.getByRole('listbox', { name: 'Personnes proposées', exact: true });
  await l.getByRole('option').first().waitFor();
  const t = await l.getByRole('option').allInnerTexts();
  await zone.click({ position: { x: 4, y: 4 } }); // clic à côté : la liste se referme
  return t.map((x) => x.replace(/\n/g, ' — '));
}
async function choisir(zone, label, nom) {
  await personne(zone, label).fill(nom);
  await zone.getByRole('option', { name: new RegExp(nom) }).first().click();
}
// Message sous un champ (validation de la fenêtre) et message de confirmation.
const erreurChamp = (zone) => zone.getByTestId('erreur-champ').first().innerText();
const toast = async (p) => { const t = p.getByTestId('toast'); await t.waitFor(); return t.innerText(); };
// Fenêtre du courrier arrivé et son formulaire « Imputer ce courrier ».
const fen = (p) => p.getByTestId('fenetre-arrivee');
const fi = (p) => p.getByTestId('formulaire-imputer');
const champFi = (p, label) => fi(p).getByLabel(label, { exact: true });
const jourDans = (n) => { const d = new Date(Date.now() + n * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

(async () => {
  await suppleance('dn', 'chefdee');
  const b = await browser();

  console.log('— Enregistrement au registre d’une division (secrétariat DPE)');
  const sec = await loginPage(b, 'secdpe');
  await sec.goto(WEB + '/courrier?onglet=arrivees');
  await sec.getByRole('button', { name: 'Enregistrer un courrier' }).first().click();
  // Liste des registres lue à l'ouverture de la fenêtre (squelette en attendant).
  await champ(sec, 'Registre').waitFor();
  const regs = await optionsDe(sec, 'Registre');
  check('registres proposés = habilitations arrivée de secdpe', regs.length === 1 && /^ARRU/.test(regs[0]), regs.join(' | '));
  check('fenêtre au modèle de l’étape 9 : bouton principal « Enregistrer le courrier », phrase en pied', (await dlg(sec).getByRole('button', { name: 'Enregistrer le courrier' }).count()) === 1 && /À imputer/.test(await dlg(sec).innerText()));
  await dlg(sec).getByRole('button', { name: 'Enregistrer le courrier' }).click();
  check('envoi vide : messages sous les champs (expéditeur, objet), rien d’envoyé', /Indiquez l’expéditeur/.test(await erreurChamp(dlg(sec))) && (await dlg(sec).getByText('Indiquez l’objet du courrier.').count()) === 1 && !/arrivee=/.test(sec.url()));
  const unites = await optionsDe(sec, 'Unité');
  check('unités proposées = celles de ses habilitations (DPE, DEE)', unites.length === 2, unites.join(' | '));
  await champ(sec, 'Unité').selectOption({ index: unites.findIndex((u) => /Prévisions|Planification|DPE/i.test(u)) >= 0 ? unites.findIndex((u) => /Prévisions|Planification|DPE/i.test(u)) : 0 });
  await champ(sec, 'Expéditeur').fill('Ministère du Budget');
  await champ(sec, 'Objet').fill(`Cadrage budgétaire DPE ${S}`);
  await champ(sec, 'Scans (facultatif)').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 scan') });
  await sec.screenshot({ path: `${SHOTS}/c2_enregistrement_desktop.png` });
  await dlg(sec).getByRole('button', { name: 'Enregistrer le courrier' }).click();
  await sec.waitForURL(/arrivee=/);
  check('message de confirmation « Courrier … enregistré »', /Courrier .+ enregistré/.test(await toast(sec)));
  const U = idDepuisUrl(sec.url());
  // Le titre « Courrier arrivé » est provisoire le temps du chargement : attendre « numéro — objet ».
  await fen(sec).getByRole('heading', { name: new RegExp(`— Cadrage budgétaire DPE ${S}$`) }).first().waitFor();
  const numero = await fen(sec).getByRole('heading', { name: new RegExp(`— Cadrage budgétaire DPE ${S}$`) }).first().innerText();
  check('courrier enregistré, numéroté, fenêtre ouverte : titre « numéro — objet »', !!U && numero.endsWith(`— Cadrage budgétaire DPE ${S}`) && /\d/.test(numero.split(' — ')[0]), numero);
  check('fil « Courrier arrivé · Registre … », étape 1 faite, statut « À imputer »', /Courrier arrivé/.test(await fen(sec).getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()) && /^Enregistré le/.test(await fen(sec).getByRole('list', { name: 'Étapes du courrier' }).locator('li').first().innerText()) && (await fen(sec).getByTestId('statut-arrivee').innerText()) === 'À imputer');
  check('scan affiché à côté des informations', (await fen(sec).getByTestId('scans').innerText()).includes('scan.pdf'));
  check('secrétariat : pas de bouton « Imputer » ni de formulaire d’imputation', (await sec.getByRole('button', { name: 'Imputer', exact: true }).count()) === 0 && (await fi(sec).count()) === 0);
  check('secrétariat : « Corriger l’enregistrement », « Ajouter un scan » et « Annuler l’enregistrement »', (await sec.getByRole('button', { name: 'Corriger l’enregistrement' }).count()) === 1 && (await sec.getByRole('button', { name: 'Ajouter un scan' }).count()) === 1 && (await sec.getByRole('button', { name: 'Annuler l’enregistrement' }).count()) === 1);
  check('historique : enregistrement daté', (await fen(sec).getByTestId('historique').innerText()).includes('enregistré au registre'));

  console.log('— DN impute un courrier du registre de la DPE');
  const dn = await loginPage(b, 'dn');
  await dn.goto(`${WEB}/courrier?arrivee=${U}`);
  // Formulaire « Imputer ce courrier » directement dans la fenêtre ; « Imputer » (à droite) l'envoie.
  await personne(fi(dn), 'À').waitFor();
  const liste = await proposes(fi(dn), 'À');
  const imputables = (await call('dn', 'GET', `/courrier/imputables?arriveeId=${U}`)).body;
  check('personnes proposées = GET /courrier/imputables (membres de la DPE)', liste.length === imputables.length && liste.length > 0 && liste.every((t) => !/DEE|AGENTDEE/.test(t)), liste.join(' | '));
  check('pas de case « Ajouter une sous-imputation » (aucune imputation reçue à sous-imputer)', (await fi(dn).getByLabel('Ajouter une sous-imputation').count()) === 0);
  await dn.getByRole('button', { name: 'Imputer', exact: true }).click();
  check('« Imputer » sans destinataire : « Choisissez un destinataire. » sous le champ, rien d’envoyé', (await erreurChamp(fi(dn))) === 'Choisissez un destinataire.' && (await personne(fi(dn), 'À').getAttribute('aria-invalid')) === 'true' && (await dn.locator('[data-testid=imputation]').count()) === 0);
  check('aucun bandeau rouge ni message technique dans le formulaire', (await fi(dn).getByTestId('erreur-formulaire').count()) === 0 && !/must|imputeAId|Bad Request|Internal/i.test(await fi(dn).innerText()));
  await dn.screenshot({ path: `${SHOTS}/c2_arrivee_imputer_validation_desktop.png` });
  await choisir(fi(dn), 'À', 'CHEFSSR');
  check('choix fait : message effacé', (await fi(dn).getByTestId('erreur-champ').count()) === 0);
  await champFi(dn, 'Instruction (facultatif)').fill('Préparer une note de cadrage.');
  await champFi(dn, 'Échéance de traitement (facultatif)').fill(jourDans(5));
  await dn.getByRole('radio', { name: 'Pour attribution' }).click();
  await dn.screenshot({ path: `${SHOTS}/c2_arrivee_imputer_desktop.png` });
  await dn.getByRole('button', { name: 'Imputer', exact: true }).click();
  check('message de confirmation « Courrier imputé — CHEFSSR … a été prévenu(e) »', /Courrier imputé[\s\S]*CHEFSSR Test a été prévenu/.test(await toast(dn)));
  await dn.locator('[data-testid=imputation]').first().waitFor();
  check('imputation affichée dans l’arbre', (await dn.locator('[data-testid=imputation]').first().innerText()).includes('CHEFSSR'));
  await fen(dn).getByTestId('statut-arrivee').getByText('Imputé', { exact: true }).waitFor();
  check('statut « Imputé », historique « imputé à CHEFSSR »', /imputé à CHEFSSR/.test(await fen(dn).getByTestId('historique').innerText()));
  check('DN (imputant) : « Convertir en tâche » proposé', (await dn.getByRole('button', { name: 'Convertir en tâche' }).count()) === 1);
  await dn.screenshot({ path: `${SHOTS}/c2_arrivee_contenu_desktop.png` });

  console.log('— Lien d’email : l’imputé ouvre, sous-impute, traite');
  const ssr = await loginPage(b, 'chefssr');
  await ssr.goto(`${WEB}/courrier?arrivee=${U}`);
  await ssr.getByRole('button', { name: 'Sous-imputer' }).click();
  await personne(dlg(ssr), 'Imputer à').waitFor();
  const sous = await proposes(dlg(ssr), 'Imputer à');
  const sousApi = (await call('chefssr', 'GET', `/courrier/imputables?imputationId=${(await call('chefssr', 'GET', `/courrier/arrivees/${U}`)).body.imputations[0].id}`)).body;
  check('sous-imputation : liste = son périmètre selon l’API', sous.length === sousApi.length && sous.length > 0, sous.join(' | '));
  await dlg(ssr).getByRole('button', { name: 'Sous-imputer' }).click();
  check('sous-imputation vide : message sous le champ, fenêtre ouverte', (await erreurChamp(dlg(ssr))) === 'Choisissez un destinataire.' && (await dlg(ssr).count()) === 1);
  await choisir(dlg(ssr), 'Imputer à', 'AGENT1');
  await dlg(ssr).getByRole('button', { name: 'Sous-imputer' }).click();
  check('toast « Courrier sous-imputé »', /Courrier sous-imputé/.test(await toast(ssr)));
  await ssr.locator('[data-testid=imputation] [data-testid=imputation]').first().waitFor();
  check('sous-imputation affichée sous l’imputation', (await ssr.locator('[data-testid=imputation] [data-testid=imputation]').first().innerText()).includes('AGENT1'));
  await ssr.getByRole('button', { name: 'Marquer traité' }).first().click();
  await champ(ssr, 'Compte rendu (facultatif)').fill('Note transmise.');
  await ssr.getByRole('dialog', { name: 'Marquer comme traité' }).getByRole('button', { name: 'Marquer traité' }).click();
  await ssr.getByText('« Note transmise. »').waitFor();
  check('traitement affiché avec son compte rendu, toast « Imputation traitée »', /Imputation traitée/.test(await toast(ssr)));

  console.log('— Refus affichés (messages de l’API)');
  const dee = await loginPage(b, 'agentdee');
  await dee.goto(`${WEB}/courrier?arrivee=${U}`);
  const refus = fen(dee).getByRole('alert');
  await refus.waitFor();
  check('lien vers un courrier hors périmètre : message 403 de l’API', (await refus.innerText()).length > 5, await refus.innerText());
  const A2 = (await require('../lib').upload('secdpe', '/courrier/arrivees', { registreId: require(E.etat('registres.json')).ARRU, uniteKey: `DIV:${ids.DPE}`, dateReception: iso(0), expediteur: 'Test', objet: `Refus ${S}`, confidentialite: 'ORDINAIRE' })).body;
  await dn.goto(`${WEB}/courrier?arrivee=${A2.id}`);
  await dn.getByRole('button', { name: 'Imputer', exact: true }).waitFor();
  await personne(fi(dn), 'À').waitFor();
  await choisir(fi(dn), 'À', 'CHEFSSR');
  await call('secdpe', 'POST', `/courrier/arrivees/${A2.id}/annuler`, { motif: 'Annulé pendant la saisie' });
  await dn.getByRole('button', { name: 'Imputer', exact: true }).click();
  const r409 = fi(dn).getByTestId('erreur-formulaire');
  await r409.waitFor();
  check('courrier annulé entre-temps : refus 409 de l’API affiché en français sous le formulaire', /annulé/i.test(await r409.innerText()), await r409.innerText());

  console.log('— Pli personnel');
  await sec.close();
  const sdg = await loginPage(b, 'secdg');
  await sdg.goto(WEB + '/courrier?onglet=arrivees');
  await sdg.getByRole('button', { name: 'Enregistrer un courrier' }).first().click();
  await dlg(sdg).getByRole('radio', { name: 'Pli personnel (fermé)' }).click();
  check('pli personnel : ni objet ni scan dans le formulaire', (await champ(sdg, 'Objet').count()) === 0 && (await champ(sdg, 'Scans (facultatif)').count()) === 0);
  await champ(sdg, 'Expéditeur').fill('Cabinet du Ministre');
  await dlg(sdg).getByRole('button', { name: 'Enregistrer le courrier' }).click();
  check('destinataire obligatoire : « Choisissez un destinataire. » sous le champ, rien d’envoyé', (await erreurChamp(dlg(sdg))) === 'Choisissez un destinataire.' && !/arrivee=/.test(sdg.url()));
  await choisir(dlg(sdg), 'Destinataire', 'CHEFDPE');
  await dlg(sdg).getByRole('button', { name: 'Enregistrer le courrier' }).click();
  await sdg.waitForURL(/arrivee=/);
  const P = idDepuisUrl(sdg.url());
  await sdg.locator('[data-testid=pli-personnel]').waitFor();
  check('secrétariat : carte « pli personnel » seule', (await sdg.locator('[data-testid=pli-personnel]').innerText()).includes('CHEFDPE'));
  await sdg.screenshot({ path: `${SHOTS}/c2_pli_personnel_desktop.png` });
  const dpe = await loginPage(b, 'chefdpe');
  await dpe.goto(`${WEB}/courrier?arrivee=${P}`);
  await dpe.getByRole('button', { name: 'Compléter le pli' }).click();
  await champ(dpe, 'Objet').fill('Invitation personnelle');
  await dpe.getByRole('dialog', { name: 'Compléter le pli' }).getByRole('button', { name: 'Enregistrer' }).click();
  await dpe.getByText('Invitation personnelle').waitFor();
  await dpe.getByRole('button', { name: 'Requalifier' }).click();
  await dpe.getByRole('button', { name: 'Requalifier définitivement' }).click();
  check('requalification : confirmation exigée (message sous la case)', /définitive/.test(await erreurChamp(dpe.getByRole('dialog', { name: 'Requalifier le pli' }))));
  await dlg(dpe).getByLabel(/Je comprends/).check();
  await dpe.getByRole('button', { name: 'Requalifier définitivement' }).click();
  await fen(dpe).getByTestId('niveau').getByText('Confidentiel', { exact: true }).waitFor();
  check('pli requalifié CONFIDENTIEL, toast « Pli requalifié »', /Pli requalifié/.test(await toast(dpe)));

  console.log('— Confidentiel : contenu protégé, accès délégués, intérim');
  const K = (await require('../lib').upload('secdg', '/courrier/arrivees', { registreId: require(E.etat('registres.json')).ARR, dateReception: iso(0), expediteur: 'Présidence', objet: `Note confidentielle ${S}`, confidentialite: 'CONFIDENTIEL' }, [{ name: 'k.txt' }])).body;
  await sdg.goto(`${WEB}/courrier?arrivee=${K.id}`);
  await sdg.locator('[data-testid=contenu-protege]').waitFor();
  check('secrétariat : bandeau « Contenu protégé », ni scans ni imputations', (await sdg.locator('[data-testid=imputations]').count()) === 0 && (await sdg.getByText('k.txt').count()) === 0);
  const pi = await loginPage(b, 'chefdee');
  await pi.getByRole('button', { name: /Agir en intérim/ }).first().click();
  await pi.getByRole('menuitemradio', { name: /DN Test/ }).click();
  await pi.getByText('Mode intérim').waitFor();
  await pi.goto(`${WEB}/courrier?arrivee=${K.id}`);
  const refusPi = fen(pi).getByRole('alert');
  await refusPi.waitFor();
  check('P.I. du DN sans accès ouvert : message de l’API', (await refusPi.innerText()).length > 5, await refusPi.innerText());
  await dn.goto(`${WEB}/courrier?arrivee=${K.id}`);
  await dn.getByRole('button', { name: 'Ouvrir un accès' }).click();
  await personne(dlg(dn), 'Bénéficiaire').waitFor();
  const benef = await proposes(dlg(dn), 'Bénéficiaire');
  check('bénéficiaires proposés : son assistante et son suppléant', benef.length === 2 && benef.some((t) => /ASSDN/.test(t)) && benef.some((t) => /CHEFDEE/.test(t)), benef.join(' | '));
  await choisir(dlg(dn), 'Bénéficiaire', 'CHEFDEE');
  await dn.getByRole('button', { name: 'Ouvrir l’accès' }).click();
  check('toast « Accès ouvert »', /Accès ouvert/.test(await toast(dn)));
  await dn.locator('[data-testid=acces-delegues] li').first().waitFor();
  check('accès ouvert listé, révocable', (await dn.locator('[data-testid=acces-delegues] li').first().innerText()).includes('Révoquer'));
  await pi.reload();
  await fi(pi).waitFor();
  const mention = fi(pi).getByText(/Sera enregistré par vous/);
  check('P.I. : « Sera enregistré par vous, au nom de DN Test »', (await mention.innerText()).includes('au nom de DN Test'), await mention.innerText());
  await personne(fi(pi), 'À').waitFor();
  await choisir(fi(pi), 'À', 'CHEFSAF');
  await fi(pi).getByLabel('Créer aussi une tâche pour le suivi').check();
  await pi.getByRole('button', { name: 'Imputer', exact: true }).click();
  check('« Créer aussi une tâche » sans échéance : message sous l’échéance, rien d’envoyé', /échéance/i.test(await erreurChamp(fi(pi))) && (await pi.locator('[data-testid=imputation]').count()) === 0);
  await champFi(pi, 'Échéance de traitement').fill(jourDans(4));
  await pi.getByRole('button', { name: 'Imputer', exact: true }).click();
  await pi.locator('[data-testid=imputation]').first().waitFor();
  const ligne = await pi.locator('[data-testid=imputation]').first().innerText();
  check('imputation P.I. : « par CHEFDEE P.I. de DN »', /CHEFDEE Test\s+P\.I\.\s+de DN Test/.test(ligne), ligne.replace(/\n/g, ' / '));
  await pi.locator('[data-testid=imputation]').first().getByRole('link', { name: /Tâche associée/ }).waitFor();
  const kApi = (await call('chefdee', 'GET', `/courrier/arrivees/${K.id}`, undefined, { 'X-Interim-For': ids.dn })).body;
  check('« Créer aussi une tâche pour le suivi » : tâche créée (conversion existante)', !!kApi.imputations[0].tache, JSON.stringify(kApi.imputations[0].tache));

  console.log('— Mobile');
  const mr = await loginPage(b, 'chefdpe', { width: 390, height: 844 });
  await mr.goto(`${WEB}/courrier?onglet=arrivees`);
  await mr.getByTestId('bouton-filtres').waitFor();
  check('téléphone : filtres repliés derrière « Filtres », page sans débordement', (await mr.getByRole('combobox', { name: 'Statut' }).isVisible()) === false && (await mr.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await mr.getByTestId('bouton-filtres').click();
  await mr.getByRole('dialog', { name: 'Filtres' }).getByRole('combobox', { name: 'Statut' }).selectOption('IMPUTE');
  await mr.getByRole('dialog', { name: 'Filtres' }).getByRole('button', { name: 'Appliquer' }).click();
  check('téléphone : bouton « Filtres (1) » après un filtre', (await mr.getByTestId('bouton-filtres').innerText()).trim() === 'Filtres (1)', await mr.getByTestId('bouton-filtres').innerText());
  await mr.close();
  const m = await loginPage(b, 'chefdpe', { width: 390, height: 844 });
  await m.goto(`${WEB}/courrier?arrivee=${U}`);
  await m.locator('[data-testid=imputation]').first().waitFor();
  const larg = await m.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('[role=dialog]').scrollWidth]);
  check('mobile : tiroir pleine largeur, sans défilement horizontal', larg[0] <= 390 && larg[1] <= 390, JSON.stringify(larg));
  await m.screenshot({ path: `${SHOTS}/c2_arrivee_contenu_mobile.png`, fullPage: false });
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
