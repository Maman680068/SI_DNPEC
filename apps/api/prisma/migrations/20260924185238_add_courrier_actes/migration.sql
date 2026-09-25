/*
  Warnings:

  - A unique constraint covering the columns `[sourceImputationId]` on the table `tasks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "registre_nature" AS ENUM ('ARRIVEE', 'DEPART', 'ACTE');

-- CreateEnum
CREATE TYPE "registre_portee" AS ENUM ('DIRECTION', 'UNITE');

-- CreateEnum
CREATE TYPE "courrier_confidentialite" AS ENUM ('ORDINAIRE', 'CONFIDENTIEL', 'PERSONNEL');

-- CreateEnum
CREATE TYPE "arrivee_statut" AS ENUM ('ENREGISTRE', 'IMPUTE', 'TRAITE', 'CLASSE', 'ANNULE');

-- CreateEnum
CREATE TYPE "imputation_nature" AS ENUM ('ATTRIBUTION', 'INFORMATION', 'AVIS');

-- CreateEnum
CREATE TYPE "imputation_statut" AS ENUM ('EN_COURS', 'TRAITEE');

-- CreateEnum
CREATE TYPE "acte_statut" AS ENUM ('BROUILLON', 'EN_VISA', 'RENVOYE', 'A_SIGNER', 'SIGNE', 'EXPEDIE', 'ANNULE');

-- CreateEnum
CREATE TYPE "visa_statut" AS ENUM ('EN_ATTENTE', 'VISE', 'RENVOYE', 'SAUTE');

-- CreateEnum
CREATE TYPE "piece_courrier_nature" AS ENUM ('SCAN', 'ANNEXE', 'ACTE_SIGNE');

-- CreateEnum
CREATE TYPE "acces_delegue_type" AS ENUM ('ASSISTANT', 'SUPPLEANT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'COURRIER_IMPUTE';
ALTER TYPE "notification_type" ADD VALUE 'PLI_PERSONNEL_RECU';
ALTER TYPE "notification_type" ADD VALUE 'COURRIER_ACCES_OUVERT';
ALTER TYPE "notification_type" ADD VALUE 'IMPUTATION_ECHEANCE_PROCHE';
ALTER TYPE "notification_type" ADD VALUE 'IMPUTATION_EN_RETARD';
ALTER TYPE "notification_type" ADD VALUE 'ACTE_A_VISER';
ALTER TYPE "notification_type" ADD VALUE 'ACTE_RENVOYE';
ALTER TYPE "notification_type" ADD VALUE 'ACTE_A_SIGNER';
ALTER TYPE "notification_type" ADD VALUE 'ACTE_SIGNE';
ALTER TYPE "notification_type" ADD VALUE 'ACTE_PRISE_CONNAISSANCE';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "sourceImputationId" TEXT;

-- CreateTable
CREATE TABLE "registres_courrier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "nature" "registre_nature" NOT NULL,
    "portee" "registre_portee" NOT NULL,
    "gabaritNumero" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registres_courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habilitations_courrier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registreId" TEXT NOT NULL,
    "uniteKey" TEXT NOT NULL,
    "accordeeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueeAt" TIMESTAMP(3),
    "revoqueeParId" TEXT,

    CONSTRAINT "habilitations_courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteurs_registre" (
    "registreId" TEXT NOT NULL,
    "uniteKey" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dernier" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compteurs_registre_pkey" PRIMARY KEY ("registreId","uniteKey","annee")
);

-- CreateTable
CREATE TABLE "courriers_arrivee" (
    "id" TEXT NOT NULL,
    "registreId" TEXT NOT NULL,
    "uniteKey" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "dateReception" TIMESTAMP(3) NOT NULL,
    "expediteur" TEXT NOT NULL,
    "referenceExpediteur" TEXT,
    "dateCourrier" TIMESTAMP(3),
    "objet" TEXT,
    "confidentialite" "courrier_confidentialite" NOT NULL,
    "destinataireId" TEXT,
    "statut" "arrivee_statut" NOT NULL DEFAULT 'ENREGISTRE',
    "enregistreParId" TEXT NOT NULL,
    "classeAt" TIMESTAMP(3),
    "classeParId" TEXT,
    "annuleAt" TIMESTAMP(3),
    "annuleParId" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courriers_arrivee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imputations_courrier" (
    "id" TEXT NOT NULL,
    "courrierId" TEXT NOT NULL,
    "parentId" TEXT,
    "imputeParId" TEXT NOT NULL,
    "auNomDeId" TEXT,
    "imputeAId" TEXT NOT NULL,
    "nature" "imputation_nature" NOT NULL,
    "instructions" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" "imputation_statut" NOT NULL DEFAULT 'EN_COURS',
    "compteRendu" TEXT,
    "reponseActeId" TEXT,
    "traiteeAt" TIMESTAMP(3),
    "traiteeParId" TEXT,
    "rappelEcheanceEnvoyeAt" TIMESTAMP(3),
    "rappelRetardEnvoyeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imputations_courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actes_courrier" (
    "id" TEXT NOT NULL,
    "registreId" TEXT NOT NULL,
    "uniteKey" TEXT NOT NULL,
    "annee" INTEGER,
    "sequence" INTEGER,
    "numero" TEXT,
    "objet" TEXT NOT NULL,
    "destinataires" TEXT,
    "corps" TEXT,
    "confidentialite" "courrier_confidentialite" NOT NULL,
    "beneficiaireId" TEXT,
    "priseConnaissanceRequise" BOOLEAN NOT NULL DEFAULT false,
    "priseConnaissanceAt" TIMESTAMP(3),
    "repondAId" TEXT,
    "redacteurId" TEXT NOT NULL,
    "statut" "acte_statut" NOT NULL DEFAULT 'BROUILLON',
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "motifRenvoi" TEXT,
    "signataireId" TEXT,
    "signeAuNomDeId" TEXT,
    "signeAt" TIMESTAMP(3),
    "expedieAt" TIMESTAMP(3),
    "expedieParId" TEXT,
    "modeExpedition" TEXT,
    "annuleAt" TIMESTAMP(3),
    "annuleParId" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actes_courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visas_acte" (
    "id" TEXT NOT NULL,
    "acteId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "niveau" "system_role" NOT NULL,
    "viseurAttenduId" TEXT,
    "statut" "visa_statut" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifSaut" TEXT,
    "viseParId" TEXT,
    "viseAuNomDeId" TEXT,
    "commentaire" TEXT,
    "viseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visas_acte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_courrier" (
    "id" TEXT NOT NULL,
    "arriveeId" TEXT,
    "acteId" TEXT,
    "nature" "piece_courrier_nature" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "deposeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_courrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acces_delegues_courrier" (
    "id" TEXT NOT NULL,
    "arriveeId" TEXT,
    "acteId" TEXT,
    "beneficiaireId" TEXT NOT NULL,
    "type" "acces_delegue_type" NOT NULL,
    "suppleanceId" TEXT,
    "ouvertParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueAt" TIMESTAMP(3),
    "revoqueParId" TEXT,

    CONSTRAINT "acces_delegues_courrier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registres_courrier_code_key" ON "registres_courrier"("code");

-- CreateIndex
CREATE INDEX "habilitations_courrier_userId_idx" ON "habilitations_courrier"("userId");

-- CreateIndex
CREATE INDEX "courriers_arrivee_annee_idx" ON "courriers_arrivee"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "courriers_arrivee_registreId_uniteKey_annee_sequence_key" ON "courriers_arrivee"("registreId", "uniteKey", "annee", "sequence");

-- CreateIndex
CREATE INDEX "imputations_courrier_courrierId_idx" ON "imputations_courrier"("courrierId");

-- CreateIndex
CREATE INDEX "imputations_courrier_imputeAId_idx" ON "imputations_courrier"("imputeAId");

-- CreateIndex
CREATE INDEX "actes_courrier_redacteurId_idx" ON "actes_courrier"("redacteurId");

-- CreateIndex
CREATE UNIQUE INDEX "actes_courrier_registreId_uniteKey_annee_sequence_key" ON "actes_courrier"("registreId", "uniteKey", "annee", "sequence");

-- CreateIndex
CREATE INDEX "visas_acte_acteId_cycle_idx" ON "visas_acte"("acteId", "cycle");

-- CreateIndex
CREATE INDEX "acces_delegues_courrier_beneficiaireId_idx" ON "acces_delegues_courrier"("beneficiaireId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_sourceImputationId_key" ON "tasks"("sourceImputationId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceImputationId_fkey" FOREIGN KEY ("sourceImputationId") REFERENCES "imputations_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitations_courrier" ADD CONSTRAINT "habilitations_courrier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitations_courrier" ADD CONSTRAINT "habilitations_courrier_registreId_fkey" FOREIGN KEY ("registreId") REFERENCES "registres_courrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitations_courrier" ADD CONSTRAINT "habilitations_courrier_accordeeParId_fkey" FOREIGN KEY ("accordeeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitations_courrier" ADD CONSTRAINT "habilitations_courrier_revoqueeParId_fkey" FOREIGN KEY ("revoqueeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteurs_registre" ADD CONSTRAINT "compteurs_registre_registreId_fkey" FOREIGN KEY ("registreId") REFERENCES "registres_courrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courriers_arrivee" ADD CONSTRAINT "courriers_arrivee_registreId_fkey" FOREIGN KEY ("registreId") REFERENCES "registres_courrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courriers_arrivee" ADD CONSTRAINT "courriers_arrivee_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courriers_arrivee" ADD CONSTRAINT "courriers_arrivee_enregistreParId_fkey" FOREIGN KEY ("enregistreParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courriers_arrivee" ADD CONSTRAINT "courriers_arrivee_classeParId_fkey" FOREIGN KEY ("classeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courriers_arrivee" ADD CONSTRAINT "courriers_arrivee_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_courrierId_fkey" FOREIGN KEY ("courrierId") REFERENCES "courriers_arrivee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "imputations_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_imputeParId_fkey" FOREIGN KEY ("imputeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_auNomDeId_fkey" FOREIGN KEY ("auNomDeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_imputeAId_fkey" FOREIGN KEY ("imputeAId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_reponseActeId_fkey" FOREIGN KEY ("reponseActeId") REFERENCES "actes_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imputations_courrier" ADD CONSTRAINT "imputations_courrier_traiteeParId_fkey" FOREIGN KEY ("traiteeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_registreId_fkey" FOREIGN KEY ("registreId") REFERENCES "registres_courrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_beneficiaireId_fkey" FOREIGN KEY ("beneficiaireId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_repondAId_fkey" FOREIGN KEY ("repondAId") REFERENCES "courriers_arrivee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_redacteurId_fkey" FOREIGN KEY ("redacteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_signataireId_fkey" FOREIGN KEY ("signataireId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_signeAuNomDeId_fkey" FOREIGN KEY ("signeAuNomDeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_expedieParId_fkey" FOREIGN KEY ("expedieParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actes_courrier" ADD CONSTRAINT "actes_courrier_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas_acte" ADD CONSTRAINT "visas_acte_acteId_fkey" FOREIGN KEY ("acteId") REFERENCES "actes_courrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas_acte" ADD CONSTRAINT "visas_acte_viseurAttenduId_fkey" FOREIGN KEY ("viseurAttenduId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas_acte" ADD CONSTRAINT "visas_acte_viseParId_fkey" FOREIGN KEY ("viseParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas_acte" ADD CONSTRAINT "visas_acte_viseAuNomDeId_fkey" FOREIGN KEY ("viseAuNomDeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_courrier" ADD CONSTRAINT "pieces_courrier_arriveeId_fkey" FOREIGN KEY ("arriveeId") REFERENCES "courriers_arrivee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_courrier" ADD CONSTRAINT "pieces_courrier_acteId_fkey" FOREIGN KEY ("acteId") REFERENCES "actes_courrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_courrier" ADD CONSTRAINT "pieces_courrier_deposeParId_fkey" FOREIGN KEY ("deposeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_delegues_courrier" ADD CONSTRAINT "acces_delegues_courrier_arriveeId_fkey" FOREIGN KEY ("arriveeId") REFERENCES "courriers_arrivee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_delegues_courrier" ADD CONSTRAINT "acces_delegues_courrier_acteId_fkey" FOREIGN KEY ("acteId") REFERENCES "actes_courrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_delegues_courrier" ADD CONSTRAINT "acces_delegues_courrier_beneficiaireId_fkey" FOREIGN KEY ("beneficiaireId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_delegues_courrier" ADD CONSTRAINT "acces_delegues_courrier_suppleanceId_fkey" FOREIGN KEY ("suppleanceId") REFERENCES "suppleances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_delegues_courrier" ADD CONSTRAINT "acces_delegues_courrier_ouvertParId_fkey" FOREIGN KEY ("ouvertParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_delegues_courrier" ADD CONSTRAINT "acces_delegues_courrier_revoqueParId_fkey" FOREIGN KEY ("revoqueParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Intégrité du registre de courrier (ajout manuel : triggers PostgreSQL)
-- ============================================================================
-- Filet de sécurité SOUS les règles applicatives du module courrier/ : même
-- une requête SQL directe ou un bug applicatif ne peut ni supprimer une entrée
-- numérotée, ni réécrire son numéro. L'annulation passe par statut = ANNULE
-- (le numéro est conservé), jamais par une suppression.

-- Arrivées : toujours numérotées dès l'enregistrement.
CREATE FUNCTION "courrier_arrivee_integrite"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Registre du courrier : l''arrivée % ne peut pas être supprimée (annulez-la).', OLD."numero"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."numero" IS DISTINCT FROM OLD."numero"
     OR NEW."sequence" IS DISTINCT FROM OLD."sequence"
     OR NEW."annee" IS DISTINCT FROM OLD."annee"
     OR NEW."registreId" IS DISTINCT FROM OLD."registreId"
     OR NEW."uniteKey" IS DISTINCT FROM OLD."uniteKey" THEN
    RAISE EXCEPTION 'Registre du courrier : la numérotation de l''arrivée % est figée.', OLD."numero"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "courrier_arrivee_integrite"
  BEFORE UPDATE OR DELETE ON "courriers_arrivee"
  FOR EACH ROW EXECUTE FUNCTION "courrier_arrivee_integrite"();

-- Départs/actes : protégés dès que la séquence est attribuée (signature).
-- Un brouillon (séquence nulle) reste modifiable, et supprimable par
-- l'application seulement s'il n'a jamais été soumis.
CREATE FUNCTION "courrier_acte_integrite"() RETURNS trigger AS $$
BEGIN
  IF OLD."sequence" IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Registre du courrier : l''acte % est numéroté et ne peut pas être supprimé (annulez-le).', OLD."numero"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."numero" IS DISTINCT FROM OLD."numero"
     OR NEW."sequence" IS DISTINCT FROM OLD."sequence"
     OR NEW."annee" IS DISTINCT FROM OLD."annee"
     OR NEW."registreId" IS DISTINCT FROM OLD."registreId"
     OR NEW."uniteKey" IS DISTINCT FROM OLD."uniteKey" THEN
    RAISE EXCEPTION 'Registre du courrier : la numérotation de l''acte % est figée.', OLD."numero"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "courrier_acte_integrite"
  BEFORE UPDATE OR DELETE ON "actes_courrier"
  FOR EACH ROW EXECUTE FUNCTION "courrier_acte_integrite"();
