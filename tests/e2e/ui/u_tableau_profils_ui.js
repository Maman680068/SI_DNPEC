// Tableau de bord par profil (Chromium, bureau) : la bande des quatre chiffres affiche exactement ceux que
// l'API calcule pour le profil (libellé, valeur, lien), puis le bloc « À traiter » juste dessous ; un
// chiffre sans page accessible (stagiaire : congés) n'est pas un lien.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call } = require('../lib');

(async () => {
  const b = await browser();
  for (const k of ['dn', 'drh', 'admin', 'assdn', 'chefdpe', 'agent1']) {
    const p = await loginPage(b, k, { width: 1440, height: 900 });
    const api = (await call(k, 'GET', '/api/v1/tableau-de-bord/chiffres')).body;
    const bande = p.getByTestId('bande-compteurs');
    await bande.waitFor();
    const vus = await bande.locator('[data-testid^=chiffre-]').evaluateAll((els) => els.map((e) => ({ cle: e.getAttribute('data-testid').slice(8), lien: e.getAttribute('href'), texte: e.innerText })));
    const conforme = vus.length === 4 && api.chiffres.every((c, i) => vus[i].cle === c.cle && vus[i].lien === c.lien && vus[i].texte.includes(c.libelle) && vus[i].texte.includes(String(c.valeur ?? '—')));
    check(`${k} (${api.profil}) : bande = chiffres de l’API, avec leurs liens`, conforme, JSON.stringify(vus.map((v) => v.cle)));
    const suite = await p.evaluate(() => { const a = document.querySelector('[data-testid=a-traiter]'); return a ? !!(document.querySelector('[data-testid=bande-compteurs]').compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) : null; });
    check(`${k} : « À traiter » sous la bande (quand il est affiché)`, suite !== false);
    if (k === 'dn') {
      await bande.locator('[data-testid=chiffre-instructions]').click();
      await p.waitForURL('**/instructions');
      check('dn : le chiffre « Instructions non exécutées » ouvre les instructions', true);
    }
    await p.context().close();
  }
  bilan();
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
