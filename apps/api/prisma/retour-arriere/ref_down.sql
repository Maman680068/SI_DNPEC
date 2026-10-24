-- Retour arrière DÉFINITIF du lot « références courtes » (numéros « T-418 » des tâches, « A-07 » des activités).
-- Pour revenir à la version précédente, redéployer suffit (colonnes ignorées par l'ancienne version).
-- À jouer AVANT b1_down.sql (lot postérieur).
-- Perd : les numéros attribués (une ré-application les recalcule dans l'ordre de création, mais les tâches
-- créées entre-temps reçoivent alors d'autres numéros). Aucune autre donnée n'est touchée.
-- Contrôlé par la phase 39o de tests/e2e/run_all.sh (schéma identique à celui d'avant).
BEGIN;
DROP INDEX IF EXISTS "activites_annee_numero_key";
DROP INDEX IF EXISTS "tasks_numero_key";
ALTER TABLE "activites" DROP COLUMN IF EXISTS "numero", DROP COLUMN IF EXISTS "annee";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "numero";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261023080000_references_courtes';
COMMIT;
