// S4 — annuaire repensé (api/v1/annuaire) : un bloc par unité (Direction, divisions avec leurs sections,
// cellules ; chef ou DN/DNA en tête), état du jour SANS motif ni type de congé (« En congé » — maladie
// comprise —, « En mission » si l'ordre de mission est signé, intérim « supplée X »), compteur des
// disponibles, recherche sans accents (moteur de S2), fiche (unité, rend compte à, suppléant, équipe).
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const API = process.env.BASE || 'http://localhost:3000';
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const URL = '/api/v1/annuaire';
const liberer = (titulaires) => prisma.suppleance.updateMany({ where: { titulaireId: { in: titulaires }, revokedAt: null, endDate: { gt: new Date() } }, data: { revokedAt: new Date() } });

async function signerActe(acteId, soumettant) {
  await call(soumettant, 'POST', `/courrier/actes/${acteId}/soumettre`);
  let a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a.statut === 'EN_VISA' && i < 4; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'signe.pdf');
  return (await fetch(`${API}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd })).status;
}

(async () => {
  console.log('— Accès');
  check('sans session : 401', (await fetch(API + URL)).status === 401);
  const stg = (await call('admin', 'POST', '/users', { email: `anst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `AnnStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  expect('stagiaire : annuaire fermé (comme aujourd’hui)', await call(`anst${S}`, 'GET', URL), 403);
  void stg;

  console.log('— État du jour : congé (maladie comprise), mission signée, intérim');
  const maladie = (await prisma.leaveType.findFirst({ where: { code: { contains: 'MALADIE' } } })) ?? (await prisma.leaveType.create({ data: { code: 'CONGE_MALADIE', name: 'Congé maladie' } }));
  const auj = new Date(); auj.setUTCHours(0, 0, 0, 0);
  await prisma.leaveRequest.create({ data: { userId: ids.chefsfp, leaveTypeId: maladie.id, startDate: new Date(auj.getTime() - J), endDate: new Date(auj.getTime() + J), daysCount: 3, status: 'APPROUVEE', reason: `Motif médical ${S}` } });
  const reg = (await call('admin', 'POST', '/courrier/registres', { code: `OA${L}`, libelle: `Ordres de mission ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'OMA/{seq}/{annee}' })).body;
  const om = (await call('chefssr', 'POST', '/api/v1/ordres-mission', { agentId: ids.agent2, objet: `Collecte ${S}`, destination: 'Labé', dateDepart: jour(0), dateRetour: jour(2), transport: 'Véhicule de service' })).body;
  const acte = await call('chefssr', 'POST', `/api/v1/ordres-mission/${om.id}/acte`, { registreId: reg.id });
  const acteId = (await prisma.ordreMission.findUnique({ where: { id: om.id } })).acteId;
  check('ordre de mission d’agent2 signé (acte du Courrier)', acte.status === 201 && (await signerActe(acteId, 'chefssr')) === 201, JSON.stringify(acte.body).slice(0, 120));
  const omNonSigne = (await call('chefse', 'POST', '/api/v1/ordres-mission', { agentId: ids.agentdee, objet: `Brouillon ${S}`, destination: 'Boké', dateDepart: jour(0), dateRetour: jour(1) })).body;
  void omNonSigne;
  await liberer([ids.chefdee]);
  const sup = await call('chefdee', 'POST', '/suppleances', { titulaireId: ids.chefdee, suppleantId: ids.chefdpe, startDate: new Date(Date.now() - 60e3).toISOString(), endDate: new Date(Date.now() + J).toISOString() });
  expect('suppléance chef DEE → chef DPE', sup, 201);

  const a = await call('agent1', 'GET', URL);
  expect('agent1 : annuaire lu', a, 200);
  const p = (id) => a.body.personnes.find((x) => x.id === id);
  check('congé maladie approuvé : « En congé », sans motif ni type', p(ids.chefsfp).etat === 'EN_CONGE' && !JSON.stringify(a.body).includes(`Motif médical ${S}`) && !/MALADIE|maladie/.test(JSON.stringify(a.body)));
  check('ordre de mission signé couvrant aujourd’hui : « En mission »', p(ids.agent2).etat === 'EN_MISSION');
  check('ordre de mission non signé : aucun état', p(ids.agentdee).etat === null);
  check('intérim : badge sur le suppléant « supplée CHEFDEE… »', /CHEFDEE/i.test(p(ids.chefdpe).supplee ?? ''));
  check('personne sans absence : aucun état (pas de « Présent »)', p(ids.agent1).etat === null);
  const absents = a.body.personnes.filter((x) => x.etat).length;
  check(`compteur « disponibles aujourd’hui » = total − absents (${a.body.total} − ${absents})`, a.body.disponibles === a.body.total - absents && a.body.total === (await prisma.user.count({ where: { status: 'ACTIF' } })));
  check('pas d’email ni de téléphone dans l’annuaire', !/@test\.local|"phone"|"email"/.test(JSON.stringify(a.body)));

  console.log('— Blocs par unité, chef en tête');
  const dpe = a.body.unites.find((u) => u.sigle === 'DPE');
  check('bloc DPE : chef de division en tête (badge), sections comprises (agent1 de la SSR)', dpe.membres[0] === ids.chefdpe && p(ids.chefdpe).badge === 'Chef de division' && dpe.membres.includes(ids.agent1) && p(ids.agent1).section !== null && /CHEFDPE/i.test(dpe.chef));
  const dir = a.body.unites.find((u) => u.id === 'direction');
  check('bloc Direction : DN puis DNA en tête', dir.membres[0] === ids.dn && dir.membres[1] === ids.dna && p(ids.dn).badge === 'DN' && p(ids.dna).badge === 'DNA');
  check('nombre d’agents par unité = membres', a.body.unites.every((u) => u.nombre === u.membres.length));

  console.log('— Recherche (moteur de S2, sans accents)');
  await call('admin', 'POST', '/users', { email: `ann${S}@test.local`, password: 'Password123!', firstName: 'Sékou', lastName: `Kéïta${L}`, jobTitle: `Démographe ${L}`, role: 'AGENT', divisionId: ids.DEE, sectionId: ids.SE });
  const nouvel = await prisma.user.findUnique({ where: { email: `ann${S}@test.local` } });
  const r = (await call('agent1', 'GET', `${URL}?q=${encodeURIComponent(`sekou keita${L.toLowerCase()}`)}`)).body.resultats;
  check('« sekou keita… » trouve « Sékou Kéïta… »', r.includes(nouvel.id) && r.length === 1);
  check('par la fonction : « demographe … »', (await call('agent1', 'GET', `${URL}?q=${encodeURIComponent(`demographe ${L}`)}`)).body.resultats.join() === nouvel.id);
  check('par le sigle de l’unité : « SE » + nom', (await call('agent1', 'GET', `${URL}?q=${encodeURIComponent(`se keita${L}`)}`)).body.resultats.includes(nouvel.id));

  console.log('— Fiche');
  const f = await call('agent1', 'GET', `${URL}/${ids.agent2}`);
  expect('fiche d’agent2', f, 200);
  check('unité complète, rend compte au chef SSR, équipe de la section, « En mission »', /SSR|Section/.test(f.body.unite) && f.body.rendCompteA.some((n) => /CHEFSSR/i.test(n)) && f.body.equipe.some((e) => e.id === ids.agent1) && f.body.etat === 'EN_MISSION' && f.body.peutEcrire === true);
  check('fiche du chef DEE : son suppléant en cours (chef DPE)', /CHEFDPE/i.test((await call('agent1', 'GET', `${URL}/${ids.chefdee}`)).body.suppleant ?? ''));
  expect('compte inconnu : 404', await call('agent1', 'GET', `${URL}/inexistant`), 404);

  await call('chefdee', 'POST', `/suppleances/${sup.body.id}/revoke`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
