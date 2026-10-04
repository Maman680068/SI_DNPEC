// Lot D2 — écran : relevé de décisions dans le détail d'une réunion (organisateur, hiérarchie).
// Refonte de l'interface (étape 6) : fenêtre de réunion en deux colonnes (réponse / actions à droite),
// panneau « Décisions à suivre » de la page Réunions, réponse « Je participe » / « Absent » sur la ligne.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
async function attendre(f) { for (let i = 0; i < 40; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
(async () => {
  const m = (await call('chefdpe', 'POST', '/meetings', { title: `Comité de direction DPE ${S}`, startAt: iso(-J), location: 'Salle de réunion', participantIds: [ids.agent1, ids.chefssr] })).body;
  const b = await browser();
  const sec = (p) => p.locator('section[aria-label="Relevé de décisions"]');
  const item = (p, txt) => sec(p).locator('[data-testid=decision]', { hasText: txt });

  console.log('— Organisateur (bureau)');
  const p = await loginPage(b, 'chefdpe');
  p.on('dialog', (d) => d.accept());
  await p.goto(`${WEB}/reunions?id=${m.id}`);
  await sec(p).getByText('Aucune décision consignée.').waitFor();
  check('lien profond ?id= : tiroir ouvert, relevé vide', true);
  for (const t of [`Relancer le recensement des effectifs ${S}`, `Valider le calendrier des formations ${S}`, `Diffuser le compte rendu ${S}`]) {
    await sec(p).getByLabel('Nouvelle décision').fill(t);
    await sec(p).getByRole('button', { name: 'Ajouter la décision' }).click();
    await item(p, t).waitFor();
  }
  check('trois décisions ajoutées', (await sec(p).locator('[data-testid=decision]').count()) === 3);
  await item(p, 'Diffuser').getByRole('button', { name: 'Modifier' }).click();
  await item(p, 'Diffuser').getByLabel('Texte de la décision').fill(`Diffuser le compte rendu à toutes les sections ${S}`);
  await item(p, 'Diffuser').getByRole('button', { name: 'Enregistrer' }).click();
  await item(p, 'toutes les sections').waitFor();
  check('modification enregistrée', true);

  const d1 = await prisma.decision.findFirst({ where: { content: { startsWith: 'Relancer le recensement' }, meetingId: m.id } });
  const api = (await call('chefdpe', 'GET', `/decisions/${d1.id}/responsables-possibles`)).body.map((u) => u.id).sort();
  await item(p, 'recensement').getByRole('button', { name: 'Convertir en action' }).click();
  const sel = item(p, 'recensement').getByLabel('Responsable');
  await attendre(async () => (await sel.locator('option').count()) > 1);
  const ecran = (await sel.locator('option').evaluateAll((os) => os.map((o) => o.value))).filter(Boolean).sort();
  check(`liste des responsables = réponse de l’API (${ecran.length})`, JSON.stringify(ecran) === JSON.stringify(api));
  await sel.selectOption(ids.agent1);
  await item(p, 'recensement').getByLabel('Échéance').fill(new Date(Date.now() + 14 * J).toISOString().slice(0, 10));
  await item(p, 'recensement').getByLabel(/Intitulé/).fill(`Recensement des effectifs ${S}`);
  await item(p, 'recensement').getByRole('button', { name: 'Créer la tâche' }).click();
  await item(p, 'recensement').getByRole('link', { name: `Recensement des effectifs ${S}` }).waitFor();
  const txt = await item(p, 'recensement').innerText();
  check('action liée : « Tâche créée », statut « À faire » et échéance', /Tâche créée/.test(txt) && /À faire, échéance/.test(txt), txt.replace(/\n/g, ' | '));
  check('plus de bouton « Convertir » après conversion', (await item(p, 'recensement').getByRole('button', { name: 'Convertir en action' }).count()) === 0);
  await item(p, 'calendrier').getByRole('button', { name: 'Clôturer' }).click();
  await item(p, 'calendrier').getByText('Clôturée').waitFor();
  check('clôture : badge et aucun bouton', (await item(p, 'calendrier').getByRole('button').count()) === 0);
  await p.screenshot({ path: `${SHOTS}/d2_decisions_organisateur_desktop.png`, fullPage: false });
  const lien = await item(p, 'recensement').getByRole('link').getAttribute('href');
  await item(p, 'recensement').getByRole('link').click();
  await p.waitForURL(`**${lien}`);
  await p.getByText(`Recensement des effectifs ${S}`).first().waitFor();
  check('le lien ouvre la tâche', lien.startsWith('/tasks/'));

  console.log('— DN (mobile) : consultation et relance');
  const q = await loginPage(b, 'dn', { width: 390, height: 844 });
  await q.goto(`${WEB}/reunions?id=${m.id}`);
  await item(q, 'recensement').waitFor();
  check('DN : pas de champ d’ajout', (await sec(q).getByLabel('Nouvelle décision').count()) === 0);
  check('DN : ni Modifier, ni Convertir, ni Clôturer', (await sec(q).getByRole('button', { name: /Modifier|Convertir|Clôturer/ }).count()) === 0);
  check('DN : « Relancer » sur les 2 décisions ouvertes seulement', (await sec(q).getByRole('button', { name: 'Relancer l’organisateur' }).count()) === 2);
  const avant = await prisma.notification.count({ where: { userId: ids.chefdpe, type: 'DECISION_RELANCE', channel: 'IN_APP' } });
  await item(q, 'toutes les sections').getByRole('button', { name: 'Relancer l’organisateur' }).click();
  await item(q, 'toutes les sections').getByText('Relance envoyée à l’organisateur.').waitFor();
  check('relance : l’organisateur est notifié', await attendre(async () => (await prisma.notification.count({ where: { userId: ids.chefdpe, type: 'DECISION_RELANCE', channel: 'IN_APP' } })) === avant + 1));
  await q.screenshot({ path: `${SHOTS}/d2_decisions_dn_mobile.png`, fullPage: true });
  const largeur = await q.evaluate(() => document.documentElement.scrollWidth);
  check('mobile : pas de défilement horizontal', largeur <= 390, String(largeur));

  console.log('— Participant Chargé d’Études');
  const r = await loginPage(b, 'agent1');
  await r.goto(`${WEB}/reunions?id=${m.id}`);
  await item(r, 'recensement').waitFor();
  check('participant : consultation, relance seulement', (await sec(r).getByRole('button', { name: /Modifier|Convertir|Clôturer/ }).count()) === 0 && (await sec(r).getByLabel('Nouvelle décision').count()) === 0);

  console.log('— Fenêtre : réponse de l’invité dans la colonne de droite');
  const reponse = r.getByRole('group', { name: new RegExp(`Votre réponse à « Comité de direction DPE ${S} »`) });
  await reponse.getByRole('button', { name: 'Je participe' }).click();
  check('« Je participe » : enregistré (API) et marqué', await attendre(async () => (await prisma.meetingParticipant.findFirst({ where: { meetingId: m.id, userId: ids.agent1 } })).responseStatus === 'CONFIRME') && (await reponse.getByRole('button', { name: 'Je participe' }).getAttribute('aria-pressed')) === 'true');
  check('invité : ni « Annuler la réunion » ni « Modifier la réunion »', (await r.getByRole('button', { name: /Annuler la réunion|Modifier la réunion/ }).count()) === 0);
  await r.keyboard.press('Escape');

  console.log('— Page Réunions : décisions à suivre, réponse sur la ligne');
  const futur = (await call('chefdpe', 'POST', '/meetings', { title: `Atelier à venir ${S}`, startAt: iso(3 * J), endAt: iso(3 * J + 3_600_000), participantIds: [ids.agent1] })).body;
  await r.goto(`${WEB}/reunions`);
  const ligne = r.locator('[data-testid=reunion]', { hasText: `Atelier à venir ${S}` });
  await ligne.waitFor();
  await ligne.getByRole('button', { name: 'Absent' }).click();
  check('ligne « À venir » : « Absent » enregistré', await attendre(async () => (await prisma.meetingParticipant.findFirst({ where: { meetingId: futur.id, userId: ids.agent1 } })).responseStatus === 'DECLINE'));
  await r.getByLabel('Réunions affichées').selectOption('organisees');
  check('filtre « Organisées par moi » : la réunion du chef masquée', await attendre(async () => (await ligne.count()) === 0));
  await r.getByLabel('Réunions affichées').selectOption('invite');
  await ligne.waitFor();
  check('filtre « Où je suis invité » : la réunion affichée', true);
  const panneau = r.locator('[data-testid=decisions-a-suivre]');
  await panneau.getByText(`Relancer le recensement des effectifs ${S}`).waitFor();
  const suivre = (await call('agent1', 'GET', '/api/v1/decisions/a-suivre')).body;
  check(`« Décisions à suivre » = API (${suivre.decisions.length})`, (await panneau.locator('[data-testid=decision-a-suivre]').count()) === suivre.decisions.length);
  check('décision convertie : « devenue une tâche · à faire »', /devenue une tâche · à faire/.test(await panneau.locator('[data-testid=decision-a-suivre]', { hasText: `recensement des effectifs ${S}` }).innerText()));
  check('décision clôturée : « fait »', /· fait/.test(await panneau.locator('[data-testid=decision-a-suivre]', { hasText: `calendrier des formations ${S}` }).innerText()));
  await panneau.locator('[data-testid=decision-a-suivre]', { hasText: `recensement des effectifs ${S}` }).getByRole('button').click();
  await r.getByRole('heading', { name: `Comité de direction DPE ${S}` }).waitFor();
  check('clic sur une décision : la fenêtre de sa réunion', true);
  await r.screenshot({ path: `${SHOTS}/d2_reunions_fenetre_desktop.png` });
  await r.keyboard.press('Escape');
  await r.screenshot({ path: `${SHOTS}/d2_reunions_page_desktop.png`, fullPage: true });

  console.log('— Fenêtre (organisateur) : en-tête, participants, compte rendu');
  const o = await loginPage(b, 'chefdpe', { width: 1440, height: 900 });
  await o.goto(`${WEB}/reunions?id=${m.id}`);
  const f = o.locator('[data-testid=fenetre-reunion]');
  await f.getByRole('heading', { name: `Comité de direction DPE ${S}` }).waitFor();
  const nbParticipants = (await call('chefdpe', 'GET', `/meetings/${m.id}`)).body.participants.length;
  const ent = await f.innerText();
  check(`en-tête : « Réunion · organisée par vous », salle, ${nbParticipants} participants`, /Réunion · organisée par vous/.test(ent) && /Salle de réunion/.test(ent) && ent.includes(`${nbParticipants} participants`), ent.slice(0, 200).replace(/\n/g, ' | '));
  const part = f.locator('[data-testid=participants-reunion]');
  check('participants : agent1 « Présent » (réponse donnée), cheffe de section « Sans réponse »', /Présent/.test(await part.innerText()) && /Sans réponse/.test(await part.innerText()));
  check('organisateur : pas de « Je participe »', (await f.getByRole('button', { name: 'Je participe' }).count()) === 0);
  await f.getByRole('button', { name: 'Rédiger ou déposer le compte rendu' }).click();
  const fm = o.getByRole('dialog', { name: 'Modifier la réunion' });
  await fm.getByLabel('Compte rendu').fill(`Points abordés ${S}`);
  await fm.getByRole('button', { name: 'Enregistrer' }).click();
  await f.locator('[data-testid=compte-rendu]').getByText(`Points abordés ${S}`).waitFor();
  check('compte rendu enregistré (PATCH /meetings/:id) et affiché', (await call('chefdpe', 'GET', `/meetings/${m.id}`)).body.minutesText === `Points abordés ${S}`);
  await o.screenshot({ path: `${SHOTS}/d2_reunion_fenetre_organisateur.png` });
  check('invité : modification refusée par l’API (403)', (await call('agent1', 'PATCH', `/meetings/${m.id}`, { minutesText: 'x' })).status === 403);
  await o.context().close();

  console.log('— Page Réunions sur téléphone');
  const t = await loginPage(b, 'agent1', { width: 390, height: 844 });
  await t.goto(`${WEB}/reunions`);
  await t.locator('[data-testid=semaine-reunions]').waitFor();
  check('téléphone : calendrier de la semaine (5 jours) et liste', (await t.locator('[data-testid=jour-semaine]').count()) === 5 && (await t.locator('[data-testid=liste-reunions]').count()) === 1);
  await t.getByRole('button', { name: 'Semaine suivante' }).click();
  await t.getByRole('button', { name: 'Aujourd’hui' }).click();
  check('téléphone : semaine courante, aujourd’hui marqué (jour ouvré)', [0, 6].includes(new Date().getDay()) || (await t.locator('[data-testid=jour-semaine][aria-current=date]').count()) === 1);
  const l = await t.evaluate(() => document.documentElement.scrollWidth);
  check('téléphone : pas de défilement horizontal (Réunions)', l <= 390, String(l));
  await t.screenshot({ path: `${SHOTS}/d2_reunions_mobile.png`, fullPage: true });

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
