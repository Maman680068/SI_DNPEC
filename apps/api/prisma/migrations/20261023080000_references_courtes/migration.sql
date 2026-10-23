-- Lot « références courtes » : numéro stable des tâches (« T-418 », séquence globale) et des activités du
-- plan de travail (« A-07 », unique dans l'année du plan). Migration additive : trois colonnes ajoutées,
-- remplies pour les lignes existantes dans l'ordre de création ; aucune autre donnée modifiée.
-- Retour arrière : prisma/retour-arriere/ref_down.sql (phase 39o de tests/e2e/run_all.sh).

-- AlterTable : tâches (la séquence attribue un numéro à chaque nouvelle tâche, quel que soit le module).
ALTER TABLE "tasks" ADD COLUMN "numero" SERIAL NOT NULL;
UPDATE "tasks" t SET "numero" = r.n
  FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "tasks") r
  WHERE r."id" = t."id";
SELECT setval(pg_get_serial_sequence('"tasks"', 'numero'), COALESCE((SELECT max("numero") FROM "tasks"), 0) + 1, false);

-- AlterTable : activités (année recopiée de l'objectif, numéro par année).
ALTER TABLE "activites" ADD COLUMN "annee" INTEGER, ADD COLUMN "numero" INTEGER;
UPDATE "activites" a SET "annee" = o."annee" FROM "objectifs" o WHERE o."id" = a."objectifId";
UPDATE "activites" a SET "numero" = r.n
  FROM (SELECT "id", row_number() OVER (PARTITION BY "annee" ORDER BY "createdAt", "id") AS n FROM "activites") r
  WHERE r."id" = a."id";
ALTER TABLE "activites" ALTER COLUMN "annee" SET NOT NULL, ALTER COLUMN "numero" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_numero_key" ON "tasks"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "activites_annee_numero_key" ON "activites"("annee", "numero");
