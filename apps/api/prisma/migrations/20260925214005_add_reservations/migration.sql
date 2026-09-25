-- CreateEnum
CREATE TYPE "type_ressource" AS ENUM ('SALLE', 'MATERIEL_PRESENTATION');

-- CreateEnum
CREATE TYPE "mode_reservation" AS ENUM ('IMMEDIATE', 'VALIDATION');

-- CreateEnum
CREATE TYPE "statut_reservation" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'REFUSEE', 'ANNULEE', 'ANNULEE_PRIORITE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'RESERVATION_A_VALIDER';
ALTER TYPE "notification_type" ADD VALUE 'RESERVATION_CONFIRMEE';
ALTER TYPE "notification_type" ADD VALUE 'RESERVATION_REFUSEE';
ALTER TYPE "notification_type" ADD VALUE 'RESERVATION_ANNULEE';
ALTER TYPE "notification_type" ADD VALUE 'RESERVATION_ANNULEE_PRIORITE';

-- CreateTable
CREATE TABLE "ressources_reservables" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "type_ressource" NOT NULL,
    "description" TEXT,
    "capacite" INTEGER,
    "mode" "mode_reservation" NOT NULL DEFAULT 'IMMEDIATE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ressources_reservables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "ressourceId" TEXT NOT NULL,
    "titulaireId" TEXT NOT NULL,
    "creeeParId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "objet" TEXT NOT NULL,
    "meetingId" TEXT,
    "statut" "statut_reservation" NOT NULL,
    "prioritaire" BOOLEAN NOT NULL DEFAULT false,
    "decideeParId" TEXT,
    "decideeAt" TIMESTAMP(3),
    "motifRefus" TEXT,
    "annuleeParId" TEXT,
    "annuleeAt" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "evinceeParId" TEXT,
    "remplaceeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ressources_reservables_nom_key" ON "ressources_reservables"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_meetingId_key" ON "reservations"("meetingId");

-- CreateIndex
CREATE INDEX "reservations_ressourceId_debut_idx" ON "reservations"("ressourceId", "debut");

-- CreateIndex
CREATE INDEX "reservations_titulaireId_idx" ON "reservations"("titulaireId");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "ressources_reservables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_titulaireId_fkey" FOREIGN KEY ("titulaireId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_creeeParId_fkey" FOREIGN KEY ("creeeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_decideeParId_fkey" FOREIGN KEY ("decideeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_annuleeParId_fkey" FOREIGN KEY ("annuleeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_evinceeParId_fkey" FOREIGN KEY ("evinceeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_remplaceeParId_fkey" FOREIGN KEY ("remplaceeParId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Réservations (D9) : filet de sécurité SOUS les règles applicatives.
-- ============================================================================

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_creneau_valide" CHECK ("debut" < "fin");
ALTER TABLE "ressources_reservables" ADD CONSTRAINT "ressources_capacite_positive" CHECK ("capacite" IS NULL OR "capacite" > 0);

-- Aucun chevauchement entre réservations actives d'une même ressource. Le
-- verrou de ligne sur la ressource sérialise les écritures concurrentes
-- (même rôle qu'une contrainte d'exclusion, sans extension btree_gist).
CREATE FUNCTION "reservation_sans_chevauchement"() RETURNS trigger AS $$
BEGIN
  IF NEW."statut" IN ('EN_ATTENTE', 'CONFIRMEE') THEN
    PERFORM 1 FROM "ressources_reservables" WHERE "id" = NEW."ressourceId" FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM "reservations" r
      WHERE r."ressourceId" = NEW."ressourceId"
        AND r."id" <> NEW."id"
        AND r."statut" IN ('EN_ATTENTE', 'CONFIRMEE')
        AND r."debut" < NEW."fin"
        AND NEW."debut" < r."fin"
    ) THEN
      RAISE EXCEPTION 'Réservations : le créneau chevauche une réservation active de la même ressource.'
        USING ERRCODE = 'exclusion_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reservation_sans_chevauchement"
  BEFORE INSERT OR UPDATE ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION "reservation_sans_chevauchement"();

-- Une réservation n'est jamais supprimée (historique des évictions et annulations).
CREATE FUNCTION "reservation_jamais_supprimee"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Réservations : une réservation ne peut pas être supprimée (annulez-la).'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reservation_jamais_supprimee"
  BEFORE DELETE ON "reservations"
  FOR EACH ROW EXECUTE FUNCTION "reservation_jamais_supprimee"();
