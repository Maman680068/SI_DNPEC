// Correctif : pastille de l'icône messagerie = messages reçus non lus (API puis Chromium).
// Refonte de l'interface (étape 6) : onglets à compteur, trois colonnes (conversations, échange, fiche
// de l'interlocuteur), séparateurs de jour, « Lu à », document des Archives cité affiché en carte
// (cliquable seulement pour qui peut l'ouvrir), trombone ; bureau et téléphone.
// Finitions (étape 9) : message de confirmation après envoi, destinataire d'un nouveau message en liste
// de suggestions (combobox), nouvelle annonce et nouveau sondage en fenêtre de formulaire (validation dans
// la fenêtre, rien d'envoyé), vote avec « Annuler » (vote précédent rétabli), clôture confirmée.
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
  check('sans message non lu : aucune pastille (mobile)', await attendre(async () => (await q.locator('header').getByRole('link', { name: /^Messagerie/ }).count()) === 1 && (await q.locator('[data-testid=compteur-messages]').count()) === (avantAgent1 > 0 ? 1 : 0)));
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
  await a1.getByRole('button', { name: 'Joindre', exact: true }).click();
  await a1.getByRole('menuitem', { name: 'Depuis les Archives' }).click();
  await a1.locator('[data-testid=choix-document]').getByRole('searchbox').fill(`Projections ${S}`);
  await a1.locator('[data-testid=choix-document]').getByRole('button', { name: `Projections ${S}` }).click();
  await a1.locator('[data-testid=document-joint]').waitFor();
  await a1.getByLabel('Votre message').fill(`Voici le document ${S} :`);
  await a1.getByRole('button', { name: 'Envoyer' }).click();
  const toast = (p) => p.locator('[data-testid=toast]');
  await toast(a1).filter({ hasText: 'Message envoyé' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('message de confirmation « Message envoyé » (destinataire nommé)', /Message envoyé[\s\S]*AGENTDEE/i.test(await toast(a1).innerText().catch(() => '')));
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

  await t.getByRole('button', { name: 'Nouveau message' }).click();
  const dest = t.getByRole('combobox', { name: /Nouvelle conversation/ });
  await dest.fill('agent2');
  await t.getByRole('option', { name: /AGENT2/i }).first().click();
  await t.locator('[data-testid=echange]').waitFor();
  // L'en-tête de l'échange passe à l'interlocuteur choisi un instant après l'ouverture.
  await t.getByRole('heading', { name: /AGENT2/i }).first().waitFor({ timeout: 10_000 }).catch(() => {});
  check('nouveau message : destinataire choisi dans la liste (option), échange ouvert', /\/communication/.test(t.url()) && (await t.getByRole('heading', { name: /AGENT2/i }).count()) >= 1);
  check('téléphone : nouveau message sans défilement horizontal', await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await t.context().close();

  console.log('— Nouvelle annonce : validation dans la fenêtre, destinataires, confirmation');
  const nbAnnonces = async () => (await call('chefdpe', 'GET', '/announcements')).body.length;
  const avantAnn = await nbAnnonces();
  const c = await loginPage(b, 'chefdpe', { width: 1440, height: 900 });
  await c.goto(`${WEB}/communication`);
  await c.getByRole('tab', { name: /^Annonces/ }).click();
  await c.getByRole('button', { name: 'Nouvelle annonce' }).first().click();
  let f = c.getByRole('dialog', { name: 'Nouvelle annonce' });
  await f.getByRole('button', { name: 'Publier l’annonce' }).click();
  check('envoi vide : message sous Titre et Message, rien d’envoyé', (await f.locator('[data-testid=erreur-champ]').count()) >= 2 && (await f.getByText('Donnez un titre à l’annonce.').count()) === 1 && (await nbAnnonces()) === avantAnn);
  await f.getByLabel('Titre', { exact: true }).fill(`Réunion de service ${S}`);
  await f.getByLabel('Message', { exact: true }).fill('Jeudi à 10 h, salle de réunion.');
  await f.getByRole('radio', { name: 'Groupe personnalisé' }).click();
  await f.getByRole('button', { name: 'Publier l’annonce' }).click();
  check('groupe sans destinataire : « Choisissez au moins un destinataire. », rien d’envoyé', (await f.getByText('Choisissez au moins un destinataire.').count()) === 1 && (await nbAnnonces()) === avantAnn);
  await f.getByRole('combobox', { name: 'Destinataires' }).fill('agent1');
  await f.getByRole('option', { name: /AGENT1/i }).first().click();
  check('destinataire en étiquette', (await f.locator('[data-testid=personne-choisie]').count()) === 1);
  await f.getByRole('button', { name: 'Publier l’annonce' }).click();
  await toast(c).filter({ hasText: 'Annonce publiée' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('« Annonce publiée » (1 destinataire prévenu), fenêtre fermée', /1 destinataire prévenu/.test(await toast(c).innerText().catch(() => '')) && (await f.count()) === 0);
  check('annonce listée', (await c.locator('[data-testid=annonce]', { hasText: `Réunion de service ${S}` }).count()) === 1);

  console.log('— Nouveau sondage : deux choix au moins, clôture dans le futur, confirmation');
  const nbSondages = async () => (await call('chefdpe', 'GET', '/polls')).body.length;
  const avantSond = await nbSondages();
  await c.getByRole('tab', { name: /^Sondages/ }).click();
  await c.getByRole('button', { name: 'Nouveau sondage' }).first().click();
  f = c.getByRole('dialog', { name: 'Nouveau sondage' });
  await f.getByLabel('Question', { exact: true }).fill(`Date du séminaire ${S} ?`);
  await f.getByLabel('Choix 1', { exact: true }).fill('Mardi');
  await f.getByRole('button', { name: 'Publier le sondage' }).click();
  check('un seul choix : « Proposez au moins deux choix. », rien d’envoyé', (await f.getByText('Proposez au moins deux choix.').count()) === 1 && (await nbSondages()) === avantSond);
  await f.getByLabel('Choix 2', { exact: true }).fill('Jeudi');
  await f.getByRole('button', { name: 'Ajouter un choix' }).click();
  await f.getByLabel('Choix 3', { exact: true }).fill('Vendredi');
  await f.getByRole('radio', { name: 'Plusieurs choix' }).click();
  await f.getByRole('radio', { name: 'Un seul choix' }).click();
  await f.getByLabel('Heure de clôture').fill('18:00');
  await f.getByRole('button', { name: 'Publier le sondage' }).click();
  check('heure sans date : « Choisissez la date de clôture. »', (await f.getByText('Choisissez la date de clôture.').count()) === 1 && (await nbSondages()) === avantSond);
  const demain = new Date(Date.now() + 86400000);
  const iso = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, '0')}-${String(demain.getDate()).padStart(2, '0')}`;
  await f.getByRole('textbox', { name: /^Clôture automatique/ }).fill(iso);
  await f.getByRole('radio', { name: 'Division' }).click();
  await c.screenshot({ path: `${E.SHOTS}/f_nouveau_sondage_bureau.png` });
  await f.getByRole('button', { name: 'Publier le sondage' }).click();
  await toast(c).filter({ hasText: 'Sondage publié' }).waitFor({ timeout: 8000 }).catch(() => {});
  const sond = (await call('chefdpe', 'GET', '/polls')).body.find((x) => x.question === `Date du séminaire ${S} ?`);
  check('« Sondage publié » ; trois choix, clôture le lendemain à 18 h', (await toast(c).count()) === 1 && !!sond && sond.options.length === 3 && new Date(sond.closesAt).getHours() === 18 && new Date(sond.closesAt).getDate() === demain.getDate());

  console.log('— Vote : confirmation, modification avec « Annuler »');
  const v = await loginPage(b, 'agent1', { width: 1440, height: 900 });
  await v.goto(`${WEB}/communication?pollId=${sond.id}`);
  const fen = v.locator('[data-testid=fenetre-sondage]');
  await fen.waitFor();
  await fen.locator('[data-testid=option-sondage]', { hasText: 'Mardi' }).click();
  await toast(v).filter({ hasText: 'Vote enregistré' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('premier vote : « Vote enregistré », sans « Annuler » (aucune route pour retirer un vote)', (await toast(v).filter({ hasText: 'Vote enregistré' }).count()) === 1 && (await toast(v).getByRole('button', { name: 'Annuler' }).count()) === 0);
  await fen.locator('[data-testid=option-sondage]', { hasText: 'Jeudi' }).click();
  await toast(v).filter({ hasText: 'Vote modifié' }).waitFor({ timeout: 8000 }).catch(() => {});
  const mardi = sond.options.find((o) => o.label === 'Mardi').id;
  const jeudi = sond.options.find((o) => o.label === 'Jeudi').id;
  check('vote modifié : enregistré (Jeudi)', JSON.stringify((await call('agent1', 'GET', `/polls/${sond.id}`)).body.myOptionIds) === JSON.stringify([jeudi]));
  await toast(v).getByRole('button', { name: 'Annuler' }).click();
  await toast(v).filter({ hasText: 'Vote précédent rétabli' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('« Annuler » : vote précédent (Mardi) rétabli par la même route', JSON.stringify((await call('agent1', 'GET', `/polls/${sond.id}`)).body.myOptionIds) === JSON.stringify([mardi]));
  await v.context().close();

  console.log('— Clôture confirmée dans une fenêtre');
  await c.goto(`${WEB}/communication?pollId=${sond.id}`);
  const fc = c.locator('[data-testid=fenetre-sondage]');
  await fc.getByRole('button', { name: 'Clôturer le sondage' }).click();
  const conf = c.getByRole('dialog', { name: 'Clôturer le sondage' });
  await conf.getByRole('button', { name: 'Clôturer le sondage' }).click();
  await toast(c).filter({ hasText: 'Sondage clôturé' }).waitFor({ timeout: 8000 }).catch(() => {});
  check('« Sondage clôturé » ; API : clôturé', (await toast(c).filter({ hasText: 'Sondage clôturé' }).count()) === 1 && (await call('chefdpe', 'GET', `/polls/${sond.id}`)).body.isClosed === true);
  await c.context().close();

  const m390 = await loginPage(b, 'chefdpe', { width: 390, height: 844 });
  await m390.goto(`${WEB}/communication`);
  await m390.getByRole('tab', { name: /^Sondages/ }).click();
  await m390.getByRole('button', { name: 'Nouveau sondage' }).first().click();
  await m390.getByRole('dialog', { name: 'Nouveau sondage' }).waitFor();
  check('téléphone : fenêtre « Nouveau sondage » sans défilement horizontal', await m390.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await m390.screenshot({ path: `${E.SHOTS}/f_nouveau_sondage_mobile.png` });
  await m390.context().close();

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
