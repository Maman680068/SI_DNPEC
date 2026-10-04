// C2 — fenêtre d'un départ ou d'un acte (refonte, étape 8 : fil « Départ et acte · Registre … », titre
// « objet — bénéficiaire », étapes Rédigé → Visas → Signature → Numéro → Expédition, circuit de visa vertical,
// actions à droite selon les droits avec une phrase d'explication, Objet / Bénéficiaire / Niveau / Registre,
// historique) et petites fenêtres, parcours réels dans Chromium.
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
const dlg = (p) => p.locator('div[role=dialog]:has(> form)');
const champ = (p, label) => dlg(p).getByLabel(label, { exact: true });
const tiroir = (p) => p.getByTestId('fenetre-acte');
const toast = async (p) => { const t = p.getByTestId('toast'); await t.waitFor(); return t.innerText(); };
// Pastille de statut de l'en-tête de la fenêtre.
const statut = (p, t) => tiroir(p).getByTestId('statut-acte').getByText(t, { exact: true }).waitFor();
// Circuit vertical du cycle en cours : « ligne:état:Titre / détail » (ligne = redige, visa, signature, numero,
// expedition, connaissance, annule).
const etapes = (p) => p.locator('[data-testid=circuit] > ol > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-cle') + ':' + e.getAttribute('data-etape') + ':' + e.querySelector('div').innerText.replace(/\n/g, ' / ')));
const visas = (e) => e.filter((x) => x.startsWith('visa:'));
const ligneDe = (e, cle) => e.find((x) => x.startsWith(cle + ':')) ?? '';
async function ouvrir(b, key, acteId, viewport) {
  const p = await loginPage(b, key, viewport);
  p.on('dialog', (d) => d.accept());
  await p.goto(`${WEB}/courrier?acte=${acteId}`);
  await tiroir(p).getByTestId('statut-acte').waitFor();
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
  check('toast « Brouillon enregistré »', /Brouillon enregistré/.test(await toast(ag)));
  const K = new URL(ag.url()).searchParams.get('acte');
  await statut(ag, 'Brouillon');
  check('brouillon créé, non numéroté, annexe jointe', (await tiroir(ag).innerText()).includes('Non numéroté') && (await tiroir(ag).getByRole('button', { name: 'note.pdf', exact: true }).count()) === 1);
  const nb = async (n) => tiroir(ag).getByRole('button', { name: n, exact: true }).count();
  const boutons = [await nb('Soumettre au visa'), await nb('Modifier'), await nb('Supprimer'), await nb('Annuler l’acte')];
  check('brouillon : Soumettre, Modifier, Supprimer ; pas d’Annuler', boutons.join() === '1,1,1,0', boutons.join());
  await tiroir(ag).getByRole('button', { name: 'Soumettre au visa' }).click();
  await statut(ag, 'En visa');
  const e1 = await etapes(ag);
  const v1 = visas(e1);
  check('circuit vertical : rédigé (fait) → visa du chef de section (en attente de CHEFSSR) → visa du chef de division → signature, numéro, expédition', e1[0].startsWith('redige:fait:Rédigé par AGENT1 Test') && v1.length === 2 && v1[0].startsWith('visa:courant:Visa du chef de section') && v1[0].includes('En attente de CHEFSSR') && v1[1].startsWith('visa:avenir:Visa du chef de division') && v1[1].includes('CHEFDPE') && ligneDe(e1, 'signature').startsWith('signature:avenir:') && ligneDe(e1, 'numero').includes('automatique à la signature') && !!ligneDe(e1, 'expedition'), e1.join(' | '));

  console.log('— Visa, renvoi, resoumission');
  const ssr = await ouvrir(b, 'chefssr', K);
  check('viseur attendu : « Viser » et « Renvoyer au rédacteur », phrase d’explication', (await tiroir(ssr).getByRole('button', { name: 'Viser' }).count()) === 1 && (await tiroir(ssr).getByRole('button', { name: 'Renvoyer au rédacteur' }).count()) === 1 && /étape suivante/.test(await tiroir(ssr).getByTestId('explication-acte').innerText()));
  await tiroir(ssr).getByRole('button', { name: 'Viser' }).click();
  await champ(ssr, 'Commentaire (facultatif)').fill('Bon pour moi.');
  await dlg(ssr).getByRole('button', { name: 'Viser' }).click();
  check('toast « Acte visé »', /Acte visé/.test(await toast(ssr)));
  await ssr.locator('[data-testid=circuit] li[data-cle=visa][data-etape=fait]').first().waitFor();
  const vs = visas(await etapes(ssr));
  check('visa enregistré (étape faite, « Visé par …, chef de section », commentaire)', vs[0].startsWith('visa:fait:Visé par CHEFSSR Test, chef de section') && vs[0].includes('« Bon pour moi. »'), vs[0]);
  check('après son visa : plus d’action de visa', (await tiroir(ssr).getByRole('button', { name: 'Viser' }).count()) === 0);
  const dpe = await ouvrir(b, 'chefdpe', K);
  await tiroir(dpe).getByRole('button', { name: 'Renvoyer au rédacteur' }).click();
  await dlg(dpe).getByRole('button', { name: 'Renvoyer' }).click();
  check('renvoi sans motif : message sous le champ, fenêtre ouverte', (await dlg(dpe).getByTestId('erreur-champ').first().innerText()) === 'Indiquez le motif.');
  await champ(dpe, 'Motif').fill('Préciser le calendrier.');
  await dlg(dpe).getByRole('button', { name: 'Renvoyer' }).click();
  check('toast « Acte renvoyé au rédacteur »', /Acte renvoyé au rédacteur/.test(await toast(dpe)));
  await statut(dpe, 'Renvoyé');
  await ag.reload();
  await ag.locator('[data-testid=bandeau-renvoi]').waitFor();
  check('rédacteur : bandeau du motif de renvoi', (await ag.locator('[data-testid=bandeau-renvoi]').innerText()).includes('Préciser le calendrier.'));
  await tiroir(ag).getByRole('button', { name: 'Modifier' }).click();
  await champ(ag, 'Texte (facultatif)').fill('Monsieur le Ministre,\n\nVeuillez trouver la note ; calendrier : fin octobre.');
  await dlg(ag).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await tiroir(ag).getByText('calendrier : fin octobre').waitFor();
  await tiroir(ag).getByRole('button', { name: 'Resoumettre' }).click();
  await statut(ag, 'En visa');
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
  await statut(pi, 'À signer');
  const e2 = await etapes(pi);
  check('circuit : « visé par CHEFDEE au nom de CHEFDPE »', /Visé par CHEFDEE Test au nom de CHEFDPE Test/.test(visas(e2)[1]), visas(e2)[1]);
  const dn = await ouvrir(b, 'dn', K);
  await dn.screenshot({ path: `${SHOTS}/c2_acte_circuit_desktop.png` });
  const entete = await tiroir(dn).getByRole('list', { name: 'Étapes du circuit' }).locator('li').allInnerTexts();
  const courante = await tiroir(dn).getByRole('list', { name: 'Étapes du circuit' }).locator('li[aria-current=step]').innerText();
  check('en-tête : Rédigé → Visas → Signature (en cours) → Numéro → Expédition', entete.length === 5 && /^Rédigé[\s\S]*\| Visas[\s\S]*\| 3\s*Signature \| 4\s*Numéro \| 5\s*Expédition$/.test(entete.join(' | ')) && /Signature/.test(courante), entete.join(' | '));
  check('circuit : « Signature du Directeur national ou de la DNA » en cours, « En attente depuis … »', /^signature:courant:Signature du Directeur national ou de la DNA[\s\S]*En attente depuis/.test(ligneDe(await etapes(dn), 'signature')), ligneDe(await etapes(dn), 'signature'));
  check('fil « Départ et acte · Registre … · Non numéroté », titre = objet', /^Départ et acte · Registre .+ · Non numéroté$/.test((await tiroir(dn).getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()).trim()) && (await tiroir(dn).getByRole('heading').first().innerText()).trim() === `Réponse — note de cadrage ${S}`);
  check('DN : « Signer l’acte » en action principale, « Renvoyer au rédacteur » ensuite, pas de « Viser »', (await tiroir(dn).getByTestId('actions-acte').getByRole('button').first().innerText()).trim() === 'Signer l’acte' && (await tiroir(dn).getByTestId('actions-acte').getByRole('button').nth(1).innerText()).trim() === 'Renvoyer au rédacteur' && (await tiroir(dn).getByRole('button', { name: 'Viser' }).count()) === 0);
  check('phrase d’explication : la signature attribue le numéro', /numéro suivant du registre/.test(await tiroir(dn).getByTestId('explication-acte').innerText()));
  const infos = await tiroir(dn).locator('dl').first().innerText();
  check('informations : Objet, Niveau, Registre', /Objet[\s\S]*Niveau[\s\S]*Ordinaire[\s\S]*Registre/.test(infos), infos.replace(/\n/g, ' / '));
  await tiroir(dn).getByRole('button', { name: 'Signer l’acte' }).click();
  await champ(dn, 'Acte signé scanné (facultatif)').setInputFiles({ name: 'signe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF signé') });
  await dlg(dn).getByRole('button', { name: 'Signer' }).click();
  await statut(dn, 'Signé');
  check('toast « Acte signé — Numéro … attribué »', /Acte signé[\s\S]*Numéro \S+ attribué/.test(await toast(dn)));
  const fil = (await tiroir(dn).getByRole('navigation', { name: 'Fil d’Ariane' }).innerText()).trim();
  const e4 = await etapes(dn);
  check('signé : numéro attribué (fil « … · N° … », ligne « Numéro … attribué »), scan joint, signature faite', / · N° \S+$/.test(fil) && ligneDe(e4, 'numero').startsWith('numero:fait:Numéro ') && (await tiroir(dn).getByRole('button', { name: 'signe.pdf', exact: true }).count()) === 1 && ligneDe(e4, 'signature').startsWith('signature:fait:Signé par DN Test'), fil + ' | ' + e4.join(' | '));
  check('historique : visas et signature datés', /visé par CHEFSSR/.test(await tiroir(dn).getByTestId('historique').innerText()) && /signé par DN/.test(await tiroir(dn).getByTestId('historique').innerText()));

  console.log('— Expédition (secrétariat) et lien vers la réponse');
  const sdg = await ouvrir(b, 'secdg', K);
  await tiroir(sdg).getByRole('button', { name: 'Expédier' }).click();
  await champ(sdg, 'Mode d’expédition').selectOption('Porteur');
  await dlg(sdg).getByRole('button', { name: 'Marquer expédié' }).click();
  await statut(sdg, 'Expédié');
  check('toast « Acte expédié »', /Acte expédié[\s\S]*Porteur/.test(await toast(sdg)));
  check('expédié : ligne « Expédié par … · Porteur », étape Expédition faite', /^expedition:fait:Expédié par [\s\S]*Porteur/.test(ligneDe(await etapes(sdg), 'expedition')) && (await tiroir(sdg).getByRole('list', { name: 'Étapes du circuit' }).locator('li').last().innerText()).includes('(fait)'), ligneDe(await etapes(sdg), 'expedition'));
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
  check('titre « objet — bénéficiaire », Bénéficiaire dans les informations, ligne « Prise de connaissance » en cours', (await tiroir(a2).getByRole('heading').first().innerText()).trim() === `Attestation ${S} — AGENT2 Test` && /Bénéficiaire\s+AGENT2 Test/.test(await tiroir(a2).locator('dl').first().innerText()) && ligneDe(await etapes(a2), 'connaissance').startsWith('connaissance:courant:Prise de connaissance par AGENT2 Test'));
  await tiroir(a2).getByRole('button', { name: 'J’ai pris connaissance' }).click();
  await tiroir(a2).getByText(/A pris connaissance le/).waitFor();
  check('toast « Prise de connaissance confirmée »', /Prise de connaissance confirmée/.test(await toast(a2)));
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
  const r409 = ag2.locator('[data-testid=toast][data-ton=erreur]');
  await r409.waitFor();
  check('soumission déjà faite ailleurs : refus 409 en message bref, en français', /brouillon|soumis/i.test(await r409.innerText()), await r409.innerText());

  console.log('— Circuit obsolète : Resoumettre');
  await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'SUSPENDU' } });
  try {
    await ag2.reload();
    await ag2.locator('[data-testid=bandeau-obsolete]').waitFor();
    check('viseur plus en poste : bandeau et « Resoumettre »', (await tiroir(ag2).getByRole('button', { name: 'Resoumettre' }).count()) === 1);
    await tiroir(ag2).getByRole('button', { name: 'Resoumettre' }).click();
    await tiroir(ag2).getByText('Circuit de visa (soumission n° 2)').waitFor();
    const e3 = await etapes(ag2);
    check('circuit recalculé : visa du chef de section sans objet (poste vacant)', visas(e3)[0].startsWith('visa:saute:Visa du chef de section — sans objet') && /vacant/i.test(visas(e3)[0]), e3.join(' | '));
  } finally {
    await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'ACTIF' } });
  }

  console.log('— Mobile');
  const m = await ouvrir(b, 'dn', K, { width: 390, height: 844 });
  const larg = await m.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('[data-testid=fenetre-acte]').scrollWidth]);
  check('mobile : fiche acte sans défilement horizontal', larg[0] <= 390 && larg[1] <= 390, JSON.stringify(larg));
  await m.screenshot({ path: `${SHOTS}/c2_acte_circuit_mobile.png` });
  await b.close();
  await prisma.$disconnect();
  bilan();
})().catch(async (e) => { console.error(e); await prisma.user.update({ where: { id: ids.chefssr }, data: { status: 'ACTIF' } }); process.exit(2); });
