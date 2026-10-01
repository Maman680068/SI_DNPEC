// N3 — migration sur une base N2 réaliste, retour arrière et ré-application (phase 39i de run_all.sh).
// Modes (N3_MODE) :
//   charger : base à l'état N2 ; tâches (avancements saisis à la main, sous-tâches), congés en attente,
//             décidés et annulés, stages ; empreinte des données (avancement exclu) et schéma d'avant N3 ;
//   apres   : N3 appliqué : avancement recalculé selon la règle, aucune autre donnée modifiée, congés en
//             attente sans avis (échéance posée par le job) ;
//   retour  : n3_down.sql joué : schéma identique à celui d'avant N3, données d'avant intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.N3_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'n3_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
// Colonnes ajoutées par N3, et l'avancement (recalculé par la migration, contrôlé à part).
const COLONNES_N3 = ['avisEtat', 'avisParId', 'avisMotif', 'avisLe', 'avisEcheance', 'alerteAvisAt', 'encadrantPrincipalId', 'rapportFileKey', 'rapportFileName', 'rapportDeposeLe', 'rapportStatut', 'rapportMotif', 'rapportValideLe', 'rapportValideParId', 'progressPercent', 'certificatFileKey', 'certificatFileName', 'certificatDeposeLe'];

const tables = async () =>
  (await prisma.$queryRawUnsafe(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
async function empreinte(liste) {
  const res = {};
  const moins = COLONNES_N3.map((c) => ` - '${c}'`).join('');
  for (const t of liste) res[t] = (await prisma.$queryRawUnsafe(`SELECT md5((to_jsonb(x)${moins})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
  return res;
}
function comparer(avant, maintenant) {
  const ecarts = [];
  for (const [t, hs] of Object.entries(avant)) {
    const ici = [...(maintenant[t] || [])];
    if (hs.length !== ici.length || hs.some((h, i) => h !== ici[i])) ecarts.push(`${t} : ${hs.length} → ${ici.length}`);
  }
  return ecarts;
}
const schema = () => execFileSync('pg_dump', ['--schema-only', '--no-owner', '--no-privileges', PSQL_URL], { encoding: 'utf8' })
  .split('\n').filter((l) => !/^--|^SET |^SELECT pg_catalog|^\\(un)?restrict /.test(l)).join('\n');
const attendu = (statut) => ({ A_FAIRE: 0, EN_COURS: 50, REJETEE: 50, SOUMISE_VALIDATION: 90 })[statut] ?? 100;

async function charger() {
  const n3 = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'avisEtat'`);
  const n2 = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'parametres'`);
  check('base à l’état N2 (N2 présent, N3 absent)', n3[0].n === 0 && n2[0].n === 1);
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  const comptes = [];
  for (let i = 0; i < 12; i++) {
    comptes.push((await prisma.user.create({ data: { email: `n3r${i}@test.local`, passwordHash: 'x', firstName: `Prénom${i}`, lastName: `Nom${i}`, role: i === 11 ? 'STAGIAIRE' : 'AGENT', status: 'ACTIF' }, select: { id: true } })).id);
  }
  // Tâches : chaque statut, avancements saisis à la main (souvent incohérents), sous-tâches.
  const statuts = ['A_FAIRE', 'EN_COURS', 'SOUMISE_VALIDATION', 'TERMINEE', 'REJETEE'];
  for (let i = 0; i < 60; i++) {
    const t = await prisma.task.create({ data: { title: `Tâche ${i}`, createdById: comptes[i % 10], status: statuts[i % 5], progressPercent: (i * 17) % 101 }, select: { id: true } });
    if (i % 6 === 0) {
      for (let k = 0; k < 3; k++) await prisma.task.create({ data: { title: `Sous-tâche ${i}.${k}`, createdById: comptes[i % 10], parentTaskId: t.id, status: k < i % 4 ? 'TERMINEE' : 'A_FAIRE', progressPercent: 33 }, select: { id: true } });
    }
  }
  const type = (await prisma.leaveType.findFirst({ select: { id: true } })) ?? (await prisma.leaveType.create({ data: { code: 'N3R', name: 'Congé reprise' }, select: { id: true } }));
  for (let i = 0; i < 40; i++) {
    await prisma.leaveRequest.create({ data: { userId: comptes[i % 10], leaveTypeId: type.id, startDate: new Date(Date.UTC(2026, 10, 1 + (i % 20))), endDate: new Date(Date.UTC(2026, 10, 2 + (i % 20))), daysCount: 2, reason: `Motif ${i} « accentué »`, status: ['EN_ATTENTE', 'APPROUVEE', 'REJETEE', 'ANNULEE'][i % 4] }, select: { id: true } });
  }
  await prisma.stage.create({ data: { stagiaireId: comptes[11], etablissement: 'Université de Conakry', dateDebut: new Date('2026-09-01'), dateFin: new Date('2026-12-15'), createdById: comptes[0], statut: 'EN_COURS' }, select: { id: true } });
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 60 tâches et leurs sous-tâches, 40 congés, un stage en cours', (await prisma.task.count({ where: { title: { startsWith: 'Tâche ' } } })) === 60 && (await prisma.leaveRequest.count()) >= 40);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const taches = await prisma.task.findMany({ where: { title: { startsWith: 'Tâche ' } }, select: { status: true, progressPercent: true, subTasks: { select: { status: true } } } });
  const faux = taches.filter((t) => t.progressPercent !== (t.subTasks.length ? Math.round((100 * t.subTasks.filter((s) => s.status === 'TERMINEE').length) / t.subTasks.length) : attendu(t.status)));
  check(`avancement recalculé pour les ${taches.length} tâches (sous-tâches, sinon statut)`, taches.length === 60 && faux.length === 0, faux.slice(0, 3).map((t) => `${t.status} ${t.progressPercent}`).join(' ; '));
  const enAttente = await prisma.leaveRequest.findMany({ where: { status: 'EN_ATTENTE' }, select: { avisEtat: true, avisEcheance: true } });
  check('congés en attente : aucun avis inventé, échéance posée plus tard par le job', enAttente.length >= 10 && enAttente.every((l) => l.avisEtat === null && l.avisEcheance === null));
  const decides = await prisma.leaveRequest.count({ where: { status: { not: 'EN_ATTENTE' }, avisEtat: { not: null } } });
  check('congés décidés ou annulés : laissés tels quels (pas d’avis rétroactif)', decides === 0);
  check('stage en cours : ni encadreur ni rapport inventés', (await prisma.stage.count({ where: { OR: [{ encadrantPrincipalId: { not: null } }, { rapportStatut: { not: null } }] } })) === 0);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('aucune autre donnée d’avant N3 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apres = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apres);
  check('après retour arrière : schéma identique à celui d’avant N3 (pg_dump --schema-only)', avant === apres);
  const m = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name LIKE '%socle_nimba_n3'`);
  check('… migration N3 retirée du journal (ré-application possible)', m[0].n === 0);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('… aucune donnée d’avant N3 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
  const n = await prisma.$executeRawUnsafe(`UPDATE tasks SET "progressPercent" = 42 WHERE title = 'Tâche 1'`);
  const v = await prisma.$queryRawUnsafe(`SELECT "progressPercent" AS p FROM tasks WHERE title = 'Tâche 1'`);
  check('… avancement de nouveau modifiable (déclencheurs retirés)', n === 1 && v[0].p === 42);
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`N3_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
