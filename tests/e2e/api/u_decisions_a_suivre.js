// Refonte de l'interface (étape 6) — GET api/v1/decisions/a-suivre : panneau « Décisions à suivre » de
// la page Réunions. Même périmètre que le relevé de chaque réunion (getMeetingVisibilityWhere) : une
// décision n'est listée que pour qui peut ouvrir sa réunion (404 sur le relevé pour les autres) ;
// ouvertes d'abord, retards en tête (échéance de l'action dépassée), puis clôturées récemment ; nombre
// « en retard » cohérent avec la liste. Lecture seule ; stagiaire 403 (réunions fermées), sans session 401.
const { call, ids, check, expect, bilan } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const aSuivre = async (k) => (await call(k, 'GET', '/api/v1/decisions/a-suivre')).body;
const idsDe = (b) => b.decisions.map((d) => d.id);

(async () => {
  console.log('— Accès');
  const r401 = await fetch('http://localhost:3000/api/v1/decisions/a-suivre');
  check('sans session : 401', r401.status === 401);
  const sg = (await call('admin', 'POST', '/users', { email: `decst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `DecStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('stagiaire créé', !!sg.id, JSON.stringify(sg).slice(0, 120));
  expect('stagiaire : 403 (réunions fermées)', await call(`decst${S}`, 'GET', '/api/v1/decisions/a-suivre'), 403);
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'chefdee', 'dn', 'drh', 'admin']) {
    const r = await call(k, 'GET', '/api/v1/decisions/a-suivre');
    check(`${k} : 200, nombre en retard = retards de la liste`, r.status === 200 && Array.isArray(r.body.decisions) && r.body.enRetard === r.body.decisions.filter((d) => d.enRetard).length, JSON.stringify(r.body).slice(0, 160));
  }

  console.log('— Réunion de la DPE : trois décisions');
  const m = (await call('chefdpe', 'POST', '/meetings', { title: `Comité à suivre ${S}`, startAt: iso(-2 * J), participantIds: [ids.agent1, ids.chefssr] })).body;
  check('réunion créée par le chef de division', !!m.id, JSON.stringify(m).slice(0, 120));
  const dec = async (content) => (await call('chefdpe', 'POST', `/meetings/${m.id}/decisions`, { content })).body;
  const enRetard = await dec(`Transmettre la note ${S}`);
  const ouverte = await dec(`Programmer l’atelier ${S}`);
  const close = await dec(`Diffuser le compte rendu ${S}`);
  check('trois décisions consignées', !!enRetard.id && !!ouverte.id && !!close.id);
  expect('conversion en action, échéance dépassée', await call('chefdpe', 'POST', `/decisions/${enRetard.id}/convert-to-action`, { assigneeId: ids.agent1, dueDate: jour(-1) }), 201);
  expect('clôture de la troisième', await call('chefdpe', 'POST', `/decisions/${close.id}/close`), 201);

  const b = await aSuivre('chefdpe');
  const ligne = (id) => b.decisions.find((d) => d.id === id);
  check('organisateur : les trois décisions, avec leur réunion', [enRetard.id, ouverte.id, close.id].every((id) => ligne(id) && ligne(id).meeting.id === m.id && ligne(id).meeting.title === `Comité à suivre ${S}`));
  check('en retard : action liée (tâche), drapeau et nombre', ligne(enRetard.id).enRetard === true && !!ligne(enRetard.id).action && b.enRetard >= 1);
  check('ouverte sans action : pas en retard', ligne(ouverte.id).enRetard === false && ligne(ouverte.id).action === null);
  check('clôturée : listée, jamais en retard', ligne(close.id).status === 'CLOTUREE' && ligne(close.id).enRetard === false);
  const ordre = idsDe(b);
  check('ordre : retards d’abord, clôturées à la fin', ordre.indexOf(enRetard.id) < ordre.indexOf(ouverte.id) && ordre.indexOf(ouverte.id) < ordre.indexOf(close.id));
  check('aucun droit de gestion renvoyé (lecture seule)', !('droits' in ligne(ouverte.id)));

  console.log('— Périmètre : celui du relevé de la réunion');
  for (const k of ['agent1', 'chefssr', 'dn']) {
    check(`${k} (invité ou hiérarchie) : voit les décisions`, idsDe(await aSuivre(k)).includes(ouverte.id));
    expect(`… et ouvre le relevé (${k})`, await call(k, 'GET', `/meetings/${m.id}/decisions`), 200);
  }
  for (const k of ['agentdee', 'chefdee', 'agent2']) {
    const vues = idsDe(await aSuivre(k));
    check(`${k} (ni invité ni hiérarchie) : aucune de ces décisions`, ![enRetard.id, ouverte.id, close.id].some((id) => vues.includes(id)));
  }
  expect('témoin : agentdee ne peut pas ouvrir le relevé (404)', await call('agentdee', 'GET', `/meetings/${m.id}/decisions`), 404);
  for (const d of (await aSuivre('agentdee')).decisions.slice(0, 5)) {
    expect(`chaque réunion listée pour agentdee s’ouvre (${d.meeting.title})`, await call('agentdee', 'GET', `/meetings/${d.meetingId}/decisions`), 200);
  }
  expect('écriture refusée par la route de lecture (POST → 404)', await call('chefdpe', 'POST', '/api/v1/decisions/a-suivre', {}), 404);

  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
