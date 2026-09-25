// Lot F — cloche : liste et compteur in-app seulement (jamais le doublon EMAIL), marquage lu.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
(async () => {
  await call('drh', 'PATCH', '/notifications/read-all');
  for (let i = 0; i < 3; i++) await call('agent1', 'POST', `/personnel-files/${ids.agent1}/report-error`, { fieldLabel: 'Grade', comment: `Cloche ${S} ${i}` });
  const inApp = await prisma.notification.count({ where: { userId: ids.drh, channel: 'IN_APP' } });
  const email = await prisma.notification.count({ where: { userId: ids.drh, channel: 'EMAIL' } });
  const l = await call('drh', 'GET', '/notifications');
  check(`liste : in-app seulement (${l.body.length} ≤ 50, ${inApp} in-app et ${email} email en base)`, l.status === 200 && l.body.length === Math.min(inApp, 50) && l.body.every((n) => !('channel' in n)));
  check('liste : plus récentes d’abord, avec titre, lien, lu', l.body[0].body.includes(`Cloche ${S} 2`) && l.body[0].link === `/personnel/${ids.agent1}` && l.body[0].isRead === false);
  const c = await call('drh', 'GET', '/notifications/unread-count');
  check('compteur : 3 non lues (pas 6)', c.body === 3, JSON.stringify(c.body));
  expect('un autre marque la notification du DRH', await call('agent1', 'PATCH', `/notifications/${l.body[0].id}/read`), 404);
  expect('le DRH marque une notification lue', await call('drh', 'PATCH', `/notifications/${l.body[0].id}/read`), 200);
  check('compteur : 2', (await call('drh', 'GET', '/notifications/unread-count')).body === 2);
  expect('tout marquer lu', await call('drh', 'PATCH', '/notifications/read-all'), 200);
  check('compteur : 0', (await call('drh', 'GET', '/notifications/unread-count')).body === 0);
  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
