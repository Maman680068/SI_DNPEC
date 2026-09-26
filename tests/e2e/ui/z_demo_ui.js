// Z — démonstration sous Chromium, après « creer » : chaque écran principal est rempli pour le
// compte qui le présente (captures bureau et mobile), vue Direction avec le DN réel (congé maladie
// masqué), aucun défilement horizontal sur mobile.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const E = require('../config');
const D = require('../demo_outils');
const MOBILE = { width: 390, height: 844 };
const BUREAU = { width: 1366, height: 860 };

async function connecter(b, local, viewport) {
  const ctx = await b.newContext({ viewport, locale: 'fr-FR' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('   [erreur page]', e.message));
  await p.goto(WEB + '/login');
  await p.getByLabel('Adresse e-mail').fill(D.email(local));
  await p.getByLabel('Mot de passe', { exact: true }).fill(D.MDP);
  await p.getByRole('button', { name: /connecter/i }).click();
  await p.waitForURL('**/dashboard');
  return p;
}
const attendreTexte = (p, t) => p.getByText(t).first().waitFor({ timeout: 15000 }).then(() => true, () => false);

// [compte, page, onglet à ouvrir (ou null), texte attendu, nom de capture]
const ECRANS = [
  ['chef.division', '/dashboard', null, 'TEST — Rapport mensuel de conjoncture — août', 'tableau_de_bord_chef_division'],
  ['agent.conde', '/tasks', null, 'TEST — Mise à jour du cadrage macroéconomique 2027', 'mes_taches'],
  ['chef.division', '/reunions', null, 'TEST — Séminaire de validation du cadrage', 'reunions'],
  ['chef.section.syntheses', '/leaves', 'À valider', /Touré/, 'conges_a_valider'],
  ['agent.conde', '/communication', 'Annonces', 'TEST — Séminaire de validation du cadrage', 'annonces'],
  ['agent.conde', '/documents', null, 'TEST — Note sur l’exécution budgétaire', 'documents'],
  ['secretariat', '/courrier', 'Arrivées', 'TEST — Banque centrale — note de politique monétaire', 'courrier_secretariat'],
  ['chef.division', '/courrier', null, 'TEST — Partenaire technique — invitation à un atelier', 'courrier_chef_division'],
  ['chef.division', '/courrier', 'Départs et actes', '0001/TEST/', 'courrier_actes'],
  ['logistique', '/logistique', 'À traiter', 'TEST — Classeurs pour l’archivage des notes', 'logistique_gestionnaire'],
  ['stagiaire', '/stages', null, /Section Analyses/, 'mon_stage'],
  ['chef.section.syntheses', '/suppleances', null, /Camara/, 'suppleances'],
  ['chef.division', '/personnel', null, /Condé/, 'dossier_personnel'],
];

(async () => {
  const b = await browser();
  for (const [vue, taille] of [['bureau', BUREAU], ['mobile', MOBILE]]) {
    console.log(`— Écrans remplis (${vue})`);
    const pages = {};
    for (const [compte, url, onglet, texte, nom] of ECRANS) {
      pages[compte] = pages[compte] || (await connecter(b, compte, taille));
      const p = pages[compte];
      await p.goto(WEB + url);
      if (onglet) await p.getByRole(url === '/courrier' ? 'tab' : 'button', { name: new RegExp(`^${onglet}`) }).first().click();
      const vu = await attendreTexte(p, texte);
      await p.waitForTimeout(300);
      check(`${compte} ${url} : rempli`, vu);
      if (vue === 'mobile') check(`${compte} ${url} : pas de défilement horizontal`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= MOBILE.width + 1);
      await p.screenshot({ path: `${E.SHOTS}/demo_${nom}_${vue}.png`, fullPage: vue === 'bureau' });
    }
    for (const p of Object.values(pages)) await p.context().close();
  }

  console.log('— Cloche remplie pour les comptes de démonstration');
  const a = await connecter(b, 'agent.keita', BUREAU);
  let cloche;
  for (let i = 0; i < 20 && !cloche; i++) {
    cloche = ((await a.locator('body').innerText()).match(/🔔\s*(\d+)/) || [])[1];
    if (!cloche) await a.waitForTimeout(250);
  }
  check(`notifications non lues (${cloche})`, Number(cloche) > 0);
  await a.context().close();

  console.log('— Vue Direction (DN réel)');
  const dn = await loginPage(b, 'dn');
  check('le DN réel voit l’activité de la démonstration sur son tableau de bord', await attendreTexte(dn, 'TEST — Rapport mensuel de conjoncture — août'));
  await dn.screenshot({ path: `${E.SHOTS}/demo_vue_direction_tableau_de_bord.png`, fullPage: true });
  await dn.goto(WEB + '/leaves');
  await dn.getByRole('button', { name: /^À valider/ }).first().click();
  await attendreTexte(dn, /Touré|Barry|Sylla/);
  const texte = await dn.locator('body').innerText();
  const ligne = texte.split('\n').findIndex((l) => l.includes('Touré'));
  const bloc = texte.split('\n').slice(Math.max(0, ligne - 3), ligne + 6).join(' ');
  check('congé maladie de Kadiatou Touré masqué pour la Direction (« motif protégé »)', /motif protégé/i.test(bloc) && !/maladie/i.test(bloc), bloc.slice(0, 160));
  await dn.screenshot({ path: `${E.SHOTS}/demo_vue_direction_conges.png`, fullPage: true });
  await dn.context().close();
  const cs = await connecter(b, 'chef.section.syntheses', BUREAU);
  await cs.goto(WEB + '/leaves');
  await cs.getByRole('button', { name: /^À valider/ }).first().click();
  await attendreTexte(cs, /Touré/);
  check('le chef direct, lui, voit le motif (congé maladie)', /maladie/i.test(await cs.locator('body').innerText()));
  await cs.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
