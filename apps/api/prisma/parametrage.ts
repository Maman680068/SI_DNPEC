/**
 * Paramétrage initial de la production — lancé par .github/workflows/db-parametrage.yml
 * (ou `pnpm --filter @dnpec/api run db:parametrage` sur une base locale).
 *
 * Règles :
 * - CRÉATION SEULEMENT : ne modifie ni ne supprime jamais un élément existant, même
 *   renommé ou réglé autrement à l'écran.
 * - Identité stable de chaque élément : le code pour un registre ou une catégorie, un
 *   identifiant fixe (« param-… ») pour une ressource ou un article, l'unité pour une
 *   capacité. Chaque création est tracée dans le journal d'audit (acteur « Système »,
 *   entityType « Parametrage ») : un élément supprimé ensuite à l'écran n'est jamais
 *   recréé par un nouveau passage.
 * - Aucun élément rattaché à une personne : ni compte, ni habilitation, ni bien
 *   inventorié (vraies personnes, vrais biens : saisis à l'écran).
 * - Refuse de tourner si les migrations de la base ne sont pas à jour.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  AuditAction,
  ModeReservation,
  ModeleAttestationType,
  NatureCategorieLogistique,
  Prisma,
  PrismaClient,
  RegistreNature,
  RegistrePortee,
  TypeRessource,
} from '@prisma/client';
import { MODELE_ATTESTATION_INTEGRE, PREFIXE_INTEGRE } from '../src/stages/reglages-stages';

const prisma = new PrismaClient();
const GABARIT = '{seq:4}/MEFB/DNPEC/{code}/{annee}';

type Ligne = { quoi: string; etat: 'créé' | 'existait déjà' | 'déjà créé une fois (supprimé ou remplacé à l’écran : non recréé)' };
const journal: Ligne[] = [];

/** Marque d'une création par ce script, dans le journal d'audit. */
async function dejaParametre(cle: string): Promise<boolean> {
  return (await prisma.auditLog.count({ where: { entityType: 'Parametrage', entityId: cle } })) > 0;
}

async function tracer(tx: Prisma.TransactionClient, cle: string, quoi: string, metadata: Record<string, unknown>) {
  await tx.auditLog.create({
    data: {
      actorId: null, // « Système » : aucune personne derrière ce paramétrage
      action: AuditAction.CREATION,
      entityType: 'Parametrage',
      entityId: cle,
      metadata: { event: 'parametrage_initial', par: 'Système (script de paramétrage)', quoi, ...metadata } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Crée un élément s'il n'existe pas et n'a jamais été créé par ce script.
 * `existe` : l'élément est-il en base (identité stable) ? `creer` : sa création,
 * dans la même transaction que la trace d'audit.
 */
async function creerSiAbsent(cle: string, quoi: string, existe: () => Promise<boolean>, creer: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  if (await existe()) return journal.push({ quoi, etat: 'existait déjà' });
  if (await dejaParametre(cle)) return journal.push({ quoi, etat: 'déjà créé une fois (supprimé ou remplacé à l’écran : non recréé)' });
  await prisma.$transaction(async (tx) => {
    await creer(tx);
    await tracer(tx, cle, quoi, {});
  });
  journal.push({ quoi, etat: 'créé' });
}

/** Toutes les migrations du dépôt doivent être appliquées, sans échec en cours. */
async function verifierMigrations() {
  const dossier = path.join(__dirname, 'migrations');
  const attendues = fs.readdirSync(dossier).filter((d) => fs.statSync(path.join(dossier, d)).isDirectory());
  let appliquees: { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[];
  try {
    appliquees = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
  } catch {
    throw new Error('Base sans historique de migrations : lancez d’abord db-migrate.yml.');
  }
  const ok = new Set(appliquees.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name));
  const manquantes = attendues.filter((m) => !ok.has(m));
  const enEchec = appliquees.filter((m) => !m.finished_at && !m.rolled_back_at);
  if (manquantes.length || enEchec.length) {
    throw new Error(
      `Migrations non à jour — lancez d’abord db-migrate.yml.${manquantes.length ? ` Manquantes : ${manquantes.join(', ')}.` : ''}${
        enEchec.length ? ` En échec : ${enEchec.map((m) => m.migration_name).join(', ')}.` : ''
      }`,
    );
  }
  console.log(`Migrations à jour (${attendues.length}).`);
}

async function registres() {
  const liste: [string, string, RegistreNature][] = [
    ['ARR', 'Courrier arrivée', RegistreNature.ARRIVEE],
    ['DEP', 'Courrier départ', RegistreNature.DEPART],
    ['NS', 'Notes de service', RegistreNature.ACTE],
    ['DEC', 'Décisions', RegistreNature.ACTE],
    ['OM', 'Ordres de mission', RegistreNature.ACTE],
    ['ATT', 'Attestations', RegistreNature.ACTE],
  ];
  for (const [code, libelle, nature] of liste) {
    // Compteurs non initialisés : la reprise des numéros papier reste possible à
    // l'écran tant qu'aucun numéro n'a été attribué.
    await creerSiAbsent(
      `registre:${code}`,
      `Registre ${code} — ${libelle}`,
      async () => !!(await prisma.registreCourrier.findUnique({ where: { code } })),
      (tx) => tx.registreCourrier.create({ data: { code, libelle, nature, portee: RegistrePortee.DIRECTION, gabaritNumero: GABARIT } }),
    );
  }
}

async function categories() {
  const liste: [string, string, NatureCategorieLogistique, boolean][] = [
    ['INF', 'Informatique', NatureCategorieLogistique.BIEN, true],
    ['MOB', 'Mobilier', NatureCategorieLogistique.BIEN, true],
    ['PRES', 'Matériel de présentation', NatureCategorieLogistique.BIEN, true],
    ['FBUR', 'Fournitures de bureau', NatureCategorieLogistique.FOURNITURE, false],
  ];
  for (const [code, libelle, nature, validationChefRequise] of liste) {
    await creerSiAbsent(
      `categorie:${code}`,
      `Catégorie ${code} — ${libelle} (validation du chef : ${validationChefRequise ? 'oui' : 'non'})`,
      async () => !!(await prisma.categorieLogistique.findUnique({ where: { code } })),
      (tx) => tx.categorieLogistique.create({ data: { code, libelle, nature, validationChefRequise } }),
    );
  }
}

async function capacites() {
  const divisions = await prisma.division.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  const cellules = await prisma.cellule.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  const unites = [...divisions.map((d) => ({ cle: `DIV:${d.id}`, nom: d.code })), ...cellules.map((c) => ({ cle: `CEL:${c.id}`, nom: c.code }))];
  for (const u of unites) {
    await creerSiAbsent(
      `capacite:${u.cle}`,
      `Capacité d’accueil ${u.nom} : 2 stagiaires`,
      async () => !!(await prisma.capaciteAccueil.findUnique({ where: { uniteKey: u.cle } })),
      (tx) => tx.capaciteAccueil.create({ data: { uniteKey: u.cle, maximum: 2, fixeeParId: null } }),
    );
  }
}

async function modeleAttestation() {
  const fichier = path.join(__dirname, '../assets', MODELE_ATTESTATION_INTEGRE);
  if (!fs.existsSync(fichier)) throw new Error(`Modèle par défaut introuvable : ${fichier}`);
  await creerSiAbsent(
    'modele-attestation:defaut',
    'Modèle d’attestation de stage par défaut (Word, en-tête République de Guinée / MEFB / DNPEC)',
    // Un modèle déjà importé (actif ou non) : on ne touche à rien.
    async () => (await prisma.modeleAttestation.count()) > 0,
    (tx) =>
      tx.modeleAttestation.create({
        data: {
          type: ModeleAttestationType.DOCX,
          fileKey: `${PREFIXE_INTEGRE}${MODELE_ATTESTATION_INTEGRE}`,
          fileName: 'Modèle attestation DNPEC.docx',
          champs: ['NUMERO', 'NOM_COMPLET', 'NOM', 'PRENOM', 'ETABLISSEMENT', 'DIPLOME', 'DATE_DEBUT', 'DATE_FIN', 'DUREE', 'UNITES', 'TUTEURS', 'ENCADRANT', 'DATE_DU_JOUR', 'SIGNATAIRE'],
          importeParId: null,
        },
      }),
  );
}

async function ressources() {
  const liste: [string, string, TypeRessource, ModeReservation, string][] = [
    ['param-ressource-salle-principale', 'Salle de réunion principale', TypeRessource.SALLE, ModeReservation.VALIDATION, 'validation du gestionnaire'],
    ['param-ressource-videoprojecteur-1', 'Vidéoprojecteur 1', TypeRessource.MATERIEL_PRESENTATION, ModeReservation.IMMEDIATE, 'confirmation immédiate'],
  ];
  for (const [id, nom, type, mode, libelleMode] of liste) {
    await creerSiAbsent(
      `ressource:${id}`,
      `Ressource « ${nom} » (${libelleMode})`,
      async () => !!(await prisma.ressourceReservable.findUnique({ where: { id } })),
      async (tx) => {
        // Le nom est unique : si une ressource porte déjà ce nom, suffixe explicite.
        const pris = await tx.ressourceReservable.findUnique({ where: { nom } });
        return tx.ressourceReservable.create({
          data: { id, nom: pris ? `${nom} (paramétrage)` : nom, type, mode, description: 'Créée par le paramétrage initial — renommez-la à l’écran (Logistique → Réservations → Ressources).' },
        });
      },
    );
  }
}

async function articles() {
  const categorie = await prisma.categorieLogistique.findUnique({ where: { code: 'FBUR' } });
  if (!categorie) {
    journal.push({ quoi: 'Articles de fournitures', etat: 'existait déjà' });
    console.log('  (catégorie FBUR absente : articles non créés)');
    return;
  }
  const liste: [string, string, string, boolean][] = [
    ['param-article-rame-a4', 'Rame de papier A4', 'rame', true],
    ['param-article-cartouche', 'Cartouche d’encre', 'cartouche', true],
    ['param-article-stylos', 'Stylos', 'boîte', true],
    ['param-article-chemises', 'Chemises cartonnées', 'paquet', false],
  ];
  for (const [id, libelle, unite, suiviStock] of liste) {
    await creerSiAbsent(
      `article:${id}`,
      `Article « ${libelle} » (suivi de stock : ${suiviStock ? 'oui, stock 0, seuil 5' : 'non'})`,
      async () => !!(await prisma.articleFourniture.findUnique({ where: { id } })),
      (tx) =>
        tx.articleFourniture.create({
          data: { id, categorieId: categorie.id, libelle, unite, suiviStock, stock: 0, seuilAlerte: suiviStock ? 5 : null },
        }),
    );
  }
}

async function main() {
  console.log('Paramétrage initial — création seulement, rien n’est modifié ni supprimé.');
  await verifierMigrations();
  await registres();
  await categories();
  await capacites();
  await modeleAttestation();
  await ressources();
  await articles();
  const cree = journal.filter((l) => l.etat === 'créé');
  console.log('\nCRÉÉ :');
  for (const l of cree) console.log(`  + ${l.quoi}`);
  if (!cree.length) console.log('  (rien)');
  console.log('\nDÉJÀ PRÉSENT, NON MODIFIÉ :');
  for (const l of journal.filter((x) => x.etat !== 'créé')) console.log(`  = ${l.quoi} — ${l.etat}`);
  console.log(`\nBilan : ${cree.length} créé(s), ${journal.length - cree.length} déjà présent(s).`);
}

main()
  .catch((e) => {
    console.error(`\nÉCHEC : ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
