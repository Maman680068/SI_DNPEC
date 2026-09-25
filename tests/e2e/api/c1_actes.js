// D7 — départs et actes : circuit de visa, signature numérotée, expédition, prise de connaissance, intégrité.
const E = require('../config');
const { call, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36);
const I = (id) => ({ 'X-Interim-For': id });
const acte = (k, champs, h) => call(k, 'POST', '/courrier/actes', { confidentialite: 'ORDINAIRE', objet: `Acte ${S}`, ...champs }, h);
const post = (k, id, act, body = {}, h) => call(k, 'POST', `/courrier/actes/${id}/${act}`, body, h);
const get = (k, id, h) => call(k, 'GET', `/courrier/actes/${id}`, undefined, h);
const compteur = async (code, uniteKey) => (await prisma.compteurRegistre.findUnique({ where: { registreId_uniteKey_annee: { registreId: reg[code], uniteKey, annee: new Date().getFullYear() } } }))?.dernier ?? 0;
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
  return r.body.id;
}
const circuit = (a) => a.visas.filter((v) => v.cycle === a.cycle).map((v) => `${v.niveau}:${v.statut}${v.motifSaut ? '(' + v.motifSaut + ')' : ''}`).join(' → ');
(async () => {
  console.log('— Brouillon');
  expect('acte dans un registre d’arrivée', await acte('agent1', { registreId: reg.ARR }), 400);
  expect('DN (sans unité) rédige dans un registre d’unité', await acte('dn', { registreId: reg.DEPU }), 400);
  expect('prise de connaissance sans bénéficiaire', await acte('agent1', { registreId: reg.ATT, priseConnaissanceRequise: true }), 400);
  const d1 = (await acte('agent1', { registreId: reg.DEP, objet: `Réponse au ministère ${S}`, destinataires: 'Ministère du Plan' })).body;
  check('brouillon : aucun numéro', d1.numero === null && d1.sequence === null && d1.statut === 'BROUILLON');
  expect('DN lit le brouillon d’agent1 (travail personnel)', await get('dn', d1.id), 403);

  console.log('— Circuit DIRECTION : Chef de Section → Chef de Division → DN/DNA');
  const s1 = await post('agent1', d1.id, 'soumettre');
  expect('agent1 soumet', s1, 201);
  check('circuit construit depuis le rédacteur', circuit(s1.body) === 'CHEF_SECTION:EN_ATTENTE → CHEF_DIVISION:EN_ATTENTE', circuit(s1.body));
  expect('chefdpe vise avant son tour', await post('chefdpe', d1.id, 'viser'), 403);
  expect('agent1 vise sa propre lettre', await post('agent1', d1.id, 'viser'), 403);
  expect('chefssr vise', await post('chefssr', d1.id, 'viser', { commentaire: 'Bon pour moi' }), 201);
  const v2 = await post('chefdpe', d1.id, 'viser');
  expect('chefdpe vise', v2, 201);
  check('acte → A_SIGNER', v2.body.statut === 'A_SIGNER');
  expect('chefdpe signe un acte DIRECTION', await post('chefdpe', d1.id, 'signer'), 403);
  expect('secdg (habilité) signe', await post('secdg', d1.id, 'signer'), 403);
  const sg = await post('dn', d1.id, 'signer');
  expect('DN signe', sg, 201);
  check('numéro attribué à la signature', /^\d{4}\/MEFB\/DNPEC\/DEP\/\d{4}$/.test(sg.body.numero) && sg.body.statut === 'SIGNE', sg.body.numero);
  expect('secdpe (autre registre) expédie', await post('secdpe', d1.id, 'expedier', { modeExpedition: 'Porteur' }), 403);
  expect('secdg expédie', await post('secdg', d1.id, 'expedier', { modeExpedition: 'Porteur' }), 201);
  expect('expédition une 2e fois', await post('secdg', d1.id, 'expedier', { modeExpedition: 'Porteur' }), 409);

  console.log('— Renvoi pour correction, resoumission');
  const d2 = (await acte('agent1', { registreId: reg.DEP })).body;
  await post('agent1', d2.id, 'soumettre');
  expect('renvoi sans motif', await post('chefssr', d2.id, 'renvoyer', {}), 400);
  const rv = await post('chefssr', d2.id, 'renvoyer', { motif: 'Reformuler le 2e paragraphe' });
  expect('chefssr renvoie avec motif', rv, 201);
  check('retour au rédacteur (RENVOYE)', rv.body.statut === 'RENVOYE');
  expect('agent1 corrige', await call('agent1', 'PATCH', `/courrier/actes/${d2.id}`, { corps: 'Texte corrigé' }), 200);
  const rs = await post('agent1', d2.id, 'soumettre');
  check('resoumission : cycle 2, circuit repart du début', rs.body.cycle === 2 && circuit(rs.body) === 'CHEF_SECTION:EN_ATTENTE → CHEF_DIVISION:EN_ATTENTE', `cycle ${rs.body.cycle} : ${circuit(rs.body)}`);
  expect('suppression d’un acte déjà soumis', await call('agent1', 'DELETE', `/courrier/actes/${d2.id}`), 409);

  console.log('— Registre UNITE : le Chef de Division/Cellule émetteur signe, jamais un Chef de Section');
  const u1 = (await acte('agent1', { registreId: reg.DEPU })).body;
  const su = await post('agent1', u1.id, 'soumettre');
  check('circuit UNITE : Chef de Section seulement (le chef d’unité signe)', circuit(su.body) === 'CHEF_SECTION:EN_ATTENTE', circuit(su.body));
  await post('chefssr', u1.id, 'viser');
  expect('chefssr (Chef de Section) signe', await post('chefssr', u1.id, 'signer'), 403);
  expect('chefdee (autre division) signe', await post('chefdee', u1.id, 'signer'), 403);
  expect('chefsaf (autre unité) signe', await post('chefsaf', u1.id, 'signer'), 403);
  const su2 = await post('chefdpe', u1.id, 'signer');
  expect('chefdpe (chef de l’unité émettrice) signe', su2, 201);
  check('numéro de l’unité DPE', /\/DPE\//.test(su2.body.numero), su2.body.numero);

  console.log('— Signatures concurrentes du même acte');
  const u2 = (await acte('agent2', { registreId: reg.DEPU })).body;
  await post('agent2', u2.id, 'soumettre'); await post('chefssr', u2.id, 'viser');
  const avant = await compteur('DEPU', `DIV:${ids.DPE}`);
  const sig = await Promise.all([...Array(10)].map(() => post('chefdpe', u2.id, 'signer')));
  const apres = await compteur('DEPU', `DIV:${ids.DPE}`);
  check('10 signatures simultanées → 1 × 201, 9 × 409', sig.filter((r) => r.status === 201).length === 1 && sig.filter((r) => r.status === 409).length === 9, sig.map((r) => r.status).join(','));
  check(`un seul numéro consommé (compteur ${avant} → ${apres})`, apres === avant + 1);
  const sigAudit = await prisma.auditLog.count({ where: { entityType: 'ActeCourrier', entityId: u2.id, metadata: { path: ['event'], equals: 'signature' } } });
  check('une seule signature journalisée', sigAudit === 1);

  console.log('— Compteurs indépendants par unité');
  const e1 = (await acte('agentdee', { registreId: reg.DEPU })).body;
  await post('agentdee', e1.id, 'soumettre'); await post('chefse', e1.id, 'viser');
  const avantDpe = await compteur('DEPU', `DIV:${ids.DPE}`);
  const se = await post('chefdee', e1.id, 'signer');
  check(`DEE : sa propre suite (${se.body.numero}), celle de la DPE inchangée (${avantDpe})`, /\/DEE\//.test(se.body.numero) && (await compteur('DEPU', `DIV:${ids.DEE}`)) >= 1 && (await compteur('DEPU', `DIV:${ids.DPE}`)) === avantDpe, se.body.numero);

  console.log('— Personne ne vise sa propre lettre, même en intérim');
  const c1 = (await acte('chefssr', { registreId: reg.DEP })).body;
  const sc1 = await post('chefssr', c1.id, 'soumettre');
  check('rédacteur Chef de Section : son niveau est sauté (journalisé)', circuit(sc1.body) === 'CHEF_SECTION:SAUTE(Le rédacteur est lui-même ce chef) → CHEF_DIVISION:EN_ATTENTE', circuit(sc1.body));
  const supDpe = await suppleance('chefdpe', 'chefssr');
  expect('chefssr, suppléant de chefdpe, vise en intérim sa propre lettre', await post('chefssr', c1.id, 'viser', {}, I(ids.chefdpe)), 403);
  await call('chefdpe', 'POST', `/suppleances/${supDpe}/revoke`);

  console.log('— Poste vacant, anomalie d’organisation');
  await call('admin', 'PATCH', `/users/${ids.chefsfp}/status`, { status: 'SUSPENDU' });
  const v1 = (await acte('secdpe', { registreId: reg.DEP })).body;
  const sv1 = await post('secdpe', v1.id, 'soumettre');
  check('Chef de Section vacant : niveau sauté (journalisé)', circuit(sv1.body) === 'CHEF_SECTION:SAUTE(Poste vacant) → CHEF_DIVISION:EN_ATTENTE', circuit(sv1.body));
  const aSoum = await prisma.auditLog.findFirst({ where: { entityType: 'ActeCourrier', entityId: v1.id, metadata: { path: ['event'], equals: 'soumission' } } });
  check('saut de niveau audité', JSON.stringify(aSoum.metadata).includes('Poste vacant'));
  await call('admin', 'PATCH', `/users/${ids.chefsfp}/status`, { status: 'ACTIF' });
  await prisma.user.update({ where: { id: ids.chefsfp }, data: { sectionId: ids.SSR } }); // données héritées : 2 chefs actifs sur SSR
  const an = (await acte('agent1', { registreId: reg.DEP })).body;
  expect('deux chefs actifs au même niveau → soumission refusée', await post('agent1', an.id, 'soumettre'), 409);
  await prisma.user.update({ where: { id: ids.chefsfp }, data: { sectionId: ids.SFP } });

  console.log('— Viseur attendu qui n’est plus chef : le rédacteur resoumet');
  const o1 = (await acte('agent1', { registreId: reg.DEP })).body;
  await post('agent1', o1.id, 'soumettre');
  const supSsr = await suppleance('chefssr', 'chefsfp');
  await call('admin', 'PATCH', `/users/${ids.chefssr}/status`, { status: 'SUSPENDU' });
  const avantNotif = await prisma.notification.count({ where: { userId: ids.agent1, type: 'ACTE_RENVOYE' } });
  expect('suppléant du viseur suspendu vise en intérim', await post('chefsfp', o1.id, 'viser', {}, I(ids.chefssr)), 409);
  check('rédacteur prévenu, circuit signalé obsolète', (await prisma.notification.count({ where: { userId: ids.agent1, type: 'ACTE_RENVOYE' } })) > avantNotif && (await get('agent1', o1.id)).body.circuitObsolete === true);
  const ro = await post('agent1', o1.id, 'soumettre');
  check('resoumission : circuit recalculé (section vacante sautée)', ro.body.cycle === 2 && circuit(ro.body) === 'CHEF_SECTION:SAUTE(Poste vacant) → CHEF_DIVISION:EN_ATTENTE', circuit(ro.body));
  await call('admin', 'PATCH', `/users/${ids.chefssr}/status`, { status: 'ACTIF' });
  await call('chefssr', 'POST', `/suppleances/${supSsr}/revoke`);

  console.log('— Auto-signature interdite (bénéficiaire, et son suppléant)');
  const b1 = (await acte('agent1', { registreId: reg.ATT, objet: `Attestation de chefdpe ${S}`, beneficiaireId: ids.chefdpe })).body;
  await post('agent1', b1.id, 'soumettre'); await post('chefssr', b1.id, 'viser');
  expect('chefdpe signe l’acte dont il est bénéficiaire', await post('chefdpe', b1.id, 'signer'), 403);
  const supB = await suppleance('chefdpe', 'chefdee');
  expect('suppléant de chefdpe signe en intérim l’acte qui concerne chefdpe', await post('chefdee', b1.id, 'signer', {}, I(ids.chefdpe)), 403);
  await call('chefdpe', 'POST', `/suppleances/${supB}/revoke`);
  expect('DN signe', await post('dn', b1.id, 'signer'), 201);

  console.log('— Prise de connaissance');
  const p1 = (await acte('agent1', { registreId: reg.ATT, objet: `Attestation de service ${S}`, beneficiaireId: ids.agent2, priseConnaissanceRequise: true })).body;
  expect('bénéficiaire lit le brouillon', await get('agent2', p1.id), 403);
  await post('agent1', p1.id, 'soumettre'); await post('chefssr', p1.id, 'viser');
  expect('bénéficiaire lit l’acte en visa', await get('agent2', p1.id), 403);
  expect('prise de connaissance avant signature', await post('agent2', p1.id, 'prise-de-connaissance'), 409);
  await post('chefdpe', p1.id, 'signer');
  const pv = await get('agent2', p1.id);
  check('après signature : le bénéficiaire lit l’acte, « en attente de prise de connaissance »', pv.status === 200 && pv.body.enAttentePriseConnaissance === true);
  const npc = await prisma.notification.findFirst({ where: { userId: ids.agent2, type: 'ACTE_PRISE_CONNAISSANCE', channel: 'EMAIL', link: `/courrier?acte=${p1.id}` } });
  check('notification + email de prise de connaissance', !!npc, npc && npc.body);
  expect('chefssr atteste à la place du bénéficiaire', await post('chefssr', p1.id, 'prise-de-connaissance'), 403);
  const pc = await post('agent2', p1.id, 'prise-de-connaissance');
  expect('bénéficiaire atteste « J’ai pris connaissance »', pc, 201);
  check('plus « en attente », horodatage posé', pc.body.enAttentePriseConnaissance === false && !!pc.body.priseConnaissanceAt);
  expect('deuxième attestation', await post('agent2', p1.id, 'prise-de-connaissance'), 409);
  check('prise de connaissance auditée', (await prisma.auditLog.count({ where: { entityType: 'ActeCourrier', entityId: p1.id, actorId: ids.agent2, metadata: { path: ['event'], equals: 'prise_de_connaissance' } } })) === 1);

  console.log('— Acte CONFIDENTIEL : circuit, intérim par accès délégué, secrétariat après signature');
  const k1 = (await acte('agent1', { registreId: reg.DEP, confidentialite: 'CONFIDENTIEL', objet: `Note secrète ${S}` })).body;
  await post('agent1', k1.id, 'soumettre');
  for (const [k, e] of [['chefssr', 200], ['chefdpe', 200], ['dn', 200], ['chefsfp', 403], ['assdn', 403], ['secdg', 403], ['admin', 403], ['agent2', 403]])
    check(`acte CONFIDENTIEL en visa — ${k} : ${e}`, (await get(k, k1.id)).status === e);
  const nv = await prisma.notification.findFirst({ where: { userId: ids.chefssr, type: 'ACTE_A_VISER', channel: 'EMAIL', link: `/courrier?acte=${k1.id}` } });
  check('email « à viser » d’un CONFIDENTIEL sans objet', !!nv && !nv.body.includes('Note secrète'), nv && nv.body);
  const supK = await suppleance('chefssr', 'chefsfp');
  expect('suppléant de chefssr vise P.I. sans accès ouvert', await post('chefsfp', k1.id, 'viser', {}, I(ids.chefssr)), 403);
  expect('chefssr ouvre l’acte à son suppléant', await call('chefssr', 'POST', `/courrier/actes/${k1.id}/acces-delegues`, { beneficiaireId: ids.chefsfp }), 201);
  const vk = await post('chefsfp', k1.id, 'viser', {}, I(ids.chefssr));
  expect('suppléant vise P.I. après ouverture', vk, 201);
  const visaPI = vk.body.visas.find((v) => v.niveau === 'CHEF_SECTION' && v.cycle === vk.body.cycle);
  check('visa P.I. : posé par chefsfp au nom de chefssr', visaPI.viseParId === ids.chefsfp && visaPI.viseAuNomDeId === ids.chefssr);
  await call('chefssr', 'POST', `/suppleances/${supK}/revoke`);
  await post('chefdpe', k1.id, 'viser'); await post('dn', k1.id, 'signer');
  check('secrétariat : voit le CONFIDENTIEL signé (pour l’expédier)', (await get('secdg', k1.id)).status === 200);
  check('ni l’assistant, ni l’admin après signature', (await get('assdn', k1.id)).status === 403 && (await get('admin', k1.id)).status === 403);

  console.log('— Suppression et annulation');
  const x1 = (await acte('agent1', { registreId: reg.DEP })).body;
  expect('chefssr supprime le brouillon d’agent1', await call('chefssr', 'DELETE', `/courrier/actes/${x1.id}`), 403);
  expect('agent1 supprime son brouillon jamais soumis', await call('agent1', 'DELETE', `/courrier/actes/${x1.id}`), 204);
  check('audit de suppression du brouillon', (await prisma.auditLog.count({ where: { entityType: 'ActeCourrier', entityId: x1.id, action: 'SUPPRESSION' } })) === 1);
  expect('annulation sans motif', await post('agent1', d2.id, 'annuler', {}), 400);
  const a2 = await post('agent1', d2.id, 'annuler', { motif: 'Réponse devenue sans objet' });
  expect('annulation d’un acte soumis, non numéroté', a2, 201);
  check('ANNULE, aucun numéro', a2.body.statut === 'ANNULE' && a2.body.numero === null);
  expect('agent1 annule un acte numéroté', await post('agent1', u1.id, 'annuler', { motif: 'Erreur de destinataire' }), 403);
  const a3 = await post('chefdpe', u1.id, 'annuler', { motif: 'Erreur de destinataire' });
  expect('le signataire annule l’acte numéroté', a3, 201);
  check('numéro conservé après annulation', a3.body.statut === 'ANNULE' && a3.body.numero === su2.body.numero, a3.body.numero);
  expect('suppression d’un acte numéroté', await call('agent1', 'DELETE', `/courrier/actes/${d1.id}`), 409);

  require('fs').writeFileSync(E.etat('actes.json'), JSON.stringify({ d1: d1.id, k1: k1.id, p1: p1.id }));
  await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(1); });
