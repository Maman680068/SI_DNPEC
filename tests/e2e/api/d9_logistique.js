// D9-1 — logistique : habilitation de gestionnaire (admin, n'importe qui sauf stagiaire), catégories
// (validation du chef oui/non), inventaire sans trou ni suppression (triggers), historique en ajout seul,
// visibilité (besoin d'en connaître), circuit des demandes sans auto-validation, stock jamais négatif
// (409, CHECK, concurrence), alerte sous le seuil, alerte de départ, stagiaire exclu, exports.
const E = require('../config');
require('reflect-metadata');
const { call, ids, check, expect, bilan } = require('../lib');
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const sqlErreur = async (sql) => { try { await prisma.$executeRawUnsafe(sql); return null; } catch (e) { return String(e.message); } };
const notifs = (userId, type, depuis) => prisma.notification.count({ where: { userId, type, channel: 'IN_APP', createdAt: { gte: depuis } } });

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const inventaire = app.get(require(D + '/logistique/inventaire.service').InventaireService);
  const t0 = new Date();
  // Isolement : habilitations laissées par une exécution précédente révoquées.
  for (const h of await prisma.habilitationLogistique.findMany({ where: { revoqueeAt: null } })) await call('admin', 'POST', `/logistique/habilitations/${h.id}/revoquer`);

  console.log('— Habilitations de gestionnaire (administrateur seul)');
  expect('DN ne peut pas habiliter', await call('dn', 'POST', '/logistique/habilitations', { userId: ids.agentsaf }), 403);
  expect('admin habilite un agent du SAF', await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf }), 201);
  expect('admin habilite un chargé d’études de la DPE (n’importe qui)', await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agent2 }), 201);
  expect('habilitation en double', await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf }), 409);
  const stg = (await call('admin', 'POST', '/users', { email: `d9${S}@test.local`, password: 'Password123!', firstName: 'Stag', lastName: `Log${S}`, role: 'STAGIAIRE' })).body.id;
  expect('un stagiaire ne peut pas être habilité', await call('admin', 'POST', '/logistique/habilitations', { userId: stg }), 403);

  console.log('— Catégories (administrateur) : validation du chef oui / non');
  const cat = async (code, libelle, nature, v) => (await call('admin', 'POST', '/logistique/categories', { code, libelle, nature, validationChefRequise: v })).body;
  expect('un gestionnaire ne crée pas de catégorie', await call('agentsaf', 'POST', '/logistique/categories', { code: `X${L}`, libelle: 'X', nature: 'BIEN', validationChefRequise: true }), 403);
  const INFO = await cat(`IN${L}`, `Informatique ${S}`, 'BIEN', true);
  const MOB = await cat(`MO${L}`, `Mobilier ${S}`, 'BIEN', false);
  const PAP = await cat(`PA${L}`, `Papeterie ${S}`, 'FOURNITURE', true);
  const CON = await cat(`CO${L}`, `Consommables ${S}`, 'FOURNITURE', false);
  check('4 catégories créées', [INFO, MOB, PAP, CON].every((c) => c.id));
  expect('code déjà utilisé', await call('admin', 'POST', '/logistique/categories', { code: `IN${L}`, libelle: 'Doublon', nature: 'BIEN', validationChefRequise: true }), 409);

  console.log('— Articles et stock');
  expect('un agent ne crée pas d’article', await call('agent1', 'POST', '/logistique/articles', { categorieId: PAP.id, libelle: 'Refusé', suiviStock: false }), 403);
  expect('article dans une catégorie de biens', await call('agentsaf', 'POST', '/logistique/articles', { categorieId: INFO.id, libelle: 'Refusé', suiviStock: false }), 400);
  const RAM = (await call('agentsaf', 'POST', '/logistique/articles', { categorieId: PAP.id, libelle: `Ramette A4 ${S}`, unite: 'ramette', suiviStock: true, seuilAlerte: 5 })).body;
  const STY = (await call('agentsaf', 'POST', '/logistique/articles', { categorieId: CON.id, libelle: `Stylos ${S}`, unite: 'boîte', suiviStock: false })).body;
  check('articles créés', !!RAM.id && !!STY.id);
  const vueAgent = (await call('agent1', 'GET', '/logistique/articles')).body.find((a) => a.id === RAM.id);
  check('un demandeur voit l’article, pas le stock', vueAgent && vueAgent.stock === null && vueAgent.seuilAlerte === null);
  expect('mouvement sur un article sans suivi', await call('agentsaf', 'POST', `/logistique/articles/${STY.id}/mouvements`, { type: 'ENTREE', quantite: 3 }), 409);
  expect('entrée de 10 ramettes', await call('agentsaf', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'ENTREE', quantite: 10 }), 201);
  expect('sortie hors demande sans motif', await call('agentsaf', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'SORTIE', quantite: 1 }), 400);
  expect('sortie supérieure au stock', await call('agentsaf', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'SORTIE', quantite: 11, motif: 'Test' }), 409);
  expect('un agent ne fait pas de mouvement', await call('agent1', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'ENTREE', quantite: 1 }), 403);
  const conc = await Promise.all([1, 2].map(() => call('agentsaf', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'SORTIE', quantite: 6, motif: 'Concurrence' })));
  check('deux sorties simultanées de 6 sur 10 : une 201, une 409', conc.map((r) => r.status).sort().join() === '201,409');
  let ram = await prisma.articleFourniture.findUnique({ where: { id: RAM.id } });
  check('stock = 4, jamais négatif', ram.stock === 4);
  check('alerte stock bas envoyée une fois à chaque gestionnaire', (await notifs(ids.agentsaf, 'LOGISTIQUE_STOCK_BAS', t0)) === 1 && (await notifs(ids.agent2, 'LOGISTIQUE_STOCK_BAS', t0)) === 1);
  await call('agentsaf', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'SORTIE', quantite: 1, motif: 'Service courant' });
  check('pas de nouvelle alerte tant que le stock reste sous le seuil', (await notifs(ids.agentsaf, 'LOGISTIQUE_STOCK_BAS', t0)) === 1);
  await call('agentsaf', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'ENTREE', quantite: 20 });
  ram = await prisma.articleFourniture.findUnique({ where: { id: RAM.id } });
  check('stock remonté à 23 : alerte réarmée', ram.stock === 23 && ram.alerteStockAt === null);
  check('CHECK en base : stock négatif refusé', /stock_positif/.test(await sqlErreur(`UPDATE articles_fourniture SET stock = -1 WHERE id = '${RAM.id}'`)));
  check('journal du stock en ajout seul', /ajout seul/.test(await sqlErreur(`DELETE FROM mouvements_stock WHERE "articleId" = '${RAM.id}'`)));

  console.log('— Inventaire : numérotation sans trou, triggers');
  expect('un agent ne crée pas de bien', await call('agent1', 'POST', '/logistique/biens', { categorieId: INFO.id, designation: 'Refusé' }), 403);
  const creation = await Promise.all([...Array(6)].map((_, i) => call('agentsaf', 'POST', '/logistique/biens', { categorieId: INFO.id, designation: `Ordinateur ${i} ${S}`, marque: 'HP' })));
  check('6 créations simultanées : 201', creation.every((r) => r.status === 201));
  const an = new Date().getFullYear();
  const nums = creation.map((r) => r.body.numeroInventaire).sort();
  check(`numéros ${nums[0]} … ${nums[5]} : séquence 1..6 sans trou ni doublon`, nums.join() === [1, 2, 3, 4, 5, 6].map((n) => `IN${L}-${an}-${String(n).padStart(4, '0')}`).join());
  const [b1, b2, b3] = creation.map((r) => r.body).sort((a, b) => a.numeroInventaire.localeCompare(b.numeroInventaire));
  check('suppression d’un bien refusée (trigger)', /ne peut pas être supprimé/.test(await sqlErreur(`DELETE FROM biens WHERE id = '${b1.id}'`)));
  check('renumérotation refusée (trigger)', /est figé/.test(await sqlErreur(`UPDATE biens SET sequence = 99 WHERE id = '${b1.id}'`)));
  check('historique du bien en ajout seul', /ajout seul/.test(await sqlErreur(`UPDATE mouvements_bien SET detail = '{}' WHERE "bienId" = '${b1.id}'`)));

  console.log('— Affectations et visibilité');
  expect('b1 → agent1', await call('agentsaf', 'POST', `/logistique/biens/${b1.id}/affecter`, { userId: ids.agent1 }), 201);
  expect('b2 → section SSR', await call('agentsaf', 'POST', `/logistique/biens/${b2.id}/affecter`, { divisionId: ids.DPE, sectionId: ids.SSR }), 201);
  expect('personne ET unité', await call('agentsaf', 'POST', `/logistique/biens/${b3.id}/affecter`, { userId: ids.agent1, divisionId: ids.DPE }), 400);
  expect('un agent n’affecte pas', await call('agent1', 'POST', `/logistique/biens/${b3.id}/affecter`, { userId: ids.agent1 }), 403);
  check('au plus une affectation ouverte (index unique partiel)', /unique|duplicate|already exists/i.test(await sqlErreur(`INSERT INTO affectations_bien (id, "bienId", "userId", "faiteParId") VALUES ('x${S}', '${b1.id}', '${ids.agent2}', '${ids.agentsaf}')`)));
  const vus = async (k) => (await call(k, 'GET', `/logistique/biens?q=${S}`)).body.map((b) => b.id);
  const attendu = {
    agent1: [b1.id, b2.id], chefssr: [b1.id, b2.id], chefdpe: [b1.id, b2.id], chefdee: [], agentdee: [], chefsfp: [],
    dn: creation.map((r) => r.body.id), agentsaf: creation.map((r) => r.body.id),
  };
  for (const [k, ok] of Object.entries(attendu)) {
    const v = await vus(k);
    check(`${k} voit ${ok.length} bien(s) du test`, v.length === ok.length && ok.every((i) => v.includes(i)));
  }
  expect('agentdee ouvre le bien d’agent1', await call('agentdee', 'GET', `/logistique/biens/${b1.id}`), 403);
  const f1 = (await call('agent1', 'GET', `/logistique/biens/${b1.id}`)).body;
  check('agent1 : fiche sans droit de gestion, signalement possible', !f1.droits.affecter && !f1.droits.changerEtat && f1.droits.signalerPanne);
  expect('réaffectation b1 → agent2', await call('agentsaf', 'POST', `/logistique/biens/${b1.id}/affecter`, { userId: ids.agent2 }), 201);
  const h1 = (await call('agentsaf', 'GET', `/logistique/biens/${b1.id}`)).body;
  check('historique : acquisition, affectation, retour, affectation', h1.historique.map((m) => m.type).reverse().join() === 'ACQUISITION,AFFECTATION,RETOUR,AFFECTATION');
  check('une seule affectation ouverte, deux au total', h1.affectations.length === 2 && h1.affectations.filter((a) => !a.fin).length === 1);
  expect('réforme sans motif', await call('agentsaf', 'POST', `/logistique/biens/${b3.id}/etat`, { etat: 'REFORME' }), 400);
  await call('agentsaf', 'POST', `/logistique/biens/${b3.id}/affecter`, { userId: ids.agentdee });
  expect('réforme de b3 avec motif', await call('agentsaf', 'POST', `/logistique/biens/${b3.id}/etat`, { etat: 'REFORME', motif: 'Hors d’usage' }), 201);
  const b3r = await prisma.bien.findUnique({ where: { id: b3.id }, include: { affectations: true } });
  check('réformé : numéro conservé, affectation close', b3r.numeroInventaire === b3.numeroInventaire && b3r.affectations.every((a) => a.fin));
  expect('modifier un bien réformé', await call('agentsaf', 'PATCH', `/logistique/biens/${b3.id}`, { designation: 'Autre' }), 409);
  expect('affecter un bien réformé', await call('agentsaf', 'POST', `/logistique/biens/${b3.id}/affecter`, { userId: ids.agent1 }), 409);

  console.log('— Demandes : circuit avec validation du chef');
  const dem = (k, body) => call(k, 'POST', '/logistique/demandes', body);
  const r1 = await dem('agent1', { type: 'FOURNITURE', articleId: RAM.id, quantite: 2, objet: `Ramettes pour la note ${S}` });
  expect('agent1 demande 2 ramettes (Papeterie : validation requise)', r1, 201);
  const d1 = r1.body;
  check('statut « À valider », aucun droit de validation pour le demandeur', d1.statut === 'A_VALIDER' && !d1.droits.valider && d1.droits.annuler);
  check('notification au chef direct (SSR), pas à DN', (await notifs(ids.chefssr, 'LOGISTIQUE_DEMANDE_A_VALIDER', t0)) === 1 && (await notifs(ids.dn, 'LOGISTIQUE_DEMANDE_A_VALIDER', t0)) === 0);
  expect('le gestionnaire ne voit pas une demande non transmise', await call('agentsaf', 'GET', `/logistique/demandes/${d1.id}`), 403);
  // Force brute : droit « valider » annoncé = validation acceptée.
  for (const k of ['agent1', 'agent2', 'chefsfp', 'chefdee', 'agentsaf', 'admin', 'drh']) {
    const vue = await call(k, 'GET', `/logistique/demandes/${d1.id}`);
    if (vue.status === 200) check(`${k} : droit valider annoncé = faux`, vue.body.droits.valider === false);
    expect(`${k} tente de valider`, await call(k, 'POST', `/logistique/demandes/${d1.id}/valider`), 403);
  }
  for (const k of ['chefssr', 'chefdpe', 'dn', 'dna']) { const v = await call(k, 'GET', `/logistique/demandes/${d1.id}`); check(`${k} : droit valider annoncé = vrai`, v.status === 200 && v.body.droits.valider === true, v.status === 200 ? '' : JSON.stringify(v.body)); }
  const aValider = (await call('chefssr', 'GET', '/logistique/demandes?vue=a_valider')).body.map((d) => d.id);
  check('file « À valider » du chef SSR contient la demande', aValider.includes(d1.id));
  expect('le chef SSR valide', await call('chefssr', 'POST', `/logistique/demandes/${d1.id}/valider`), 201);
  expect('validation rejouée', await call('chefdpe', 'POST', `/logistique/demandes/${d1.id}/valider`), 409);
  check('gestionnaires notifiés', (await notifs(ids.agentsaf, 'LOGISTIQUE_DEMANDE_A_TRAITER', t0)) >= 1 && (await notifs(ids.agent2, 'LOGISTIQUE_DEMANDE_A_TRAITER', t0)) >= 1);
  expect('traiter sans prise en charge', await call('agentsaf', 'POST', `/logistique/demandes/${d1.id}/traiter`, {}), 409);
  expect('prise en charge (agentsaf)', await call('agentsaf', 'POST', `/logistique/demandes/${d1.id}/prendre-en-charge`), 201);
  expect('quantité remise > demandée', await call('agentsaf', 'POST', `/logistique/demandes/${d1.id}/traiter`, { quantiteLivree: 3 }), 400);
  const tr = await call('agentsaf', 'POST', `/logistique/demandes/${d1.id}/traiter`, { compteRendu: 'Remis au bureau' });
  expect('traitée', tr, 201);
  const sortie = await prisma.mouvementStock.findFirst({ where: { demandeId: d1.id } });
  check('sortie de stock liée à la demande (23 → 21)', sortie && sortie.quantite === 2 && sortie.stockApres === 21);
  check('demandeur notifié', (await notifs(ids.agent1, 'LOGISTIQUE_DEMANDE_TRAITEE', t0)) === 1);

  console.log('— Demandes : sans validation, pas d’auto-validation, stock insuffisant');
  const d2 = (await dem('agent1', { type: 'FOURNITURE', articleId: STY.id, quantite: 1, objet: `Stylos ${S}` })).body;
  check('Consommables (sans validation) : directement « À traiter »', d2.statut === 'A_TRAITER');
  check('aucun droit de validation annoncé', d2.droits.valider === false && (await call('chefssr', 'GET', `/logistique/demandes/${d2.id}`)).body.droits.valider === false);
  expect('le chef tente de valider une demande déjà transmise', await call('chefssr', 'POST', `/logistique/demandes/${d2.id}/valider`), 409);
  const d3 = (await dem('agentsaf', { type: 'FOURNITURE', articleId: STY.id, quantite: 2, objet: `Stylos gestionnaire ${S}` })).body;
  check('demande d’un gestionnaire : pas de droit de la prendre en charge', d3.droits.prendreEnCharge === false);
  expect('un gestionnaire ne prend pas en charge sa propre demande', await call('agentsaf', 'POST', `/logistique/demandes/${d3.id}/prendre-en-charge`), 403);
  expect('l’autre gestionnaire la prend', await call('agent2', 'POST', `/logistique/demandes/${d3.id}/prendre-en-charge`), 201);
  const d4 = (await dem('chefssr', { type: 'FOURNITURE', articleId: RAM.id, quantite: 30, objet: `Ramettes du chef ${S}` })).body;
  expect('le chef ne valide pas sa propre demande', await call('chefssr', 'POST', `/logistique/demandes/${d4.id}/valider`), 403);
  expect('son chef de division la valide', await call('chefdpe', 'POST', `/logistique/demandes/${d4.id}/valider`), 201);
  await call('agent2', 'POST', `/logistique/demandes/${d4.id}/prendre-en-charge`);
  expect('30 ramettes pour 21 en stock', await call('agent2', 'POST', `/logistique/demandes/${d4.id}/traiter`, {}), 409);
  const d4b = await prisma.demandeLogistique.findUnique({ where: { id: d4.id } });
  check('rien n’est écrit : demande en traitement, stock 21', d4b.statut === 'EN_TRAITEMENT' && (await prisma.articleFourniture.findUnique({ where: { id: RAM.id } })).stock === 21);
  expect('remise partielle de 18', await call('agent2', 'POST', `/logistique/demandes/${d4.id}/traiter`, { quantiteLivree: 18 }), 201);
  check('stock 3 < seuil 5 : nouvelle alerte', (await prisma.articleFourniture.findUnique({ where: { id: RAM.id } })).stock === 3 && (await notifs(ids.agentsaf, 'LOGISTIQUE_STOCK_BAS', t0)) === 2);

  console.log('— Intervention, matériel, refus, annulation');
  expect('intervention sur le bien de sa section', await dem('agent1', { type: 'INTERVENTION', bienId: b2.id, objet: `Imprimante bloquée ${S}` }), 201);
  expect('intervention sur un bien hors périmètre', await dem('agent1', { type: 'INTERVENTION', bienId: b1.id, objet: 'X' + S }), 403);
  expect('intervention sur un bien réformé (visible du gestionnaire)', await dem('agent2', { type: 'INTERVENTION', bienId: b3.id, objet: 'X' + S }), 409);
  check('l’intervention figure dans l’historique du bien', (await prisma.mouvementBien.count({ where: { bienId: b2.id, type: 'INTERVENTION' } })) === 1);
  const d5 = (await dem('agent1', { type: 'MATERIEL', categorieId: MOB.id, objet: `Chaise ${S}` })).body;
  check('matériel « Mobilier » (sans validation) : à traiter, quantité 1', d5.statut === 'A_TRAITER' && d5.quantite === 1);
  expect('type incohérent (article sur du matériel)', await dem('agent1', { type: 'MATERIEL', categorieId: MOB.id, articleId: RAM.id, objet: 'X' + S }), 400);
  expect('refus sans motif', await call('agentsaf', 'POST', `/logistique/demandes/${d5.id}/refuser`, {}), 400);
  expect('refus motivé par le gestionnaire', await call('agentsaf', 'POST', `/logistique/demandes/${d5.id}/refuser`, { motif: 'Aucune chaise disponible' }), 201);
  check('demandeur notifié du refus', (await notifs(ids.agent1, 'LOGISTIQUE_DEMANDE_REFUSEE', t0)) === 1);
  expect('un tiers n’annule pas', await call('agent2', 'POST', `/logistique/demandes/${d2.id}/annuler`), 403);
  expect('le demandeur annule', await call('agent1', 'POST', `/logistique/demandes/${d2.id}/annuler`), 201);
  expect('annulation rejouée', await call('agent1', 'POST', `/logistique/demandes/${d2.id}/annuler`), 409);
  expect('agentdee ouvre la demande d’agent1', await call('agentdee', 'GET', `/logistique/demandes/${d1.id}`), 403);
  check('file « À traiter » vide pour un non-gestionnaire', (await call('agent1', 'GET', '/logistique/demandes?vue=a_traiter')).body.length === 0);
  const tb = (await call('chefssr', 'GET', '/logistique/tableau-de-bord')).body;
  check('tableau de bord du chef = sa file « À valider »', tb.aValider === (await call('chefssr', 'GET', '/logistique/demandes?vue=a_valider')).body.length && tb.gestionnaire === false);

  console.log('— Départ d’un détenteur, stagiaire, exports');
  const tmp = (await call('admin', 'POST', '/users', { email: `d9dep${S}@test.local`, password: 'Password123!', firstName: 'Partant', lastName: S, role: 'AGENT', divisionId: ids.DEE })).body.id;
  const [b4] = creation.map((r) => r.body).sort((a, b) => a.numeroInventaire.localeCompare(b.numeroInventaire)).slice(3);
  await call('agentsaf', 'POST', `/logistique/biens/${b4.id}/affecter`, { userId: tmp });
  await call('admin', 'PATCH', `/users/${tmp}/status`, { status: 'SUSPENDU' });
  const n1 = await inventaire.alertesDepart();
  const n2 = await inventaire.alertesDepart();
  check(`job de départ : ${n1} alerte(s), puis 0 au second passage`, n1 >= 1 && n2 === 0);
  check('le bien reste affecté au partant', !!(await prisma.affectationBien.findFirst({ where: { bienId: b4.id, userId: tmp, fin: null } })));
  check('gestionnaires alertés « bien à récupérer »', (await notifs(ids.agentsaf, 'BIEN_A_RECUPERER', t0)) >= 1);
  const tokenStg = await (await fetch('http://localhost:3000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `d9${S}@test.local`, password: 'Password123!' }) })).json();
  let refus = 0;
  for (const p of ['/logistique/tableau-de-bord', '/logistique/categories', '/logistique/articles', '/logistique/biens', '/logistique/demandes']) {
    const r = await fetch('http://localhost:3000' + p, { headers: { Authorization: 'Bearer ' + tokenStg.accessToken } });
    if (r.status === 403) refus++;
  }
  check('stagiaire : 5 routes de lecture refusées (403)', refus === 5);
  const x = await fetch(`http://localhost:3000/logistique/biens/export.xlsx?q=${S}`, { headers: { Authorization: 'Bearer ' + (await require('../lib').login('agent1')) } });
  const buf = Buffer.from(await x.arrayBuffer());
  check('export de l’inventaire (agent1) : classeur Excel', x.status === 200 && buf.slice(0, 2).toString() === 'PK');
  check('export tracé dans le journal', (await prisma.auditLog.count({ where: { actorId: ids.agent1, entityType: 'Inventaire', createdAt: { gte: t0 } } })) === 1);
  expect('révocation d’une habilitation', await call('admin', 'POST', `/logistique/habilitations/${(await prisma.habilitationLogistique.findFirst({ where: { userId: ids.agent2, revoqueeAt: null } })).id}/revoquer`), 201);
  expect('agent2 n’est plus gestionnaire', await call('agent2', 'POST', `/logistique/articles/${RAM.id}/mouvements`, { type: 'ENTREE', quantite: 1 }), 403);

  await app.close(); await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
