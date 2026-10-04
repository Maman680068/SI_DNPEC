// N1 — écrans du socle sous Chromium, bureau (1366) et téléphone (390) : organigramme (lecture pour
// tous, création et fermeture d'une unité par le DRH), agents (liste, points de reprise, fiche ouverte
// par ?id=, fin de contrat proche, prolongation), rôles fonctionnels (attribution et retrait par
// l'administrateur), menus selon le rôle, aucun défilement horizontal sur téléphone.
const { browser, loginPage, check, bilan, WEB, ouvrirPlus } = require('./helpers');
const { call, ids } = require('../lib');
const E = require('../config');

const S = Date.now().toString(36).slice(-4).toUpperCase();
const JOUR = 864e5;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const TELEPHONE = { width: 390, height: 844 };
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const b = await browser();
  const organigramme = await call('drh', 'GET', '/api/v1/organigramme');
  const uDpe = organigramme.body.unites.find((u) => u.code === 'DPE');
  // Agent sous contrat dont la fin approche (J-10) : fiche ouverte par le lien des alertes.
  const cdd = await call('drh', 'POST', '/api/v1/agents', { nom: `Contrat${S}`, prenoms: 'Mariama', genre: 'F', uniteId: uDpe.id, fonction: 'Chargée d’études', dateFinPrevue: iso(Date.now() + 10 * JOUR), natureFinPrevue: 'CONTRAT' });
  check('agent sous contrat créé pour l’écran (fin dans 10 jours)', cdd.status === 201);

  console.log('— Bureau : organigramme');
  let p = await loginPage(b, 'agent1');
  await p.goto(`${WEB}/organisation`);
  await p.locator('[data-testid=unite][data-code=DPE]').first().waitFor();
  check('agent : organigramme complet lisible (Direction, divisions, sections)', (await p.locator('[data-testid=unite][data-code=DNPEC]').count()) === 1 && (await p.locator('[data-testid=unite][data-code=SSR]').count()) === 1);
  check('agent : aucune action de gestion', (await p.getByRole('button', { name: 'Sous-unité', exact: true }).count()) === 0 && (await p.getByRole('button', { name: 'Modifier', exact: true }).count()) === 0 && (await p.getByRole('button', { name: 'Fermer', exact: true }).count()) === 0);
  // Refonte (étape 8) : bande de synthèse, recherche, fenêtre d'une unité (historique, lecture seule pour l'agent).
  check('bande de synthèse : unités actives, cellules, agents rattachés, sans responsable', (await p.getByRole('region', { name: 'Synthèse de l’organigramme' }).locator('[data-testid^=compteur-]').count()) === 4);
  await p.getByLabel('Rechercher une unité').fill('SSR');
  await p.waitForFunction(() => !document.querySelector('[data-testid=unite][data-code=CSID]'));
  check('recherche « SSR » : la section et ses unités parentes seulement', (await p.locator('[data-testid=unite][data-code=SSR]').count()) === 1 && (await p.locator('[data-testid=unite][data-code=DPE]').count()) === 1 && (await p.locator('[data-testid=unite][data-code=DEE]').count()) === 0);
  await p.getByLabel('Rechercher une unité').fill('');
  await p.locator('[data-testid=unite][data-code=DPE]').first().locator(':scope > div').getByRole('button', { name: /^Voir DPE/ }).click();
  const ficheUnite = p.locator('[data-testid=fiche-unite]');
  await ficheUnite.locator('[data-testid=historique-unite]').waitFor();
  check('fenêtre de l’unité : historique, responsable, lecture seule pour l’agent', /Responsable/.test(await ficheUnite.innerText()) && /Lecture seule/.test(await ficheUnite.innerText()) && (await ficheUnite.getByRole('button', { name: 'Fermer l’unité' }).count()) === 0);
  await ficheUnite.getByRole('button', { name: 'Fermer', exact: true }).click();
  await p.locator('a[href="/organisation"]').first().waitFor();
  check('agent : pas de menu « Agents »', (await p.locator('a[href="/agents"]').count()) === 0);
  await p.context().close();

  p = await loginPage(b, 'drh');
  await ouvrirPlus(p);
  await p.locator('a[href="/organisation"]').first().waitFor();
  check('DRH : menu « Agents » présent', (await p.locator('a[href="/agents"]').count()) === 1);
  await p.goto(`${WEB}/organisation`);
  const dpe = p.locator('[data-testid=unite][data-code=DPE]').first();
  await dpe.waitFor();
  await dpe.locator(':scope > div').getByRole('button', { name: 'Sous-unité', exact: true }).click();
  const fen = p.getByRole('dialog', { name: 'Nouvelle unité sous DPE' });
  await fen.waitFor();
  await fen.getByLabel('Code').fill(`UI${S}`);
  await fen.getByLabel('Libellé').fill(`Section d’essai ${S}`);
  await fen.getByRole('button', { name: 'Créer l’unité' }).click();
  const nouvelle = p.locator(`[data-testid=unite][data-code=UI${S}]`);
  await nouvelle.waitFor();
  check('DRH : section créée sous DPE, affichée sans responsable', (await nouvelle.innerText()).includes('Pas de responsable désigné') && (await nouvelle.innerText()).includes('SECTION'));
  await p.screenshot({ path: `${E.SHOTS}/n1_organigramme_bureau.png`, fullPage: true });
  await nouvelle.getByRole('button', { name: 'Fermer', exact: true }).click();
  const fFerme = p.getByRole('dialog', { name: `Fermer UI${S}` });
  await fFerme.getByRole('button', { name: 'Fermer l’unité' }).click();
  check('fermeture sans motif : formulaire bloqué par le navigateur', await fFerme.isVisible());
  await fFerme.getByLabel('Motif de la fermeture').fill('Section d’essai supprimée');
  await fFerme.getByRole('button', { name: 'Fermer l’unité' }).click();
  await fFerme.waitFor({ state: 'detached' });
  await p.waitForTimeout(400);
  check('section fermée : retirée de l’organigramme affiché', (await p.locator(`[data-testid=unite][data-code=UI${S}]`).count()) === 0 || (await p.locator(`[data-testid=unite][data-code=UI${S}]`).innerText()).includes('Fermée le'));

  console.log('— Bureau : agents');
  await p.goto(`${WEB}/agents`);
  await p.getByRole('heading', { name: 'Agents', exact: true }).waitFor();
  await p.locator('[data-testid=ligne-agent]').first().waitFor();
  check('liste des agents : matricule, unité, statut', (await p.locator('[data-testid=ligne-agent]').count()) > 5 && (await p.getByRole('columnheader', { name: 'Matricule' }).count()) === 1);
  check('points de reprise affichés (matricules provisoires à remplacer)', (await p.getByRole('region', { name: 'Reprise : points à traiter' }).innerText()).includes('matricule(s) provisoire(s)'));
  check('ligne : action « Voir » (fiche de l’agent)', (await p.locator('[data-testid=ligne-agent]').first().getByRole('button', { name: /^Voir la fiche de / }).count()) === 1);
  // Lien « Voir » du panneau Alertes RH des effectifs : liste filtrée sur les matricules provisoires.
  await p.goto(`${WEB}/agents?matriculeProvisoire=true`);
  await p.locator('[data-testid=ligne-agent]').first().waitFor();
  check('?matriculeProvisoire=true : filtre actif, seules les lignes à matricule provisoire', (await p.getByRole('button', { name: 'Matricule provisoire', exact: true }).getAttribute('aria-pressed')) === 'true' && (await p.locator('[data-testid=ligne-agent]').count()) === (await p.locator('[data-testid=ligne-agent]', { hasText: '(provisoire)' }).count()));
  await p.goto(`${WEB}/agents?id=${cdd.body.id}`);
  const fiche = p.getByRole('dialog', { name: `Mariama Contrat${S}` });
  await fiche.waitFor();
  const fin = fiche.locator('[data-testid=fin-prevue]');
  check('fiche ouverte par ?id= : fin de contrat dans 10 jours, avertissement de désactivation', (await fin.innerText()).includes('Fin de contrat le') && (await fin.innerText()).includes('dans 10 jours') && (await fin.innerText()).includes('automatiquement « Parti »'));
  check('colonne de droite : actions du cycle de vie, phrase d’explication, informations', (await fiche.getByRole('button', { name: 'Prolonger le contrat' }).count()) === 1 && (await fiche.getByTestId('explication-cycle').innerText()).includes('Prolongez ou confirmez') && (await fiche.getByText('Matricule', { exact: true }).count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n1_agent_fin_bureau.png` });
  await fiche.getByRole('button', { name: 'Prolonger le contrat' }).click();
  const fProl = p.getByRole('dialog', { name: /^Prolonger le contrat/ });
  const nouvelleFin = iso(Date.now() + 100 * JOUR);
  await fProl.getByLabel('Nouvelle date de fin').fill(nouvelleFin);
  await fProl.getByLabel('Motif').fill('Renouvellement du contrat');
  await fProl.getByRole('button', { name: 'Prolonger le contrat' }).click();
  await fProl.waitFor({ state: 'detached' });
  await p.waitForTimeout(300);
  const date = new Date(nouvelleFin).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  check(`prolongation : nouvelle fin (${date}) affichée, mouvement « Prolongation » à l’historique`, (await fin.innerText()).includes(date) && (await fiche.innerText()).includes('Renouvellement du contrat'));
  await p.context().close();

  console.log('— Bureau : rôles fonctionnels (administrateur)');
  p = await loginPage(b, 'admin');
  await p.goto(`${WEB}/users`);
  await p.getByRole('tab', { name: 'Rôles fonctionnels' }).click();
  await p.locator('[data-testid=attribution]').first().waitFor();
  const avant = await p.locator('[data-testid=attribution]').count();
  check('rôles repris visibles (Validateur, DRH, Assistant…)', /Validateur/.test(await p.locator('tbody').innerText()));
  await p.getByRole('button', { name: 'Attribuer un rôle', exact: true }).click();
  const fAttr = p.getByRole('dialog', { name: /Attribuer un rôle/ });
  await fAttr.getByLabel('Personne').selectOption(ids.agent2);
  await fAttr.getByLabel('Rôle').selectOption('GESTIONNAIRE_RH');
  await fAttr.getByLabel('Motif (facultatif)').fill('Appui au DRH');
  await fAttr.getByRole('button', { name: /Attribuer/ }).last().click();
  await fAttr.waitFor({ state: 'detached' });
  await p.waitForFunction((n) => document.querySelectorAll('[data-testid=attribution]').length > n, avant);
  const ligne = p.locator('[data-testid=attribution]', { hasText: 'Gestionnaire RH' }).first();
  check('attribution affichée : Gestionnaire RH, attribué par l’administrateur', (await ligne.count()) === 1);
  await p.screenshot({ path: `${E.SHOTS}/n1_roles_bureau.png`, fullPage: true });
  await ligne.getByRole('button', { name: 'Retirer' }).click();
  const fRet = p.getByRole('dialog', { name: /Retirer/ });
  await fRet.getByLabel('Motif du retrait').fill('Fin de l’appui');
  await fRet.getByRole('button', { name: /Retirer/ }).last().click();
  await fRet.waitFor({ state: 'detached' });
  await p.getByLabel('Rôles en cours seulement').uncheck().catch(() => undefined);
  await p.waitForTimeout(400);
  check('retrait : le rôle apparaît « RETIRÉ » avec son motif', /RETIRÉ[\s\S]*Fin de l’appui|Fin de l’appui[\s\S]*RETIRÉ/.test(await p.locator('tbody').innerText()));
  await p.context().close();

  console.log('— Téléphone (390 px)');
  p = await loginPage(b, 'drh', TELEPHONE);
  await p.goto(`${WEB}/organisation`);
  await p.locator('[data-testid=unite][data-code=DPE]').first().waitFor();
  check('organigramme sur téléphone : aucun défilement horizontal', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n1_organigramme_mobile.png`, fullPage: true });
  await p.goto(`${WEB}/agents`);
  await p.locator('[data-testid=ligne-agent]').first().waitFor();
  check('agents sur téléphone : page sans défilement horizontal (lignes en pile)', await sansDefilementHorizontal(p));
  await p.screenshot({ path: `${E.SHOTS}/n1_agents_mobile.png`, fullPage: true });
  await p.goto(`${WEB}/agents?id=${cdd.body.id}`);
  await p.getByRole('dialog', { name: `Mariama Contrat${S}` }).waitFor();
  const largeur = await p.getByRole('dialog', { name: `Mariama Contrat${S}` }).evaluate((el) => el.getBoundingClientRect().width);
  check('fiche agent sur téléphone : pleine largeur, lisible', largeur <= 390 && largeur >= 380 && (await sansDefilementHorizontal(p)));
  await p.screenshot({ path: `${E.SHOTS}/n1_agent_mobile.png` });
  await p.context().close();

  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
