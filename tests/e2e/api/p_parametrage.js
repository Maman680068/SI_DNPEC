// Paramétrage initial (apps/api/prisma/parametrage.ts) : création seule, idempotence,
// modifications faites à l'écran conservées, élément supprimé jamais recréé, aucune
// dépendance au compte créateur, réglages des stages par le DRH ET l'administrateur,
// refus si migrations non à jour, attestation avec le modèle par défaut.
const E = require('../config');
const { call, ids, check, expect, bilan, login } = require('../lib');
const { execSync } = require('child_process');
const zlib = require('zlib');
const PizZip = require('pizzip');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = E.API_DIR;
const parametrer = () => {
  try { return { code: 0, out: execSync('pnpm run -s db:parametrage', { cwd: API, env: process.env, encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; }
};
const photo = async () => JSON.stringify({
  registres: await prisma.registreCourrier.findMany({ orderBy: { code: 'asc' } }),
  categories: await prisma.categorieLogistique.findMany({ orderBy: { code: 'asc' } }),
  capacites: await prisma.capaciteAccueil.findMany({ orderBy: { uniteKey: 'asc' } }),
  modeles: await prisma.modeleAttestation.findMany({ orderBy: { createdAt: 'asc' } }),
  ressources: await prisma.ressourceReservable.findMany({ orderBy: { id: 'asc' } }),
  articles: await prisma.articleFourniture.findMany({ orderBy: { id: 'asc' } }),
  compteurs: await prisma.compteurRegistre.count(),
  audit: await prisma.auditLog.count({ where: { entityType: 'Parametrage' } }),
});
const S = Date.now().toString(36).slice(-5);

(async () => {
  console.log('— Refus si les migrations ne sont pas à jour');
  const derniere = (await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 1`)[0].migration_name;
  await prisma.$executeRaw`UPDATE _prisma_migrations SET finished_at = NULL WHERE migration_name = ${derniere}`;
  const refus = parametrer();
  await prisma.$executeRaw`UPDATE _prisma_migrations SET finished_at = now() WHERE migration_name = ${derniere}`;
  check('migration non terminée : refus, code 1, rien créé', refus.code === 1 && /Migrations non à jour/.test(refus.out) && (await prisma.registreCourrier.count()) === 0, refus.out.split('\n').filter((l) => /ÉCHEC/.test(l))[0]);

  console.log('— Premier passage');
  const p1 = parametrer();
  console.log(p1.out.split('\n').filter((l) => /^\s+[+=]|Bilan|Migrations/.test(l)).join('\n'));
  const nbUnites = (await prisma.division.count({ where: { isActive: true } })) + (await prisma.cellule.count({ where: { isActive: true } }));
  const attendu = 6 + 4 + nbUnites + 1 + 2 + 4 + 5;
  check(`premier passage : ${attendu} éléments créés`, p1.code === 0 && p1.out.includes(`Bilan : ${attendu} créé(s), 0 déjà présent(s).`));
  const regs = await prisma.registreCourrier.findMany();
  check('6 registres de portée Direction, gabarit {seq:4}/MEFB/DNPEC/{code}/{annee}', regs.length === 6 && regs.every((r) => r.portee === 'DIRECTION' && r.gabaritNumero === '{seq:4}/MEFB/DNPEC/{code}/{annee}'));
  check('natures : ARR arrivée, DEP départ, NS/DEC/OM/ATT actes', ['NS', 'DEC', 'OM', 'ATT'].every((c) => regs.find((r) => r.code === c).nature === 'ACTE') && regs.find((r) => r.code === 'ARR').nature === 'ARRIVEE' && regs.find((r) => r.code === 'DEP').nature === 'DEPART');
  check('compteurs non initialisés (reprise papier possible)', (await prisma.compteurRegistre.count()) === 0);
  const cats = await prisma.categorieLogistique.findMany();
  check('catégories : 3 avec validation du chef, Fournitures de bureau sans', cats.length === 4 && cats.filter((c) => c.validationChefRequise).length === 3 && cats.find((c) => c.libelle === 'Fournitures de bureau').validationChefRequise === false);
  const caps = await prisma.capaciteAccueil.findMany();
  check(`capacité 2 pour chaque division et cellule (${nbUnites}), sans auteur`, caps.length === nbUnites && caps.every((c) => c.maximum === 2 && c.fixeeParId === null));
  const mod = await prisma.modeleAttestation.findFirst();
  check('modèle par défaut : Word intégré, sans auteur, 14 champs', mod.type === 'DOCX' && mod.fileKey.startsWith('integre:') && mod.importeParId === null && mod.champs.length === 14);
  const res = await prisma.ressourceReservable.findMany({ orderBy: { nom: 'asc' } });
  check('ressources : salle (validation) et vidéoprojecteur (immédiat)', res.length === 2 && res.find((r) => r.nom === 'Salle de réunion principale').mode === 'VALIDATION' && res.find((r) => r.nom === 'Vidéoprojecteur 1').mode === 'IMMEDIATE');
  const arts = await prisma.articleFourniture.findMany();
  check('articles : 3 suivis (stock 0, seuil 5), chemises non suivies', arts.length === 4 && arts.filter((a) => a.suiviStock && a.stock === 0 && a.seuilAlerte === 5).length === 3 && arts.find((a) => a.libelle === 'Chemises cartonnées').suiviStock === false);
  const cibles = await prisma.parametre.findMany({ where: { cle: { startsWith: 'indicateurs.' } }, orderBy: { cle: 'asc' } });
  check('5 cibles des indicateurs de succès, valeur par défaut, sans auteur', cibles.length === 5 && cibles.every((c) => c.modifieParId === null) && cibles.find((c) => c.cle === 'indicateurs.cibleTachesPct')?.valeur === 75, JSON.stringify(cibles.map((c) => [c.cle, c.valeur])));
  check('aucun compte, aucune habilitation, aucun bien créé', (await prisma.bien.count()) === 0 && (await prisma.habilitationLogistique.count()) === 0 && (await prisma.habilitationCourrier.count()) === 0);
  check(`audit : ${attendu} créations par « Système » (aucun acteur)`, (await prisma.auditLog.count({ where: { entityType: 'Parametrage', actorId: null } })) === attendu);

  console.log('— Second passage : rien créé, rien modifié');
  const avant = await photo();
  const p2 = parametrer();
  check('second passage : 0 créé', p2.code === 0 && p2.out.includes(`Bilan : 0 créé(s), ${attendu} déjà présent(s).`));
  check('base strictement identique (valeurs et dates de mise à jour)', (await photo()) === avant);

  console.log('— Modifications à l’écran, puis troisième passage');
  const arr = regs.find((r) => r.code === 'ARR');
  expect('admin renomme le registre ARR', await call('admin', 'PATCH', `/courrier/registres/${arr.id}`, { libelle: `Arrivées DNPEC ${S}` }), 200);
  expect('admin fixe la capacité de la DPE à 5', await call('admin', 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DPE}`, maximum: 5 }), 200);
  expect('admin retire la limite de la DEE', await call('admin', 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DEE}`, maximum: null }), 200);
  await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf });
  const salle = res.find((r) => r.nom === 'Salle de réunion principale');
  expect('gestionnaire renomme la salle', await call('agentsaf', 'PATCH', `/logistique/ressources/${salle.id}`, { nom: `Salle du 2e étage ${S}` }), 200);
  const cat = cats.find((c) => c.code === 'MOB');
  expect('admin renomme une catégorie', await call('admin', 'PATCH', `/logistique/categories/${cat.id}`, { libelle: `Mobilier de bureau ${S}` }), 200);
  expect('admin règle la cible des tâches dans les délais à 90 %', await call('admin', 'PATCH', '/api/v1/parametres/indicateurs.cibleTachesPct', { valeur: 90 }), 200);
  const p3 = parametrer();
  check('troisième passage : 0 créé', p3.code === 0 && p3.out.includes('Bilan : 0 créé(s)'));
  check('cible réglée à l’écran conservée (90 %)', (await prisma.parametre.findUnique({ where: { cle: 'indicateurs.cibleTachesPct' } })).valeur === 90);
  check('registre renommé conservé', (await prisma.registreCourrier.findUnique({ where: { code: 'ARR' } })).libelle === `Arrivées DNPEC ${S}`);
  check('capacité DPE modifiée conservée (5)', (await prisma.capaciteAccueil.findUnique({ where: { uniteKey: `DIV:${ids.DPE}` } })).maximum === 5);
  check('limite DEE retirée : jamais recréée', !(await prisma.capaciteAccueil.findUnique({ where: { uniteKey: `DIV:${ids.DEE}` } })) && /DEE.*non recréé/.test(p3.out));
  check('salle renommée conservée, pas de doublon', (await prisma.ressourceReservable.count()) === 2 && (await prisma.ressourceReservable.findUnique({ where: { id: salle.id } })).nom === `Salle du 2e étage ${S}`);
  check('catégorie renommée conservée', (await prisma.categorieLogistique.findUnique({ where: { code: 'MOB' } })).libelle === `Mobilier de bureau ${S}`);

  console.log('— Réglages des stages : DRH et administrateur, jamais un chef');
  const capsAdmin = (await call('admin', 'GET', '/stages/capacites')).body;
  check('admin : capacités modifiables, pas de planning', capsAdmin.peutModifier === true && capsAdmin.voitPlanning === false);
  expect('admin : planning (contenu des stages) refusé', await call('admin', 'GET', '/stages/planning'), 403);
  check('admin : liste des stages vide (jamais le contenu)', ((await call('admin', 'GET', '/stages')).body.stages || []).length === 0);
  const mAdmin = (await call('admin', 'GET', '/stages/modele-attestation')).body;
  check('admin : modèle par défaut visible (sans auteur)', mAdmin.modele.parDefaut === true && mAdmin.modele.importePar === null);
  const fic = await fetch('http://localhost:3000/stages/modele-attestation/fichier', { headers: { Authorization: 'Bearer ' + (await login('admin')) } });
  const docx = Buffer.from(await fic.arrayBuffer());
  check('admin : téléchargement du modèle par défaut (Word)', fic.status === 200 && docx.slice(0, 2).toString() === 'PK' && /République|RÉPUBLIQUE DE GUINÉE/.test(new PizZip(docx).file('word/document.xml').asText()));
  for (const k of ['chefdpe', 'chefsaf', 'dn', 'agent1']) {
    expect(`${k} : fixer une capacité`, await call(k, 'PUT', '/stages/capacites', { uniteKey: `DIV:${ids.DPE}`, maximum: 3 }), 403);
    expect(`${k} : importer un modèle`, await (async () => { const fd = new FormData(); fd.append('file', new Blob([docx]), 'm.docx'); const r = await fetch('http://localhost:3000/stages/modele-attestation', { method: 'POST', headers: { Authorization: 'Bearer ' + (await login(k)) }, body: fd }); return { status: r.status, body: await r.json() }; })(), 403);
  }

  console.log('— Un compte devient DRH par « Changer de rôle »');
  const avantRole = await photo();
  const cr = await call('admin', 'POST', `/users/${ids.agent2}/role`, { role: 'DRH', roleAttendu: 'AGENT', divisionId: null, sectionId: null, celluleId: null, motif: `Nomination DRH ${S}` });
  expect('agent2 devient DRH', cr, 201);
  check('paramétrage intact après le changement de rôle', (await photo()) === avantRole);
  const r1 = await call('agent2', 'PUT', '/stages/capacites', { uniteKey: `CEL:${ids.SAF}`, maximum: 3 });
  expect('le nouveau DRH modifie une capacité', r1, 200);
  expect('le nouveau DRH voit le modèle', await call('agent2', 'GET', '/stages/modele-attestation'), 200);
  expect('l’admin modifie aussi une capacité', await call('admin', 'PUT', '/stages/capacites', { uniteKey: `CEL:${ids.SAF}`, maximum: 4 }), 200);
  check('capacité SAF = 4, auteur = admin', (await prisma.capaciteAccueil.findUnique({ where: { uniteKey: `CEL:${ids.SAF}` } })).maximum === 4);

  console.log('— Attestation avec le modèle par défaut');
  const stg = (await call('admin', 'POST', '/users', { email: `par${S}@test.local`, password: 'Password123!', firstName: 'Mariama', lastName: `Diallo${S}`, role: 'STAGIAIRE' })).body.id;
  const an = new Date().getUTCFullYear() + 5;
  const st = (await call('agent2', 'POST', '/stages', { stagiaireId: stg, etablissement: 'Université Gamal Abdel Nasser', diplomePrepare: 'Licence Économie', encadrantAcademique: 'Pr Bah', dateDebut: `${an}-02-01`, dateFin: `${an}-03-31` })).body;
  check('stage créé par le nouveau DRH', !!st.id);
  const prov = await fetch(`http://localhost:3000/stages/${st.id}/attestation/provisoire`, { headers: { Authorization: 'Bearer ' + (await login('agent2')) } });
  const pdf = Buffer.from(await prov.arrayBuffer());
  const l = pdf.toString('latin1'); let texte = l; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(l))) { const fin = l.indexOf('endstream', m.index); try { texte += zlib.inflateSync(Buffer.from(l.slice(m.index + m[0].length, fin), 'latin1')).toString('latin1'); } catch { /* non compressé */ } }
  const hex = (x) => Buffer.from(x, 'latin1').toString('hex').toUpperCase();
  check('attestation provisoire (PDF, mise en page standard : le Word ne se convertit pas côté serveur) générée', prov.status === 200 && pdf.slice(0, 4).toString() === '%PDF' && (await require('pdf-lib').PDFDocument.load(pdf)).getPageCount() >= 1);
  const doc = await fetch(`http://localhost:3000/stages/${st.id}/attestation/document`, { headers: { Authorization: 'Bearer ' + (await login('agent2')) } });
  const xml = new PizZip(Buffer.from(await doc.arrayBuffer())).file('word/document.xml').asText();
  check('document Word rempli avec le modèle par défaut : nom, établissement, diplôme, en-tête', doc.status === 200 && xml.includes(`DIALLO${S.toUpperCase()}`) && xml.includes('Gamal Abdel Nasser') && xml.includes('Licence Économie') && xml.includes('RÉPUBLIQUE DE GUINÉE'));
  check('aucun champ laissé non rempli ({{…}})', !/\{\{/.test(xml));
  expect('admin : document d’un stage (contenu) refusé', await call('admin', 'GET', `/stages/${st.id}/attestation/document`), 403);

  console.log('— Remplacement du modèle à l’écran, puis nouveau passage du script');
  const fd = new FormData(); fd.append('file', new Blob([docx]), 'Mon modele.docx');
  const imp = await fetch('http://localhost:3000/stages/modele-attestation', { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('admin')) }, body: fd });
  check('admin remplace le modèle', imp.status === 201);
  const p4 = parametrer();
  check('script : modèle importé conservé, rien créé', p4.out.includes('Bilan : 0 créé(s)') && (await prisma.modeleAttestation.findFirst({ where: { actif: true } })).fileName === 'Mon modele.docx');

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
