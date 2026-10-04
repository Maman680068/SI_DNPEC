// Nomination d'un chef (option A) sous Chromium : le DRH prépare une nomination avec poste de
// responsabilité ; après signature, l'état « droits en attente » s'affiche sur le mouvement ;
// l'administrateur ouvre l'onglet « Nominations » (lien des notifications), confirme (bureau) ou
// refuse avec un motif (téléphone, sans défilement horizontal) ; le DRH voit l'état et le motif.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids, login } = require('../lib');
const E = require('../config');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const TELEPHONE = { width: 390, height: 844 };
const sansDefilementHorizontal = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function signerActe(acteId) {
  await call('drh', 'POST', `/courrier/actes/${acteId}/soumettre`);
  let a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a.statut === 'EN_VISA' && i < 4; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'signe.pdf');
  const r = await fetch(`${API}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
  check('le DN signe l’acte', r.status === 201, r.status);
}

(async () => {
  const hash = await argon2.hash('Password123!', { type: argon2.argon2id });
  const div = await prisma.division.create({ data: { code: `NU${L}`, name: `Division écran ${S}` } });
  const sec = await prisma.section.create({ data: { divisionId: div.id, code: `NV${L}`, name: `Section écran ${S}` } });
  const cree = async (nom, role, extra) => (await prisma.user.create({ data: { email: `${nom}${S}@test.local`, passwordHash: hash, firstName: nom.toUpperCase(), lastName: `Écran ${S}`, role, status: 'ACTIF', ...extra } })).id;
  const chef = await cree('nuchef', 'CHEF_SECTION', { divisionId: div.id, sectionId: sec.id });
  const a = await cree('nua', 'AGENT', { divisionId: div.id, sectionId: sec.id });
  const b = await cree('nub', 'AGENT', { divisionId: div.id });
  const FONCTION = `Chef de Section — Section écran ${S} (Division écran ${S})`;
  const familleAvant = await prisma.familleActeRh.findUnique({ where: { code: 'DECISION_NOMINATION' } });
  const reg = (await call('admin', 'POST', '/courrier/registres', { code: `DNU${L}`, libelle: `Nominations écran ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: `DNU${L}/{seq:3}/{annee}` })).body;
  await call('drh', 'PATCH', '/api/v1/rh/familles-actes/DECISION_NOMINATION', { registreId: reg.id });
  const b0 = await browser();
  try {
    console.log('— DRH : nomination avec poste de responsabilité');
    let p = await loginPage(b0, 'drh');
    await p.goto(`${WEB}/rh?onglet=carriere`);
    await p.getByRole('button', { name: 'Nouveau mouvement', exact: true }).click();
    const d = p.getByRole('dialog');
    await d.getByLabel('Agent').selectOption(a);
    await d.getByLabel('Mouvement').selectOption('NOMINATION');
    check('sans poste : fonction en texte libre', await d.getByLabel('Nouvelle fonction').isVisible());
    await d.getByLabel('Poste visé').selectOption(`CHEF_SECTION:${sec.id}`);
    const vise = await d.locator('[data-testid=poste-vise]').innerText();
    check('poste choisi : intitulé de la fonction dérivé, actuel titulaire nommé, plus de texte libre', vise.includes(FONCTION) && /NUCHEF Écran .* redevient Chargé\(e\) d’Études/.test(vise) && (await d.getByLabel('Nouvelle fonction').count()) === 0, vise);
    await p.screenshot({ path: `${E.SHOTS}/nr_preparation_bureau.png` });
    await d.getByRole('button', { name: 'Préparer le mouvement' }).click();
    const mvt = p.locator('[data-testid=mouvement]', { hasText: FONCTION });
    await mvt.waitFor();
    check('mouvement : poste (droits) avant → après', /Poste \(droits\) : [^→]*Chargé d’Études → Chef de Section/.test(await mvt.innerText()), await mvt.innerText());
    await mvt.getByRole('button', { name: 'Préparer l’acte' }).click();
    await mvt.getByRole('link', { name: 'Voir l’acte' }).waitFor();
    const m1 = await prisma.mouvementCarriere.findFirst({ where: { userId: a, type: 'NOMINATION' } });
    await signerActe(m1.acteId);
    await p.reload();
    await mvt.waitFor();
    check('après signature : « Droits en attente (administrateur) »', (await mvt.locator('[data-testid=droits-poste]').innerText()).includes('Droits en attente'));
    await p.context().close();

    console.log('— Administrateur : onglet Nominations (lien des notifications), confirmation');
    p = await loginPage(b0, 'admin');
    await p.goto(`${WEB}/users?onglet=nominations`);
    const ligne = p.locator('[data-testid=nomination]', { hasText: `NUA Écran ${S}` });
    await ligne.waitFor({ timeout: 20000 });
    check('onglet « Nominations » ouvert par le lien', (await p.getByRole('tab', { name: 'Nominations' }).getAttribute('aria-selected')) === 'true');
    const texte = await ligne.innerText();
    check('ligne : poste, acte, actuel titulaire et rôle proposé', /Chef de Section/.test(texte) && texte.includes(`fonction « ${FONCTION} »`) && /Acte n°/.test(texte) && /Actuel titulaire : NUCHEF/.test(texte) && /Chargé d’Études/.test(texte), texte);
    check('écart affiché pour la nomination en attente', (await p.locator('[data-testid=ecart]', { hasText: `NUA Écran ${S}` }).count()) === 1);
    await p.screenshot({ path: `${E.SHOTS}/nr_nominations_bureau.png`, fullPage: true });
    await ligne.getByRole('button', { name: 'Confirmer…' }).click();
    const dc = p.getByRole('dialog');
    check('fenêtre : rôle proposé à l’actuel titulaire pré-sélectionné', (await dc.getByLabel(/^Rôle/).inputValue()) === 'AGENT' && (await dc.getByLabel(/^Section/).inputValue()) === sec.id);
    await dc.getByLabel(/Précision/).fill('Passation faite');
    await dc.getByRole('button', { name: 'Appliquer les droits' }).click();
    await p.locator('[data-testid=nominations-traitees]', { hasText: `NUA Écran ${S}` }).waitFor();
    check('nomination passée en « traitées », droits appliqués', /Droits appliqués/.test(await p.locator('[data-testid=nominations-traitees]').innerText()) && (await ligne.count()) === 0);
    const [ua, uc] = await Promise.all([prisma.user.findUnique({ where: { id: a } }), prisma.user.findUnique({ where: { id: chef } })]);
    check('rôles en base : nommé Chef de Section, ancien chef Chargé d’Études', ua.role === 'CHEF_SECTION' && uc.role === 'AGENT' && uc.sectionId === sec.id);
    await p.context().close();

    console.log('— Téléphone : refus motivé');
    const mv2 = (await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: b, type: 'NOMINATION', dateEffet: new Date().toISOString().slice(0, 10), apres: { role: 'CHEF_DIVISION', divisionId: div.id } })).body;
    const ac2 = (await call('drh', 'POST', `/api/v1/rh/mouvements/${mv2.id}/acte`)).body;
    await signerActe(ac2.acteId);
    p = await loginPage(b0, 'admin', TELEPHONE);
    await p.goto(`${WEB}/users?onglet=nominations`);
    const ligne2 = p.locator('[data-testid=nomination]', { hasText: `NUB Écran ${S}` });
    await ligne2.waitFor({ timeout: 20000 });
    check('poste vacant indiqué', /Poste vacant/.test(await ligne2.innerText()));
    check('téléphone : sans défilement horizontal', await sansDefilementHorizontal(p));
    await p.screenshot({ path: `${E.SHOTS}/nr_nominations_mobile.png`, fullPage: true });
    await ligne2.getByRole('button', { name: 'Rejeter avec un motif' }).click();
    const dr = p.getByRole('dialog');
    await dr.getByLabel(/Motif/).fill('Acte à reprendre : division erronée');
    await dr.getByRole('button', { name: 'Rejeter', exact: true }).click();
    await p.locator('[data-testid=nominations-traitees]', { hasText: `NUB Écran ${S}` }).waitFor();
    check('refus listé avec son motif', /Acte à reprendre : division erronée/.test(await p.locator('[data-testid=nominations-traitees]').innerText()));
    check('écart désormais : fonction de chef sur un Chargé d’Études', /poste de responsabilité que le rôle du compte ne porte pas/.test(await p.locator('[data-testid=ecart]', { hasText: `NUB Écran ${S}` }).innerText()));
    await p.context().close();

    console.log('— DRH : état des droits sur les mouvements');
    p = await loginPage(b0, 'drh', TELEPHONE);
    await p.goto(`${WEB}/rh?onglet=carriere&userId=${b}`);
    const mvt2 = p.locator('[data-testid=mouvement]', { hasText: `Chef de Division — Division écran ${S}` });
    await mvt2.waitFor();
    check('« Droits refusés » et motif de l’administrateur', /Droits refusés/.test(await mvt2.innerText()) && /Motif du refus de l’administrateur : Acte à reprendre/.test(await mvt2.innerText()));
    await p.screenshot({ path: `${E.SHOTS}/nr_droits_refuses_mobile.png`, fullPage: true });
    await p.goto(`${WEB}/rh?onglet=carriere&userId=${a}`);
    await p.locator('[data-testid=mouvement]', { hasText: FONCTION }).waitFor();
    check('« Droits appliqués » sur la nomination confirmée', /Droits appliqués/.test(await p.locator('[data-testid=mouvement]', { hasText: FONCTION }).innerText()));
    check('téléphone : sans défilement horizontal (RH)', await sansDefilementHorizontal(p));
    await p.context().close();
  } finally {
    await prisma.user.updateMany({ where: { id: { in: [chef, a, b] } }, data: { status: 'SUSPENDU' } });
    await prisma.familleActeRh.update({ where: { code: 'DECISION_NOMINATION' }, data: { registreId: familleAvant.registreId } });
    await b0.close();
    await prisma.$disconnect();
  }
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
