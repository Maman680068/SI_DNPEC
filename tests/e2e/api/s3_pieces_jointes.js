// S3 — messagerie : pièces jointes. Fichier depuis l'ordinateur (PDF, Word, Excel, images ; 10 Mo ; type
// vérifié par le CONTENU), téléchargement par les deux personnes de la conversation seulement (403 pour un
// tiers, même le DN), chaque téléchargement audité ; « Classer dans les Archives » = dépôt normal ;
// « Citer un document des Archives » : liste dès l'ouverture, filtre sans accents, droits de la GED.
const { call, upload, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const PDF = Buffer.from(`%PDF-1.4\n% essai ${S}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('IHDR essai')]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....[Content_Types].xml....word/document.xml....')]);
const envoyer = (k, nom, contenu, champs = {}) => upload(k, '/api/v1/messages/fichier', { recipientId: ids.agent2, ...champs }, [{ field: 'fichier', name: nom, content: contenu }]);
const telecharger = async (k, id) => {
  const r = await fetch(`${BASE}/api/v1/messages/${id}/piece-jointe`, { headers: { Authorization: 'Bearer ' + (await login(k)) } });
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type'), nom: r.headers.get('content-disposition') };
};

(async () => {
  console.log('— Envoi depuis l’ordinateur');
  const r = await envoyer('agent1', `Rapport ${S}.pdf`, PDF, { body: `Le rapport ${S}` });
  expect('PDF envoyé avec un texte', r, 201);
  check('réponse : nom de la pièce jointe, jamais sa clé', r.body.attachmentName === `Rapport ${S}.pdf` && !('attachmentKey' in r.body) && r.body.body === `Le rapport ${S}`);
  check('clé de stockage posée par le serveur', !!(await prisma.directMessage.findUnique({ where: { id: r.body.id } })).attachmentKey);
  expect('image PNG sans texte', await envoyer('agent1', `photo_${S}.png`, PNG), 201);
  expect('document Word (.docx)', await envoyer('agent1', `note_${S}.docx`, DOCX), 201);
  const notif = await prisma.notification.findFirst({ where: { userId: ids.agent2, body: `Pièce jointe : photo_${S}.png` } });
  check('message sans texte : notification « Pièce jointe : … »', !!notif);

  console.log('— Refus : type ou taille non permis');
  expect('exécutable (.exe)', await envoyer('agent1', `prog_${S}.exe`, Buffer.from('MZ....')), 400);
  expect('texte renommé en .pdf (contenu ≠ extension)', await envoyer('agent1', `faux_${S}.pdf`, Buffer.from('ceci n’est pas un PDF')), 400);
  expect('image PNG renommée en .docx', await envoyer('agent1', `faux_${S}.docx`, PNG), 400);
  expect('page HTML renommée en .png', await envoyer('agent1', `page_${S}.png`, Buffer.from('<html><script>alert(1)</script></html>')), 400);
  const gros = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 + 10, 0x20)]);
  expect('PDF de plus de 10 Mo', await envoyer('agent1', `gros_${S}.pdf`, gros), 413);
  expect('sans fichier', await call('agent1', 'POST', '/api/v1/messages/fichier', { recipientId: ids.agent2 }), 400);
  check('aucun message créé pour les refus', (await prisma.directMessage.count({ where: { senderId: ids.agent1, attachmentName: { in: [`prog_${S}.exe`, `faux_${S}.pdf`, `faux_${S}.docx`, `page_${S}.png`, `gros_${S}.pdf`] } } })) === 0);

  console.log('— Téléchargement : les deux personnes de la conversation, auditées ; 403 pour un tiers');
  const avant = await prisma.auditLog.count({ where: { entityType: 'DirectMessage', entityId: r.body.id } });
  const t1 = await telecharger('agent1', r.body.id);
  const t2 = await telecharger('agent2', r.body.id);
  check('expéditeur et destinataire téléchargent le fichier intact (PDF)', t1.status === 200 && t2.status === 200 && t1.buf.equals(PDF) && t2.buf.equals(PDF) && t1.type.startsWith('application/pdf'), `${t1.status} ${t2.status}`);
  check('chaque téléchargement audité (2 entrées, sans nom de fichier)', await (async () => {
    const l = await prisma.auditLog.findMany({ where: { entityType: 'DirectMessage', entityId: r.body.id } });
    return l.length === avant + 2 && l.every((a) => a.metadata.event === 'telechargement_piece_jointe' && !JSON.stringify(a.metadata).includes('Rapport'));
  })());
  for (const k of ['chefssr', 'dn', 'admin', 'drh']) expect(`${k} (tiers) : téléchargement refusé`, { status: (await telecharger(k, r.body.id)).status, body: {} }, 403);
  expect('message inconnu : 404', { status: (await telecharger('agent1', 'inexistant')).status, body: {} }, 404);

  console.log('— Stagiaire');
  const stg = (await call('admin', 'POST', '/users', { email: `pjst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `PjStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  expect('stagiaire : envoi d’un fichier refusé', await upload(`pjst${S}`, '/api/v1/messages/fichier', { recipientId: ids.agent2 }, [{ field: 'fichier', name: 'a.pdf', content: PDF }]), 403);
  expect('stagiaire : documents à citer refusés (Archives fermées)', await call(`pjst${S}`, 'GET', `/api/v1/messages/avec/${ids.agent2}/documents-a-citer`), 403);
  const versStg = await upload('agent1', '/api/v1/messages/fichier', { recipientId: stg.id }, [{ field: 'fichier', name: `pour_stagiaire_${S}.pdf`, content: PDF }]);
  check('stagiaire destinataire : il télécharge sa pièce jointe', (await telecharger(`pjst${S}`, versStg.body.id)).status === 200);

  console.log('— Classer dans les Archives (dépôt normal, droits normaux)');
  const recu = await telecharger('agent2', r.body.id);
  const classe = await upload('agent2', '/documents', { title: `Rapport classé ${S}`, divisionId: ids.DPE, typeDocument: 'RAPPORT', periodeDebut: '2026-01-01', periodeFin: '2026-06-30' }, [{ field: 'file', name: `Rapport ${S}.pdf`, content: recu.buf }]);
  expect('destinataire : pièce jointe classée dans les Archives de sa division', classe, 201);
  check('… document au statut Brouillon, version 1', classe.body.statutDiffusion === 'BROUILLON' && classe.body.currentVersion?.versionNumber === 1);

  console.log('— Citer un document des Archives');
  const note = await upload('agent1', '/documents', { title: `Note Économie ${S}`, divisionId: ids.DPE, typeDocument: 'NOTE_CONJONCTURE', periodeDebut: '2026-01-01', periodeFin: '2026-03-31' }, [{ field: 'file', name: `note_${S}.txt` }]);
  const autre = await upload('agentdee', '/documents', { title: `Note Économie DEE ${S}`, divisionId: ids.DEE, typeDocument: 'NOTE_CONJONCTURE', periodeDebut: '2026-01-01', periodeFin: '2026-03-31' }, [{ field: 'file', name: `dee_${S}.txt` }]);
  check('documents de test déposés (DPE, DEE)', note.status === 201 && autre.status === 201);
  const liste = await call('agent1', 'GET', `/api/v1/messages/avec/${ids.agent2}/documents-a-citer`);
  expect('liste dès l’ouverture (sans texte)', liste, 200);
  check('… documents récents de mon unité (DPE), emplacement et version', liste.body.some((d) => d.id === note.body.id && d.chemin.startsWith('Archives') && d.version === 1));
  const sansAccent = (await call('agent1', 'GET', `/api/v1/messages/avec/${ids.agent2}/documents-a-citer?q=${encodeURIComponent(`note economie ${S}`)}`)).body;
  check('filtre sans accents ni majuscules (« note economie »)', sansAccent.some((d) => d.id === note.body.id));
  check('document d’une autre division (non visible) : jamais proposé', !sansAccent.some((d) => d.id === autre.body.id));
  expect('agent1 cite la note dans un message à agent2', await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `Voir /documents?id=${note.body.id}` }), 201);
  const apres = (await call('agent1', 'GET', `/api/v1/messages/avec/${ids.agent2}/documents-a-citer`)).body;
  check('document déjà échangé avec ce correspondant : en tête, signalé', apres[0]?.id === note.body.id && apres[0].echange === true);
  const dee = (await call('agentdee', 'GET', `/api/v1/messages/avec/${ids.agent1}/documents-a-citer?q=${encodeURIComponent(`note economie ${S}`)}`)).body;
  check('agentdee : ne voit pas la note de la DPE (droits des Archives inchangés)', !dee.some((d) => d.id === note.body.id) && dee.some((d) => d.id === autre.body.id));
  const ctx = (await call('agent2', 'GET', `/api/v1/messages/avec/${ids.agent1}/contexte`)).body;
  check('fiche de la conversation : droits « joindre » et « classer » donnés par l’API', ctx.droits.joindre === true && ctx.droits.classer === true);
  check('stagiaire : ni joindre ni classer', (await call(`pjst${S}`, 'GET', `/api/v1/messages/avec/${ids.agent1}/contexte`)).body.droits.joindre === false);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
