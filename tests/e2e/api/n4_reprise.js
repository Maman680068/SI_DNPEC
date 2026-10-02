// N4 — migration sur une base N3 réaliste, retour arrière et ré-application (phase 39j de run_all.sh).
// Modes (N4_MODE) :
//   charger : base à l'état N3 ; documents privés et publiés, de chaque catégorie, sur deux ans ;
//             empreinte des données (colonnes ajoutées par N4 exclues) et schéma d'avant N4 ;
//   apres   : N4 appliqué : type repris de la catégorie, date = date de dépôt, publiés → Validé
//             (journalisé « reprise N4 »), autres Brouillon ; aucune autre donnée modifiée ;
//   retour  : n4_down.sql joué : schéma identique à celui d'avant N4, données d'avant intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.N4_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'n4_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const COLONNES_N4 = ['statutDiffusion', 'typeDocument', 'dateDocument', 'periodeDebut', 'periodeFin', 'sourceMeetingId', 'activiteId', 'alerteVeilleAt', 'alerteRetardAt', 'aEnvoyerLe', 'categorie', 'echelonDepuis', 'pieceRequiseId', 'vehiculeId', 'kilometrageDepart', 'kilometrageRetour'];
const CATEGORIES = ['ETUDE', 'RAPPORT', 'NOTE_TECHNIQUE', 'AUTRE'];

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
async function empreinte(liste) {
  const res = {};
  const moins = COLONNES_N4.map((c) => ` - '${c}'`).join('');
  for (const t of liste) res[t] = (await sql(`SELECT md5((to_jsonb(x)${moins}${t === 'documents' ? " - 'celluleId'" : ''})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
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
  const n4 = await sql(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'statutDiffusion'`);
  const n3 = await sql(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'avisEtat'`);
  check('base à l’état N3 (N3 présent, N4 absent)', n4[0].n === 0 && n3[0].n === 1);
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  const division = (await prisma.division.create({ data: { code: 'N4R', name: 'Division de reprise N4' }, select: { id: true } })).id;
  const auteur = (await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "divisionId", "createdAt", "updatedAt") VALUES ('n4r-auteur', 'n4r@test.local', 'x', 'Auteur', 'Reprise', 'AGENT', 'EN_ATTENTE', '${division}', now(), now()) RETURNING id`))[0].id;
  const debut = Date.now() - 730 * 864e5;
  for (let i = 0; i < 80; i++) {
    const publie = i % 5 === 0;
    const quand = new Date(debut + i * 9 * 864e5).toISOString();
    await sql(`INSERT INTO documents (id, title, category, visibility, "isFinal", "divisionId", "createdById", "publishedAt", "publishedById", "createdAt", "updatedAt")
      VALUES ('n4r-${i}', 'Document ${i} « accentué »', '${CATEGORIES[i % 4]}', '${publie ? 'PUBLIE_DNPEC' : 'PRIVE_DIVISION'}', ${publie || i % 3 === 0}, '${division}', '${auteur}', ${publie ? `'${quand}'` : 'NULL'}, ${publie ? `'${auteur}'` : 'NULL'}, '${quand}', '${quand}')`);
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
  check('jeu chargé : 80 documents sur deux ans (16 publiés), 4 catégories', (await prisma.document.count({ where: { id: { startsWith: 'n4r-' } } })) === 80);
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const docs = await sql(`SELECT id, category::text AS c, "typeDocument"::text AS t, "statutDiffusion"::text AS s, visibility::text AS v, "dateDocument" AS d, "createdAt" AS cr, "periodeDebut" AS p FROM documents WHERE id LIKE 'n4r-%'`);
  const types = { ETUDE: 'ETUDE', RAPPORT: 'RAPPORT', NOTE_TECHNIQUE: 'NOTE_TECHNIQUE', AUTRE: 'AUTRE' };
  check('type repris de la catégorie pour les 80 documents', docs.length === 80 && docs.every((d) => d.t === types[d.c]));
  check('date du document = date de dépôt ; période couverte à compléter', docs.every((d) => d.d.toISOString().slice(0, 10) === d.cr.toISOString().slice(0, 10) && d.p === null));
  check('publiés → Validé, autres → Brouillon', docs.every((d) => d.s === (d.v === 'PUBLIE_DNPEC' ? 'VALIDE' : 'BROUILLON')));
  const journal = await sql(`SELECT count(*)::int AS n FROM changements_statut WHERE "objetId" LIKE 'n4r-%' AND "parId" IS NULL AND motif LIKE 'Reprise N4%'`);
  check('… passage journalisé pour chacun des 16 documents publiés (auteur : système)', journal[0].n === 16);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('aucune autre donnée d’avant N4 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apresRetour = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apresRetour);
  check('après retour arrière : schéma identique à celui d’avant N4 (pg_dump --schema-only)', avant === apresRetour);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name LIKE '%socle_nimba_n4'`);
  check('… migration N4 retirée du journal (ré-application possible)', m[0].n === 0);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('… aucune donnée d’avant N4 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`N4_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
