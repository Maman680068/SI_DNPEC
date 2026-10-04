// Captures d'écran de l'aide en ligne (apps/web/public/aide/*.png), prises sur l'application
// locale après une relance de la suite (données de test FICTIVES uniquement, @test.local).
//   E2E_SANS_BUILD=1 bash tests/e2e/run_all.sh   (ou la suite complète), puis :
//   NODE_PATH=apps/api/node_modules node tests/e2e/outils/captures_aide.js
const path = require('path');
const E = require('../config');
const { browser, loginPage, WEB } = require('../ui/helpers');
const { call } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const DEST = path.join(E.RACINE, 'apps/web/public/aide');
const VUE = { width: 1280, height: 760 };

async function capture(b, compte, url, fichier, attendre) {
  const p = compte ? await loginPage(b, compte, VUE) : await (await b.newContext({ viewport: VUE, locale: 'fr-FR' })).newPage();
  await p.goto(WEB + url);
  if (attendre) await attendre(p);
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(DEST, fichier) });
  console.log('  ✓', fichier);
  await p.context().close();
}

(async () => {
  require('fs').mkdirSync(DEST, { recursive: true });
  // Un gestionnaire logistique pour l'inventaire (habilitation de test).
  if (!(await prisma.habilitationLogistique.findFirst({ where: { user: { email: 'agentsaf@test.local' }, revoqueeAt: null } }))) {
    await call('admin', 'POST', '/logistique/habilitations', { userId: (await prisma.user.findUnique({ where: { email: 'agentsaf@test.local' } })).id });
  }
  const stagiaire = await prisma.user.findFirst({ where: { role: 'STAGIAIRE', status: 'ACTIF', email: { endsWith: '@test.local' }, stagesSuivis: { some: { statut: { not: 'INTERROMPU' }, periodes: { some: {} } } } }, orderBy: { createdAt: 'desc' } });
  // Congés d'agent1 : solde annuel provisionné et une demande en attente d'avis (circuit visible).
  const annuel = await prisma.leaveType.findUnique({ where: { code: 'CONGE_ANNUEL' } });
  if (annuel) {
    const a1 = await prisma.user.findUnique({ where: { email: 'agent1@test.local' } });
    await call('admin', 'PUT', `/leaves/balances/${a1.id}`, { leaveTypeId: annuel.id, year: new Date().getUTCFullYear(), totalDays: 30 });
    if (!(await prisma.leaveRequest.count({ where: { userId: a1.id, status: 'EN_ATTENTE' } }))) {
      const debut = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);
      const fin = new Date(Date.now() + 49 * 864e5).toISOString().slice(0, 10);
      await call('agent1', 'POST', '/leaves', { leaveTypeId: annuel.id, startDate: debut, endDate: fin, reason: 'Congé annuel' });
    }
  }
  // Socle N5 : un plan de travail, un fil et une instruction aux libellés lisibles (section SFP,
  // non utilisée par les suites), pour des captures sans données de test.
  const ids = require(E.etat('ids.json'));
  const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const uSfp = await prisma.uniteOrganisationnelle.findFirst({ where: { sectionId: ids.SFP } });
  const annee = new Date().getUTCFullYear();
  let objectif = await prisma.objectif.findFirst({ where: { uniteId: uSfp.id, libelle: 'Publier les notes de conjoncture de l’année' } });
  if (!objectif) {
    objectif = (await call('chefsfp', 'POST', '/api/v1/plan-travail/objectifs', { annee, uniteId: uSfp.id, libelle: 'Publier les notes de conjoncture de l’année', description: 'Une note par trimestre, validée par la Direction.' })).body;
    const resp = (await call('chefsfp', 'GET', `/api/v1/plan-travail/unites/${uSfp.id}/responsables-possibles`)).body.find((r) => r.id !== ids.chefsfp) || { id: ids.chefsfp };
    const a = (await call('chefsfp', 'POST', `/api/v1/plan-travail/objectifs/${objectif.id}/activites`, { libelle: 'Note de conjoncture du trimestre', responsableId: resp.id, dateDebut: jour(-20), dateFin: jour(20), indicateur: 'Note validée', cible: '1 note' })).body;
    await call('chefsfp', 'POST', `/api/v1/plan-travail/objectifs/${objectif.id}/activites`, { libelle: 'Enquête auprès des entreprises', responsableId: resp.id, dateDebut: jour(5), dateFin: jour(70), indicateur: 'Questionnaires collectés', cible: '120' });
    await call('chefsfp', 'POST', '/tasks', { title: 'Collecte des indicateurs trimestriels', priority: 'NORMAL', dueDate: jour(6), divisionId: ids.DPE, sectionId: ids.SFP, assignees: [{ userId: resp.id }], activiteId: a.id });
  }
  let fil = (await call('agent1', 'GET', '/api/v1/fils')).body.find((f) => f.objet === 'Note de conjoncture — collecte des indicateurs');
  if (!fil) {
    const t = (await call('chefssr', 'POST', '/tasks', { title: 'Tableau des indicateurs trimestriels', priority: 'NORMAL', dueDate: jour(8), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }, { userId: ids.agent2 }] })).body;
    fil = (await call('agent1', 'POST', '/api/v1/fils', { objet: 'Note de conjoncture — collecte des indicateurs', destinataires: [ids.agent2, ids.chefssr], corps: 'Bonjour, voici le tableau à compléter pour la note du trimestre. Merci de renseigner vos séries avant vendredi.', lien: { type: 'TACHE', id: t.id } })).body;
    await call('agent2', 'GET', `/api/v1/fils/${fil.id}`);
    await call('agent2', 'POST', `/api/v1/fils/${fil.id}/messages`, { corps: 'Bien reçu, je complète les séries des prix dès aujourd’hui.' });
  }
  let ins = (await call('dn', 'GET', '/api/v1/instructions')).body.emises.find((i) => i.objet === 'Point mensuel sur l’exécution budgétaire');
  if (!ins) {
    ins = (await call('dn', 'POST', '/api/v1/instructions', { objet: 'Point mensuel sur l’exécution budgétaire', texte: 'Transmettre à la Direction une note de synthèse sur l’exécution budgétaire du mois, avec les principaux écarts.', destinataireId: ids.chefdpe, echeance: jour(10) })).body;
    await call('chefdpe', 'GET', `/api/v1/instructions/${ins.id}`);
    await call('chefdpe', 'POST', `/api/v1/instructions/${ins.id}/prise-en-compte`);
  }
  const b = await browser();
  const titre = (t) => async (p) => p.getByRole('heading', { name: t }).first().waitFor();
  await capture(b, null, '/login', 'connexion.png', async (p) => p.getByLabel('Adresse e-mail').waitFor());
  await capture(b, 'chefdpe', '/dashboard', 'tableau-de-bord.png');
  await capture(b, 'agent1', '/tasks', 'taches.png');
  await capture(b, 'agent1', '/leaves', 'conges.png');
  await capture(b, 'admin', '/leaves?onglet=feries', 'jours-feries.png', async (p) => p.locator('[data-testid=jour-ferie]').first().waitFor());
  await capture(b, 'chefdpe', '/reunions', 'reunions.png');
  await capture(b, 'agent1', '/logistique', 'logistique.png', titre('Logistique'));
  await capture(b, 'agent1', '/personnel', 'dossier.png');
  await capture(b, 'dn', '/courrier', 'courrier.png');
  await capture(b, 'chefssr', '/suppleances', 'suppleances.png');
  await capture(b, 'chefssr', '/logistique?onglet=reservations', 'reservations.png', async (p) => p.getByRole('button', { name: 'Voir les disponibilités' }).waitFor());
  await capture(b, 'drh', '/stages', 'stages.png');
  await capture(b, 'drh', '/documents-generes', 'documents-generes.png', async (p) => p.getByRole('tab', { name: 'Attestations de travail' }).waitFor());
  await capture(b, 'agentsaf', '/logistique?onglet=inventaire', 'inventaire.png', async (p) => p.getByTestId('onglet-biens').waitFor());
  await capture(b, 'admin', '/users', 'utilisateurs.png');
  await capture(b, 'drh', '/organisation', 'organigramme.png', async (p) => p.locator('[data-testid=unite][data-code=DPE]').first().waitFor());
  await capture(b, 'drh', '/agents', 'agents.png', async (p) => p.locator('[data-testid=ligne-agent]').first().waitFor());
  await capture(b, 'admin', '/users', 'roles-fonctionnels.png', async (p) => {
    await p.getByRole('tab', { name: /^Rôles fonctionnels/ }).click();
    await p.locator('[data-testid=attribution]').first().waitFor();
  });
  await capture(b, 'dn', '/parametrage', 'parametres.png', async (p) => p.locator('[data-testid=parametre]').first().waitFor());
  await capture(b, 'admin', '/parametrage?onglet=supervision', 'supervision.png', async (p) => p.locator('[data-testid=service]').first().waitFor());
  await capture(b, 'admin', '/logistique/administration', 'administration.png', titre('Administration de la logistique'));
  await capture(b, 'agent1', '/compte?section=securite', 'securite.png', async (p) => p.getByTestId('session').first().waitFor());
  await capture(b, 'chefsfp', '/plan-travail', 'plan-travail.png', async (p) => {
    await p.getByLabel('Unité').selectOption(uSfp.id);
    await p.locator('[data-testid=objectif]', { hasText: 'Publier les notes de conjoncture' }).waitFor();
  });
  await capture(b, 'agent1', `/communication?fil=${fil.id}`, 'fils.png', async (p) => p.locator('[data-testid=message-fil]').nth(1).waitFor());
  await capture(b, 'agent1', '/recherche?q=trimestriels', 'recherche.png', async (p) => p.locator('[data-testid=categorie-taches] a').first().waitFor());
  await capture(b, 'dn', `/instructions?id=${ins.id}`, 'instructions.png', async (p) => p.locator('[data-testid=fiche-instruction]').waitFor());
  await capture(b, 'drh', '/rh?onglet=effectifs', 'rh-effectifs.png', async (p) => p.locator('[data-testid=effectifs]').waitFor());
  await capture(b, 'drh', '/rh?onglet=carriere', 'rh-carriere.png', async (p) => p.locator('[data-testid=familles-actes]').waitFor());
  await capture(b, 'agentsaf', '/logistique?onglet=vehicules', 'vehicules.png', async (p) => p.locator('[data-testid=vehicule]').first().waitFor());
  if (stagiaire) await capture(b, stagiaire.email.replace('@test.local', ''), '/stages', 'mon-stage.png', async (p) => p.waitForURL('**/stages/**'));
  await b.close(); await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
