-- Retour arrière DÉFINITIF du lot N1 (socle NIMBA : organigramme, agents, rôles fonctionnels).
-- À n'utiliser que pour abandonner N1 : pour un simple retour à la version précédente,
-- redéployer l'ancienne version suffit (le schéma N1 est additif, l'ancienne API l'ignore).
-- Ne touche à AUCUNE donnée antérieure à N1 (comptes, divisions, sections, cellules,
-- habilitations courrier et logistique, congés, tâches...). Perd les données propres à N1 :
-- unités et leur historique, agents, matricules, mouvements, rôles fonctionnels, refus journalisés.
-- Reste en place : la cellule vide « SECDIR » (secrétariat de direction) créée par la reprise, et les
-- traces de la reprise dans le journal d’audit. Une ré-application refait la reprise complète.
-- Contrôlé par la phase 39g de tests/e2e/run_all.sh (schéma identique à celui d’avant N1).
-- Lancement : workflow manuel « Retour arrière d'un lot » (db-retour-arriere.yml), jamais à la main.
BEGIN;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_agentId_fkey";
DROP INDEX IF EXISTS "users_agentId_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "agentId";
DROP TABLE IF EXISTS "acces_refuses";
DROP TABLE IF EXISTS "attributions_roles";
DROP TABLE IF EXISTS "mouvements_agents";
DROP TABLE IF EXISTS "historique_unites";
DROP TABLE IF EXISTS "agents";
DROP TABLE IF EXISTS "unites_organisationnelles";
DROP TYPE IF EXISTS "role_fonctionnel";
DROP TYPE IF EXISTS "statut_agent";
DROP TYPE IF EXISTS "type_unite";
DROP SEQUENCE IF EXISTS "matricule_provisoire_seq";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260929080000_socle_nimba_n1';
COMMIT;
