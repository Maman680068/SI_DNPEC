// C2 — tableau de bord courrier = décompte des listes par les droits affichés (ce que montre « À faire »)
// et, pour la bande de compteurs de la page, par statut des mêmes listes visibles (jamais plus).
const E = require('../config');
const { call, upload, ids, check, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36);
const I = (id) => ({ 'X-Interim-For': id });
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
}
(async () => {
  await suppleance('chefdpe', 'chefssr');
  // Une imputation EN_COURS sur un courrier ensuite annulé : ne doit plus compter « à traiter ».
  const A = (await upload('secdg', '/courrier/arrivees', { registreId: reg.ARR, dateReception: iso(0), expediteur: 'Test', objet: `C2 tableau ${S}`, confidentialite: 'ORDINAIRE' })).body;
  await call('dn', 'POST', `/courrier/arrivees/${A.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', echeance: iso(3 * J) });
  const avant = (await call('chefdpe', 'GET', '/courrier/tableau-de-bord')).body.aTraiter;
  await call('secdg', 'POST', `/courrier/arrivees/${A.id}/annuler`, { motif: 'Test du tableau de bord' });
  const apres = (await call('chefdpe', 'GET', '/courrier/tableau-de-bord')).body.aTraiter;
  check('imputation d’un courrier annulé : ne compte plus « à traiter »', apres === avant - 1, `${avant} → ${apres}`);

  const acteurs = Object.keys(ids).filter((k) => !/^[A-Z]/.test(k)).map((k) => ({ k, h: {}, label: k }));
  acteurs.push({ k: 'chefssr', h: I(ids.chefdpe), label: 'chefssr P.I. chefdpe' });
  for (const a of acteurs) {
    const tb = (await call(a.k, 'GET', '/courrier/tableau-de-bord', undefined, a.h)).body;
    const arr = (await call(a.k, 'GET', '/courrier/arrivees', undefined, a.h)).body;
    const act = (await call(a.k, 'GET', '/courrier/actes', undefined, a.h)).body;
    const imps = arr.flatMap((x) => x.imputations.filter((i) => i.droits.traiter));
    const calc = {
      aImputer: arr.filter((x) => x.statut === 'ENREGISTRE' && x.droits.imputer).length,
      aTraiter: imps.length,
      enRetard: imps.filter((i) => i.echeance && new Date(i.echeance) < new Date()).length,
      aViser: act.filter((x) => x.droits.viser).length,
      aSigner: act.filter((x) => x.droits.signer).length,
      aExpedier: act.filter((x) => x.droits.expedier).length,
      priseDeConnaissance: act.filter((x) => x.droits.prendreConnaissance).length,
      brouillons: act.filter((x) => x.droits.modifier).length,
      // Bande de compteurs de la page (vue du registre) : statuts des mêmes listes visibles.
      arriveesEnAttente: arr.filter((x) => x.statut === 'ENREGISTRE').length,
      arriveesEnTraitement: arr.filter((x) => x.statut === 'IMPUTE').length,
      visasEnCours: act.filter((x) => x.statut === 'EN_VISA').length,
      actesASigner: act.filter((x) => x.statut === 'A_SIGNER').length,
      actesAExpedier: act.filter((x) => x.statut === 'SIGNE').length,
    };
    check(`${a.label} : tableau de bord = listes filtrées par les droits (et statuts des listes visibles)`, JSON.stringify(tb) === JSON.stringify(calc), JSON.stringify(tb));
  }
  process.exit(bilan() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
