// Z — démonstration, création (base neuve + paramétrage + jeu de test « réel ») : le script crée
// unités, comptes et contenus ; aucune donnée réelle modifiée (empreinte de la base) ; aucune
// notification vers un compte réel ; aucun email vers le domaine de démonstration (bloqué dans
// EmailService, même avec un SMTP configuré) ; relance sans doublon ; expiration après 14 jours.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const D = require('../demo_outils');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const COMPTES = ['chef.division', 'chef.section.analyses', 'chef.section.syntheses', 'chef.cellule', 'agent.conde', 'agent.barry', 'agent.keita', 'agent.toure', 'agent.sylla', 'assistant', 'stagiaire', 'secretariat', 'logistique'];
const demo = { email: { endsWith: `@${D.DOMAINE}` } };
const compte = async () => ({
  taches: await prisma.task.count({ where: { createdBy: demo } }),
  reunions: await prisma.meeting.count({ where: { createdBy: demo } }),
  conges: await prisma.leaveRequest.count({ where: { user: demo } }),
  annonces: await prisma.announcement.count({ where: { author: demo } }),
  messages: await prisma.directMessage.count({ where: { sender: demo } }),
  documents: await prisma.document.count({ where: { createdBy: demo } }),
  arrivees: await prisma.courrierArrivee.count({ where: { registre: { code: 'TEST-ARR' } } }),
  actes: await prisma.acteCourrier.count({ where: { registre: { code: 'TEST-DEP' } } }),
  biens: await prisma.bien.count({ where: { categorie: { code: 'TST' } } }),
  reservations: await prisma.reservation.count({ where: { titulaire: demo } }),
  comptes: await prisma.user.count({ where: demo }),
});

(async () => {
  const notifReelles = () => prisma.notification.count({ where: { user: { NOT: demo } } });
  const avant = await D.empreinte(prisma);
  fs.writeFileSync(E.etat('demo_empreinte.json'), JSON.stringify(avant));
  const notifAvant = await notifReelles();
  const dnReel = await prisma.user.findFirst({ where: { role: 'DN', status: 'ACTIF' } });

  console.log('— Refus sans mot de passe suffisant');
  const r0 = D.lancerDemo('creer', { DEMO_PASSWORD: 'court' });
  check('mot de passe trop court : refus, rien créé', r0.code === 1 && /trop court/.test(r0.sortie) && (await prisma.user.count({ where: demo })) === 0);
  const rX = D.lancerDemo('inconnu');
  check('mode inconnu : refus', rX.code === 1 && /Mode attendu/.test(rX.sortie));

  console.log('— Création');
  const r1 = D.lancerDemo('creer');
  fs.writeFileSync(E.tmp('demo_creer.txt'), r1.sortie);
  check('script terminé sans erreur', r1.code === 0 && !/ÉCHEC/.test(r1.sortie), r1.code !== 0 ? r1.sortie.slice(-600) : '');
  check('vue Direction : le DN réel est indiqué, aucun DN de démonstration', r1.sortie.includes(`Vue Direction : compte RÉEL ${dnReel.email} (DN)`) && (await prisma.user.count({ where: { ...demo, role: { in: ['DN', 'DNA'] } } })) === 0);
  check('journal : ce qui a été créé', /CRÉÉ :/.test(r1.sortie) && /Bilan : \d+ créé\(s\)/.test(r1.sortie));

  const division = await prisma.division.findUnique({ where: { code: 'TESTDEMO' }, include: { sections: true } });
  const cellule = await prisma.cellule.findUnique({ where: { code: 'TESTCEL' } });
  check('unités « TEST — Division Démo » (2 sections) et « TEST — Cellule Démo »', division?.name === 'TEST — Division Démo' && division.sections.length === 2 && division.sections.every((s) => s.name.startsWith('TEST — ')) && cellule?.name === 'TEST — Cellule Démo');
  const comptes = await prisma.user.findMany({ where: demo });
  check(`13 comptes connectables, actifs, préfixés « TEST — » (${comptes.length} au total avec le compte technique)`, COMPTES.every((c) => comptes.find((u) => u.email === D.email(c))?.status === 'ACTIF') && comptes.every((u) => u.firstName.startsWith('TEST — ')));
  check('compte technique (DRH) suspendu : jamais connectable', comptes.find((u) => u.email === D.email('systeme'))?.status === 'SUSPENDU');
  check('aucun administrateur système de démonstration', !comptes.some((u) => u.role === 'ADMIN_SYSTEME'));
  check('chef de la cellule de démonstration', cellule.chefId === comptes.find((u) => u.email === D.email('chef.cellule')).id);
  const agentsDemo = await prisma.agent.findMany({ where: { compte: { is: demo } }, select: { statut: true, nom: true, unite: { select: { libelle: true } } } });
  check(`socle : un agent par compte de démonstration (${agentsDemo.length}), rattaché à son unité`, agentsDemo.length === comptes.length && agentsDemo.filter((a) => a.statut === 'EN_ACTIVITE').length === 13);
  check('socle : unités de démonstration à l’organigramme', (await prisma.uniteOrganisationnelle.count({ where: { libelle: { startsWith: 'TEST — ' } } })) === 4);
  const n = await compte();
  console.log('   ', JSON.stringify(n));
  check('≈ 25 tâches et plus', n.taches >= 25);
  const statuts = new Set((await prisma.task.findMany({ where: { createdBy: demo }, select: { status: true } })).map((t) => t.status));
  check(`tâches dans tous les statuts utiles (${[...statuts].join(', ')})`, ['A_FAIRE', 'EN_COURS', 'SOUMISE_VALIDATION', 'TERMINEE'].every((s) => statuts.has(s)));
  check('tâches en retard', (await prisma.task.count({ where: { createdBy: demo, dueDate: { lt: new Date() }, status: { notIn: ['TERMINEE', 'VALIDEE'] } } })) >= 2);
  check('sous-tâches et commentaires', (await prisma.task.count({ where: { createdBy: demo, parentTaskId: { not: null } } })) === 3 && (await prisma.taskComment.count({ where: { author: demo } })) >= 4);
  check('tâche rejetée avec motif (retour en cours, motif conservé)', (await prisma.task.count({ where: { createdBy: demo, validationComment: { contains: 'taux de change' }, status: 'EN_COURS' } })) === 1 && (await prisma.taskComment.count({ where: { author: demo, body: { startsWith: 'Rejet : ' } } })) === 1);
  check('tâche diffusée à toute la division', (await prisma.task.count({ where: { title: 'TEST — Mise à jour des fiches de poste' } })) >= 5);
  check('4 réunions dont une passée avec compte rendu et décisions', n.reunions === 4 && (await prisma.meeting.count({ where: { createdBy: demo, startAt: { lt: new Date() }, minutesText: { not: null } } })) === 1 && (await prisma.decision.count({ where: { meeting: { createdBy: demo } } })) === 2);
  check('décision convertie en tâche', (await prisma.task.count({ where: { sourceDecisionId: { not: null }, createdBy: demo } })) === 1);
  check('réunion ouverte, et salle réservée pour le séminaire', (await prisma.meeting.count({ where: { createdBy: demo, isOpen: true } })) === 1 && (await prisma.reservation.count({ where: { meeting: { createdBy: demo } } })) === 1);
  check('congés (5), dont un congé maladie', n.conges === 5 && (await prisma.leaveRequest.count({ where: { user: demo, leaveType: { code: 'CONGE_MALADIE' } } })) === 1);
  check('2 annonces, 1 sondage avec 6 votes', n.annonces === 2 && (await prisma.pollVote.count({ where: { poll: { author: demo } } })) === 6);
  check('2 suggestions, dont une anonyme', (await prisma.suggestion.count({ where: { content: { startsWith: 'TEST — ' } } })) === 2 && (await prisma.suggestion.count({ where: { content: { startsWith: 'TEST — ' }, isAnonymous: true } })) === 1);
  check('documents GED (3, dont un publié), fichier livré avec l’application', n.documents === 3 && (await prisma.document.count({ where: { createdBy: demo, visibility: 'PUBLIE_DNPEC' } })) === 1 && (await prisma.documentVersion.count({ where: { uploadedBy: demo, fileKey: 'integre:demo-document-dnpec.pdf' } })) === 3);
  check('messages', n.messages === 5);
  check('suppléance en cours', (await prisma.suppleance.count({ where: { titulaire: demo, revokedAt: null, startDate: { lte: new Date() } } })) === 1);
  check('dossiers du personnel partiels', (await prisma.personnelFileBasic.count({ where: { user: demo } })) === 4);
  const arr = await prisma.courrierArrivee.findMany({ where: { registre: { code: 'TEST-ARR' } }, include: { imputations: true } });
  check('courrier : 4 arrivées dans TEST-ARR, 3 imputées', arr.length === 4 && arr.filter((a) => a.imputations.length).length === 3);
  const actes = await prisma.acteCourrier.findMany({ where: { registre: { code: 'TEST-DEP' } } });
  check('un acte en visa, un acte signé numéroté (registre TEST)', actes.some((a) => a.statut === 'EN_VISA') && actes.some((a) => a.numero && /TEST/.test(a.numero) && ['SIGNE', 'EXPEDIE'].includes(a.statut)));
  check('aucun courrier dans les vrais registres', (await prisma.courrierArrivee.count({ where: { enregistrePar: demo, registre: { code: { notIn: ['TEST-ARR'] } } } })) === 0 && (await prisma.acteCourrier.count({ where: { redacteur: demo, registre: { code: { notIn: ['TEST-DEP'] } } } })) === 0);
  check('secrétariat habilité aux seuls registres TEST', (await prisma.habilitationCourrier.findMany({ where: { user: demo }, include: { registre: true } })).every((h) => h.registre.code.startsWith('TEST-')));
  const stage = await prisma.stage.findFirst({ where: { stagiaire: demo }, include: { periodes: { include: { evaluation: true } } } });
  check('stage : 2 périodes, évaluation visée', stage?.periodes.length === 2 && stage.periodes.some((p) => p.evaluation?.statut === 'VISEE'));
  check('logistique : 3 biens inventoriés (catégorie TST), demandes, réservations', n.biens === 3 && (await prisma.demandeLogistique.count({ where: { demandeur: demo } })) === 3 && n.reservations >= 2);
  check('numérotation d’inventaire propre à la démonstration (TST-…)', (await prisma.bien.findMany({ where: { categorie: { code: 'TST' } } })).every((b) => b.numeroInventaire.startsWith('TST-')));

  console.log('— Données réelles intactes');
  const apres = await D.empreinte(prisma);
  const disparues = D.lignesDisparues(avant, apres);
  check('aucune ligne réelle modifiée ni supprimée (empreinte de toute la base)', disparues.length === 0, disparues.join(', '));
  check('aucune notification vers un compte réel', (await notifReelles()) === notifAvant);
  check('les démos notifient les comptes de démonstration (cloche remplie)', (await prisma.notification.count({ where: { user: demo } })) > 20);

  console.log('— Connexions');
  for (const c of COMPTES) {
    const r = await D.connexion(D.email(c));
    check(`connexion ${D.email(c)}`, r.status === 200 && !!r.token);
  }
  check('compte technique : connexion refusée', (await D.connexion(D.email('systeme'))).status >= 400);

  console.log('— Aucun email vers le domaine de démonstration');
  const journal = path.join(E.OUT, 'logs', 'api-normal.log');
  const r = await fetch('http://localhost:3000/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: D.email('agent.conde') }) });
  await new Promise((x) => setTimeout(x, 400));
  const j = fs.readFileSync(journal, 'utf8');
  check('« mot de passe oublié » d’un compte de démonstration : aucun envoi, journalisé', r.status === 200 && j.includes(`Email non envoyé (compte de démonstration) — destinataire=${D.email('agent.conde')}`) && !j.includes(`Email non envoyé (SMTP non configuré) — destinataire=${D.email('agent.conde')}`));
  // Avec un SMTP configuré mais injoignable : un envoi réel échouerait (500) ; le domaine de démonstration n'est jamais tenté.
  const sortie = fs.openSync(path.join(E.OUT, 'logs', 'api-demo-smtp.log'), 'w');
  const proc = spawn('node', ['dist/main.js'], { cwd: E.API_DIR, env: { ...process.env, PORT: '3002', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1' }, stdio: ['ignore', sortie, sortie] });
  try {
    let pret = false;
    for (let i = 0; i < 60 && !pret; i++) { await new Promise((x) => setTimeout(x, 1000)); pret = await fetch('http://localhost:3002/health').then((x) => x.ok, () => false); }
    const oubli = (adresse) => fetch('http://localhost:3002/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adresse }) }).then((x) => x.status);
    check('SMTP configuré : le domaine de démonstration n’est jamais tenté (200)', pret && (await oubli(D.email('agent.barry'))) === 200);
    check('témoin : un compte réel, lui, déclenche un envoi (qui échoue ici)', (await oubli('agent1@test.local')) >= 500);
    for (const c of COMPTES) await oubli(D.email(c));
    const jj = fs.readFileSync(path.join(E.OUT, 'logs', 'api-demo-smtp.log'), 'utf8');
    check('13 comptes de démonstration : 0 tentative d’envoi', COMPTES.every((c) => jj.includes(`destinataire=${D.email(c)}`)) && !COMPTES.some((c) => new RegExp(`ECONNREFUSED[^\\n]*${D.email(c)}`).test(jj)));
  } finally {
    proc.kill();
  }

  console.log('— Relance : aucun doublon');
  const avantRelance = await compte();
  const r2 = D.lancerDemo('creer');
  check('relance sans erreur, rien de créé', r2.code === 0 && /Bilan : 0 créé\(s\)/.test(r2.sortie), r2.sortie.slice(-300));
  check('mêmes volumes après relance', JSON.stringify(await compte()) === JSON.stringify(avantRelance));
  check('toujours aucune ligne réelle modifiée', D.lignesDisparues(avant, await D.empreinte(prisma)).length === 0);

  console.log('— Expiration après 14 jours');
  const reelsActifs = await prisma.user.count({ where: { NOT: demo, status: 'ACTIF' } });
  // Journal d'audit inaltérable (socle N2) : on n'antidate plus la création de la démonstration ;
  // on démarre l'API avec l'horloge avancée d'un an (port 3001), dont le démarrage fait l'expiration.
  await new Promise((resolve, reject) => spawn('bash', [path.join(E.RACINE, 'tests/e2e/scripts/api.sh'), 'annee'], { stdio: 'ignore' }).on('exit', (c) => (c === 0 ? resolve() : reject(new Error('api.sh')))));
  check('au démarrage de l’API : comptes de démonstration suspendus', (await prisma.user.count({ where: { ...demo, status: 'ACTIF' } })) === 0);
  check('connexion refusée après expiration', (await D.connexion(D.email('chef.division'))).status >= 400);
  check('comptes réels intacts (tous encore actifs, connexion possible)', (await prisma.user.count({ where: { NOT: demo, status: 'ACTIF' } })) === reelsActifs && (await D.connexion('agent1@test.local', 'Password123!')).status === 200);
  const r3 = D.lancerDemo('creer');
  check('nouveau passage « creer » : comptes réactivés pour 14 jours', r3.code === 0 && /réactivé/.test(r3.sortie) && (await D.connexion(D.email('chef.division'))).status === 200);
  check('réactivation : toujours aucun doublon', JSON.stringify(await compte()) === JSON.stringify(avantRelance));

  await prisma.$disconnect();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
