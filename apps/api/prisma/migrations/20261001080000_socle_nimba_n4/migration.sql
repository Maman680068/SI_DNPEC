-- Socle NIMBA, lot N4 : statut de diffusion (§7.1), métadonnées et liens de la GED (§8), documents
-- générés (SIG-RF-DOC). Additive ; retour arrière : prisma/retour-arriere/n4_down.sql.

-- CreateEnum
CREATE TYPE "statut_diffusion" AS ENUM ('BROUILLON', 'VALIDE', 'DIFFUSABLE');

-- CreateEnum
CREATE TYPE "type_document" AS ENUM ('ETUDE', 'RAPPORT', 'NOTE_TECHNIQUE', 'PROCES_VERBAL', 'ACTE', 'RPEF', 'NOTE_CONJONCTURE', 'AUTRE');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "dateDocument" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "periodeDebut" DATE,
ADD COLUMN     "periodeFin" DATE,
ADD COLUMN     "sourceMeetingId" TEXT,
ADD COLUMN     "statutDiffusion" "statut_diffusion" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "typeDocument" "type_document" NOT NULL DEFAULT 'AUTRE';

-- CreateTable
CREATE TABLE "changements_statut" (
    "id" TEXT NOT NULL,
    "objetType" TEXT NOT NULL,
    "objetId" TEXT NOT NULL,
    "de" "statut_diffusion",
    "vers" "statut_diffusion" NOT NULL,
    "motif" TEXT,
    "parId" TEXT,
    "le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changements_statut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordres_mission" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateDepart" DATE NOT NULL,
    "dateRetour" DATE NOT NULL,
    "transport" TEXT,
    "fraisMontant" INTEGER,
    "creeParId" TEXT NOT NULL,
    "acteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordres_mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_generes" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objetId" TEXT NOT NULL,
    "acteId" TEXT,
    "edition" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "parId" TEXT NOT NULL,
    "le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_generes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations_travail" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "acteId" TEXT,
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attestations_travail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changements_statut_objetType_objetId_idx" ON "changements_statut"("objetType", "objetId");

-- CreateIndex
CREATE UNIQUE INDEX "ordres_mission_acteId_key" ON "ordres_mission"("acteId");

-- CreateIndex
CREATE INDEX "ordres_mission_agentId_idx" ON "ordres_mission"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_generes_type_objetId_edition_key" ON "documents_generes"("type", "objetId", "edition");

-- CreateIndex
CREATE UNIQUE INDEX "attestations_travail_acteId_key" ON "attestations_travail"("acteId");

-- CreateIndex
CREATE INDEX "attestations_travail_agentId_idx" ON "attestations_travail"("agentId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_sourceMeetingId_fkey" FOREIGN KEY ("sourceMeetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordres_mission" ADD CONSTRAINT "ordres_mission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordres_mission" ADD CONSTRAINT "ordres_mission_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordres_mission" ADD CONSTRAINT "ordres_mission_acteId_fkey" FOREIGN KEY ("acteId") REFERENCES "actes_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise : type repris de la catégorie, date du document = date de dépôt (la période couverte reste à
-- compléter) ; un document déjà publié dans l'espace DNPEC est réputé Validé, et ce passage est journalisé.
UPDATE "documents" SET
  "dateDocument" = "createdAt"::date,
  "typeDocument" = (CASE "category"::text
    WHEN 'ETUDE' THEN 'ETUDE' WHEN 'RAPPORT' THEN 'RAPPORT' WHEN 'NOTE_TECHNIQUE' THEN 'NOTE_TECHNIQUE' ELSE 'AUTRE' END)::"type_document";
UPDATE "documents" SET "statutDiffusion" = 'VALIDE' WHERE "visibility" = 'PUBLIE_DNPEC';
INSERT INTO "changements_statut" ("id", "objetType", "objetId", "de", "vers", "motif", "parId", "le")
  SELECT 'reprise-n4-' || "id", 'Document', "id", 'BROUILLON', 'VALIDE', 'Reprise N4 : document déjà publié dans l''espace DNPEC', NULL, CURRENT_TIMESTAMP
  FROM "documents" WHERE "visibility" = 'PUBLIE_DNPEC';
