// C2 — projection pour les écrans : noms des personnes citées, droits par imputation,
// droits d'acte (renvoyer, annuler, ajouter une annexe, resoumettre). Chaque droit affiché
// est confronté à l'action réelle : droit faux → refus ; droit vrai → accepté.
const E = require('../config');
const { call, upload, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36);
const I = (id) => ({ 'X-Interim-For': id });
const arrivee = (key, champs) => upload(key, '/courrier/arrivees', { dateReception: iso(0), expediteur: 'Ministère du Plan', ...champs });
const COMPTES = Object.keys(ids).filter((k) => !/^[A-Z]/.test(k));
const CHAMPS_P = 'firstName,id,jobTitle,lastName,role';
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
// Acteurs : chaque compte en nom propre, plus un suppléant en intérim.
const ACTEURS = [...COMPTES.map((k) => ({ k, h: {}, label: k })), { k: 'chefssr', h: I(ids.chefdpe), label: 'chefssr P.I. chefdpe' }];

// droit(acteur) lu à l'écran ; tenter(acteur) = action réelle. Refus attendu pour tous les « faux »,
// puis succès pour les « vrais » (fixture fraîche fournie par `frais` si l'action est destructive).
async function confronter(label, lireDroit, tenter, attendus) {
  const vrais = [], mauvais = [];
  for (const a of ACTEURS) {
    const d = await lireDroit(a);
    if (d) { vrais.push(a); continue; }
    const r = await tenter(a, false);
    if (r.status < 400) mauvais.push(`${a.label} (droit faux, action ${r.status})`);
  }
  for (const a of vrais) {
    const r = await tenter(a, true);
    if (r.status >= 400) mauvais.push(`${a.label} (droit vrai, action ${r.status} « ${r.body && r.body.message} »)`);
  }
  const noms = vrais.map((a) => a.label).sort().join(', ');
  check(`${label} : droit affiché = action acceptée`, mauvais.length === 0 && noms === [...attendus].sort().join(', '), `vrai pour [${noms}]${mauvais.length ? ' ; écarts : ' + mauvais.join(' ; ') : ''}`);
}

(async () => {
  await suppleance('chefdpe', 'chefssr');

  console.log('— Noms des personnes citées (arrivée)');
  const A = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 projection ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const imp = (await call('dn', 'POST', `/courrier/arrivees/${A.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', echeance: iso(6 * J) })).body;
  const vu = (await call('dn', 'GET', `/courrier/arrivees/${A.id}`)).body;
  const i0 = vu.imputations.find((i) => i.id === imp.id);
  check('personnes : imputant et imputé nommés', vu.personnes[ids.dn] && vu.personnes[ids.chefdpe] && Object.keys(vu.personnes).length === 2, Object.values(vu.personnes).map((p) => `${p.firstName} ${p.lastName}`).join(', '));
  check('personnes : champs d’affichage seulement', [...new Set(Object.values(vu.personnes).map((p) => Object.keys(p).sort().join(',')))].join('|') === CHAMPS_P);
  check('droits par imputation publiés', i0 && JSON.stringify(Object.keys(i0.droits).sort()) === '["convertir","sousImputer","traiter"]', JSON.stringify(i0 && i0.droits));
  check('droit « répondre » publié (DN, contenu)', vu.droits.repondre === true);
  const liste = (await call('dn', 'GET', `/courrier/arrivees?q=${encodeURIComponent('C2 projection ' + S)}`)).body;
  check('liste : mêmes personnes que la fiche', liste.length === 1 && JSON.stringify(liste[0].personnes) === JSON.stringify(vu.personnes));
  const P = (await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe })).body;
  const pe = await call('secdg', 'GET', `/courrier/arrivees/${P.id}`);
  check('pli personnel vu par le secrétariat (EXISTENCE) : seul le destinataire est nommé', pe.body.niveau === 'EXISTENCE' && Object.keys(pe.body.personnes).join() === ids.chefdpe && pe.body.objet === null);
  const K = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 conf ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  await call('dn', 'POST', `/courrier/arrivees/${K.id}/imputations`, { imputeAId: ids.chefdee, nature: 'ATTRIBUTION' });
  const km = await call('secdg', 'GET', `/courrier/arrivees/${K.id}`);
  check('CONFIDENTIEL vu par le secrétariat (METADONNEES) : ni imputations ni personnes citées', km.body.niveau === 'METADONNEES' && km.body.imputations.length === 0 && Object.keys(km.body.personnes).length === 0);

  console.log('— Droits par imputation confrontés aux actions');
  const droitImp = (arr, impId, cle) => async (a) => {
    const r = await call(a.k, 'GET', `/courrier/arrivees/${arr}`, undefined, a.h);
    return r.status === 200 && !!(r.body.imputations.find((i) => i.id === impId) || { droits: {} }).droits[cle];
  };
  await confronter('sous-imputer', droitImp(A.id, imp.id, 'sousImputer'),
    (a) => call(a.k, 'POST', `/courrier/imputations/${imp.id}/sous-imputations`, { imputeAId: ids.agent1, nature: 'INFORMATION', echeance: iso(2 * J) }, a.h),
    ['chefdpe', 'chefssr P.I. chefdpe']);
  await confronter('convertir en tâche', droitImp(A.id, imp.id, 'convertir'),
    (a, vrai) => call(a.k, 'POST', `/courrier/imputations/${imp.id}/convertir-en-tache`, {}, a.h),
    ['dn']);
  const apres = (await call('dn', 'GET', `/courrier/arrivees/${A.id}`)).body.imputations.find((i) => i.id === imp.id);
  check('après conversion : « convertir » retombe à faux', apres.droits.convertir === false && !!apres.tache);
  // Traiter : destructif — une imputation fraîche par acteur « vrai ».
  const B = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 traiter ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const impB = (await call('dn', 'POST', `/courrier/arrivees/${B.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'AVIS' })).body;
  let premier = true;
  await confronter('traiter', droitImp(B.id, impB.id, 'traiter'), async (a, vrai) => {
    if (!vrai || premier) { if (vrai) premier = false; return call(a.k, 'POST', `/courrier/imputations/${impB.id}/traiter`, { compteRendu: 'Avis favorable' }, a.h); }
    const C = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 traiter bis ${S}`, confidentialite: 'ORDINAIRE' })).body;
    const impC = (await call('dn', 'POST', `/courrier/arrivees/${C.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'AVIS' })).body;
    const d = await droitImp(C.id, impC.id, 'traiter')(a);
    const r = await call(a.k, 'POST', `/courrier/imputations/${impC.id}/traiter`, { compteRendu: 'Avis favorable' }, a.h);
    return d ? r : { status: 499, body: { message: 'droit faux sur la fixture fraîche' } };
  }, ['chefdpe', 'chefssr P.I. chefdpe']);
  const tr = (await call('chefdpe', 'GET', `/courrier/arrivees/${B.id}`)).body.imputations.find((i) => i.id === impB.id);
  check('imputation traitée : plus aucun droit', !tr.droits.traiter && !tr.droits.sousImputer && !tr.droits.convertir);
  await call('secdg', 'POST', `/courrier/arrivees/${A.id}/annuler`, { motif: 'Fin du test C2' });
  const an = (await call('dn', 'GET', `/courrier/arrivees/${A.id}`)).body;
  check('courrier annulé : plus aucun droit d’imputation ni « répondre »', an.imputations.every((i) => !i.droits.traiter && !i.droits.sousImputer && !i.droits.convertir) && an.droits.repondre === false);

  console.log('— Actes : noms, renvoyer, annuler, ajouter une annexe, resoumettre');
  const acte = async () => {
    const k = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `C2 acte ${S}`, destinataires: 'Ministère' })).body;
    await call('agent1', 'POST', `/courrier/actes/${k.id}/soumettre`);
    return k;
  };
  const k1 = await acte();
  const vk = (await call('agent1', 'GET', `/courrier/actes/${k1.id}`)).body;
  check('acte : rédacteur et viseur attendu nommés', vk.personnes[ids.agent1] && vk.personnes[ids.chefssr], Object.values(vk.personnes).map((p) => p.lastName).join(', '));
  check('acte : champs d’affichage seulement', [...new Set(Object.values(vk.personnes).map((p) => Object.keys(p).sort().join(',')))].join('|') === CHAMPS_P);
  const droitActe = (id, cle) => async (a) => { const r = await call(a.k, 'GET', `/courrier/actes/${id}`, undefined, a.h); return r.status === 200 && !!r.body.droits[cle]; };
  let fraisK = null;
  await confronter('renvoyer (en visa)', droitActe(k1.id, 'renvoyer'), async (a, vrai) => {
    if (!vrai) return call(a.k, 'POST', `/courrier/actes/${k1.id}/renvoyer`, { motif: 'Reprendre le paragraphe 2' }, a.h);
    fraisK = await acte();
    return call(a.k, 'POST', `/courrier/actes/${fraisK.id}/renvoyer`, { motif: 'Reprendre le paragraphe 2' }, a.h);
  }, ['chefssr', 'chefssr P.I. chefdpe']);
  console.log('— Attribution du visa en intérim');
  const kv = await acte();
  expect('chefssr, onglet en intérim de chefdpe, vise SA propre étape', await call('chefssr', 'POST', `/courrier/actes/${kv.id}/viser`, {}, I(ids.chefdpe)), 201);
  const v1 = await prisma.visaActe.findFirst({ where: { acteId: kv.id, viseurAttenduId: ids.chefssr } });
  check('… enregistré en son nom propre (aucun « au nom de »)', v1.viseParId === ids.chefssr && v1.viseAuNomDeId === null, JSON.stringify({ par: v1.viseParId, auNomDe: v1.viseAuNomDeId }));
  await suppleance('chefssr', 'chefsfp');
  const kw = await acte();
  const pi = (await call('agent1', 'GET', `/courrier/actes/${kw.id}`)).body; // pour le lien
  expect('chefsfp vise P.I. de chefssr', await call('chefsfp', 'POST', `/courrier/actes/${kw.id}/viser`, {}, I(ids.chefssr)), 201);
  const v2 = await prisma.visaActe.findFirst({ where: { acteId: kw.id, viseurAttenduId: ids.chefssr } });
  check('… enregistré par chefsfp au nom de chefssr', v2.viseParId === ids.chefsfp && v2.viseAuNomDeId === ids.chefssr);
  const vw = (await call('agent1', 'GET', `/courrier/actes/${kw.id}`)).body;
  check('… et les deux personnes sont nommées dans la fiche', !!vw.personnes[ids.chefsfp] && !!vw.personnes[ids.chefssr] && !!pi);
  // Annuler un acte en visa non numéroté : rédacteur, ou DN/DNA (registre Direction).
  await confronter('annuler (en visa)', droitActe(k1.id, 'annuler'), async (a, vrai) => {
    if (!vrai) return call(a.k, 'POST', `/courrier/actes/${k1.id}/annuler`, { motif: 'Annulation de test' }, a.h);
    const k = await acte();
    return call(a.k, 'POST', `/courrier/actes/${k.id}/annuler`, { motif: 'Annulation de test' }, a.h);
  }, ['agent1', 'dn', 'dna']);
  const br = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `C2 brouillon ${S}` })).body;
  await confronter('ajouter une annexe (brouillon)', droitActe(br.id, 'ajouterPiece'),
    (a) => upload(a.k, `/courrier/actes/${br.id}/pieces`, {}, [{ name: 'annexe.txt' }], a.h), ['agent1']);
  const brv = (await call('agent1', 'GET', `/courrier/actes/${br.id}`)).body;
  check('brouillon jamais soumis : pas d’« annuler » (il se supprime)', brv.droits.annuler === false && brv.droits.supprimer === true);
  expect('annuler ce brouillon quand même', await call('agent1', 'POST', `/courrier/actes/${br.id}/annuler`, { motif: 'Annulation de test' }), 409);

  console.log('— Circuit obsolète : « resoumettre »');
  const k3 = await acte();
  const avant = (await call('agent1', 'GET', `/courrier/actes/${k3.id}`)).body;
  check('circuit valide : pas de resoumission', avant.circuitObsolete === false && avant.droits.soumettre === false);
  expect('resoumettre un circuit valide', await call('agent1', 'POST', `/courrier/actes/${k3.id}/soumettre`), 409);
  await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'SUSPENDU' } });
  try {
    const obs = (await call('agent1', 'GET', `/courrier/actes/${k3.id}`)).body;
    const autre = (await call('dn', 'GET', `/courrier/actes/${k3.id}`)).body;
    check('viseur suspendu : circuit obsolète, « soumettre » ouvert au seul rédacteur', obs.circuitObsolete === true && obs.droits.soumettre === true && autre.droits.soumettre === false);
    expect('rédacteur resoumet', await call('agent1', 'POST', `/courrier/actes/${k3.id}/soumettre`), 201);
  } finally {
    await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'ACTIF' } });
  }

  console.log('— Accès délégués : bénéficiaire nommé');
  await suppleance('dn', 'chefdee');
  const Kc = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 accès ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  await call('dn', 'POST', `/courrier/arrivees/${Kc.id}/acces-delegues`, { beneficiaireId: ids.assdn });
  const al = (await call('dn', 'GET', `/courrier/arrivees/${Kc.id}/acces-delegues`)).body;
  check('liste des accès : bénéficiaire nommé, champs d’affichage seulement', al.length === 1 && Object.keys(al[0].beneficiaire).sort().join(',') === CHAMPS_P, JSON.stringify(al[0].beneficiaire));

  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'ACTIF' } }); process.exit(2); });
