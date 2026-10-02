// G3 — parcours du socle jusqu'ici sans test automatisé : inscription et approbation,
// mot de passe oublié (lien lu dans le journal de l'API : aucun email réel en test),
// déconnexion de toutes les sessions, cycle de vie d'une tâche (403/409), congés (dont
// le congé maladie masqué pour la Direction), GED (dépôt, versions, publication, besoin
// d'en connaître), annonces, sondages, suggestions.
const fs = require('fs');
const path = require('path');
const E = require('../config');
const { call, ids, check, expect, bilan, login } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
async function http(method, p, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(API + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
async function televerser(k, p, champs, nom, contenu, champFichier = 'file') {
  const fd = new FormData();
  for (const [c, v] of Object.entries(champs)) fd.append(c, v);
  fd.append(champFichier, new Blob([contenu]), nom);
  const r = await fetch(API + p, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(k)) }, body: fd });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}

(async () => {
  console.log('— Inscription et approbation');
  const email = `insc${S}@test.local`;
  expect('inscription (poste déclaré)', await http('POST', '/auth/register', { email, password: 'Password123!', firstName: 'Nouvel', lastName: `Agent${S}`, declaredRole: 'AGENT', declaredDivisionId: ids.DPE }), 201);
  expect('inscription en double', await http('POST', '/auth/register', { email, password: 'Password123!', firstName: 'X', lastName: 'Y', declaredRole: 'AGENT' }), 409);
  expect('rôle DRH non déclarable', await http('POST', '/auth/register', { email: `x${email}`, password: 'Password123!', firstName: 'X', lastName: 'Y', declaredRole: 'DRH' }), 400);
  expect('connexion avant approbation', await http('POST', '/auth/login', { email, password: 'Password123!' }), 403);
  const enAttente = (await call('admin', 'GET', '/users/pending')).body.find((u) => u.email === email);
  check('la demande apparaît chez l’administrateur', !!enAttente);
  expect('un chef ne peut pas approuver', await call('chefdpe', 'POST', `/users/${enAttente.id}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 403);
  expect('l’administrateur approuve', await call('admin', 'POST', `/users/${enAttente.id}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 201);
  expect('approbation rejouée', await call('admin', 'POST', `/users/${enAttente.id}/approve`, { role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SFP }), 409);
  const s1 = await http('POST', '/auth/login', { email, password: 'Password123!' });
  check('connexion après approbation', s1.status === 200 && !!s1.body.accessToken);

  console.log('— Mot de passe oublié, puis déconnexion de toutes les sessions');
  const s2 = (await http('POST', '/auth/login', { email, password: 'Password123!' })).body;
  expect('demande de lien (compte existant)', await http('POST', '/auth/forgot-password', { email }), 200);
  expect('demande de lien (compte inconnu : même réponse, rien ne fuit)', await http('POST', '/auth/forgot-password', { email: `inconnu${S}@test.local` }), 200);
  const journal = fs.readFileSync(path.join(E.OUT, 'logs', 'api-normal.log'), 'utf8');
  const lien = [...journal.matchAll(/reset-password\?token=([A-Za-z0-9_-]+)/g)].pop();
  check('lien de réinitialisation émis (journal local, aucun email réel)', !!lien);
  expect('mot de passe trop court', await http('POST', '/auth/reset-password', { token: lien[1], newPassword: 'court' }), 400);
  expect('réinitialisation', await http('POST', '/auth/reset-password', { token: lien[1], newPassword: 'NouveauMdp123!' }), 200);
  expect('lien rejoué (usage unique)', await http('POST', '/auth/reset-password', { token: lien[1], newPassword: 'Encore123456!' }), 401);
  expect('ancien mot de passe refusé', await http('POST', '/auth/login', { email, password: 'Password123!' }), 401);
  const s3 = (await http('POST', '/auth/login', { email, password: 'NouveauMdp123!' })).body;
  check('nouveau mot de passe accepté', !!s3.accessToken);
  expect('les sessions d’avant la réinitialisation sont fermées', await http('POST', '/auth/refresh', { refreshToken: s2.refreshToken }), 401);
  const s4 = (await http('POST', '/auth/login', { email, password: 'NouveauMdp123!' })).body;
  check('deux sessions ouvertes listées', (await http('GET', '/auth/sessions', null, s4.accessToken)).body.length >= 2);
  expect('déconnexion de toutes les sessions', await http('POST', '/auth/logout-all', null, s4.accessToken), 204);
  expect('rafraîchissement impossible ensuite', await http('POST', '/auth/refresh', { refreshToken: s3.refreshToken }), 401);

  console.log('— Tâche : cycle de vie et droits');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Note de conjoncture ${S}`, priority: 'URGENT', dueDate: jour(10), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] }));
  check('le chef de section crée et assigne une tâche', t.status === 201);
  const tid = t.body.id;
  expect('un agent d’une autre division ne l’ouvre pas', await call('agentdee', 'GET', `/tasks/${tid}`), 403);
  expect('soumettre avant de démarrer', await call('agent1', 'POST', `/tasks/${tid}/submit`), 409);
  expect('l’assigné démarre', await call('agent1', 'POST', `/tasks/${tid}/start`), 201);
  expect('avancement saisi à la main refusé (calculé, N3)', await call('agent1', 'PATCH', `/tasks/${tid}/progress`, { progressPercent: 60 }), 409);
  check('… avancement calculé : en cours = 50 %', (await call('agent1', 'GET', `/tasks/${tid}`)).body.progressPercent === 50);
  expect('commentaire', await call('agent1', 'POST', `/tasks/${tid}/comments`, { body: `Premier jet déposé ${S}` }), 201);
  const pj = await televerser('agent1', `/tasks/${tid}/attachments`, {}, 'note.txt', `Contenu ${S}`, 'files');
  check('pièce jointe déposée', pj.status === 201);
  expect('l’assigné soumet', await call('agent1', 'POST', `/tasks/${tid}/submit`), 201);
  expect('l’assigné ne valide pas sa propre tâche', await call('agent1', 'POST', `/tasks/${tid}/validate`, {}), 403);
  expect('un chef d’une autre division ne valide pas', await call('chefdee', 'POST', `/tasks/${tid}/validate`, {}), 403);
  expect('rejet sans commentaire', await call('chefssr', 'POST', `/tasks/${tid}/reject`, {}), 400);
  expect('le chef rejette avec un commentaire', await call('chefssr', 'POST', `/tasks/${tid}/reject`, { comment: 'Compléter les tableaux' }), 201);
  check('rejetée : la tâche revient « En cours »', (await prisma.task.findUnique({ where: { id: tid } })).status === 'EN_COURS');
  expect('l’assigné resoumet', await call('agent1', 'POST', `/tasks/${tid}/submit`), 201);
  expect('le chef valide', await call('chefssr', 'POST', `/tasks/${tid}/validate`, { comment: 'Très bien' }), 201);
  check('tâche terminée', (await prisma.task.findUnique({ where: { id: tid } })).status === 'TERMINEE');
  expect('validation rejouée', await call('chefssr', 'POST', `/tasks/${tid}/validate`, {}), 409);
  check('l’assigné a été notifié', (await prisma.notification.count({ where: { userId: ids.agent1, type: 'TACHE_VALIDEE', channel: 'IN_APP' } })) >= 1);

  console.log('— Congés : avis du chef, décision du DRH, congé maladie confidentiel');
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie']]) {
    if (!types.some((x) => x.code === code)) await call('admin', 'POST', '/leave-types', { code, name });
  }
  expect('un agent ne crée pas de type de congé', await call('agent1', 'POST', '/leave-types', { code: `X${S}`, name: 'X' }), 403);
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const annuel = types.find((x) => x.code === 'CONGE_ANNUEL'), maladie = types.find((x) => x.code === 'CONGE_MALADIE');
  expect('dates inversées', await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(20), endDate: jour(18) }), 400);
  const c1 = (await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: jour(20), endDate: jour(24), reason: 'Famille' })).body;
  check('demande de congé annuel (5 jours)', c1.daysCount === 5);
  // Circuit N3 (A6.1) : avis du chef d'unité, puis décision du DRH.
  expect('l’agent ne donne pas d’avis sur sa demande', await call('agent1', 'POST', `/leaves/${c1.id}/avis`, { avis: 'FAVORABLE' }), 403);
  expect('un chef d’une autre division ne donne pas d’avis', await call('chefdee', 'POST', `/leaves/${c1.id}/avis`, { avis: 'FAVORABLE' }), 403);
  expect('le DRH ne décide pas avant l’avis du chef', await call('drh', 'POST', `/leaves/${c1.id}/approve`, {}), 409);
  expect('le chef de section donne un avis favorable', await call('chefssr', 'POST', `/leaves/${c1.id}/avis`, { avis: 'FAVORABLE' }), 201);
  expect('avis rejoué', await call('chefssr', 'POST', `/leaves/${c1.id}/avis`, { avis: 'FAVORABLE' }), 409);
  expect('le chef ne décide plus (décision du DRH)', await call('chefssr', 'POST', `/leaves/${c1.id}/approve`, {}), 403);
  expect('le DRH approuve', await call('drh', 'POST', `/leaves/${c1.id}/approve`, {}), 201);
  expect('approbation rejouée', await call('drh', 'POST', `/leaves/${c1.id}/approve`, {}), 409);
  const c2 = (await call('agent1', 'POST', '/leaves', { leaveTypeId: maladie.id, startDate: jour(30), endDate: jour(31), reason: 'Consultation' })).body;
  const vueDn = (await call('dn', 'GET', `/leaves/${c2.id}`)).body;
  const vueChef = (await call('chefssr', 'GET', `/leaves/${c2.id}`)).body;
  const vueDrh = (await call('drh', 'GET', `/leaves/${c2.id}`)).body;
  check('congé maladie : type masqué pour le DN', vueDn.leaveType.code === null && vueDn.leaveTypeId === null);
  check('congé maladie : le chef qui donne l’avis voit le type, le motif derrière la réauthentification', vueChef.leaveType.code === 'CONGE_MALADIE' && vueChef.motifVerrouille === true && vueChef.reason === null);
  check('congé maladie : le DRH voit le type, le motif derrière la réauthentification', vueDrh.leaveType.code === 'CONGE_MALADIE' && vueDrh.motifVerrouille === true && vueDrh.reason === null);
  expect('avis défavorable sans motif', await call('chefssr', 'POST', `/leaves/${c2.id}/avis`, { avis: 'DEFAVORABLE' }), 400);
  expect('avis défavorable motivé', await call('chefssr', 'POST', `/leaves/${c2.id}/avis`, { avis: 'DEFAVORABLE', motif: 'Période chargée' }), 201);
  expect('refus sans motif', await call('drh', 'POST', `/leaves/${c2.id}/reject`, {}), 400);
  expect('refus motivé par le DRH', await call('drh', 'POST', `/leaves/${c2.id}/reject`, { comment: 'Pièce justificative manquante' }), 201);
  expect('un tiers n’annule pas la demande approuvée', await call('agent2', 'POST', `/leaves/${c1.id}/cancel`), 403);
  expect('l’agent annule sa demande approuvée', await call('agent1', 'POST', `/leaves/${c1.id}/cancel`), 201);

  console.log('— GED : dépôt, versions, publication, besoin d’en connaître');
  const d = await televerser('agent1', '/documents', { title: `Rapport trimestriel ${S}`, category: 'RAPPORT', divisionId: ids.DPE, typeDocument: 'RAPPORT', periodeDebut: '2026-07-01', periodeFin: '2026-09-30' }, 'rapport-v1.txt', `Version 1 ${S}`);
  check('dépôt d’un document dans sa division', d.status === 201);
  expect('dépôt dans une autre division', await televerser('agent1', '/documents', { title: 'Hors division', divisionId: ids.DEE, typeDocument: 'AUTRE', periodeDebut: '2026-07-01', periodeFin: '2026-09-30' }, 'x.txt', 'x'), 403);
  expect('un agent d’une autre division ne l’ouvre pas (privé division)', await call('agentdee', 'GET', `/documents/${d.body.id}`), 403);
  expect('nouvelle version', await televerser('agent1', `/documents/${d.body.id}/versions`, {}, 'rapport-v2.txt', `Version 2 ${S}`), 201);
  const versions = (await call('agent1', 'GET', `/documents/${d.body.id}/versions`)).body;
  check('deux versions conservées', versions.length === 2);
  const tel = await fetch(`${API}/documents/${d.body.id}/versions/${versions.find((v) => v.versionNumber === 1 || v.version === 1)?.id ?? versions[versions.length - 1].id}/download`, { headers: { Authorization: 'Bearer ' + (await login('agent1')) } });
  check('téléchargement d’une version', tel.status === 200);
  expect('un agent ne publie pas à toute la DNPEC', await call('agent1', 'POST', `/documents/${d.body.id}/publish`), 403);
  await call('chefdpe', 'POST', `/documents/${d.body.id}/mark-final`);
  expect('le chef de division publie', await call('chefdpe', 'POST', `/documents/${d.body.id}/publish`), 201);
  expect('publié : un agent d’une autre division l’ouvre', await call('agentdee', 'GET', `/documents/${d.body.id}`), 200);

  console.log('— Annonces, sondages, suggestions');
  const a = await call('chefdpe', 'POST', '/announcements', { title: `Réunion de division ${S}`, body: 'Lundi 9 h', scope: 'DIVISION', divisionId: ids.DPE });
  expect('le chef de division annonce à sa division', a, 201);
  expect('un agent ne diffuse pas d’annonce', await call('agent1', 'POST', '/announcements', { title: 'Annonce refusée', body: 'Texte', scope: 'DIVISION', divisionId: ids.DPE }), 403);
  expect('le chef de la DEE n’annonce pas à la DPE', await call('chefdee', 'POST', '/announcements', { title: 'Annonce refusée', body: 'Texte', scope: 'DIVISION', divisionId: ids.DPE }), 403);
  check('l’agent de la division la reçoit, pas celui de la DEE', (await call('agent1', 'GET', '/announcements')).body.some((x) => x.id === a.body.id) && !(await call('agentdee', 'GET', '/announcements')).body.some((x) => x.id === a.body.id));
  expect('lecture marquée', await call('agent1', 'POST', `/announcements/${a.body.id}/read`), 201);
  const p = await call('chefdpe', 'POST', '/polls', { question: `Date du séminaire ${S} ?`, options: ['Mars', 'Avril'], scope: 'DIVISION', divisionId: ids.DPE });
  expect('sondage créé', p, 201);
  const opt = p.body.options[0].id;
  expect('vote', await call('agent1', 'POST', `/polls/${p.body.id}/vote`, { optionIds: [opt] }), 201);
  expect('changer son vote (il remplace le précédent)', await call('agent1', 'POST', `/polls/${p.body.id}/vote`, { optionIds: [p.body.options[1].id] }), 201);
  check('un seul vote enregistré pour l’agent', (await prisma.pollVote.count({ where: { pollId: p.body.id, userId: ids.agent1 } })) === 1);
  expect('un agent hors audience ne vote pas', await call('agentdee', 'POST', `/polls/${p.body.id}/vote`, { optionIds: [opt] }), 403);
  expect('clôture par l’auteur', await call('chefdpe', 'POST', `/polls/${p.body.id}/close`), 201);
  expect('vote après clôture', await call('agent2', 'POST', `/polls/${p.body.id}/vote`, { optionIds: [opt] }), 400);
  const sg = await call('agent1', 'POST', '/suggestions', { content: `Plus de salles de réunion ${S}`, isAnonymous: true });
  expect('suggestion anonyme', sg, 201);
  const liste = (await call('dn', 'GET', '/suggestions')).body;
  const vue = liste.find((x) => x.id === sg.body.id);
  check('anonyme : l’auteur n’est pas révélé à la Direction', vue && !JSON.stringify(vue).includes(ids.agent1));
  expect('un agent ne traite pas les suggestions', await call('agent2', 'GET', '/suggestions'), 403);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
