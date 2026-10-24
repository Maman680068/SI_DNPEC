-- Plan de formation individuel : sessions de formation par agent (docs/conception_plan_formation.md).
-- Migration additive : un type et une table nouvelle, aucune table existante modifiée.
-- Retour arrière : prisma/retour-arriere/formation_down.sql (phase 39p de tests/e2e/run_all.sh).

-- CreateEnum
CREATE TYPE "etat_session_formation" AS ENUM ('SOUHAITEE', 'PLANIFIEE', 'SUIVIE', 'ANNULEE');

-- CreateTable
CREATE TABLE "sessions_formation" (
    "id" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "besoinId" TEXT,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE,
    "dureeJours" INTEGER,
    "organisme" TEXT,
    "etat" "etat_session_formation" NOT NULL DEFAULT 'SOUHAITEE',
    "creeParId" TEXT NOT NULL,
    "alerteDebutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_formation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_formation_agentId_idx" ON "sessions_formation"("agentId");

-- CreateIndex
CREATE INDEX "sessions_formation_etat_dateDebut_idx" ON "sessions_formation"("etat", "dateDebut");

-- AddForeignKey
ALTER TABLE "sessions_formation" ADD CONSTRAINT "sessions_formation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_formation" ADD CONSTRAINT "sessions_formation_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "besoins_formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garde-fous : fin postérieure ou égale au début ; fin ou durée renseignée ; durée positive.
ALTER TABLE "sessions_formation" ADD CONSTRAINT "sessions_formation_periode" CHECK (("dateFin" IS NULL OR "dateFin" >= "dateDebut") AND ("dateFin" IS NOT NULL OR "dureeJours" IS NOT NULL) AND ("dureeJours" IS NULL OR "dureeJours" > 0));
