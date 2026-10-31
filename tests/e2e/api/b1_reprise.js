// Domaine B, lot B1 (référentiel des modèles) — migration sur une base N7 réaliste, retour arrière et
// ré-application (phase 39n de run_all.sh). Modes (B1_MODE) :
//   charger : base à l'état N7 (migration B1 absente) ; comptes, documents et journal d'audit chargés ;
//             empreinte des données et schéma d'avant ;
//   apres   : migration appliquée : quatre tables créées et vides, garde-fous en base présents (déclencheurs,
//             index « une seule version active »), aucune donnée existante modifiée ;
//   retour  : b1_down.sql joué : schéma identique à celui d'avant, données intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.B1_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'b1_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const MIGRATION = '20261006080000_domaine_b_b1';
const TABLES = ['modeles', 'versions_modele', 'affectations_modelisation', 'travaux_calcul'];

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
// Colonnes du lot « références courtes » (postérieur) : retirées de l'empreinte des tâches et des activités.
async function empreinte(liste) {
  const res = {};
  for (const t of liste) res[t] = (await sql(`SELECT md5((to_jsonb(x)${t === 'tasks' ? " - 'numero'" : ''}${t === 'cellules' ? " - 'rattachement' - 'nature'" : ''}${t === 'activites' ? " - 'numero' - 'annee'" : ''})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
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
const existe = async (t) => (await sql(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = '${t}'`))[0].n === 1;

async function charger() {
  check('base à l’état N7 (nominations présentes, tables du domaine B absentes)', (await existe('changements_role_nomination')) && !(await existe('modeles')) && !(await existe('versions_modele')));
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  for (let i = 0; i < 15; i++) {
    const id = `b1r-${i}`;
    await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt") VALUES ('${id}', '${id}@test.local', 'x', 'Agent', 'Reprise ${i}', '${i % 3 ? 'AGENT' : 'CHEF_DIVISION'}', 'EN_ATTENTE', now(), now())`);
    await sql(`INSERT INTO parametres (cle, valeur, "modifieLe") VALUES ('b1r.essai.${i}', '${i}', now())`).catch(() => null);
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 15 comptes', (await prisma.user.count({ where: { id: { startsWith: 'b1r-' } } })) === 15);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  let vides = true;
  for (const t of TABLES) vides = vides && (await existe(t)) && (await sql(`SELECT count(*)::int AS n FROM "${t}"`))[0].n === 0;
  check('quatre tables du domaine B créées et vides (aucune reprise)', vides);
  const garde = await sql(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname IN ('versions_modele_garde', 'affectations_modelisation_garde')`);
  const index = await sql(`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'versions_modele_une_active'`);
  check('garde-fous en base : déclencheurs d’immutabilité et index « une seule version active »', garde[0].n === 2 && index[0].n === 1);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}' AND finished_at IS NOT NULL`);
  check('migration inscrite au journal Prisma', m[0].n === 1);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('aucune donnée existante modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apresRetour = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apresRetour);
  check('après retour arrière : schéma identique à celui d’avant (pg_dump --schema-only)', avant === apresRetour);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}'`);
  check('… migration retirée du journal (ré-application possible)', m[0].n === 0);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('… aucune donnée d’avant modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`B1_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
