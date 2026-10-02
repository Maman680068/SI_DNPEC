// Performance (octobre 2026) : vue de suivi et filtres de la liste des tâches (jamais plus que le
// périmètre, bornes refusées), décompte du tableau de bord identique à la liste, droits de la liste
// des congés et de la GED identiques au détail (lecture groupée), reprise des emails refusés par le
// serveur d'envoi (immédiats et résumé, abandon après 72 h), envoi par lots, quota journalier en
// supervision.
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const idsDe = (r) => new Set((r.body || []).map((t) => t.id));
const inclus = (a, b) => [...a].every((x) => b.has(x));

(async () => {
  // ------------------------------------------------------------------ tâches : vue de suivi et filtres
  console.log('— Tâches : vue de suivi, filtres « mes tâches », bornes');
  const ouverte = (await call('chefssr', 'POST', '/tasks', { title: `Perf ouverte ${S}`, priority: 'NORMAL', dueDate: jour(5), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const close = (await call('chefssr', 'POST', '/tasks', { title: `Perf close ancienne ${S}`, priority: 'NORMAL', dueDate: jour(-90), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const recente = (await call('chefssr', 'POST', '/tasks', { title: `Perf close récente ${S}`, priority: 'NORMAL', dueDate: jour(-3), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  // Statuts posés en base (le circuit de validation est couvert ailleurs) ; updatedAt daté.
  await prisma.$executeRawUnsafe(`UPDATE tasks SET status = 'VALIDEE', "updatedAt" = now() - interval '60 days' WHERE id = $1`, close.id);
  await prisma.$executeRawUnsafe(`UPDATE tasks SET status = 'TERMINEE', "updatedAt" = now() - interval '2 days' WHERE id = $1`, recente.id);

  const tout = await call('chefssr', 'GET', '/tasks');
  const suivi = await call('chefssr', 'GET', '/tasks?suivi=true');
  expect('liste complète (inchangée sans paramètre)', tout, 200);
  expect('vue de suivi', suivi, 200);
  check('vue de suivi : tâche ouverte et tâche close depuis 2 jours présentes', idsDe(suivi).has(ouverte.id) && idsDe(suivi).has(recente.id));
  check('vue de suivi : tâche close depuis 60 jours absente (présente dans la liste complète)', !idsDe(suivi).has(close.id) && idsDe(tout).has(close.id));
  check('vue de suivi : jamais plus que la liste complète', inclus(idsDe(suivi), idsDe(tout)), `${idsDe(suivi).size} ⊆ ${idsDe(tout).size}`);
  const lim = await call('chefssr', 'GET', '/tasks?suivi=true&limite=2');
  check('limite : 2 tâches au plus, échéances les plus proches d’abord', lim.status === 200 && lim.body.length === 2 && (!lim.body[0].dueDate || !lim.body[1].dueDate || lim.body[0].dueDate <= lim.body[1].dueDate));
  for (const [q, lib] of [['limite=0', 'limite nulle'], ['limite=5000', 'limite au-delà de 2000'], ['limite=abc', 'limite non numérique'], ['suivi=oui', 'suivi non booléen'], ['inconnu=1', 'paramètre inconnu']]) {
    expect(`tâches : ${lib} refusée`, await call('chefssr', 'GET', `/tasks?${q}`), 400);
  }

  const assignees = await call('agent1', 'GET', `/tasks?assigneeId=${ids.agent1}`);
  check('« Assignées à moi » : seulement des tâches assignées à l’agent', assignees.status === 200 && assignees.body.length > 0 && assignees.body.every((t) => t.assignees.some((a) => a.userId === ids.agent1)));
  const creees = await call('chefssr', 'GET', `/tasks?createdById=${ids.chefssr}`);
  check('« Créées par moi » : seulement des tâches créées par le chef', creees.status === 200 && creees.body.length >= 3 && creees.body.every((t) => t.createdById === ids.chefssr));
  // Le filtre ne contourne jamais la visibilité : un agent d'une autre division ne voit rien de plus.
  const horsPerimetre = await call('agentdee', 'GET', `/tasks?createdById=${ids.chefssr}`);
  const visibleAgentdee = idsDe(await call('agentdee', 'GET', '/tasks'));
  check('filtre « créées par » d’un autre : jamais hors périmètre', horsPerimetre.status === 200 && inclus(idsDe(horsPerimetre), visibleAgentdee) && !idsDe(horsPerimetre).has(ouverte.id));
  const suiviAgentdee = await call('agentdee', 'GET', '/tasks?suivi=true');
  check('vue de suivi d’un agent d’une autre division : ni la tâche ouverte ni la récente', !idsDe(suiviAgentdee).has(ouverte.id) && !idsDe(suiviAgentdee).has(recente.id));

  console.log('— Tableau de bord des tâches : décompte groupé identique à la liste');
  for (const k of ['chefssr', 'chefdpe', 'agent1', 'dn']) {
    const [dash, liste] = [(await call(k, 'GET', '/tasks/dashboard')).body, (await call(k, 'GET', '/tasks')).body];
    const n = (st) => liste.filter((t) => t.status === st).length;
    check(`${k} : total, en cours, à valider = liste`, dash.total === liste.length && dash.enCours === n('EN_COURS') && dash.enAttenteValidation === n('SOUMISE_VALIDATION'), JSON.stringify(dash));
  }

  // ------------------------------------------------------------------ congés et GED : liste = détail
  console.log('— Congés : droits de la liste (chefs avisants lus une fois) identiques au détail');
  // Demandes propres à la suite (congé annuel et congé maladie, plusieurs demandeurs et unités).
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie']]) if (!types.some((x) => x.code === code)) await call('admin', 'POST', '/leave-types', { code, name });
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const annuel = types.find((t) => t.code === 'CONGE_ANNUEL');
  const maladie = types.find((t) => t.code === 'CONGE_MALADIE') || annuel;
  let n = 0;
  for (const k of ['agent1', 'agent2', 'agentdee', 'agentsaf', 'chefssr']) {
    for (const t of [annuel, maladie]) {
      n++;
      const r = await call(k, 'POST', '/leaves', { leaveTypeId: t.id, startDate: jour(120 + 3 * n), endDate: jour(121 + 3 * n), reason: `Perf ${S} ${n}` });
      if (r.status !== 201) console.log(`   (demande ${k} ${t.code} : ${r.status} ${JSON.stringify(r.body).slice(0, 120)})`);
    }
  }
  for (const k of ['chefssr', 'chefdpe', 'dn', 'drh']) {
    const liste = (await call(k, 'GET', '/leaves')).body;
    let ecarts = 0;
    for (const r of liste.slice(0, 25)) {
      const d = (await call(k, 'GET', `/leaves/${r.id}`, undefined, { 'X-Reauth': '' })).body;
      if (JSON.stringify(r.droits) !== JSON.stringify(d.droits) || (r.leaveType && r.leaveType.code) !== (d.leaveType && d.leaveType.code)) ecarts++;
    }
    check(`${k} : ${Math.min(25, liste.length)} demande(s), droits et type identiques au détail`, liste.length > 0 && ecarts === 0, `${ecarts} écart(s)`);
  }
  console.log('— GED : droit de modifier de la liste (créateurs lus une fois) identique au détail');
  for (const k of ['chefdpe', 'chefssr', 'agent1', 'dn']) {
    const liste = (await call(k, 'GET', '/documents')).body;
    let ecarts = 0;
    for (const d of liste.slice(0, 25)) {
      const un = (await call(k, 'GET', `/documents/${d.id}`)).body;
      if (JSON.stringify(un.droits) !== JSON.stringify(d.droits)) ecarts++;
    }
    check(`${k} : ${Math.min(25, liste.length)} document(s), droits identiques au détail`, ecarts === 0, `${ecarts} écart(s)`);
  }

  // ------------------------------------------------------------------ emails : reprise, lots, quota
  console.log('— Emails : reprise après un refus du serveur d’envoi, lots, quota journalier');
  // Contexte applicatif dans ce processus, avec un serveur d'envoi « configuré » dont l'envoi est simulé
  // (aucune connexion réseau) : en panne, puis rétabli.
  process.env.SMTP_HOST = 'smtp.invalide.test';
  process.env.EMAIL_PAUSE_MS = '0';
  process.env.BREVO_QUOTA_JOUR = '10';
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const email = app.get(require(D + '/communication/notifications/email.service').EmailService);
  const notifications = app.get(require(D + '/communication/notifications/notifications.service').NotificationsService);
  const resume = app.get(require(D + '/communication/notifications/resume-quotidien.service').ResumeQuotidienService);
  const { etatQuotaEmails } = require(D + '/socle/supervision.service');
  const { REPRISE_EMAIL_MS } = require(D + '/communication/notifications/notifications.service');
  let panne = true; let envoyes = [];
  email.transporter.sendMail = async (m) => { if (panne) throw new Error('Serveur d’envoi indisponible (simulé)'); envoyes.push(m.to); return {}; };

  const avant = Date.now();
  await notifications.notify(ids.agent2, 'TACHE_EN_RETARD', `Urgent ${S}`, 'Corps de test', '/tasks', undefined, { urgent: true });
  const ligne = await prisma.notification.findFirst({ where: { userId: ids.agent2, channel: 'EMAIL', title: `Urgent ${S}` } });
  check('email immédiat refusé : remis en file (envoi non marqué)', ligne && !ligne.sentAt && ligne.aEnvoyerLe);
  check('… pour un nouvel essai dans 15 minutes', ligne && Math.abs(new Date(ligne.aEnvoyerLe) - (avant + REPRISE_EMAIL_MS)) < 60e3);
  check('la notification dans l’application est bien là', !!(await prisma.notification.findFirst({ where: { userId: ids.agent2, channel: 'IN_APP', title: `Urgent ${S}` } })));
  check('quota : rien compté tant que rien n’est parti', email.etat().envoisDuJour === 0);

  const r1 = await resume.executer(new Date(Date.now() + 20 * 60e3));
  const l1 = await prisma.notification.findUnique({ where: { id: ligne.id } });
  check('passage du résumé, serveur toujours en panne : échec compté, email remis en file pour une heure', r1.echecs >= 1 && !l1.sentAt && new Date(l1.aEnvoyerLe) > new Date(Date.now() + 50 * 60e3), JSON.stringify(r1));

  panne = false; envoyes = [];
  const agent2 = await prisma.user.findUnique({ where: { id: ids.agent2 }, select: { email: true } });
  const r2 = await resume.executer(new Date(Date.now() + 2 * 3600e3));
  const l2 = await prisma.notification.findUnique({ where: { id: ligne.id } });
  check('serveur rétabli : l’email repart au passage suivant', r2.envoyes >= 1 && !!l2.sentAt && envoyes.includes(agent2.email), JSON.stringify(r2));
  check('quota : les envois réussis sont comptés', email.etat().envoisDuJour === envoyes.length && email.etat().quotaJour === 10);

  // Abandon : un email en attente depuis plus de 72 h n'est plus envoyé (il reste dans la cloche).
  const vieux = await prisma.notification.create({ data: { userId: ids.agent2, type: 'TACHE_ASSIGNEE', channel: 'EMAIL', title: `Ancien ${S}`, body: 'x', createdAt: new Date(Date.now() - 4 * J), aEnvoyerLe: new Date(Date.now() - 2 * J) } });
  envoyes = [];
  const r3 = await resume.executer(new Date());
  const v = await prisma.notification.findUnique({ where: { id: vieux.id } });
  check('email de plus de 72 h : abandonné, jamais envoyé', r3.abandonnes >= 1 && !v.sentAt && !v.aEnvoyerLe && !envoyes.includes(agent2.email), JSON.stringify(r3));

  // Lots : un résumé dû par compte de test actif, lots de 5 avec une pause entre deux lots.
  process.env.EMAIL_LOT = '5'; process.env.EMAIL_PAUSE_MS = '300';
  const comptes = await prisma.user.findMany({ where: { status: 'ACTIF', email: { endsWith: '@test.local' } }, select: { id: true }, take: 25 });
  for (const c of comptes) await prisma.notification.create({ data: { userId: c.id, type: 'TACHE_ASSIGNEE', channel: 'EMAIL', title: `Lot ${S}`, body: 'x', aEnvoyerLe: new Date(Date.now() - 60e3) } });
  envoyes = [];
  const t0 = Date.now();
  const r4 = await resume.executer(new Date());
  check(`lots : ${comptes.length} résumés envoyés, avec une pause entre deux lots de 5`, comptes.length > 5 && r4.envoyes >= comptes.length && Date.now() - t0 >= 300 * Math.floor((comptes.length - 1) / 5), `${r4.envoyes} envoyés en ${Date.now() - t0} ms`);
  delete process.env.EMAIL_LOT; process.env.EMAIL_PAUSE_MS = '0';

  check('quota : nominal sous 80 %', etatQuotaEmails(239, 300).etat === 'NOMINAL');
  check('quota : dégradé à 80 % (alerte avant d’atteindre le quota)', etatQuotaEmails(240, 300).etat === 'DEGRADE' && /bientôt atteint/.test(etatQuotaEmails(240, 300).detail));
  check('quota : indisponible une fois atteint', etatQuotaEmails(300, 300).etat === 'INDISPONIBLE' && /reprendront demain/.test(etatQuotaEmails(300, 300).detail));
  await app.close();

  const sup = await call('admin', 'GET', '/api/v1/supervision');
  const q = sup.status === 200 && (sup.body.services || []).find((s) => s.cle === 'quota-emails');
  check('supervision : « Quota journalier d’emails » affiché à l’administrateur', !!q && q.etat === 'NOMINAL' && /sur 300/.test(q.detail), q ? q.detail : sup.status);
  expect('supervision : refusée à un agent', await call('agent1', 'GET', '/api/v1/supervision'), 403);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
