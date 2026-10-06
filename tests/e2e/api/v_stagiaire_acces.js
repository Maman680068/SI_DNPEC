// Lot « Accès des stagiaires » — POST /stages/nouveau-stagiaire : le DRH (et l'administrateur système)
// crée en une opération le compte du stagiaire, toujours au rôle Stagiaire, et son stage ; email
// « Choisir mon mot de passe » ; fin prévue = fin du stage ; trace d'audit ; information des
// administrateurs. Refus : email déjà pris (409), chef / agent / stagiaire (403), aucun autre rôle
// possible par ce chemin (400). Puis la désactivation automatique au lendemain de la fin (job réel).
const fs = require('fs');
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const E = require('../config');
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const JOUR = 864e5;
const JOURNAL = path.join(E.OUT, 'logs', 'api-normal.log');
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const debut = iso(Date.now() + 10 * JOUR);
const fin = iso(Date.now() + 70 * JOUR);
const corps = (x = {}) => ({ prenom: 'Fanta', nom: `Stagiaire${S}`, email: `fanta.${S}@test.local`, telephone: '+224 620 00 00 00', etablissement: 'Université de Conakry', diplomePrepare: 'Master', dateDebut: debut, dateFin: fin, ...x });

async function dernierEmail(email, sujet) {
  for (let i = 0; i < 20; i++) {
    const s = fs.existsSync(JOURNAL) ? fs.readFileSync(JOURNAL, 'utf8') : '';
    const d = s.lastIndexOf(`destinataire=${email}, sujet="${sujet}"`);
    if (d >= 0) { const f = s.indexOf('[Nest]', d + 10); return s.slice(d, f < 0 ? undefined : f); }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const fins = app.get(require(D + '/socle/agents.service').AgentsService);

  console.log('— DRH : compte et stage en une opération');
  const r = await call('drh', 'POST', '/stages/nouveau-stagiaire', corps());
  expect('le DRH crée le stagiaire et son stage', r, 201);
  const email = `fanta.${S}@test.local`;
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, status: true, phone: true, divisionId: true, sectionId: true, celluleId: true, agent: true } });
  check('compte créé au rôle Stagiaire, actif, sans rattachement', u && u.role === 'STAGIAIRE' && u.status === 'ACTIF' && !u.divisionId && !u.sectionId && !u.celluleId);
  check('téléphone enregistré', u?.phone === '+224 620 00 00 00');
  const stage = await prisma.stage.findFirst({ where: { stagiaireId: u.id } });
  check('stage créé pour ce compte, aux dates saisies', stage && iso(stage.dateDebut) === debut && iso(stage.dateFin) === fin && stage.etablissement === 'Université de Conakry');
  check('le DRH reçoit la fiche du stage', r.body.id === stage.id && Array.isArray(r.body.periodes));
  check('agent du stagiaire : fin prévue = fin du stage (nature : stage)', u.agent && iso(u.agent.dateFinPrevue) === fin && u.agent.natureFinPrevue === 'STAGE', JSON.stringify(u.agent && { fin: u.agent.dateFinPrevue, nature: u.agent.natureFinPrevue }));
  const audit = await prisma.auditLog.findFirst({ where: { entityType: 'User', entityId: u.id, action: 'CREATION' } });
  check('journal d’audit : « Compte stagiaire créé par le DRH »', audit && audit.metadata.event === 'compte_stagiaire_cree' && audit.metadata.libelle === 'Compte stagiaire créé par le DRH' && audit.actorId === ids.drh);
  check('journal d’audit : création du stage', !!(await prisma.auditLog.findFirst({ where: { entityType: 'Stage', entityId: stage.id, action: 'CREATION' } })));
  const m = await dernierEmail(email, 'Votre compte SI DNPEC a été créé');
  check('email « Choisir mon mot de passe » envoyé', !!m && /Choisir mon mot de passe : http:\/\/localhost:3100\/reset-password\?token=/.test(m));
  const jeton = await prisma.passwordResetToken.findFirst({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } });
  check('lien valable 7 jours', !!jeton && Math.abs(jeton.expiresAt - Date.now() - 7 * JOUR) < 60e3);
  const info = await prisma.notification.findFirst({ where: { userId: ids.admin, title: 'Compte stagiaire créé par le DRH', body: { contains: email } } });
  check('administrateur informé (aucune action requise)', !!info && /aucune action/.test(info.body) && info.link === '/users');
  check('le stagiaire apparaît dans la liste du DRH', (await call('drh', 'GET', '/stages')).body.stages.some((s) => s.id === stage.id));

  console.log('— Email déjà pris');
  const pris = await call('drh', 'POST', '/stages/nouveau-stagiaire', corps());
  expect('même email', pris, 409);
  check('message clair', pris.body.message === 'Ce compte existe déjà : sélectionnez-le dans la liste.');
  expect('email d’un agent existant (casse différente)', await call('drh', 'POST', '/stages/nouveau-stagiaire', corps({ email: 'AGENT1@test.local' })), 409);
  check('aucun compte en double', (await prisma.user.count({ where: { email: { equals: email, mode: 'insensitive' } } })) === 1);

  console.log('— Aucun autre rôle par ce chemin');
  for (const role of ['AGENT', 'DRH', 'ADMIN_SYSTEME', 'DN']) {
    expect(`champ « role: ${role} » refusé`, await call('drh', 'POST', '/stages/nouveau-stagiaire', corps({ email: `role.${role.toLowerCase()}.${S}@test.local`, role })), 400);
  }
  check('aucun compte créé par ces tentatives', (await prisma.user.count({ where: { email: { startsWith: 'role.', endsWith: `.${S}@test.local` } } })) === 0);
  expect('fin avant le début', await call('drh', 'POST', '/stages/nouveau-stagiaire', corps({ email: `dates.${S}@test.local`, dateDebut: fin, dateFin: debut })), 400);
  check('… et aucun compte créé', !(await prisma.user.findUnique({ where: { email: `dates.${S}@test.local` } })));
  expect('email invalide', await call('drh', 'POST', '/stages/nouveau-stagiaire', corps({ email: 'pas-un-email' })), 400);

  console.log('— Profils refusés');
  for (const k of ['chefssr', 'chefdpe', 'agent1', 'dn']) {
    expect(`${k}`, await call(k, 'POST', '/stages/nouveau-stagiaire', corps({ email: `refus.${k}.${S}@test.local` })), 403);
  }
  // Le compte stagiaire créé plus haut ne peut pas se connecter (mot de passe inconnu) : un stagiaire du jeu de test.
  const stagiaire = await prisma.user.findFirst({ where: { role: 'STAGIAIRE', status: 'ACTIF', email: { endsWith: '@test.local' }, NOT: { email } }, select: { email: true } });
  if (stagiaire) {
    const cle = stagiaire.email.replace('@test.local', '');
    const t = await call(cle, 'POST', '/stages/nouveau-stagiaire', corps({ email: `refus.stagiaire.${S}@test.local` })).catch(() => null);
    if (t) expect('un stagiaire', t, 403);
  }
  check('aucun compte créé par les profils refusés', (await prisma.user.count({ where: { email: { startsWith: 'refus.', endsWith: `.${S}@test.local` } } })) === 0);

  console.log('— Administrateur système');
  const ra = await call('admin', 'POST', '/stages/nouveau-stagiaire', corps({ prenom: 'Ibrahima', email: `ibrahima.${S}@test.local` }));
  expect('l’administrateur crée le stagiaire et son stage', ra, 201);
  check('… il ne reçoit que l’identifiant du stage (pas son contenu)', ra.body.id && !('periodes' in ra.body) && ra.body.stagiaire?.email === `ibrahima.${S}@test.local`);
  const ua = await prisma.user.findUnique({ where: { email: `ibrahima.${S}@test.local` }, select: { id: true, role: true } });
  check('… compte au rôle Stagiaire', ua?.role === 'STAGIAIRE');
  const auditA = await prisma.auditLog.findFirst({ where: { entityType: 'User', entityId: ua.id, action: 'CREATION' } });
  check('… trace « Compte stagiaire créé par l’administrateur système »', auditA?.metadata.libelle === 'Compte stagiaire créé par l’administrateur système' && auditA.actorId === ids.admin);
  check('… le contenu du stage reste fermé à l’administrateur', [403, 404].includes((await call('admin', 'GET', `/stages/${ra.body.id}`)).status));
  check('… le DRH voit ce stage', (await call('drh', 'GET', `/stages/${ra.body.id}`)).status === 200);
  check('réglages : bouton proposé à l’administrateur, pas au DRH (droit renvoyé par l’API)', (await call('admin', 'GET', '/stages/capacites')).body.peutCreerNouveauStagiaire === true && (await call('drh', 'GET', '/stages/capacites')).body.peutCreerNouveauStagiaire === false);

  console.log('— Fin de stage : désactivation automatique inchangée (job réel, date du jour)');
  // Stage terminé hier : le job du jour (comme la tâche planifiée) le traite, sans toucher aux autres comptes.
  const hier = iso(Date.now() - JOUR);
  expect('stage terminé hier, compte créé par le DRH', await call('drh', 'POST', '/stages/nouveau-stagiaire', corps({ prenom: 'Mariama', email: `fin.${S}@test.local`, dateDebut: iso(Date.now() - 40 * JOUR), dateFin: hier })), 201);
  const uf = await prisma.user.findUnique({ where: { email: `fin.${S}@test.local` }, select: { id: true, status: true, agent: { select: { dateFinPrevue: true } } } });
  check('… fin prévue = fin du stage', iso(uf.agent.dateFinPrevue) === hier);
  await fins.executer(new Date());
  const apres = await prisma.user.findUnique({ where: { id: uf.id }, select: { status: true, agent: { select: { statut: true } } } });
  check('lendemain de la fin : agent « Parti » et compte désactivé automatiquement', apres.agent?.statut === 'PARTI' && apres.status !== 'ACTIF', JSON.stringify(apres));
  check('DRH notifié du départ', !!(await prisma.notification.findFirst({ where: { userId: ids.drh, title: { contains: `Mariama Stagiaire${S}` }, body: { contains: 'compte désactivé automatiquement' } } })));
  check('le stagiaire dont le stage continue reste actif', (await prisma.user.findUnique({ where: { id: u.id } })).status === 'ACTIF');

  await app.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
