-- Retour arrière DÉFINITIF du lot « rattachement des cellules » (S8).
-- Pour revenir à la version précédente, redéployer suffit (colonnes ignorées par l'ancienne version).
-- À jouer AVANT demandes_reunion_down.sql (lot antérieur).
-- Perd : le rattachement (DN ou DNA) et la nature des cellules. Les cellules elles-mêmes sont conservées.
-- Contrôlé par la phase 39r de tests/e2e/run_all.sh (schéma identique à celui d'avant).
BEGIN;
ALTER TABLE "cellules" DROP CONSTRAINT IF EXISTS "cellules_rattachement";
ALTER TABLE "cellules" DROP CONSTRAINT IF EXISTS "cellules_nature";
ALTER TABLE "cellules" DROP COLUMN IF EXISTS "rattachement";
ALTER TABLE "cellules" DROP COLUMN IF EXISTS "nature";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261102080000_rattachement_cellules';
COMMIT;
