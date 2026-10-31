// S9d — administration de la logistique en une lecture (GET /logistique/administration, administrateur) :
// gestionnaires actifs / inactifs et conseil « au moins deux », alerte et notification de l'administrateur
// quand plus aucun gestionnaire n'est actif, circuit d'une demande, contenu calculé de chaque catégorie
// (biens hors réforme, demandes en cours, articles sous le seuil), parc de véhicules. Droits inchangés.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const URL = '/logistique/administration';
const vue = async () => (await call('admin', 'GET', URL)).body;

(async () => {
  console.log('— Droits');
  for (const k of ['dn', 'dna', 'drh', 'agent1', 'agentsaf']) expect(`${k} : refusé`, await call(k, 'GET', URL), 403);
  expect('administrateur : vue lue', await call('admin', 'GET', URL), 200);

  console.log('— Aucun gestionnaire actif : alerte et notification');
  const avant = await prisma.habilitationLogistique.findMany({ where: { revoqueeAt: null }, select: { userId: true } });
  const t0 = new Date();
  for (const h of await prisma.habilitationLogistique.findMany({ where: { revoqueeAt: null } })) await call('admin', 'POST', `/logistique/habilitations/${h.id}/revoquer`);
  let v = await vue();
  check('alerte « aucun gestionnaire », circuit : gestionnaire indisponible', v.alerteAucun === true && v.circuit.gestionnaireDisponible === false && v.gestionnaires.actifs === 0);
  const n = await prisma.notification.findMany({ where: { userId: ids.admin, createdAt: { gte: t0 }, title: 'Logistique : aucun gestionnaire actif' } });
  check('administrateur prévenu (notification et e-mail immédiat, lien vers l’administration)', n.some((x) => x.channel === 'IN_APP' && x.link === '/logistique/administration') && n.some((x) => x.channel === 'EMAIL' && !!x.sentAt));

  console.log('— Gestionnaires : compteurs, statut, conseil');
  expect('habiliter agentsaf', await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf }), 201);
  const t1 = new Date();
  v = await vue();
  check('un seul gestionnaire actif : conseil « au moins deux »', v.gestionnaires.actifs === 1 && v.gestionnaires.conseilDeux === true && !v.alerteAucun && v.circuit.gestionnaireDisponible);
  expect('habiliter agent2', await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agent2 }), 201);
  v = await vue();
  check('deux gestionnaires actifs : plus de conseil', v.gestionnaires.actifs === 2 && v.gestionnaires.conseilDeux === false);
  await prisma.user.update({ where: { id: ids.agent2 }, data: { status: 'SUSPENDU' } });
  v = await vue();
  check('compte suspendu : compté inactif, statut sur la ligne', v.gestionnaires.actifs === 1 && v.gestionnaires.inactifs === 1 && v.gestionnaires.liste.find((g) => g.userId === ids.agent2).actif === false);
  await prisma.user.update({ where: { id: ids.agent2 }, data: { status: 'ACTIF' } });
  // Situation de départ rétablie (agent2 retiré s'il ne l'était pas avant).
  if (!avant.some((h) => h.userId === ids.agent2)) {
    const h2 = await prisma.habilitationLogistique.findFirst({ where: { userId: ids.agent2, revoqueeAt: null } });
    await call('admin', 'POST', `/logistique/habilitations/${h2.id}/revoquer`);
  }
  for (const h of avant.filter((x) => x.userId !== ids.agentsaf && x.userId !== ids.agent2)) await call('admin', 'POST', '/logistique/habilitations', { userId: h.userId });
  if (!avant.some((h) => h.userId === ids.agentsaf)) {
    const hs = await prisma.habilitationLogistique.findFirst({ where: { userId: ids.agentsaf, revoqueeAt: null } });
    await call('admin', 'POST', `/logistique/habilitations/${hs.id}/revoquer`);
  }
  check('aucune notification « aucun gestionnaire » tant qu’il en reste un', (await prisma.notification.count({ where: { userId: ids.admin, createdAt: { gte: t1 }, title: 'Logistique : aucun gestionnaire actif' } })) === 0);

  console.log('— Catégories : contenu calculé ; circuit');
  v = await vue();
  const cats = await prisma.categorieLogistique.findMany();
  let juste = true;
  for (const c of cats) {
    const l = v.categories.find((x) => x.id === c.id);
    const biens = await prisma.bien.count({ where: { categorieId: c.id, etat: { not: 'REFORME' } } });
    const dem = await prisma.demandeLogistique.count({ where: { categorieId: c.id, statut: { in: ['A_VALIDER', 'A_TRAITER', 'EN_TRAITEMENT'] } } });
    const arts = (await prisma.articleFourniture.findMany({ where: { categorieId: c.id, actif: true, suiviStock: true, seuilAlerte: { not: null } } })).filter((a) => a.stock <= a.seuilAlerte).length;
    if (!l || l.contenu.biens !== biens || l.contenu.demandesEnCours !== dem || l.contenu.articlesSousSeuil !== arts || l.validationChefRequise !== c.validationChefRequise) juste = false;
  }
  check(`contenu des ${cats.length} catégories = comptages en base`, juste);
  check('circuit : catégories actives avec et sans validation du chef', v.circuit.avecValidation === cats.filter((c) => c.actif && c.validationChefRequise).length && v.circuit.sansValidation === cats.filter((c) => c.actif && !c.validationChefRequise).length);
  const parc = await prisma.vehicule.count({ where: { actif: true, etat: 'EN_SERVICE' } });
  check(`véhicules en service : ${parc}`, v.vehicules.total === parc && v.vehicules.enMission <= parc);
  check('catégories TST / TSF repérées comme démonstration, les autres non', v.categories.every((c) => c.demonstration === ['TST', 'TSF'].includes(c.code)));

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
