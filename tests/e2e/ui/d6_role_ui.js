// D6 — rôle STAGIAIRE à l'écran : création par l'administrateur, navigation restreinte,
// tableau de bord et messagerie sans module fermé, aucune erreur ; bureau et mobile.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const SHOTS = E.SHOTS;
const S = Date.now().toString(36).slice(-5);
async function attendre(f) { for (let i = 0; i < 40; i++) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }
(async () => {
  const b = await browser();
  console.log('— Administrateur : création d’un compte Stagiaire sans unité');
  const a = await loginPage(b, 'admin');
  await a.goto(`${WEB}/users`);
  await a.getByRole('button', { name: '+ Nouveau compte' }).click();
  await a.getByLabel('Adresse e-mail').fill(`stagui${S}@test.local`);
  await a.getByLabel('Prénom').fill('Mariama');
  await a.getByLabel('Nom', { exact: true }).fill(`Stagiaire${S}`);
  await a.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  const selRole = a.locator('label:text-is("Rôle") + select'); // le premier choix de la fenêtre est l’agent (socle N1)
  check('le rôle « Stagiaire » est proposé', (await selRole.locator('option').allInnerTexts()).includes('Stagiaire'));
  await selRole.selectOption('STAGIAIRE');
  await a.getByText('Facultatif : la rotation du stage').waitFor();
  check('rattachement facultatif annoncé', true);
  await a.getByRole('button', { name: 'Créer le compte' }).click();
  check('compte créé en base : Stagiaire, sans unité', await attendre(async () => { const u = await prisma.user.findUnique({ where: { email: `stagui${S}@test.local` } }); return u && u.role === 'STAGIAIRE' && !u.divisionId && !u.celluleId; }));
  const st = await prisma.user.findUnique({ where: { email: `stagui${S}@test.local` } });
  await prisma.user.update({ where: { id: st.id }, data: { divisionId: ids.DPE, sectionId: ids.SSR } }); // comme après un changement d'unité de la rotation
  await call('chefssr', 'POST', '/tasks', { title: `Préparer la note de conjoncture ${S}`, assignees: [{ userId: st.id }], divisionId: ids.DPE, sectionId: ids.SSR });
  await call('chefssr', 'POST', '/tasks', { title: `Tâche de section ${S}`, assignees: [{ userId: ids.agent1 }], divisionId: ids.DPE, sectionId: ids.SSR });

  for (const [label, viewport, suffixe] of [['bureau', undefined, 'desktop'], ['mobile', { width: 390, height: 844 }, 'mobile']]) {
    console.log(`— Stagiaire (${label})`);
    const p = await loginPage(b, `stagui${S}`, viewport);
    const erreurs = []; p.on('response', (r) => { if (r.url().startsWith('http://localhost:3000') && r.status() === 403) erreurs.push(r.url()); });
    if (viewport) await p.getByRole('button', { name: 'Ouvrir le menu' }).click();
    const nav = await p.locator('aside a').allInnerTexts();
    // Refonte de l'interface : icônes dessinées (plus de caractère en tête), pastille de compteur en fin.
    const entrees = nav.map((t) => t.replace(/\s+\d+$/, '').trim()).filter(Boolean);
    check(`navigation limitée (${entrees.join(', ')})`, ['Tableau de bord', 'Mes tâches', 'Messagerie', 'Dossier du personnel', 'Mon stage'].every((e) => entrees.includes(e)) && !entrees.some((e) => /Courrier|Réunions|Archives|Congés|Annuaire|suggestions|Utilisateurs/.test(e)));
    if (viewport) await p.keyboard.press('Escape');
    await p.goto(`${WEB}/dashboard`);
    await p.getByText(`Préparer la note de conjoncture ${S}`).first().waitFor();
    check('tableau de bord : sa tâche, pas celle de la section', (await p.getByText(`Tâche de section ${S}`).count()) === 0);
    check('tableau de bord : ni « Nouvelle tâche », ni export, ni carte Courrier', (await p.getByRole('button', { name: /Nouvelle tâche|Exporter/ }).count()) === 0 && (await p.locator('[data-testid=carte-courrier]').count()) === 0 && (await p.getByText('Courrier : compteurs').count()) === 0);
    await p.screenshot({ path: `${SHOTS}/d6_stagiaire_tableau_de_bord_${suffixe}.png`, fullPage: true });
    await p.goto(`${WEB}/communication`);
    await p.getByRole('tab', { name: 'Annonces' }).waitFor();
    check('communication : pas d’onglet Sondages', (await p.getByRole('tab', { name: 'Sondages' }).count()) === 0);
    await p.goto(`${WEB}/personnel`);
    await p.locator('[data-testid=ligne-personnel]').first().waitFor();
    check('dossier du personnel : le sien seulement', (await p.locator('[data-testid=ligne-personnel]').count()) === 1);
    check(`aucune réponse 403 reçue pendant le parcours${erreurs.length ? ' : ' + erreurs.join(', ') : ''}`, erreurs.length === 0);
    const x = await p.context().newPage(); await x.goto(`${WEB}/courrier`);
    check('/courrier ouvert à la main : refus de l’API affiché', await attendre(async () => (await x.getByText(/pas accessible aux stagiaires/).count()) > 0));
    await x.close();
  }
  await b.close(); await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(2); });
