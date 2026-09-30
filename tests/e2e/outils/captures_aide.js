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
  const b = await browser();
  const titre = (t) => async (p) => p.getByRole('heading', { name: t }).first().waitFor();
  await capture(b, null, '/login', 'connexion.png', async (p) => p.getByLabel('Adresse e-mail').waitFor());
  await capture(b, 'chefdpe', '/dashboard', 'tableau-de-bord.png');
  await capture(b, 'agent1', '/tasks', 'taches.png');
  await capture(b, 'agent1', '/leaves', 'conges.png');
  await capture(b, 'chefdpe', '/reunions', 'reunions.png');
  await capture(b, 'agent1', '/logistique', 'logistique.png', titre('Logistique'));
  await capture(b, 'agent1', '/personnel', 'dossier.png');
  await capture(b, 'dn', '/courrier', 'courrier.png');
  await capture(b, 'chefssr', '/suppleances', 'suppleances.png');
  await capture(b, 'chefssr', '/logistique?onglet=reservations', 'reservations.png', async (p) => p.getByRole('button', { name: 'Voir les disponibilités' }).waitFor());
  await capture(b, 'drh', '/stages', 'stages.png');
  await capture(b, 'agentsaf', '/logistique?onglet=inventaire', 'inventaire.png', async (p) => p.getByTestId('onglet-biens').waitFor());
  await capture(b, 'admin', '/users', 'utilisateurs.png');
  await capture(b, 'drh', '/organisation', 'organigramme.png', async (p) => p.locator('[data-testid=unite][data-code=DPE]').first().waitFor());
  await capture(b, 'drh', '/agents', 'agents.png', async (p) => p.locator('tbody tr').first().waitFor());
  await capture(b, 'admin', '/users', 'roles-fonctionnels.png', async (p) => {
    await p.getByRole('button', { name: 'Rôles fonctionnels' }).click();
    await p.locator('[data-testid=attribution]').first().waitFor();
  });
  await capture(b, 'dn', '/parametrage', 'parametres.png', async (p) => p.locator('[data-testid=parametre]').first().waitFor());
  await capture(b, 'admin', '/parametrage?onglet=supervision', 'supervision.png', async (p) => p.locator('[data-testid=service]').first().waitFor());
  await capture(b, 'admin', '/logistique/administration', 'administration.png', titre('Administration de la logistique'));
  await capture(b, 'agent1', '/compte/securite', 'securite.png', titre('Sécurité du compte'));
  if (stagiaire) await capture(b, stagiaire.email.replace('@test.local', ''), '/stages', 'mon-stage.png', async (p) => p.waitForURL('**/stages/**'));
  await b.close(); await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
