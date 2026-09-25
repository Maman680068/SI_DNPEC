// C2 — routes API « imputables » et « délégataires possibles » : 200/400/403/409,
// liste proposée = exactement l'ensemble accepté par le serveur (force brute), champs publiés.
const E = require('../config');
const { call, upload, ids, check, expect, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36);
const I = (id) => ({ 'X-Interim-For': id });
const arrivee = (key, champs) => upload(key, '/courrier/arrivees', { dateReception: iso(0), expediteur: 'Ministère du Plan', ...champs });
const nom = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
const noms = (xs) => xs.map((x) => nom[x] || x.slice(-6)).sort().join(',');
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
const TOUS = async () => (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
const CHAMPS_IMP = 'firstName,id,jobTitle,lastName,role';
const CHAMPS_DEL = 'firstName,id,jobTitle,lastName,role,type';
const champs = (xs) => [...new Set(xs.map((x) => Object.keys(x).sort().join(',')))].join(' | ');

// Force brute : on tente l'action pour CHAQUE compte (actifs et inactifs) ; l'ensemble des 201 doit
// être exactement la liste proposée.
async function forceBrute(label, liste, tenter) {
  const acceptes = [];
  const codes = {};
  for (const id of await TOUS()) {
    const r = await tenter(id);
    codes[r.status] = (codes[r.status] || 0) + 1;
    if (r.status === 201) acceptes.push(id);
  }
  if (acceptes.includes(ids.admin)) console.log(`   ALERTE : l’administrateur a été accepté (${label})`);
  const L = liste.map((x) => x.id);
  const egal = L.length === acceptes.length && L.every((x) => acceptes.includes(x));
  check(`${label} : liste proposée = ensemble accepté (${L.length} personnes), administrateur exclu`, egal && L.length > 0 && !acceptes.includes(ids.admin) && !L.includes(ids.admin), `proposés [${noms(L)}] ; acceptés [${noms(acceptes)}] ; codes ${JSON.stringify(codes)}`);
}

(async () => {
  // Compte SUSPENDU de test : assistante du DN, membre de la DPE (ne doit jamais être proposé ni accepté).
  await prisma.user.upsert({
    where: { email: 'inactif@test.local' },
    update: { status: 'SUSPENDU' },
    create: { email: 'inactif@test.local', passwordHash: 'x', firstName: 'Compte', lastName: 'Suspendu', role: 'ASSISTANT_DIRECTION', supervisorId: ids.dn, divisionId: ids.DPE, status: 'SUSPENDU' },
  });
  console.log('— GET /courrier/imputables : imputation initiale, registre Direction (DN)');
  const A = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 imputables ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const la = await call('dn', 'GET', `/courrier/imputables?arriveeId=${A.id}`);
  expect('DN, courrier du registre Direction', la, 200);
  check('champs publiés : id, nom, prénom, rôle, fonction (jamais supervisorId, email…)', champs(la.body) === CHAMPS_IMP, champs(la.body));
  const inactifs = await prisma.user.findMany({ where: { status: { not: 'ACTIF' } }, select: { id: true } });
  check('aucun compte inactif proposé', inactifs.length > 0 && !la.body.some((u) => inactifs.some((i) => i.id === u.id)), `${inactifs.length} compte(s) inactif(s) en base`);
  await forceBrute('DN / registre Direction', la.body, (id) => call('dn', 'POST', `/courrier/arrivees/${A.id}/imputations`, { imputeAId: id, nature: 'INFORMATION' }));
  const la2 = await call('dn', 'GET', `/courrier/imputables?arriveeId=${A.id}`);
  check('après imputation de tous : plus personne proposé (sinon 409)', la2.status === 200 && la2.body.length === 0, `${la2.body.length}`);

  console.log('— Administrateur système : jamais imputé, sous-imputé ni délégataire ; rédacteur et bénéficiaire possibles');
  const Ad = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 admin ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const propAd = (await call('dn', 'GET', `/courrier/imputables?arriveeId=${Ad.id}`)).body;
  check('admin absent de GET /courrier/imputables (DN, registre Direction)', propAd.length > 0 && !propAd.some((u) => u.id === ids.admin), `${propAd.length} proposés`);
  const rAd = await call('dn', 'POST', `/courrier/arrivees/${Ad.id}/imputations`, { imputeAId: ids.admin, nature: 'INFORMATION' });
  expect('DN impute l’administrateur', rAd, 403);
  const impAd = (await call('dn', 'POST', `/courrier/arrivees/${Ad.id}/imputations`, { imputeAId: ids.dna, nature: 'ATTRIBUTION' })).body;
  const sousAd = (await call('dna', 'GET', `/courrier/imputables?imputationId=${impAd.id}`)).body;
  check('admin absent des sous-imputables (DNA, qui a autorité sur tous)', sousAd.length > 0 && !sousAd.some((u) => u.id === ids.admin), `${sousAd.length} proposés`);
  expect('DNA sous-impute l’administrateur', await call('dna', 'POST', `/courrier/imputations/${impAd.id}/sous-imputations`, { imputeAId: ids.admin, nature: 'INFORMATION' }), 403);
  await forceBrute('DNA / sous-imputation (autorité sur tous)', sousAd, (id) => call('dna', 'POST', `/courrier/imputations/${impAd.id}/sous-imputations`, { imputeAId: id, nature: 'INFORMATION' }));
  const redAd = await call('admin', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Admin ${S}` });
  expect('l’administrateur rédige un acte (le sien)', redAd, 201);
  await call('admin', 'DELETE', `/courrier/actes/${redAd.body.id}`);
  const benAd = await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Bénéf admin ${S}`, beneficiaireId: ids.admin });
  expect('acte avec l’administrateur pour bénéficiaire', benAd, 201);
  const brAd = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Bénéf ${S}` })).body;
  expect('modification : l’administrateur pour bénéficiaire', await call('agent1', 'PATCH', `/courrier/actes/${brAd.id}`, { beneficiaireId: ids.admin }), 200);
  for (const x of [benAd.body.id, brAd.id]) await call('agent1', 'DELETE', `/courrier/actes/${x}`);

  console.log('— Bénéficiaire d’un acte : liste proposée (annuaire) = ensemble accepté, administrateur compris');
  const annuaire = (await call('agent1', 'GET', '/users/directory')).body.map((u) => u.id);
  const acceptesB = [];
  for (const id of await TOUS()) {
    const r = await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Bénéf brute ${S}`, beneficiaireId: id });
    if (r.status === 201) { acceptesB.push(id); await call('agent1', 'DELETE', `/courrier/actes/${r.body.id}`); }
  }
  check('bénéficiaire : annuaire (proposé) = accepté, administrateur accepté', annuaire.length === acceptesB.length && annuaire.every((x) => acceptesB.includes(x)) && acceptesB.includes(ids.admin), `${annuaire.length} proposés, ${acceptesB.length} acceptés`);

  console.log('— Registre d’unité (DIV:DPE) : DN/DNA et chef de l’unité');
  const U = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `C2 unité ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const lu = await call('dn', 'GET', `/courrier/imputables?arriveeId=${U.id}`);
  expect('DN, courrier du registre de la DPE', lu, 200);
  const membresDpe = (await prisma.user.findMany({ where: { status: 'ACTIF', divisionId: ids.DPE, role: { not: 'STAGIAIRE' } }, select: { id: true } })).map((u) => u.id);
  check('DN / DPE : uniquement des membres de la DPE', lu.body.every((u) => membresDpe.includes(u.id)) && lu.body.length === membresDpe.length, `[${noms(lu.body.map((u) => u.id))}]`);
  const lc = await call('chefdpe', 'GET', `/courrier/imputables?arriveeId=${U.id}`);
  expect('chefdpe (chef de l’unité)', lc, 200);
  await forceBrute('DN / registre DPE', lu.body, (id) => call('dn', 'POST', `/courrier/arrivees/${U.id}/imputations`, { imputeAId: id, nature: 'INFORMATION' }));
  const U2 = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `C2 unité bis ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const lc2 = (await call('chefdpe', 'GET', `/courrier/imputables?arriveeId=${U2.id}`)).body;
  await forceBrute('chefdpe / registre DPE', lc2, (id) => call('chefdpe', 'POST', `/courrier/arrivees/${U2.id}/imputations`, { imputeAId: id, nature: 'INFORMATION' }));

  console.log('— Sous-imputation');
  const B = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 sous-imputation ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const imp = (await call('dn', 'POST', `/courrier/arrivees/${B.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', echeance: iso(6 * J) })).body;
  const ls = await call('chefdpe', 'GET', `/courrier/imputables?imputationId=${imp.id}`);
  expect('chefdpe (imputé) : sous-imputables', ls, 200);
  check('sous-imputables : champs publiés', champs(ls.body) === CHAMPS_IMP, champs(ls.body));
  check('chefdpe ne se propose pas lui-même', !ls.body.some((u) => u.id === ids.chefdpe));
  await forceBrute('chefdpe / sous-imputation', ls.body, (id) => call('chefdpe', 'POST', `/courrier/imputations/${imp.id}/sous-imputations`, { imputeAId: id, nature: 'ATTRIBUTION', echeance: iso(3 * J) }));

  console.log('— Intérim : chefssr P.I. de chefdpe');
  await suppleance('chefdpe', 'chefssr');
  const U3 = (await arrivee('secdpe', { registreId: reg.ARRU, uniteKey: `DIV:${ids.DPE}`, objet: `C2 intérim ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const li = await call('chefssr', 'GET', `/courrier/imputables?arriveeId=${U3.id}`, undefined, I(ids.chefdpe));
  expect('chefssr P.I. chef DPE, registre DPE', li, 200);
  await forceBrute('chefssr P.I. / registre DPE', li.body, (id) => call('chefssr', 'POST', `/courrier/arrivees/${U3.id}/imputations`, { imputeAId: id, nature: 'INFORMATION' }, I(ids.chefdpe)));
  expect('chefssr en nom propre, registre DPE', await call('chefssr', 'GET', `/courrier/imputables?arriveeId=${U3.id}`), 403);

  console.log('— Refus');
  const C = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 refus ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const P = (await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe })).body;
  expect('agent1 (sans autorité)', await call('agent1', 'GET', `/courrier/imputables?arriveeId=${C.id}`), 403);
  expect('secdg (habilité, pas d’autorité)', await call('secdg', 'GET', `/courrier/imputables?arriveeId=${C.id}`), 403);
  expect('chefdpe, registre Direction', await call('chefdpe', 'GET', `/courrier/imputables?arriveeId=${C.id}`), 403);
  expect('chefdee, registre de la DPE', await call('chefdee', 'GET', `/courrier/imputables?arriveeId=${U2.id}`), 403);
  expect('assdn (vision héritée du DN, jamais son autorité)', await call('assdn', 'GET', `/courrier/imputables?arriveeId=${C.id}`), 403);
  expect('chefssr sous-impute une imputation qui n’est pas la sienne', await call('chefssr', 'GET', `/courrier/imputables?imputationId=${imp.id}`), 403);
  expect('DN, pli PERSONNEL', await call('dn', 'GET', `/courrier/imputables?arriveeId=${P.id}`), 409);
  expect('sans paramètre', await call('dn', 'GET', '/courrier/imputables'), 400);
  expect('les deux paramètres', await call('dn', 'GET', `/courrier/imputables?arriveeId=${C.id}&imputationId=${imp.id}`), 400);
  expect('courrier inexistant', await call('dn', 'GET', '/courrier/imputables?arriveeId=inexistant'), 404);
  await call('secdg', 'POST', `/courrier/arrivees/${C.id}/annuler`, { motif: 'Doublon de test C2' });
  expect('courrier annulé', await call('dn', 'GET', `/courrier/imputables?arriveeId=${C.id}`), 409);

  console.log('— GET /courrier/delegataires-possibles : arrivée CONFIDENTIELLE');
  await suppleance('dn', 'chefdee');
  const K = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 confidentiel ${S}`, confidentialite: 'CONFIDENTIEL' })).body;
  const ld = await call('dn', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`);
  expect('DN', ld, 200);
  check('champs publiés : id, nom, prénom, rôle, fonction, type (jamais supervisorId)', champs(ld.body) === CHAMPS_DEL, champs(ld.body));
  check('proposés : assistante (ASSISTANT) et suppléant en cours (SUPPLEANT)', ld.body.map((x) => `${nom[x.id]}:${x.type}`).sort().join(',') === 'assdn:ASSISTANT,chefdee:SUPPLEANT', ld.body.map((x) => `${nom[x.id]}:${x.type}`).join(','));
  await forceBrute('DN / arrivée CONFIDENTIELLE', ld.body, (id) => call('dn', 'POST', `/courrier/arrivees/${K.id}/acces-delegues`, { beneficiaireId: id }));
  const ld2 = await call('dn', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`);
  check('accès déjà ouverts : plus proposés (sinon 409)', ld2.status === 200 && ld2.body.length === 0, JSON.stringify(ld2.body));
  const acc = (await call('dn', 'GET', `/courrier/arrivees/${K.id}/acces-delegues`)).body.find((x) => x.beneficiaireId === ids.assdn && !x.revoqueAt);
  await call('dn', 'POST', `/courrier/acces-delegues/${acc.id}/revoquer`);
  const ld3 = (await call('dn', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`)).body;
  check('après révocation : de nouveau proposée', noms(ld3.map((x) => x.id)) === 'assdn', noms(ld3.map((x) => x.id)));

  console.log('— Acte CONFIDENTIEL');
  await suppleance('chefssr', 'chefsfp');
  const k = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'CONFIDENTIEL', objet: `C2 acte ${S}` })).body;
  await call('agent1', 'POST', `/courrier/actes/${k.id}/soumettre`);
  const lk = await call('chefssr', 'GET', `/courrier/delegataires-possibles?acteId=${k.id}`);
  expect('chefssr (viseur)', lk, 200);
  await forceBrute('chefssr / acte CONFIDENTIEL', lk.body, (id) => call('chefssr', 'POST', `/courrier/actes/${k.id}/acces-delegues`, { beneficiaireId: id }));
  const la1 = await call('agent1', 'GET', `/courrier/delegataires-possibles?acteId=${k.id}`);
  expect('agent1 (rédacteur, sans assistant ni suppléant)', la1, 200);
  check('agent1 : liste vide', la1.body.length === 0);

  console.log('— Refus (délégataires)');
  const O = (await arrivee('secdg', { registreId: reg.ARR, objet: `C2 ordinaire ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const Pp = (await arrivee('secdg', { registreId: reg.ARR, confidentialite: 'PERSONNEL', destinataireId: ids.chefdpe })).body;
  expect('chefdee P.I. du DN', await call('chefdee', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`, undefined, I(ids.dn)), 403);
  expect('chefdee (accès délégué) — pas de chaîne', await call('chefdee', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`), 403);
  expect('assdn (vision héritée du DN)', await call('assdn', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`), 403);
  expect('agent2 (aucun accès)', await call('agent2', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}`), 403);
  expect('chefdpe, son pli PERSONNEL', await call('chefdpe', 'GET', `/courrier/delegataires-possibles?arriveeId=${Pp.id}`), 403);
  expect('DN, courrier ORDINAIRE', await call('dn', 'GET', `/courrier/delegataires-possibles?arriveeId=${O.id}`), 409);
  expect('sans paramètre', await call('dn', 'GET', '/courrier/delegataires-possibles'), 400);
  expect('les deux paramètres', await call('dn', 'GET', `/courrier/delegataires-possibles?arriveeId=${K.id}&acteId=${k.id}`), 400);
  const susp = await prisma.user.findUnique({ where: { email: 'inactif@test.local' } });
  check('assistante SUSPENDUE du DN : jamais proposée', !ld3.some((x) => x.id === susp.id));
  expect('ouvrir un accès à l’administrateur', await call('dn', 'POST', `/courrier/arrivees/${K.id}/acces-delegues`, { beneficiaireId: ids.admin }), 403);
  expect('ouvrir à son assistante SUSPENDUE', await call('dn', 'POST', `/courrier/arrivees/${K.id}/acces-delegues`, { beneficiaireId: susp.id }), 400);

  await prisma.user.delete({ where: { email: 'inactif@test.local' } }); // compte de test retiré
  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
