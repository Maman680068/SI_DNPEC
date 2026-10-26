// Tableau de bord par profil (Chromium, bureau) : la bande des quatre chiffres affiche exactement ceux que
// l'API calcule pour le profil (libellé, valeur, lien), puis le bloc « À traiter » juste dessous ; un
// chiffre sans page accessible (stagiaire : congés) n'est pas un lien.
const { browser, loginPage, check, bilan, WEB } = require('./helpers');
const { call } = require('../lib');

(async () => {
  // Deux activités au plan de la Direction (l'une échue, l'autre à mi-parcours) : de quoi vérifier l'ordre.
  const annee = new Date().getUTCFullYear();
  const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const plan = (await call('dn', 'GET', `/api/v1/plan-travail?annee=${annee}`)).body;
  const uDir = plan.unites.find((u) => u.type === 'DIRECTION');
  const obj = (await call('dn', 'POST', '/api/v1/plan-travail/objectifs', { annee, uniteId: uDir.id, libelle: `Pilotage Direction ${Date.now()}` })).body;
  const resp = (await call('dn', 'GET', `/api/v1/plan-travail/unites/${uDir.id}/responsables-possibles`)).body[0];
  for (const [l, d, f] of [['Activité à mi-parcours', -10, 10], ['Activité échue', -20, -2]]) {
    await call('dn', 'POST', `/api/v1/plan-travail/objectifs/${obj.id}/activites`, { libelle: l, responsableId: resp.id, dateDebut: jour(d), dateFin: jour(f), indicateur: 'Livrable' });
  }
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
      // Vue Direction : plan de toute la DNPEC (ordre de l'API), puis décisions et absences, avant le suivi de l'équipe.
      const av = (await call('dn', 'GET', '/api/v1/plan-travail/avancement-direction')).body;
      check(`dn : vue du plan alimentée (${av.total} activités)`, av.total >= 2);
      if (av.total > 0) {
        const panneau = p.getByTestId('avancement-activites');
        await panneau.waitFor();
        const ordre = await panneau.locator('[data-testid=ligne-activite] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
        check(`dn : panneau du plan = ${av.activites.length} activités dans l’ordre de l’API, « Voir tout le plan »`, ordre.join() === av.activites.map((a) => `/plan-travail?activite=${a.id}`).join() && (await panneau.getByRole('link', { name: /Voir tout le plan/ }).count()) === 1);
      }
      const ordreBlocs = await p.evaluate(() => {
        const pos = (t) => [...document.querySelectorAll('[data-testid]')].findIndex((e) => e.getAttribute('data-testid') === t);
        return { plan: pos('avancement-activites'), blocs: pos('blocs-direction'), suivi: pos('suivi-equipe') };
      });
      check('dn : « Décisions et absences » après le plan et avant le suivi de l’équipe', ordreBlocs.blocs > ordreBlocs.plan && ordreBlocs.blocs < ordreBlocs.suivi && (await p.getByTestId('blocs-direction').locator('[data-testid=bloc-decisions], [data-testid=bloc-absences]').count()) === 2, JSON.stringify(ordreBlocs));
      await bande.locator('[data-testid=chiffre-instructions]').click();
      await p.waitForURL('**/instructions');
      check('dn : le chiffre « Instructions non exécutées » ouvre les instructions', true);
    }
    await p.context().close();
  }
  bilan();
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
