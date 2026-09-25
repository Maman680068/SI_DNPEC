// D7 — courrier arrivée : enregistrement, imputation, visibilité, délégations, pli personnel, intégrité.
const E = require('../config');
const { call, upload, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36);
const arrivee = (key, champs, fichiers = []) => upload(key, '/courrier/arrivees', { dateReception: iso(0), expediteur: 'Ministère du Plan', ...champs }, fichiers);
const get = (key, id, h) => call(key, 'GET', `/courrier/arrivees/${id}`, undefined, h);
const niveau = async (key, id, h) => { const r = await get(key, id, h); return r.status === 200 ? r.body.niveau : r.status; };
const I = (id) => ({ 'X-Interim-For': id });
async function suppleance(titulaire, suppleant) {
  // Suppléance active et conforme, créée par le titulaire (les précédentes en cours sont révoquées).
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
  return r.body.id;
}
(async () => {
  console.log('— Enregistrement (habilitation, pas rôle)');
  expect('agent1 non habilité enregistre sur ARR', await arrivee('agent1', { registreId: reg.ARR, objet: 'x x', confidentialite: 'ORDINAIRE' }), 403);
  expect('DN (non habilité) enregistre sur ARR', await arrivee('dn', { registreId: reg.ARR, objet: 'x x', confidentialite: 'ORDINAIRE' }), 403);
  expect('secdpe (habilité DPE) enregistre sur ARR (DNPEC)', await arrivee('secdpe', { registreId: reg.ARR, objet: 'x x', confidentialite: 'ORDINAIRE' }), 403);
  expect('secdg enregistre sur ARRU pour la DPE (non habilité)', await arrivee('secdg', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: 'x x', confidentialite: 'ORDINAIRE' }), 403);
  expect('PERSONNEL avec objet', await arrivee('secdg', { registreId: reg.ARR, objet: 'Indiscret', confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe }), 400);
  expect('PERSONNEL sans destinataire', await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL' }), 400);
  expect('PERSONNEL avec scan', await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe }, [{ name: 'pli.txt' }]), 400);
  const A1 = (await arrivee('secdg', { registreId: reg.ARR, objet: `Budget 2027 ${S}`, confidentialite: 'ORDINAIRE' }, [{ name: 'a1.txt' }])).body;
  const A2r = await arrivee('secdg', { registreId: reg.ARR, objet: `Dossier sensible ${S}`, confidentialite: 'CONFIDENTIEL' }, [{ name: 'a2.txt' }]);
  const A2 = A2r.body;
  const A3r = await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe });
  const A3 = A3r.body;
  const U1 = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `Courrier de la DPE ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const U2 = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `Confidentiel DPE ${S}`, confidentialite: 'CONFIDENTIEL' }, [{ name: 'u2.txt' }])).body;
  check('enregistrements ORDINAIRE, CONFIDENTIEL, PERSONNEL, UNITE → 201 et numérotés', [A1, A2, A3, U1, U2].every((x) => x && x.numero), [A1, A3, U1].map((x) => x.numero).join(' | '));
  const notifPli = await prisma.notification.findFirst({ where: { userId: ids.chefdpe, type: 'PLI_PERSONNEL_RECU', channel: 'EMAIL' }, orderBy: { createdAt: 'desc' } });
  check('pli personnel : destinataire notifié, email sans objet', !!notifPli && !/Indiscret/.test(notifPli.body), notifPli && notifPli.body);

  console.log('— Imputation (DIRECTION : DN/DNA ; UNITE : chef d’unité ou DN/DNA ; habilitation ≠ autorité)');
  expect('secdg (habilité) impute A1', await call('secdg', 'POST', `/courrier/arrivees/${A1.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' }), 403);
  expect('chefdpe impute A1 (registre Direction)', await call('chefdpe', 'POST', `/courrier/arrivees/${A1.id}/imputations`, { imputeAId: ids.agent1, nature: 'ATTRIBUTION' }), 403);
  const imp1 = await call('dn', 'POST', `/courrier/arrivees/${A1.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', instructions: 'Préparer une réponse', echeance: iso(5 * J) });
  expect('DN impute A1 à chefdpe (attribution)', imp1, 201);
  expect('DN impute A1 une 2e fois à chefdpe', await call('dn', 'POST', `/courrier/arrivees/${A1.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' }), 409);
  expect('échéance passée', await call('dn', 'POST', `/courrier/arrivees/${A1.id}/imputations`, { imputeAId: ids.chefdee, nature: 'AVIS', echeance: iso(-J) }), 400);
  expect('chefssr sous-impute A1 (pas imputé)', await call('chefssr', 'POST', `/courrier/imputations/${imp1.body.id}/sous-imputations`, { imputeAId: ids.agent1, nature: 'ATTRIBUTION', echeance: iso(3 * J) }), 403);
  expect('chefdpe sous-impute A1 à agentdee (hors périmètre)', await call('chefdpe', 'POST', `/courrier/imputations/${imp1.body.id}/sous-imputations`, { imputeAId: ids.agentdee, nature: 'ATTRIBUTION', echeance: iso(3 * J) }), 403);
  expect('chefdpe sous-impute A1 avec échéance au-delà de la sienne', await call('chefdpe', 'POST', `/courrier/imputations/${imp1.body.id}/sous-imputations`, { imputeAId: ids.agent1, nature: 'ATTRIBUTION', echeance: iso(9 * J) }), 400);
  expect('chefdpe sous-impute A1 à agent1 (son périmètre)', await call('chefdpe', 'POST', `/courrier/imputations/${imp1.body.id}/sous-imputations`, { imputeAId: ids.agent1, nature: 'ATTRIBUTION', echeance: iso(3 * J) }), 201);
  expect('chefdpe impute U1 (chef de l’unité, registre UNITE)', await call('chefdpe', 'POST', `/courrier/arrivees/${U1.id}/imputations`, { imputeAId: ids.agent2, nature: 'ATTRIBUTION' }), 201);
  expect('chefdpe impute U1 à agentdee (hors de l’unité)', await call('chefdpe', 'POST', `/courrier/arrivees/${U1.id}/imputations`, { imputeAId: ids.agentdee, nature: 'INFORMATION' }), 403);
  expect('DN impute U1 à chefssr (membre de l’unité)', await call('dn', 'POST', `/courrier/arrivees/${U1.id}/imputations`, { imputeAId: ids.chefssr, nature: 'INFORMATION' }), 201);
  expect('DN impute U1 à agentdee (hors de l’unité)', await call('dn', 'POST', `/courrier/arrivees/${U1.id}/imputations`, { imputeAId: ids.agentdee, nature: 'INFORMATION' }), 403);
  expect('chefdee impute U1 (autre division)', await call('chefdee', 'POST', `/courrier/arrivees/${U1.id}/imputations`, { imputeAId: ids.agent2, nature: 'INFORMATION' }), 403);
  expect('DN impute le pli PERSONNEL A3', await call('dn', 'POST', `/courrier/arrivees/${A3.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' }), 409);
  const notifImp = await prisma.notification.findFirst({ where: { userId: ids.chefdpe, type: 'COURRIER_IMPUTE' }, orderBy: { createdAt: 'desc' } });
  check('notification d’imputation (ORDINAIRE) : objet présent', /Budget 2027/.test(notifImp.body), notifImp.body);

  console.log('— Visibilité ORDINAIRE (A1)');
  for (const [k, e] of [['secdg', 'CONTENU'], ['dn', 'CONTENU'], ['chefdpe', 'CONTENU'], ['agent1', 'CONTENU'], ['chefssr', 'CONTENU'], ['assdn', 'CONTENU'], ['chefsfp', 403], ['agentdee', 403], ['chefdee', 403], ['admin', 403]])
    check(`A1 ORDINAIRE — ${k} : ${e}`, (await niveau(k, A1.id)) === e);

  console.log('— Visibilité CONFIDENTIEL (A2)');
  expect('DN impute A2 à chefdpe (information)', await call('dn', 'POST', `/courrier/arrivees/${A2.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'INFORMATION', instructions: 'Instruction confidentielle' }), 201);
  for (const [k, e] of [['dn', 'CONTENU'], ['dna', 'CONTENU'], ['chefdpe', 'CONTENU'], ['secdg', 'METADONNEES'], ['chefssr', 403], ['assdn', 403], ['admin', 403], ['agent1', 403]])
    check(`A2 CONFIDENTIEL — ${k} : ${e}`, (await niveau(k, A2.id)) === e);
  const meta = (await get('secdg', A2.id)).body;
  check('secrétariat sur CONFIDENTIEL : objet visible, ni pièce ni imputation', !!meta.objet && meta.pieces.length === 0 && meta.imputations.length === 0);
  const pieceA2 = (await get('dn', A2.id)).body.pieces[0];
  expect('secdg télécharge le scan du CONFIDENTIEL', await call('secdg', 'GET', `/courrier/arrivees/${A2.id}/pieces/${pieceA2.id}/download`), 403);
  expect('assdn (assistant du DN) télécharge le scan du CONFIDENTIEL', await call('assdn', 'GET', `/courrier/arrivees/${A2.id}/pieces/${pieceA2.id}/download`), 403);
  const dl = await fetch(`http://localhost:3000/courrier/arrivees/${A2.id}/pieces/${pieceA2.id}/download`, { headers: { Authorization: 'Bearer ' + (await require('../lib').login('dna')) } });
  check('DNA télécharge le scan du CONFIDENTIEL → 200', dl.status === 200);

  console.log('— Intérim et CONFIDENTIEL, accès délégués');
  const supDn = await suppleance('dn', 'chefdee');
  check('suppléant du DN en intérim : ORDINAIRE A1 visible', (await niveau('chefdee', A1.id, I(ids.dn))) === 'CONTENU');
  check('suppléant du DN en intérim : CONFIDENTIEL A2 refusé (rôle emprunté)', (await niveau('chefdee', A2.id, I(ids.dn))) === 403);
  expect('suppléant du DN en intérim impute A2 (P.I.) sans accès ouvert', await call('chefdee', 'POST', `/courrier/arrivees/${A2.id}/imputations`, { imputeAId: ids.chefsaf, nature: 'INFORMATION' }, I(ids.dn)), 403);
  expect('DN ouvre A2 à son assistante assdn', await call('dn', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.assdn }), 201);
  check('assdn voit A2 après ouverture', (await niveau('assdn', A2.id)) === 'CONTENU');
  expect('DN ouvre A2 à son suppléant chefdee', await call('dn', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.chefdee }), 201);
  check('chefdee voit A2 en intérim après ouverture', (await niveau('chefdee', A2.id, I(ids.dn))) === 'CONTENU');
  expect('chefdee impute A2 P.I. après ouverture', await call('chefdee', 'POST', `/courrier/arrivees/${A2.id}/imputations`, { imputeAId: ids.chefsaf, nature: 'INFORMATION' }, I(ids.dn)), 201);
  const impPI = await prisma.imputationCourrier.findFirst({ where: { courrierId: A2.id, imputeAId: ids.chefsaf } });
  const auditPI = await prisma.auditLog.findFirst({ where: { entityType: 'ImputationCourrier', entityId: impPI.id } });
  check('imputation P.I. : auNomDe = DN stocké, audit acteur chefdee au nom du DN', impPI.auNomDeId === ids.dn && impPI.imputeParId === ids.chefdee && auditPI.onBehalfOfId === ids.dn && auditPI.actorId === ids.chefdee);
  expect('DN ouvre A2 à agent1 (ni assistant ni suppléant)', await call('dn', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.agent1 }), 403);
  expect('DN ouvre A2 deux fois à assdn', await call('dn', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.assdn }), 409);
  expect('DN ouvre un ORDINAIRE (A1)', await call('dn', 'POST', `/courrier/arrivees/${A1.id}/acces-delegues`, { beneficiaireId: ids.assdn }), 409);
  expect('chefdee (en intérim du DN) ouvre un accès', await call('chefdee', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.assdn }, I(ids.dn)), 403);
  expect('assdn (accès délégué) ouvre à son tour (pas de chaîne)', await call('assdn', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.chefdee }), 403);
  await call('dn', 'POST', `/suppleances/${supDn}/revoke`);
  check('suppléance révoquée → l’accès délégué du suppléant expire', (await niveau('chefdee', A2.id)) === 403);
  const accesAss = (await call('dn', 'GET', `/courrier/arrivees/${A2.id}/acces-delegues`)).body.find((x) => x.beneficiaireId === ids.assdn && !x.revoqueAt);
  expect('assdn tente de révoquer (pas l’auteur)', await call('assdn', 'POST', `/courrier/acces-delegues/${accesAss.id}/revoquer`), 403);
  expect('DN révoque l’accès de assdn', await call('dn', 'POST', `/courrier/acces-delegues/${accesAss.id}/revoquer`), 201);
  check('assdn ne voit plus A2 après révocation', (await niveau('assdn', A2.id)) === 403);
  expect('DN révoque une 2e fois', await call('dn', 'POST', `/courrier/acces-delegues/${accesAss.id}/revoquer`), 409);
  // Suppléance devenue non conforme : l'accès expire aussi.
  const supSaf = await suppleance('chefsaf', 'chefdpe');
  expect('chefsaf (imputée nommément) ouvre A2 à son suppléant chefdpe', await call('chefsaf', 'POST', `/courrier/arrivees/${A2.id}/acces-delegues`, { beneficiaireId: ids.chefdpe }), 201);
  await prisma.imputationCourrier.deleteMany({ where: { courrierId: A2.id, imputeAId: ids.chefdpe } }); // chefdpe n'est plus imputé : seul l'accès délégué compte
  check('chefdpe (suppléant de chefsaf) voit A2 par accès délégué', (await niveau('chefdpe', A2.id)) === 'CONTENU');
  await prisma.user.update({ where: { id: ids.chefdpe }, data: { role: 'CHEF_SECTION', sectionId: ids.SFP } }); // plus de rang comparable
  check('suppléance devenue non conforme → accès délégué expiré', (await niveau('chefdpe', A2.id)) === 403);
  await prisma.user.update({ where: { id: ids.chefdpe }, data: { role: 'CHEF_DIVISION', sectionId: null } });
  await call('chefsaf', 'POST', `/suppleances/${supSaf}/revoke`);

  console.log('— Pli PERSONNEL (A3)');
  for (const [k, e] of [['dn', 'EXISTENCE'], ['secdg', 'EXISTENCE'], ['chefdpe', 'CONTENU'], ['admin', 403], ['chefssr', 403], ['assdn', 403]])
    check(`A3 PERSONNEL — ${k} : ${e}`, (await niveau(k, A3.id)) === e);
  expect('DN complète le pli', await call('dn', 'POST', `/courrier/arrivees/${A3.id}/completer`, { objet: 'x y' }), 403);
  expect('chefdpe (destinataire) complète le pli', await call('chefdpe', 'POST', `/courrier/arrivees/${A3.id}/completer`, { objet: `Convocation personnelle ${S}` }), 201);
  const dnVue = (await get('dn', A3.id)).body;
  check('DN : toujours l’existence seule, objet masqué', dnVue.niveau === 'EXISTENCE' && dnVue.objet === null);
  expect('chefdpe ajoute un scan au pli', await upload('chefdpe', `/courrier/arrivees/${A3.id}/pieces`, {}, [{ name: 'pli.txt' }]), 201);
  const pieceA3 = (await get('chefdpe', A3.id)).body.pieces[0];
  expect('DN ouvre le scan du pli PERSONNEL', await call('dn', 'GET', `/courrier/arrivees/${A3.id}/pieces/${pieceA3.id}/download`), 403);
  const supDpe = await suppleance('chefdpe', 'chefdee');
  expect('suppléant de chefdpe en intérim complète son pli', await call('chefdee', 'POST', `/courrier/arrivees/${A3.id}/completer`, { objet: 'x y' }, I(ids.chefdpe)), 403);
  expect('suppléant de chefdpe en intérim lit son pli', await get('chefdee', A3.id, I(ids.chefdpe)), 403);
  expect('chefdpe ouvre le pli à son suppléant (jamais délégable)', await call('chefdpe', 'POST', `/courrier/arrivees/${A3.id}/acces-delegues`, { beneficiaireId: ids.chefdee }), 403);
  await call('chefdpe', 'POST', `/suppleances/${supDpe}/revoke`);
  expect('DN requalifie le pli', await call('dn', 'POST', `/courrier/arrivees/${A3.id}/requalifier`, { confidentialite: 'ORDINAIRE' }), 403);
  expect('requalification vers PERSONNEL', await call('chefdpe', 'POST', `/courrier/arrivees/${A3.id}/requalifier`, { confidentialite: 'PERSONNEL' }), 400);
  expect('chefdpe requalifie son pli en CONFIDENTIEL', await call('chefdpe', 'POST', `/courrier/arrivees/${A3.id}/requalifier`, { confidentialite: 'CONFIDENTIEL' }), 201);
  check('après requalification : DN voit le contenu (confidentiel, identité réelle)', (await niveau('dn', A3.id)) === 'CONTENU');
  expect('retour vers PERSONNEL impossible (sens unique)', await call('chefdpe', 'POST', `/courrier/arrivees/${A3.id}/requalifier`, { confidentialite: 'ORDINAIRE' }), 409);
  expect('le courrier requalifié s’impute', await call('dn', 'POST', `/courrier/arrivees/${A3.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' }), 201);

  console.log('— Registre UNITE : droits du chef d’unité (U2 CONFIDENTIEL DPE)');
  for (const [k, e] of [['chefdpe', 'CONTENU'], ['dn', 'CONTENU'], ['secdpe', 'METADONNEES'], ['chefdee', 403], ['chefssr', 403]])
    check(`U2 CONFIDENTIEL (unité DPE) — ${k} : ${e}`, (await niveau(k, U2.id)) === e);

  console.log('— Correction auditée, annulation, suppression impossible');
  expect('agent1 corrige A1', await call('agent1', 'PATCH', `/courrier/arrivees/${A1.id}`, { expediteur: 'Autre' }), 403);
  expect('secdg corrige l’expéditeur de A1', await call('secdg', 'PATCH', `/courrier/arrivees/${A1.id}`, { expediteur: 'Ministère du Plan (corrigé)' }), 200);
  const auditCorr = await prisma.auditLog.findFirst({ where: { entityType: 'CourrierArrivee', entityId: A1.id, metadata: { path: ['event'], equals: 'correction' } }, orderBy: { createdAt: 'desc' } });
  check('audit de correction avant/après', auditCorr?.metadata?.avant?.expediteur === 'Ministère du Plan' && auditCorr?.metadata?.apres?.expediteur === 'Ministère du Plan (corrigé)', JSON.stringify(auditCorr?.metadata));
  expect('tentative de modifier le numéro par l’API (champ refusé)', await call('secdg', 'PATCH', `/courrier/arrivees/${A1.id}`, { numero: 'X' }), 400);
  expect('suppression d’une arrivée (aucune route)', await call('dn', 'DELETE', `/courrier/arrivees/${A1.id}`), 404);
  const U3 = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `À annuler ${S}`, confidentialite: 'ORDINAIRE' })).body;
  expect('annulation sans motif', await call('secdpe', 'POST', `/courrier/arrivees/${U3.id}/annuler`, {}), 400);
  expect('annulation avec motif trop court', await call('secdpe', 'POST', `/courrier/arrivees/${U3.id}/annuler`, { motif: 'non' }), 400);
  expect('agent2 annule', await call('agent2', 'POST', `/courrier/arrivees/${U3.id}/annuler`, { motif: 'Doublon de saisie' }), 403);
  const ann = await call('secdpe', 'POST', `/courrier/arrivees/${U3.id}/annuler`, { motif: 'Doublon de saisie' });
  expect('secdpe annule avec motif', ann, 201);
  check('annulée : statut ANNULE, numéro conservé', ann.body.statut === 'ANNULE' && ann.body.numero === U3.numero, `${ann.body.statut} ${ann.body.numero}`);
  expect('annulation une 2e fois', await call('secdpe', 'POST', `/courrier/arrivees/${U3.id}/annuler`, { motif: 'Doublon de saisie' }), 409);
  expect('imputation d’un courrier annulé', await call('chefdpe', 'POST', `/courrier/arrivees/${U3.id}/imputations`, { imputeAId: ids.agent2, nature: 'ATTRIBUTION' }), 409);

  console.log('— Traitement et classement');
  const A4 = (await arrivee('secdg', { registreId: reg.ARR, objet: `À classer ${S}`, confidentialite: 'ORDINAIRE' })).body;
  expect('classement avant imputation', await call('secdg', 'POST', `/courrier/arrivees/${A4.id}/classer`), 409);
  const i4 = await call('dn', 'POST', `/courrier/arrivees/${A4.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' });
  const i4b = await call('dn', 'POST', `/courrier/arrivees/${A4.id}/imputations`, { imputeAId: ids.chefdee, nature: 'AVIS' });
  expect('classement avec attribution en cours', await call('secdg', 'POST', `/courrier/arrivees/${A4.id}/classer`), 409);
  expect('avis sans compte rendu', await call('chefdee', 'POST', `/courrier/imputations/${i4b.body.id}/traiter`, {}), 400);
  expect('chefdee traite l’attribution de chefdpe', await call('chefdee', 'POST', `/courrier/imputations/${i4.body.id}/traiter`, {}), 403);
  const tr = await call('chefdpe', 'POST', `/courrier/imputations/${i4.body.id}/traiter`, { compteRendu: 'Réponse préparée' });
  expect('chefdpe traite son attribution', tr, 201);
  check('courrier → TRAITE', tr.body.statut === 'TRAITE');
  expect('traitement une 2e fois', await call('chefdpe', 'POST', `/courrier/imputations/${i4.body.id}/traiter`, {}), 409);
  const cl = await call('secdg', 'POST', `/courrier/arrivees/${A4.id}/classer`);
  expect('secdg classe', cl, 201);
  check('courrier → CLASSE', cl.body.statut === 'CLASSE');

  console.log('— Conversion en tâche (modèle D2)');
  const A5 = (await arrivee('secdg', { registreId: reg.ARR, objet: `Réponse ministre ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const i5 = (await call('dn', 'POST', `/courrier/arrivees/${A5.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', instructions: 'Rédiger la réponse', echeance: iso(4 * J) })).body;
  expect('chefdpe (imputé, pas l’imputant) convertit', await call('chefdpe', 'POST', `/courrier/imputations/${i5.id}/convertir-en-tache`, {}), 403);
  const conv = await Promise.all([...Array(5)].map(() => call('dn', 'POST', `/courrier/imputations/${i5.id}/convertir-en-tache`, {})));
  check('5 conversions simultanées → 1 × 201, 4 × 409', conv.filter((r) => r.status === 201).length === 1 && conv.filter((r) => r.status === 409).length === 4, conv.map((r) => r.status).join(','));
  const t5 = await prisma.task.findUnique({ where: { sourceImputationId: i5.id } });
  check('tâche ORDINAIRE : titre avec objet, instructions recopiées, échéance reprise, rattachée à l’unité de l’imputé', /Réponse ministre/.test(t5.title) && t5.description === 'Rédiger la réponse' && t5.divisionId === ids.DPE && !!t5.dueDate);
  await call('chefdpe', 'POST', `/tasks/${t5.id}/start`); await call('chefdpe', 'POST', `/tasks/${t5.id}/submit`);
  expect('DN (créateur) valide la tâche', await call('dn', 'POST', `/tasks/${t5.id}/validate`, {}), 201);
  const apres = await get('dn', A5.id);
  check('clôture automatique : imputation TRAITEE, courrier TRAITE', apres.body.imputations[0].statut === 'TRAITEE' && apres.body.statut === 'TRAITE');

  console.log('— Conversion d’un CONFIDENTIEL : titre neutre, sans instruction, palier maximal');
  const A6 = (await arrivee('secdg', { registreId: reg.ARR, objet: `Enquête interne ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  const i6 = (await call('dn', 'POST', `/courrier/arrivees/${A6.id}/imputations`, { imputeAId: ids.agent1, nature: 'ATTRIBUTION', instructions: 'Instruction très secrète', echeance: iso(4 * J) })).body;
  const c6 = await call('dn', 'POST', `/courrier/imputations/${i6.id}/convertir-en-tache`, {});
  expect('DN convertit l’imputation confidentielle', c6, 201);
  const t6 = await prisma.task.findUnique({ where: { sourceImputationId: i6.id } });
  check('tâche : titre neutre, aucune instruction, TRES_CONFIDENTIEL_DIRIGEANTS', t6.title === `Traitement du courrier ${A6.numero}` && t6.description === null && t6.confidentiality === 'TRES_CONFIDENTIEL_DIRIGEANTS', t6.title);
  for (const k of ['chefssr', 'chefdpe']) {
    const one = await call(k, 'GET', `/tasks/${t6.id}`);
    const list = JSON.stringify((await call(k, 'GET', '/tasks')).body);
    check(`${k} (cascade de l’imputé) : tâche invisible, ni objet ni instructions dans ses tâches`, one.status === 403 && !list.includes('Enquête interne') && !list.includes('Instruction très secrète'), `GET ${one.status}`);
  }
  const vueAgent = await call('agent1', 'GET', `/tasks/${t6.id}`);
  check('l’imputé voit sa tâche (titre neutre) et le courrier par ailleurs', vueAgent.status === 200 && (await niveau('agent1', A6.id)) === 'CONTENU');
  const notifTache = await prisma.notification.findFirst({ where: { userId: ids.agent1, type: 'TACHE_ASSIGNEE', link: `/tasks/${t6.id}`, channel: 'EMAIL' } });
  const notifConf = await prisma.notification.findFirst({ where: { userId: ids.agent1, type: 'COURRIER_IMPUTE', link: `/courrier?arrivee=${A6.id}`, channel: 'EMAIL' } });
  check('emails (confidentiel) : ni objet ni instructions', !/Enquête interne|très secrète/.test(notifTache.body + notifTache.title + notifConf.body), notifConf.body);

  require('fs').writeFileSync(E.etat('arrivees.json'), JSON.stringify({ A1: A1.id, A2: A2.id, A3: A3.id, A6: A6.id, U1: U1.id, U2: U2.id, i5: i5.id }));
  await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(1); });
