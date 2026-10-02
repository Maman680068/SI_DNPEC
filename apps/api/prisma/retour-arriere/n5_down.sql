-- Retour arrière DÉFINITIF du lot N5 (plan de travail, messagerie en fils, notifications regroupées,
-- instructions de la Direction). À n'utiliser que pour abandonner N5 : pour revenir à la version
-- précédente, redéployer suffit (l'ancienne API ignore les colonnes et tables de N5). Ordre inverse des
-- lots : N5 avant N4, N3, N2 et N1.
-- Perd : objectifs, activités et lien des tâches vers une activité, fils de discussion et accusés de
-- lecture, préférences de notification, instructions. Les emails encore en attente du résumé quotidien
-- ne partiront pas (leur notification dans l'application reste).
-- Contrôlé par la phase 39k de tests/e2e/run_all.sh (schéma identique à celui d'avant N5).
BEGIN;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_activiteId_fkey";
DROP TABLE IF EXISTS "instructions";
DROP TABLE IF EXISTS "preferences_notification";
DROP TABLE IF EXISTS "lectures_message";
DROP TABLE IF EXISTS "messages_fil";
DROP TABLE IF EXISTS "participants_fil";
DROP TABLE IF EXISTS "fils_messages";
DROP TABLE IF EXISTS "activites";
DROP TABLE IF EXISTS "objectifs";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "activiteId", DROP COLUMN IF EXISTS "alerteRetardAt", DROP COLUMN IF EXISTS "alerteVeilleAt";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "aEnvoyerLe";
DROP TYPE IF EXISTS "statut_instruction";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261002080000_socle_nimba_n5';
COMMIT;
