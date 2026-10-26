// Comptes et habilitations (Chromium, bureau) : colonnes « Rôles fonctionnels » et « Double
// authentification » calculées par l'API ; bloc « Agents sans compte » ; « Ouvrir un compte » ouvre la
// création de compte préremplie et rattachée à l'agent (administrateur) ; DN en lecture seule.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { ids } = require('../lib');
const E = require('../config');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);

(async () => {
  const agent = await prisma.agent.create({ data: { matricule: `UC${S}`.toUpperCase(), nom: `Ouverture${S}`, prenoms: 'Fatoumata', fonction: 'Chargée d’études' } });
  const div = await prisma.division.findFirst({ where: { id: ids.DPE } });
  const b = await browser();

  console.log('— Administrateur');
  let p = await loginPage(b, 'admin', { width: 1440, height: 900 });
  await p.goto(`${WEB}/users`);
  await p.getByRole('columnheader', { name: 'Rôles fonctionnels' }).waitFor();
  check('colonnes « Rôles fonctionnels » et « Double authentification »', (await p.getByRole('columnheader', { name: 'Double authentification' }).count()) === 1);
  const ligneDrh = p.locator('tr', { has: p.locator('[data-testid=roles-fonctionnels]', { hasText: 'Directeur des Ressources Humaines' }) });
  check('DRH : son rôle fonctionnel en clair ; double authentification « Non »', (await ligneDrh.count()) >= 1 && /Non/.test(await ligneDrh.first().getByTestId('double-authentification').innerText()));
  const bloc = p.getByTestId('agents-sans-compte');
  const ligne = bloc.locator('[data-testid=agent-sans-compte]', { hasText: agent.matricule });
  await ligne.waitFor();
  check('bloc « Agents sans compte » : matricule, nom, fonction', /Fatoumata/.test(await ligne.innerText()) && /Chargée d’études/.test(await ligne.innerText()));
  await p.screenshot({ path: `${E.SHOTS}/u_comptes_bureau.png`, fullPage: true });
  await ligne.getByRole('button', { name: 'Ouvrir un compte' }).click();
  const f = p.getByTestId('fenetre-nouveau-compte');
  await f.waitFor();
  await p.waitForFunction(() => document.querySelector('#cu-nom')?.value);
  check('création préremplie depuis l’agent (prénom, nom)', (await f.locator('#cu-prenom').inputValue()) === 'Fatoumata' && (await f.locator('#cu-nom').inputValue()) === agent.nom);
  await f.locator('#cu-email').fill(`uc${S}@test.local`);
  await f.locator('#cu-mdp').fill('Password123!');
  await f.getByLabel('Division', { exact: true }).selectOption(div.id);
  await f.getByRole('button', { name: 'Créer le compte' }).click();
  await f.waitFor({ state: 'detached' });
  const u = await prisma.user.findUnique({ where: { email: `uc${S}@test.local` } });
  check('compte créé, rattaché à l’agent choisi', !!u && u.agentId === agent.id, u && u.agentId);
  await p.waitForTimeout(800);
  check('… l’agent quitte le bloc « Agents sans compte »', (await bloc.locator('[data-testid=agent-sans-compte]', { hasText: agent.matricule }).count()) === 0);
  await p.context().close();

  console.log('— DN : lecture seule');
  p = await loginPage(b, 'dn', { width: 1440, height: 900 });
  await p.goto(`${WEB}/users`);
  await p.getByTestId('agents-sans-compte').waitFor();
  check('DN : colonnes visibles, aucun bouton « Ouvrir un compte » ni « Nouveau compte »', (await p.getByRole('columnheader', { name: 'Rôles fonctionnels' }).count()) === 1 && (await p.getByRole('button', { name: 'Ouvrir un compte' }).count()) === 0 && (await p.getByRole('button', { name: 'Nouveau compte' }).count()) === 0);
  await p.context().close();

  await b.close(); await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
