// Refonte de l'interface (étape 4) — api/v1/documents/synthese : bandeau « N document(s) attend(ent)
// votre validation » et compteur de l'onglet « Publiés pour toute la DNPEC » de l'écran Archives &
// documents. Un document n'attend la validation que de qui peut le valider (même règle que
// `droits.valider` et que POST /documents/:id/statut : 403 pour les autres), une fois marqué Final aux
// métadonnées complètes, et seulement parmi les documents que l'acteur voit (besoin d'en connaître :
// le DN ne voit pas l'espace privé d'une division) ; « marqué Final par » vient du journal d'audit.
// Stagiaire : 403 (GED fermée) ; sans session : 401. Recherche de la GED étendue à la description.
const { call, upload, ids, check, expect, bilan } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const META = { typeDocument: 'NOTE_TECHNIQUE', periodeDebut: '2026-07-01', periodeFin: '2026-09-30' };
const synthese = async (k) => (await call(k, 'GET', '/api/v1/documents/synthese')).body;
const attend = async (k, id) => (await synthese(k)).aValider.some((d) => d.id === id);
const deposer = (k, champs, nom) => upload(k, '/documents', { ...META, ...champs }, [{ field: 'file', name: nom }]);

(async () => {
  console.log('— Forme de la réponse, pour chaque rôle');
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'chefdee', 'chefsaf', 'dn', 'dna']) {
    const r = await call(k, 'GET', '/api/v1/documents/synthese');
    check(`${k} : 200, liste à valider et nombre de publiés`, r.status === 200 && Array.isArray(r.body.aValider) && Number.isInteger(r.body.publies) && r.body.publies >= 0, JSON.stringify(r.body).slice(0, 160));
  }
  const r401 = await fetch('http://localhost:3000/api/v1/documents/synthese');
  check('sans session : 401', r401.status === 401);
  const sg = (await call('admin', 'POST', '/users', { email: `archst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `ArchStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('stagiaire créé', !!sg.id, JSON.stringify(sg).slice(0, 120));
  expect('stagiaire : 403 (GED fermée)', await call(`archst${S}`, 'GET', '/api/v1/documents/synthese'), 403);

  console.log('— Document d’une division : attend la validation du chef de division, une fois Final');
  const d = (await deposer('agent1', { title: `Archives ${S}`, divisionId: ids.DPE }, 'archives.pdf')).body;
  check('document déposé par agent1 (DPE)', !!d.id, JSON.stringify(d).slice(0, 120));
  check('Brouillon non Final : n’attend personne', !(await attend('chefdpe', d.id)));
  expect('agent1 le marque Final', await call('agent1', 'POST', `/documents/${d.id}/mark-final`), 201);
  const s = await synthese('chefdpe');
  const ligne = s.aValider.find((x) => x.id === d.id);
  check('chef de division : le document attend sa validation, marqué Final par agent1', ligne && ligne.titre === `Archives ${S}` && ligne.divisionId === ids.DPE && typeof ligne.marqueFinalPar === 'string' && ligne.marqueFinalPar.length > 0, JSON.stringify(ligne));
  check('cohérent avec les droits de la fiche (droits.valider)', (await call('chefdpe', 'GET', `/documents/${d.id}`)).body.droits.valider === true);
  check('agent1 (auteur) : n’attend pas sa validation', !(await attend('agent1', d.id)));
  check('cheffe de section : n’attend pas sa validation', !(await attend('chefssr', d.id)));
  expect('… et elle ne peut pas le valider (403)', await call('chefssr', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 403);
  check('chef d’une autre division : rien', !(await attend('chefdee', d.id)));
  expect('… document hors de son périmètre (403)', await call('chefdee', 'GET', `/documents/${d.id}`), 403);
  check('DN : espace privé d’une division non visible, rien (besoin d’en connaître)', !(await attend('dn', d.id)));
  expect('… et le DN ne peut pas le valider (403)', await call('dn', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 403);
  expect('le chef de division le valide', await call('chefdpe', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 201);
  check('validé : sorti du bandeau', !(await attend('chefdpe', d.id)));

  console.log('— Métadonnées incomplètes : la validation serait refusée, le document n’attend personne');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const inc = (await deposer('agent1', { title: `Archives incomplet ${S}`, divisionId: ids.DPE }, 'inc.txt')).body;
  await call('agent1', 'POST', `/documents/${inc.id}/mark-final`);
  await prisma.document.update({ where: { id: inc.id }, data: { periodeDebut: null, periodeFin: null } }); // document d'avant N4
  check('métadonnées à compléter : hors du bandeau', !(await attend('chefdpe', inc.id)));
  expect('… validation refusée (409)', await call('chefdpe', 'POST', `/documents/${inc.id}/statut`, { vers: 'VALIDE' }), 409);
  await prisma.$disconnect();

  console.log('— Publiés pour toute la DNPEC : compteur et bandeau de la Direction');
  const p0 = { agent1: (await synthese('agent1')).publies, agentdee: (await synthese('agentdee')).publies };
  const pub = (await deposer('agent1', { title: `Archives publié ${S}`, divisionId: ids.DPE }, 'pub.docx')).body;
  await call('agent1', 'POST', `/documents/${pub.id}/mark-final`);
  expect('le chef de division le publie', await call('chefdpe', 'POST', `/documents/${pub.id}/publish`), 201);
  check('publiés : +1 pour agent1 et pour un agent d’une autre division', (await synthese('agent1')).publies === p0.agent1 + 1 && (await synthese('agentdee')).publies === p0.agentdee + 1);
  check('publié, Brouillon Final : attend le DN (recours) et le chef de division', (await attend('dn', pub.id)) && (await attend('chefdpe', pub.id)));
  check('… pas le chef d’une autre division (qui le voit sans pouvoir le valider)', !(await attend('chefdee', pub.id)));
  expect('… qui ne peut pas le valider (403)', await call('chefdee', 'POST', `/documents/${pub.id}/statut`, { vers: 'VALIDE' }), 403);

  console.log('— Recherche « titre ou mot-clé » (GET /documents?q=) : titre ou description, dans le périmètre');
  const mc = (await deposer('agent1', { title: `Archives mot-clé ${S}`, description: `liquidations${S}`, divisionId: ids.DPE }, 'mc.txt')).body;
  const cherche = async (k) => (await call(k, 'GET', `/documents?q=liquidations${S}`)).body.map((x) => x.id);
  check('mot-clé de la description : trouvé par agent1', (await cherche('agent1')).includes(mc.id));
  check('… pas par un agent d’une autre division (document privé)', !(await cherche('agentdee')).includes(mc.id));

  console.log('— Filtre « Période couverte » (GET /documents?couvreDu=&couvreAu=) : chevauchement, dans le périmètre');
  const couvre = async (k, qs) => (await call(k, 'GET', `/documents?q=liquidations${S}&${qs}`)).body.map((x) => x.id);
  check('période qui chevauche (sept.–déc. 2026) : trouvé', (await couvre('agent1', 'couvreDu=2026-09-01&couvreAu=2026-12-31')).includes(mc.id));
  check('période qui le contient (2026) : trouvé', (await couvre('agent1', 'couvreDu=2026-01-01&couvreAu=2026-12-31')).includes(mc.id));
  check('période après (à partir d’octobre 2026) : absent', !(await couvre('agent1', 'couvreDu=2026-10-01')).includes(mc.id));
  check('période avant (jusqu’à juin 2026) : absent', !(await couvre('agent1', 'couvreAu=2026-06-30')).includes(mc.id));
  check('… jamais pour un agent d’une autre division', !(await couvre('agentdee', 'couvreDu=2026-01-01&couvreAu=2026-12-31')).includes(mc.id));
  expect('date invalide : 400', await call('agent1', 'GET', '/documents?couvreDu=pas-une-date'), 400);

  console.log('— Document d’une cellule rattachée à la Direction');
  const c = (await deposer('agentsaf', { title: `Archives SAF ${S}`, celluleId: ids.SAF }, 'saf.xlsx')).body;
  await call('agentsaf', 'POST', `/documents/${c.id}/mark-final`);
  check('chef de la cellule : le document attend sa validation', await attend('chefsaf', c.id));
  check('chef de division : rien (document privé de la cellule)', !(await attend('chefdpe', c.id)));
  expect('… hors de son périmètre (403)', await call('chefdpe', 'GET', `/documents/${c.id}`), 403);

  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
