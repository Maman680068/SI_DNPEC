-- Socle NIMBA, lot N6 : effectifs et alertes RH (A3.5), carrière et actes des RH (A3.6), fiches de poste,
-- besoins de formation, véhicules de service et carburant (SIG-RF-LOG-03). Additive ; retour arrière :
-- prisma/retour-arriere/n6_down.sql. Aucune donnée existante n'est modifiée.

-- CreateEnum
CREATE TYPE "type_mouvement_carriere" AS ENUM ('NOMINATION', 'AVANCEMENT_ECHELON', 'PROMOTION', 'MUTATION', 'FIN_CONTRAT');

-- CreateEnum
CREATE TYPE "statut_mouvement_carriere" AS ENUM ('PREPARE', 'EN_ACTE', 'APPLIQUE', 'ANNULE');

-- AlterTable
ALTER TABLE "ordres_mission" ADD COLUMN     "kilometrageDepart" INTEGER,
ADD COLUMN     "kilometrageRetour" INTEGER,
ADD COLUMN     "vehiculeId" TEXT;

-- AlterTable
ALTER TABLE "personnel_documents" ADD COLUMN     "pieceRequiseId" TEXT;

-- AlterTable
ALTER TABLE "personnel_files_basic" ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "echelonDepuis" DATE;

-- CreateTable
CREATE TABLE "pieces_requises" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_requises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "familles_actes_rh" (
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "registreId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "familles_actes_rh_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "mouvements_carriere" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "type_mouvement_carriere" NOT NULL,
    "avant" JSONB NOT NULL,
    "apres" JSONB NOT NULL,
    "dateEffet" DATE NOT NULL,
    "motif" TEXT,
    "statut" "statut_mouvement_carriere" NOT NULL DEFAULT 'PREPARE',
    "familleCode" TEXT NOT NULL,
    "acteId" TEXT,
    "creeParId" TEXT NOT NULL,
    "appliqueLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mouvements_carriere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiches_poste" (
    "id" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "missions" TEXT NOT NULL,
    "activites" TEXT,
    "competences" TEXT,
    "majParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiches_poste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "besoins_formation" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "uniteId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "priorite" TEXT NOT NULL,
    "origine" TEXT NOT NULL,
    "effectif" INTEGER NOT NULL DEFAULT 1,
    "statut" TEXT NOT NULL DEFAULT 'EXPRIME',
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "besoins_formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicules" (
    "id" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "energie" TEXT NOT NULL,
    "kilometrage" INTEGER NOT NULL DEFAULT 0,
    "etat" "etat_bien" NOT NULL DEFAULT 'EN_SERVICE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pleins_carburant" (
    "id" TEXT NOT NULL,
    "vehiculeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "litres" DECIMAL(8,2) NOT NULL,
    "kilometrage" INTEGER NOT NULL,
    "ordreMissionId" TEXT,
    "saisiParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pleins_carburant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pieces_requises_libelle_key" ON "pieces_requises"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_carriere_acteId_key" ON "mouvements_carriere"("acteId");

-- CreateIndex
CREATE INDEX "mouvements_carriere_userId_idx" ON "mouvements_carriere"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fiches_poste_fonction_key" ON "fiches_poste"("fonction");

-- CreateIndex
CREATE INDEX "besoins_formation_annee_idx" ON "besoins_formation"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "vehicules_immatriculation_key" ON "vehicules"("immatriculation");

-- CreateIndex
CREATE INDEX "pleins_carburant_vehiculeId_date_idx" ON "pleins_carburant"("vehiculeId", "date");

-- AddForeignKey
ALTER TABLE "personnel_documents" ADD CONSTRAINT "personnel_documents_pieceRequiseId_fkey" FOREIGN KEY ("pieceRequiseId") REFERENCES "pieces_requises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordres_mission" ADD CONSTRAINT "ordres_mission_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "vehicules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "familles_actes_rh" ADD CONSTRAINT "familles_actes_rh_registreId_fkey" FOREIGN KEY ("registreId") REFERENCES "registres_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_carriere" ADD CONSTRAINT "mouvements_carriere_acteId_fkey" FOREIGN KEY ("acteId") REFERENCES "actes_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pleins_carburant" ADD CONSTRAINT "pleins_carburant_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "vehicules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pleins_carburant" ADD CONSTRAINT "pleins_carburant_ordreMissionId_fkey" FOREIGN KEY ("ordreMissionId") REFERENCES "ordres_mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Contrôles en base.
ALTER TABLE "vehicules" ADD CONSTRAINT "vehicules_kilometrage_positif" CHECK ("kilometrage" >= 0);
ALTER TABLE "pleins_carburant" ADD CONSTRAINT "pleins_carburant_valeurs" CHECK ("litres" > 0 AND "kilometrage" >= 0);
ALTER TABLE "ordres_mission" ADD CONSTRAINT "ordres_mission_kilometrage" CHECK ("kilometrageRetour" IS NULL OR "kilometrageDepart" IS NULL OR "kilometrageRetour" >= "kilometrageDepart");
ALTER TABLE "besoins_formation" ADD CONSTRAINT "besoins_formation_valeurs" CHECK ("effectif" >= 1 AND "priorite" IN ('HAUTE', 'MOYENNE', 'BASSE') AND "statut" IN ('EXPRIME', 'RETENU', 'REALISE', 'ECARTE'));

-- Paramétrage livré (modifiable à l'écran par le DRH) : pièces requises d'un dossier complet et
-- familles d'actes des RH (le registre de chaque famille est choisi à l'écran).
INSERT INTO "pieces_requises" ("id", "libelle", "ordre") VALUES
('pr-cni', 'Carte nationale d’identité', 1),
('pr-naissance', 'Extrait d’acte de naissance', 2),
('pr-diplome', 'Diplôme le plus élevé', 3),
('pr-casier', 'Extrait de casier judiciaire', 4),
('pr-prise-service', 'Certificat de prise de service', 5);

INSERT INTO "familles_actes_rh" ("code", "libelle", "updatedAt") VALUES
('ARRETE_AFFECTATION', 'Arrêté d’affectation', now()),
('DECISION_NOMINATION', 'Décision de nomination', now()),
('DECISION_AVANCEMENT', 'Décision d’avancement', now()),
('ATTESTATION_TRAVAIL', 'Attestation de travail', now()),
('ATTESTATION_STAGE', 'Attestation de stage', now()),
('DECISION_FIN_CONTRAT', 'Décision de fin de contrat', now());
