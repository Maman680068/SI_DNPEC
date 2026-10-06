// N2 — sécurité, journal inaltérable, paramétrage, supervision : réauthentification avant le niveau 2
// du dossier du personnel (preuve liée au compte, code exigé si 2FA, jamais un « refus »), journal
// d'audit scellé et chaîné (écriture seule en base, altération détectée, portée de lecture selon
// l'annexe 1), journal des connexions et purge, paramètres bornés et branchés (mot de passe, alerte
// de fin prévue, expiration de session), supervision (services, alerte une fois par changement,
// sonde publique), aucun compte sans agent en base.
const { NestFactory } = require('@nestjs/core');
const { authenticator } = require('otplib');
const E = require('../config');
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const D = E.API_DIST;
const API = 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const JOUR = 864e5;
const SANS = { 'X-Reauth': '' };
const brut = async (method, path, body, headers = {}) => {
  const r = await fetch(API + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};
async function code(secret) {
  const reste = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (reste <= 2) await new Promise((r) => setTimeout(r, (reste + 0.5) * 1000));
  return authenticator.generate(secret);
}

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const journal = app.get(require(D + '/socle/journal-audit.service').JournalAuditService);
  const connexions = app.get(require(D + '/socle/journal-connexions.service').JournalConnexionsService);
  const supervision = app.get(require(D + '/socle/supervision.service').SupervisionService);
  const fins = app.get(require(D + '/socle/agents.service').AgentsService);
  const a1 = ids.agent1;

  console.log('— Réauthentification avant le niveau 2 du dossier du personnel');
  const verrou = await call('agent1', 'GET', `/personnel-files/${a1}`, undefined, SANS);
  check('sans preuve : niveau 1 transmis, niveau 2 verrouillé (rien de sensible)', verrou.status === 200 && verrou.body.niveau2Verrouille === true && verrou.body.sensitive === null && verrou.body.diplomas.length === 0 && verrou.body.droits.niveau2 === true);
  const refusAvant = await prisma.accesRefuse.count();
  const sansPreuve = await call('agent1', 'PATCH', `/personnel-files/${a1}/sensitive`, { personalPhone: '000' }, SANS);
  check('action sur le niveau 2 sans preuve → 403 « REAUTH_REQUISE »', sansPreuve.status === 403 && sansPreuve.body.code === 'REAUTH_REQUISE');
  check('… une réauthentification demandée n’est pas journalisée comme un refus', (await prisma.accesRefuse.count()) === refusAvant);
  const dn = await call('dn', 'GET', `/personnel-files/${a1}`, undefined, SANS);
  check('DN : niveau 1 seulement, sans proposition de déverrouillage (besoin d’en connaître)', dn.status === 200 && dn.body.niveau2Verrouille === false && dn.body.droits.niveau2 === false);
  expect('mot de passe faux (la session reste valide)', await call('agent1', 'POST', '/api/v1/reauthentification', { motDePasse: 'mauvais' }), 400);
  expect('sans mot de passe', await call('agent1', 'POST', '/api/v1/reauthentification', {}), 400);
  const r = await call('agent1', 'POST', '/api/v1/reauthentification', { motDePasse: 'Password123!' });
  check('mot de passe juste : preuve valable 10 minutes', r.status === 200 && typeof r.body.preuve === 'string' && Math.abs(new Date(r.body.expireLe) - Date.now() - 10 * 60e3) < 60e3);
  const auditAvant = await prisma.auditLog.count({ where: { entityType: 'DossierPersonnel', metadata: { path: ['event'], equals: 'acces_objet_protege' } } });
  const ouvert = await call('agent1', 'GET', `/personnel-files/${a1}`, undefined, { 'X-Reauth': r.body.preuve });
  check('avec la preuve : niveau 2 transmis', ouvert.status === 200 && ouvert.body.niveau2Verrouille === false && ouvert.body.sensitive !== null);
  check('… consultation d’un objet protégé tracée au journal d’audit', (await prisma.auditLog.count({ where: { entityType: 'DossierPersonnel', metadata: { path: ['event'], equals: 'acces_objet_protege' } } })) === auditAvant + 1);
  const autre = await call('agent2', 'GET', `/personnel-files/${ids.agent2}`, undefined, { 'X-Reauth': r.body.preuve });
  check('la preuve d’un autre compte ne vaut rien', autre.body.niveau2Verrouille === true);
  check('preuve falsifiée : sans effet', (await call('agent1', 'GET', `/personnel-files/${a1}`, undefined, { 'X-Reauth': r.body.preuve.slice(0, -4) + 'AAAA' })).body.niveau2Verrouille === true);
  // Compte à double authentification : le code est exigé.
  await login('agentdee'); // session ouverte avant l'activation de la 2FA
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: ids.agentdee }, data: { twoFactorEnabled: true, twoFactorSecret: secret } });
  const sansCode = await call('agentdee', 'POST', '/api/v1/reauthentification', { motDePasse: 'Password123!' });
  check('2FA active : mot de passe seul refusé, code demandé (CODE_2FA_REQUIS)', sansCode.status === 400 && sansCode.body.code === 'CODE_2FA_REQUIS');
  check('… avec le code : preuve', (await call('agentdee', 'POST', '/api/v1/reauthentification', { motDePasse: 'Password123!', code: await code(secret) })).status === 200);
  await prisma.user.update({ where: { id: ids.agentdee }, data: { twoFactorEnabled: false, twoFactorSecret: null } });

  console.log('— Journal d’audit : scellé, chaîné, en écriture seule');
  await journal.sceller(0);
  const etat = await call('admin', 'GET', '/api/v1/journal-audit/verification');
  check(`chaîne intacte (${etat.body.lignesVerifiees} entrées scellées)`, etat.status === 200 && etat.body.intacte === true && etat.body.lignesVerifiees > 0 && etat.body.nonScellees === 0);
  expect('vérification réservée à l’administrateur (DN)', await call('dn', 'GET', '/api/v1/journal-audit/verification'), 403);
  const cible = await prisma.auditLog.findFirst({ orderBy: { numero: 'asc' } });
  const essai = async (sql) => prisma.$executeRawUnsafe(sql).then(() => 'accepté', (e) => (/écriture seule/.test(e.message) ? 'refusé' : e.message));
  check('modification d’une entrée refusée par la base (administrateur compris)', (await essai(`UPDATE audit_logs SET "entityId" = 'x' WHERE id = '${cible.id}'`)) === 'refusé');
  check('suppression refusée', (await essai(`DELETE FROM audit_logs WHERE id = '${cible.id}'`)) === 'refusé');
  check('vidage refusé', (await essai('TRUNCATE audit_logs')) === 'refusé');
  check('re-scellement d’une entrée scellée refusé', (await essai(`UPDATE audit_logs SET empreinte = 'x' WHERE id = '${cible.id}'`)) === 'refusé');
  // Altération hors application (déclencheur désactivé par un propriétaire de la base) : détectée.
  let detectee = null;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER audit_ecriture_seule');
    await tx.$executeRawUnsafe(`UPDATE audit_logs SET "entityId" = 'falsifie' WHERE id = '${cible.id}'`);
    detectee = (await tx.$queryRawUnsafe('SELECT * FROM audit_verifier()'))[0];
    throw new Error('annulation volontaire');
  }).catch(() => undefined);
  check(`altération directe en base détectée (chaîne rompue à l’entrée n° ${detectee && detectee.rangRompu})`, detectee && detectee.rangRompu === cible.rang);
  check('… (transaction annulée : journal intact)', (await call('admin', 'GET', '/api/v1/journal-audit/verification')).body.intacte === true);
  // Suppression d'une inscription : l'auteur figé reste, la chaîne aussi.
  const attente = await prisma.user.create({ data: { email: `n2att${S}@test.local`, passwordHash: 'x', firstName: 'En', lastName: `Attente${S}`, role: 'AGENT', status: 'EN_ATTENTE' } });
  const trace = await prisma.auditLog.create({ data: { actorId: attente.id, action: 'CREATION', entityType: 'Test', entityId: S } });
  await journal.sceller(0);
  const rej = await call('admin', 'POST', `/users/${attente.id}/reject`, {});
  check(`l’administrateur rejette l’inscription (compte supprimé) → ${rej.status}`, rej.status >= 200 && rej.status < 300, JSON.stringify(rej.body).slice(0, 200));
  const apresRejet = await prisma.auditLog.findUnique({ where: { id: trace.id } });
  check('… entrée conservée : auteur figé, lien retiré, chaîne intacte', apresRejet.actorId === null && apresRejet.acteurInitial === attente.id && (await call('admin', 'GET', '/api/v1/journal-audit/verification')).body.intacte === true);

  console.log('— Lecture du journal (annexe 1)');
  const tout = await call('admin', 'GET', '/api/v1/journal-audit?taille=200');
  check('administrateur : toute la Direction, droit de vérifier', tout.status === 200 && tout.body.portee === 'Toute la Direction' && tout.body.droits.peutVerifier === true && tout.body.total > 0);
  check('… jamais de métadonnées brutes (aucun contenu d’objet)', tout.body.entrees.every((e) => !('metadata' in e)) && !JSON.stringify(tout.body).includes('Password'));
  check('… libellé lisible (consultation d’un élément protégé)', tout.body.entrees.some((e) => e.libelle === 'Consultation d’un élément protégé'));
  const dnJ = await call('dn', 'GET', '/api/v1/journal-audit');
  check('DN : toute la Direction, sans vérification', dnJ.body.portee === 'Toute la Direction' && dnJ.body.droits.peutVerifier === false);
  const moi = await call('agent1', 'GET', '/api/v1/journal-audit?taille=200');
  check('agent : ses propres actions seulement', moi.body.portee === 'Vos propres actions' && moi.body.entrees.length > 0 && moi.body.entrees.every((e) => e.acteur && e.acteur.id === a1));
  const chef = await call('chefdpe', 'GET', '/api/v1/journal-audit?taille=200');
  check('chef de division : son périmètre (dont agent1), jamais un autre service (agentdee)', chef.body.portee === 'Votre périmètre' && chef.body.entrees.some((e) => e.acteur && e.acteur.id === a1) && !chef.body.entrees.some((e) => e.acteur && e.acteur.id === ids.agentdee));
  const filtre = await call('admin', 'GET', '/api/v1/journal-audit?entityType=DossierPersonnel&action=VALIDATION');
  check('filtres (type d’objet, action)', filtre.body.total > 0 && filtre.body.entrees.every((e) => e.objetType === 'DossierPersonnel' && e.action === 'VALIDATION'));
  expect('filtre invalide', await call('admin', 'GET', '/api/v1/journal-audit?action=INCONNUE'), 400);

  console.log('— Journal des connexions (12 mois glissants)');
  const cxAvant = await prisma.journalConnexion.count({ where: { email: 'agent2@test.local' } });
  const auditCx = await prisma.auditLog.count({ where: { action: 'CONNEXION' } });
  await brut('POST', '/auth/login', { email: 'agent2@test.local', password: 'faux' });
  await brut('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' }, { 'User-Agent': 'Navigateur-N2' });
  const cx = await prisma.journalConnexion.findMany({ where: { email: 'agent2@test.local' }, orderBy: { createdAt: 'desc' }, take: 2 });
  check('échec et réussite journalisés (IP, navigateur)', (await prisma.journalConnexion.count({ where: { email: 'agent2@test.local' } })) === cxAvant + 2 && cx[0].resultat === 'SUCCES' && cx[0].navigateur === 'Navigateur-N2' && cx[1].resultat === 'ECHEC' && !!cx[0].ip);
  check('… plus aucune connexion écrite au journal d’audit (qui ne se purge jamais)', (await prisma.auditLog.count({ where: { action: 'CONNEXION' } })) === auditCx);
  const vieux = await prisma.journalConnexion.create({ data: { email: `vieux${S}@test.local`, resultat: 'SUCCES', createdAt: new Date(Date.now() - 400 * JOUR) } });
  const recent = await prisma.journalConnexion.create({ data: { email: `recent${S}@test.local`, resultat: 'SUCCES', createdAt: new Date(Date.now() - 300 * JOUR) } });
  const p1 = await connexions.purger(new Date());
  check('purge : au-delà de 12 mois supprimé, en deçà conservé', p1.conservationMois === 12 && !(await prisma.journalConnexion.findUnique({ where: { id: vieux.id } })) && !!(await prisma.journalConnexion.findUnique({ where: { id: recent.id } })));

  console.log('— Paramètres (bornés, audités, branchés)');
  const liste = await call('admin', 'GET', '/api/v1/parametres');
  check('administrateur : 8 paramètres (dont le délai d’avis des congés, N3, l’avancement d’échelon, N6, et la relance du service de calcul, B1), modifiables', liste.status === 200 && liste.body.parametres.length === 8 && liste.body.droits.peutModifier === true && liste.body.parametres.find((p) => p.cle === 'motDePasse.longueurMin').valeur === 8);
  check('DN : lecture seule', (await call('dn', 'GET', '/api/v1/parametres')).body.droits.peutModifier === false);
  expect('DN ne modifie pas', await call('dn', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 6 }), 403);
  expect('un agent ne lit pas le paramétrage', await call('agent1', 'GET', '/api/v1/parametres'), 403);
  expect('hors bornes (5 mois)', await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 5 }), 400);
  expect('paramètre inconnu', await call('admin', 'PATCH', '/api/v1/parametres/inconnu', { valeur: 5 }), 400);
  expect('conservation ramenée à 6 mois', await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 6 }), 200);
  await new Promise((res) => setTimeout(res, 5200)); // cache des paramètres (5 s)
  check('… effet immédiat sur la purge (connexion de 10 mois supprimée)', (await connexions.purger(new Date())).conservationMois === 6 && !(await prisma.journalConnexion.findUnique({ where: { id: recent.id } })));
  check('… modification tracée (avant, après)', !!(await prisma.auditLog.findFirst({ where: { entityType: 'Parametre', entityId: 'connexions.conservationMois', metadata: { path: ['apres'], equals: 6 } } })));
  await call('admin', 'PATCH', '/api/v1/parametres/connexions.conservationMois', { valeur: 12 });
  expect('longueur minimale portée à 10', await call('admin', 'PATCH', '/api/v1/parametres/motDePasse.longueurMin', { valeur: 10 }), 200);
  await new Promise((res) => setTimeout(res, 5200)); // cache des paramètres de l'API (5 s)
  expect('… un compte à 9 caractères est refusé', await call('admin', 'POST', '/users', { email: `n2court${S}@test.local`, password: 'Abcdef12!', firstName: 'A', lastName: 'B', role: 'AGENT', divisionId: ids.DPE }), 400);
  const reg = await brut('POST', '/auth/register', { email: `n2reg${S}@test.local`, password: 'Abcdef12!', firstName: 'A', lastName: 'B', declaredRole: 'AGENT', declaredDivisionId: ids.DPE });
  check(`… une demande d’accès aussi → ${reg.status} « ${reg.body.message} »`, reg.status === 400 && /10 caractères/.test(JSON.stringify(reg.body.message)));
  await call('admin', 'PATCH', '/api/v1/parametres/motDePasse.longueurMin', { valeur: 8 });
  // Alerte avant fin prévue : 20 jours.
  await call('admin', 'PATCH', '/api/v1/parametres/finPrevue.alerteJours', { valeur: 20 });
  const cdd = await call('drh', 'POST', '/api/v1/agents', { nom: `Param${S}`, prenoms: 'Alerte', uniteId: (await prisma.uniteOrganisationnelle.findFirst({ where: { code: 'DPE' } })).id, dateFinPrevue: new Date(Date.now() + 60 * JOUR).toISOString().slice(0, 10), natureFinPrevue: 'CONTRAT' });
  await fins.executer(new Date(Date.now() + 40 * JOUR));
  check('alerte de fin prévue avancée à J-20 par le paramètre', !!(await prisma.agent.findUnique({ where: { id: cdd.body.id } })).alerteJ15At);
  await call('admin', 'PATCH', '/api/v1/parametres/finPrevue.alerteJours', { valeur: 15 });
  // Expiration de session après inactivité.
  const cxAgent2 = await brut('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' });
  expect('refresh d’une session active', await brut('POST', '/auth/refresh', { refreshToken: cxAgent2.body.refreshToken }), 200);
  const cx2 = await brut('POST', '/auth/login', { email: 'agent2@test.local', password: 'Password123!' });
  await prisma.userSession.updateMany({ where: { userId: ids.agent2, revokedAt: null }, data: { lastUsedAt: new Date(Date.now() - 31 * JOUR) } });
  const expire = await brut('POST', '/auth/refresh', { refreshToken: cx2.body.refreshToken });
  check('session inactive depuis 31 jours : refusée (reconnexion)', expire.status === 401 && /inactivité/.test(expire.body.message));

  console.log('— Supervision');
  const sup = await call('admin', 'GET', '/api/v1/supervision');
  const svc = Object.fromEntries(sup.body.services.map((x) => [x.cle, x.etat]));
  check('services : base et stockage nominaux, journal d’audit intact', sup.status === 200 && svc.base === 'NOMINAL' && svc.stockage === 'NOMINAL' && svc.audit === 'NOMINAL');
  check('email sans serveur d’envoi (tests) : signalé dégradé', svc.email === 'DEGRADE');
  check('sessions, connexions, refus, comptes à surveiller, sauvegardes', sup.body.sessions.ouvertes > 0 && sup.body.connexions.reussies24h > 0 && Array.isArray(sup.body.accesRefuses.parPeriode['7j']) && Array.isArray(sup.body.comptesASurveiller) && sup.body.sauvegardes.testEnRetard === true);
  check('… aucun objet protégé dans la supervision', !JSON.stringify(sup.body).includes('Rue confidentielle') && !JSON.stringify(sup.body).includes('personalPhone'));
  check('DN : lecture, sans déclaration', (await call('dn', 'GET', '/api/v1/supervision')).body.droits.peutDeclarerTest === false);
  expect('un chef ne lit pas la supervision', await call('chefdpe', 'GET', '/api/v1/supervision'), 403);
  expect('test de restauration dans le futur', await call('admin', 'POST', '/api/v1/supervision/test-restauration', { date: new Date(Date.now() + 5 * JOUR).toISOString().slice(0, 10), resultat: 'REUSSI' }), 400);
  expect('DN ne déclare pas', await call('dn', 'POST', '/api/v1/supervision/test-restauration', { date: new Date().toISOString().slice(0, 10), resultat: 'REUSSI' }), 403);
  expect('l’administrateur déclare un test de restauration réussi', await call('admin', 'POST', '/api/v1/supervision/test-restauration', { date: new Date().toISOString().slice(0, 10), resultat: 'REUSSI', commentaire: 'Restauration sur base de test' }), 201);
  check('… affiché dans la supervision', (await call('admin', 'GET', '/api/v1/supervision')).body.sauvegardes.testEnRetard === false);
  await prisma.parametre.deleteMany({ where: { cle: 'supervision.dernierEtat' } });
  const notifAvant = await prisma.notification.count({ where: { userId: ids.admin, channel: 'IN_APP', title: 'Supervision : service en difficulté' } });
  const s1 = await supervision.surveiller();
  const s2 = await supervision.surveiller();
  check('alerte à l’administrateur une fois par changement d’état (email dégradé)', s1.alertes >= 1 && s1.etats.email === 'DEGRADE' && s2.alertes === 0 && (await prisma.notification.count({ where: { userId: ids.admin, channel: 'IN_APP', title: 'Supervision : service en difficulté' } })) === notifAvant + 1, JSON.stringify(s1));
  const n = await prisma.notification.findFirst({ where: { userId: ids.admin, title: 'Supervision : service en difficulté' }, orderBy: { createdAt: 'desc' } });
  check('… lien vers la supervision', n.link === '/parametrage?onglet=supervision');
  const sonde = await brut('GET', '/health/dependances');
  check('sonde publique des dépendances : états seulement', sonde.status === 200 && sonde.body.services.base === 'NOMINAL' && !JSON.stringify(sonde.body).includes('detail'));

  console.log('— Aucun compte sans agent (en base)');
  const direct = await prisma.user.create({ data: { email: `n2dir${S}@test.local`, passwordHash: 'x', firstName: 'Direct', lastName: `Base${S}`, role: 'AGENT', status: 'ACTIF', divisionId: ids.DPE } });
  const ag = await prisma.agent.findUnique({ where: { id: direct.agentId } });
  check('compte créé hors application : agent créé par la base (matricule provisoire, unité)', !!ag && ag.matriculeProvisoire && /^P-\d{6}$/.test(ag.matricule) && !!ag.uniteId);
  const err = await prisma.$executeRawUnsafe(`ALTER TABLE users DISABLE TRIGGER compte_agent_obligatoire`).then(() => prisma.$executeRawUnsafe(`UPDATE users SET "agentId" = NULL WHERE id = '${direct.id}'`)).then(() => 'accepté', (e) => (/users_compte_avec_agent/.test(e.message) ? 'refusé' : e.message));
  await prisma.$executeRawUnsafe(`ALTER TABLE users ENABLE TRIGGER compte_agent_obligatoire`);
  check('contrainte : un compte actif sans agent est refusé par la base', err === 'refusé');
  const choisi = await call('drh', 'POST', '/api/v1/agents', { nom: `Choisi${S}`, prenoms: 'Agent', uniteId: ag.uniteId });
  const lie = await call('admin', 'POST', '/users', { email: `n2lie${S}@test.local`, password: 'Password123!', firstName: 'Agent', lastName: `Choisi${S}`, role: 'AGENT', divisionId: ids.DPE, agentId: choisi.body.id });
  check('compte créé pour un agent choisi : rattaché à lui, sans agent provisoire en trop', lie.status === 201 && (await prisma.user.findUnique({ where: { id: lie.body.id } })).agentId === choisi.body.id && (await prisma.agent.count({ where: { nom: `Choisi${S}` } })) === 1);
  const mat = await call('admin', 'POST', '/users', { email: `n2mat${S}@test.local`, password: 'Password123!', firstName: 'Avec', lastName: `Matricule${S}`, role: 'AGENT', divisionId: ids.DPE, matricule: `M${S}` });
  const agMat = await prisma.agent.findFirst({ where: { compte: { id: mat.body.id } } });
  check('compte créé avec un matricule : l’agent le porte (non provisoire)', mat.status === 201 && agMat.matricule === `M${S}` && agMat.matriculeProvisoire === false);

  await app.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
