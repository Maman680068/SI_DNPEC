// N5 — migration sur une base N4 réaliste, retour arrière et ré-application (phase 39k de run_all.sh).
// Modes (N5_MODE) :
//   charger : base à l'état N4 ; tâches (échéances passées, proches, lointaines, sans échéance ;
//             terminées ou non) et emails déjà partis ; empreinte des données (colonnes ajoutées par
//             N5 exclues) et schéma d'avant N5 ;
//   apres   : N5 appliqué : aucune tâche rattachée à une activité ; seules les tâches non terminées
//             déjà en retard sont réputées signalées ; emails d'avant N5 toujours « envoyés » (aucun
//             ne part dans un résumé) ; tables N5 vides ; aucune autre donnée modifiée ;
//   retour  : n5_down.sql joué : schéma identique à celui d'avant N5, données d'avant intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.N5_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'n5_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
const COLONNES_N5 = ['activiteId', 'alerteVeilleAt', 'alerteRetardAt', 'aEnvoyerLe', 'categorie', 'echelonDepuis', 'pieceRequiseId', 'vehiculeId', 'kilometrageDepart', 'kilometrageRetour'];
const STATUTS = ['A_FAIRE', 'EN_COURS', 'SOUMISE_VALIDATION', 'VALIDEE', 'REJETEE', 'TERMINEE'];
const TABLES_N5 = ['objectifs', 'activites', 'fils_messages', 'participants_fil', 'messages_fil', 'lectures_message', 'preferences_notification', 'instructions'];
const J = 864e5;

const sql = (q) => prisma.$queryRawUnsafe(q);
const tables = async () =>
  (await sql(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'executions_taches', 'etat_supervision') ORDER BY 1`)).map((r) => r.t);
async function empreinte(liste) {
  const res = {};
  const moins = COLONNES_N5.map((c) => ` - '${c}'`).join('');
  for (const t of liste) res[t] = (await sql(`SELECT md5((to_jsonb(x)${moins})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
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
const enRetard = (d, s) => d !== null && d < Date.now() - J && s !== 'TERMINEE' && s !== 'VALIDEE';

async function charger() {
  const n5 = await sql(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'activiteId'`);
  const n4 = await sql(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'statutDiffusion'`);
  check('base à l’état N4 (N4 présent, N5 absent)', n5[0].n === 0 && n4[0].n === 1);
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  const division = (await prisma.division.create({ data: { code: 'N5R', name: 'Division de reprise N5' }, select: { id: true } })).id;
  const auteur = (await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "divisionId", "createdAt", "updatedAt") VALUES ('n5r-auteur', 'n5r@test.local', 'x', 'Auteur', 'Reprise', 'CHEF_DIVISION', 'EN_ATTENTE', '${division}', now(), now()) RETURNING id`))[0].id;
  // 60 tâches : échéances de -400 à +190 jours (et une sur six sans échéance), tous statuts.
  const attendu = {};
  for (let i = 0; i < 60; i++) {
    const statut = STATUTS[i % STATUTS.length];
    const due = i % 6 === 5 ? null : new Date(Date.now() + (i * 10 - 400) * J);
    await sql(`INSERT INTO tasks (id, title, status, priority, confidentiality, "dueDate", "divisionId", "createdById", "createdAt", "updatedAt")
      VALUES ('n5r-${i}', 'Tâche ${i} « reprise »', '${statut}', 'NORMAL', 'PUBLIC_INTERNE', ${due ? `'${due.toISOString()}'` : 'NULL'}, '${division}', '${auteur}', now() - interval '500 days', now() - interval '500 days')`);
    attendu[`n5r-${i}`] = enRetard(due ? due.getTime() : null, statut);
  }
  for (let i = 0; i < 40; i++) {
    const canal = i % 2 ? 'EMAIL' : 'IN_APP';
    await sql(`INSERT INTO notifications (id, "userId", type, channel, title, body, link, "isRead", "sentAt", "createdAt") VALUES ('n5r-n${i}', '${auteur}', 'TACHE_ASSIGNEE', '${canal}', 'Notification ${i}', 'Corps', '/tasks/n5r-${i}', ${i % 3 === 0}, now() - interval '${i} days', now() - interval '${i} days')`);
  }
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste), attendu }));
  const nRetard = Object.values(attendu).filter(Boolean).length;
  check(`jeu chargé : 60 tâches (${nRetard} en retard non terminées), 40 notifications déjà parties`, (await prisma.notification.count({ where: { id: { startsWith: 'n5r-' } } })) === 40 && nRetard > 5);
}

async function apres() {
  const { liste, lignes, attendu } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const taches = await sql(`SELECT id, "activiteId" AS a, "alerteVeilleAt" AS v, "alerteRetardAt" AS r FROM tasks WHERE id LIKE 'n5r-%'`);
  check('aucune tâche rattachée à une activité, aucune alerte de veille', taches.length === 60 && taches.every((t) => t.a === null && t.v === null));
  const faux = taches.filter((t) => (t.r !== null) !== attendu[t.id]);
  check('retards d’avant N5 réputés signalés (non terminées seulement), aucun autre', faux.length === 0, faux.map((t) => t.id).join(', '));
  const n = await sql(`SELECT count(*)::int AS n FROM notifications WHERE "aEnvoyerLe" IS NOT NULL OR ("sentAt" IS NULL AND channel = 'EMAIL')`);
  check('emails d’avant N5 : tous « envoyés », aucun en attente de résumé', n[0].n === 0);
  let vides = true;
  for (const t of TABLES_N5) vides = vides && (await sql(`SELECT count(*)::int AS n FROM "${t}"`))[0].n === 0;
  check('tables N5 créées et vides (préférences créées à la première lecture)', vides);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('aucune autre donnée d’avant N5 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apresRetour = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apresRetour);
  check('après retour arrière : schéma identique à celui d’avant N5 (pg_dump --schema-only)', avant === apresRetour);
  const m = await sql(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name LIKE '%socle_nimba_n5'`);
  check('… migration N5 retirée du journal (ré-application possible)', m[0].n === 0);
  const ecarts = comparer(lignes, await empreinte(liste));
  check('… aucune donnée d’avant N5 modifiée ni perdue', ecarts.length === 0, ecarts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`N5_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
