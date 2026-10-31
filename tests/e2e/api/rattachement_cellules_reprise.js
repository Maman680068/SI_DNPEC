// S8 — Rattachement des cellules (colonnes « rattachement » et « nature » de « cellules », migration additive
// après les demandes de réunion) — migration sur une base réaliste, retour arrière, ré-application (phase 39r).
// Modes (CELLULES_MODE) :
//   charger : migration absente ; cellules officielles et une cellule de plus chargées ; empreinte et schéma ;
//   apres   : migration appliquée : valeurs initiales par code (CTSCM, CNC → DN ; SAF, RH, CSID → DNA ; autre →
//             DN ; CNC instance, SAF service), valeurs fermées en base, aucune autre donnée modifiée ;
//   retour  : rattachement_cellules_down.sql joué : schéma identique à celui d'avant, données intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.CELLULES_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'rattachement_cellules_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const MIGRATION = '20261102080000_rattachement_cellules';

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
async function empreinte(liste) {
  const res = {};
  for (const t of liste) {
    res[t] = (await sql(`SELECT md5(to_jsonb(x)::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
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
const table = async (t) => (await sql(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = '${t}'`))[0].n === 1;
const refuse = async (q) => { try { await sql(q); return false; } catch { return true; } };

// Colonnes ajoutées par le lot, retirées de l'empreinte : tout le reste doit être identique.
const AJOUTEES = { cellules: ['rattachement', 'nature'] };
async function empreinteSans(liste) {
  const res = {};
  for (const t of liste) {
    const moins = (AJOUTEES[t] || []).map((c) => ` - '${c}'`).join('');
    res[t] = (await sql(`SELECT md5((to_jsonb(x)${moins})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
  }
  return res;
}
const colonne = async (t, c) => (await sql(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = '${t}' AND column_name = '${c}'`))[0].n === 1;

async function charger() {
  check('base sans rattachement des cellules (colonnes absentes)', !(await colonne('cellules', 'rattachement')) && !(await colonne('cellules', 'nature')));
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  await sql(`INSERT INTO cellules (id, code, name, "createdAt", "updatedAt") VALUES ('rc-autre', 'AUTRE', 'Cellule supplémentaire', now(), now()) ON CONFLICT DO NOTHING`);
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinteSans(liste) }));
  check('cellules officielles et une de plus chargées', (await sql(`SELECT count(*)::int AS n FROM cellules WHERE code IN ('CTSCM','CNC','SAF','RH','CSID','AUTRE')`))[0].n === 6);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const c = Object.fromEntries((await sql(`SELECT code, rattachement, nature FROM cellules`)).map((x) => [x.code, x]));
  check('rattachement initial : CTSCM, CNC, AUTRE → DN ; SAF, RH, CSID → DNA', ['CTSCM', 'CNC', 'AUTRE'].every((k) => c[k].rattachement === 'DN') && ['SAF', 'RH', 'CSID'].every((k) => c[k].rattachement === 'DNA'));
  check('nature initiale : CNC instance, SAF service, les autres cellule', c.CNC.nature === 'INSTANCE' && c.SAF.nature === 'SERVICE' && ['CTSCM', 'RH', 'CSID', 'AUTRE'].every((k) => c[k].nature === 'CELLULE'));
  check('rattachement inconnu refusé par la base', await refuse(`UPDATE cellules SET rattachement = 'DG' WHERE code = 'AUTRE'`));
  check('nature inconnue refusée par la base', await refuse(`UPDATE cellules SET nature = 'COMITE' WHERE code = 'AUTRE'`));
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}' AND finished_at IS NOT NULL`);
  check('migration inscrite au journal Prisma', m[0].n === 1);
  const ecarts = comparer(lignes, await empreinteSans(liste));
  check('aucune autre donnée modifiée ni perdue (hors colonnes ajoutées)', ecarts.length === 0, ecarts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apresRetour = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apresRetour);
  check('après retour arrière : schéma identique à celui d’avant (pg_dump --schema-only)', avant === apresRetour);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}'`);
  check('… migration retirée du journal (ré-application possible)', m[0].n === 0);
  const ecarts = comparer(lignes, await empreinteSans(liste));
  check('… aucune donnée d’avant modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`CELLULES_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
