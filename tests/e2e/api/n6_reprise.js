// N6 — migration sur une base N5 réaliste, retour arrière et ré-application (phase 39l de run_all.sh).
// Modes (N6_MODE) :
//   charger : base à l'état N5 ; comptes, dossiers (grade, échelon), pièces, ordres de mission ;
//             empreinte des données (colonnes ajoutées par N6 exclues) et schéma d'avant N6 ;
//   apres   : N6 appliqué : colonnes N6 vides, paramétrage livré (5 pièces requises, 6 familles
//             d'actes sans registre), autres tables N6 vides ; aucune autre donnée modifiée ;
//   retour  : n6_down.sql joué : schéma identique à celui d'avant N6, données d'avant intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.N6_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'n6_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const COLONNES_N6 = ['categorie', 'echelonDepuis', 'pieceRequiseId', 'vehiculeId', 'kilometrageDepart', 'kilometrageRetour'];
const TABLES_N6_VIDES = ['mouvements_carriere', 'fiches_poste', 'besoins_formation', 'vehicules', 'pleins_carburant'];
const J = 864e5;

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
// Colonnes du lot « références courtes » (postérieur) : retirées de l'empreinte des tâches et des activités.
async function empreinte(liste) {
  const res = {};
  const moins = COLONNES_N6.map((c) => ` - '${c}'`).join('');
  for (const t of liste) res[t] = (await sql(`SELECT md5((to_jsonb(x)${moins}${t === 'tasks' ? " - 'numero'" : ''}${t === 'cellules' ? " - 'rattachement' - 'nature'" : ''}${t === 'activites' ? " - 'numero' - 'annee'" : ''})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
  return res;
}
function comparer(avant, maintenant) {
  const ecarts = [];
  for (const [t, hs] of Object.entries(avant)) {
    const ici = maintenant[t] || [];
    if (hs.length !== ici.length || hs.some((h, i) => h !== ici[i])) ecarts.push(`${t} : ${hs.length} → ${ici.length}`);
  }
  return ecarts;
}
const schema = () => execFileSync('pg_dump', ['--schema-only', '--no-owner', '--no-privileges', PSQL_URL], { encoding: 'utf8' })
  .split('\n').filter((l) => !/^--|^SET |^SELECT pg_catalog|^\\(un)?restrict /.test(l)).join('\n');

async function charger() {
  const n6 = await sql(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'mouvements_carriere'`);
  const n5 = await sql(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'objectifs'`);
  check('base à l’état N5 (N5 présent, N6 absent)', n6[0].n === 0 && n5[0].n === 1);
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  const division = (await prisma.division.create({ data: { code: 'N6R', name: 'Division de reprise N6' }, select: { id: true } })).id;
  // 20 comptes, leur dossier (statut, grade, échelon, prise de service), 2 pièces chacun, 1 ordre de mission sur 2.
  for (let i = 0; i < 20; i++) {
    const id = `n6r-${i}`;
    await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "divisionId", "createdAt", "updatedAt") VALUES ('${id}', '${id}@test.local', 'x', 'Agent', 'Reprise ${i}', 'AGENT', 'EN_ATTENTE', '${division}', now(), now())`);
    await sql(`INSERT INTO personnel_files_basic (id, "userId", "employmentStatus", grade, echelon, "serviceStartDate", "verifiedFields", source, "createdAt", "updatedAt") VALUES ('${id}-f', '${id}', '${i % 2 ? 'FONCTIONNAIRE' : 'CONTRACTUEL'}', 'Grade ${i % 4}', '${(i % 7) + 1}', now() - interval '${i * 100} days', '{}', 'IMPORT', now(), now())`);
    for (const p of ['CNI', 'Acte de naissance']) {
      await sql(`INSERT INTO personnel_documents (id, "userId", label, "fileKey", "fileName", "uploadedById", verified, "createdAt") VALUES ('${id}-${p.length}', '${id}', '${p}', 'reprise/${id}-${p.length}', 'piece.pdf', '${id}', ${i % 3 === 0}, now())`);
    }
    if (i % 2 === 0) {
      await sql(`INSERT INTO ordres_mission (id, "agentId", objet, destination, "dateDepart", "dateRetour", transport, "fraisMontant", "creeParId", "createdAt", "updatedAt") VALUES ('${id}-om', '${id}', 'Mission ${i}', 'Kindia', DATE '2026-03-0${(i % 9) + 1}', DATE '2026-03-1${(i % 9) + 1}', 'Véhicule de service', ${i * 10000}, '${id}', now(), now())`);
    }
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 20 dossiers, 40 pièces, 10 ordres de mission', (await prisma.personnelDocument.count({ where: { userId: { startsWith: 'n6r-' } } })) === 40 && (await prisma.ordreMission.count({ where: { agentId: { startsWith: 'n6r-' } } })) === 10);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const f = await sql(`SELECT count(*)::int AS n FROM personnel_files_basic WHERE "userId" LIKE 'n6r-%' AND categorie IS NULL AND "echelonDepuis" IS NULL`);
  const d = await sql(`SELECT count(*)::int AS n FROM personnel_documents WHERE "userId" LIKE 'n6r-%' AND "pieceRequiseId" IS NULL`);
  const o = await sql(`SELECT count(*)::int AS n FROM ordres_mission WHERE "agentId" LIKE 'n6r-%' AND "vehiculeId" IS NULL AND "kilometrageDepart" IS NULL AND "kilometrageRetour" IS NULL`);
  check('colonnes N6 vides : catégorie et date d’échelon, pièce requise, véhicule et kilométrage', f[0].n === 20 && d[0].n === 40 && o[0].n === 10);
  const pr = await sql(`SELECT count(*)::int AS n FROM pieces_requises WHERE actif`);
  const fa = await sql(`SELECT count(*)::int AS n FROM familles_actes_rh WHERE "registreId" IS NULL`);
  check('paramétrage livré : 5 pièces requises, 6 familles d’actes (registre à choisir à l’écran)', pr[0].n === 5 && fa[0].n === 6);
  let vides = true;
  for (const t of TABLES_N6_VIDES) vides = vides && (await sql(`SELECT count(*)::int AS n FROM "${t}"`))[0].n === 0;
  check('autres tables N6 créées et vides', vides);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('aucune autre donnée d’avant N6 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apresRetour = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apresRetour);
  check('après retour arrière : schéma identique à celui d’avant N6 (pg_dump --schema-only)', avant === apresRetour);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name LIKE '%socle_nimba_n6'`);
  check('… migration N6 retirée du journal (ré-application possible)', m[0].n === 0);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('… aucune donnée d’avant N6 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`N6_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
