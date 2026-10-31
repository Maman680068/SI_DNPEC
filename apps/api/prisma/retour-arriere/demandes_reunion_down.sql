-- Retour arrière DÉFINITIF du lot « demandes de réunion » (S1).
-- Pour revenir à la version précédente, redéployer suffit (tables ignorées par l'ancienne version).
-- À jouer AVANT formation_down.sql (lot antérieur).
-- Perd : les demandes de réunion et leur historique. Les réunions créées restent (elles perdent seulement
-- la mention « Validée par … »).
-- Contrôlé par la phase 39q de tests/e2e/run_all.sh (schéma identique à celui d'avant).
BEGIN;
DROP TABLE IF EXISTS "etapes_demande_reunion";
DROP TABLE IF EXISTS "demandes_reunion";
DROP TYPE IF EXISTS "etat_demande_reunion";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261101080000_demandes_reunion';
COMMIT;
