-- Socle n7 — nomination à un poste de responsabilité : changement de rôle pré-rempli en attente de l'administrateur.
-- Migration additive : un type et une table, aucune donnée existante modifiée.
-- Retour arrière : prisma/retour-arriere/n7_down.sql (phase 39m de tests/e2e/run_all.sh).

-- CreateEnum
CREATE TYPE "statut_changement_role" AS ENUM ('EN_ATTENTE', 'APPLIQUE', 'REFUSE');

-- CreateTable
CREATE TABLE "changements_role_nomination" (
    "id" TEXT NOT NULL,
    "mouvementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acteNumero" TEXT NOT NULL,
    "roleCible" "system_role" NOT NULL,
    "divisionId" TEXT,
    "sectionId" TEXT,
    "celluleId" TEXT,
    "ancienTitulaireId" TEXT,
    "roleAncienTitulaire" "system_role",
    "statut" "statut_changement_role" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifRefus" TEXT,
    "erreur" TEXT,
    "decideParId" TEXT,
    "decideLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changements_role_nomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "changements_role_nomination_mouvementId_key" ON "changements_role_nomination"("mouvementId");

-- CreateIndex
CREATE INDEX "changements_role_nomination_statut_idx" ON "changements_role_nomination"("statut");

-- AddForeignKey
ALTER TABLE "changements_role_nomination" ADD CONSTRAINT "changements_role_nomination_mouvementId_fkey" FOREIGN KEY ("mouvementId") REFERENCES "mouvements_carriere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
