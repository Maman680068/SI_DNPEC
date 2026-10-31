// S1 — Demandes de réunion (tables « demandes_reunion », « etapes_demande_reunion », migration additive après
// le plan de formation) — migration sur une base réaliste, retour arrière et ré-application (phase 39q).
// Modes (DEMANDES_MODE) :
//   charger : migration absente ; comptes et réunions chargés ; empreinte et schéma ;
//   apres   : migration appliquée : tables vides, garde-fous en base (période, motif d'un refus, clés
//             étrangères), aucune donnée existante modifiée ;
//   retour  : demandes_reunion_down.sql joué : schéma identique à celui d'avant, données intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.DEMANDES_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'demandes_reunion_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const MIGRATION = '20261101080000_demandes_reunion';

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
async function empreinte(liste) {
  const res = {};
  for (const t of liste) {
    res[t] = (await sql(`SELECT md5((to_jsonb(x)${t === 'cellules' ? " - 'rattachement' - 'nature'" : ''})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
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
  check('base sans demandes de réunion (table absente), réunions présentes', !(await table('demandes_reunion')) && (await table('meetings')));
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt") VALUES ('dmr-agent', 'dmr@test.local', 'x', 'Agent', 'Demandes', 'AGENT', 'ACTIF', now(), now())`);
  for (let i = 0; i < 4; i++) {
    await sql(`INSERT INTO meetings (id, title, "startAt", "createdById", "createdAt", "updatedAt") VALUES ('dmr-m${i}', 'Réunion ${i}', now() + interval '${i + 1} days', 'dmr-agent', now(), now())`);
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 4 réunions', (await sql(`SELECT count(*)::int AS n FROM meetings WHERE id LIKE 'dmr-%'`))[0].n === 4);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  check('tables des demandes créées, vides', (await table('demandes_reunion')) && (await table('etapes_demande_reunion')) && (await sql(`SELECT count(*)::int AS n FROM demandes_reunion`))[0].n === 0);
  const ins = (id, debut, fin, etat = 'EN_ATTENTE', motif = 'NULL', demandeur = 'dmr-agent') => `INSERT INTO demandes_reunion (id, "demandeurId", objet, explication, debut, fin, "participantIds", "uniteIds", etat, "decideurIds", "motifRefus", "updatedAt") VALUES ('${id}', '${demandeur}', 'Objet', 'Explication', '${debut}', '${fin}', '{}', '{}', '${etat}', '{}', ${motif}, now())`;
  check('fin avant le début : refusée par la base', await refuse(ins('dmr-d1', '2026-12-10 10:00', '2026-12-10 09:00')));
  check('refus sans motif : refusé par la base', await refuse(ins('dmr-d2', '2026-12-10 09:00', '2026-12-10 10:00', 'REFUSEE')));
  check('demandeur inexistant : refusé par la base (clé étrangère)', await refuse(ins('dmr-d3', '2026-12-10 09:00', '2026-12-10 10:00', 'EN_ATTENTE', 'NULL', 'inconnu')));
  await sql(ins('dmr-d4', '2026-12-10 09:00', '2026-12-10 10:00', 'REFUSEE', "'Motif'"));
  await sql(`INSERT INTO etapes_demande_reunion (id, "demandeId", action, "versIds") VALUES ('dmr-e1', 'dmr-d4', 'DEMANDEE', '{}')`);
  await sql(`DELETE FROM demandes_reunion WHERE id = 'dmr-d4'`);
  check('demande valide acceptée, ses étapes supprimées avec elle', (await sql(`SELECT count(*)::int AS n FROM etapes_demande_reunion WHERE id = 'dmr-e1'`))[0].n === 0);
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
  else throw new Error(`DEMANDES_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
