// N1 — reprise sur un jeu de données réaliste, retour arrière et ré-application (phase 39f de run_all.sh).
// Modes (variable N1_MODE) :
//   charger   : base à l'état d'avant N1 ; charge ~60 comptes, l'organigramme complet (5 divisions,
//               19 sections, 5 cellules), stagiaires, habilitations, suppléance, congés ; relève
//               l'empreinte des données (une empreinte par ligne, colonne agentId exclue).
//   apres     : N1 appliqué, API démarrée (reprise faite au démarrage) : contrôle unités, responsables,
//               agents, matricules, fins de stage, rôles, « aucun compte actif sans agent », données
//               d'avant intactes, reprise idempotente.
//   retour    : n1_down.sql joué : schéma identique à celui d'avant N1 (pg_dump --schema-only) et
//               données d'avant intactes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client');
// Colonnes des lots suivants (N3), appliqués par le même « migrate deploy » : hors comparaison.
const MOINS_N3 = ['avisEtat', 'avisParId', 'avisMotif', 'avisLe', 'avisEcheance', 'alerteAvisAt', 'encadrantPrincipalId', 'rapportFileKey', 'rapportFileName', 'rapportDeposeLe', 'rapportStatut', 'rapportMotif', 'rapportValideLe', 'rapportValideParId', 'progressPercent', 'certificatFileKey', 'certificatFileName', 'certificatDeposeLe', 'statutDiffusion', 'typeDocument', 'dateDocument', 'periodeDebut', 'periodeFin', 'sourceMeetingId'].map((c) => ` - '${c}'`).join('');
const prisma = new PrismaClient();

const MODE = process.env.N1_MODE || 'apres';
const DOSSIER = path.join(E.OUT, 'n1_reprise');
fs.mkdirSync(DOSSIER, { recursive: true });
const JOUR = 864e5;
const PSQL_URL = (process.env.DATABASE_URL || '').split('?')[0];

const DIVISIONS = {
  DPE: ['SSR', 'SFP', 'SSME', 'SGOP'],
  DEE: ['SE', 'SDP', 'SME', 'SCE'],
  DSPS: ['SPS', 'SEPS', 'SIPS', 'SAPS'],
  DAC: ['SAC', 'SCA', 'SRA'],
  DIPE: ['SIP', 'SEP', 'SPP', 'SDI'],
};
const SANS_CHEF = 'SGOP';
const DEUX_CHEFS = 'SCE';

/** Empreinte de chaque ligne de chaque table d'avant N1 (hors journal de migrations). */
async function empreinte(tables) {
  const res = {};
  for (const t of tables) {
    const lignes = await prisma.$queryRawUnsafe(`SELECT md5((to_jsonb(x) - 'agentId'${MOINS_N3})::text) AS h FROM "${t}" x`);
    res[t] = lignes.map((l) => l.h).sort();
  }
  return res;
}
const tablesDAvant = async () =>
  (await prisma.$queryRawUnsafe(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY 1`)).map((r) => r.t);

/** Toutes les lignes d'avant sont toujours là, inchangées ; les ajouts ne sont admis que dans `ajoutsAdmis`. */
function comparer(avant, maintenant, ajoutsAdmis) {
  const pertes = []; const ajouts = [];
  for (const [t, hs] of Object.entries(avant)) {
    const ici = new Map(); for (const h of maintenant[t] || []) ici.set(h, (ici.get(h) || 0) + 1);
    let manquantes = 0; for (const h of hs) { const n = ici.get(h) || 0; if (n) ici.set(h, n - 1); else manquantes++; }
    if (manquantes) pertes.push(`${t} : ${manquantes} ligne(s) modifiée(s) ou perdue(s)`);
    const plus = [...ici.values()].reduce((s, n) => s + n, 0);
    if (plus && !ajoutsAdmis.includes(t)) ajouts.push(`${t} : ${plus} ligne(s) ajoutée(s)`);
  }
  return { pertes, ajouts };
}
const schema = () => execFileSync('pg_dump', ['--schema-only', '--no-owner', '--no-privileges', PSQL_URL], { encoding: 'utf8' })
  .split('\n').filter((l) => !/^--|^SET |^SELECT pg_catalog|^\\(un)?restrict /.test(l)).join('\n');

/** Seul ajout admis dans une table d'avant N1 : la cellule support du secrétariat de direction (SECDIR). */
async function secretariatSeulAjoute(prefixe) {
  const cellules = await prisma.cellule.findMany({ select: { code: true } });
  check(`${prefixe}seul ajout aux tables d’avant N1 : la cellule du secrétariat de direction (SECDIR), vide`,
    cellules.length === 6 && cellules.some((c) => c.code === 'SECDIR') && (await prisma.user.count({ where: { cellule: { code: 'SECDIR' } } })) === 0);
}

async function charger() {
  const n1 = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'agents'`);
  check('base à l’état d’avant N1 (aucune table du socle)', n1[0].n === 0);
  const hash = '$2b$10$abcdefghijklmnopqrstuuJ1jE3bUq0kS8rX7m1S0mKj3gk0Hk2e'; // aucun compte de ce jeu ne se connecte
  let n = 0;
  const compte = async (role, extra = {}) => {
    n++;
    return (await prisma.user.create({
      data: { email: `reprise${String(n).padStart(2, '0')}@test.local`, passwordHash: hash, firstName: extra.prenom || `Prénom${n}`, lastName: extra.nom || `Nom${n}`, role, status: extra.status || 'ACTIF', divisionId: extra.divisionId, sectionId: extra.sectionId, celluleId: extra.celluleId, supervisorId: extra.supervisorId, jobTitle: extra.jobTitle },
      select: { id: true },
    })).id;
  };
  const cellules = Object.fromEntries((await prisma.cellule.findMany({ select: { id: true, code: true } })).map((c) => [c.code, c.id]));
  const div = {}; const sec = {};
  for (const [code, sections] of Object.entries(DIVISIONS)) {
    div[code] = (await prisma.division.create({ data: { code, name: `Division ${code}` }, select: { id: true } })).id;
    for (const s of sections) sec[s] = { id: (await prisma.section.create({ data: { code: s, name: `Section ${s}`, divisionId: div[code] }, select: { id: true } })).id, div: div[code] };
  }
  const dn = await compte('DN', { jobTitle: 'Directeur National' });
  const dna = await compte('DNA', { jobTitle: 'Directrice Nationale Adjointe' });
  const admin = await compte('ADMIN_SYSTEME', { celluleId: cellules.CSID });
  const drh = await compte('DRH', { celluleId: cellules.RH });
  const chefsDiv = {}; for (const d of Object.keys(DIVISIONS)) chefsDiv[d] = await compte('CHEF_DIVISION', { divisionId: div[d] });
  for (const [s, v] of Object.entries(sec)) {
    if (s === SANS_CHEF) continue;
    await compte('CHEF_SECTION', { divisionId: v.div, sectionId: v.id });
    if (s === DEUX_CHEFS) await compte('CHEF_SECTION', { divisionId: v.div, sectionId: v.id });
  }
  const chefsCel = {};
  for (const c of ['CTSCM', 'CNC', 'SAF', 'CSID']) {
    chefsCel[c] = await compte('CHEF_CELLULE', { celluleId: cellules[c] });
    await prisma.cellule.update({ where: { id: cellules[c] }, data: { chefId: chefsCel[c] }, select: { id: true } });
  }
  const agents = [];
  const sections = Object.entries(sec);
  for (let i = 0; i < 16; i++) { const [, v] = sections[i % sections.length]; agents.push(await compte('AGENT', { divisionId: v.div, sectionId: v.id, jobTitle: 'Chargé d’études' })); }
  agents.push(await compte('AGENT', { divisionId: div.DAC })); // division seule
  agents.push(await compte('AGENT', { celluleId: cellules.SAF }));
  agents.push(await compte('AGENT', { celluleId: cellules.CTSCM }));
  agents.push(await compte('AGENT', { celluleId: cellules.CNC }));
  const assDn = await compte('ASSISTANT_DIRECTION', { supervisorId: dn });
  await compte('ASSISTANT_DIRECTION', { supervisorId: dna });
  await compte('ASSISTANT_DIRECTION', { supervisorId: chefsCel.SAF, celluleId: cellules.SAF });
  const stg1 = await compte('STAGIAIRE', { divisionId: div.DPE, sectionId: sec.SSR.id });
  const stg2 = await compte('STAGIAIRE', { celluleId: cellules.CTSCM });
  const stg3 = await compte('STAGIAIRE');
  await compte('AGENT', { status: 'EN_ATTENTE' });
  await compte('AGENT', { status: 'EN_ATTENTE', divisionId: div.DEE });
  await compte('AGENT', { status: 'SUSPENDU', divisionId: div.DEE, sectionId: sec.SE.id });
  await compte('AGENT', { status: 'SUPPRIME', divisionId: div.DPE, sectionId: sec.SFP.id });

  const auj = new Date(new Date().toISOString().slice(0, 10));
  const s1 = await prisma.stage.create({ data: { stagiaireId: stg1, etablissement: 'Université Gamal Abdel Nasser', dateDebut: new Date(auj - 30 * JOUR), dateFin: new Date(+auj + 60 * JOUR), statut: 'EN_COURS', createdById: drh }, select: { id: true } });
  await prisma.periodeStage.create({ data: { stageId: s1.id, ordre: 1, divisionId: div.DPE, sectionId: sec.SSR.id, dateDebut: new Date(auj - 30 * JOUR), dateFin: new Date(+auj + 60 * JOUR), formatEvaluation: 'GRILLE', statut: 'EN_COURS', tuteurId: agents[0] }, select: { id: true } });
  await prisma.stage.create({ data: { stagiaireId: stg2, etablissement: 'ISSEG', dateDebut: new Date(+auj + 10 * JOUR), dateFin: new Date(+auj + 100 * JOUR), statut: 'PREVU', createdById: drh }, select: { id: true } });
  await prisma.stage.create({ data: { stagiaireId: stg3, etablissement: 'Université de Sonfonia', dateDebut: new Date(auj - 200 * JOUR), dateFin: new Date(auj - 20 * JOUR), statut: 'TERMINE', createdById: drh }, select: { id: true } });

  const arr = await prisma.registreCourrier.create({ data: { code: 'RPR-ARR', libelle: 'Arrivée (reprise)', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{AAAA}/{N}' }, select: { id: true } });
  const dep = await prisma.registreCourrier.create({ data: { code: 'RPR-DEP', libelle: 'Départ (reprise)', nature: 'DEPART', portee: 'DIRECTION', gabaritNumero: '{AAAA}/{N}' }, select: { id: true } });
  await prisma.habilitationCourrier.create({ data: { userId: assDn, registreId: arr.id, uniteKey: 'DNPEC', accordeeParId: admin }, select: { id: true } });
  await prisma.habilitationCourrier.create({ data: { userId: assDn, registreId: dep.id, uniteKey: 'DNPEC', accordeeParId: admin }, select: { id: true } });
  await prisma.habilitationCourrier.create({ data: { userId: agents[17], registreId: arr.id, uniteKey: 'DNPEC', accordeeParId: admin, revoqueeAt: new Date(), revoqueeParId: admin }, select: { id: true } });
  await prisma.habilitationLogistique.create({ data: { userId: agents[17], accordeeParId: admin }, select: { id: true } });
  await prisma.suppleance.create({ data: { titulaireId: chefsDiv.DPE, suppleantId: chefsDiv.DEE, startDate: new Date(Date.now() - JOUR), endDate: new Date(Date.now() + 10 * JOUR), createdById: chefsDiv.DPE }, select: { id: true } });
  const type = await prisma.leaveType.upsert({ where: { code: 'CONGE_ANNUEL' }, update: {}, create: { code: 'CONGE_ANNUEL', name: 'Congé annuel' }, select: { id: true } });
  for (const [i, status] of [[1, 'EN_ATTENTE'], [2, 'APPROUVEE'], [3, 'APPROUVEE']]) {
    await prisma.leaveRequest.create({ data: { userId: agents[i], leaveTypeId: type.id, startDate: new Date(+auj + i * JOUR), endDate: new Date(+auj + (i + 5) * JOUR), daysCount: 5, status }, select: { id: true } });
  }
  check(`jeu réaliste chargé : ${n} comptes, 5 divisions, 19 sections, 5 cellules`, (await prisma.user.count()) === n && (await prisma.section.count()) === 19 && (await prisma.cellule.count()) === 5);

  const tables = await tablesDAvant();
  fs.writeFileSync(path.join(DOSSIER, 'empreinte.json'), JSON.stringify({ tables, lignes: await empreinte(tables) }));
  fs.writeFileSync(path.join(DOSSIER, 'schema_avant.sql'), schema());
  check(`empreinte relevée : ${tables.length} tables, schéma d’avant N1 enregistré`, tables.length > 30);
}

async function apres() {
  const { tables, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const users = await prisma.user.findMany({ select: { id: true, role: true, status: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true, agentId: true, supervisor: { select: { role: true, celluleId: true } } } });
  const unites = await prisma.uniteOrganisationnelle.findMany();
  const parCode = Object.fromEntries(unites.map((u) => [u.code, u]));
  const direction = unites.find((u) => u.type === 'DIRECTION');
  check(`unités reprises : 1 Direction + 5 divisions + 19 sections + 5 cellules + secrétariat de direction (${unites.length})`,
    unites.length === 31 && unites.filter((u) => u.type === 'DIVISION').length === 5 && unites.filter((u) => u.type === 'SECTION').length === 19 && unites.filter((u) => u.type === 'CELLULE').length === 6 && !!parCode.SECDIR);
  const sections = await prisma.section.findMany({ select: { id: true, code: true, divisionId: true } });
  const divU = Object.fromEntries(unites.filter((u) => u.divisionId).map((u) => [u.divisionId, u]));
  check('chaque section sous sa division, chaque division et cellule sous la Direction',
    sections.every((s) => unites.find((u) => u.sectionId === s.id)?.parentId === divU[s.divisionId].id) && unites.filter((u) => u.type === 'DIVISION' || u.type === 'CELLULE').every((u) => u.parentId === direction.id));

  const actifs = users.filter((u) => u.status === 'ACTIF');
  const chefDe = (pred) => actifs.filter(pred).map((u) => u.id);
  const dn = actifs.find((u) => u.role === 'DN');
  let respOk = direction.responsableId === dn.id;
  for (const u of unites.filter((x) => x.divisionId)) { const c = chefDe((x) => x.role === 'CHEF_DIVISION' && x.divisionId === u.divisionId); respOk &&= u.responsableId === (c.length === 1 ? c[0] : null); }
  for (const u of unites.filter((x) => x.sectionId)) { const c = chefDe((x) => x.role === 'CHEF_SECTION' && x.sectionId === u.sectionId); respOk &&= u.responsableId === (c.length === 1 ? c[0] : null); }
  const cels = await prisma.cellule.findMany({ select: { id: true, chefId: true } });
  for (const c of cels) respOk &&= unites.find((u) => u.celluleId === c.id).responsableId === c.chefId;
  check('responsables déduits : DN, chefs de division et de section (un seul candidat), chefs de cellule', respOk);
  check(`section sans chef (${SANS_CHEF}) et section à deux chefs (${DEUX_CHEFS}) : poste signalé vide`, parCode[SANS_CHEF].responsableId === null && parCode[DEUX_CHEFS].responsableId === null);

  const agents = await prisma.agent.findMany();
  const agentDe = Object.fromEntries(agents.map((a) => [a.id, a]));
  const avecAgent = users.filter((u) => u.status !== 'EN_ATTENTE');
  check(`un agent par compte (hors inscriptions en attente) : ${avecAgent.length} comptes, ${agents.length} agents`, agents.length === avecAgent.length && avecAgent.every((u) => u.agentId && agentDe[u.agentId]));
  check('aucun compte actif sans agent', actifs.every((u) => u.agentId));
  check('inscriptions en attente : pas encore d’agent (rapprochement à l’approbation)', users.filter((u) => u.status === 'EN_ATTENTE').every((u) => !u.agentId));
  const statutAttendu = { ACTIF: 'EN_ACTIVITE', SUSPENDU: 'SUSPENDU', SUPPRIME: 'PARTI' };
  check('statuts : actif → en activité, suspendu → suspendu, supprimé → parti', avecAgent.every((u) => agentDe[u.agentId].statut === statutAttendu[u.status]));
  const secU = Object.fromEntries(unites.filter((u) => u.sectionId).map((u) => [u.sectionId, u.id]));
  const celU = Object.fromEntries(unites.filter((u) => u.celluleId).map((u) => [u.celluleId, u.id]));
  const uniteAttendue = (u) => {
    if (u.role === 'ASSISTANT_DIRECTION') return u.supervisor?.role === 'CHEF_CELLULE' ? celU[u.supervisor.celluleId] : parCode.SECDIR.id;
    if (u.sectionId) return secU[u.sectionId];
    if (u.divisionId) return divU[u.divisionId].id;
    if (u.celluleId) return celU[u.celluleId];
    return direction.id;
  };
  const malPlaces = avecAgent.filter((u) => agentDe[u.agentId].uniteId !== uniteAttendue(u));
  check('unité de chaque agent = son rattachement (assistants DN/DNA au secrétariat, sans rattachement → Direction)', malPlaces.length === 0, malPlaces.map((u) => u.role).join(','));
  const matricules = agents.map((a) => a.matricule);
  check('matricules provisoires uniques P-000001…', agents.every((a) => a.matriculeProvisoire && /^P-\d{6}$/.test(a.matricule)) && new Set(matricules).size === matricules.length);
  const stages = await prisma.stage.findMany({ where: { statut: { in: ['PREVU', 'EN_COURS'] } }, select: { stagiaireId: true, dateFin: true } });
  check('stagiaires à stage ouvert : fin prévue = fin du stage (nature STAGE)', stages.length === 2 && stages.every((s) => { const a = agentDe[users.find((u) => u.id === s.stagiaireId).agentId]; return a.natureFinPrevue === 'STAGE' && +a.dateFinPrevue === +s.dateFin; }));

  const attr = await prisma.attributionRole.findMany({ where: { retireLe: null } });
  const nb = (r) => attr.filter((a) => a.role === r).length;
  const habC = await prisma.habilitationCourrier.count({ where: { revoqueeAt: null } });
  check(`rôles repris : Validateur 2, Chef SAF 1, DRH 1, Assistant 3, Agent courrier ${habC}, Gestionnaire logistique 1, Encadreur de stage 1`,
    nb('VALIDATEUR') === 2 && nb('CHEF_SAF') === 1 && nb('DRH') === 1 && nb('ASSISTANT') === 3 && nb('AGENT_COURRIER') === habC && nb('GESTIONNAIRE_LOGISTIQUE') === 1 && nb('ENCADREUR_STAGE') === 1,
    JSON.stringify(Object.fromEntries([...new Set(attr.map((a) => a.role))].map((r) => [r, nb(r)]))));
  check('habilitation courrier révoquée : reflet retiré (historique conservé)', (await prisma.attributionRole.count({ where: { role: 'AGENT_COURRIER', retireLe: { not: null } } })) === 1);
  check('Gestionnaire RH et Gestionnaire paie : aucun (attribués à la main par l’administrateur)', nb('GESTIONNAIRE_RH') === 0 && nb('GESTIONNAIRE_PAIE') === 0);

  const { pertes, ajouts } = comparer(lignes, await empreinte(tables), ['audit_logs', 'cellules']);
  await secretariatSeulAjoute('');
  check('aucune donnée d’avant N1 modifiée ni perdue (comptes, organisation, stages, habilitations, suppléances, congés…)', pertes.length === 0, pertes.join(' ; '));
  check('aucune autre ligne ajoutée aux tables d’avant N1 (hors journal d’audit de la reprise)', ajouts.length === 0, ajouts.join(' ; '));

  // Idempotence : une seconde reprise (redémarrage de l'API) ne crée ni ne modifie rien.
  const { NestFactory } = require('@nestjs/core');
  const app = await NestFactory.createApplicationContext(require(E.API_DIST + '/app.module').AppModule, { logger: false });
  const compter = async () => [await prisma.uniteOrganisationnelle.count(), await prisma.agent.count(), await prisma.attributionRole.count(), await prisma.mouvementAgent.count(), await prisma.historiqueUnite.count()].join('/');
  const avant = await compter();
  await app.get(require(E.API_DIST + '/socle/reprise-n1.service').ReprisesN1Service).reconcilier();
  const ensuite = await compter();
  await app.close();
  check(`reprise idempotente (unités/agents/rôles/mouvements/historique : ${avant})`, avant === ensuite, ensuite);
}

async function retour() {
  const { tables, lignes } = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'empreinte.json'), 'utf8'));
  const avant = fs.readFileSync(path.join(DOSSIER, 'schema_avant.sql'), 'utf8');
  const apres = schema();
  fs.writeFileSync(path.join(DOSSIER, 'schema_apres_retour.sql'), apres);
  check('après retour arrière : schéma identique à celui d’avant N1 (pg_dump --schema-only)', avant === apres);
  const migr = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name LIKE '%socle_nimba_n1'`);
  check('… migration N1 retirée du journal (ré-application possible)', migr[0].n === 0);
  const { pertes, ajouts } = comparer(lignes, await empreinte(tables), ['audit_logs', 'cellules']);
  await secretariatSeulAjoute('… ');
  check('… aucune donnée d’avant N1 modifiée ni perdue', pertes.length === 0, pertes.join(' ; '));
  check('… aucune autre ligne ajoutée hors journal d’audit', ajouts.length === 0, ajouts.join(' ; '));
}

(async () => {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(PSQL_URL)) throw new Error('Base non locale : refus.');
  if (MODE === 'charger') await charger();
  else if (MODE === 'apres') await apres();
  else if (MODE === 'retour') await retour();
  else throw new Error(`N1_MODE inconnu : ${MODE}`);
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
