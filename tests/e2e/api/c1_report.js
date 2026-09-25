// Complément 2 — changement d'année : rien d'encore en cours ne disparaît (listes, tableau de bord, export, rappels).
const E = require('../config');
require('reflect-metadata');
const ExcelJS = require('exceljs');
const { NestFactory } = require('@nestjs/core');
const reg = require(E.etat('registres.json'));
const ids = require(E.etat('ids.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
let ok = 0, ko = 0; const check = (l, c, d = '') => { c ? ok++ : ko++; console.log(`${c ? 'OK ' : 'KO!'} ${l}${d ? ' — ' + d : ''}`); };
const tokens = {};
async function api(base, key, method, path, body, form, raw) {
  const tk = `${base}|${key}`;
  if (!tokens[tk]) tokens[tk] = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${key}@test.local`, password: 'Password123!' }) })).json()).accessToken;
  const h = { Authorization: 'Bearer ' + tokens[tk] }; let b;
  if (form) { b = new FormData(); for (const [k, v] of Object.entries(form)) b.append(k, v); }
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(base + path, { method, headers: h, body: b });
  if (raw) return r;
  return { status: r.status, body: await r.json().catch(() => null) };
}
const N = 'http://localhost:3000', F = 'http://localhost:3001';
const J = 864e5;
(async () => {
  const S = Date.now().toString(36);
  const an = new Date().getFullYear();
  const arr = (objet) => api(N, 'secdg', 'POST', '/courrier/arrivees', undefined, { registreId: reg.ARR, dateReception: new Date().toISOString(), expediteur: 'Test report', objet: `${objet} ${S}`, confidentialite: 'ORDINAIRE' }).then((r) => r.body);
  // --- Préparation en 2026 (horloge réelle)
  const enCours = await arr('Imputé non traité');
  const impEnCours = (await api(N, 'dn', 'POST', `/courrier/arrivees/${enCours.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION', echeance: new Date(Date.now() + 5 * J).toISOString() })).body;
  const aImputer = await arr('Jamais imputé');
  const classe = await arr('Classé');
  const ic = (await api(N, 'dn', 'POST', `/courrier/arrivees/${classe.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' })).body;
  await api(N, 'chefdpe', 'POST', `/courrier/imputations/${ic.id}/traiter`, {}); await api(N, 'secdg', 'POST', `/courrier/arrivees/${classe.id}/classer`);
  const classeInfo = await arr('Classé, information non traitée');
  const ia = (await api(N, 'dn', 'POST', `/courrier/arrivees/${classeInfo.id}/imputations`, { imputeAId: ids.chefdpe, nature: 'ATTRIBUTION' })).body;
  await api(N, 'dn', 'POST', `/courrier/arrivees/${classeInfo.id}/imputations`, { imputeAId: ids.chefssr, nature: 'INFORMATION' });
  await api(N, 'chefdpe', 'POST', `/courrier/imputations/${ia.id}/traiter`, {}); await api(N, 'secdg', 'POST', `/courrier/arrivees/${classeInfo.id}/classer`);
  const acte = (o) => api(N, 'agent1', 'POST', '/courrier/actes', { registreId: reg.DEP, objet: `${o} ${S}`, confidentialite: 'ORDINAIRE' }).then((r) => r.body);
  const aSigner = await acte('Acte à signer'); await api(N, 'agent1', 'POST', `/courrier/actes/${aSigner.id}/soumettre`);
  await api(N, 'chefssr', 'POST', `/courrier/actes/${aSigner.id}/viser`, {}); await api(N, 'chefdpe', 'POST', `/courrier/actes/${aSigner.id}/viser`, {});
  const expedie = await acte('Acte expédié'); await api(N, 'agent1', 'POST', `/courrier/actes/${expedie.id}/soumettre`);
  await api(N, 'chefssr', 'POST', `/courrier/actes/${expedie.id}/viser`, {}); await api(N, 'chefdpe', 'POST', `/courrier/actes/${expedie.id}/viser`, {});
  await api(N, 'dn', 'POST', `/courrier/actes/${expedie.id}/signer`); await api(N, 'secdg', 'POST', `/courrier/actes/${expedie.id}/expedier`, { modeExpedition: 'Porteur' });
  const brouillon = await acte('Brouillon');
  console.log(`Préparé en ${an} : arrivées ${[enCours, aImputer, classe, classeInfo].map((x) => x.numero).join(', ')}`);

  // --- Vu depuis l'instance à horloge +1 an
  const ids_ = (l) => new Set(l.map((x) => x.id));
  const dnArr = ids_((await api(F, 'dn', 'GET', '/courrier/arrivees')).body);
  check(`${an + 1}, vue par défaut (DN) : arrivée ${an} imputée non traitée présente`, dnArr.has(enCours.id));
  check(`${an + 1}, vue par défaut (DN) : arrivée ${an} jamais imputée présente`, dnArr.has(aImputer.id));
  check(`${an + 1}, vue par défaut (DN) : arrivée ${an} classée mais avec une imputation non traitée présente`, dnArr.has(classeInfo.id));
  check(`${an + 1}, vue par défaut (DN) : arrivée ${an} classée et terminée absente`, !dnArr.has(classe.id));
  const dnArr2026 = ids_((await api(F, 'dn', 'GET', `/courrier/arrivees?annee=${an}`)).body);
  check(`filtre annee=${an} : l’arrivée classée reste accessible`, dnArr2026.has(classe.id) && dnArr2026.has(enCours.id));
  const dnActes = ids_((await api(F, 'dn', 'GET', '/courrier/actes')).body);
  check(`${an + 1}, vue par défaut : acte ${an} à signer présent, acte expédié absent`, dnActes.has(aSigner.id) && !dnActes.has(expedie.id));
  check(`${an + 1}, vue par défaut du rédacteur : son brouillon ${an} présent`, ids_((await api(F, 'agent1', 'GET', '/courrier/actes')).body).has(brouillon.id));
  check(`filtre annee=${an} : l’acte expédié reste accessible`, ids_((await api(F, 'dn', 'GET', `/courrier/actes?annee=${an}`)).body).has(expedie.id));

  const tbDn = (await api(F, 'dn', 'GET', '/courrier/tableau-de-bord')).body;
  const tbDpe = (await api(F, 'chefdpe', 'GET', '/courrier/tableau-de-bord')).body;
  const tbSsr = (await api(F, 'chefssr', 'GET', '/courrier/tableau-de-bord')).body;
  const listeDpe = (await api(F, 'chefdpe', 'GET', '/courrier/arrivees')).body;
  const impDpe = listeDpe.flatMap((a) => a.imputations).find((i) => i.id === impEnCours.id);
  check(`tableau de bord ${an + 1} (DN) : l’arrivée ${an} jamais imputée compte dans « à imputer », l’acte ${an} dans « à signer »`, tbDn.aImputer >= 1 && tbDn.aSigner >= 1, JSON.stringify(tbDn));
  check(`tableau de bord ${an + 1} (chefdpe) : l’imputation ${an} compte dans « à traiter » et « en retard »`, !!impDpe && tbDpe.aTraiter >= 1 && tbDpe.enRetard >= 1, JSON.stringify(tbDpe));
  check(`tableau de bord ${an + 1} (chefssr) : l’information ${an} non traitée compte dans « à traiter »`, tbSsr.aTraiter >= 1, JSON.stringify(tbSsr));
  const tbDnRecalc = (await api(F, 'dn', 'GET', '/courrier/arrivees')).body.filter((a) => a.statut === 'ENREGISTRE' && a.droits.imputer).length;
  check('« à imputer » = exactement les arrivées de la liste que l’on peut imputer', tbDn.aImputer === tbDnRecalc, `${tbDn.aImputer} / ${tbDnRecalc}`);

  const r = await api(F, 'dn', 'GET', '/courrier/arrivees/export.xlsx', undefined, undefined, true);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const nums = []; wb.worksheets[0].eachRow((row, i) => { if (i > 1) nums.push(String(row.values[1])); });
  const ecran = (await api(F, 'dn', 'GET', '/courrier/arrivees')).body.map((a) => a.numero).sort();
  check(`export ${an + 1} = écran (${nums.length} lignes, arrivée ${an} en cours incluse, classée exclue)`, JSON.stringify(nums.sort()) === JSON.stringify(ecran) && nums.includes(enCours.numero) && !nums.includes(classe.numero));

  // --- Rappels : pas de filtre d'année (vrai service, date simulée +1 an)
  const { AppModule } = require(E.API_DIST + '/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const svc = app.get(require(E.API_DIST + '/courrier/rappels.service').CourrierRappelsService);
  await svc.envoyerRappels(new Date(Date.now() + 365 * J));
  const imp = await prisma.imputationCourrier.findUnique({ where: { id: impEnCours.id } });
  check(`rappels : l’imputation ${an} non traitée reçoit son rappel de retard en ${an + 1}`, !!imp.rappelRetardEnvoyeAt);
  await app.close(); await prisma.$disconnect();
  console.log(`\nBilan : ${ok} conformes, ${ko} non conformes`);
})().catch((e) => { console.error(e); process.exit(1); });
