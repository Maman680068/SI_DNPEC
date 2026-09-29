// N1 — matrice des habilitations (cahier NIMBA v2.2, annexe 1, critère CA-A-01, SOC-MNT-04).
// Chaque case testable aujourd'hui est jouée par un appel réel, pour chaque profil du jeu de test.
// Trois issues possibles par ligne :
//   CONFORME — le comportement est celui de l'annexe ;
//   ÉCART    — comportement actuel conservé en N1 (décision du 4e point de validation N1),
//              vérifié tel quel pour qu'aucune régression ne passe inaperçue, et aligné plus tard ;
//   LOT      — objet livré par un lot ultérieur (N2, N3, N5, N6) ou hors périmètre : non joué ici.
// Le tableau complet est écrit dans $E2E_OUT/matrice_n1.md (repris dans docs/NIMBA_matrice_N1.md).
const fs = require('fs');
const path = require('path');
const E = require('../config');
const { call, ids, check, bilan, preuve } = require('../lib');

const S = Date.now().toString(36).slice(-4).toUpperCase();
const PROFILS = {
  dn: 'DN', dna: 'DNA', chefdpe: 'Chef de division', chefssr: 'Chef de section', agent1: 'Agent',
  drh: 'DRH', chefsaf: 'Chef SAF', assdn: 'Assistant DN', admin: 'Administrateur',
};
const ok = (s) => s >= 200 && s < 300;
const lignes = [];

/** Joue une case : `attendu` = true (accès) ou false (refus 403). */
async function caseMatrice({ objet, profil, action, annexe, appel, attendu, ecart }) {
  const r = await appel();
  const accede = ok(r.status);
  const refus = r.status === 403;
  const conforme = attendu ? accede : refus;
  const issue = ecart ? 'ÉCART' : 'CONFORME';
  check(`${objet} — ${PROFILS[profil]} — ${action} (annexe : ${annexe})${ecart ? ' [écart conservé]' : ''} → ${r.status}`, conforme);
  lignes.push({ objet, profil: PROFILS[profil], action, annexe, obtenu: accede ? 'accès' : `refus (${r.status})`, issue, ecart: ecart || '' });
}

const LOTS = [
  ['Activité / plan de travail', 'N5 (plan de travail objectif → activité → tâche)'],
  ['Instruction de la Direction', 'N5'],
  ['Mouvement de carrière et acte RH, effectifs et alertes RH', 'N6'],
  ['Document publié — statut de diffusion', 'N4'],
  ['Campagne et bulletin de paie, élément de rémunération, ordre de paiement', 'hors périmètre (D5, finances SAF)'],
  ['Objets du domaine modélisation (annexe 1.3)', 'hors périmètre (domaine B)'],
];

(async () => {
  const organigramme = await call('agent1', 'GET', '/api/v1/organigramme');
  const direction = organigramme.body.unites.find((u) => u.type === 'DIRECTION');
  const uDpe = organigramme.body.unites.find((u) => u.code === 'DPE');

  console.log('— 1.1 / 1.2 Unité organisationnelle : L(T) pour tous, CLM(T) pour le DRH et l’administrateur');
  for (const profil of Object.keys(PROFILS)) {
    await caseMatrice({ objet: 'Unité organisationnelle', profil, action: 'lire (organigramme complet)', annexe: 'L(T)', attendu: true, appel: () => call(profil, 'GET', '/api/v1/organigramme') });
  }
  for (const profil of Object.keys(PROFILS)) {
    const gere = profil === 'drh' || profil === 'admin';
    let cree;
    await caseMatrice({
      objet: 'Unité organisationnelle', profil, action: 'créer', annexe: gere ? 'CLM(T)' : 'L(T)', attendu: gere,
      appel: async () => (cree = await call(profil, 'POST', '/api/v1/unites', { type: 'INSTANCE', parentId: direction.id, code: `MX${S}${profil.slice(0, 3).toUpperCase()}`, libelle: `Matrice ${profil}` })),
    });
    if (gere) {
      await caseMatrice({ objet: 'Unité organisationnelle', profil, action: 'modifier', annexe: 'CLM(T)', attendu: true, appel: () => call(profil, 'PATCH', `/api/v1/unites/${cree.body.id}`, { libelle: `Matrice ${profil} (modifiée)` }) });
      await call(profil, 'POST', `/api/v1/unites/${cree.body.id}/fermeture`, { motif: 'Test de la matrice' });
    } else {
      await caseMatrice({ objet: 'Unité organisationnelle', profil, action: 'modifier', annexe: 'L(T)', attendu: false, appel: () => call(profil, 'PATCH', `/api/v1/unites/${uDpe.id}`, { libelle: uDpe.libelle }) });
    }
  }

  console.log('— Compte utilisateur : L(T) DN/DNA/DRH, L(P) chefs, L(S) agent, CLMS(T) administrateur');
  const listeComptes = async (profil) => (await call(profil, 'GET', '/users')).body.length;
  const total = await listeComptes('admin');
  const portee = { dn: total, dna: total, drh: total, admin: total, agent1: 1 };
  for (const [profil, n] of Object.entries(portee)) {
    await caseMatrice({
      objet: 'Compte utilisateur', profil, action: `lister (${n === 1 ? 'soi-même' : 'toute la Direction'})`, annexe: n === 1 ? 'L(S)' : profil === 'admin' ? 'CLMS(T)' : 'L(T)', attendu: true,
      appel: async () => { const r = await call(profil, 'GET', '/users'); return { status: r.body.length === n ? r.status : 599 }; },
    });
  }
  for (const profil of ['chefdpe', 'chefssr']) {
    await caseMatrice({ objet: 'Compte utilisateur', profil, action: 'lire un compte de son périmètre', annexe: 'L(P)', attendu: true, appel: () => call(profil, 'GET', `/users/${ids.agent1}`) });
    await caseMatrice({ objet: 'Compte utilisateur', profil, action: 'lire un compte hors périmètre', annexe: 'L(P)', attendu: false, appel: () => call(profil, 'GET', `/users/${ids.agentdee}`) });
  }
  await caseMatrice({ objet: 'Compte utilisateur', profil: 'agent1', action: 'lire le compte d’un collègue', annexe: 'L(S)', attendu: false, appel: () => call('agent1', 'GET', `/users/${ids.agent2}`) });
  await caseMatrice({
    objet: 'Compte utilisateur', profil: 'assdn', action: 'lister les comptes', annexe: '— (annexe 1.4 : compte réservé à l’administrateur)', attendu: true,
    ecart: 'L’assistant hérite de la visibilité de la liste de son superviseur (règle v2.3 de la DNPEC) ; la fiche détaillée reste refusée. À aligner avec l’annexe 1.4.',
    appel: () => call('assdn', 'GET', '/users'),
  });
  for (const profil of Object.keys(PROFILS).filter((p) => p !== 'admin')) {
    await caseMatrice({ objet: 'Compte utilisateur', profil, action: 'créer', annexe: 'C réservé à l’administrateur', attendu: false, appel: () => call(profil, 'POST', '/users', { email: `mx${S.toLowerCase()}${profil}@test.local`, password: 'Password123!', firstName: 'M', lastName: 'X', role: 'AGENT', divisionId: ids.DPE }) });
  }

  console.log('— Dossier agent : L*(T) DN/DNA, L*(P) chefs, L(S) agent, CLM(T) DRH, — administrateur et assistant');
  const dossier = (profil, userId) => () => call(profil, 'GET', `/personnel-files/${userId}`);
  await caseMatrice({ objet: 'Dossier agent', profil: 'dn', action: 'lire (toute la Direction)', annexe: 'L*(T)', attendu: true, appel: dossier('dn', ids.agentdee) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'dna', action: 'lire (toute la Direction)', annexe: 'L*(T)', attendu: true, appel: dossier('dna', ids.agentdee) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'chefdpe', action: 'lire (périmètre)', annexe: 'L*(P)', attendu: true, appel: dossier('chefdpe', ids.agent1) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'chefdpe', action: 'lire (hors périmètre)', annexe: 'L*(P)', attendu: false, appel: dossier('chefdpe', ids.agentdee) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'chefssr', action: 'lire (hors périmètre)', annexe: 'L*(P)', attendu: false, appel: dossier('chefssr', ids.agentdee) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'agent1', action: 'lire le sien', annexe: 'L(S)', attendu: true, appel: dossier('agent1', ids.agent1) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'agent1', action: 'lire celui d’un collègue', annexe: 'L(S)', attendu: false, appel: dossier('agent1', ids.agent2) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'drh', action: 'lire (toute la Direction)', annexe: 'CLM(T)', attendu: true, appel: dossier('drh', ids.agentdee) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'admin', action: 'lire', annexe: '—', attendu: false, appel: dossier('admin', ids.agent1) });
  await caseMatrice({ objet: 'Dossier agent', profil: 'assdn', action: 'lire', annexe: '— (jamais d’objet protégé par délégation)', attendu: false, appel: dossier('assdn', ids.agent1) });
  await caseMatrice({
    objet: 'Dossier agent', profil: 'chefsaf', action: 'lire (toute la Direction)', annexe: 'L*(T) (SAF / paie)', attendu: false,
    ecart: 'La lecture par le SAF sert la paie (D5), hors périmètre ; le chef SAF garde la portée de chef de cellule.',
    appel: dossier('chefsaf', ids.agent1),
  });

  console.log('— Agents (fiche du socle, distincte du compte) : DRH CLM(T), agent L(S), administrateur « agents sans compte »');
  const aAgent1 = (await call('drh', 'GET', `/api/v1/agents?recherche=${encodeURIComponent('')}&taille=500&statut=EN_ACTIVITE`)).body.donnees.find((a) => a.compte?.id === ids.agent1);
  for (const profil of Object.keys(PROFILS)) {
    const attendu = profil === 'drh';
    await caseMatrice({ objet: 'Dossier agent (liste des agents)', profil, action: 'lister', annexe: attendu ? 'CLM(T)' : profil === 'admin' ? '— (agents sans compte seulement, pour le rapprochement)' : 'lecture par le dossier du personnel', attendu, appel: () => call(profil, 'GET', '/api/v1/agents') });
  }
  await caseMatrice({ objet: 'Dossier agent (liste des agents)', profil: 'admin', action: 'lister les agents sans compte (identité, unité)', annexe: 'rapprochement compte ↔ agent (annexe 2.3)', attendu: true, appel: () => call('admin', 'GET', '/api/v1/agents?sansCompte=true') });
  await caseMatrice({ objet: 'Dossier agent (fiche agent)', profil: 'agent1', action: 'lire la sienne', annexe: 'L(S)', attendu: true, appel: () => call('agent1', 'GET', `/api/v1/agents/${aAgent1.id}`) });
  for (const profil of ['dn', 'chefdpe', 'admin', 'assdn']) {
    await caseMatrice({ objet: 'Dossier agent (fiche agent)', profil, action: 'lire celle d’un agent', annexe: profil === 'admin' || profil === 'assdn' ? '—' : 'L*(T/P) via le dossier du personnel', attendu: false, appel: () => call(profil, 'GET', `/api/v1/agents/${aAgent1.id}`) });
  }
  for (const profil of Object.keys(PROFILS).filter((p) => p !== 'drh')) {
    await caseMatrice({ objet: 'Agent — cycle de vie (annexe 2.2)', profil, action: 'suspendre', annexe: 'DRH exclusivement', attendu: false, appel: () => call(profil, 'POST', `/api/v1/agents/${aAgent1.id}/suspension`, { motif: 'Test de la matrice' }) });
  }

  console.log('— Compte, rôle, suppléance, réglage (annexe 1.4) : CLMV(T) administrateur, L(T) DN/DNA');
  for (const profil of Object.keys(PROFILS)) {
    const attendu = profil === 'admin';
    await caseMatrice({ objet: 'Rôle fonctionnel', profil, action: 'attribuer', annexe: attendu ? 'CLMV(T)' : profil === 'dn' || profil === 'dna' ? 'L(T)' : '—', attendu, appel: async () => {
      const r = await call(profil, 'POST', '/api/v1/attributions-roles', { userId: ids.agent2, role: 'ANALYSTE' });
      // ANALYSTE est sans écran en N1 : l'administrateur passe l'étape du droit puis bute sur la règle (400).
      return attendu && r.status === 400 ? { status: 200 } : r;
    } });
  }
  const vueDn = await call('dn', 'GET', '/api/v1/attributions-roles');
  await caseMatrice({
    objet: 'Rôle fonctionnel', profil: 'dn', action: 'lire toutes les attributions', annexe: 'L(T)', attendu: false,
    ecart: 'En N1, seuls l’administrateur et le DRH voient toutes les attributions ; le DN voit les siennes. La lecture DN/DNA arrive avec l’écran de supervision (N2).',
    appel: async () => ({ status: vueDn.body.attributions.every((a) => a.user.id === ids.dn) ? 403 : 200 }),
  });

  console.log('— Journal d’audit (N2) : L(T) DN/DNA et administrateur, L(P) chefs, L(S) agent');
  const porteeJournal = async (profil) => (await call(profil, 'GET', '/api/v1/journal-audit?taille=1')).body.portee;
  for (const [profil, attendu, annexe] of [['dn', 'Toute la Direction', 'L(T)'], ['dna', 'Toute la Direction', 'L(T)'], ['admin', 'Toute la Direction', 'L(T)'], ['chefdpe', 'Votre périmètre', 'L(P)'], ['chefssr', 'Votre périmètre', 'L(P)'], ['agent1', 'Vos propres actions', 'L(S)']]) {
    await caseMatrice({ objet: 'Journal d’audit', profil, action: `lire (${attendu.toLowerCase()})`, annexe, attendu: true, appel: async () => ({ status: (await porteeJournal(profil)) === attendu ? 200 : 599 }) });
  }
  await caseMatrice({
    objet: 'Journal d’audit', profil: 'drh', action: 'lire (ses propres actions)', annexe: 'L(P)', attendu: true,
    ecart: 'Le DRH n’a pas de périmètre hiérarchique propre en N1/N2 : il lit ses propres actions ; l’accès aux traces RH passera par les écrans RH (N6).',
    appel: async () => ({ status: (await porteeJournal('drh')) === 'Vos propres actions' ? 200 : 599 }),
  });

  console.log('— Paramétrage (N2) : L(T) DN/DNA, CLM(T) administrateur, — autres');
  for (const profil of Object.keys(PROFILS)) {
    const lit = ['dn', 'dna', 'admin'].includes(profil);
    await caseMatrice({ objet: 'Paramétrage', profil, action: 'lire', annexe: profil === 'admin' ? 'CLM(T)' : lit ? 'L(T)' : profil === 'drh' ? 'M(D4, D6) — réglages des stages dans leur écran' : '—', attendu: lit, appel: () => call(profil, 'GET', '/api/v1/parametres') });
    await caseMatrice({ objet: 'Paramétrage', profil, action: 'modifier', annexe: profil === 'admin' ? 'CLM(T)' : lit ? 'L(T)' : '—', attendu: profil === 'admin', appel: () => call(profil, 'PATCH', '/api/v1/parametres/session.expirationJours', { valeur: 30 }) });
  }

  console.log('— Congés (N3) : motif médical au DRH seul, avis du chef, décision du DRH');
  let types = (await call('agent1', 'GET', '/leave-types')).body;
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie']]) if (!types.some((x) => x.code === code)) await call('admin', 'POST', '/leave-types', { code, name });
  types = (await call('agent1', 'GET', '/leave-types')).body;
  const jourM = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const med = (await call('agent1', 'POST', '/leaves', { leaveTypeId: types.find((t) => t.code === 'CONGE_MALADIE').id, startDate: jourM(120), endDate: jourM(121), reason: `Motif matrice ${S}` })).body;
  // « Accès » = motif transmis (avec une réauthentification valide) ; sinon la demande est lue sans son motif.
  for (const profil of Object.keys(PROFILS)) {
    await caseMatrice({ objet: 'Justificatif médical (motif)', profil, action: 'lire', annexe: profil === 'drh' ? 'L(T) après réauthentification' : profil === 'agent1' ? 'C(S) — le demandeur' : '— (existence et durée seulement)', attendu: ['drh', 'agent1'].includes(profil),
      appel: async () => { const h = { 'X-Reauth': await preuve(profil).catch(() => '') }; const r = await call(profil, 'GET', `/leaves/${med.id}`, undefined, h); return { status: r.status === 200 && r.body.reason ? 200 : 403 }; } });
  }
  const ordre = [...Object.keys(PROFILS).filter((p) => p !== 'chefssr'), 'chefssr'];
  for (const profil of ordre) {
    await caseMatrice({ objet: 'Demande d’absence — avis', profil, action: 'donner l’avis', annexe: profil === 'chefssr' ? 'V (chef d’unité le plus proche)' : '—', attendu: profil === 'chefssr', appel: () => call(profil, 'POST', `/leaves/${med.id}/avis`, { avis: 'FAVORABLE' }) });
  }
  for (const profil of [...Object.keys(PROFILS).filter((p) => p !== 'drh'), 'drh']) {
    await caseMatrice({ objet: 'Demande d’absence — décision', profil, action: 'approuver', annexe: profil === 'drh' ? 'V (DRH)' : '—', attendu: profil === 'drh', appel: () => call(profil, 'POST', `/leaves/${med.id}/approve`, {}) });
  }
  await call('agent1', 'POST', `/leaves/${med.id}/cancel`);

  // Rapport lisible : tableau des cases jouées + objets renvoyés à un lot ultérieur.
  const md = [
    '# Matrice des habilitations — état N3',
    '',
    'Généré par `tests/e2e/api/n1_matrice.js` (annexe 1 du cahier NIMBA v2.2). « ÉCART » : comportement actuel conservé en N1 et vérifié tel quel.',
    '',
    '| Objet | Profil | Action | Annexe | Obtenu | Issue |',
    '|---|---|---|---|---|---|',
    ...lignes.map((l) => `| ${l.objet} | ${l.profil} | ${l.action} | ${l.annexe} | ${l.obtenu} | ${l.issue} |`),
    '',
    '## Écarts conservés en N1',
    '',
    ...[...new Set(lignes.filter((l) => l.ecart).map((l) => `- **${l.objet} — ${l.profil}** : ${l.ecart}`))],
    '',
    '## Objets livrés par un lot ultérieur (non joués en N1)',
    '',
    ...LOTS.map(([o, l]) => `- ${o} : ${l}`),
    '',
    'Les autres objets déjà en service (tâche, réunion, décision, courrier, document, annonce, stage) restent',
    'couverts par leurs suites existantes (`a*`, `b*`, `c*`, `d*`) ; ils seront rejoués dans cette matrice lorsqu’ils',
    'passeront sur le moteur d’autorisation du socle.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(E.OUT, 'matrice_n1.md'), md);
  console.log(`Matrice écrite : ${lignes.length} cases jouées, ${lignes.filter((l) => l.issue === 'ÉCART').length} écarts conservés, ${LOTS.length} objets renvoyés à un lot ultérieur.`);
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
