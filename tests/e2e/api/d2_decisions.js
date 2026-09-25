// Lot D2 — décisions de réunion : droits renvoyés à l'écran = droits appliqués,
// responsables possibles = ensemble accepté (force brute), 403/404/409.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36).slice(-5);

async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
  return r.body.id;
}
const liste = (key, mid, h) => call(key, 'GET', `/meetings/${mid}/decisions`, undefined, h);
const nouvelle = async (mid, key = 'chefdpe', h) => {
  const r = await call(key, 'POST', `/meetings/${mid}/decisions`, { content: `Décision ${S} ${Math.random().toString(36).slice(2, 7)}` }, h);
  if (r.status !== 201) throw new Error('décision ' + JSON.stringify(r.body));
  return r.body.id;
};
const convertir = (key, did, assigneeId, h) => call(key, 'POST', `/decisions/${did}/convert-to-action`, { assigneeId, dueDate: iso(7 * J) }, h);

(async () => {
  const m = await call('chefdpe', 'POST', '/meetings', { title: `Réunion D2 ${S}`, startAt: iso(-J), participantIds: [ids.agent1, ids.chefssr] });
  if (m.status !== 201) throw new Error('réunion ' + JSON.stringify(m.body));
  const mid = m.body.id;
  const d1 = await nouvelle(mid);

  console.log('— Droits renvoyés par la liste');
  const org = await liste('chefdpe', mid);
  check('organisateur : peutAjouter', org.body.peutAjouter === true);
  const dr = (r, id) => r.body.decisions.find((d) => d.id === id).droits;
  check('organisateur : modifier/convertir/clôturer, pas relancer', JSON.stringify(dr(org, d1)) === JSON.stringify({ modifier: true, convertir: true, cloturer: true, relancer: false }), JSON.stringify(dr(org, d1)));
  for (const key of ['dn', 'dna', 'agent1', 'chefssr']) {
    const r = await liste(key, mid);
    check(`${key} : consultation seule + relancer`, r.status === 200 && r.body.peutAjouter === false && JSON.stringify(dr(r, d1)) === JSON.stringify({ modifier: false, convertir: false, cloturer: false, relancer: true }), `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  expect('chef d’une autre division (hors périmètre) : liste', await liste('chefdee', mid), 404);

  console.log('— Suppléant de l’organisateur en intérim');
  const sup = await suppleance('chefdpe', 'chefdee');
  const H = { 'X-Interim-For': ids.chefdpe };
  const int = await liste('chefdee', mid, H);
  check('intérim : peutAjouter et droits de l’organisateur', int.status === 200 && int.body.peutAjouter === true && dr(int, d1).convertir === true && dr(int, d1).relancer === false, JSON.stringify(int.body).slice(0, 200));
  const dInt = await nouvelle(mid, 'chefdee', H);
  check('intérim : ajout accepté', !!dInt);
  expect('sans en-tête d’intérim : ajout refusé', await call('chefdee', 'POST', `/meetings/${mid}/decisions`, { content: 'Hors intérim' }), 403);

  console.log('— Actions refusées aux non-organisateurs');
  for (const key of ['dn', 'agent1', 'chefssr']) {
    expect(`${key} ajoute`, await call(key, 'POST', `/meetings/${mid}/decisions`, { content: 'Tentative' }), 403);
    expect(`${key} modifie`, await call(key, 'PATCH', `/decisions/${d1}`, { content: 'Tentative' }), 403);
    expect(`${key} convertit`, await convertir(key, d1, ids.agent1), 403);
    expect(`${key} demande les responsables possibles`, await call(key, 'GET', `/decisions/${d1}/responsables-possibles`), 403);
    expect(`${key} clôture`, await call(key, 'POST', `/decisions/${d1}/close`), 403);
  }
  expect('agent1 relance', await call('agent1', 'POST', `/decisions/${d1}/remind`), 201);

  console.log('— Responsables possibles = ensemble accepté (force brute)');
  const actifs = await prisma.user.findMany({ where: { status: 'ACTIF' }, select: { id: true } });
  const inactif = await prisma.user.findFirst({ where: { status: { not: 'ACTIF' } }, select: { id: true } });
  for (const [label, key, h] of [['organisateur', 'chefdpe', undefined], ['suppléant en intérim', 'chefdee', H]]) {
    const dx = await nouvelle(mid, key, h);
    const prop = await call(key, 'GET', `/decisions/${dx}/responsables-possibles`, undefined, h);
    const proposes = new Set(prop.body.map((u) => u.id));
    const acceptes = new Set();
    let d = await nouvelle(mid, key, h);
    for (const u of [...actifs, ...(inactif ? [inactif] : [])]) {
      const r = await convertir(key, d, u.id, h);
      if (r.status === 201) { acceptes.add(u.id); d = await nouvelle(mid, key, h); }
      else if (r.status !== 403) check(`${label} : refus inattendu pour ${u.id}`, false, `${r.status} ${JSON.stringify(r.body)}`);
    }
    const egal = proposes.size === acceptes.size && [...proposes].every((i) => acceptes.has(i));
    check(`${label} : ${proposes.size} proposés = ${acceptes.size} acceptés sur ${actifs.length + (inactif ? 1 : 0)} essayés`, egal);
    check(`${label} : soi-même proposé`, proposes.has(key === 'chefdee' ? ids.chefdee : ids.chefdpe));
    check(`${label} : aucun compte inactif proposé`, !inactif || !proposes.has(inactif.id));
    check(`${label} : agent de la DPE proposé, agent de la DEE non`, proposes.has(ids.agent1) && !proposes.has(ids.agentdee));
    check(`${label} : réponse sans rattachement ni statut`, prop.body.every((u) => Object.keys(u).sort().join() === 'firstName,id,jobTitle,lastName,role'));
  }
  await call('chefdpe', 'POST', `/suppleances/${sup}/revoke`);
  expect('suppléance révoquée : l’en-tête d’intérim est refusé', await liste('chefdee', mid, H), 403);

  console.log('— États (409) et lien vers l’action');
  const d2 = await nouvelle(mid);
  expect('conversion vers agent1', await convertir('chefdpe', d2, ids.agent1), 201);
  const apres = await liste('chefdpe', mid);
  const x2 = apres.body.decisions.find((d) => d.id === d2);
  check('action liée renvoyée (id, titre, statut, échéance)', x2.action && x2.action.id && x2.action.title && x2.action.status && x2.action.dueDate, JSON.stringify(x2.action));
  check('droits après conversion : convertir=false, clôturer=true', x2.droits.convertir === false && x2.droits.cloturer === true, JSON.stringify(x2.droits));
  expect('seconde conversion', await convertir('chefdpe', d2, ids.agent1), 409);
  expect('responsables possibles d’une décision déjà convertie', await call('chefdpe', 'GET', `/decisions/${d2}/responsables-possibles`), 409);
  expect('agent1 voit la tâche liée', await call('agent1', 'GET', `/tasks/${x2.action.id}`), 200);
  expect('clôture manuelle', await call('chefdpe', 'POST', `/decisions/${d1}/close`), 201);
  const clos = (await liste('dn', mid)).body.decisions.find((d) => d.id === d1);
  check('décision close : statut CLOTUREE, aucun droit (même relancer)', clos.status === 'CLOTUREE' && Object.values(clos.droits).every((v) => v === false), JSON.stringify(clos));
  expect('modifier une décision close', await call('chefdpe', 'PATCH', `/decisions/${d1}`, { content: 'Encore' }), 409);
  expect('convertir une décision close', await convertir('chefdpe', d1, ids.agent1), 409);
  expect('clôturer deux fois', await call('chefdpe', 'POST', `/decisions/${d1}/close`), 409);
  expect('relancer une décision close', await call('dn', 'POST', `/decisions/${d1}/remind`), 409);
  expect('décision inconnue', await call('chefdpe', 'GET', `/decisions/inconnue/responsables-possibles`), 404);
  expect('conversion sans échéance', await call('chefdpe', 'POST', `/decisions/${dInt}/convert-to-action`, { assigneeId: ids.agent1 }), 400);
  expect('responsable inconnu', await convertir('chefdpe', dInt, 'inconnu'), 404);

  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
