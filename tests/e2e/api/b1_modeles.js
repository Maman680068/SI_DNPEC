// Domaine B, lot B1 — référentiel des modèles et dépôt par paquet (format « dnpec-modele/1 »), sur l'API
// réelle et le service de calcul local (paquet factice en Python pur), derrière le relais de test :
// rôles de modélisation (le rang ne donne aucun droit), dépôt contrôlé (zip piégé refusé, modele.json
// validé), vérification automatique, réglage des manettes (bornes), envoi, dérogation à deux,
// approbation (jamais par l'auteur), refus, abandon, immutabilité en base, exécution interne (chiffres
// au demandeur seul, jamais à l'administrateur), service endormi puis injoignable, supervision, audit.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { call, ids, login, check, expect, bilan } = require('../lib');
const E = require('../config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE = process.env.BASE || 'http://localhost:3000';
const RELAIS = 'http://localhost:3301';
const S = Date.now().toString(36).slice(-5).toUpperCase();
const DOSSIER = E.tmp('b1');
fs.mkdirSync(DOSSIER, { recursive: true });
const FACTICE = path.join(E.RACINE, 'apps/calcul/exemples/paquet_factice');
const CONSTRUIRE = path.join(E.RACINE, 'apps/calcul/exemples/construire_paquet.py');
const PY = process.env.CALCUL_PYTHON || 'python3';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;
function paquet(fiche = {}, piege) {
  const sortie = path.join(DOSSIER, `p${++n}.zip`);
  execFileSync(PY, [CONSTRUIRE, FACTICE, sortie, '--fiche', JSON.stringify(fiche), ...(piege ? ['--piege', piege] : [])]);
  return fs.readFileSync(sortie);
}
async function deposer(cle, zip, confirmation = 'true', nom = 'paquet.zip') {
  const fd = new FormData();
  if (confirmation !== null) fd.append('donneesConfirmees', confirmation);
  if (zip) fd.append('paquet', new Blob([zip], { type: 'application/zip' }), nom);
  const r = await fetch(BASE + '/api/v1/modeles/versions', { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(cle)) }, body: fd });
  const t = await r.text();
  let b;
  try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
}
async function relais(mode, delaiMs) {
  await fetch(RELAIS + '/__relais/mode', { method: 'POST', body: JSON.stringify({ mode, delaiMs }) });
}
/** Attend que la version quitte DEPOSEE (ou que la vérification échoue) ; renvoie les étapes vues. */
async function verification(versionId, maxMs = 60000) {
  const etapes = new Set();
  const fin = Date.now() + maxMs;
  for (;;) {
    const v = (await call('admin', 'GET', `/api/v1/modeles/versions/${versionId}`)).body;
    if (v.verification?.etape) etapes.add(v.verification.etape);
    if (v.statut !== 'DEPOSEE' || v.verification?.statut === 'ECHEC' || Date.now() > fin) return { v, etapes };
    await attendre(300);
  }
}
async function travailFini(cle, id, maxMs = 30000) {
  const fin = Date.now() + maxMs;
  for (;;) {
    const t = (await call(cle, 'GET', `/api/v1/modelisation/travaux/${id}`)).body;
    if (['TERMINE', 'ECHEC'].includes(t.statut) || Date.now() > fin) return t;
    await attendre(300);
  }
}
const audit = async (event, entityId) => prisma.auditLog.count({ where: { ...(entityId ? { entityId } : {}), metadata: { path: ['event'], equals: event } } });
const reglagesDe = (v, change = {}) => ({
  manettes: v.manettes.map((m) => ({ id: m.id, actif: m.actif, min: m.min, max: m.max, ...(change[m.id] || {}) })),
  compteurs: v.compteurs.map((c) => ({ id: c.id, actif: c.actif })),
});
const SQL = (q) => prisma.$executeRawUnsafe(q).then(() => 'ok', (e) => String(e.message || e));

(async () => {
  console.log('— Accès : le rang ne donne aucun droit');
  expect('agent sans rôle de modélisation : liste des modèles', await call('agent1', 'GET', '/api/v1/modeles'), 403);
  expect('chef de division sans rôle : liste des modèles', await call('chefdpe', 'GET', '/api/v1/modeles'), 403);
  expect('DN sans rôle : liste des modèles', await call('dn', 'GET', '/api/v1/modeles'), 403);
  const nav = async (k) => (await call(k, 'GET', '/api/v1/navigation')).body;
  check('menu Modélisation absent pour le chef de division sans rôle', (await nav('chefdpe')).modelisation === false);
  const liste0 = await call('admin', 'GET', '/api/v1/modeles');
  check('administrateur : liste ouverte, « Déposer un modèle » proposé', liste0.status === 200 && liste0.body.droits.peutDeposer === true);
  check('menu Modélisation présent pour l’administrateur', (await nav('admin')).modelisation === true);

  console.log('— Rôles de modélisation');
  const motif = 'Décision du chef de la DPE du 6 octobre 2026';
  expect('DN : attribuer le rôle d’analyste (administrateur seul)', await call('dn', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefdpe, role: 'ANALYSTE', motif }), 403);
  expect('motif trop court', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefdpe, role: 'ANALYSTE', motif: 'ok' }), 400);
  expect('analyste attribué au chef de division (motif)', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefdpe, role: 'ANALYSTE', motif }), 201);
  expect('… une seconde fois', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefdpe, role: 'ANALYSTE', motif }), 409);
  expect('l’administrateur n’est jamais analyste', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.admin, role: 'ANALYSTE', motif }), 409);
  const stag = (await call('admin', 'POST', '/users', { email: `b1.stag.${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'Stagiaire', lastName: `B1${S}`, role: 'STAGIAIRE' })).body;
  expect('un stagiaire ne reçoit jamais de rôle de modélisation', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: stag.id, role: 'ANALYSTE', motif }), 409);
  check('chef de division analyste : liste ouverte, menu présent', (await call('chefdpe', 'GET', '/api/v1/modeles')).status === 200 && (await nav('chefdpe')).modelisation === true);
  check('aide : guide « Analyste » proposé', (await call('chefdpe', 'GET', '/aide/profils')).body.profils.includes('ANALYSTE_MODELE'));
  const notifAnalyste = await prisma.notification.findFirst({ where: { userId: ids.chefdpe, type: 'ROLE_MODIFIE', title: { contains: 'Analyste' } } });
  check('personne prévenue de son rôle (notification « Rôle de modélisation »)', !!notifAnalyste);
  check('audit : attribution tracée', (await audit('attribution_role_modelisation')) >= 1);

  console.log('— Dépôt contrôlé avant tout stockage');
  const versionsAvant = await prisma.versionModele.count();
  const zipA = paquet({ code: `TEST_B1A_${S}`, nom: `TEST — Modèle B1 A ${S}` });
  expect('analyste : dépôt (administrateur seul)', await deposer('chefdpe', zipA), 403);
  expect('case « données publiées ou autorisées » absente', await deposer('admin', zipA, null), 400);
  expect('case décochée', await deposer('admin', zipA, 'false'), 400);
  expect('aucun fichier', await deposer('admin', null), 422);
  expect('fichier qui n’est pas un zip', await deposer('admin', Buffer.from('pas un zip')), 422);
  for (const piege of ['absolu', 'remontee', 'lien', 'sans_modele']) {
    const r = await deposer('admin', paquet({ code: `TEST_PIEGE_${S}` }, piege));
    check(`zip piégé (${piege}) refusé : 422 PAQUET_REFUSE`, r.status === 422 && r.body.code === 'PAQUET_REFUSE', r.body.message);
  }
  const invalide = await deposer('admin', paquet({ code: `TEST_INV_${S}`, manettes: [{ id: 'x', libelle: 'X', type: 'choc', min: 10, max: 5 }, { id: 'x', libelle: 'X', type: 'choc', min: 0, max: 1 }] }));
  check('modele.json non conforme (min ≥ max, identifiant en double) : 422 et détails', invalide.status === 422 && invalide.body.details?.some((d) => /min < max/.test(d)) && invalide.body.details?.some((d) => /double/.test(d)), JSON.stringify(invalide.body.details));
  expect('format inconnu', await deposer('admin', paquet({ code: `TEST_FMT_${S}`, format: 'autre/2' })), 422);
  check('rien n’a été enregistré', (await prisma.versionModele.count()) === versionsAvant);

  console.log('— Dépôt, vérification automatique');
  const d1 = await deposer('admin', zipA, 'true', 'TEST_B1A_v1.zip');
  check('dépôt accepté : version 1 « vérification automatique »', d1.status === 201 && d1.body.numero === 1 && d1.body.statut === 'DEPOSEE', JSON.stringify(d1.body).slice(0, 200));
  const modeleA = d1.body.modele.id;
  const v1 = d1.body.id;
  check('empreinte SHA-256 du paquet', /^[0-9a-f]{64}$/.test(d1.body.empreinte));
  const { v: v1c } = await verification(v1);
  check('contrôles de dépôt reçus du service de calcul : version « manettes à régler »', v1c.statut === 'CONTROLEE' && v1c.controles.length === 4, `${v1c.statut} ${v1c.verification?.message || ''}`);
  check('3 contrôles réussis, 1 alerte (dynamique)', v1c.resume.reussis === 3 && v1c.resume.alertes === 1 && v1c.resume.echecs === 0, JSON.stringify(v1c.resume));
  check('libellés repris de la fiche du modèle', v1c.controles.find((c) => c.id === 'equilibre')?.libelle === 'Équilibre emplois-ressources');
  check('audit : dépôt (case confirmée) et contrôles tracés', (await audit('depot_version', v1)) === 1 && (await audit('controles_depot', v1)) === 1);
  const dep = await prisma.auditLog.findFirst({ where: { entityId: v1, metadata: { path: ['event'], equals: 'depot_version' } } });
  check('… mention de la case « données publiées ou autorisées » dans l’audit', /publiées ou autorisées/.test(JSON.stringify(dep?.metadata)));
  expect('même modèle redéposé pendant qu’une version est en cours', await deposer('admin', zipA), 409);
  const l0 = (await call('admin', 'GET', '/api/v1/modeles')).body.modeles.find((m) => m.id === modeleA);
  check('liste : colonne « Contrôles » = « Sans version active », pas de base de référence avant activation', l0.controles?.code === 'SANS_VERSION_ACTIVE' && l0.controles.libelle === 'Sans version active' && l0.baseReference === null);

  console.log('— Manettes et compteurs (étape 3)');
  expect('analyste : régler les manettes', await call('chefdpe', 'PUT', `/api/v1/modeles/versions/${v1}/reglages`, reglagesDe(v1c)), 403);
  const elargi = await call('admin', 'PUT', `/api/v1/modeles/versions/${v1}/reglages`, reglagesDe(v1c, { prix_petrole: { max: 500 } }));
  check('bornes élargies au-delà du paquet : 422', elargi.status === 422 && /celles du paquet/.test(elargi.body.message), elargi.body.message);
  expect('minimum ≥ maximum', await call('admin', 'PUT', `/api/v1/modeles/versions/${v1}/reglages`, reglagesDe(v1c, { prix_petrole: { min: 10, max: 10 } })), 422);
  expect('manette inconnue', await call('admin', 'PUT', `/api/v1/modeles/versions/${v1}/reglages`, { ...reglagesDe(v1c), manettes: [...reglagesDe(v1c).manettes, { id: 'inconnue', actif: true, min: 0, max: 1 }] }), 422);
  const reg = await call('admin', 'PUT', `/api/v1/modeles/versions/${v1}/reglages`, reglagesDe(v1c, { prix_petrole: { max: 50 }, croissance_population: { actif: false } }));
  check('bornes resserrées et une manette décochée : enregistrées sur la version', reg.status === 200 && reg.body.manettes.find((m) => m.id === 'prix_petrole').max === 50 && reg.body.manettes.find((m) => m.id === 'croissance_population').actif === false);
  check('audit : réglage tracé (avant, après)', (await audit('reglage_manettes', v1)) === 1);

  console.log('— Envoi au responsable, désignation');
  expect('analyste : envoi au responsable', await call('chefdpe', 'POST', `/api/v1/modeles/versions/${v1}/envoi`), 403);
  const env = await call('admin', 'POST', `/api/v1/modeles/versions/${v1}/envoi`);
  check('envoyée : « en attente d’approbation »', env.status === 200 && env.body.statut === 'EN_ATTENTE');
  expect('manettes après l’envoi', await call('admin', 'PUT', `/api/v1/modeles/versions/${v1}/reglages`, reglagesDe(v1c)), 409);
  expect('chef de division (ni administrateur, ni DN, ni DNA) : désigner un responsable', await call('chefdee', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefssr, role: 'RESPONSABLE', modeleId: modeleA, motif }), 403);
  expect('DN : responsable du modèle désigné', await call('dn', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefssr, role: 'RESPONSABLE', modeleId: modeleA, motif }), 201);
  expect('administrateur : suppléant désigné', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefsfp, role: 'SUPPLEANT', modeleId: modeleA, motif }), 201);
  expect('même personne responsable et suppléante', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefssr, role: 'SUPPLEANT', modeleId: modeleA, motif }), 409);
  const aApprouver = await prisma.notification.findFirst({ where: { userId: ids.chefssr, type: 'TACHE_SOUMISE_VALIDATION', title: { contains: 'à approuver' } } });
  check('responsable désigné prévenu de la version à approuver', !!aApprouver && aApprouver.link === `/modelisation/${modeleA}`);
  check('« À traiter » du responsable : version à approuver', (await nav('chefssr')).aTraiter.some((a) => a.cle === 'modeles-approuver'));

  console.log('— Approbation : jamais l’administrateur, jamais un analyste');
  expect('administrateur : approuver (il n’active rien)', await call('admin', 'POST', `/api/v1/modeles/versions/${v1}/approbation`), 403);
  expect('analyste : approuver', await call('chefdpe', 'POST', `/api/v1/modeles/versions/${v1}/approbation`), 403);
  const ap = await call('chefssr', 'POST', `/api/v1/modeles/versions/${v1}/approbation`);
  check('responsable : version 1 approuvée et active', ap.status === 200 && ap.body.versions[0].statut === 'ACTIVE');
  check('audit : approbation et activation tracées', (await audit('approbation', v1)) === 1 && (await audit('activation', v1)) === 1);
  const liste1 = (await call('chefdpe', 'GET', '/api/v1/modeles')).body.modeles.find((m) => m.id === modeleA);
  check('liste : version active 1, responsable affiché', liste1.versionActive?.numero === 1 && /CHEFSSR/.test(liste1.responsable || ''));
  const ficheV1 = (await prisma.versionModele.findUnique({ where: { id: v1 } })).fiche;
  check(`liste : base de référence de la version active (paquet : « ${ficheV1.base} ») et contrôles « Alerte » (1 alerte)`, liste1.baseReference === (ficheV1.base ?? null) && !!liste1.baseReference && liste1.controles.code === 'ALERTE' && liste1.controles.libelle === 'Alerte');
  const lAdmin = (await call('admin', 'GET', '/api/v1/modeles')).body;
  check('administrateur : colonnes calculées, sans aucun chiffre de contrôle ni de simulation', lAdmin.modeles.find((m) => m.id === modeleA)?.controles.code === 'ALERTE' && !/"valeur"|"resultats"|"simulations"/.test(JSON.stringify(lAdmin)));
  expect('approuver une seconde fois', await call('chefssr', 'POST', `/api/v1/modeles/versions/${v1}/approbation`), 409);

  console.log('— Immutabilité en base (déclencheurs)');
  check('empreinte modifiée en SQL : refus', /immuable/.test(await SQL(`UPDATE versions_modele SET empreinte = repeat('0', 64) WHERE id = '${v1}'`)));
  check('fiche modifiée en SQL : refus', /immuable/.test(await SQL(`UPDATE versions_modele SET fiche = '{}' WHERE id = '${v1}'`)));
  check('manettes d’une version active modifiées en SQL : refus', /plus après/.test(await SQL(`UPDATE versions_modele SET manettes = '[]' WHERE id = '${v1}'`)));
  check('suppression en SQL : refus', /ne se supprime jamais/.test(await SQL(`DELETE FROM versions_modele WHERE id = '${v1}'`)));
  check('approbateur = auteur en SQL : refus (contrainte)', /approbateur_pas_auteur/.test(await SQL(`UPDATE versions_modele SET "approbateurId" = "auteurId" WHERE id = '${v1}'`)));
  check('affectation modifiée ou supprimée en SQL : refus', /se clôt/.test(await SQL(`UPDATE affectations_modelisation SET motif = 'x' WHERE "userId" = '${ids.chefdpe}'`)) && /se clôt/.test(await SQL(`DELETE FROM affectations_modelisation WHERE "userId" = '${ids.chefdpe}'`)));

  console.log('— Exécution interne : analystes et responsables, version active');
  const sc = { mode: 'dynamique', chocs: [{ manette: 'prix_petrole', valeur: 20, annees: [2026] }] };
  expect('administrateur : lancer une simulation', await call('admin', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: sc }), 403);
  expect('agent sans rôle : lancer une simulation', await call('agent1', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: sc }), 403);
  const hb = await call('chefdpe', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: { mode: 'statique', chocs: [{ manette: 'prix_petrole', valeur: 80 }] } });
  check('choc dans les bornes du paquet mais hors des bornes réglées : 422 BORNE_DEPASSEE', hb.status === 422 && hb.body.code === 'BORNE_DEPASSEE', hb.body.message);
  const inactive = await call('chefdpe', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: { mode: 'dynamique', hypotheses: [{ manette: 'croissance_population', valeur: 2 }] } });
  check('manette décochée par l’administrateur : 422 MANETTE_NON_AUTORISEE', inactive.status === 422 && inactive.body.code === 'MANETTE_NON_AUTORISEE');
  expect('champ inconnu dans le scénario', await call('chefdpe', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: { mode: 'statique', autre: 1 } }), 422);
  const ex = await call('chefdpe', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: sc });
  check('analyste : simulation acceptée (202) et mise en file', ex.status === 202 && ['EN_FILE', 'EN_COURS', 'TERMINE'].includes(ex.body.statut), JSON.stringify(ex.body).slice(0, 200));
  const t = await travailFini('chefdpe', ex.body.id);
  check('calcul terminé : résultat lu par le demandeur (années, écarts)', t.statut === 'TERMINE' && t.resultat?.statut === 'ok' && t.resultat.annees.length === 5 && typeof t.resultat.ecarts_pct['2026'].pib_reel.total === 'number', JSON.stringify(t).slice(0, 300));
  const tAdmin = await call('admin', 'GET', `/api/v1/modelisation/travaux/${ex.body.id}`);
  check('administrateur : état technique seul, aucun chiffre', tAdmin.status === 200 && tAdmin.body.statut === 'TERMINE' && !('resultat' in tAdmin.body) && !JSON.stringify(tAdmin.body).includes('ecarts'));
  expect('un autre analyste ou agent : 403', await call('agent1', 'GET', `/api/v1/modelisation/travaux/${ex.body.id}`), 403);
  const ficheAdmin = JSON.stringify((await call('admin', 'GET', `/api/v1/modeles/${modeleA}`)).body);
  check('fiche du modèle lue par l’administrateur : nombre de simulations, aucun chiffre', /"simulations":1\b/.test(ficheAdmin) && !/ecarts_pct|"resultat"|"scenario"/.test(ficheAdmin));
  // Paquet inconnu du service (cache vidé, ex. service redémarré) : l'API le renvoie avec la demande.
  fs.rmSync(path.join(E.OUT, 'calcul-cache'), { recursive: true, force: true });
  fs.mkdirSync(path.join(E.OUT, 'calcul-cache'), { recursive: true });
  const appelsAvant = (await (await fetch(RELAIS + '/__relais/appels')).json())['/executer'] || 0;
  const ex2 = await call('chefssr', 'POST', `/api/v1/modeles/${modeleA}/executer`, { scenario: { mode: 'statique', chocs: [{ manette: 'consommation_publique', valeur: 10 }] } });
  const t2 = await travailFini('chefssr', ex2.body.id);
  const appelsApres = (await (await fetch(RELAIS + '/__relais/appels')).json())['/executer'] || 0;
  check('responsable : simulation ; paquet inconnu du service → renvoyé (2 appels), calcul terminé', t2.statut === 'TERMINE' && t2.resultat?.statut === 'ok' && appelsApres - appelsAvant === 2, `${t2.statut} ${appelsApres - appelsAvant}`);
  check('audit : exécution demandée tracée (sans chiffre)', (await audit('execution_demandee', ex.body.id)) === 1);

  console.log('— Version 2 : contrôle bloquant en échec, dérogation à deux');
  const d2 = await deposer('admin', paquet({ code: `TEST_B1A_${S}`, nom: `TEST — Modèle B1 A ${S}`, essai: { controle_en_echec: 'equilibre' } }), 'true', 'TEST_B1A_v2.zip');
  const v2 = d2.body.id;
  const { v: v2c } = await verification(v2);
  check('version 2 : équilibre en échec (bloquant)', v2c.statut === 'CONTROLEE' && v2c.resume.echecs === 1 && v2c.controles.find((c) => c.id === 'equilibre').ok === false);
  await call('admin', 'POST', `/api/v1/modeles/versions/${v2}/envoi`);
  const bloque = await call('chefssr', 'POST', `/api/v1/modeles/versions/${v2}/approbation`);
  check('approbation sans dérogation : 409 CONTROLE_BLOQUANT', bloque.status === 409 && bloque.body.code === 'CONTROLE_BLOQUANT');
  expect('administrateur : demander la dérogation (le responsable seul)', await call('admin', 'POST', `/api/v1/modeles/versions/${v2}/derogations`, { controleId: 'equilibre', motif: 'Écart connu, documenté' }), 403);
  expect('dérogation sur un contrôle réussi', await call('chefssr', 'POST', `/api/v1/modeles/versions/${v2}/derogations`, { controleId: 'replication_base', motif: 'Écart connu, documenté' }), 409);
  expect('dérogation sans motif écrit', await call('chefssr', 'POST', `/api/v1/modeles/versions/${v2}/derogations`, { controleId: 'equilibre', motif: '' }), 400);
  const dem = await call('chefssr', 'POST', `/api/v1/modeles/versions/${v2}/derogations`, { controleId: 'equilibre', motif: 'Écart de 0,42 % expliqué par l’arrondi de la MCS publiée' });
  check('responsable : dérogation demandée (motif écrit)', dem.status === 200 && dem.body.derogations.length === 1 && !dem.body.derogations[0].confirmeeLe);
  expect('… une seconde fois', await call('chefssr', 'POST', `/api/v1/modeles/versions/${v2}/derogations`, { controleId: 'equilibre', motif: 'Écart connu, documenté' }), 409);
  check('administrateur prévenu de la demande de dérogation', !!(await prisma.notification.findFirst({ where: { userId: ids.admin, title: { contains: 'dérogation à confirmer' } } })));
  check('« À traiter » de l’administrateur : dérogation à confirmer', (await nav('admin')).aTraiter.some((a) => a.cle === 'modeles-derogations'));
  const vueAdmin = (await call('admin', 'GET', `/api/v1/modeles/versions/${v2}`)).body;
  check('administrateur : il voit le contrôle et l’écart (valeurs techniques)', vueAdmin.controles.find((c) => c.id === 'equilibre').valeur === 'écart 0.42 %' && vueAdmin.droits.derogationsConfirmables.includes('equilibre'));
  expect('responsable : confirmer sa propre demande', await call('chefssr', 'POST', `/api/v1/modeles/versions/${v2}/derogations/equilibre/confirmation`), 403);
  expect('administrateur : dérogation confirmée', await call('admin', 'POST', `/api/v1/modeles/versions/${v2}/derogations/equilibre/confirmation`), 200);
  expect('… confirmée une seconde fois', await call('admin', 'POST', `/api/v1/modeles/versions/${v2}/derogations/equilibre/confirmation`), 409);
  const ap2 = await call('chefsfp', 'POST', `/api/v1/modeles/versions/${v2}/approbation`);
  check('suppléant : version 2 approuvée, « activée avec dérogation »', ap2.status === 200 && ap2.body.versions[0].statut === 'ACTIVE' && /dérogation/.test(ap2.body.versions[0].etat.libelle));
  check('version 1 archivée et consultable, une seule version active', ap2.body.versions[1].statut === 'ARCHIVEE' && (await prisma.versionModele.count({ where: { modeleId: modeleA, statut: 'ACTIVE' } })) === 1);
  check('mention « avec dérogation » définitive (SQL : refus)', /définitive/.test(await SQL(`UPDATE versions_modele SET "avecDerogation" = false WHERE id = '${v2}'`)));
  check('deux versions actives en SQL : refus (index unique)', /23505|already exists/.test(await SQL(`INSERT INTO versions_modele (id, "modeleId", numero, empreinte, "fileKey", "nomFichier", "tailleOctets", fiche, manettes, compteurs, "donneesConfirmees", "auteurId", "approbateurId", statut, "updatedAt") VALUES ('b1-sql-${S}', '${modeleA}', 99, repeat('c', 64), 'k', 'f', 1, '{}', '[]', '[]', true, 'a', 'b', 'ACTIVE', now())`)));
  check('liste : version 2 active, colonne « Contrôles » = « Avec dérogation »', (await call('admin', 'GET', '/api/v1/modeles')).body.modeles.find((m) => m.id === modeleA)?.controles.libelle === 'Avec dérogation');
  check('audit : demande et confirmation de dérogation tracées', (await audit('derogation_demandee', v2)) === 1 && (await audit('derogation_confirmee', v2)) === 1);

  console.log('— Personne n’approuve son propre travail (administrateur responsable du modèle)');
  const admin2 = (await call('admin', 'POST', '/users', { email: `b1.admin2.${S.toLowerCase()}@test.local`, password: 'Password123!', firstName: 'Second', lastName: `Admin${S}`, role: 'ADMIN_SYSTEME', celluleId: ids.SAF })).body;
  const dB = await deposer('admin', paquet({ code: `TEST_B1B_${S}`, nom: `TEST — Modèle B1 B ${S}`, essai: { controle_en_echec: 'equilibre' } }));
  const modeleB = dB.body.modele.id;
  const vB = dB.body.id;
  await verification(vB);
  expect('administrateur désigné responsable du modèle B', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.admin, role: 'RESPONSABLE', modeleId: modeleB, motif }), 201);
  expect('suppléant du modèle B', await call('admin', 'POST', '/api/v1/modelisation/affectations', { userId: ids.chefsfp, role: 'SUPPLEANT', modeleId: modeleB, motif }), 201);
  await call('admin', 'POST', `/api/v1/modeles/versions/${vB}/envoi`);
  expect('responsable-auteur : dérogation demandée', await call('admin', 'POST', `/api/v1/modeles/versions/${vB}/derogations`, { controleId: 'equilibre', motif: 'Paquet de démonstration, écart voulu' }), 200);
  expect('… qu’il ne confirme pas lui-même (dérogation à deux)', await call('admin', 'POST', `/api/v1/modeles/versions/${vB}/derogations/equilibre/confirmation`), 403);
  await login(`b1.admin2.${S.toLowerCase()}`).catch(() => null);
  const r2 = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: admin2.email, password: 'Password123!' }) });
  const jeton2 = (await r2.json()).accessToken;
  const conf2 = await fetch(BASE + `/api/v1/modeles/versions/${vB}/derogations/equilibre/confirmation`, { method: 'POST', headers: { Authorization: 'Bearer ' + jeton2 } });
  check('second administrateur : dérogation confirmée', conf2.status === 200);
  const auto = await call('admin', 'POST', `/api/v1/modeles/versions/${vB}/approbation`);
  check('responsable-auteur : approbation refusée (403, « au suppléant »)', auto.status === 403 && /suppléant/.test(auto.body.message));
  expect('suppléant : approuve à sa place', await call('chefsfp', 'POST', `/api/v1/modeles/versions/${vB}/approbation`), 200);

  console.log('— Refus et abandon');
  const d3 = await deposer('admin', paquet({ code: `TEST_B1A_${S}`, nom: `TEST — Modèle B1 A ${S}`, version_paquet: '3' }));
  const v3 = d3.body.id;
  await verification(v3);
  await call('admin', 'POST', `/api/v1/modeles/versions/${v3}/envoi`);
  expect('refus sans motif', await call('chefssr', 'POST', `/api/v1/modeles/versions/${v3}/refus`, { motif: '' }), 400);
  const rf = await call('chefssr', 'POST', `/api/v1/modeles/versions/${v3}/refus`, { motif: 'Bornes à revoir avec la DPE' });
  check('responsable : version 3 refusée (motif)', rf.status === 200 && rf.body.versions[0].statut === 'REFUSEE');
  check('auteur prévenu du refus', !!(await prisma.notification.findFirst({ where: { userId: ids.admin, type: 'TACHE_REJETEE', title: { contains: 'version 3 refusée' } } })));
  check('version refusée : état définitif (SQL : refus)', /ne change plus/.test(await SQL(`UPDATE versions_modele SET statut = 'EN_ATTENTE' WHERE id = '${v3}'`)));
  const d4 = await deposer('admin', paquet({ code: `TEST_B1A_${S}`, nom: `TEST — Modèle B1 A ${S}`, version_paquet: '4' }));
  await verification(d4.body.id);
  const ab = await call('admin', 'POST', `/api/v1/modeles/versions/${d4.body.id}/abandon`, { motif: 'Mauvais fichier de données' });
  check('administrateur : dépôt abandonné avant l’envoi', ab.status === 200 && ab.body.statut === 'REFUSEE' && /abandonné/.test(ab.body.motifRefus));

  console.log('— Service de calcul endormi, puis injoignable');
  await relais('endormi', 4000);
  const d5 = await deposer('admin', paquet({ code: `TEST_B1A_${S}`, nom: `TEST — Modèle B1 A ${S}`, version_paquet: '5' }));
  const { v: v5, etapes } = await verification(d5.body.id);
  check('service endormi : « Réveil du service de calcul… » puis « Calcul en cours… », sans erreur', etapes.has('REVEIL') && v5.statut === 'CONTROLEE', [...etapes].join(', '));
  await call('admin', 'POST', `/api/v1/modeles/versions/${d5.body.id}/abandon`, { motif: 'Essai du réveil terminé' });
  await call('admin', 'PATCH', '/api/v1/parametres/calcul.tentativesMax', { valeur: 2 });
  await call('admin', 'PATCH', '/api/v1/parametres/calcul.delaiRelanceSecondes', { valeur: 5 });
  await relais('coupe');
  const d6 = await deposer('admin', paquet({ code: `TEST_B1A_${S}`, nom: `TEST — Modèle B1 A ${S}`, version_paquet: '6' }));
  const { v: v6 } = await verification(d6.body.id, 40000);
  check('service injoignable : 2 essais puis échec signalé, version gardée « vérification »', v6.statut === 'DEPOSEE' && v6.verification?.statut === 'ECHEC' && /injoignable après 2 essai/.test(v6.verification.message) && v6.droits.peutRelancerVerification === true, v6.verification?.message);
  const svc = async () => Object.fromEntries((await call('admin', 'GET', '/api/v1/supervision')).body.services.map((x) => [x.cle, x]));
  const s1 = await svc();
  check('supervision : service de calcul « injoignable »', s1.calcul?.etat === 'INDISPONIBLE' && /Injoignable/.test(s1.calcul.detail), s1.calcul?.detail);
  await relais('normal');
  expect('relance de la vérification', await call('admin', 'POST', `/api/v1/modeles/versions/${d6.body.id}/verification`), 200);
  const { v: v6b } = await verification(d6.body.id);
  check('… service revenu : version vérifiée', v6b.statut === 'CONTROLEE');
  const s2 = await svc();
  check('supervision : « Éveillé », dernier appel et durée moyenne', s2.calcul?.etat === 'NOMINAL' && /Éveillé/.test(s2.calcul.detail) && /durée moyenne/.test(s2.calcul.detail), s2.calcul?.detail);
  check('supervision : espace occupé par les paquets', s2.paquets?.etat === 'NOMINAL' && /Mo occupés par \d+ paquet/.test(s2.paquets.detail), s2.paquets?.detail);
  expect('DN : supervision (lecture)', await call('dn', 'GET', '/api/v1/supervision'), 200);
  await call('admin', 'POST', `/api/v1/modeles/versions/${d6.body.id}/abandon`, { motif: 'Fin des essais du service' });
  await call('admin', 'PATCH', '/api/v1/parametres/calcul.tentativesMax', { valeur: 10 });
  await call('admin', 'PATCH', '/api/v1/parametres/calcul.delaiRelanceSecondes', { valeur: 30 });
  const sansActive = await deposer('admin', paquet({ code: `TEST_B1C_${S}`, nom: `TEST — Modèle B1 C ${S}` }));
  await verification(sansActive.body.id);
  const sa = await call('chefdpe', 'POST', `/api/v1/modeles/${sansActive.body.modele.id}/executer`, { scenario: { mode: 'statique' } });
  check('modèle sans version active : 409 MODELE_SANS_VERSION_ACTIVE', sa.status === 409 && sa.body.code === 'MODELE_SANS_VERSION_ACTIVE');

  console.log('— Fin d’un rôle, historique, stagiaire');
  const lst = (await call('admin', 'GET', `/api/v1/modelisation/affectations?userId=${ids.chefdpe}`)).body;
  const aff = lst.affectations.find((a) => a.role === 'ANALYSTE' && !a.fin);
  expect('DN : mettre fin au rôle d’analyste (administrateur seul)', await call('dn', 'POST', `/api/v1/modelisation/affectations/${aff.id}/fin`, { motif: 'Changement d’affectation' }), 403);
  expect('administrateur : fin du rôle d’analyste (motif)', await call('admin', 'POST', `/api/v1/modelisation/affectations/${aff.id}/fin`, { motif: 'Changement d’affectation' }), 200);
  expect('… plus d’accès aux modèles', await call('chefdpe', 'GET', '/api/v1/modeles'), 403);
  const hist = (await call('admin', 'GET', `/api/v1/modelisation/affectations?userId=${ids.chefdpe}`)).body.affectations;
  check('historique conservé (fin datée, motif)', hist.some((a) => a.id === aff.id && a.fin && a.motifFin === 'Changement d’affectation'));
  const stagLogin = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: stag.email, password: 'Password123!' }) });
  const jetonStag = (await stagLogin.json()).accessToken;
  check('stagiaire : modèles fermés (403)', jetonStag && (await fetch(BASE + '/api/v1/modeles', { headers: { Authorization: 'Bearer ' + jetonStag } })).status === 403);
  expect('agent : affectations d’une personne (administrateur, DN, DNA seulement)', await call('agent1', 'GET', `/api/v1/modelisation/affectations?userId=${ids.chefdpe}`), 403);
  check('audit : fin de rôle tracée', (await audit('fin_role_modelisation', aff.id)) === 1);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch(async (e) => {
  console.error(e);
  await relais('normal').catch(() => null);
  process.exit(2);
});
