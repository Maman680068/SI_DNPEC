// S9e — réglages des stages : capacités de toutes les unités avec l'occupation du jour et « complet »
// (comptages, sans nom), contrôle d'un modèle d'attestation AVANT activation (rien n'est enregistré), aperçu
// du modèle actif avec un stagiaire fictif (sans numéro réel, sans séquence consommée), historique des
// modèles remplacés. Droits inchangés : DRH et administrateur ; tout autre profil 403.
const fs = require('fs');
const { execSync } = require('child_process');
const E = require('../config');
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const BASE = process.env.BASE || 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const TMP = `${E.OUT || '/tmp'}/s9e-${S}`;
const docx = (nom, texte) => { execSync(`python3 -c "import docx; d=docx.Document(); d.add_paragraph('${texte}'); d.save('${TMP}/${nom}')"`); return fs.readFileSync(`${TMP}/${nom}`); };
async function envoyer(key, path, nom, contenu) {
  const fd = new FormData();
  fd.append('file', new Blob([contenu]), nom);
  const r = await fetch(BASE + path, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(key)) }, body: fd });
  return { status: r.status, body: await r.json() };
}
async function lire(key, path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + (await login(key)) } });
  return { status: r.status, type: r.headers.get('content-type'), buffer: Buffer.from(await r.arrayBuffer()) };
}
const jour = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  console.log('— Capacités : toutes les unités, occupation du jour');
  for (const k of ['agent1', 'chefdpe', 'dn']) {
    const r = await call(k, 'GET', '/stages/capacites');
    if (k === 'dn') check('DN : lecture (droits inchangés), sans modification', r.status === 200 && r.body.peutModifier === false);
    else expect(`${k} : refusé`, r, 403);
  }
  const c = (await call('drh', 'GET', '/stages/capacites')).body;
  const [nd, ns, nc] = await Promise.all([prisma.division.count(), prisma.section.count(), prisma.cellule.count()]);
  check(`toutes les unités : ${nd} divisions, ${ns} sections, ${nc} cellules`, c.unites.length === nd + ns + nc);
  const aujourdhui = jour();
  const occ = await prisma.periodeStage.findMany({ where: { statut: { in: ['PROPOSEE', 'ACCEPTEE', 'EN_COURS', 'TERMINEE'] }, dateDebut: { lte: aujourdhui }, dateFin: { gte: aujourdhui } }, select: { divisionId: true, sectionId: true, celluleId: true } });
  const attendu = (u) => occ.filter((p) => (u.uniteKey.startsWith('DIV:') ? p.divisionId : u.uniteKey.startsWith('SEC:') ? p.sectionId : p.celluleId) === u.uniteKey.slice(4)).length;
  check('occupation du jour = périodes qui occupent une place aujourd’hui (une division compte ses sections)', c.unites.every((u) => u.occupation === attendu(u)));
  const ssr = c.unites.find((u) => u.uniteKey === `SEC:${ids.SSR}`);
  check('section : sigle « DPE · SSR »', ssr && ssr.sigle === 'DPE · SSR' && ssr.niveau === 'SECTION');
  check('aucun nom de stagiaire dans les capacités', !/firstName|lastName|stagiaire/.test(JSON.stringify(c.unites)));
  const cible = c.unites.find((u) => u.uniteKey.startsWith('CEL:'));
  expect('limite 0 sur une cellule', await call('drh', 'PUT', '/stages/capacites', { uniteKey: cible.uniteKey, maximum: Math.max(0, cible.occupation) }), 200);
  const c2 = (await call('admin', 'GET', '/stages/capacites')).body;
  const l2 = c2.unites.find((u) => u.uniteKey === cible.uniteKey);
  check('« complet » quand l’occupation atteint la limite (administrateur : même lecture)', l2.complet === true && l2.maximum === Math.max(0, cible.occupation));
  expect('« Sans limite »', await call('drh', 'PUT', '/stages/capacites', { uniteKey: cible.uniteKey, maximum: null }), 200);
  check('sans limite : plus « complet »', (await call('drh', 'GET', '/stages/capacites')).body.unites.find((u) => u.uniteKey === cible.uniteKey).complet === false);

  console.log('— Contrôle avant activation (rien n’est enregistré)');
  const avant = await prisma.modeleAttestation.count();
  const mauvais = docx('mauvais.docx', 'Attestation {{NOM_COMPLET}} {{SERVICE}}');
  for (const k of ['agent1', 'dn']) expect(`${k} : contrôle refusé`, await envoyer(k, '/stages/modele-attestation/verifier', 'mauvais.docx', mauvais), 403);
  const v1 = await envoyer('drh', '/stages/modele-attestation/verifier', 'mauvais.docx', mauvais);
  check('champ inconnu : refusé, signalé', v1.status === 200 && v1.body.valide === false && v1.body.inconnus.join() === 'SERVICE' && /SERVICE/.test(v1.body.message), JSON.stringify(v1.body));
  const bon = docx('bon.docx', 'Attestation N° {{NUMERO}} : {{NOM_COMPLET}}, {{ETABLISSEMENT}}, du {{DATE_DEBUT}} au {{DATE_FIN}}.');
  const v2 = await envoyer('drh', '/stages/modele-attestation/verifier', 'bon.docx', bon);
  check('modèle valide : champs reconnus et non utilisés', v2.body.valide === true && v2.body.champs.length === 5 && v2.body.absents.includes('TUTEURS'), JSON.stringify(v2.body));
  const v3 = await envoyer('admin', '/stages/modele-attestation/verifier', 'texte.txt', Buffer.from('x'));
  check('format refusé : message', v3.body.valide === false && /Word/.test(v3.body.message));
  check('le contrôle n’enregistre rien', (await prisma.modeleAttestation.count()) === avant);

  console.log('— Activation et historique');
  const ancien = await prisma.modeleAttestation.findFirst({ where: { actif: true } });
  const imp = await envoyer('drh', '/stages/modele-attestation', `bon-${S}.docx`, bon);
  check('modèle activé', imp.status === 201 && imp.body.modele.fileName === `bon-${S}.docx`, imp.status);
  const m = (await call('drh', 'GET', '/stages/modele-attestation')).body;
  check('l’ancien modèle est conservé dans l’historique', !ancien || m.historique.some((h) => h.id === ancien.id));

  console.log('— Aperçu avec un stagiaire fictif');
  expect('agent : aperçu refusé', await call('agent1', 'GET', '/stages/modele-attestation/apercu'), 403);
  const compteurs = await prisma.compteurRegistre.aggregate({ _sum: { dernier: true } });
  const actes = await prisma.acteCourrier.count();
  const a = await lire('drh', '/stages/modele-attestation/apercu');
  fs.writeFileSync(`${TMP}/apercu.docx`, a.buffer);
  const xml = execSync(`unzip -p ${TMP}/apercu.docx word/document.xml`).toString();
  check('aperçu Word rempli : stagiaire fictif, « APERÇU — SANS NUMÉRO »', a.status === 200 && /Aminata EXEMPLE/.test(xml) && /APERÇU — SANS NUMÉRO/.test(xml));
  check('aucune séquence consommée, aucun acte créé', (await prisma.compteurRegistre.aggregate({ _sum: { dernier: true } }))._sum.dernier === compteurs._sum.dernier && (await prisma.acteCourrier.count()) === actes);
  const ad = await lire('admin', '/stages/modele-attestation/apercu');
  check('administrateur : aperçu permis (réglages)', ad.status === 200 && ad.buffer.length > 100);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
