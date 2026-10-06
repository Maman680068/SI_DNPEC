-- Retour arrière DÉFINITIF du lot B1 (domaine B) : référentiel des modèles et dépôt par paquet.
-- Pour revenir à la version précédente, redéployer suffit (tables ignorées par l'ancienne version).
-- À jouer AVANT n7_down.sql (lot postérieur).
-- Perd : les modèles, leurs versions (les fichiers des paquets restent sur le disque, sans référence),
-- les rôles de modélisation et la file de travaux du service de calcul. Le journal d'audit est conservé.
-- Contrôlé par la phase 39n de tests/e2e/run_all.sh (schéma identique à celui d'avant).
BEGIN;
DROP TABLE IF EXISTS "travaux_calcul";
DROP TABLE IF EXISTS "affectations_modelisation";
DROP TABLE IF EXISTS "versions_modele";
DROP TABLE IF EXISTS "modeles";
DROP FUNCTION IF EXISTS "versions_modele_garde"();
DROP FUNCTION IF EXISTS "affectations_modelisation_garde"();
DROP TYPE IF EXISTS "statut_travail_calcul";
DROP TYPE IF EXISTS "type_travail_calcul";
DROP TYPE IF EXISTS "role_modelisation";
DROP TYPE IF EXISTS "statut_version_modele";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261006080000_domaine_b_b1';
COMMIT;
