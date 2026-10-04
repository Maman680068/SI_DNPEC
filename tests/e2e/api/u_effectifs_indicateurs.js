// Refonte de l'interface (étape 8) — écran Effectifs : indicateurs ajoutés à GET api/v1/rh/effectifs
// (répartition « statut et catégorie », départs prévus dans les 12 mois, matricules provisoires) et
// export Excel GET api/v1/rh/effectifs/export.xlsx. Même périmètre que l'écran : DRH, DN, DNA ; 403 pour
// l'agent, les chefs, l'administrateur, l'assistant et le stagiaire ; 401 sans session. Agrégats
// seulement : aucun nom d'agent, aucun matricule, aucune donnée protégée dans la réponse ni dans le
// fichier. Calcul à la lecture (une fin prévue ajoutée compte aussitôt). Règles des alertes inchangées.
const { call, ids, login, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const ExcelJS = require('exceljs');
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const URL = '/api/v1/rh/effectifs';
const EXPORT = '/api/v1/rh/effectifs/export.xlsx';
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const somme = (l) => l.reduce((t, x) => t + x.nombre, 0);
const telecharger = async (k) => fetch(BASE + EXPORT, { headers: { Authorization: 'Bearer ' + (await login(k)) } });

(async () => {
  console.log('— Accès : DRH, DN, DNA seulement');
  check('sans session : 401 (lecture)', (await fetch(BASE + URL)).status === 401);
  check('sans session : 401 (export)', (await fetch(BASE + EXPORT)).status === 401);
  const stg = (await call('admin', 'POST', '/users', { email: `efst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `EffStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('stagiaire de test créé', !!stg.id, JSON.stringify(stg).slice(0, 120));
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'admin', 'assdn', `efst${S}`]) {
    const r = await call(k, 'GET', URL);
    expect(`${k} : effectifs refusés`, r, 403);
    check(`${k} : enveloppe api/v1 (code, trace_id), aucun agrégat`, r.body && r.body.code && r.body.trace_id && !('total' in r.body) && !('parStatutCategorie' in r.body));
    const x = await telecharger(k);
    check(`${k} : export refusé → ${x.status}`, x.status === 403 && !/spreadsheetml/.test(x.headers.get('content-type') || ''));
  }

  console.log('— Forme des indicateurs');
  const r = await call('drh', 'GET', URL);
  expect('DRH : effectifs lus', r, 200);
  const e = r.body;
  check('indicateurs historiques présents (total, unités, statut, catégorie, ancienneté, part des femmes)', e.total > 0 && Array.isArray(e.parUnite) && Array.isArray(e.parStatut) && Array.isArray(e.parCategorie) && 'ancienneteMoyenneAnnees' in e && 'partFemmes' in e);
  check('nouveaux : statut et catégorie, départs prévus (12 mois), matricules provisoires', Array.isArray(e.parStatutCategorie) && Number.isInteger(e.departsPrevus) && e.departsHorizonMois === 12 && Number.isInteger(e.matriculesProvisoires), JSON.stringify({ d: e.departsPrevus, m: e.matriculesProvisoires }));
  check('chaque répartition couvre tous les agents (somme = total)', [e.parUnite, e.parStatut, e.parCategorie, e.parStatutCategorie].every((l) => somme(l) === e.total));
  const fonctionnaires = (e.parStatut.find((x) => x.libelle === 'Fonctionnaire') || { nombre: 0 }).nombre;
  check('statut et catégorie : les lignes « Fonctionnaires — … » totalisent les fonctionnaires', somme(e.parStatutCategorie.filter((x) => x.libelle.startsWith('Fonctionnaires — '))) === fonctionnaires);
  const presents = await prisma.agent.findMany({ where: { statut: { not: 'PARTI' } }, select: { nom: true, prenoms: true, matricule: true, matriculeProvisoire: true, dateFinPrevue: true } });
  check('total et matricules provisoires = base', e.total === presents.length && e.matriculesProvisoires === presents.filter((a) => a.matriculeProvisoire).length);
  const corps = JSON.stringify(e);
  const nominatif = presents.filter((a) => a.nom.length >= 4 && (corps.includes(`"${a.nom}`) || corps.includes(a.matricule) || corps.includes(`${a.prenoms} ${a.nom}`)));
  check('aucun nom ni matricule d’agent dans la réponse', nominatif.length === 0, nominatif.slice(0, 3).map((a) => a.nom).join(', '));
  check('aucune donnée protégée (motif, salaire, dossier niveau 2)', !/motif|salaire|nationalNumber|adresse|telephone|email/i.test(corps));
  for (const k of ['dn', 'dna']) {
    const x = await call(k, 'GET', URL);
    check(`${k} : mêmes agrégats que le DRH`, x.status === 200 && x.body.total === e.total && x.body.departsPrevus === e.departsPrevus && JSON.stringify(x.body.parStatutCategorie) === JSON.stringify(e.parStatutCategorie));
  }

  console.log('— Départs prévus : calculés à la lecture');
  const a2 = await prisma.user.findUnique({ where: { id: ids.agent2 }, select: { agentId: true } });
  const avant = await prisma.agent.findUnique({ where: { id: a2.agentId }, select: { dateFinPrevue: true, natureFinPrevue: true } });
  try {
    await prisma.agent.update({ where: { id: a2.agentId }, data: { dateFinPrevue: new Date(jour(400)), natureFinPrevue: 'CONTRAT' } });
    const base = (await call('drh', 'GET', URL)).body.departsPrevus;
    await prisma.agent.update({ where: { id: a2.agentId }, data: { dateFinPrevue: new Date(jour(100)) } });
    const apres = (await call('drh', 'GET', URL)).body.departsPrevus;
    check('fin de contrat dans 100 jours : un départ prévu de plus (400 jours : hors horizon)', apres === base + 1, `${base} → ${apres}`);
  } finally {
    await prisma.agent.update({ where: { id: a2.agentId }, data: { dateFinPrevue: avant.dateFinPrevue, natureFinPrevue: avant.natureFinPrevue } });
  }

  console.log('— Export Excel (mêmes agrégats, aucune donnée nominative)');
  for (const k of ['drh', 'dn', 'dna']) {
    const x = await telecharger(k);
    check(`${k} : export → ${x.status}, fichier Excel`, x.status === 200 && /spreadsheetml/.test(x.headers.get('content-type') || '') && /effectifs_\d{4}-\d{2}-\d{2}\.xlsx/.test(x.headers.get('content-disposition') || ''));
    if (k !== 'drh') continue;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await x.arrayBuffer()));
    const feuilles = wb.worksheets.map((w) => w.name);
    check('feuilles : Indicateurs, Par unité, Par statut et catégorie', feuilles.join('|') === 'Indicateurs|Par unité|Par statut et catégorie', feuilles.join(', '));
    const unites = wb.getWorksheet('Par unité').getSheetValues().slice(2).filter(Boolean).map((v) => ({ libelle: v[1], nombre: v[2] }));
    check('feuille « Par unité » = réponse de l’API', JSON.stringify(unites) === JSON.stringify((await call('drh', 'GET', URL)).body.parUnite));
    const texte = wb.worksheets.flatMap((w) => w.getSheetValues().flat()).filter((v) => typeof v === 'string').join(' ');
    const noms = presents.filter((a) => a.nom.length >= 4 && (texte.includes(a.matricule) || texte.includes(`${a.prenoms} ${a.nom}`)));
    check('aucun nom ni matricule d’agent dans le fichier', noms.length === 0, noms.slice(0, 3).map((a) => a.nom).join(', '));
  }
  const audit = await prisma.auditLog.findFirst({ where: { entityType: 'Effectifs', actorId: ids.dna }, orderBy: { createdAt: 'desc' } });
  check('export tracé au journal d’audit (entité « Effectifs »)', !!audit && audit.metadata && audit.metadata.event === 'export_excel');

  console.log('— Règles des alertes inchangées (DRH seul)');
  expect('DN : alertes nominatives refusées', await call('dn', 'GET', '/api/v1/rh/alertes'), 403);
  expect('DRH : alertes lues', await call('drh', 'GET', '/api/v1/rh/alertes'), 200);

  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(2);
});
