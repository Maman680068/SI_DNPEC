// I — anciens formats de liens (emails et notifications d'avant le Lot B) sous Chromium :
// /messages/with/:id et /announcements/:id, ouverts connecté (adresse tapée, puis clic dans la
// cloche sur une notification restée en base avec l'ancien lien) et non connecté (connexion
// puis retour à la page visée) ; page 404 en français (bureau, mobile, connecté ou non).
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
async function attendre(f, n = 40) { for (let i = 0; i < n; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
async function saisir(page, key) {
  await page.getByLabel('Adresse e-mail').fill(`${key}@test.local`);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: /connecter/i }).click();
}
/** Le texte est affiché quelque part (sur mobile, l'aperçu de la liste des conversations est masqué). */
const affiche = (p, t) => attendre(async () => { for (const l of await p.getByText(t).all()) if (await l.isVisible()) return true; return false; });
const chemin = (p) => { const u = new URL(p.url()); return u.pathname + u.search; };

(async () => {
  // Un message de chefdpe à agent1, une annonce de division reçue par agent1.
  const msg = `Message ancien lien ${S}`;
  await call('chefdpe', 'POST', '/messages', { recipientId: ids.agent1, body: msg });
  const annBody = `Texte de l’annonce ancien lien ${S}`;
  const ann = (await call('chefdpe', 'POST', '/announcements', { title: `Annonce ancien lien ${S}`, body: annBody, scope: 'DIVISION', divisionId: ids.DPE })).body;
  const ancienMessage = `/messages/with/${ids.chefdpe}`;
  const ancienneAnnonce = `/announcements/${ann.id}`;
  const lue = () => prisma.announcementRead.count({ where: { announcementId: ann.id, userId: ids.agent1 } });

  const b = await browser();
  console.log('— Connecté : adresse tapée');
  const p = await loginPage(b, 'agent1');
  await p.goto(WEB + ancienMessage);
  check(`${ancienMessage} → /communication?with=…`, await attendre(async () => chemin(p) === `/communication?with=${ids.chefdpe}`), chemin(p));
  check('la conversation avec l’expéditeur est ouverte (message affiché)', await affiche(p, msg));
  check('pas de page 404', (await p.getByText('Page introuvable').count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/i_ancien_message.png` });
  await p.goto(WEB + ancienneAnnonce);
  check(`${ancienneAnnonce} → /communication?announcementId=…`, await attendre(async () => chemin(p) === `/communication?announcementId=${ann.id}`), chemin(p));
  check('l’annonce est ouverte (texte affiché)', await affiche(p, annBody));
  check('… et marquée lue (la fiche de l’annonce a bien été ouverte)', await attendre(async () => (await lue()) === 1));
  await p.screenshot({ path: `${E.SHOTS}/i_ancienne_annonce.png` });

  console.log('— Connecté : clic dans la cloche sur des notifications restées avec l’ancien lien');
  await call('agent1', 'PATCH', '/notifications/read-all');
  await prisma.notification.createMany({ data: [
    { userId: ids.agent1, type: 'ANNONCE', channel: 'IN_APP', title: `Ancienne notif annonce ${S}`, body: 'Stockée avant le correctif', link: ancienneAnnonce, sentAt: new Date() },
    { userId: ids.agent1, type: 'MESSAGE_DIRECT', channel: 'IN_APP', title: `Ancienne notif message ${S}`, body: 'Stockée avant le correctif', link: ancienMessage, sentAt: new Date(Date.now() + 1000) },
  ] });
  for (const [titre, attendu, preuve] of [
    [`Ancienne notif message ${S}`, `/communication?with=${ids.chefdpe}`, msg],
    [`Ancienne notif annonce ${S}`, `/communication?announcementId=${ann.id}`, annBody],
  ]) {
    await p.goto(`${WEB}/dashboard`);
    await p.getByRole('button', { name: /Notifications/ }).click();
    const panneau = p.getByRole('dialog', { name: 'Notifications' });
    await panneau.locator('[data-testid=notification]').filter({ hasText: titre }).click();
    check(`cloche « ${titre} » → ${attendu}`, await attendre(async () => chemin(p) === attendu), chemin(p));
    check('  … contenu visé affiché', await affiche(p, preuve));
  }
  check('notifications marquées lues au clic', (await prisma.notification.count({ where: { userId: ids.agent1, title: { endsWith: S }, isRead: false } })) === 0);

  console.log('— Non connecté : connexion puis retour à la page visée');
  for (const [ancien, attendu, preuve] of [
    [ancienMessage, `/communication?with=${ids.chefdpe}`, msg],
    [ancienneAnnonce, `/communication?announcementId=${ann.id}`, annBody],
  ]) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' });
    const q = await ctx.newPage();
    await q.goto(WEB + ancien);
    check(`${ancien} sans session → page de connexion`, await q.waitForURL('**/login').then(() => true, () => false), chemin(q));
    await saisir(q, 'agent1');
    check(`  … après connexion → ${attendu}`, await q.waitForURL((u) => u.pathname + u.search === attendu, { timeout: 15000 }).then(() => true, () => false), chemin(q));
    check('  … contenu visé affiché', await affiche(q, preuve));
    await ctx.close();
  }

  console.log('— Page 404 en français');
  await p.goto(`${WEB}/adresse/inconnue-${S}`);
  await p.getByRole('heading', { name: 'Page introuvable' }).waitFor();
  check('connecté : « Page introuvable »', true);
  check('logo DNPEC affiché', await p.locator('img[alt="DNPEC"]').evaluate((i) => i.complete && i.naturalWidth > 0));
  check('aucun texte anglais par défaut', (await p.getByText('This page could not be found').count()) === 0);
  check('titre de l’onglet en français', (await p.title()).includes('Page introuvable'));
  await p.screenshot({ path: `${E.SHOTS}/i_404_bureau.png` });
  await p.getByRole('link', { name: 'Retour au tableau de bord' }).click();
  check('connecté : « Retour au tableau de bord » → /dashboard', await p.waitForURL('**/dashboard').then(() => true, () => false));
  await p.context().close();
  const anonyme = await (await b.newContext({ viewport: { width: 1366, height: 860 }, locale: 'fr-FR' })).newPage();
  await anonyme.goto(`${WEB}/tasks-inconnues/${S}`);
  check('non connecté : même page 404', await anonyme.getByRole('heading', { name: 'Page introuvable' }).waitFor().then(() => true, () => false));
  await anonyme.getByRole('link', { name: 'Retour au tableau de bord' }).click();
  check('non connecté : le bouton ramène à l’accueil public (connexion)', await anonyme.waitForURL(WEB + '/').then(() => true, () => false), chemin(anonyme));
  await anonyme.context().close();

  console.log('— Mobile');
  const m = await loginPage(b, 'agent1', { width: 390, height: 844 });
  await m.goto(`${WEB}/inconnue-${S}`);
  await m.getByRole('heading', { name: 'Page introuvable' }).waitFor();
  check('mobile : 404 sans défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  const bouton = await m.getByRole('link', { name: 'Retour au tableau de bord' }).boundingBox();
  check('mobile : bouton entièrement visible', !!bouton && bouton.x >= 0 && bouton.x + bouton.width <= 390 && bouton.y + bouton.height <= 844);
  await m.screenshot({ path: `${E.SHOTS}/i_404_mobile.png` });
  await m.goto(WEB + ancienMessage);
  check('mobile : ancien lien de message → conversation', await attendre(async () => chemin(m) === `/communication?with=${ids.chefdpe}`) && await affiche(m, msg));

  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
