// C2 — tiroir acte et fenêtres, parcours réels dans Chromium.
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, upload, ids } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36);
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const SHOTS = E.SHOTS;
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
const dlg = (p) => p.locator('form[role=dialog]');
const champ = (p, label) => dlg(p).getByLabel(label, { exact: true });
const tiroir = (p) => p.locator('div[role=dialog]');
// « état:Titre / détail » — sans la pastille (symbole) de l'étape.
const etapes = (p) => p.locator('[data-testid=circuit] > ol > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-etape') + ':' + e.querySelector('div').innerText.replace(/\n/g, ' / ')));
async function ouvrir(b, key, acteId, viewport) {
  const p = await loginPage(b, key, viewport);
  p.on('dialog', (d) => d.accept());
  await p.goto(`${WEB}/courrier?acte=${acteId}`);
  await tiroir(p).getByRole('heading').first().waitFor();
  return p;
}

(async () => {
  await suppleance('chefdpe', 'chefdee');
  const b = await browser();

  console.log('— Réponse à un courrier arrivée, depuis sa fiche');
  const A = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: iso(0), expediteur: 'Ministère du Plan', objet: `Demande de note ${S}`, confidentialite: 'ORDINAIRE' })).body;
  const imp = (await call('dn', 'POST', `/courrier/arrivees/${A.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', echeance: iso(6 * J) })).body;
  await call('chefdpe', 'POST', `/courrier/imputations/${imp.id}/sous-imputations`, { imputeAId: ids.agent1, nature: 'ATTRIBUTION', echeance: iso(4 * J) });
  const ag = await loginPage(b, 'agent1');
  ag.on('dialog', (d) => d.accept());
  await ag.goto(`${WEB}/courrier?arrivee=${A.id}`);
  await ag.getByRole('button', { name: 'Rédiger une réponse' }).click();
  check('fenêtre préremplie « en réponse au courrier »', (await dlg(ag).innerText()).includes(`En réponse au courrier ${A.numero}`));
  await champ(ag, 'Registre').selectOption({ label: (await champ(ag, 'Registre').locator('option').allInnerTexts()).find((t) => /^DEP —/.test(t)) });
  await champ(ag, 'Objet').fill(`Réponse — note de cadrage ${S}`);
  await champ(ag, 'Destinataires (facultatif)').fill('Ministère du Plan');
  await champ(ag, 'Texte (facultatif)').fill('Monsieur le Ministre,\n\nNous avons l’honneur de vous transmettre la note demandée.');
  await champ(ag, 'Annexes (facultatif)').setInputFiles({ name: 'note.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF note') });
  await dlg(ag).getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await ag.waitForURL(/acte=/);
  const K = new URL(ag.url()).searchParams.get('acte');
  await tiroir(ag).getByText('BROUILLON', { exact: true }).waitFor();
  check('brouillon créé, non numéroté, annexe jointe', (await tiroir(ag).innerText()).includes('Non numéroté') && (await tiroir(ag).getByText('note.pdf').count()) === 1);
  const nb = async (n) => tiroir(ag).getByRole('button', { name: n, exact: true }).count();
  const boutons = [await nb('Soumettre au visa'), await nb('Modifier'), await nb('Supprimer'), await nb('Annuler l’acte')];
  check('brouillon : Soumettre, Modifier, Supprimer ; pas d’Annuler', boutons.join() === '1,1,1,0', boutons.join());
  await tiroir(ag).getByRole('button', { name: 'Soumettre au visa' }).click();
  await tiroir(ag).getByText('EN VISA', { exact: true }).waitFor();
  const e1 = await etapes(ag);
  check('circuit : Chef de Section (en attente de CHEFSSR) → Chef de Division → Signature', e1.length === 3 && e1[0].startsWith('courant:Chef de Section') && e1[0].includes('CHEFSSR') && e1[1].startsWith('avenir:Chef de Division') && e1[1].includes('CHEFDPE') && e1[2].startsWith('avenir:Signature'), e1.join(' | '));

  console.log('— Visa, renvoi, resoumission');
  const ssr = await ouvrir(b, 'chefssr', K);
  check('viseur attendu : « Viser » et « Renvoyer »', (await tiroir(ssr).getByRole('button', { name: 'Viser' }).count()) === 1 && (await tiroir(ssr).getByRole('button', { name: 'Renvoyer pour correction' }).count()) === 1);
  await tiroir(ssr).getByRole('button', { name: 'Viser' }).click();
  await champ(ssr, 'Commentaire (facultatif)').fill('Bon pour moi.');
  await dlg(ssr).getByRole('button', { name: 'Viser' }).click();
  await ssr.locator('[data-testid=circuit] li[data-etape=fait]').first().waitFor();
  check('visa enregistré (étape faite, commentaire)', (await etapes(ssr))[0].includes('Visé par CHEFSSR Test') && (await etapes(ssr))[0].includes('Bon pour moi'));
  check('après son visa : plus d’action de visa', (await tiroir(ssr).getByRole('button', { name: 'Viser' }).count()) === 0);
  const dpe = await ouvrir(b, 'chefdpe', K);
  await tiroir(dpe).getByRole('button', { name: 'Renvoyer pour correction' }).click();
  await champ(dpe, 'Motif (obligatoire)').fill('Préciser le calendrier.');
  await dlg(dpe).getByRole('button', { name: 'Renvoyer' }).click();
  await tiroir(dpe).getByText('RENVOYÉ', { exact: true }).waitFor();
  await ag.reload();
  await ag.locator('[data-testid=bandeau-renvoi]').waitFor();
  check('rédacteur : bandeau du motif de renvoi', (await ag.locator('[data-testid=bandeau-renvoi]').innerText()).includes('Préciser le calendrier.'));
  await tiroir(ag).getByRole('button', { name: 'Modifier' }).click();
  await champ(ag, 'Texte (facultatif)').fill('Monsieur le Ministre,\n\nVeuillez trouver la note ; calendrier : fin octobre.');
  await dlg(ag).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await tiroir(ag).getByText('calendrier : fin octobre').waitFor();
  await tiroir(ag).getByRole('button', { name: 'Resoumettre' }).click();
  await tiroir(ag).getByText('EN VISA', { exact: true }).waitFor();
  check('resoumis : nouveau cycle, précédent replié', (await tiroir(ag).getByText('Circuit de visa (soumission n° 2)').count()) === 1 && (await tiroir(ag).getByText('Soumissions précédentes (1)').count()) === 1);

  console.log('— Visa P.I. et signature par le DN');
  await call('chefssr', 'POST', `/courrier/actes/${K}/viser`, {});
  const pi = await loginPage(b, 'chefdee');
  pi.on('dialog', (d) => d.accept());
  await pi.getByRole('button', { name: /Agir en intérim/ }).first().click();
  await pi.getByRole('menuitemradio', { name: /CHEFDPE Test/ }).click();
  await pi.getByText('Mode intérim').waitFor();
  await pi.goto(`${WEB}/courrier?acte=${K}`);
  await tiroir(pi).getByRole('button', { name: 'Viser' }).click();
  check('P.I. : mention « au nom de CHEFDPE Test » dans la fenêtre', (await dlg(pi).innerText()).includes('au nom de CHEFDPE Test'));
  await dlg(pi).getByRole('button', { name: 'Viser' }).click();
  await tiroir(pi).getByText('À SIGNER', { exact: true }).waitFor();
  const e2 = await etapes(pi);
  check('circuit : « visé par CHEFDEE au nom de CHEFDPE »', /Visé par CHEFDEE Test au nom de CHEFDPE Test/.test(e2[1]), e2[1]);
  const dn = await ouvrir(b, 'dn', K);
  await dn.screenshot({ path: `${SHOTS}/c2_acte_circuit_desktop.png` });
  await tiroir(dn).getByRole('button', { name: 'Signer' }).click();
  await champ(dn, 'Acte signé scanné (facultatif)').setInputFiles({ name: 'signe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF signé') });
  await dlg(dn).getByRole('button', { name: 'Signer' }).click();
  await tiroir(dn).getByText('SIGNÉ', { exact: true }).waitFor();
  const numero = await tiroir(dn).getByRole('heading').first().innerText();
  check('signé : numéro attribué, scan joint, étape Signature faite', numero !== 'Non numéroté' && (await tiroir(dn).getByText('signe.pdf').count()) === 1 && (await etapes(dn)).pop().startsWith('fait:Signature'), numero);

  console.log('— Expédition (secrétariat) et lien vers la réponse');
  const sdg = await ouvrir(b, 'secdg', K);
  await tiroir(sdg).getByRole('button', { name: 'Expédier' }).click();
  await champ(sdg, 'Mode d’expédition').fill('Porteur');
  await dlg(sdg).getByRole('button', { name: 'Marquer expédié' }).click();
  await tiroir(sdg).getByText('EXPÉDIÉ', { exact: true }).waitFor();
  check('expédié, mode affiché', (await tiroir(sdg).innerText()).includes('Porteur'));
  await tiroir(sdg).getByRole('button', { name: 'Voir le courrier arrivée' }).click();
  await sdg.waitForURL(/arrivee=/);
  check('« En réponse à » ouvre la fiche du courrier arrivée', new URL(sdg.url()).searchParams.get('arrivee') === A.id);

  console.log('— Prise de connaissance');
  const kb = (await call('chefdpe', 'POST', '/courrier/actes', { registreId: reg.DEPU, confidentialite: 'ORDINAIRE', objet: `Attestation ${S}`, beneficiaireId: ids.agent2, priseConnaissanceRequise: true })).body;
  await call('chefdpe', 'POST', `/courrier/actes/${kb.id}/soumettre`);
  const sg = await call('dn', 'POST', `/courrier/actes/${kb.id}/signer`);
  check('(préparation) attestation signée', sg.status === 201, sg.status + ' ' + JSON.stringify(sg.body).slice(0, 120));
  const a2 = await ouvrir(b, 'agent2', kb.id);
  check('bénéficiaire : bandeau d’attente de sa prise de connaissance', (await a2.locator('[data-testid=bandeau-connaissance]').innerText()).includes('AGENT2'));
  await tiroir(a2).getByRole('button', { name: 'J’ai pris connaissance' }).click();
  await tiroir(a2).getByText(/A pris connaissance le/).waitFor();
  check('prise de connaissance enregistrée, bouton retiré', (await tiroir(a2).getByRole('button', { name: 'J’ai pris connaissance' }).count()) === 0 && (await a2.locator('[data-testid=bandeau-connaissance]').count()) === 0);

  console.log('— Refus affichés');
  const sfp = await loginPage(b, 'agentdee');
  await sfp.goto(`${WEB}/courrier?acte=${K}`);
  await tiroir(sfp).getByRole('alert').waitFor();
  check('acte hors périmètre : message 403 de l’API', (await tiroir(sfp).getByRole('alert').innerText()).length > 5, await tiroir(sfp).getByRole('alert').innerText());
  const kc = (await call('agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, confidentialite: 'ORDINAIRE', objet: `Double soumission ${S}` })).body;
  const ag2 = await ouvrir(b, 'agent1', kc.id);
  await call('agent1', 'POST', `/courrier/actes/${kc.id}/soumettre`);
  await tiroir(ag2).getByRole('button', { name: 'Soumettre au visa' }).click();
  await tiroir(ag2).getByRole('alert').waitFor();
  check('soumission déjà faite ailleurs : refus 409 affiché', /brouillon|soumis/i.test(await tiroir(ag2).getByRole('alert').innerText()), await tiroir(ag2).getByRole('alert').innerText());

  console.log('— Circuit obsolète : Resoumettre');
  await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'SUSPENDU' } });
  try {
    await ag2.reload();
    await ag2.locator('[data-testid=bandeau-obsolete]').waitFor();
    check('viseur plus en poste : bandeau et « Resoumettre »', (await tiroir(ag2).getByRole('button', { name: 'Resoumettre' }).count()) === 1);
    await tiroir(ag2).getByRole('button', { name: 'Resoumettre' }).click();
    await tiroir(ag2).getByText('Circuit de visa (soumission n° 2)').waitFor();
    const e3 = await etapes(ag2);
    check('circuit recalculé : Chef de Section sans objet (poste vacant)', e3[0].startsWith('saute:Chef de Section') && /vacant/i.test(e3[0]), e3.join(' | '));
  } finally {
    await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'ACTIF' } });
  }

  console.log('— Mobile');
  const m = await ouvrir(b, 'dn', K, { width: 390, height: 844 });
  const larg = await m.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('div[role=dialog]').scrollWidth]);
  check('mobile : fiche acte sans défilement horizontal', larg[0] <= 390 && larg[1] <= 390, JSON.stringify(larg));
  await m.screenshot({ path: `${SHOTS}/c2_acte_circuit_mobile.png` });
  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch(async (e) => { console.error(e); await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'ACTIF' } }); process.exit(2); });
