// D7 — 50 enregistrements parallèles sur le même registre, 10 mis en échec APRÈS l'attribution du numéro.
const E = require('../config');
const fs = require('fs');
const { upload, ids, check, bilan } = require('../lib');
const reg = require(E.etat('registres.json'));
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const DIR = process.env.DOCUMENTS_STORAGE_PATH;
const nbFichiers = () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).length : 0);
(async () => {
  const annee = new Date().getFullYear();
  // Échec simulé dans la transaction, APRÈS l'upsert du compteur et la création de l'arrivée :
  // l'insertion d'une pièce nommée ECHEC-* lève une exception → rollback complet.
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION zz_test_echec() RETURNS trigger AS $$ BEGIN IF NEW."fileName" LIKE 'ECHEC%' THEN RAISE EXCEPTION 'échec simulé après attribution'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER zz_test_echec BEFORE INSERT ON pieces_courrier FOR EACH ROW EXECUTE FUNCTION zz_test_echec()`);
  const avant = await prisma.courrierArrivee.count({ where: { registreId: reg.ARR, annee } });
  const fichiersAvant = nbFichiers();
  const t0 = Date.now();
  const res = await Promise.all([...Array(50)].map((_, i) => {
    const echec = i % 5 === 2; // 10 échecs répartis
    return upload('secdg', '/courrier/arrivees', {
      registreId: reg.ARR, dateReception: new Date().toISOString(), expediteur: `Expéditeur ${i}`, objet: `Objet concurrence ${i}`, confidentialite: 'ORDINAIRE',
    }, [{ name: echec ? `ECHEC-${i}.txt` : `scan-${i}.txt` }]).then((r) => ({ i, echec, ...r }));
  }));
  const duree = Date.now() - t0;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS zz_test_echec ON pieces_courrier');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS zz_test_echec()');

  const reussis = res.filter((r) => r.status === 201), echoues = res.filter((r) => r.status !== 201);
  console.log(`50 requêtes parallèles en ${duree} ms : ${reussis.length} × 201, ${echoues.length} en échec (statuts ${[...new Set(echoues.map((r) => r.status))].join(',')})`);
  check('les 10 requêtes forcées en échec ont échoué, les 40 autres ont réussi', echoues.length === 10 && echoues.every((r) => r.echec) && reussis.every((r) => !r.echec));
  const toutes = await prisma.courrierArrivee.findMany({ where: { registreId: reg.ARR, uniteKey: 'DNPEC', annee }, select: { sequence: true, numero: true }, orderBy: { sequence: 'asc' } });
  const seqs = toutes.map((t) => t.sequence);
  const contigu = seqs.every((s, k) => s === k + 1);
  const sansDoublon = new Set(seqs).size === seqs.length && new Set(toutes.map((t) => t.numero)).size === toutes.length;
  check(`registre ARR ${annee} : ${seqs.length} entrées, séquence 1..${seqs.length} contiguë (aucun trou)`, contigu, contigu ? '' : `trous/désordre : ${JSON.stringify(seqs)}`);
  check('aucun doublon de séquence ni de numéro', sansDoublon);
  check(`+40 entrées exactement (${avant} → ${toutes.length})`, toutes.length - avant === 40);
  const compteur = await prisma.compteurRegistre.findUnique({ where: { registreId_uniteKey_annee: { registreId: reg.ARR, uniteKey: 'DNPEC', annee } } });
  check(`compteur = dernière séquence (${compteur.dernier}) : les 10 échecs n’ont consommé aucun numéro`, compteur.dernier === seqs[seqs.length - 1]);
  check(`fichiers : +40 sur le disque, 0 orphelin des 10 échecs (${fichiersAvant} → ${nbFichiers()})`, nbFichiers() - fichiersAvant === 40);
  console.log('Exemples de numéros :', reussis.slice(0, 3).map((r) => r.body.numero).join(' | '));
  await prisma.$disconnect(); bilan();
})().catch((e) => { console.error(e); process.exit(1); });
