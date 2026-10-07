-- Domaine B, lot B1 — référentiel des modèles et dépôt par paquet (format « dnpec-modele/1 »).
-- Migration additive : quatre types et quatre tables nouvelles, aucune table existante modifiée.
-- Les tables nouvelles désignent les comptes par leur identifiant (jamais l'inverse).
-- Retour arrière : prisma/retour-arriere/b1_down.sql (phase 39n de tests/e2e/run_all.sh).

-- CreateEnum
CREATE TYPE "statut_version_modele" AS ENUM ('DEPOSEE', 'CONTROLEE', 'EN_ATTENTE', 'ACTIVE', 'REFUSEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "role_modelisation" AS ENUM ('ANALYSTE', 'RESPONSABLE', 'SUPPLEANT');

-- CreateEnum
CREATE TYPE "type_travail_calcul" AS ENUM ('VERIFICATION', 'EXECUTION');

-- CreateEnum
CREATE TYPE "statut_travail_calcul" AS ENUM ('EN_FILE', 'EN_COURS', 'TERMINE', 'ECHEC');

-- CreateTable
CREATE TABLE "modeles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "famille" TEXT NOT NULL,
    "familleLibelle" TEXT,
    "description" TEXT,
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modeles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions_modele" (
    "id" TEXT NOT NULL,
    "modeleId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "empreinte" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "fiche" JSONB NOT NULL,
    "statut" "statut_version_modele" NOT NULL DEFAULT 'DEPOSEE',
    "controles" JSONB,
    "controleLe" TIMESTAMP(3),
    "manettes" JSONB NOT NULL,
    "compteurs" JSONB NOT NULL,
    "derogations" JSONB NOT NULL DEFAULT '[]',
    "avecDerogation" BOOLEAN NOT NULL DEFAULT false,
    "donneesConfirmees" BOOLEAN NOT NULL,
    "auteurId" TEXT NOT NULL,
    "envoyeParId" TEXT,
    "envoyeLe" TIMESTAMP(3),
    "approbateurId" TEXT,
    "approuveLe" TIMESTAMP(3),
    "refuseParId" TEXT,
    "refuseLe" TIMESTAMP(3),
    "motifRefus" TEXT,
    "activeLe" TIMESTAMP(3),
    "archiveLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "versions_modele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_modelisation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "role_modelisation" NOT NULL,
    "modeleId" TEXT,
    "attribueParId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "finParId" TEXT,
    "motifFin" TEXT,

    CONSTRAINT "affectations_modelisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travaux_calcul" (
    "id" TEXT NOT NULL,
    "type" "type_travail_calcul" NOT NULL,
    "statut" "statut_travail_calcul" NOT NULL DEFAULT 'EN_FILE',
    "etape" TEXT,
    "versionId" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "scenario" JSONB,
    "resultat" JSONB,
    "message" TEXT,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "prochaineTentativeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enFileLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "debuteLe" TIMESTAMP(3),
    "termineLe" TIMESTAMP(3),
    "dureeMs" INTEGER,

    CONSTRAINT "travaux_calcul_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modeles_code_key" ON "modeles"("code");

-- CreateIndex
CREATE INDEX "versions_modele_statut_idx" ON "versions_modele"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "versions_modele_modeleId_numero_key" ON "versions_modele"("modeleId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "versions_modele_modeleId_empreinte_key" ON "versions_modele"("modeleId", "empreinte");

-- CreateIndex
CREATE INDEX "affectations_modelisation_userId_idx" ON "affectations_modelisation"("userId");

-- CreateIndex
CREATE INDEX "affectations_modelisation_modeleId_idx" ON "affectations_modelisation"("modeleId");

-- CreateIndex
CREATE INDEX "travaux_calcul_statut_prochaineTentativeLe_idx" ON "travaux_calcul"("statut", "prochaineTentativeLe");

-- CreateIndex
CREATE INDEX "travaux_calcul_versionId_idx" ON "travaux_calcul"("versionId");

-- AddForeignKey
ALTER TABLE "versions_modele" ADD CONSTRAINT "versions_modele_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "modeles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_modelisation" ADD CONSTRAINT "affectations_modelisation_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "modeles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travaux_calcul" ADD CONSTRAINT "travaux_calcul_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "versions_modele"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Garde-fous en base (ajoutés à la main : Prisma ne les décrit pas).
-- ---------------------------------------------------------------------------------------------

-- Une seule version active par modèle ; les anciennes restent consultables (ARCHIVEE).
CREATE UNIQUE INDEX "versions_modele_une_active" ON "versions_modele" ("modeleId") WHERE "statut" = 'ACTIVE';

-- Personne ne valide ni n'active son propre travail ; une version active a toujours un approbateur.
ALTER TABLE "versions_modele" ADD CONSTRAINT "versions_modele_approbateur_pas_auteur" CHECK ("approbateurId" IS NULL OR "approbateurId" <> "auteurId");
ALTER TABLE "versions_modele" ADD CONSTRAINT "versions_modele_active_approuvee" CHECK ("statut" NOT IN ('ACTIVE', 'ARCHIVEE') OR "approbateurId" IS NOT NULL);
ALTER TABLE "versions_modele" ADD CONSTRAINT "versions_modele_empreinte_sha256" CHECK ("empreinte" ~ '^[0-9a-f]{64}$');
ALTER TABLE "versions_modele" ADD CONSTRAINT "versions_modele_donnees_confirmees" CHECK ("donneesConfirmees");

-- Version déposée immuable (empreinte SHA-256) : seuls l'état, les contrôles (avant envoi), le réglage
-- des manettes (avant envoi) et les dérogations évoluent ; aucune suppression.
CREATE FUNCTION "versions_modele_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Seul le mode « supprimer » de la démonstration (modèles « TEST_… ») lève ce verrou, dans sa transaction.
    IF current_setting('dnpec.suppression_demonstration', true) = 'oui' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Une version de modèle déposée ne se supprime jamais.';
  END IF;
  IF NEW."modeleId" IS DISTINCT FROM OLD."modeleId" OR NEW."numero" IS DISTINCT FROM OLD."numero"
     OR NEW."empreinte" IS DISTINCT FROM OLD."empreinte" OR NEW."fileKey" IS DISTINCT FROM OLD."fileKey"
     OR NEW."nomFichier" IS DISTINCT FROM OLD."nomFichier" OR NEW."tailleOctets" IS DISTINCT FROM OLD."tailleOctets"
     OR NEW."fiche" IS DISTINCT FROM OLD."fiche" OR NEW."auteurId" IS DISTINCT FROM OLD."auteurId"
     OR NEW."donneesConfirmees" IS DISTINCT FROM OLD."donneesConfirmees" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Une version déposée est immuable : déposez une nouvelle version.';
  END IF;
  IF (NEW."manettes" IS DISTINCT FROM OLD."manettes" OR NEW."compteurs" IS DISTINCT FROM OLD."compteurs")
     AND OLD."statut" NOT IN ('DEPOSEE', 'CONTROLEE') THEN
    RAISE EXCEPTION 'Les manettes et les compteurs ne se modifient plus après l''envoi au responsable.';
  END IF;
  IF NEW."controles" IS DISTINCT FROM OLD."controles" AND OLD."statut" <> 'DEPOSEE' THEN
    RAISE EXCEPTION 'Les contrôles d''une version vérifiée ne se modifient plus.';
  END IF;
  IF jsonb_array_length(NEW."derogations") < jsonb_array_length(OLD."derogations") THEN
    RAISE EXCEPTION 'Une dérogation ne s''efface pas.';
  END IF;
  IF OLD."avecDerogation" AND NOT NEW."avecDerogation" THEN
    RAISE EXCEPTION 'La mention « activée avec dérogation » est définitive.';
  END IF;
  IF OLD."statut" IN ('REFUSEE', 'ARCHIVEE') AND NEW."statut" <> OLD."statut" THEN
    RAISE EXCEPTION 'Une version refusée ou archivée ne change plus d''état.';
  END IF;
  IF OLD."statut" = 'ACTIVE' AND NEW."statut" NOT IN ('ACTIVE', 'ARCHIVEE') THEN
    RAISE EXCEPTION 'Une version active ne peut qu''être archivée (remplacée par une autre).';
  END IF;
  IF NEW."statut" = 'ACTIVE' AND OLD."statut" <> 'ACTIVE' AND OLD."statut" <> 'EN_ATTENTE' THEN
    RAISE EXCEPTION 'Seule une version en attente d''approbation peut être activée.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "versions_modele_garde" BEFORE UPDATE OR DELETE ON "versions_modele"
  FOR EACH ROW EXECUTE FUNCTION "versions_modele_garde"();

-- Rôles de modélisation : un analyste n'a pas de modèle, un responsable ou suppléant en a un ;
-- une seule affectation ouverte par personne (analyste) ou par modèle (responsable, suppléant).
ALTER TABLE "affectations_modelisation" ADD CONSTRAINT "affectations_modelisation_modele_selon_role" CHECK (("role" = 'ANALYSTE') = ("modeleId" IS NULL));
ALTER TABLE "affectations_modelisation" ADD CONSTRAINT "affectations_modelisation_motif" CHECK (length(btrim("motif")) > 0);
CREATE UNIQUE INDEX "affectations_modelisation_analyste_ouverte" ON "affectations_modelisation" ("userId") WHERE "role" = 'ANALYSTE' AND "fin" IS NULL;
CREATE UNIQUE INDEX "affectations_modelisation_responsable_ouvert" ON "affectations_modelisation" ("modeleId") WHERE "role" = 'RESPONSABLE' AND "fin" IS NULL;
CREATE UNIQUE INDEX "affectations_modelisation_suppleant_ouvert" ON "affectations_modelisation" ("modeleId") WHERE "role" = 'SUPPLEANT' AND "fin" IS NULL;

-- Historique des rôles : une affectation se clôt (fin datée et motivée), ne se modifie ni ne se supprime.
CREATE FUNCTION "affectations_modelisation_garde"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('dnpec.suppression_demonstration', true) = 'oui' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Une affectation de modélisation ne se supprime pas : elle se clôt.';
  END IF;
  IF OLD."fin" IS NOT NULL OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."role" IS DISTINCT FROM OLD."role"
     OR NEW."modeleId" IS DISTINCT FROM OLD."modeleId" OR NEW."attribueParId" IS DISTINCT FROM OLD."attribueParId"
     OR NEW."motif" IS DISTINCT FROM OLD."motif" OR NEW."debut" IS DISTINCT FROM OLD."debut" THEN
    RAISE EXCEPTION 'Une affectation de modélisation ne se modifie pas : elle se clôt.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "affectations_modelisation_garde" BEFORE UPDATE OR DELETE ON "affectations_modelisation"
  FOR EACH ROW EXECUTE FUNCTION "affectations_modelisation_garde"();
