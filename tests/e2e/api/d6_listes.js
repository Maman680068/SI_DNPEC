// D6 — listes de choix de l'écran : stagiaires disponibles = comptes que la création accepte ;
// registres d'attestation = registres que la préparation de l'acte accepte.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-5);
const J = 864e5; const d = (n) => new Date(Date.UTC(new Date().getUTCFullYear() + 3, 5, 1) + n * J).toISOString().slice(0, 10);
(async () => {
  for (const k of ['dn', 'chefdpe', 'admin']) {
    expect(`${k} : stagiaires disponibles`, await call(k, 'GET', '/stages/stagiaires-disponibles'), 403);
    expect(`${k} : registres d’attestation`, await call(k, 'GET', '/stages/registres-attestation'), 403);
  }
  const libre = (await call('admin', 'POST', '/users', { email: `lib${S}@test.local`, password: 'Password123!', firstName: 'Libre', lastName: S, role: 'STAGIAIRE' })).body.id;
  const pris = (await call('admin', 'POST', '/users', { email: `pri${S}@test.local`, password: 'Password123!', firstName: 'Pris', lastName: S, role: 'STAGIAIRE' })).body.id;
  await call('drh', 'POST', '/stages', { stagiaireId: pris, etablissement: 'ISSEG', dateDebut: d(0), dateFin: d(10) });
  const liste = (await call('drh', 'GET', '/stages/stagiaires-disponibles')).body.map((u) => u.id);
  const attendus = (await prisma.user.findMany({ where: { role: 'STAGIAIRE', status: 'ACTIF', stagesSuivis: { none: { statut: { in: ['PREVU', 'EN_COURS'] } } } }, select: { id: true } })).map((u) => u.id);
  check(`stagiaires disponibles : ${liste.length} = comptes stagiaires actifs sans stage ouvert`, liste.length === attendus.length && liste.every((i) => attendus.includes(i)));
  check('le stagiaire libre est proposé, celui qui a un stage non', liste.includes(libre) && !liste.includes(pris) && !liste.includes(ids.agent1));
  expect('création pour le stagiaire proposé', await call('drh', 'POST', '/stages', { stagiaireId: libre, etablissement: 'ISSEG', dateDebut: d(0), dateFin: d(10) }), 201);
  expect('création pour un compte non proposé (stage déjà ouvert)', await call('drh', 'POST', '/stages', { stagiaireId: pris, etablissement: 'ISSEG', dateDebut: d(0), dateFin: d(10) }), 409);
  const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
  const regU = (await call('admin', 'POST', '/courrier/registres', { code: `AU${L}`, libelle: `Actes d’unité ${S}`, nature: 'ACTE', portee: 'UNITE', gabaritNumero: '{unite}/{seq}' })).body;
  const regs = (await call('drh', 'GET', '/stages/registres-attestation')).body;
  check('registres proposés : actes de la Direction actifs seulement', regs.length > 0 && regs.every((r) => r.portee === 'DIRECTION') && !regs.some((r) => r.id === regU.id));
  const st = (await prisma.stage.findFirst({ where: { stagiaireId: libre } })).id;
  await call('drh', 'POST', `/stages/${st}/interrompre`, { motif: 'Préparation du test des listes' });
  expect('acte dans un registre d’actes d’unité (non proposé)', await call('drh', 'POST', `/stages/${st}/attestation/acte`, { registreId: regU.id }), 400);
  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
