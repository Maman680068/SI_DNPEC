// Tableau de bord — bande des quatre chiffres selon le profil (GET api/v1/tableau-de-bord/chiffres) :
// Direction, DRH, administrateur, assistant de direction, chefs, chargé d'études, stagiaire. Chaque chiffre
// est comparé à la donnée de l'écran du module (jamais plus que ce que la personne y voit) ; liens vers les
// pages ; refus : aucune donnée d'un autre profil, stagiaire sans lien vers les congés (écran fermé), route
// des blocs toujours fermée au stagiaire, aucun accès sans session.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const J = 864e5;
const lire = async (k) => (await call(k, 'GET', '/api/v1/tableau-de-bord/chiffres')).body;
const par = (r) => Object.fromEntries(r.chiffres.map((c) => [c.cle, c]));
const ouverte = (i) => ['EMISE', 'RECUE', 'PRISE_EN_COMPTE'].includes(i.statut);

(async () => {
  console.log('— Direction (DN, DNA)');
  for (const k of ['dn', 'dna']) {
    const r = await lire(k);
    const c = par(r);
    check(`${k} : profil DIRECTION, 4 chiffres dans l’ordre`, r.profil === 'DIRECTION' && r.chiffres.map((x) => x.cle).join() === 'plan,taches-retard,instructions,decisions', r.chiffres.map((x) => x.cle).join());
    const t = (await call(k, 'GET', '/tasks/dashboard')).body;
    const inst = (await call(k, 'GET', '/api/v1/instructions')).body.emises.filter(ouverte);
    const plan = (await call(k, 'GET', `/api/v1/plan-travail?annee=${new Date().getUTCFullYear()}`)).body.objectifs.map((o) => o.avancement);
    const moy = plan.length ? `${Math.round(plan.reduce((s, x) => s + x, 0) / plan.length)} %` : null;
    check(`${k} : avancement du plan = moyenne des objectifs visibles (${moy})`, c.plan.valeur === moy && c.plan.lien === '/plan-travail');
    check(`${k} : tâches en retard du périmètre = écran des tâches (${t.enRetard})`, c['taches-retard'].valeur === t.enRetard && /echeance=retard/.test(c['taches-retard'].lien));
    check(`${k} : instructions non exécutées = écran des instructions (${inst.length}), ancienneté de la plus ancienne`, c.instructions.valeur === inst.length && (inst.length === 0 || /la plus ancienne depuis \d+ j/.test(c.instructions.sous)));
    check(`${k} : décisions non exécutées (lien Réunions)`, Number.isInteger(c.decisions.valeur) && c.decisions.lien === '/reunions');
  }

  console.log('— Vue Direction : toutes les activités de la DNPEC, de la plus en retard à la plus avancée');
  const av = await call('dn', 'GET', '/api/v1/plan-travail/avancement-direction');
  const toutes = (await call('dn', 'GET', `/api/v1/plan-travail?annee=${new Date().getUTCFullYear()}`)).body.objectifs.flatMap((o) => o.activites);
  const rang = { EN_RETARD: 0, EN_DECALAGE: 1, CONFORME: 2 };
  const triee = av.body.activites.every((a, i, l) => i === 0 || rang[l[i - 1].etatAvancement] < rang[a.etatAvancement] || (rang[l[i - 1].etatAvancement] === rang[a.etatAvancement] && l[i - 1].avancement - l[i - 1].tempsEcoule <= a.avancement - a.tempsEcoule));
  check(`DN : ${av.body.total} activités (toute la DNPEC), 8 au plus, triées de la plus en retard à la plus avancée, avec sigle d’unité`, av.status === 200 && av.body.total === toutes.length && av.body.activites.length === Math.min(8, toutes.length) && triee && av.body.activites.every((a) => a.uniteSigle), JSON.stringify(av.body.activites.map((a) => [a.etatAvancement, a.avancement, a.tempsEcoule])));
  check('DNA : même vue', (await call('dna', 'GET', '/api/v1/plan-travail/avancement-direction')).body.total === toutes.length);
  for (const k of ['chefdpe', 'agent1', 'drh', 'admin']) expect(`${k} : vue Direction du plan refusée`, await call(k, 'GET', '/api/v1/plan-travail/avancement-direction'), 403);
  const absDn = (await call('dn', 'GET', '/api/v1/tableau-de-bord')).body.blocs.find((b) => b.cle === 'absences');
  check('DN : bloc « Absences du jour » sans nature médicale (« motif protégé » au besoin)', !!absDn && !(absDn.elements || []).some((e) => /maladie/i.test(e.detail || '')));

  console.log('— DRH');
  const rd = await lire('drh');
  const cd = par(rd);
  const eff = (await call('drh', 'GET', '/api/v1/rh/effectifs')).body;
  const aDecider = (await call('drh', 'GET', '/leaves?status=EN_ATTENTE')).body.filter((x) => x.droits.peutDecider).length;
  const stages = await prisma.stage.count({ where: { statut: 'EN_COURS' } });
  check('DRH : profil DRH, effectif, congés à décider, alertes RH, stagiaires', rd.profil === 'DRH' && rd.chiffres.map((x) => x.cle).join() === 'effectif,conges-decision,alertes-rh,stagiaires');
  check(`DRH : effectif en fonction = écran des effectifs (${eff.total})`, cd.effectif.valeur === eff.total && cd.effectif.lien === '/rh?onglet=effectifs');
  check(`DRH : demandes en attente de sa décision (${aDecider})`, cd['conges-decision'].valeur === aDecider);
  check(`DRH : stagiaires en cours (${stages}) et alertes RH ouvertes`, cd.stagiaires.valeur === stages && Number.isInteger(cd['alertes-rh'].valeur) && cd['alertes-rh'].lien === '/rh?onglet=alertes');

  console.log('— Administrateur');
  let ra = await lire('admin');
  let ca = par(ra);
  const attente = await prisma.user.count({ where: { status: 'EN_ATTENTE' } });
  const pointsSupervision = async () => (await call('admin', 'GET', '/api/v1/supervision')).body.services.filter((s) => s.etat !== 'NOMINAL').length;
  let sup = await pointsSupervision();
  // Les points de supervision du tableau de bord sont gardés une minute : un état qui vient de changer
  // (service de calcul réveillé…) n'y apparaît qu'à l'expiration ; on relit alors les deux.
  if (ca.supervision.valeur !== sup) {
    await new Promise((r) => setTimeout(r, 61_000));
    ra = await lire('admin'); ca = par(ra); sup = await pointsSupervision();
  }
  const travaux = await prisma.travailCalcul.count({ where: { statut: { in: ['EN_FILE', 'EN_COURS', 'ECHEC'] } } });
  check('administrateur : profil ADMINISTRATEUR, 4 chiffres', ra.profil === 'ADMINISTRATEUR' && ra.chiffres.map((x) => x.cle).join() === 'comptes,supervision,calcul,audit');
  check(`administrateur : comptes en attente (${attente}), points de supervision (${sup}), travaux du calcul (${travaux})`, ca.comptes.valeur === attente && ca.supervision.valeur === sup && ca.calcul.valeur === travaux);
  check('administrateur : date de la dernière vérification de la chaîne d’audit (ou « jamais vérifiée »)', ca.audit.lien === '/journal-audit' && (ca.audit.valeur === null ? /jamais/.test(ca.audit.sous) : /\d/.test(ca.audit.valeur)));
  check('administrateur : aucune donnée de tâche ni de congé dans sa bande', !ra.chiffres.some((x) => /taches|conges|solde/.test(x.cle)));

  console.log('— Assistant de direction (visibilité héritée)');
  const rs = await lire('assdn');
  const cs = par(rs);
  const crr = (await call('assdn', 'GET', '/courrier/tableau-de-bord')).body;
  const reunionsDn = (await call('assdn', 'GET', '/meetings')).body.filter((m) => m.status === 'PLANIFIEE' && new Date(m.startAt) >= new Date() && (m.createdById === ids.dn || (m.participants || []).some((p) => p.userId === ids.dn))).length;
  check('assistant : profil ASSISTANT, courrier à imputer, en traitement, réunions du superviseur, instructions', rs.profil === 'ASSISTANT' && rs.chiffres.map((x) => x.cle).join() === 'courrier-imputer,courrier-traitement,reunions-superviseur,instructions');
  check(`assistant : courriers à imputer = sa page Courrier (${crr.arriveesEnAttente})`, cs['courrier-imputer'].valeur === crr.arriveesEnAttente && cs['courrier-traitement'].valeur === crr.arriveesEnTraitement);
  check(`assistant : réunions à venir de son superviseur, parmi celles qu’il voit (${reunionsDn})`, cs['reunions-superviseur'].valeur === reunionsDn && /superviseur/.test(cs['reunions-superviseur'].sous));
  const instAss = (await call('assdn', 'GET', '/api/v1/instructions')).body;
  const ouvertesAss = new Set([...instAss.emises, ...instAss.recues].filter(ouverte).map((i) => i.id)).size;
  check(`assistant : instructions = celles de son écran seulement (${ouvertesAss})`, cs.instructions.valeur === ouvertesAss);

  console.log('— Chefs (quatre chiffres de tâches inchangés)');
  for (const k of ['chefdpe', 'chefssr', 'chefsaf']) {
    const r = await lire(k);
    const t = (await call(k, 'GET', '/tasks/dashboard')).body;
    const c = par(r);
    check(`${k} : En cours ${t.enCours}, En retard ${t.enRetard}, En validation ${t.enAttenteValidation}, Terminées ${t.termineesCeMois}`, r.profil === 'CHEF' && c['en-cours'].valeur === t.enCours && c['en-retard'].valeur === t.enRetard && c['en-validation'].valeur === t.enAttenteValidation && c.terminees.valeur === t.termineesCeMois);
  }

  console.log('— Chargé d’études');
  const rg = await lire('agent1');
  const cg = par(rg);
  const mes = (await call('agent1', 'GET', `/tasks?assigneeId=${ids.agent1}`)).body.filter((t) => !t.parentTaskId && !['TERMINEE', 'VALIDEE'].includes(t.status));
  const maint = Date.now();
  const retard = mes.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < maint).length;
  const demandes = (await call('agent1', 'GET', `/leaves?userId=${ids.agent1}&status=EN_ATTENTE`)).body.filter((x) => x.userId === ids.agent1).length;
  check('chargé d’études : profil AGENT, mes tâches, solde, demandes, retards', rg.profil === 'AGENT' && rg.chiffres.map((x) => x.cle).join() === 'mes-taches,solde,mes-demandes,mes-retards');
  check(`chargé d’études : mes tâches ouvertes (${mes.length}) et en retard (${retard}) = « Mes tâches »`, cg['mes-taches'].valeur === mes.length && cg['mes-retards'].valeur === retard, `${cg['mes-taches'].valeur}/${cg['mes-retards'].valeur}`);
  check(`chargé d’études : mes demandes de congé en cours (${demandes}), liens vers Congés`, cg['mes-demandes'].valeur === demandes && cg.solde.lien === '/leaves' && cg['mes-demandes'].lien === '/leaves');
  const solde = (await call('agent1', 'GET', '/leaves/balances/me')).body.find((b) => b.leaveTypeCode === 'CONGE_ANNUEL' && b.year === new Date().getUTCFullYear());
  check('chargé d’études : solde de congé annuel = « Mes soldes »', solde ? cg.solde.valeur === solde.totalDays - solde.usedDays : cg.solde.valeur === null, JSON.stringify(solde));
  check('chargé d’études : aucun chiffre d’un autre profil', !rg.chiffres.some((x) => ['plan', 'effectif', 'comptes', 'courrier-imputer'].includes(x.cle)));

  console.log('— Stagiaire');
  const cle = `stgtdb${Date.now().toString(36)}`;
  const stg = (await call('admin', 'POST', '/users', { email: `${cle}@test.local`, password: 'Password123!', firstName: 'Stag', lastName: 'Tableau', role: 'STAGIAIRE' })).body;
  await prisma.user.update({ where: { id: stg.id }, data: { divisionId: ids.DPE, sectionId: ids.SSR } }); // comme après l'affectation du stage
  const tStg = await call('chefssr', 'POST', '/tasks', { title: `Tâche stagiaire ${cle}`, divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: stg.id }], dueDate: new Date(maint - 2 * J).toISOString() });
  expect('tâche assignée au stagiaire (échéance passée)', tStg, 201);
  const rt = await lire(cle);
  const ct = par(rt);
  check('stagiaire : bande ouverte, ses propres tâches (1 ouverte, 1 en retard)', rt.profil === 'AGENT' && ct['mes-taches'].valeur === 1 && ct['mes-retards'].valeur === 1);
  check('stagiaire : chiffres de congés sans lien (écran des congés fermé)', ct.solde.lien === null && ct['mes-demandes'].lien === null && ct['mes-taches'].lien !== null);
  expect('stagiaire : route des blocs du tableau de bord toujours fermée', await call(cle, 'GET', '/api/v1/tableau-de-bord'), 403);
  const anon = await fetch('http://localhost:3000/api/v1/tableau-de-bord/chiffres');
  check('sans session : 401', anon.status === 401);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
