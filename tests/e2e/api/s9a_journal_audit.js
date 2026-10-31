// S9a — journal d'audit en français : phrase « auteur + verbe + objet nommé » calculée par l'API, objet protégé
// en libellé générique (sans titre ni identifiant, même pour l'administrateur), sceau en tête (état, entrées,
// dernière vérification), filtres domaine / sensibles / recherche, avant / après, empreinte, export CSV et PDF
// journalisé, alerte de l'administrateur en cas de rupture ; journal toujours en écriture seule.
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, upload, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const URL = '/api/v1/journal-audit';
const PDF = Buffer.from(`%PDF-1.4\n% ${S}\n%%EOF\n`);

(async () => {
  console.log('— Phrases en français, objets nommés');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Note de conjoncture ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 11 });
  await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 12 });
  const msg = (await upload('agent1', '/api/v1/messages/fichier', { recipientId: ids.agent2 }, [{ field: 'fichier', name: `Confidentiel ${S}.pdf`, content: PDF }])).body;
  await fetch(`${BASE}/api/v1/messages/${msg.id}/piece-jointe`, { headers: { Authorization: 'Bearer ' + (await login('agent2')) } });
  const j = (await call('admin', 'GET', `${URL}?taille=200`)).body;
  const tache = j.entrees.find((e) => e.objetType === 'Task' && e.objetId === t.id);
  check('création de tâche : « CHEFSSR Test a créé la tâche « … » », lien vers la tâche', !!tache && /^CHEFSSR Test a créé la tâche « Note de conjoncture /.test(tache.phrase) && tache.objet.lien === `/tasks/${t.id}` && tache.domaine === 'Tâches et plan de travail', tache && tache.phrase);
  const param = j.entrees.find((e) => e.objetType === 'Parametre' && e.objetId === 'connexions.conservationMois');
  check('paramètre : phrase, avant / après tirés des métadonnées, sensible', /ADMIN Test a modifié un paramètre « connexions\.conservationMois »/.test(param.phrase) && param.avantApres.length === 1 && param.avantApres[0].avant === '11' && param.avantApres[0].apres === '12' && param.sensible === true);
  const pj = j.entrees.find((e) => e.objetType === 'DirectMessage' && e.evenement === 'telechargement_piece_jointe');
  check('objet protégé : libellé générique, sans titre ni identifiant, même pour l’administrateur', !!pj && pj.phrase === 'AGENT2 Test a téléchargé une pièce jointe de message' && pj.objetId === null && pj.objet.protege && pj.avantApres.length === 0 && !JSON.stringify(j).includes(`Confidentiel ${S}`), pj && pj.phrase);
  check('jour, icône, empreinte, scellement', j.entrees.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.jour) && typeof e.icone === 'string' && 'empreinte' in e));
  check('sceau en tête : nombre d’entrées, dernière vérification', Number.isInteger(j.sceau.entrees) && j.sceau.entrees >= j.total && 'derniereVerification' in j.sceau);

  console.log('— Filtres');
  const dom = (await call('admin', 'GET', `${URL}?domaine=TACHES&taille=200`)).body;
  check('domaine « Tâches » : seulement ce domaine', dom.entrees.length > 0 && dom.entrees.every((e) => e.domaine === 'Tâches et plan de travail'));
  const sens = (await call('admin', 'GET', `${URL}?sensibles=1&taille=200`)).body;
  check('« Sensibles seulement »', sens.entrees.length > 0 && sens.entrees.every((e) => e.sensible));
  const q = (await call('admin', 'GET', `${URL}?q=${encodeURIComponent('chefssr test')}&taille=200`)).body;
  check('recherche par auteur (sans majuscules)', q.entrees.length > 0 && q.entrees.every((e) => e.acteur && e.acteur.id === ids.chefssr));
  const parId = (await call('admin', 'GET', `${URL}?q=${t.id}`)).body;
  check('recherche par identifiant d’objet', parId.entrees.some((e) => e.objetId === t.id));
  expect('« sensibles » : valeur inconnue refusée', await call('admin', 'GET', `${URL}?sensibles=peut-etre`), 400);
  check('agent : ses propres actions, phrases comprises', (await call('agent1', 'GET', URL)).body.entrees.every((e) => e.acteur && e.acteur.id === ids.agent1));

  console.log('— Export CSV et PDF (journalisé)');
  const avant = await prisma.auditLog.count({ where: { entityType: 'JournalAudit', metadata: { path: ['event'], equals: 'export' } } });
  const csv = await fetch(`${BASE}${URL}/export?format=csv&domaine=TACHES`, { headers: { Authorization: 'Bearer ' + (await login('admin')) } });
  const texte = await csv.text();
  check('CSV : en-tête, phrases du domaine', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type')) && /Numéro;Date;Phrase/.test(texte) && texte.includes('a créé la tâche'));
  const pdf = await fetch(`${BASE}${URL}/export?format=pdf`, { headers: { Authorization: 'Bearer ' + (await login('dn')) } });
  check('PDF : fichier PDF', pdf.status === 200 && Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString() === '%PDF-');
  check('chaque export est inscrit au journal', (await prisma.auditLog.count({ where: { entityType: 'JournalAudit', metadata: { path: ['event'], equals: 'export' } } })) === avant + 2);
  expect('format inconnu', await call('admin', 'GET', `${URL}/export?format=xls`), 400);

  console.log('— Rupture de la chaîne : l’administrateur est prévenu');
  const app = await NestFactory.createApplicationContext(require(E.API_DIST + '/app.module').AppModule, { logger: false });
  const journal = app.get(require(E.API_DIST + '/socle/journal-audit.service').JournalAuditService);
  const t0 = new Date();
  await journal.alerterRupture(new Error('Chaîne du journal d’audit rompue à l’entrée n° 42'));
  check('notification « Journal d’audit : chaîne rompue » à l’administrateur', (await prisma.notification.count({ where: { userId: ids.admin, title: 'Journal d’audit : chaîne rompue', createdAt: { gte: t0 } } })) >= 1);
  await app.close();
  check('le journal reste en écriture seule (mise à jour refusée par la base)', await prisma.$executeRawUnsafe(`UPDATE audit_logs SET "entityId" = 'x' WHERE numero = (SELECT max(numero) FROM audit_logs)`).then(() => false, () => true));

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
