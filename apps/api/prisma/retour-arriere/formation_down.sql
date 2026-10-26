-- Retour arrière DÉFINITIF du lot « plan de formation individuel » (sessions de formation par agent).
-- Pour revenir à la version précédente, redéployer suffit (table ignorée par l'ancienne version).
-- À jouer AVANT ref_down.sql (lot antérieur).
-- Perd : les sessions de formation. Les besoins de formation et le journal d'audit sont conservés.
-- Contrôlé par la phase 39p de tests/e2e/run_all.sh (schéma identique à celui d'avant).
BEGIN;
DROP TABLE IF EXISTS "sessions_formation";
DROP TYPE IF EXISTS "etat_session_formation";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261024080000_plan_formation';
COMMIT;
