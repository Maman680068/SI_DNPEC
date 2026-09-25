// Correctif : pastille de l'icône messagerie = messages reçus non lus (API puis Chromium).
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
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
  check('sans message non lu : aucune pastille (mobile)', await attendre(async () => (await q.getByRole('link', { name: /^Messagerie/ }).count()) === 1) && (await q.locator('[data-testid=compteur-messages]').count()) === (avantAgent1 > 0 ? 1 : 0));
  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
