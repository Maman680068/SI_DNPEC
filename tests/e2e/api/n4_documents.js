// N4 — statut de diffusion, service d'export unique, métadonnées et liens de la GED, documents générés :
// métadonnées obligatoires (400), lien vers une tâche ou une réunion (visible du déposant, titre caché
// à qui ne la voit pas), statut Brouillon → Validé → Diffusable (droits, 403/409, retrait motivé,
// nouvelle version = Brouillon, journal), mention du statut sur le PDF et le Word téléchargés,
// attestation de travail et ordre de mission (projet, acte, signature, original puis duplicata),
// rapport d'activité (périmètres, tâches visibles seulement), montant en toutes lettres, dépôt en GED,
// transmission par la messagerie.
const zlib = require('zlib');
const PizZip = require('pizzip');
const E = require('../config');
const { call, login, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const PDFKit = require('pdfkit');
const API = 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
/** Texte d'un PDF : flux décompressés, chaînes hexadécimales (PDFKit, pdf-lib) remises bout à bout. */
function textePdf(buf) {
  const l = buf.toString('latin1'); let flux = ''; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(l))) { const fin = l.indexOf('endstream', m.index); try { flux += zlib.inflateSync(Buffer.from(l.slice(m.index + m[0].length, fin), 'latin1')).toString('latin1'); } catch { flux += l.slice(m.index, fin); } }
  return [...flux.matchAll(/<([0-9A-Fa-f]{2,})>/g)].map((x) => Buffer.from(x[1], 'hex').toString('latin1')).join('');
}
const pdfContient = (buf, t) => textePdf(buf).toUpperCase().includes(t.toUpperCase());
const texteDocx = (buf) => new PizZip(buf).file('word/document.xml').asText().replace(/<[^>]+>/g, '');
const pdfMinimal = () => new Promise((res) => { const d = new PDFKit(); const c = []; d.on('data', (x) => c.push(x)); d.on('end', () => res(Buffer.concat(c))); d.text(`Rapport ${S}`); d.end(); });

async function televerser(k, path, champs, nom, contenu, type = 'text/plain') {
  const fd = new FormData();
  for (const [c, v] of Object.entries(champs)) fd.append(c, v);
  fd.append('file', new Blob([contenu], { type }), nom);
  const r = await fetch(API + path, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(k)) }, body: fd });
  const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
}
async function binaire(k, method, path, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + (await login(k)), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type'), statut: r.headers.get('x-statut-diffusion'), edition: r.headers.get('x-edition'), nom: decodeURIComponent((r.headers.get('content-disposition') || '').replace(/.*filename="([^"]+)".*/, '$1')) };
}
const META = { typeDocument: 'RAPPORT', periodeDebut: '2026-07-01', periodeFin: '2026-09-30' };

async function signerActe(acteId, soumettant) {
  expect('soumission de l’acte (circuit du module Courrier)', await call(soumettant, 'POST', `/courrier/actes/${acteId}/soumettre`), 201);
  let a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a.statut === 'EN_VISA' && i < 4; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'signe.pdf');
  const r = await fetch(`${API}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
  check('le DN signe l’acte (numéro attribué)', r.status === 201, r.status);
}

(async () => {
  console.log('— GED : métadonnées obligatoires');
  const base = { title: `Note ${S}`, divisionId: ids.DPE };
  expect('sans type', await televerser('agent1', '/documents', { ...base, periodeDebut: '2026-07-01', periodeFin: '2026-09-30' }, 'a.txt', 'a'), 400);
  expect('sans période couverte', await televerser('agent1', '/documents', { ...base, typeDocument: 'RAPPORT' }, 'a.txt', 'a'), 400);
  expect('période inversée', await televerser('agent1', '/documents', { ...base, typeDocument: 'RAPPORT', periodeDebut: '2026-09-30', periodeFin: '2026-07-01' }, 'a.txt', 'a'), 400);
  expect('type inconnu', await televerser('agent1', '/documents', { ...base, ...META, typeDocument: 'ROMAN' }, 'a.txt', 'a'), 400);

  console.log('— GED : lien vers la tâche ou la réunion d’origine');
  const t = (await call('chefssr', 'POST', '/tasks', { title: `Tâche N4 ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }] })).body;
  const reu = (await call('chefdpe', 'POST', '/meetings', { title: `Réunion N4 ${S}`, startAt: new Date(Date.now() - 864e5).toISOString(), participantIds: [ids.agent1] })).body;
  const reuPrivee = (await call('chefdee', 'POST', '/meetings', { title: `Réunion DEE ${S}`, startAt: new Date(Date.now() - 864e5).toISOString(), participantIds: [] })).body;
  expect('lien vers une réunion invisible du déposant', await televerser('agent1', '/documents', { ...base, ...META, sourceMeetingId: reuPrivee.id }, 'a.txt', 'a'), 404);
  expect('tâche et réunion à la fois', await televerser('agent1', '/documents', { ...base, ...META, sourceTaskId: t.id, sourceMeetingId: reu.id }, 'a.txt', 'a'), 400);
  const dt = await televerser('agent1', '/documents', { ...base, title: `Issu de la tâche ${S}`, ...META, sourceTaskId: t.id }, 'tache.txt', 'contenu');
  check('dépôt depuis une tâche : lien et titre de la tâche', dt.status === 201 && dt.body.source?.type === 'TACHE' && dt.body.source.titre === `Tâche N4 ${S}`, JSON.stringify(dt.body.source));
  const dr = await televerser('agent1', '/documents', { ...base, title: `PV ${S}`, typeDocument: 'PROCES_VERBAL', periodeDebut: '2026-09-29', periodeFin: '2026-09-29', sourceMeetingId: reu.id }, 'pv.txt', 'pv');
  check('dépôt depuis une réunion : type procès-verbal, lien', dr.status === 201 && dr.body.source?.type === 'REUNION' && dr.body.typeDocument === 'PROCES_VERBAL');
  const vueAutre = (await call('agent2', 'GET', `/documents/${dr.body.id}`)).body;
  check('membre de la division qui ne voit pas la réunion : lien sans titre', vueAutre.source?.type === 'REUNION' && vueAutre.source.titre === null, JSON.stringify(vueAutre.source));
  const liste = (await call('agent1', 'GET', `/documents?sourceMeetingId=${reu.id}`)).body;
  check('filtre par réunion d’origine', liste.length === 1 && liste[0].id === dr.body.id);
  check('filtre par type', (await call('agent1', 'GET', '/documents?typeDocument=PROCES_VERBAL')).body.every((d) => d.typeDocument === 'PROCES_VERBAL'));

  console.log('— Statut de diffusion (Brouillon → Validé → Diffusable)');
  const pdf = await pdfMinimal();
  const d = (await televerser('agent1', '/documents', { ...base, title: `Rapport ${S}`, ...META }, 'rapport.pdf', pdf, 'application/pdf')).body;
  check('nouveau document : Brouillon, droits de l’agent (ni valider ni diffuser)', d.statutDiffusion === 'BROUILLON' && d.droits.modifier && !d.droits.valider && !d.droits.rendreDiffusable);
  const dc = (await call('chefdpe', 'GET', `/documents/${d.id}`)).body;
  check('chef de la division : valider proposé', dc.droits.valider === true);
  expect('l’agent valide', await call('agent1', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 403);
  const nonFinal = await call('chefdpe', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' });
  check('validation d’un document non « Final » → 409', nonFinal.status === 409 && /Final/.test(nonFinal.body.message), nonFinal.body.message);
  expect('passage direct à Diffusable', await call('chefdpe', 'POST', `/documents/${d.id}/statut`, { vers: 'DIFFUSABLE' }), 409);
  await call('agent1', 'POST', `/documents/${d.id}/mark-final`);
  expect('le chef d’une autre division valide', await call('chefdee', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 403);
  const v = await call('chefdpe', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' });
  check('le chef de division valide → Validé', v.status === 201 && v.body.statutDiffusion === 'VALIDE', v.status);
  expect('validation rejouée', await call('chefdpe', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 409);
  expect('le chef de division rend diffusable', await call('chefdpe', 'POST', `/documents/${d.id}/statut`, { vers: 'DIFFUSABLE' }), 403);
  expect('le DN ne voit pas un document privé d’une division (besoin d’en connaître)', await call('dn', 'POST', `/documents/${d.id}/statut`, { vers: 'DIFFUSABLE' }), 403);
  await call('chefdpe', 'POST', `/documents/${d.id}/publish`);
  const df = await call('dn', 'POST', `/documents/${d.id}/statut`, { vers: 'DIFFUSABLE' });
  check('publié : le DN le rend diffusable', df.status === 201 && df.body.statutDiffusion === 'DIFFUSABLE');
  const dl1 = await binaire('agent2', 'GET', `/documents/${d.id}/versions/${d.currentVersion.id}/download`);
  check('téléchargement PDF : mention « DIFFUSABLE » en tête de page, en-tête X-Statut-Diffusion', dl1.status === 200 && dl1.statut === 'DIFFUSABLE' && pdfContient(dl1.buf, 'DIFFUSABLE'));
  expect('retrait sans motif', await call('dn', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE' }), 400);
  const r = await call('dn', 'POST', `/documents/${d.id}/statut`, { vers: 'VALIDE', motif: 'Chiffres à revoir' });
  check('retrait motivé → Validé, le document reste consultable', r.status === 201 && r.body.statutDiffusion === 'VALIDE' && (await call('agentdee', 'GET', `/documents/${d.id}`)).status === 200);
  const dl2 = await binaire('agent1', 'GET', `/documents/${d.id}/versions/${d.currentVersion.id}/download`);
  check('… PDF téléchargé : mention « VALIDÉ »', dl2.statut === 'VALIDE' && pdfContient(dl2.buf, 'VALID'));
  const nv = await televerser('agent1', `/documents/${d.id}/versions`, {}, 'rapport-v2.pdf', pdf, 'application/pdf');
  check('nouvelle version : retour à Brouillon', nv.status === 201 && nv.body.statutDiffusion === 'BROUILLON');
  const h = (await call('agent1', 'GET', `/documents/${d.id}/statut`)).body;
  check('journal du statut : 4 changements, motifs et auteurs', h.length === 4 && h[0].vers === 'BROUILLON' && /Nouvelle version/.test(h[0].motif) && h.some((x) => x.motif === 'Chiffres à revoir') && h.every((x) => x.par));
  const dl3 = await binaire('agent1', 'GET', `/documents/${d.id}/versions/${nv.body.currentVersion.id}/download`);
  check('… PDF téléchargé : mention « BROUILLON »', dl3.statut === 'BROUILLON' && pdfContient(dl3.buf, 'BROUILLON'));
  const txt = await binaire('agent1', 'GET', `/documents/${dt.body.id}/versions/${dt.body.currentVersion.id}/download`);
  check('autre format : statut dans le nom du fichier', txt.status === 200 && /\(BROUILLON\)\.txt$/.test(txt.nom), txt.nom);
  check('audit : changements de statut tracés', (await prisma.auditLog.count({ where: { entityId: d.id, metadata: { path: ['event'], equals: 'statut_diffusion' } } })) === 3);

  console.log('— Documents générés : catalogue et droits');
  const cDrh = (await call('drh', 'GET', '/api/v1/documents-generes/catalogue')).body;
  const cAgent = (await call('agent1', 'GET', '/api/v1/documents-generes/catalogue')).body;
  const cChef = (await call('chefssr', 'GET', '/api/v1/documents-generes/catalogue')).body;
  check('DRH : attestation de travail ; agent : ni attestation ni ordre de mission ; rapport sur soi', cDrh.attestationTravail.peutCreer && !cAgent.attestationTravail.peutCreer && !cAgent.ordreMission.peutCreer && cAgent.rapportActivite.perimetres.length === 1);
  check('chef de section : ordre de mission pour ses agents, rapport de sa section', cChef.ordreMission.agents.some((a) => a.id === ids.agent1) && cChef.rapportActivite.perimetres.some((p) => p.perimetre === 'SECTION' && p.cibleId === ids.SSR));

  console.log('— Attestation de travail');
  expect('un chef crée une attestation de travail', await call('chefssr', 'POST', '/api/v1/attestations-travail', { agentId: ids.agent1 }), 403);
  const att = await call('drh', 'POST', '/api/v1/attestations-travail', { agentId: ids.agent1 });
  expect('le DRH crée l’attestation de travail d’agent1', att, 201);
  const A = { type: 'ATTESTATION_TRAVAIL', attestationId: att.body.id };
  const ap = await binaire('drh', 'POST', '/api/v1/documents-generes/apercu', A);
  check('aperçu PDF : en-tête de la République, titre, « PROJET — non signé »', ap.status === 200 && ap.type === 'application/pdf' && pdfContient(ap.buf, 'RÉPUBLIQUE DE GUINÉE') && pdfContient(ap.buf, 'ATTESTATION DE TRAVAIL') && pdfContient(ap.buf, 'PROJET'));
  const w = await binaire('drh', 'POST', '/api/v1/documents-generes/telecharger', { ...A, format: 'DOCX' });
  const tw = w.status === 200 ? texteDocx(w.buf) : '';
  check('Word : même contenu (en-tête, titre, projet)', /RÉPUBLIQUE DE GUINÉE/.test(tw) && /ATTESTATION DE TRAVAIL/.test(tw) && /PROJET/.test(tw) && /AGENT1/i.test(tw));
  const vueAg = (await call('agent1', 'GET', '/api/v1/attestations-travail')).body.find((x) => x.id === att.body.id);
  check('agent1 voit son attestation, sans la produire avant signature', vueAg && !vueAg.droits.produire);
  expect('… aperçu refusé à agent1 avant signature', await call('agent1', 'POST', '/api/v1/documents-generes/apercu', A), 403);
  expect('un autre agent ne voit pas l’attestation', await call('agent2', 'POST', '/api/v1/documents-generes/apercu', A), 403);
  const reg = (await call('admin', 'POST', '/courrier/registres', { code: `AW${L}`, libelle: `Attestations de travail ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'ATW/{seq}/{annee}' })).body;
  const acteA = await call('drh', 'POST', `/api/v1/attestations-travail/${att.body.id}/acte`, { registreId: reg.id });
  expect('le DRH prépare l’acte (registre d’actes de la Direction)', acteA, 201);
  expect('seconde préparation', await call('drh', 'POST', `/api/v1/attestations-travail/${att.body.id}/acte`, { registreId: reg.id }), 409);
  const acte = await prisma.acteCourrier.findUnique({ where: { id: acteA.body.acteId }, include: { pieces: true } });
  check('acte : bénéficiaire agent1, prise de connaissance, projet PDF joint', acte.beneficiaireId === ids.agent1 && acte.priseConnaissanceRequise && acte.pieces.some((p) => p.fileName.endsWith('.pdf')));
  await signerActe(acteA.body.acteId, 'drh');
  const signe = await prisma.acteCourrier.findUnique({ where: { id: acteA.body.acteId } });
  const o1 = await binaire('agent1', 'POST', '/api/v1/documents-generes/telecharger', A);
  check('après signature, agent1 télécharge : numéro, signataire, plus de « PROJET », édition 1 (original)', o1.status === 200 && o1.edition === '1' && pdfContient(o1.buf, signe.numero) && !pdfContient(o1.buf, 'PROJET') && !pdfContient(o1.buf, 'DUPLICATA'));
  const apDup = await binaire('drh', 'POST', '/api/v1/documents-generes/apercu', A);
  check('aperçu suivant : annonce « DUPLICATA », sans enregistrer d’édition', pdfContient(apDup.buf, 'DUPLICATA') && (await prisma.documentGenere.count({ where: { objetId: att.body.id } })) === 1);
  const o2 = await binaire('drh', 'POST', '/api/v1/documents-generes/telecharger', A);
  check('deuxième édition : « DUPLICATA », édition 2, journalisée avec son auteur', o2.edition === '2' && pdfContient(o2.buf, 'DUPLICATA') && /duplicata/.test(o2.nom) && (await prisma.documentGenere.findFirst({ where: { objetId: att.body.id, edition: 2 } })).parId === ids.drh);
  check('… duplicata tracé au journal d’audit', (await prisma.auditLog.count({ where: { entityId: att.body.id, metadata: { path: ['event'], equals: 'duplicata' } } })) === 1);

  console.log('— Ordre de mission et montant en toutes lettres');
  const OM = { agentId: ids.agent1, objet: `Collecte régionale ${S}`, destination: 'Kankan', dateDepart: '2026-11-02', dateRetour: '2026-11-06', transport: 'Véhicule de service', fraisMontant: 580000 };
  expect('un agent établit un ordre de mission', await call('agent2', 'POST', '/api/v1/ordres-mission', OM), 403);
  expect('le chef d’une autre division', await call('chefdee', 'POST', '/api/v1/ordres-mission', OM), 403);
  expect('dates inversées', await call('chefssr', 'POST', '/api/v1/ordres-mission', { ...OM, dateRetour: '2026-11-01' }), 400);
  const om = await call('chefssr', 'POST', '/api/v1/ordres-mission', OM);
  check('le chef de section établit l’ordre ; frais en toutes lettres', om.status === 201 && om.body.fraisEnLettres === 'cinq cent quatre-vingts mille (580 000) francs guinéens', om.body.fraisEnLettres);
  check('visible de l’agent et du chef de division, pas d’un autre agent', (await call('agent1', 'GET', '/api/v1/ordres-mission')).body.some((x) => x.id === om.body.id) && (await call('chefdpe', 'GET', '/api/v1/ordres-mission')).body.some((x) => x.id === om.body.id) && !(await call('agent2', 'GET', '/api/v1/ordres-mission')).body.some((x) => x.id === om.body.id));
  const omPdf = await binaire('agent1', 'POST', '/api/v1/documents-generes/apercu', { type: 'ORDRE_MISSION', ordreMissionId: om.body.id });
  check('aperçu : destination, frais en lettres, projet', omPdf.status === 200 && pdfContient(omPdf.buf, 'KANKAN') && pdfContient(omPdf.buf, 'CINQ CENT QUATRE-VINGTS MILLE') && pdfContient(omPdf.buf, 'PROJET'));
  expect('l’agent ne prépare pas l’acte de son ordre', await call('agent1', 'POST', `/api/v1/ordres-mission/${om.body.id}/acte`, { registreId: reg.id }), 403);
  expect('l’auteur prépare l’acte', await call('chefssr', 'POST', `/api/v1/ordres-mission/${om.body.id}/acte`, { registreId: reg.id }), 201);

  console.log('— Rapport d’activité');
  const t2 = (await call('chefssr', 'POST', '/tasks', { title: `Tâche du rapport ${S}`, priority: 'NORMAL', divisionId: ids.DPE, sectionId: ids.SSR, assignees: [{ userId: ids.agent1 }], confidentiality: 'PUBLIC_INTERNE' })).body;
  await call('agent1', 'POST', `/tasks/${t2.id}/start`);
  const auj = new Date().toISOString().slice(0, 10);
  const RA = { type: 'RAPPORT_ACTIVITE', perimetre: 'AGENT', cibleId: ids.agent1, debut: '2026-01-01', fin: auj };
  const ra = await binaire('agent1', 'POST', '/api/v1/documents-generes/apercu', RA);
  check('agent1 : son rapport, tâches de la période, mention « BROUILLON »', ra.status === 200 && pdfContient(ra.buf, 'RAPPORT D') && pdfContient(ra.buf, S) && pdfContient(ra.buf, 'BROUILLON'));
  expect('agent1 : rapport d’agent2', await call('agent1', 'POST', '/api/v1/documents-generes/apercu', { ...RA, cibleId: ids.agent2 }), 403);
  expect('agent1 : rapport de la Direction', await call('agent1', 'POST', '/api/v1/documents-generes/apercu', { ...RA, perimetre: 'DIRECTION' }), 403);
  expect('chef de section : rapport de sa section', await call('chefssr', 'POST', '/api/v1/documents-generes/apercu', { ...RA, perimetre: 'SECTION', cibleId: ids.SSR }), 200);
  expect('chef de section : rapport de la division', await call('chefssr', 'POST', '/api/v1/documents-generes/apercu', { ...RA, perimetre: 'DIVISION', cibleId: ids.DPE }), 403);
  expect('sans période', await call('agent1', 'POST', '/api/v1/documents-generes/apercu', { type: 'RAPPORT_ACTIVITE' }), 400);
  const raw = await binaire('dn', 'POST', '/api/v1/documents-generes/telecharger', { ...RA, perimetre: 'DIRECTION', format: 'DOCX' });
  check('DN : rapport de la Direction en Word, avec le bandeau de statut', raw.status === 200 && /BROUILLON/.test(texteDocx(raw.buf)) && /Direction \(DNPEC\)/.test(texteDocx(raw.buf)));

  console.log('— Dépôt en GED et transmission');
  const ged = await call('agent1', 'POST', '/api/v1/documents-generes/ged', RA);
  const gd = ged.status === 201 ? (await call('agent1', 'GET', `/documents/${ged.body.documentId}`)).body : {};
  check('rapport déposé en GED : type Rapport, période du rapport, Brouillon, division d’agent1', ged.status === 201 && gd.typeDocument === 'RAPPORT' && gd.periodeDebut?.startsWith('2026-01-01') && gd.statutDiffusion === 'BROUILLON' && gd.divisionId === ids.DPE);
  expect('le DRH (sans division) ne dépose pas en GED', await call('drh', 'POST', '/api/v1/documents-generes/ged', A), 409);
  const avant = await prisma.directMessage.count({ where: { recipientId: ids.agent1, attachmentKey: { not: null } } });
  expect('le DRH transmet l’attestation à agent1', await call('drh', 'POST', '/api/v1/documents-generes/transmettre', { ...A, destinataireId: ids.agent1, message: 'Votre attestation' }), 201);
  const msg = await prisma.directMessage.findFirst({ where: { recipientId: ids.agent1, attachmentKey: { not: null } }, orderBy: { createdAt: 'desc' } });
  check('message reçu avec le PDF en pièce jointe (3e édition = duplicata)', (await prisma.directMessage.count({ where: { recipientId: ids.agent1, attachmentKey: { not: null } } })) === avant + 1 && /duplicata\.pdf$/.test(msg.attachmentName));

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
