// Refonte de l'interface (étape 7) — GET api/v1/rh/dossiers : synthèse du dossier du personnel pour le
// DRH (bande de compteurs, lignes avec complétude et alertes). Lecture seule, DRH seul (403 pour tous les
// autres profils, stagiaire compris ; 401 sans session). Complétude calculée à la lecture sur une liste
// fermée (champs du niveau 1 + pièces requises actives) : dossier complet = 100 %, un élément manquant la
// fait baisser. Aucune donnée du niveau 2 (objet protégé, réauthentification) dans la réponse.
const { call, ids, check, expect, bilan, upload } = require('../lib');
const S = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE || 'http://localhost:3000';
const URL = '/api/v1/rh/dossiers';
const synthese = async () => (await call('drh', 'GET', URL)).body;
const ligneDe = async (userId) => (await synthese()).lignes.find((l) => l.userId === userId);
const attendu = (n, total) => Math.round((n / total) * 100);

(async () => {
  console.log('— Accès : DRH seul');
  const r401 = await fetch(BASE + URL);
  check('sans session : 401', r401.status === 401);
  const stg = (await call('admin', 'POST', '/users', { email: `psst${S}@test.local`, password: 'Password123!', firstName: 'Awa', lastName: `SynthStag${S}`, role: 'STAGIAIRE', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('stagiaire de test créé', !!stg.id, JSON.stringify(stg).slice(0, 120));
  for (const k of ['agent1', 'chefssr', 'chefdpe', 'dn', 'dna', 'admin', 'assdn', `psst${S}`]) {
    const r = await call(k, 'GET', URL);
    expect(`${k} : synthèse refusée`, r, 403);
    check(`${k} : enveloppe d’erreur api/v1 (code, trace_id), aucune ligne`, r.body && r.body.code && r.body.trace_id && !('lignes' in r.body));
  }
  const d = await call('drh', 'GET', URL);
  expect('DRH : synthèse lue', d, 200);
  const b = d.body;
  const s = b.synthese;
  check('forme : compteurs entiers, complétude moyenne en %, lignes', ['enActivite', 'suspendus', 'partis', 'aVerifier', 'matriculesProvisoires'].every((k) => Number.isInteger(s[k]) && s[k] >= 0) && (s.completudeMoyenne === null || (s.completudeMoyenne >= 0 && s.completudeMoyenne <= 100)) && Array.isArray(b.lignes) && b.lignes.length > 0, JSON.stringify(s));
  check('chaque ligne : complétude entre 0 et 100, statut connu, lien vers un écran existant', b.lignes.every((l) => Number.isInteger(l.completude) && l.completude >= 0 && l.completude <= 100 && ['EN_ACTIVITE', 'SUSPENDU', 'PARTI'].includes(l.statut) && /^\/(personnel\/|agents\?id=)/.test(l.lien)));
  const presents = b.lignes.filter((l) => l.statut !== 'PARTI');
  check('bande = lignes : « à vérifier », matricules provisoires, en activité', s.aVerifier === presents.filter((l) => l.aVerifier).length && s.matriculesProvisoires === presents.filter((l) => l.matriculeProvisoire).length && s.enActivite === b.lignes.filter((l) => l.statut === 'EN_ACTIVITE').length);
  check('complétude moyenne = moyenne des lignes présentes', s.completudeMoyenne === (presents.length ? Math.round(presents.reduce((x, l) => x + l.completude, 0) / presents.length) : null));
  check('GET /personnel-files : « syntheseDrh » pour le DRH seulement', (await call('drh', 'GET', '/personnel-files')).body.syntheseDrh === true && (await call('agent1', 'GET', '/personnel-files')).body.syntheseDrh === false && (await call('dn', 'GET', '/personnel-files')).body.syntheseDrh === false);

  console.log('— Complétude d’un dossier neuf, puis renseigné');
  const u = (await call('admin', 'POST', '/users', { email: `ps${S}@test.local`, password: 'Password123!', firstName: 'Fanta', lastName: `Synthese${S}`, role: 'AGENT', divisionId: ids.DPE, sectionId: ids.SSR })).body;
  check('compte de test créé', !!u.id, JSON.stringify(u).slice(0, 120));
  const K = `ps${S}`;
  let l = await ligneDe(u.id);
  const pieces = (await call('drh', 'GET', '/api/v1/rh/pieces-requises')).body.pieces.filter((p) => p.actif);
  const total = 5 + pieces.length;
  check(`éléments comptés : 5 champs + ${pieces.length} pièce(s) requise(s) active(s)`, (await synthese()).elementsCompletude === total);
  check('dossier neuf : ligne présente (agent provisoire), 0 %, matricule provisoire signalé', l && l.completude === 0 && l.matriculeProvisoire && l.alertes.some((a) => a.type === 'MATRICULE_PROVISOIRE' && a.libelle === 'Matricule provisoire') && l.lien === `/personnel/${u.id}`, JSON.stringify(l));
  expect('DRH : 4 champs du niveau 1', await call('drh', 'PATCH', `/personnel-files/${u.id}/basic`, { employmentStatus: 'FONCTIONNAIRE', grade: 'A2', echelon: '3', categorie: 'A' }), 200);
  l = await ligneDe(u.id);
  check(`4 champs sur ${total} : ${attendu(4, total)} %`, l.completude === attendu(4, total), l.completude);
  check('champs saisis par le DRH : dossier « à vérifier », alerte affichée', l.aVerifier && l.alertes.some((a) => a.type === 'DOSSIER_A_VERIFIER' && a.libelle === 'Dossier à vérifier'));
  expect('DRH : date de prise de service', await call('drh', 'PATCH', `/personnel-files/${u.id}/basic`, { serviceStartDate: '2015-01-05' }), 200);
  l = await ligneDe(u.id);
  check(`5 champs sur ${total} : ${attendu(5, total)} %`, l.completude === attendu(5, total), l.completude);
  for (const p of pieces) await upload('drh', `/personnel-files/${u.id}/documents`, { label: p.libelle, pieceRequiseId: p.id }, [{ field: 'file', name: 'piece.pdf' }]);
  l = await ligneDe(u.id);
  check('dossier complet (champs et pièces requises) : 100 %', l.completude === 100, l.completude);
  const alertesRh = (await call('drh', 'GET', '/api/v1/rh/alertes')).body;
  check('100 % ⇔ plus d’alerte « Dossier incomplet » (même liste fermée)', !alertesRh.some((a) => a.type === 'DOSSIER_INCOMPLET' && a.userId === u.id));

  console.log('— Un élément manquant fait baisser la complétude');
  const pr = await call('drh', 'POST', '/api/v1/rh/pieces-requises', { libelle: `Pièce synthèse ${S}`, ordre: 99 });
  expect('DRH : nouvelle pièce requise', pr, 201);
  l = await ligneDe(u.id);
  check(`pièce requise ajoutée, non fournie : ${attendu(total, total + 1)} %`, l.completude === attendu(total, total + 1) && l.completude < 100, l.completude);
  const doc = await upload('drh', `/personnel-files/${u.id}/documents`, { label: `Pièce synthèse ${S}`, pieceRequiseId: pr.body.id }, [{ field: 'file', name: 'piece.pdf' }]);
  check('pièce fournie : de nouveau 100 %', doc.status === 201 && (await ligneDe(u.id)).completude === 100, doc.status);
  expect('DRH : pièce retirée du dossier', await call('drh', 'DELETE', `/personnel-files/${u.id}/documents/${doc.body.id}`), 200);
  check('pièce retirée : la complétude baisse', (await ligneDe(u.id)).completude === attendu(total, total + 1));
  expect('DRH : pièce retirée de la liste des pièces requises', await call('drh', 'PATCH', `/api/v1/rh/pieces-requises/${pr.body.id}`, { actif: false }), 200);
  check('liste rétablie : 100 %', (await ligneDe(u.id)).completude === 100);

  console.log('— « À vérifier » et alertes RH reprises');
  expect('la personne confirme ses informations', await call(K, 'POST', `/personnel-files/${u.id}/confirm`), 201);
  l = await ligneDe(u.id);
  check('après confirmation : plus « à vérifier »', !l.aVerifier && !l.alertes.some((a) => a.type === 'DOSSIER_A_VERIFIER'));
  expect('DRH : dernier échelon en 2000', await call('drh', 'PATCH', `/personnel-files/${u.id}/basic`, { echelonDepuis: '2000-01-01' }), 200);
  l = await ligneDe(u.id);
  check('avancement d’échelon dû (calcul des alertes RH)', l.alertes.some((a) => a.type === 'AVANCEMENT_ECHELON' && a.libelle === 'Avancement d’échelon dû'), JSON.stringify(l.alertes));

  console.log('— Aucune donnée du niveau 2');
  const TEL = `+224 66${S}`, ADR = `Quartier Synthèse ${S}`;
  expect('DRH : informations personnelles (niveau 2)', await call('drh', 'PATCH', `/personnel-files/${u.id}/sensitive`, { personalPhone: TEL, personalAddress: ADR, emergencyContactName: `Urgence ${S}` }), 200);
  const brut = await fetch(BASE + URL, { headers: { Authorization: 'Bearer ' + (await require('../lib').login('drh')) } });
  const texte = await brut.text();
  check('lue sans réauthentification (aucun objet protégé)', brut.status === 200);
  check('aucune valeur du niveau 2 dans la réponse', !texte.includes(TEL) && !texte.includes(ADR) && !texte.includes(`Urgence ${S}`) && !texte.includes('piece.pdf'));
  check('aucun champ du niveau 2 (informations personnelles, diplômes, pièces)', !/personalPhone|personalAddress|personalEmail|emergencyContact|diplom|fileName|fileKey/i.test(texte));

  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
