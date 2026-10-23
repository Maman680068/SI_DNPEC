// N2 — migration sur une base N1 réaliste, retour arrière et ré-application (phase 39h de run_all.sh).
// Modes (N2_MODE) :
//   charger : base à l'état N1 ; comptes (dont deux sans agent), journal d'audit volumineux ;
//             empreinte des données (colonnes ajoutées par N2 exclues) et schéma d'avant N2 ;
//   apres   : N2 appliqué : journal entièrement scellé, chaîne intacte, écriture seule ; chaque compte
//             actif a son agent ; aucune donnée d'avant modifiée ;
//   retour  : n2_down.sql joué : schéma identique à celui d'avant N2, données d'avant intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODE = process.env.N2_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'n2_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];
// Colonnes de N2, puis celles de N3 (appliqué par le même « migrate deploy », contrôlé par n3_reprise).
const COLONNES_N2 = ['agentId', 'numero', 'acteurInitial', 'auNomDeInitial', 'rang', 'empreinte', 'empreintePrecedente', 'avisEtat', 'avisParId', 'avisMotif', 'avisLe', 'avisEcheance', 'alerteAvisAt', 'encadrantPrincipalId', 'rapportFileKey', 'rapportFileName', 'rapportDeposeLe', 'rapportStatut', 'rapportMotif', 'rapportValideLe', 'rapportValideParId', 'progressPercent', 'certificatFileKey', 'certificatFileName', 'certificatDeposeLe', 'statutDiffusion', 'typeDocument', 'dateDocument', 'periodeDebut', 'periodeFin', 'sourceMeetingId', 'activiteId', 'alerteVeilleAt', 'alerteRetardAt', 'aEnvoyerLe', 'categorie', 'echelonDepuis', 'pieceRequiseId', 'vehiculeId', 'kilometrageDepart', 'kilometrageRetour'];
// Tables alimentées par N2 elle-même (agents créés pour les comptes qui n'en avaient pas).
const AJOUTS_ADMIS = ['agents', 'mouvements_agents'];

const tables = async () =>
  (await prisma.$queryRawUnsafe(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('_prisma_migrations', 'journal_connexions', 'parametres', 'executions_taches') ORDER BY 1`)).map((r) => r.t);
// Colonnes du lot « références courtes » (postérieur) : retirées de l'empreinte des tâches et des activités.
async function empreinte(liste) {
  const res = {};
  const moins = COLONNES_N2.map((c) => ` - '${c}'`).join('');
  for (const t of liste) res[t] = (await prisma.$queryRawUnsafe(`SELECT md5((to_jsonb(x)${moins}${t === 'documents' ? " - 'celluleId'" : ''}${t === 'tasks' ? " - 'numero'" : ''}${t === 'activites' ? " - 'numero' - 'annee'" : ''})::text) AS h FROM "${t}" x`)).map((l) => l.h).sort();
  return res;
}
function comparer(avant, maintenant) {
  const pertes = []; const ajouts = [];
  for (const [t, hs] of Object.entries(avant)) {
    const ici = new Map(); for (const h of maintenant[t] || []) ici.set(h, (ici.get(h) || 0) + 1);
    let manquantes = 0; for (const h of hs) { const n = ici.get(h) || 0; if (n) ici.set(h, n - 1); else manquantes++; }
    if (manquantes) pertes.push(`${t} : ${manquantes}`);
    const plus = [...ici.values()].reduce((s, n) => s + n, 0);
    if (plus && !AJOUTS_ADMIS.includes(t)) ajouts.push(`${t} : ${plus}`);
  }
  return { pertes, ajouts };
}
const schema = () => execFileSync('pg_dump', ['--schema-only', '--no-owner', '--no-privileges', PSQL_URL], { encoding: 'utf8' })
  .split('\n').filter((l) => !/^--|^SET |^SELECT pg_catalog|^\\(un)?restrict /.test(l)).join('\n');

async function charger() {
  const n2 = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'parametres'`);
  const n1 = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'agents'`);
  check('base à l’état N1 (socle N1 présent, N2 absent)', n2[0].n === 0 && n1[0].n === 1);
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  const comptes = [];
  for (let i = 0; i < 40; i++) {
    comptes.push((await prisma.user.create({ data: { email: `n2r${i}@test.local`, passwordHash: 'x', firstName: `Prénom${i}`, lastName: `Nom${i}`, role: i === 0 ? 'ADMIN_SYSTEME' : 'AGENT', status: i < 38 ? 'ACTIF' : 'EN_ATTENTE' }, select: { id: true } })).id);
  }
  // Journal d'audit réaliste : 600 entrées sur 18 mois, avec auteurs, intérims, métadonnées.
  const debut = Date.now() - 540 * 864e5;
  for (let i = 0; i < 600; i++) {
    await prisma.auditLog.create({
      data: {
        actorId: i % 7 === 0 ? null : comptes[i % 38], onBehalfOfId: i % 50 === 0 ? comptes[1] : null,
        action: ['CREATION', 'MODIFICATION', 'VALIDATION', 'CONNEXION'][i % 4], entityType: ['Task', 'LeaveRequest', 'Document', 'User'][i % 4], entityId: `obj${i}`,
        metadata: i % 3 === 0 ? { event: 'test', rang: i, texte: `ligne ${i} « accentuée »` } : undefined, createdAt: new Date(debut + i * 864e5 * 0.9),
      },
      select: { id: true },
    });
  }
  const sansAgent = await prisma.user.count({ where: { status: { not: 'EN_ATTENTE' }, agentId: null } });
  check(`jeu chargé : 40 comptes (${sansAgent} actifs sans agent, cas à reprendre), 600 entrées d’audit`, sansAgent === 38 && (await prisma.auditLog.count()) >= 600);
  const liste = await tables();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ liste, lignes: await empreinte(liste) }));
}

async function apres() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const total = await prisma.auditLog.count();
  const scelles = await prisma.auditLog.count({ where: { rang: { not: null } } });
  const [v] = await prisma.$queryRawUnsafe('SELECT * FROM audit_verifier()');
  check(`journal d’audit : toutes les entrées d’avant scellées (${scelles}/${total}), chaîne intacte`, scelles >= 600 && v.rangRompu === null && v.lignesVerifiees === scelles);
  const ordre = await prisma.$queryRawUnsafe(`SELECT bool_and(a."createdAt" <= b."createdAt") AS ok FROM audit_logs a JOIN audit_logs b ON b.numero = a.numero + 1 WHERE b.rang IS NOT NULL AND a.rang IS NOT NULL AND a."entityId" LIKE 'obj%' AND b."entityId" LIKE 'obj%'`);
  check('… numérotées dans l’ordre chronologique', ordre[0].ok === true);
  check('… auteur figé recopié (acteurInitial = actorId)', (await prisma.auditLog.count({ where: { actorId: { not: null }, acteurInitial: null } })) === 0);
  const refus = await prisma.$executeRawUnsafe(`UPDATE audit_logs SET "entityId" = 'x' WHERE "entityId" = 'obj1'`).then(() => false, () => true);
  check('… écriture seule dès la migration', refus);
  check('aucun compte actif sans agent (agents créés par la base pour les comptes à reprendre)', (await prisma.user.count({ where: { status: { not: 'EN_ATTENTE' }, agentId: null } })) === 0 && (await prisma.agent.count({ where: { compte: { email: { startsWith: 'n2r' } } } })) === 38);
  check('… inscriptions en attente : toujours sans agent', (await prisma.user.count({ where: { status: 'EN_ATTENTE', agentId: { not: null } } })) === 0);
  const { pertes, ajouts } = comparer(lignes, await empreinte(liste));
  check('aucune donnée d’avant N2 modifiée ni perdue', pertes.length === 0, pertes.join(' ; '));
  check('aucune ligne ajoutée hors agents repris', ajouts.length === 0, ajouts.join(' ; '));
}

async function retour() {
  const { liste, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apres = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apres);
  check('après retour arrière : schéma identique à celui d’avant N2 (pg_dump --schema-only)', avant === apres);
  const m = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name LIKE '%socle_nimba_n2'`);
  check('… migration N2 retirée du journal (ré-application possible)', m[0].n === 0);
  const { pertes, ajouts } = comparer(lignes, await empreinte(liste));
  check('… aucune donnée d’avant N2 modifiée ni perdue (audit compris)', pertes.length === 0, pertes.join(' ; '));
  check('… seuls restent les agents repris par N2', ajouts.length === 0, ajouts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`N2_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
