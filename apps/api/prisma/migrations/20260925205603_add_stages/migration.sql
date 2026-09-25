-- CreateEnum
CREATE TYPE "stage_statut" AS ENUM ('PREVU', 'EN_COURS', 'TERMINE', 'INTERROMPU');

-- CreateEnum
CREATE TYPE "periode_stage_statut" AS ENUM ('PROPOSEE', 'ACCEPTEE', 'REFUSEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "evaluation_format" AS ENUM ('GRILLE', 'TEXTE', 'AUCUNE');

-- CreateEnum
CREATE TYPE "evaluation_stage_statut" AS ENUM ('BROUILLON', 'SOUMISE', 'RENVOYEE', 'VISEE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'STAGE_PERIODE_A_ACCEPTER';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_PERIODE_REFUSEE';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_PERIODE_A_VENIR';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_PERIODE_DEBUT';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_ALERTE';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_PLAN_MODIFIE';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_EVALUATION_A_FAIRE';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_EVALUATION_A_VISER';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_EVALUATION_RENVOYEE';
ALTER TYPE "notification_type" ADD VALUE 'STAGE_EVALUATION_VISEE';

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "stagiaireId" TEXT NOT NULL,
    "etablissement" TEXT NOT NULL,
    "diplomePrepare" TEXT,
    "encadrantAcademique" TEXT,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "statut" "stage_statut" NOT NULL DEFAULT 'PREVU',
    "motifInterruption" TEXT,
    "clotureAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodes_stage" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "divisionId" TEXT,
    "sectionId" TEXT,
    "celluleId" TEXT,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "objectifs" TEXT,
    "formatEvaluation" "evaluation_format" NOT NULL,
    "statut" "periode_stage_statut" NOT NULL DEFAULT 'PROPOSEE',
    "tuteurId" TEXT,
    "motifRefus" TEXT,
    "decideeParId" TEXT,
    "decideeAt" TIMESTAMP(3),
    "rattachementAppliqueAt" TIMESTAMP(3),
    "rappelAVenirAt" TIMESTAMP(3),
    "alerteAt" TIMESTAMP(3),
    "rappelEvaluationAt" TIMESTAMP(3),
    "relanceEvaluationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodes_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations_stage" (
    "id" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "redacteurId" TEXT NOT NULL,
    "criteres" JSONB,
    "appreciation" TEXT,
    "statut" "evaluation_stage_statut" NOT NULL DEFAULT 'BROUILLON',
    "motifRenvoi" TEXT,
    "soumiseAt" TIMESTAMP(3),
    "viseeParId" TEXT,
    "viseeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacites_accueil" (
    "uniteKey" TEXT NOT NULL,
    "maximum" INTEGER NOT NULL,
    "fixeeParId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capacites_accueil_pkey" PRIMARY KEY ("uniteKey")
);

-- CreateIndex
CREATE INDEX "stages_stagiaireId_idx" ON "stages"("stagiaireId");

-- CreateIndex
CREATE INDEX "periodes_stage_stageId_idx" ON "periodes_stage"("stageId");

-- CreateIndex
CREATE INDEX "periodes_stage_divisionId_idx" ON "periodes_stage"("divisionId");

-- CreateIndex
CREATE INDEX "periodes_stage_sectionId_idx" ON "periodes_stage"("sectionId");

-- CreateIndex
CREATE INDEX "periodes_stage_celluleId_idx" ON "periodes_stage"("celluleId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_stage_periodeId_key" ON "evaluations_stage"("periodeId");

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_stagiaireId_fkey" FOREIGN KEY ("stagiaireId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_stage" ADD CONSTRAINT "periodes_stage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_stage" ADD CONSTRAINT "periodes_stage_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_stage" ADD CONSTRAINT "periodes_stage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_stage" ADD CONSTRAINT "periodes_stage_celluleId_fkey" FOREIGN KEY ("celluleId") REFERENCES "cellules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_stage" ADD CONSTRAINT "periodes_stage_tuteurId_fkey" FOREIGN KEY ("tuteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes_stage" ADD CONSTRAINT "periodes_stage_decideeParId_fkey" FOREIGN KEY ("decideeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_stage" ADD CONSTRAINT "evaluations_stage_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "periodes_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_stage" ADD CONSTRAINT "evaluations_stage_redacteurId_fkey" FOREIGN KEY ("redacteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_stage" ADD CONSTRAINT "evaluations_stage_viseeParId_fkey" FOREIGN KEY ("viseeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacites_accueil" ADD CONSTRAINT "capacites_accueil_fixeeParId_fkey" FOREIGN KEY ("fixeeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
