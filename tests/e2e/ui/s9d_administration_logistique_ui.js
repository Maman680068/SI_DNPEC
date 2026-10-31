// S9d — administration de la logistique (Chromium) : alerte « aucun gestionnaire actif », compteur
// actifs / inactifs, statut par personne, conseil « au moins deux », circuit dessiné (gestionnaire en rouge si
// personne), catégories en tableau (nature en étiquette, contenu calculé, interrupteur « Validation du chef »,
// menu Renommer / Désactiver, « Afficher les désactivées ») ; téléphone.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-4).toUpperCase();

(async () => {
  const avant = await prisma.habilitationLogistique.findMany({ where: { revoqueeAt: null }, select: { id: true, userId: true } });
  for (const h of avant) await call('admin', 'POST', `/logistique/habilitations/${h.id}/revoquer`);
  const cat = (await call('admin', 'POST', '/logistique/categories', { code: `U${S}`, libelle: `Catégorie écran ${S}`, nature: 'FOURNITURE', validationChefRequise: true })).body;
  const b = await browser();
  const p = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await p.goto(`${WEB}/logistique/administration`);
  await p.getByTestId('alerte-aucun-gestionnaire').waitFor();
  check('alerte « Aucun gestionnaire actif »', /Aucun gestionnaire actif/.test(await p.getByTestId('alerte-aucun-gestionnaire').innerText()));
  const gest = p.locator('[data-testid=etape-circuit]', { hasText: 'Gestionnaire' });
  check('circuit : Demandeur → Chef direct → Gestionnaire « Personne » en rouge', (await p.locator('[data-testid=etape-circuit]').count()) === 3 && /Personne/.test(await gest.innerText()) && /text-clay/.test(await gest.locator('span').getAttribute('class')));
  await p.screenshot({ path: `${E.SHOTS}/s9d_logistique_sans_gestionnaire.png` });

  await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf });
  await p.reload();
  await p.getByTestId('compteur-gestionnaires').waitFor();
  check('un gestionnaire : « 1 actif(s) », statut « Actif », conseil « au moins deux »', /1 actif/.test(await p.getByTestId('compteur-gestionnaires').innerText()) && /Actif/.test(await p.getByTestId('gestionnaire').first().innerText()) && (await p.getByTestId('conseil-deux').count()) === 1 && (await p.getByTestId('alerte-aucun-gestionnaire').count()) === 0);

  const ligne = p.getByTestId('categorie').filter({ hasText: cat.code });
  check('catégorie : nature en étiquette, contenu calculé', /Fournitures/.test(await ligne.innerText()) && /0 demande\(s\) en cours/.test(await ligne.getByTestId('contenu-categorie').innerText()));
  const inter = ligne.getByRole('switch', { name: 'Validation du chef' });
  check('« Validation du chef » en interrupteur, activé', (await inter.getAttribute('aria-checked')) === 'true');
  await inter.click();
  await p.getByTestId('toast').filter({ hasText: 'Sans validation du chef' }).waitFor();
  check('interrupteur : réglage enregistré', !(await prisma.categorieLogistique.findUnique({ where: { id: cat.id } })).validationChefRequise);
  await ligne.getByRole('button', { name: 'Plus d’actions' }).click();
  await p.getByRole('menu').getByRole('menuitem', { name: 'Désactiver' }).click();
  await p.getByTestId('toast').filter({ hasText: 'Catégorie désactivée' }).waitFor();
  await ligne.waitFor({ state: 'detached' });
  check('désactivée : masquée par défaut', (await ligne.count()) === 0);
  await p.getByTestId('voir-desactivees').click();
  await ligne.waitFor();
  check('« Afficher les désactivées » : la catégorie revient, marquée « Désactivée »', /Désactivée/.test(await ligne.innerText()));
  check('parc de véhicules indiqué sous les catégories', /en mission/.test(await p.getByTestId('parc-vehicules').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/s9d_logistique_bureau.png`, fullPage: true });

  const m = await loginPage(b, 'admin', { width: 390, height: 844 });
  await m.goto(`${WEB}/logistique/administration`);
  await m.getByTestId('categorie').first().waitFor();
  check('390 px : sans défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);

  // Situation de départ rétablie.
  const h = await prisma.habilitationLogistique.findFirst({ where: { userId: ids.agentsaf, revoqueeAt: null } });
  if (!avant.some((x) => x.userId === ids.agentsaf)) await call('admin', 'POST', `/logistique/habilitations/${h.id}/revoquer`);
  for (const x of avant.filter((y) => y.userId !== ids.agentsaf)) await call('admin', 'POST', '/logistique/habilitations', { userId: x.userId });
  await b.close();
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch(async (e) => { console.error(e); process.exit(2); });
