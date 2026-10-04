// Refonte de l'interface (étape 6) — GET api/v1/messages/avec/:userId/contexte : fiche de
// l'interlocuteur d'une conversation directe (fonction, unité), « Documents échangés » et « Tâches en
// commun ». Besoin d'en connaître : un document cité n'est renvoyé qu'au lecteur qui peut l'ouvrir
// (même règle que GET /documents/:id ; GED fermée aux stagiaires), une tâche seulement si les deux
// personnes y sont créateur ou assignées ET que le lecteur la voit. Ouverte aux stagiaires comme la
// messagerie ; 401 sans session, 404 interlocuteur inexistant, 400 avec soi-même.
const { call, upload, ids, check, expect, bilan } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const ctx = (k, autre) => call(k, 'GET', `/api/v1/messages/avec/${autre}/contexte`);
const docs = async (k, autre) => (await ctx(k, autre)).body.documents.map((d) => d.id);
const taches = async (k, autre) => (await ctx(k, autre)).body.taches.map((t) => t.id);
const lien = (id) => `Document des Archives : /documents?id=${id}`;

(async () => {
  console.log('— Accès');
  const r401 = await fetch('http://localhost:3000/api/v1/messages/avec/x/contexte');
  check('sans session : 401', r401.status === 401);
  expect('interlocuteur inexistant : 404', await ctx('agent1', 'inexistant'), 404);
  expect('avec soi-même : 400', await ctx('agent1', ids.agent1), 400);
  const r = await ctx('chefssr', ids.agent1);
  check('forme : interlocuteur, documents, tâches', r.status === 200 && r.body.interlocuteur.id === ids.agent1 && typeof r.body.interlocuteur.fonction === 'string' && r.body.interlocuteur.fonction.length > 0 && Array.isArray(r.body.documents) && Array.isArray(r.body.taches), JSON.stringify(r.body).slice(0, 200));
  const u = (await call('chefssr', 'GET', `/users/${ids.agent1}`)).body;
  check('interlocuteur : mêmes nom et prénom que l’annuaire, unité renseignée', r.body.interlocuteur.nom === u.lastName && r.body.interlocuteur.prenom === u.firstName && !!r.body.interlocuteur.unite, JSON.stringify(r.body.interlocuteur));

  console.log('— Documents cités : seulement ceux que le lecteur peut ouvrir');
  const d = (await upload('agent1', '/documents', { title: `Contexte ${S}`, divisionId: ids.DPE, typeDocument: 'NOTE_TECHNIQUE', periodeDebut: '2026-07-01', periodeFin: '2026-09-30' }, [{ field: 'file', name: 'contexte.xlsx' }])).body;
  check('document privé de la DPE déposé par agent1', !!d.id, JSON.stringify(d).slice(0, 120));
  expect('agent1 → agentdee : message citant le document', await call('agent1', 'POST', '/messages', { recipientId: ids.agentdee, body: `Voici la note ${S}\n${lien(d.id)}` }), 201);
  expect('agent1 → agent2 : message citant le document et un document inexistant', await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `${lien(d.id)}\nEt /documents?id=inexistant${S}` }), 201);
  const vu = (await ctx('agent1', ids.agentdee)).body.documents.find((x) => x.id === d.id);
  check('l’auteur (qui voit le document) : titre, fichier, chemin « Archives · … », version, lien', vu && vu.titre === `Contexte ${S}` && vu.nomFichier === 'contexte.xlsx' && vu.chemin.startsWith('Archives') && vu.version === 1 && vu.lien === `/documents?id=${d.id}`, JSON.stringify(vu));
  expect('témoin : agentdee (autre division) ne peut pas ouvrir le document', await call('agentdee', 'GET', `/documents/${d.id}`), 403);
  check('agentdee (destinataire) : le document ne lui est pas renvoyé', !(await docs('agentdee', ids.agent1)).includes(d.id));
  expect('témoin : agent2 (même division) ouvre le document', await call('agent2', 'GET', `/documents/${d.id}`), 200);
  const vus2 = await docs('agent2', ids.agent1);
  check('agent2 : le document visible, jamais le document inexistant', vus2.includes(d.id) && !vus2.includes(`inexistant${S}`), JSON.stringify(vus2));
  check('conversation où le document n’est pas cité : absent', !(await docs('chefssr', ids.agent1)).includes(d.id));

  console.log('— Tâches en commun : créateur ou assignées, et vues par le lecteur');
  const t1 = (await call('chefssr', 'POST', '/tasks', { title: `Commune ${S}`, assignees: [{ userId: ids.agent1 }], divisionId: ids.DPE, sectionId: ids.SSR })).body;
  const t2 = (await call('chefssr', 'POST', '/tasks', { title: `Sans agent1 ${S}`, assignees: [{ userId: ids.agent2 }], divisionId: ids.DPE, sectionId: ids.SSR })).body;
  const t3 = (await call('chefssr', 'POST', '/tasks', { title: `Deux assignés ${S}`, assignees: [{ userId: ids.agent1 }, { userId: ids.agent2 }], divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('trois tâches créées par la cheffe de section', !!t1.id && !!t2.id && !!t3.id);
  const vuesAgent1 = await taches('agent1', ids.chefssr);
  check('agent1 avec la cheffe : la tâche qu’elle lui a confiée, pas celle d’agent2', vuesAgent1.includes(t1.id) && vuesAgent1.includes(t3.id) && !vuesAgent1.includes(t2.id));
  const vuesChef = await taches('chefssr', ids.agent1);
  check('la cheffe avec agent1 : mêmes tâches', vuesChef.includes(t1.id) && vuesChef.includes(t3.id) && !vuesChef.includes(t2.id));
  const vuesA2 = await taches('agent2', ids.agent1);
  check('agent2 avec agent1 : la tâche où ils sont tous deux assignés seulement', vuesA2.includes(t3.id) && !vuesA2.includes(t1.id));
  const vuesDee = await taches('agentdee', ids.agent1);
  check('agentdee avec agent1 : aucune de ces tâches (ni créateur ni assigné, hors périmètre)', ![t1.id, t2.id, t3.id].some((x) => vuesDee.includes(x)));
  for (const t of (await ctx('agentdee', ids.chefssr)).body.taches) {
    expect(`chaque tâche renvoyée à agentdee s’ouvre (${t.titre})`, await call('agentdee', 'GET', `/tasks/${t.id}`), 200);
  }

  console.log('— Stagiaire : route ouverte, filtrée pareil');
  const sg = (await call('admin', 'POST', '/users', { email: `ctxst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `CtxStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('stagiaire créé (DPE/SSR)', !!sg.id, JSON.stringify(sg).slice(0, 120));
  const K = `ctxst${S}`;
  await call('agent1', 'POST', '/messages', { recipientId: sg.id, body: lien(d.id) });
  const ts = (await call('chefssr', 'POST', '/tasks', { title: `Stage ${S}`, assignees: [{ userId: sg.id }], divisionId: ids.DPE, sectionId: ids.SSR })).body;
  const rs = await ctx(K, ids.agent1);
  check('stagiaire : 200, aucun document (GED fermée)', rs.status === 200 && rs.body.documents.length === 0, JSON.stringify(rs.body).slice(0, 200));
  expect('témoin : la GED lui est fermée', await call(K, 'GET', `/documents/${d.id}`), 403);
  check('stagiaire avec la cheffe : sa tâche', (await taches(K, ids.chefssr)).includes(ts.id));
  check('stagiaire avec la cheffe : jamais la tâche de la section', !(await taches(K, ids.chefssr)).includes(t1.id));
  expect('stagiaire : interlocuteur inexistant → 404 (pas 403)', await ctx(K, 'inexistant'), 404);
  check('agent1 avec le stagiaire : la note citée visible pour agent1', (await docs('agent1', sg.id)).includes(d.id));

  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
