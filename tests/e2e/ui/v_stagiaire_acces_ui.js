// Lot « Accès des stagiaires » sous Chromium : « Nouveau stage » du DRH avec « Nouveau stagiaire (créer
// le compte) », validation dans la fenêtre, email déjà pris ; « Nouveau stagiaire » de l'administrateur
// (réglages des stages) ; demande d'accès : « Stagiaire » absent, phrase d'orientation. Bureau et 390 px.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const E = require('../config');

const BUREAU = { width: 1440, height: 900 };
const TELEPHONE = { width: 390, height: 844 };
const S = Date.now().toString(36).slice(-5);
const JOUR = 864e5;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const sansDebord = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function remplir(dlg, { prenom, nom, email, etab = 'Université de Conakry' }) {
  await dlg.getByLabel('Prénom', { exact: true }).fill(prenom);
  await dlg.getByLabel('Nom', { exact: true }).fill(nom);
  await dlg.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  await dlg.getByLabel('Établissement d’origine', { exact: true }).fill(etab);
  await dlg.getByLabel('Début', { exact: true }).click();
  await dlg.getByLabel('Début', { exact: true }).fill(iso(Date.now() + 10 * JOUR));
  await dlg.getByLabel('Fin', { exact: true }).click();
  await dlg.getByLabel('Fin', { exact: true }).fill(iso(Date.now() + 70 * JOUR));
}

(async () => {
  const b = await browser();

  console.log('— DRH : Nouveau stage → Nouveau stagiaire (créer le compte)');
  let p = await loginPage(b, 'drh', BUREAU);
  await p.goto(`${WEB}/stages`);
  await p.getByRole('button', { name: /Nouveau stage/ }).first().click();
  const dlg = p.getByRole('dialog', { name: 'Nouveau stage' });
  await dlg.waitFor();
  check('choix « Compte existant » / « Nouveau stagiaire (créer le compte) »', (await dlg.getByRole('radio').allInnerTexts()).join('|') === 'Compte existant|Nouveau stagiaire (créer le compte)');
  await dlg.getByRole('radio', { name: 'Nouveau stagiaire (créer le compte)' }).click();
  check('champs du nouveau compte : prénom, nom, email, téléphone (facultatif)', (await dlg.getByLabel('Prénom', { exact: true }).count()) === 1 && (await dlg.getByLabel('Adresse e-mail', { exact: true }).count()) === 1 && /Téléphone\s*\(facultatif\)/.test(await dlg.innerText()));
  check('aucun choix de rôle dans la fenêtre', (await dlg.getByLabel(/Rôle/).count()) === 0);
  await p.screenshot({ path: `${E.SHOTS}/v_nouveau_stagiaire_drh.png` });
  await dlg.getByRole('button', { name: 'Créer le compte et le stage' }).click();
  const msgs = await dlg.getByTestId('erreur-champ').allInnerTexts();
  check('envoi vide : messages sous les champs, rien d’envoyé', msgs.includes('Indiquez l’adresse e-mail du stagiaire.') && msgs.length >= 5, msgs.join(' | '));
  await remplir(dlg, { prenom: 'Fanta', nom: `Ui${S}`, email: 'agent1@test.local' });
  await dlg.getByRole('button', { name: 'Créer le compte et le stage' }).click();
  await dlg.getByTestId('erreur-formulaire').waitFor();
  check('email déjà pris : « Ce compte existe déjà : sélectionnez-le dans la liste. »', (await dlg.getByTestId('erreur-formulaire').innerText()).includes('Ce compte existe déjà : sélectionnez-le dans la liste.'));
  const email = `fanta.ui.${S}@test.local`;
  await dlg.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  await dlg.getByRole('button', { name: 'Créer le compte et le stage' }).click();
  await p.getByTestId('toast').waitFor();
  check('toast « Compte et stage créés » avec l’adresse', /Compte et stage créés/.test(await p.getByTestId('toast').innerText()) && (await p.getByTestId('toast').innerText()).includes(email));
  await p.waitForURL('**/stages/*');
  check('ouverture de la fiche du stage créé', await p.getByRole('heading', { name: new RegExp(`Fanta Ui${S}`) }).first().waitFor({ timeout: 15000 }).then(() => true, () => false));
  const u = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  check('compte créé au rôle Stagiaire', u?.role === 'STAGIAIRE');
  await p.context().close();

  console.log('— Administrateur : réglages des stages → Nouveau stagiaire');
  p = await loginPage(b, 'admin', BUREAU);
  await p.goto(`${WEB}/stages/parametres`);
  await p.getByRole('button', { name: 'Nouveau stagiaire (créer le compte)' }).click();
  const dlgA = p.getByRole('dialog', { name: 'Nouveau stagiaire' });
  await dlgA.waitFor();
  check('administrateur : seulement la création d’un nouveau stagiaire (pas de liste de comptes)', (await dlgA.getByRole('radio').count()) === 0 && (await dlgA.getByRole('combobox').count()) === 0);
  await remplir(dlgA, { prenom: 'Ibrahima', nom: `Ui${S}`, email: `ibrahima.ui.${S}@test.local` });
  await dlgA.getByRole('button', { name: 'Créer le compte et le stage' }).click();
  await p.getByTestId('toast').waitFor();
  check('toast « Compte et stage créés » ; l’administrateur reste sur les réglages', /Compte et stage créés/.test(await p.getByTestId('toast').innerText()) && p.url().endsWith('/stages/parametres'));
  await p.context().close();

  console.log('— Demande d’accès publique');
  const ctx = await b.newContext({ viewport: BUREAU, locale: 'fr-FR' });
  p = await ctx.newPage();
  await p.goto(`${WEB}/register`);
  await p.getByLabel('Adresse e-mail').fill(`demande.${S}@test.local`);
  await p.getByRole('button', { name: /Continuer/ }).click();
  await p.getByLabel('Prénom', { exact: true }).fill('Awa');
  await p.getByLabel('Nom', { exact: true }).fill(`Demande${S}`);
  await p.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await p.getByRole('button', { name: /Continuer/ }).click();
  const poste = p.locator('form select').first();
  await poste.waitFor();
  const options = await poste.locator('option').allInnerTexts();
  check('« Stagiaire » n’est pas proposé dans « Poste actuel »', !options.some((o) => /stagiaire/i.test(o)), options.join(' | '));
  check('phrase : « Stagiaire : ne faites pas de demande, le service RH crée votre compte. »', (await p.getByTestId('note-stagiaire').innerText()).trim() === 'Stagiaire : ne faites pas de demande, le service RH crée votre compte.');
  await p.screenshot({ path: `${E.SHOTS}/v_demande_acces.png` });
  await ctx.close();

  console.log('— Téléphone');
  p = await loginPage(b, 'drh', TELEPHONE);
  await p.goto(`${WEB}/stages`);
  await p.getByRole('button', { name: /Nouveau stage/ }).first().click();
  await p.getByRole('dialog', { name: 'Nouveau stage' }).getByRole('radio', { name: 'Nouveau stagiaire (créer le compte)' }).click();
  check('fenêtre « Nouveau stage » à 390 px : pas de défilement horizontal', await sansDebord(p));
  await p.context().close();

  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch((e) => { console.error(e); process.exit(1); });
