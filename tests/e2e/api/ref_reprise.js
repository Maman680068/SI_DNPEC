// Lot « références courtes » (numéros « T-418 » des tâches, « A-07 » des activités) — migration sur une base
// B1 réaliste, retour arrière et ré-application (phase 39o de run_all.sh). Modes (REF_MODE) :
//   charger : base à l'état B1 (migration absente) ; tâches et activités chargées, créées dans un ordre
//             différent de celui de leurs identifiants ; empreinte des données et schéma d'avant ;
//   apres   : migration appliquée : numéros attribués dans l'ordre de création (tâches : séquence
//             globale ; activités : par année du plan), uniques, séquence prête pour la tâche suivante ;
//             aucune autre donnée modifiée ;
//   retour  : ref_down.sql joué : schéma identique à celui d'avant, données intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.REF_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'ref_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const MIGRATION = '20261023080000_references_courtes';

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
// Les colonnes ajoutées par le lot sont retirées de l'empreinte : tout le reste doit être identique.
const AJOUTEES = { tasks: ['numero'], activites: ['annee', 'numero'] };
async function empreinte(liste) {
  const res = {};
  for (const t of liste) {
    const moins = (AJOUTEES[t] || []).map((c) => ` - '${c}'`).join('');
    res[t] = (await sql(`SELECT md5((to_jsonb(x)${moins})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
  }
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
const colonne = async (t, c) => (await sql(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = '${t}' AND column_name = '${c}'`))[0].n === 1;

async function charger() {
  check('base à l’état B1 (modèles présents, aucune colonne « numero » sur les tâches et les activités)', (await sql(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'modeles'`))[0].n === 1 && !(await colonne('tasks', 'numero')) && !(await colonne('activites', 'numero')));
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt") VALUES ('refr-auteur', 'refr@test.local', 'x', 'Agent', 'Reprise', 'CHEF_DIVISION', 'ACTIF', now(), now())`);
  await sql(`INSERT INTO unites_organisationnelles (id, code, libelle, type, "createdAt", "updatedAt") VALUES ('refr-unite', 'REFR', 'Unité de reprise', 'DIRECTION', now(), now())`);
  // Tâches : identifiants dans l'ordre inverse de leur création (le numéro doit suivre la date de création).
  for (let i = 0; i < 12; i++) {
    await sql(`INSERT INTO tasks (id, title, status, priority, confidentiality, "createdById", "createdAt", "updatedAt") VALUES ('refr-t${String(99 - i).padStart(2, '0')}', 'Tâche de reprise ${i}', 'A_FAIRE', 'NORMAL', 'PUBLIC_INTERNE', 'refr-auteur', now() - interval '${100 - i} days', now())`);
  }
  for (const annee of [2025, 2026]) {
    await sql(`INSERT INTO objectifs (id, annee, "uniteId", libelle, "creeParId", "createdAt", "updatedAt") VALUES ('refr-o${annee}', ${annee}, 'refr-unite', 'Objectif ${annee}', 'refr-auteur', now(), now())`);
    for (let i = 0; i < 4; i++) {
      await sql(`INSERT INTO activites (id, "objectifId", libelle, "responsableId", "dateDebut", "dateFin", indicateur, "creeParId", "createdAt", "updatedAt") VALUES ('refr-a${annee}-${9 - i}', 'refr-o${annee}', 'Activité ${annee} n° ${i + 1}', 'refr-auteur', '${annee}-01-01', '${annee}-12-31', 'Indicateur', 'refr-auteur', now() - interval '${50 - i} days', now())`);
    }
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 12 tâches, 8 activités sur deux années', (await sql(`SELECT count(*)::int AS n FROM tasks WHERE id LIKE 'refr-%'`))[0].n === 12 && (await sql(`SELECT count(*)::int AS n FROM activites WHERE id LIKE 'refr-%'`))[0].n === 8);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const t = await sql(`SELECT id, numero, row_number() OVER (ORDER BY "createdAt", id)::int AS rang FROM tasks ORDER BY "createdAt", id`);
  check('tâches : numéros 1, 2, 3… dans l’ordre de création', t.length > 0 && t.every((x) => x.numero === x.rang), JSON.stringify(t.slice(0, 3)));
  const a = await sql(`SELECT id, annee, numero, row_number() OVER (PARTITION BY annee ORDER BY "createdAt", id)::int AS rang FROM activites`);
  const refr = a.filter((x) => x.id.startsWith('refr-'));
  check('activités : année recopiée de l’objectif, numéros 1 à 4 par année dans l’ordre de création', a.every((x) => x.numero === x.rang) && refr.filter((x) => x.annee === 2025).map((x) => x.numero).sort().join() === '1,2,3,4' && refr.filter((x) => x.annee === 2026).length === 4, JSON.stringify(refr));
  const idx = await sql(`SELECT count(*)::int AS n FROM pg_indexes WHERE indexname IN ('tasks_numero_key', 'activites_annee_numero_key')`);
  check('index uniques en base (tâche ; année et numéro d’activité)', idx[0].n === 2);
  const max = (await sql(`SELECT max(numero)::int AS m FROM tasks`))[0].m;
  await sql(`INSERT INTO tasks (id, title, status, priority, confidentiality, "createdById", "updatedAt") VALUES ('refr-suivante', 'Tâche suivante', 'A_FAIRE', 'NORMAL', 'PUBLIC_INTERNE', 'refr-auteur', now())`);
  const suivante = (await sql(`SELECT numero FROM tasks WHERE id = 'refr-suivante'`))[0].numero;
  await sql(`DELETE FROM tasks WHERE id = 'refr-suivante'`);
  check('tâche créée après la migration (sans numéro fourni) : numéro suivant', suivante === max + 1, `${suivante} / ${max}`);
  let doublon = false;
  try { await sql(`UPDATE activites SET numero = 1 WHERE id = 'refr-a2025-8'`); } catch { doublon = true; }
  check('deux activités de la même année ne peuvent pas avoir le même numéro (refus de la base)', doublon);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}' AND finished_at IS NOT NULL`);
  check('migration inscrite au journal Prisma', m[0].n === 1);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('aucune donnée existante modifiée ni perdue (hors colonnes ajoutées)', ecarts.length === 0, ecarts.join(' ; '));
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
  else throw new Error(`REF_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
