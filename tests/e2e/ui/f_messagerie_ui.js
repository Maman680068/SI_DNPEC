// Correctif : pastille de l'icône messagerie = messages reçus non lus (API puis Chromium).
// Refonte de l'interface (étape 6) : onglets à compteur, trois colonnes (conversations, échange, fiche
// de l'interlocuteur), séparateurs de jour, « Lu à », document des Archives cité affiché en carte
// (cliquable seulement pour qui peut l'ouvrir), trombone ; bureau et téléphone.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');
const { call, upload, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
async function attendre(f) { for (let i = 0; i < 40; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
const compte = async (k) => (await call(k, 'GET', '/messages/unread-count')).body;
(async () => {
  // Point de départ : agent2 n'a aucun message non lu (remise à zéro de la base de test).
  await prisma.directMessage.updateMany({ where: { recipientId: ids.agent2, readAt: null }, data: { readAt: new Date() } });
  console.log('— API');
  check('agent2 : 0 non lu au départ', (await compte('agent2')) === 0);
  const avantAgent1 = await compte('agent1');
  for (let i = 1; i <= 2; i++) await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `Bonjour ${S} n°${i}` });
  await call('chefdpe', 'POST', '/messages', { recipientId: ids.agent2, body: `Note du chef ${S}` });
  check('agent2 : 3 non lus (2 d’agent1, 1 du chef)', (await compte('agent2')) === 3);
  check('l’expéditeur n’est pas compté (agent1 inchangé)', (await compte('agent1')) === avantAgent1);
  const m = await prisma.directMessage.findFirst({ where: { recipientId: ids.agent2, body: `Note du chef ${S}` } });
  check('marquer lu le message d’un autre → 404', (await call('agent1', 'PATCH', `/messages/${m.id}/read`)).status === 404);
  await call('agent2', 'PATCH', `/messages/${m.id}/read`);
  check('agent2 : 2 non lus après lecture du message du chef', (await compte('agent2')) === 2);

  console.log('— Chromium');
  const b = await browser();
  const p = await loginPage(b, 'agent2');
  const pastille = p.locator('[data-testid=compteur-messages]');
  await pastille.waitFor();
  check('pastille = 2 (valeur de l’API)', (await pastille.innerText()) === '2');
  check('libellé accessible', (await p.getByRole('link', { name: 'Messagerie : 2 messages non lus' }).count()) === 1);
  await p.goto(`${WEB}/communication?with=${ids.agent1}`);
  await p.getByText(`Bonjour ${S} n°2`).last().waitFor();
  check('conversation ouverte : pastille retirée', await attendre(async () => (await pastille.count()) === 0));
  check('API : 0 non lu', (await compte('agent2')) === 0);
  const q = await loginPage(b, 'agent1', { width: 390, height: 844 });
  check('sans message non lu : aucune pastille (mobile)', await attendre(async () => (await q.locator('header').getByRole('link', { name: /^Messagerie/ }).count()) === 1) && (await q.locator('[data-testid=compteur-messages]').count()) === (avantAgent1 > 0 ? 1 : 0));
  await p.context().close(); await q.context().close();

  console.log('— Refonte : trois colonnes, document cité, « Lu à »');
  const doc = (await upload('agent1', '/documents', { title: `Projections ${S}`, divisionId: ids.DPE, typeDocument: 'NOTE_TECHNIQUE', periodeDebut: '2026-07-01', periodeFin: '2026-09-30' }, [{ field: 'file', name: 'projections.xlsx' }])).body;
  check('document privé de la DPE déposé par agent1', !!doc.id);
  await call('agentdee', 'POST', '/messages', { recipientId: ids.agent1, body: `Peux-tu m’envoyer les projections ${S} ?` });
  const a1 = await loginPage(b, 'agent1', { width: 1440, height: 900 });
  await a1.goto(`${WEB}/communication`);
  await a1.locator('[data-testid=conversation]').first().waitFor();
  await a1.waitForFunction(() => /Sondages/.test(document.querySelector('[role=tablist]')?.textContent || ''));
  const onglets = await a1.getByRole('tablist', { name: 'Rubriques de la communication' }).getByRole('tab').allInnerTexts();
  check(`onglets : Messages, Fils de discussion, Annonces, Sondages (${onglets.map((t) => t.replace(/\s+/g, ' ')).join(' | ')})`, ['Messages', 'Fils de discussion', 'Annonces', 'Sondages'].every((t, i) => (onglets[i] || '').startsWith(t)));
  const nonLusApi = (await call('agent1', 'GET', '/messages/unread-count')).body;
  // Le compteur arrive après la liste : l'attendre avant de relire les onglets.
  if (nonLusApi) await a1.waitForFunction((n) => new RegExp(`^Messages\\s*${n}$`).test((document.querySelector('[role=tab]')?.textContent || '').trim()), nonLusApi, { timeout: 8000 }).catch(() => {});
  onglets[0] = (await a1.getByRole('tablist', { name: 'Rubriques de la communication' }).getByRole('tab').first().innerText());
  check(`compteur de l’onglet Messages = non lus de l’API (${nonLusApi})`, nonLusApi === 0 || new RegExp(`^Messages\\s*${nonLusApi}$`).test(onglets[0].trim()), onglets[0]);
  const conv = a1.locator('[data-testid=conversation]', { hasText: 'AGENTDEE' });
  check('conversation non lue : signalée (point doré)', /non lu/.test((await conv.getAttribute('aria-label')) || ''));
  await a1.getByLabel('Rechercher une conversation').fill('agentdee');
  check('recherche : la liste filtrée', (await a1.locator('[data-testid=conversation]').count()) === 1);
  await conv.click();
  await a1.locator('[data-testid=echange]').getByText(`Peux-tu m’envoyer les projections ${S} ?`).waitFor();
  check('séparateur « Aujourd’hui »', (await a1.locator('[data-testid=separateur-jour]', { hasText: 'Aujourd’hui' }).count()) >= 1);
  const fiche = a1.locator('[data-testid=fiche-interlocuteur]').first();
  await fiche.getByText('AGENTDEE Test').waitFor();
  await fiche.getByText(/ · /).first().waitFor({ timeout: 8000 }).catch(() => {}); // fonction · unité : seconde requête
  check('fiche : nom, fonction · unité', / · /.test(await fiche.innerText()));
  await a1.getByRole('button', { name: 'Joindre un document des Archives' }).click();
  await a1.locator('[data-testid=choix-document]').getByRole('searchbox').fill(`Projections ${S}`);
  await a1.locator('[data-testid=choix-document]').getByRole('button', { name: `Projections ${S}` }).click();
  await a1.locator('[data-testid=document-joint]').waitFor();
  await a1.getByLabel('Votre message').fill(`Voici le document ${S} :`);
  await a1.getByRole('button', { name: 'Envoyer' }).click();
  const carte = a1.locator('a[data-testid=document-cite]', { hasText: `Projections ${S}` });
  await carte.waitFor();
  check('carte du document : lien vers les Archives, chemin et version', (await carte.getAttribute('href')) === `/documents?id=${doc.id}` && /Archives/.test(await carte.innerText()) && /v1/.test(await carte.innerText()));
  await fiche.locator('[data-testid=documents-echanges]').getByText(`Projections ${S}`).waitFor();
  check('fiche : « Documents échangés » contient le document', true);
  await a1.screenshot({ path: `${E.SHOTS}/f_messagerie_bureau.png` });

  console.log('— Le destinataire ne voit pas le document (autre division)');
  const dee = await loginPage(b, 'agentdee', { width: 1440, height: 900 });
  await dee.goto(`${WEB}/communication?with=${ids.agent1}`);
  await dee.locator('[data-testid=echange]').getByText(`Voici le document ${S} :`).waitFor();
  const muette = dee.locator('[data-testid=document-cite]').last();
  await dee.waitForFunction(() => /pas accès/.test([...document.querySelectorAll('[data-testid=document-cite]')].pop()?.textContent || ''));
  check('carte muette, sans lien ni titre', (await dee.locator('a[data-testid=document-cite]').count()) === 0 && !(await muette.innerText()).includes(`Projections ${S}`));
  check('fiche : le document n’est pas listé', (await dee.locator('[data-testid=documents-echanges]').count()) === 0);
  await dee.context().close();
  await a1.goto(`${WEB}/communication?with=${ids.agentdee}`);
  await a1.locator('[data-testid=lu-a]').waitFor();
  check('expéditeur : « Lu à HH:MM » sous le dernier message envoyé', /Lu à \d\d:\d\d/.test(await a1.locator('[data-testid=lu-a]').innerText()));
  await a1.context().close();

  console.log('— Téléphone (390) : liste puis échange, sans défilement horizontal');
  const t = await loginPage(b, 'agent1', { width: 390, height: 844 });
  await t.goto(`${WEB}/communication`);
  await t.locator('[data-testid=conversation]').first().waitFor();
  check('téléphone : liste sans défilement horizontal', await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await t.locator('[data-testid=conversation]', { hasText: 'AGENTDEE' }).click();
  await t.locator('[data-testid=echange]').getByText(`Voici le document ${S} :`).waitFor();
  check('téléphone : échange ouvert, liste masquée, sans défilement horizontal', (await t.locator('[data-testid=conversation]').first().isVisible()) === false && (await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)));
  await t.getByRole('button', { name: 'Fiche de l’interlocuteur' }).click();
  await t.locator('[data-testid=fiche-interlocuteur]').filter({ hasText: 'AGENTDEE Test' }).first().waitFor();
  check('téléphone : fiche de l’interlocuteur accessible', true);
  await t.screenshot({ path: `${E.SHOTS}/f_messagerie_mobile.png` });
  await t.getByRole('button', { name: 'Retour à la liste des conversations' }).click();
  await t.locator('[data-testid=conversation]').first().waitFor();
  check('téléphone : retour à la liste', true);

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
