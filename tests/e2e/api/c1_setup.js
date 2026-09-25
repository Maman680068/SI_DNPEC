// D7 — mise en place : registres, habilitations (API réelle). Idempotent.
const E = require('../config');
const { call, ids, expect, check, bilan } = require('../lib');
const fs = require('fs');
(async () => {
  console.log('— Registres (administration)');
  expect('DN tente de créer un registre (admin seulement)', await call('dn', 'POST', '/courrier/registres', { code: 'XX', libelle: 'Test', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{seq}' }), 403);
  expect('gabarit sans {seq}', await call('admin', 'POST', '/courrier/registres', { code: 'XX', libelle: 'Test', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: 'ABC/{annee}' }), 400);
  expect('gabarit avec variable inconnue', await call('admin', 'POST', '/courrier/registres', { code: 'XX', libelle: 'Test', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{seq}/{mois}' }), 400);
  const defs = [
    ['ARR', 'Courrier arrivée DNPEC', 'ARRIVEE', 'DIRECTION', '{seq:4}/MEFB/DNPEC/{code}/{annee}'],
    ['ARRU', 'Courrier arrivée des unités', 'ARRIVEE', 'UNITE', '{seq:4}/{unite}/ARR/{annee}'],
    ['DEP', 'Courrier départ DNPEC', 'DEPART', 'DIRECTION', '{seq:4}/MEFB/DNPEC/{code}/{annee}'],
    ['DEPU', 'Courrier départ des unités', 'DEPART', 'UNITE', '{seq:4}/MEFB/DNPEC/{unite}/{annee}'],
    ['NS', 'Notes de service', 'ACTE', 'DIRECTION', '{seq:3}/MEFB/DNPEC/NS/{annee}'],
    ['ATT', 'Attestations', 'ACTE', 'UNITE', '{seq:3}/{unite}/ATT/{annee}'],
  ];
  const existants = (await call('admin', 'GET', '/courrier/registres')).body;
  const reg = {};
  for (const [code, libelle, nature, portee, gabaritNumero] of defs) {
    let r = existants.find((x) => x.code === code);
    if (!r) { const c = await call('admin', 'POST', '/courrier/registres', { code, libelle, nature, portee, gabaritNumero }); expect(`création registre ${code}`, c, 201); r = c.body; }
    reg[code] = r.id;
  }
  expect('code de registre en double', await call('admin', 'POST', '/courrier/registres', { code: 'ARR', libelle: 'Test', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{seq}' }), 409);

  console.log('— Habilitations (secrétariat)');
  const H = [
    ['secdg', 'ARR', 'DNPEC'], ['secdg', 'DEP', 'DNPEC'], ['secdg', 'NS', 'DNPEC'],
    ['secdpe', 'ARRU', `DIV:${ids.DPE}`], ['secdpe', 'DEPU', `DIV:${ids.DPE}`], ['secdpe', 'ATT', `DIV:${ids.DPE}`],
    ['secdpe', 'ARRU', `DIV:${ids.DEE}`],
  ];
  const hab = (await call('admin', 'GET', '/courrier/habilitations')).body;
  for (const [u, code, uniteKey] of H) {
    if (hab.some((h) => h.userId === ids[u] && h.registreId === reg[code] && h.uniteKey === uniteKey && !h.revoqueeAt)) continue;
    expect(`habilitation ${u} → ${code} (${uniteKey.slice(0, 5)})`, await call('admin', 'POST', '/courrier/habilitations', { userId: ids[u], registreId: reg[code], uniteKey }), 201);
  }
  expect('habilitation en double', await call('admin', 'POST', '/courrier/habilitations', { userId: ids.secdg, registreId: reg.ARR }), 409);
  expect('habilitation sur registre UNITE sans unité', await call('admin', 'POST', '/courrier/habilitations', { userId: ids.secdg, registreId: reg.ARRU }), 400);
  expect('DN tente d’accorder une habilitation', await call('dn', 'POST', '/courrier/habilitations', { userId: ids.secdg, registreId: reg.DEP }), 403);
  fs.writeFileSync(E.etat('registres.json'), JSON.stringify(reg, null, 1));
  bilan();
})().catch((e) => { console.error(e); process.exit(1); });
