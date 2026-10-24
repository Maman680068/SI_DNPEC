// Plan de formation individuel (table « sessions_formation », migration additive après « références
// courtes ») — migration sur une base réaliste, retour arrière et ré-application (phase 39p de run_all.sh).
// Modes (FORMATION_MODE) :
//   charger : migration absente ; comptes, unité et besoins de formation chargés ; empreinte et schéma ;
//   apres   : migration appliquée : table vide, garde-fous en base (clés étrangères, période), aucune
//             donnée existante modifiée ;
//   retour  : formation_down.sql joué : schéma identique à celui d'avant, données intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.FORMATION_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'formation_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const MIGRATION = '20261024080000_plan_formation';

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

async function charger() {
  check('base sans plan de formation (table « sessions_formation » absente), besoins présents', !(await table('sessions_formation')) && (await table('besoins_formation')));
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt") VALUES ('form-agent', 'formr@test.local', 'x', 'Agent', 'Formation', 'AGENT', 'ACTIF', now(), now())`);
  await sql(`INSERT INTO unites_organisationnelles (id, code, libelle, type, "createdAt", "updatedAt") VALUES ('form-unite', 'FORMR', 'Unité de reprise', 'DIRECTION', now(), now())`);
  for (let i = 0; i < 5; i++) {
    await sql(`INSERT INTO besoins_formation (id, annee, "uniteId", intitule, priorite, origine, effectif, statut, "creeParId", "updatedAt") VALUES ('form-b${i}', 2026, 'form-unite', 'Besoin ${i}', 'HAUTE', 'ENTRETIEN', ${i + 1}, '${i % 2 ? 'RETENU' : 'EXPRIME'}', 'form-agent', now())`);
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 5 besoins de formation', (await sql(`SELECT count(*)::int AS n FROM besoins_formation WHERE id LIKE 'form-%'`))[0].n === 5);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  check('table « sessions_formation » créée, vide', (await table('sessions_formation')) && (await sql(`SELECT count(*)::int AS n FROM sessions_formation`))[0].n === 0);
  const ins = (id, debut, fin, duree, agent = 'form-agent', besoin = 'NULL') => `INSERT INTO sessions_formation (id, intitule, "agentId", "besoinId", "dateDebut", "dateFin", "dureeJours", "creeParId", "updatedAt") VALUES ('${id}', 'Session', '${agent}', ${besoin}, '${debut}', ${fin ? `'${fin}'` : 'NULL'}, ${duree ?? 'NULL'}, 'form-agent', now())`;
  check('fin avant le début : refusée par la base', await refuse(ins('form-s1', '2026-05-10', '2026-05-01', null)));
  check('ni fin ni durée : refusée par la base', await refuse(ins('form-s2', '2026-05-10', null, null)));
  check('agent inexistant : refusé par la base (clé étrangère)', await refuse(ins('form-s3', '2026-05-10', null, 3, 'inconnu')));
  await sql(ins('form-s4', '2026-05-10', null, 3, 'form-agent', "'form-b1'"));
  check('session valide acceptée, état « SOUHAITEE » par défaut', (await sql(`SELECT etat::text AS e FROM sessions_formation WHERE id = 'form-s4'`))[0].e === 'SOUHAITEE');
  await sql(`DELETE FROM sessions_formation WHERE id = 'form-s4'`);
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
  else throw new Error(`FORMATION_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
