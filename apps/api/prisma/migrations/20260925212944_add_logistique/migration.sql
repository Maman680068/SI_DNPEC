-- CreateEnum
CREATE TYPE "nature_categorie_logistique" AS ENUM ('BIEN', 'FOURNITURE');

-- CreateEnum
CREATE TYPE "etat_bien" AS ENUM ('EN_SERVICE', 'EN_PANNE', 'EN_REPARATION', 'REFORME');

-- CreateEnum
CREATE TYPE "type_mouvement_bien" AS ENUM ('ACQUISITION', 'AFFECTATION', 'RETOUR', 'CHANGEMENT_ETAT', 'MODIFICATION', 'INTERVENTION');

-- CreateEnum
CREATE TYPE "type_mouvement_stock" AS ENUM ('ENTREE', 'SORTIE');

-- CreateEnum
CREATE TYPE "type_demande_logistique" AS ENUM ('FOURNITURE', 'MATERIEL', 'INTERVENTION');

-- CreateEnum
CREATE TYPE "statut_demande_logistique" AS ENUM ('A_VALIDER', 'A_TRAITER', 'EN_TRAITEMENT', 'TRAITEE', 'REFUSEE', 'ANNULEE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'LOGISTIQUE_DEMANDE_A_VALIDER';
ALTER TYPE "notification_type" ADD VALUE 'LOGISTIQUE_DEMANDE_A_TRAITER';
ALTER TYPE "notification_type" ADD VALUE 'LOGISTIQUE_DEMANDE_TRAITEE';
ALTER TYPE "notification_type" ADD VALUE 'LOGISTIQUE_DEMANDE_REFUSEE';
ALTER TYPE "notification_type" ADD VALUE 'LOGISTIQUE_STOCK_BAS';
ALTER TYPE "notification_type" ADD VALUE 'BIEN_A_RECUPERER';

-- CreateTable
CREATE TABLE "habilitations_logistique" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accordeeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueeAt" TIMESTAMP(3),
    "revoqueeParId" TEXT,

    CONSTRAINT "habilitations_logistique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories_logistique" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "nature" "nature_categorie_logistique" NOT NULL,
    "validationChefRequise" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_logistique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteurs_inventaire" (
    "categorieId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dernier" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compteurs_inventaire_pkey" PRIMARY KEY ("categorieId","annee")
);

-- CreateTable
CREATE TABLE "biens" (
    "id" TEXT NOT NULL,
    "numeroInventaire" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "marque" TEXT,
    "numeroSerie" TEXT,
    "emplacement" TEXT,
    "dateAcquisition" TIMESTAMP(3),
    "etat" "etat_bien" NOT NULL DEFAULT 'EN_SERVICE',
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_bien" (
    "id" TEXT NOT NULL,
    "bienId" TEXT NOT NULL,
    "userId" TEXT,
    "divisionId" TEXT,
    "sectionId" TEXT,
    "celluleId" TEXT,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "faiteParId" TEXT NOT NULL,
    "alerteDepartAt" TIMESTAMP(3),

    CONSTRAINT "affectations_bien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_bien" (
    "id" TEXT NOT NULL,
    "bienId" TEXT NOT NULL,
    "type" "type_mouvement_bien" NOT NULL,
    "detail" JSONB NOT NULL,
    "parId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_bien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles_fourniture" (
    "id" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'unité',
    "suiviStock" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER,
    "alerteStockAt" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_fourniture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "type_mouvement_stock" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "stockApres" INTEGER NOT NULL,
    "motif" TEXT,
    "demandeId" TEXT,
    "parId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_logistique" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "type" "type_demande_logistique" NOT NULL,
    "categorieId" TEXT NOT NULL,
    "articleId" TEXT,
    "bienId" TEXT,
    "quantite" INTEGER,
    "objet" TEXT NOT NULL,
    "justification" TEXT,
    "validationChef" BOOLEAN NOT NULL,
    "statut" "statut_demande_logistique" NOT NULL,
    "valideeParId" TEXT,
    "valideeAt" TIMESTAMP(3),
    "traiteeParId" TEXT,
    "priseEnChargeAt" TIMESTAMP(3),
    "traiteeAt" TIMESTAMP(3),
    "quantiteLivree" INTEGER,
    "compteRendu" TEXT,
    "refuseeParId" TEXT,
    "refuseeAt" TIMESTAMP(3),
    "motifRefus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_logistique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "habilitations_logistique_userId_idx" ON "habilitations_logistique"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_logistique_code_key" ON "categories_logistique"("code");

-- CreateIndex
CREATE UNIQUE INDEX "biens_numeroInventaire_key" ON "biens"("numeroInventaire");

-- CreateIndex
CREATE UNIQUE INDEX "biens_categorieId_annee_sequence_key" ON "biens"("categorieId", "annee", "sequence");

-- CreateIndex
CREATE INDEX "affectations_bien_bienId_idx" ON "affectations_bien"("bienId");

-- CreateIndex
CREATE INDEX "affectations_bien_userId_idx" ON "affectations_bien"("userId");

-- CreateIndex
CREATE INDEX "mouvements_bien_bienId_createdAt_idx" ON "mouvements_bien"("bienId", "createdAt");

-- CreateIndex
CREATE INDEX "mouvements_stock_articleId_createdAt_idx" ON "mouvements_stock"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "demandes_logistique_demandeurId_idx" ON "demandes_logistique"("demandeurId");

-- CreateIndex
CREATE INDEX "demandes_logistique_statut_idx" ON "demandes_logistique"("statut");

-- AddForeignKey
ALTER TABLE "habilitations_logistique" ADD CONSTRAINT "habilitations_logistique_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitations_logistique" ADD CONSTRAINT "habilitations_logistique_accordeeParId_fkey" FOREIGN KEY ("accordeeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habilitations_logistique" ADD CONSTRAINT "habilitations_logistique_revoqueeParId_fkey" FOREIGN KEY ("revoqueeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteurs_inventaire" ADD CONSTRAINT "compteurs_inventaire_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_logistique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biens" ADD CONSTRAINT "biens_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_logistique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biens" ADD CONSTRAINT "biens_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "biens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_celluleId_fkey" FOREIGN KEY ("celluleId") REFERENCES "cellules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_faiteParId_fkey" FOREIGN KEY ("faiteParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_bien" ADD CONSTRAINT "mouvements_bien_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "biens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_bien" ADD CONSTRAINT "mouvements_bien_parId_fkey" FOREIGN KEY ("parId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles_fourniture" ADD CONSTRAINT "articles_fourniture_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_logistique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_fourniture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_logistique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_parId_fkey" FOREIGN KEY ("parId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_logistique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_fourniture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "biens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_valideeParId_fkey" FOREIGN KEY ("valideeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_traiteeParId_fkey" FOREIGN KEY ("traiteeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_refuseeParId_fkey" FOREIGN KEY ("refuseeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Intégrité de la logistique (D9) — filet de sécurité SOUS les règles
-- applicatives, comme pour le registre du courrier.
-- ============================================================================

-- Stock jamais négatif (décision D9-5) ; quantités strictement positives.
ALTER TABLE "articles_fourniture" ADD CONSTRAINT "articles_fourniture_stock_positif" CHECK ("stock" >= 0);
ALTER TABLE "articles_fourniture" ADD CONSTRAINT "articles_fourniture_seuil_positif" CHECK ("seuilAlerte" IS NULL OR "seuilAlerte" >= 0);
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_quantite_positive" CHECK ("quantite" > 0 AND "stockApres" >= 0);
ALTER TABLE "demandes_logistique" ADD CONSTRAINT "demandes_logistique_quantites_positives"
  CHECK (("quantite" IS NULL OR "quantite" > 0) AND ("quantiteLivree" IS NULL OR "quantiteLivree" >= 0));

-- Au plus une affectation en cours par bien ; une affectation vise une
-- personne OU une unité.
CREATE UNIQUE INDEX "affectations_bien_une_ouverte" ON "affectations_bien" ("bienId") WHERE "fin" IS NULL;
ALTER TABLE "affectations_bien" ADD CONSTRAINT "affectations_bien_une_cible"
  CHECK (("userId" IS NOT NULL) <> ("divisionId" IS NOT NULL OR "celluleId" IS NOT NULL));

-- Biens : jamais supprimés, numéro d'inventaire figé (ni trou ni renumérotation).
CREATE FUNCTION "bien_integrite"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Inventaire : le bien % ne peut pas être supprimé (réformez-le).', OLD."numeroInventaire"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."numeroInventaire" IS DISTINCT FROM OLD."numeroInventaire"
     OR NEW."sequence" IS DISTINCT FROM OLD."sequence"
     OR NEW."annee" IS DISTINCT FROM OLD."annee"
     OR NEW."categorieId" IS DISTINCT FROM OLD."categorieId" THEN
    RAISE EXCEPTION 'Inventaire : le numéro du bien % est figé.', OLD."numeroInventaire"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bien_integrite"
  BEFORE UPDATE OR DELETE ON "biens"
  FOR EACH ROW EXECUTE FUNCTION "bien_integrite"();

-- Historiques : ajout seul (jamais modifiés ni supprimés).
CREATE FUNCTION "logistique_historique_ajout_seul"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Logistique : l''historique (%) est en ajout seul.', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mouvements_bien_ajout_seul"
  BEFORE UPDATE OR DELETE ON "mouvements_bien"
  FOR EACH ROW EXECUTE FUNCTION "logistique_historique_ajout_seul"();

CREATE TRIGGER "mouvements_stock_ajout_seul"
  BEFORE UPDATE OR DELETE ON "mouvements_stock"
  FOR EACH ROW EXECUTE FUNCTION "logistique_historique_ajout_seul"();

-- Affectations : jamais supprimées ; seule la clôture (fin) et l'alerte de
-- départ peuvent être posées, une seule fois.
CREATE FUNCTION "affectation_bien_integrite"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Inventaire : une affectation ne peut pas être supprimée.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."bienId" IS DISTINCT FROM OLD."bienId"
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."divisionId" IS DISTINCT FROM OLD."divisionId"
     OR NEW."sectionId" IS DISTINCT FROM OLD."sectionId"
     OR NEW."celluleId" IS DISTINCT FROM OLD."celluleId"
     OR NEW."debut" IS DISTINCT FROM OLD."debut"
     OR NEW."faiteParId" IS DISTINCT FROM OLD."faiteParId"
     OR (OLD."fin" IS NOT NULL AND NEW."fin" IS DISTINCT FROM OLD."fin") THEN
    RAISE EXCEPTION 'Inventaire : une affectation est figée (seule sa clôture peut être enregistrée).'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "affectation_bien_integrite"
  BEFORE UPDATE OR DELETE ON "affectations_bien"
  FOR EACH ROW EXECUTE FUNCTION "affectation_bien_integrite"();
