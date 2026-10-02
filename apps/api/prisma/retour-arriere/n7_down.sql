-- Retour arrière DÉFINITIF du lot n7 : nomination à un poste de responsabilité (changement de rôle
-- pré-rempli à la signature d'un acte de nomination). Pour revenir à la version précédente,
-- redéployer suffit (table ignorée par l'ancienne version).
-- À jouer AVANT n6_down.sql (la table référence les mouvements de carrière de N6).
-- Perd : les changements de rôle en attente, confirmés ou refusés (les changements de rôle déjà
-- appliqués restent sur les comptes et dans le journal d'audit).
-- Contrôlé par la phase 39m de tests/e2e/run_all.sh (schéma identique à celui d'avant).
BEGIN;
DROP TABLE IF EXISTS "changements_role_nomination";
DROP TYPE IF EXISTS "statut_changement_role";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261004080000_socle_nimba_n7';
COMMIT;
