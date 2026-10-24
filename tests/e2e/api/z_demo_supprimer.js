// Z — démonstration, suppression : tout ce qui est marqué est retiré ; ce que la base protège
// (courrier numéroté, biens inventoriés, réservations) est annulé, réformé ou désactivé et listé ;
// comptes en SUPPRIME ; aucune donnée réelle modifiée (même empreinte qu'avant la création).
const fs = require('fs');
const E = require('../config');
const { check, bilan } = require('../lib');
const D = require('../demo_outils');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const demo = { email: { endsWith: `@${D.DOMAINE}` } };

(async () => {
  const avant = JSON.parse(fs.readFileSync(E.etat('demo_empreinte.json'), 'utf8'));
  const r = D.lancerDemo('supprimer');
  fs.writeFileSync(E.tmp('demo_supprimer.txt'), r.sortie);
  check('script terminé sans erreur', r.code === 0 && !/ÉCHEC/.test(r.sortie), r.sortie.slice(-500));
  check('journal : SUPPRIMÉ et CONSERVÉ (avec la raison)', /SUPPRIMÉ :/.test(r.sortie) && /CONSERVÉ \(annulé, réformé ou désactivé\) :/.test(r.sortie) && /un courrier numéroté ne se supprime jamais/.test(r.sortie));

  console.log('— Plus rien de démonstration dans les contenus');
  const zero = {
    tâches: await prisma.task.count({ where: { OR: [{ createdBy: demo }, { title: { startsWith: 'TEST — ' } }] } }),
    réunions: await prisma.meeting.count({ where: { OR: [{ createdBy: demo }, { title: { startsWith: 'TEST — ' } }] } }),
    congés: await prisma.leaveRequest.count({ where: { user: demo } }),
    annonces: await prisma.announcement.count({ where: { author: demo } }),
    sondages: await prisma.poll.count({ where: { author: demo } }),
    suggestions: await prisma.suggestion.count({ where: { content: { startsWith: 'TEST — ' } } }),
    messages: await prisma.directMessage.count({ where: { OR: [{ sender: demo }, { recipient: demo }] } }),
    notifications: await prisma.notification.count({ where: { user: demo } }),
    documents: await prisma.document.count({ where: { OR: [{ createdBy: demo }, { title: { startsWith: 'TEST — ' } }] } }),
    suppléances: await prisma.suppleance.count({ where: { OR: [{ titulaire: demo }, { suppleant: demo }] } }),
    dossiers: await prisma.personnelFileBasic.count({ where: { user: demo } }),
    stages: await prisma.stage.count({ where: { stagiaire: demo } }),
    demandes: await prisma.demandeLogistique.count({ where: { demandeur: demo } }),
    habilitations: (await prisma.habilitationCourrier.count({ where: { user: demo } })) + (await prisma.habilitationLogistique.count({ where: { user: demo } })),
    typesCongéTEST: await prisma.leaveType.count({ where: { name: { startsWith: 'TEST — ' } } }),
    objectifsPlan: await prisma.objectif.count({ where: { libelle: { startsWith: 'TEST — ' } } }),
    filsDiscussion: await prisma.filMessages.count({ where: { objet: { startsWith: 'TEST — ' } } }),
    véhiculesTEST: await prisma.vehicule.count({ where: { immatriculation: 'TEST 0001 DM' } }),
    pleinsTEST: await prisma.pleinCarburant.count({ where: { vehicule: { immatriculation: 'TEST 0001 DM' } } }),
    fichesPosteTEST: await prisma.fichePoste.count({ where: { fonction: { startsWith: 'TEST — ' } } }),
    besoinsFormationTEST: await prisma.besoinFormation.count({ where: { intitule: { startsWith: 'TEST — ' } } }),
    sessionsFormationTEST: await prisma.sessionFormation.count({ where: { intitule: { startsWith: 'TEST — ' } } }),
    actesNonNumérotés: await prisma.acteCourrier.count({ where: { registre: { code: 'TEST-DEP' }, numero: null } }),
    modèlesTEST: await prisma.modele.count({ where: { code: 'TEST_DEMONSTRATION' } }),
    rôlesModélisation: await prisma.affectationModelisation.count({ where: { userId: { in: (await prisma.user.findMany({ where: demo, select: { id: true } })).map((x) => x.id) } } }),
  };
  for (const [k, v] of Object.entries(zero)) check(`${k} : 0`, v === 0, `${v}`);

  console.log('— Ce qui reste, et pourquoi');
  check('comptes de démonstration en SUPPRIME (aucun actif)', (await prisma.user.count({ where: demo })) > 0 && (await prisma.user.count({ where: { ...demo, status: { not: 'SUPPRIME' } } })) === 0);
  check('connexion d’un compte de démonstration refusée', (await D.connexion(D.email('chef.division'))).status >= 400);
  check('courrier TEST annulé (jamais supprimé)', (await prisma.courrierArrivee.count({ where: { registre: { code: 'TEST-ARR' }, statut: { not: 'ANNULE' } } })) === 0 && (await prisma.acteCourrier.count({ where: { registre: { code: 'TEST-DEP' }, statut: { not: 'ANNULE' } } })) === 0);
  check('registres TEST désactivés', (await prisma.registreCourrier.count({ where: { code: { startsWith: 'TEST-' }, isActive: true } })) === 0);
  check('biens TST réformés, sans affectation en cours', (await prisma.bien.count({ where: { categorie: { code: 'TST' }, etat: { not: 'REFORME' } } })) === 0 && (await prisma.affectationBien.count({ where: { bien: { categorie: { code: 'TST' } }, fin: null } })) === 0);
  check('réservations de démonstration annulées', (await prisma.reservation.count({ where: { titulaire: demo, statut: { in: ['CONFIRMEE', 'EN_ATTENTE'] } } })) === 0);
  check('catégories, articles, ressources de démonstration désactivés', (await prisma.categorieLogistique.count({ where: { code: { in: ['TST', 'TSF'] }, actif: true } })) === 0 && (await prisma.articleFourniture.count({ where: { id: { startsWith: 'demo-' }, actif: true } })) === 0 && (await prisma.ressourceReservable.count({ where: { id: { startsWith: 'demo-' }, actif: true } })) === 0);
  check('unités de démonstration supprimées (aucun compte réel n’y était rattaché)', (await prisma.division.count({ where: { code: 'TESTDEMO' } })) === 0 && (await prisma.section.count({ where: { name: { startsWith: 'TEST — ' } } })) === 0 && (await prisma.cellule.count({ where: { code: 'TESTCEL' } })) === 0);
  check('socle : unités miroir de démonstration retirées de l’organigramme', (await prisma.uniteOrganisationnelle.count({ where: { libelle: { startsWith: 'TEST — ' } } })) === 0);
  check('socle : agents de démonstration « Parti » (conservés comme les comptes), aucun rôle fonctionnel', (await prisma.agent.count({ where: { compte: { is: demo }, statut: { not: 'PARTI' } } })) === 0 && (await prisma.agent.count({ where: { compte: { is: demo } } })) > 0 && (await prisma.attributionRole.count({ where: { user: demo } })) === 0);

  console.log('— Données réelles');
  const disparues = D.lignesDisparues(avant, await D.empreinte(prisma));
  check('aucune ligne réelle modifiée ni supprimée (même empreinte qu’avant la création)', disparues.length === 0, disparues.join(', '));
  check('les comptes réels se connectent', (await D.connexion('admin@test.local', 'Password123!')).status === 200 && (await D.connexion('dn@test.local', 'Password123!')).status === 200);

  console.log('— Cycle complet : « creer » après « supprimer », puis « supprimer » à nouveau');
  const r3 = D.lancerDemo('creer');
  check('re-création après suppression : sans erreur', r3.code === 0 && !/ÉCHEC/.test(r3.sortie), r3.sortie.slice(-400));
  check('comptes réactivés et rattachés aux unités recréées', (await prisma.user.count({ where: { ...demo, status: 'ACTIF', role: { in: ['AGENT', 'CHEF_SECTION', 'CHEF_DIVISION', 'CHEF_CELLULE'] }, divisionId: null, celluleId: null } })) === 0 && (await prisma.user.count({ where: { ...demo, status: 'ACTIF' } })) === 13);
  check('contenus recréés (tâches, courrier non annulé, stage)', (await prisma.task.count({ where: { createdBy: demo } })) >= 25 && (await prisma.courrierArrivee.count({ where: { registre: { code: 'TEST-ARR' }, statut: { not: 'ANNULE' } } })) === 4 && (await prisma.stage.count({ where: { stagiaire: demo } })) === 1);
  check('socle : agents de démonstration remis en activité, unités de nouveau à l’organigramme', (await prisma.agent.count({ where: { compte: { is: { ...demo, status: 'ACTIF' } }, statut: 'EN_ACTIVITE' } })) === 13 && (await prisma.uniteOrganisationnelle.count({ where: { libelle: { startsWith: 'TEST — ' } } })) === 4);
  const r4 = D.lancerDemo('supprimer');
  check('nouvelle suppression : sans erreur', r4.code === 0 && !/ÉCHEC/.test(r4.sortie), r4.sortie.slice(-400));
  check('toujours aucune ligne réelle modifiée', D.lignesDisparues(avant, await D.empreinte(prisma)).length === 0);

  const r2 = D.lancerDemo('supprimer');
  check('suppression relancée : sans erreur, rien de plus', r2.code === 0 && /Bilan : 0 créé\(s\), 0 déjà présent\(s\), 0 suppression\(s\)/.test(r2.sortie), r2.sortie.slice(-300));

  await prisma.$disconnect();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
