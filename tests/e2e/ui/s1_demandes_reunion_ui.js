// S1 — Réunions (Chromium, bureau) : le chargé d'études a « Demander une réunion » (pas « Nouvelle
// réunion ») ; ajout d'une unité entière ; le chef décide depuis « Demandes de réunion à décider » ; le
// demandeur ouvre « Créer la réunion » : formulaire prérempli, date et participants verrouillés ; la
// réunion affiche « Validée par ».
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { ids } = require('../lib');
const E = require('../config');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

(async () => {
  const b = await browser();
  let p = await loginPage(b, 'agent1', { width: 1440, height: 900 });
  await p.goto(`${WEB}/reunions`);
  await p.getByRole('button', { name: 'Demander une réunion' }).first().waitFor();
  check('chargé d’études : « Demander une réunion », pas « Nouvelle réunion »', (await p.getByRole('button', { name: 'Nouvelle réunion' }).count()) === 0);
  await p.getByRole('button', { name: 'Demander une réunion' }).first().click();
  const f = p.getByTestId('fenetre-demande-reunion');
  await f.waitFor();
  await f.getByLabel('Objet', { exact: true }).fill(`Revue des projections ${S}`);
  await f.getByLabel('Courte explication').fill('Caler les hypothèses avant la note.');
  await f.getByLabel('Date proposée', { exact: true }).fill(jour(6));
  await f.getByLabel('Début', { exact: true }).fill('09:00');
  await f.getByLabel('Fin', { exact: true }).fill('10:00');
  const optSsr = await f.locator('#participants-unite option').filter({ hasText: /SSR —/ }).first().getAttribute('value');
  await f.locator('#participants-unite').selectOption(optSsr);
  await f.getByRole('button', { name: 'Ajouter l’unité' }).click();
  check('« Ajouter une unité » : ses membres sont ajoutés (agent2 de la SSR)', /AGENT2/i.test(await f.getByTestId('selecteur-participants').innerText()));
  check('aucun stagiaire proposé dans les unités', !/Stagiaire|STAG/i.test(await f.locator('#participants-unite').innerText()));
  await p.screenshot({ path: `${E.SHOTS}/s1_demande_reunion.png` });
  await f.getByRole('button', { name: 'Envoyer la demande' }).click();
  await f.waitFor({ state: 'detached' });
  const mes = p.getByTestId('mes-demandes');
  await mes.waitFor();
  check('« Mes demandes de réunion » : en attente, chez le chef SSR', /Revue des projections/.test(await mes.innerText()) && /En attente/.test(await mes.innerText()) && /CHEFSSR/i.test(await mes.innerText()));
  const d = await prisma.demandeReunion.findFirst({ where: { objet: `Revue des projections ${S}` } });
  await p.context().close();

  p = await loginPage(b, 'chefssr', { width: 1440, height: 900 });
  await p.goto(`${WEB}/reunions?onglet=demandes`);
  const aDec = p.getByTestId('demandes-a-decider');
  await aDec.waitFor();
  await aDec.locator('[data-testid=demande-reunion]', { hasText: S }).getByRole('button', { name: 'Décider' }).click();
  const fd = p.getByTestId('fenetre-demande');
  await fd.waitFor();
  check('chef : Accepter, Refuser, Transmettre à mon chef', (await fd.getByRole('button', { name: 'Accepter', exact: true }).count()) === 1 && (await fd.getByRole('button', { name: 'Refuser', exact: true }).count()) === 1 && (await fd.getByRole('button', { name: 'Transmettre à mon chef' }).count()) === 1);
  await fd.getByRole('button', { name: 'Accepter' }).click();
  const fa = p.getByTestId('fenetre-accepter-demande');
  await fa.waitFor();
  await fa.getByLabel('Fin', { exact: true }).fill('10:30');
  await fa.getByRole('button', { name: 'Accepter', exact: true }).click();
  await fa.waitFor({ state: 'detached' });
  await p.waitForTimeout(500);
  check('demande acceptée (fin repoussée à 10 h 30)', (await prisma.demandeReunion.findUnique({ where: { id: d.id } })).etat === 'ACCEPTEE');
  await p.context().close();

  p = await loginPage(b, 'agent1', { width: 1440, height: 900 });
  await p.goto(`${WEB}/reunions?demande=${d.id}&creer=1`);
  const fc = p.getByTestId('fenetre-nouvelle-reunion');
  await fc.waitFor();
  check('lien « Créer la réunion » : formulaire prérempli, « Demande validée par »', (await fc.getByLabel('Titre', { exact: true }).inputValue()) === `Revue des projections ${S}` && /Demande validée par/.test(await fc.getByTestId('demande-validee').innerText()));
  check('date, heures et participants verrouillés', /09:00 – 10:30/.test(await fc.getByTestId('date-verrouillee').innerText()) && (await fc.getByTestId('participants-verrouilles').count()) === 1 && (await fc.getByLabel('Début', { exact: true }).count()) === 0);
  await fc.getByLabel('Ordre du jour').fill('1. Hypothèses\n2. Calendrier');
  await fc.getByRole('button', { name: 'Créer la réunion' }).click();
  await fc.waitFor({ state: 'detached' });
  const m = await prisma.meeting.findFirst({ where: { title: `Revue des projections ${S}` } });
  check('réunion créée avec la demande', !!m && (await prisma.demandeReunion.findUnique({ where: { id: d.id } })).reunionId === m.id);
  await p.goto(`${WEB}/reunions?id=${m.id}`);
  await p.getByTestId('validee-par').waitFor();
  check('la réunion affiche « Validée par » le chef SSR', /Validée par CHEFSSR/i.test(await p.getByTestId('validee-par').innerText()));
  await b.close(); await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
