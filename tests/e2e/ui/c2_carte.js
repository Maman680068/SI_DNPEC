// C2 — courrier du tableau de bord général : depuis la refonte de l'interface, lignes « Courrier… » et
// « Actes… » du bloc « À traiter » (GET api/v1/navigation, mêmes compteurs que GET /courrier/tableau-de-bord).
const E = require('../config');
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call, ids } = require('../lib');
const SHOTS = E.SHOTS;
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
// Lignes « À traiter » du courrier, dans l'ordre de l'écran : « <n> <libellé> » (compteur API du courrier).
const LIB = { aImputer: 'Courrier à imputer', aTraiter: 'Courrier à traiter', aViser: 'Actes à viser', aSigner: 'Actes à signer', aExpedier: 'Actes à expédier', priseDeConnaissance: 'Actes à prendre en connaissance', brouillons: 'Brouillons à reprendre' };
const attendu = (tb) => Object.keys(LIB).filter((k) => tb[k] > 0).map((k) => `${tb[k]} ${LIB[k]}`);
const LIGNES = '[data-testid=a-traiter] a[data-testid^=a-traiter-courrier-]';
const pastilles = async (p) => (await p.locator(LIGNES).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
const ligne = (p, texte) => p.locator(LIGNES, { hasText: texte });
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
(async () => {
  await suppleance('chefdpe', 'chefssr');
  const b = await browser();
  const dn = await loginPage(b, 'dn');
  await dn.locator(LIGNES).first().waitFor();
  const tbDn = (await call('dn', 'GET', '/courrier/tableau-de-bord')).body;
  const vus = await pastilles(dn);
  check('DN : pastilles = compteurs non nuls de l’API', vus.join(' · ') === attendu(tbDn).join(' · '), `${vus.join(' · ')} ⇐ ${JSON.stringify(tbDn)}`);
  check('tableau de bord : compteurs et suivi de l’équipe présents', (await dn.getByTestId('bande-compteurs').count()) === 1 && (await dn.getByTestId('suivi-equipe').count()) === 1);
  await dn.screenshot({ path: `${SHOTS}/c2_carte_tableau_de_bord_desktop.png` });
  await ligne(dn, 'à imputer').click();
  await dn.waitForURL('**/courrier?rubrique=aImputer');
  await dn.locator('[data-rubrique=aImputer]').waitFor();
  check('clic « à imputer » : /courrier sur cette rubrique seule', (await dn.locator('[data-rubrique]').count()) === 1);

  // Administrateur : carte seulement s'il a un élément personnel en attente.
  const tbAdmin = (await call('admin', 'GET', '/courrier/tableau-de-bord')).body;
  const admin = await loginPage(b, 'admin');
  await admin.getByTestId('a-traiter').waitFor();
  await admin.waitForTimeout(1500);
  const rien = Object.values(tbAdmin).every((n) => n === 0);
  check('administrateur sans élément personnel en attente : aucune ligne courrier', rien && (await admin.locator(LIGNES).count()) === 0, JSON.stringify(tbAdmin));
  const brA = (await call('admin', 'POST', '/courrier/actes', { registreId: require(E.etat('registres.json')).DEP, confidentialite: 'ORDINAIRE', objet: 'Brouillon personnel' })).body;
  await admin.reload();
  await admin.locator(LIGNES).first().waitFor();
  check('administrateur avec un brouillon : ligne « 1 Brouillons à reprendre »', (await pastilles(admin)).join() === '1 Brouillons à reprendre', (await pastilles(admin)).join());
  await ligne(admin, 'Brouillons').click();
  await admin.waitForURL('**/courrier?rubrique=brouillons');
  await admin.locator('[data-rubrique=brouillons] [data-testid=ligne-acte]').first().waitFor();
  check('… lien vers « Brouillons à reprendre » de son courrier', (await admin.locator('[data-testid=ligne-acte]').count()) === 1);
  await call('admin', 'DELETE', `/courrier/actes/${brA.id}`);

  // Un compte sans rien à faire (créé pour le test, retiré ensuite) : aucune carte.
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const modele = await prisma.user.findUnique({ where: { email: 'agent1@test.local' }, select: { passwordHash: true } });
  await prisma.user.deleteMany({ where: { email: 'vide@test.local' } });
  const vide = await prisma.user.create({ data: { email: 'vide@test.local', passwordHash: modele.passwordHash, firstName: 'Vide', lastName: 'Test', role: 'AGENT', status: 'ACTIF' } });
  try {
    const tbVide = (await call('vide', 'GET', '/courrier/tableau-de-bord')).body;
    const pv = await loginPage(b, 'vide');
    await pv.getByTestId('bande-compteurs').waitFor();
    await pv.waitForTimeout(1500);
    check('compte sans rien à faire (tous compteurs à zéro) : ni ligne courrier, ni bloc « À traiter »', Object.values(tbVide).every((n) => n === 0) && (await pv.locator(LIGNES).count()) === 0 && (await pv.getByTestId('a-traiter').count()) === 0, JSON.stringify(tbVide));
    await pv.context().close();
  } finally {
    await prisma.refreshToken?.deleteMany?.({ where: { userId: vide.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: vide.id } }).catch(async (e) => {
      console.log('   (compte de test non supprimable, suspendu :', e.code, ')');
      await prisma.user.update({ where: { id: vide.id }, data: { status: 'SUSPENDU' } });
    });
    await prisma.$disconnect();
  }

  const ssr = await loginPage(b, 'chefssr');
  await ssr.locator(LIGNES).first().waitFor();
  const propre = await pastilles(ssr);
  await ssr.getByRole('button', { name: /Agir en intérim/ }).first().click();
  await ssr.getByRole('menuitemradio', { name: /CHEFDPE Test/ }).click();
  await ssr.getByText('Mode intérim').waitFor();
  await ssr.waitForTimeout(1500);
  const tbPi = (await call('chefssr', 'GET', '/courrier/tableau-de-bord', undefined, { 'X-Interim-For': ids.chefdpe })).body;
  const pi = await pastilles(ssr);
  check('intérim : compteurs du rôle emprunté (= API avec X-Interim-For)', pi.join(' · ') === attendu(tbPi).join(' · '), `propre [${propre.join(' · ')}] → P.I. [${pi.join(' · ')}]`);

  const m = await loginPage(b, 'dn', { width: 390, height: 844 });
  await m.locator(LIGNES).first().waitFor();
  check('mobile 390 px : pas de défilement horizontal', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await m.getByTestId('a-traiter').scrollIntoViewIfNeeded();
  await m.screenshot({ path: `${SHOTS}/c2_carte_tableau_de_bord_mobile.png` });
  await b.close();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
