// Performance (octobre 2026) — sous Chromium, bureau (1366) et téléphone (390) : le tableau de bord
// demande la vue de suivi bornée (jamais toute la liste), signale une liste tronquée ; « Mes tâches »
// demande les tâches de la personne seulement, compteurs justes ; la cloche et les messages ne
// sont pas interrogés quand l'onglet est caché.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
/** Requêtes vers l'API dont le chemin commence par `prefixe`, relevées pendant `action`. */
async function requetes(p, prefixe, action) {
  const vues = [];
  const f = (r) => { const u = new URL(r.url()); if (u.port === '3000' && u.pathname.startsWith(prefixe)) vues.push(u.pathname + u.search); };
  p.on('request', f);
  await action();
  p.off('request', f);
  return vues;
}

(async () => {
  const b = await browser();
  const tache = (await call('chefssr', 'POST', '/tasks', { title: `Perf écran ${S}`, priority: 'NORMAL', dueDate: jour(2), divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;

  console.log('— Tableau de bord : vue de suivi bornée');
  let p = await loginPage(b, 'chefssr');
  let vues = await requetes(p, '/tasks', async () => {
    await p.reload();
    await p.getByText(`Perf écran ${S}`).first().waitFor({ timeout: 20000 });
  });
  check('tableau de bord : vue de suivi demandée (suivi, limite 301)', vues.some((u) => /^\/tasks\?.*suivi=true/.test(u) && /limite=301/.test(u)), vues.join(' '));
  check('… jamais la liste complète du périmètre', !vues.some((u) => u === '/tasks' || u === '/tasks?'), vues.join(' '));
  check('mention de la vue de suivi affichée', await p.getByText('Tâches en cours, et tâches terminées depuis moins de 30 jours.').isVisible());
  check('liste non tronquée : pas de mention des 300', (await p.getByText(/Les 300 aux échéances les plus proches/).count()) === 0);
  await p.context().close();

  // Plus de 300 tâches dans le périmètre d'un chef : la liste est tronquée et le dit.
  const lot = Array.from({ length: 305 }, (_, i) => ({ id: `perf-ui-${S}-${i}`, title: `Lot perf ${S} ${i}`, createdById: ids.chefsfp, divisionId: ids.DPE, sectionId: ids.SFP, dueDate: new Date(Date.now() + (i + 1) * 864e5) }));
  await prisma.task.createMany({ data: lot });
  try {
    p = await loginPage(b, 'chefsfp');
    await p.getByText(/Les 300 aux échéances les plus proches sont affichées/).waitFor({ timeout: 20000 });
    check('plus de 300 tâches : liste tronquée et signalée (export Excel pour la liste complète)', await p.getByText(/l'export Excel donne la liste complète/).isVisible());
    await p.context().close();
    p = await loginPage(b, 'chefsfp', TELEPHONE);
    await p.getByText(/Les 300 aux échéances les plus proches/).waitFor({ timeout: 20000 });
    check('téléphone : mention lisible, sans défilement horizontal', await sansDefilementHorizontal(p));
    await p.context().close();
  } finally {
    await prisma.task.deleteMany({ where: { id: { startsWith: `perf-ui-${S}-` } } });
  }

  console.log('— Mes tâches : les tâches de la personne seulement');
  p = await loginPage(b, 'agent1');
  vues = await requetes(p, '/tasks', async () => {
    await p.goto(WEB + '/tasks');
    await p.getByText(`Perf écran ${S}`).first().waitFor({ timeout: 20000 });
  });
  check('« Mes tâches » : assignées à moi et créées par moi demandées séparément', vues.some((u) => u.includes(`assigneeId=${ids.agent1}`)) && vues.some((u) => u.includes(`createdById=${ids.agent1}`)), vues.join(' '));
  check('… jamais la liste complète du périmètre', !vues.some((u) => u === '/tasks' || u === '/tasks?'));
  const nAssignees = (await call('agent1', 'GET', `/tasks?assigneeId=${ids.agent1}`)).body.length;
  const onglet = await p.getByRole('tab', { name: /Assignées à moi/ }).innerText();
  check('compteur « Assignées à moi » = tâches assignées (API)', onglet.includes(String(nAssignees)), `${onglet.trim()} / ${nAssignees}`);
  await p.context().close();

  console.log('— Cloche et messages : pas d’interrogation quand l’onglet est caché');
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' });
  p = await ctx.newPage();
  await p.clock.install();
  await p.goto(WEB + '/login');
  await p.getByLabel('Adresse e-mail').fill('agent1@test.local');
  await p.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await p.getByRole('button', { name: /connecter/i }).click();
  await p.waitForURL('**/dashboard');
  await p.getByText(`Perf écran ${S}`).first().waitFor({ timeout: 20000 });
  const compteurs = (u) => u.filter((x) => /unread-count/.test(x)).length;
  const cache = await requetes(p, '/', async () => {
    await p.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
    await p.clock.runFor(125_000);
    await p.waitForTimeout(500);
  });
  check('onglet caché, 2 minutes : aucun compteur interrogé', compteurs(cache) === 0, cache.join(' '));
  const visible = await requetes(p, '/', async () => {
    await p.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
    await p.clock.runFor(61_000);
    await p.waitForTimeout(1000);
  });
  check('onglet visible : cloche et messages interrogés à la minute', compteurs(visible) >= 2, visible.join(' '));
  await ctx.close();

  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
