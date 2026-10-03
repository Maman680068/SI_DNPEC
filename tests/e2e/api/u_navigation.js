// Refonte de l'interface (étapes 1 et 2) — api/v1/navigation : compteurs du menu, « À traiter » et
// menu « Créer ». Chaque compteur suit les droits de l'action qu'il annonce (besoin d'en connaître) :
// une tâche n'est « à valider » que pour qui peut la valider (403 pour les autres), le stagiaire ne
// reçoit que ses tâches et ses messages ; liste « Mes tâches » enrichie (sous-tâches, commentaires,
// pièces jointes, activité) et filtre « À valider » sur GET /tasks.
const { call, ids, check, expect, bilan } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const nav = async (k, h) => (await call(k, 'GET', '/api/v1/navigation', undefined, h)).body;
const aTraiter = (n, cle) => (n.aTraiter.find((x) => x.cle === cle) || { nombre: 0 }).nombre;
(async () => {
  console.log('— Forme de la réponse, pour chaque rôle');
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'chefsaf', 'dn', 'dna', 'drh', 'admin', 'assdn', 'secdg']) {
    const r = await call(k, 'GET', '/api/v1/navigation');
    const b = r.body;
    check(`${k} : 200, compteurs entiers, « À traiter » sans zéro, menu « Créer »`, r.status === 200 && Object.values(b.compteurs).every((v) => Number.isInteger(v) && v >= 0) && b.aTraiter.every((x) => x.nombre > 0 && x.lien.startsWith('/')) && b.creer.tache === true && b.creer.message === true, JSON.stringify(b).slice(0, 160));
  }
  const r401 = await fetch('http://localhost:3000/api/v1/navigation');
  check('sans session : 401', r401.status === 401);

  console.log('— Tâches ouvertes assignées');
  const avant = { agent1: await nav('agent1'), agentdee: await nav('agentdee'), chefssr: await nav('chefssr'), chefdee: await nav('chefdee'), dn: await nav('dn') };
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Navigation ${S}`, assignees: [{ userId: ids.agent1, roleOnTask: 'RESPONSABLE' }], divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('tâche créée par la cheffe de section, confiée à agent1', !!t.id, JSON.stringify(t).slice(0, 120));
  check('agent1 : une tâche ouverte de plus', (await nav('agent1')).compteurs.taches === avant.agent1.compteurs.taches + 1);
  check('agent d’une autre division : inchangé', (await nav('agentdee')).compteurs.taches === avant.agentdee.compteurs.taches);
  check('la créatrice (non assignée) : inchangée', (await nav('chefssr')).compteurs.taches === avant.chefssr.compteurs.taches);

  console.log('— Liste enrichie de « Mes tâches »');
  const t2 = (await call('chefssr', 'POST', '/tasks', { title: `Navigation liste ${S}`, assignees: [{ userId: ids.agent1 }], divisionId: ids.DPE, sectionId: ids.SSR })).body;
  await call('chefssr', 'POST', `/tasks/${t2.id}/comments`, { body: 'Premier commentaire' });
  await call('chefssr', 'POST', `/tasks/${t2.id}/subtasks`, { title: 'Sous-tâche A' });
  const st = (await call('chefssr', 'POST', `/tasks/${t2.id}/subtasks`, { title: 'Sous-tâche B' })).body;
  expect('la créatrice coche une sous-tâche', await call('chefssr', 'POST', `/tasks/${st.id}/toggle`), 201);
  const lignes = (await call('agent1', 'GET', `/tasks?assigneeId=${ids.agent1}`)).body;
  const ligne = lignes.find((x) => x.id === t2.id);
  check('ligne : 1 commentaire, 0 pièce jointe, sous-tâches 1/2, activité vide', ligne && ligne.nbCommentaires === 1 && ligne.nbPiecesJointes === 0 && ligne.nbSousTaches === 2 && ligne.nbSousTachesFaites === 1 && ligne.activiteLibelle === null, JSON.stringify(ligne && { c: ligne.nbCommentaires, p: ligne.nbPiecesJointes, s: ligne.nbSousTaches, f: ligne.nbSousTachesFaites }));
  check('aucune sous-tâche dans la liste de premier niveau', !lignes.some((x) => x.id === st.id));
  const avant2 = (await nav('agent1')).compteurs.taches;

  console.log('— Tâches à valider = droit de valider');
  expect('agent1 démarre', await call('agent1', 'POST', `/tasks/${t.id}/start`), 201);
  expect('agent1 soumet', await call('agent1', 'POST', `/tasks/${t.id}/submit`), 201);
  const apres = { agent1: await nav('agent1'), chefssr: await nav('chefssr'), chefdee: await nav('chefdee'), dn: await nav('dn') };
  check('cheffe de section (créatrice) : une tâche à valider de plus, dans « À traiter »', apres.chefssr.compteurs.tachesAValider === avant.chefssr.compteurs.tachesAValider + 1 && aTraiter(apres.chefssr, 'taches-a-valider') === apres.chefssr.compteurs.tachesAValider);
  check('DN (autorité sur l’assigné) : une de plus', apres.dn.compteurs.tachesAValider === avant.dn.compteurs.tachesAValider + 1);
  check('agent1 (assigné) : rien à valider', apres.agent1.compteurs.tachesAValider === avant.agent1.compteurs.tachesAValider);
  check('chef d’une autre division : inchangé', apres.chefdee.compteurs.tachesAValider === avant.chefdee.compteurs.tachesAValider);
  const liste = async (k) => (await call(k, 'GET', '/tasks?aValider=true')).body.map((x) => x.id);
  check('GET /tasks?aValider=true : la tâche pour la cheffe et le DN', (await liste('chefssr')).includes(t.id) && (await liste('dn')).includes(t.id));
  check('GET /tasks?aValider=true : pas pour l’assigné ni l’autre division', !(await liste('agent1')).includes(t.id) && !(await liste('chefdee')).includes(t.id));
  expect('l’assigné ne peut pas la valider (403, cohérent avec son compteur)', await call('agent1', 'POST', `/tasks/${t.id}/validate`, {}), 403);
  expect('le chef d’une autre division ne peut pas la valider (403)', await call('chefdee', 'POST', `/tasks/${t.id}/validate`, {}), 403);
  expect('filtre invalide : 400', await call('chefssr', 'GET', '/tasks?aValider=oui'), 400);
  expect('la cheffe de section la valide', await call('chefssr', 'POST', `/tasks/${t.id}/validate`, {}), 201);
  check('après validation : compteurs revenus', (await nav('chefssr')).compteurs.tachesAValider === avant.chefssr.compteurs.tachesAValider && (await nav('agent1')).compteurs.taches === avant2 - 1);

  console.log('— Messages non lus');
  const m0 = (await nav('agent2')).compteurs.messages;
  await call('agent1', 'POST', '/messages', { recipientId: ids.agent2, body: `Bonjour ${S}` });
  check('agent2 : un message non lu de plus', (await nav('agent2')).compteurs.messages === m0 + 1);
  check('agent1 (expéditeur) : inchangé', (await nav('agent1')).compteurs.messages === avant.agent1.compteurs.messages);

  console.log('— Administrateur : comptes en attente');
  const u0 = (await nav('admin')).compteurs.utilisateurs;
  const ins = await fetch('http://localhost:3000/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `nav${S}@test.local`, password: 'Password123!', firstName: 'Nav', lastName: `Inscrit${S}` }) });
  if (ins.status < 300) {
    const a = await nav('admin');
    check('demande d’accès : compteur de l’administrateur +1, dans « À traiter »', a.compteurs.utilisateurs === u0 + 1 && aTraiter(a, 'comptes') >= 1);
  } else check(`inscription publique indisponible (${ins.status}) : contrôle sauté`, true);
  check('un chef ne voit jamais les comptes en attente', (await nav('chefdpe')).compteurs.utilisateurs === 0 && aTraiter(await nav('chefdpe'), 'comptes') === 0);

  console.log('— Stagiaire : ses tâches et ses messages seulement');
  const sg = (await call('admin', 'POST', '/users', { email: `navst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `NavStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  await call('chefssr', 'POST', '/tasks', { title: `Tâche du stagiaire ${S}`, assignees: [{ userId: sg.id }], divisionId: ids.DPE, sectionId: ids.SSR });
  const K = `navst${S}`;
  const ns = await call(K, 'GET', '/api/v1/navigation');
  check('stagiaire : 200, une tâche, aucun compteur d’écran fermé', ns.status === 200 && ns.body.compteurs.taches === 1 && ['instructions', 'reunions', 'conges', 'courrier', 'logistique', 'utilisateurs'].every((c) => ns.body.compteurs[c] === 0), JSON.stringify(ns.body.compteurs));
  check('stagiaire : « Créer » limité au message', JSON.stringify(ns.body.creer) === JSON.stringify({ tache: false, reunion: false, conge: false, message: true, document: false }));
  expect('stagiaire : le tableau de bord par rôle reste fermé (403)', await call(K, 'GET', '/api/v1/tableau-de-bord'), 403);
  expect('stagiaire : le courrier reste fermé (403)', await call(K, 'GET', '/courrier/tableau-de-bord'), 403);

  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
