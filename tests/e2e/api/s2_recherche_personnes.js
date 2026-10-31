// S2 — recherche de personnes « comme une messagerie » (GET api/v1/personnes/recherche) : sans texte,
// correspondants récents puis tout le personnel actif ; avec texte, chaque mot cherché sans accents ni
// majuscules dans prénom, nom, fonction et sigle d'unité (« Mariame Cam » et « Camara Mariame »), débuts
// de mot en premier ; conversation existante signalée ; ni email ni téléphone ; ouvert aux stagiaires.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const BASE = process.env.BASE || 'http://localhost:3000';
const URL = '/api/v1/personnes/recherche';
const chercher = async (k, q) => (await call(k, 'GET', `${URL}?q=${encodeURIComponent(q)}`)).body;
const noms = (r) => r.personnes.map((p) => `${p.prenom} ${p.nom}`);

(async () => {
  check('sans session : 401', (await fetch(BASE + URL)).status === 401);
  const creer = async (k, firstName, lastName, extra = {}) => {
    const r = await call('admin', 'POST', '/users', { email: `${k}${S}@test.local`.toLowerCase(), password: 'Password123!', firstName, lastName, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR, ...extra });
    expect(`compte de test « ${firstName} ${lastName} »`, r, 201);
    return r.body;
  };
  const mariame = await creer('mar', 'Mariame', `Camara${L}`);
  const sekou = await creer('sek', 'Sékou', `Kéïta${L}`, { jobTitle: `Statisticienne principale ${L}` });
  const prefixe = await creer('kad', 'Ali', `Kadi${L}`, { divisionId: ids.DEE, sectionId: ids.SE });
  const dedans = await creer('ben', 'Awa', `Benkadi${L}`);

  console.log('— Sans texte : récents d’abord, puis tout le personnel');
  expect('agent1 écrit à Mariame', await call('agent1', 'POST', '/messages', { recipientId: mariame.id, body: `Bonjour ${S}` }), 201);
  const vide = (await call('agent1', 'GET', URL)).body;
  check('récents : Mariame en tête, signalée « conversation »', vide.recents[0]?.id === mariame.id && vide.recents[0].conversation === true);
  const actifs = await prisma.user.count({ where: { status: 'ACTIF' } });
  check(`tout le personnel actif (${actifs - 1} hors soi), sans doublon avec les récents`, vide.recents.length + vide.personnes.length === actifs - 1 && !vide.personnes.some((p) => vide.recents.some((r) => r.id === p.id)) && ![...vide.recents, ...vide.personnes].some((p) => p.id === ids.agent1));
  check('champs non sensibles seulement (ni email ni téléphone)', vide.personnes.every((p) => Object.keys(p).sort().join() === 'conversation,fonction,id,nom,prenom,unite,uniteLibelle'));

  console.log('— Plusieurs mots, dans n’importe quel ordre, sans accents ni majuscules');
  check('« Mariame Cam… » : trouvée', noms(await chercher('agent1', `Mariame Camara${L.slice(0, 2)}`)).includes(`Mariame Camara${L}`));
  check('« camara… mariame » (ordre inversé, minuscules) : trouvée', noms(await chercher('agent1', `camara${L.toLowerCase()} mariame`)).includes(`Mariame Camara${L}`));
  check('« sekou keita… » sans accents : « Sékou Kéïta… » trouvé', (await chercher('agent1', `sekou keita${L}`)).personnes.some((p) => p.id === sekou.id));
  check('« SÉKOU » en majuscules accentuées : trouvé', (await chercher('agent1', `SÉKOU KÉÏTA${L}`)).personnes.some((p) => p.id === sekou.id));
  check('par la fonction : « statisticienne … »', (await chercher('agent1', `statisticienne ${L}`)).personnes.map((p) => p.id).join() === sekou.id);
  check('par le sigle d’unité : « SSR » + nom', (await chercher('agent1', `ssr camara${L}`)).personnes.some((p) => p.id === mariame.id));
  check('par le sigle de la division : « DPE » + nom', (await chercher('agent1', `dpe camara${L}`)).personnes.some((p) => p.id === mariame.id));
  check('un mot introuvable : aucun résultat', (await chercher('agent1', `camara${L} zzzqqq`)).personnes.length === 0);
  const r = await chercher('agent1', `kadi${L}`);
  check('début de mot avant « contient » : Kadi… avant Benkadi…', r.personnes[0]?.id === prefixe.id && r.personnes.some((p) => p.id === dedans.id), noms(r).join(', '));
  const ligne = r.personnes.find((p) => p.id === prefixe.id);
  check('ligne : sigle d’unité (SE) et libellé', ligne.unite === 'SE' && !!ligne.uniteLibelle);
  check('DN : unité « Direction »', (await chercher('agent1', 'DN Test')).personnes.some((p) => p.id === ids.dn && p.unite === 'Direction'));

  console.log('— Stagiaire : comportement actuel de la messagerie conservé');
  const stg = (await call('admin', 'POST', '/users', { email: `rpst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `RechStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  expect('stagiaire : recherche permise', await call(`rpst${S}`, 'GET', `${URL}?q=camara${L}`), 200);
  check('stagiaire : mêmes personnes que /users/search', (await chercher(`rpst${S}`, `camara${L}`)).personnes.some((p) => p.id === mariame.id) && (await call(`rpst${S}`, 'GET', `/users/search?q=Camara${L}`)).body.some((u) => u.id === mariame.id));
  check('compte suspendu : jamais proposé', await (async () => {
    await call('admin', 'PATCH', `/users/${dedans.id}/status`, { status: 'SUSPENDU' });
    return !(await chercher('agent1', `benkadi${L}`)).personnes.some((p) => p.id === dedans.id);
  })());
  void stg;
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
