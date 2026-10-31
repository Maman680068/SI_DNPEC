// S3c — sécurité : la clé de stockage d'une pièce jointe n'est jamais acceptée du navigateur ni renvoyée.
// POST /messages avec attachmentKey ou attachmentName → 400 (champ interdit) ; aucun message ne renvoie
// attachmentKey ; le document généré transmis par message (pièce posée par le serveur) fonctionne toujours.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);

(async () => {
  console.log('— Champs de pièce jointe refusés depuis le navigateur');
  const doc = await prisma.documentVersion.findFirst({ select: { fileKey: true } });
  const cle = doc?.fileKey ?? 'cle-quelconque';
  const r1 = await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `Essai ${S}`, attachmentKey: cle });
  expect('attachmentKey (clé d’un document des Archives) : refusé', r1, 400);
  check('… message d’erreur : propriété interdite', JSON.stringify(r1.body).includes('attachmentKey'));
  expect('attachmentName seul : refusé', await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `Essai ${S}`, attachmentName: 'x.pdf' }), 400);
  check('aucun message créé avec cette clé', (await prisma.directMessage.count({ where: { attachmentKey: cle } })) === 0);
  const ok = await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `Simple ${S}` });
  expect('message simple : envoyé', ok, 201);
  check('réponse : ni clé de stockage, pièce jointe vide', !('attachmentKey' in ok.body) && ok.body.attachmentName === null);

  console.log('— Document généré transmis par message (pièce posée par le serveur)');
  const att = await call('drh', 'POST', '/api/v1/attestations-travail', { agentId: ids.agent1 });
  expect('attestation de travail créée par le DRH', att, 201);
  expect('le DRH la transmet à agent1 par message', await call('drh', 'POST', '/api/v1/documents-generes/transmettre', { type: 'ATTESTATION_TRAVAIL', attestationId: att.body.id, destinataireId: ids.agent1, message: `Attestation ${S}` }), 201);
  const enBase = await prisma.directMessage.findFirst({ where: { recipientId: ids.agent1, body: `Attestation ${S}` } });
  check('message en base avec sa pièce jointe (clé posée par le serveur)', !!enBase?.attachmentKey && /\.pdf$/.test(enBase.attachmentName));
  const fil = (await call('agent1', 'GET', `/messages/with/${ids.drh}`)).body;
  const vu = fil.find((m) => m.body === `Attestation ${S}`);
  check('agent1 voit le nom de la pièce jointe, jamais sa clé', !!vu && /\.pdf$/.test(vu.attachmentName) && fil.every((m) => !('attachmentKey' in m)));
  const conv = (await call('agent1', 'GET', '/messages/conversations')).body;
  check('liste des conversations : aucune clé de stockage', conv.every((c) => !('attachmentKey' in c.lastMessage)));

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
