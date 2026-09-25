// Lot D3 — dossier du personnel : liste = dossiers lisibles (force brute), niveau 2 jamais
// transmis hors personne/DRH (y compris en intérim), statuts « à vérifier », fichiers.
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
const J = 864e5, iso = (ms) => new Date(Date.now() + ms).toISOString();
const S = Date.now().toString(36).slice(-5);
const TEL = `+224 6${S}`, ADR = `Rue confidentielle ${S}`, DIP = `Master secret ${S}`, PIECE = `Pièce privée ${S}`;

async function envoyer(key, path, fields, nom, contenu, headers = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  if (nom) fd.append('file', new Blob([contenu]), nom);
  const r = await fetch(BASE + path, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(key)), ...headers }, body: fd });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function brut(key, path, headers = {}) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + (await login(key)), ...headers } });
  return { status: r.status, text: await r.text() };
}
async function suppleance(titulaire, suppleant) {
  const mine = (await call(titulaire, 'GET', '/suppleances/mine')).body.filter((s) => s.titulaireId === ids[titulaire] && !s.revokedAt && new Date(s.endDate) > new Date());
  for (const s of mine) await call(titulaire, 'POST', `/suppleances/${s.id}/revoke`);
  const r = await call(titulaire, 'POST', '/suppleances', { titulaireId: ids[titulaire], suppleantId: ids[suppleant], startDate: iso(-J / 24), endDate: iso(10 * J) });
  if (r.status !== 201) throw new Error('suppléance ' + JSON.stringify(r.body));
  return r.body.id;
}
const cles = (o) => JSON.stringify(o).includes('fileKey') || JSON.stringify(o).includes('FileKey');

(async () => {
  const a1 = ids.agent1;
  console.log('— Mise en place : niveau 2 d’agent1 (par lui-même) et fiche de poste (par le DRH)');
  expect('agent1 renseigne son niveau 2', await call('agent1', 'PATCH', `/personnel-files/${a1}/sensitive`, { personalPhone: TEL, personalAddress: ADR, emergencyContactName: `Proche ${S}` }), 200);
  expect('agent1 ajoute un diplôme avec justificatif', await envoyer('agent1', `/personnel-files/${a1}/diplomas`, { title: DIP, obtainedYear: 2015 }, 'diplome.pdf', `DIPLOME ${S}`), 201);
  expect('le DRH ajoute une pièce administrative', await envoyer('drh', `/personnel-files/${a1}/documents`, { label: PIECE }, 'piece.pdf', `PIECE ${S}`), 201);
  expect('le DRH fixe le grade', await call('drh', 'PATCH', `/personnel-files/${a1}/basic`, { grade: `A${S}`, employmentStatus: 'FONCTIONNAIRE' }), 200);
  expect('le DRH dépose la fiche de poste', await envoyer('drh', `/personnel-files/${a1}/job-description`, {}, 'fiche.pdf', `FICHE ${S}`), 201);
  const diplome = await prisma.personnelDiploma.findFirst({ where: { userId: a1, title: DIP } });
  const piece = await prisma.personnelDocument.findFirst({ where: { userId: a1, label: PIECE } });

  console.log('— Liste = dossiers acceptés (force brute sur tous les comptes)');
  const tous = await prisma.user.findMany({ where: { status: { not: 'EN_ATTENTE' } }, select: { id: true } });
  const sup = await suppleance('chefdpe', 'chefdee');
  const HI = { 'X-Interim-For': ids.chefdpe };
  const acteurs = [['dn'], ['dna'], ['chefdpe'], ['chefssr'], ['chefsaf'], ['chefdee'], ['agent1'], ['agentdee'], ['drh'], ['admin'], ['assdn'], ['asssaf'], ['chefdee', HI, 'chefdee en intérim de chefdpe']];
  for (const [key, h = {}, label = key] of acteurs) {
    const l = await call(key, 'GET', '/personnel-files', undefined, h);
    const listes = new Set(l.body.personnes.map((p) => p.id));
    const acceptes = new Set();
    for (const u of tous) if ((await call(key, 'GET', `/personnel-files/${u.id}`, undefined, h)).status === 200) acceptes.add(u.id);
    const egal = listes.size === acceptes.size && [...listes].every((i) => acceptes.has(i));
    check(`${label} : ${listes.size} listés = ${acceptes.size} lisibles`, egal);
    check(`${label} : import proposé seulement au DRH`, l.body.peutImporter === (key === 'drh'));
  }

  console.log('— Niveau 2 : jamais dans les réponses hors personne et DRH');
  const lecteurs = [['dn'], ['dna'], ['chefdpe'], ['chefssr'], ['chefdee', HI, 'chefdee en intérim de chefdpe']];
  for (const [key, h = {}, label = key] of lecteurs) {
    const r = await brut(key, `/personnel-files/${a1}`, h);
    const b = JSON.parse(r.text);
    check(`${label} lit le niveau 1 d’agent1`, r.status === 200 && b.basic.grade === `A${S}`, r.status);
    check(`${label} : niveau 2 vide (sensitive null, listes vides)`, b.sensitive === null && b.diplomas.length === 0 && b.documents.length === 0 && b.careerHistory.length === 0);
    check(`${label} : aucune valeur du niveau 2 dans la réponse brute`, ![TEL, ADR, DIP, PIECE, `Proche ${S}`].some((v) => r.text.includes(v)));
    check(`${label} : droits = lecture seule`, JSON.stringify(b.droits) === JSON.stringify({ modifier: false, niveau2: false, confirmer: false, signaler: false }), JSON.stringify(b.droits));
    check(`${label} : statuts du niveau 1 seulement`, Object.keys(b.statuts).sort().join() === 'echelon,employmentStatus,grade,jobDescription,serviceStartDate', Object.keys(b.statuts).join());
    const refus = [
      ['GET', `/personnel-files/${a1}/career-history`],
      ['GET', `/personnel-files/${a1}/diplomas/${diplome.id}/download`],
      ['GET', `/personnel-files/${a1}/documents/${piece.id}/download`],
      ['PATCH', `/personnel-files/${a1}/sensitive`, { personalPhone: '000' }],
      ['PATCH', `/personnel-files/${a1}/basic`, { grade: 'X' }],
      ['POST', `/personnel-files/${a1}/confirm`],
      ['POST', `/personnel-files/${a1}/report-error`, { fieldLabel: 'Grade', comment: 'Test' }],
    ];
    const statuts = [];
    for (const [m, p, body] of refus) statuts.push((await call(key, m, p, body, h)).status);
    check(`${label} : routes du niveau 2 et écritures → 403`, statuts.every((s) => s === 403), statuts.join(','));
    const fiche = await brut(key, `/personnel-files/${a1}/job-description`, h);
    check(`${label} : télécharge la fiche de poste (niveau 1)`, fiche.status === 200 && fiche.text === `FICHE ${S}`, fiche.status);
  }
  for (const key of ['agentdee', 'chefdee', 'chefsfp', 'admin', 'assdn', 'agent2']) {
    expect(`${key} (hors périmètre) lit le dossier d’agent1`, await call(key, 'GET', `/personnel-files/${a1}`), 403);
    const f = await brut(key, `/personnel-files/${a1}/job-description`);
    check(`${key} : fiche de poste → 403`, f.status === 403, f.status);
  }

  console.log('— La personne et le DRH');
  for (const key of ['agent1', 'drh']) {
    const r = await brut(key, `/personnel-files/${a1}`);
    const b = JSON.parse(r.text);
    check(`${key} : niveau 2 complet`, b.sensitive.personalPhone === TEL && b.diplomas.some((d) => d.title === DIP) && b.documents.some((d) => d.label === PIECE && d.uploadedBy.lastName) && b.careerHistory.length > 0);
    check(`${key} : aucune clé de stockage exposée`, !cles(b));
    check(`${key} : droits`, b.droits.modifier && b.droits.niveau2 && b.droits.signaler === (key === 'agent1') && b.droits.confirmer === (key === 'agent1'), JSON.stringify(b.droits));
    check(`${key} : historique de carrière (promotion) avec auteur`, b.careerHistory.some((e) => e.eventType === 'PROMOTION' && e.toValue === `A${S}` && e.recordedBy.lastName));
    const d = await brut(key, `/personnel-files/${a1}/diplomas/${diplome.id}/download`);
    check(`${key} : télécharge le justificatif de diplôme`, d.status === 200 && d.text === `DIPLOME ${S}`, d.status);
  }
  const avant = JSON.parse((await brut('agent1', `/personnel-files/${a1}`)).text);
  check('statuts avant confirmation : grade, statut, fiche, téléphone « à vérifier »', ['grade', 'employmentStatus', 'jobDescription', 'personalPhone', 'emergencyContact'].every((k) => avant.statuts[k] === 'A_VERIFIER') && avant.statuts.serviceStartDate === 'NON_RENSEIGNE' && avant.statuts.personalEmail === 'NON_RENSEIGNE', JSON.stringify(avant.statuts));
  expect('le DRH confirme à la place de la personne', await call('drh', 'POST', `/personnel-files/${a1}/confirm`), 403);
  expect('agent1 confirme ses informations', await call('agent1', 'POST', `/personnel-files/${a1}/confirm`), 201);
  const apres = JSON.parse((await brut('agent1', `/personnel-files/${a1}`)).text);
  check('après confirmation : champs renseignés « confirmés », vides « non renseignés »', ['grade', 'employmentStatus', 'jobDescription', 'personalPhone', 'emergencyContact'].every((k) => apres.statuts[k] === 'CONFIRME') && apres.statuts.serviceStartDate === 'NON_RENSEIGNE', JSON.stringify(apres.statuts));
  check('après confirmation : plus rien à confirmer', apres.droits.confirmer === false && apres.diplomas.every((d) => d.verified));
  expect('le DRH modifie l’échelon', await call('drh', 'PATCH', `/personnel-files/${a1}/basic`, { echelon: 'E' + Date.now() }), 200);
  const re = JSON.parse((await brut('agent1', `/personnel-files/${a1}`)).text);
  check('modification par le DRH : l’échelon repasse « à vérifier », le bouton revient', re.statuts.echelon === 'A_VERIFIER' && re.statuts.grade === 'CONFIRME' && re.droits.confirmer === true);
  const nAvant = await prisma.notification.count({ where: { userId: ids.drh, type: 'DOSSIER_ERREUR_SIGNALEE', channel: 'IN_APP' } });
  expect('agent1 signale une erreur', await call('agent1', 'POST', `/personnel-files/${a1}/report-error`, { fieldLabel: 'Échelon', comment: 'Je suis à l’échelon 5' }), 201);
  const notif = await prisma.notification.findFirst({ where: { userId: ids.drh, type: 'DOSSIER_ERREUR_SIGNALEE', channel: 'IN_APP' }, orderBy: { createdAt: 'desc' } });
  check('le DRH est notifié, lien vers /personnel/<id>', (await prisma.notification.count({ where: { userId: ids.drh, type: 'DOSSIER_ERREUR_SIGNALEE', channel: 'IN_APP' } })) === nAvant + 1 && notif.link === `/personnel/${a1}`, notif && notif.link);
  expect('fiche de poste absente', await call('agentdee', 'GET', `/personnel-files/${ids.agentdee}/job-description`), 404);
  expect('dossier inconnu', await call('drh', 'GET', '/personnel-files/inconnu'), 404);

  await call('chefdpe', 'POST', `/suppleances/${sup}/revoke`);
  process.exitCode = bilan() ? 1 : 0;
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
