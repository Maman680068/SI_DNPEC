// Lot D2 — écran : relevé de décisions dans le détail d'une réunion (organisateur, hiérarchie).
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
  check('action liée : statut « À faire » et échéance', /Action en cours/.test(txt) && /À faire, échéance/.test(txt), txt.replace(/\n/g, ' | '));
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

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
