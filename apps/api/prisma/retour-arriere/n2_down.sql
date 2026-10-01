-- Retour arrière DÉFINITIF du lot N2 (socle NIMBA : journal inaltérable, connexions, paramètres,
-- supervision, aucun compte sans agent en base).
-- À n'utiliser que pour abandonner N2 : pour un simple retour à la version précédente, redéployer
-- l'ancienne version suffit (le schéma N2 est additif ; les déclencheurs restent valables pour N1).
-- Ne touche à AUCUNE donnée antérieure à N2 : les lignes d'audit restent (sans leur scellement),
-- les agents créés par la base restent. Perd : journal des connexions, paramètres modifiés,
-- historique des tâches planifiées, empreintes du journal d'audit.
-- Contrôlé par la phase 39h de tests/e2e/run_all.sh (schéma identique à celui d'avant N2).
-- Lancement : workflow manuel « Retour arrière d'un lot » (db-retour-arriere.yml), jamais à la main.
BEGIN;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_compte_avec_agent";
DROP TRIGGER IF EXISTS "compte_agent_obligatoire" ON "users";
DROP FUNCTION IF EXISTS "compte_agent_obligatoire"();
DROP TRIGGER IF EXISTS "audit_pas_de_vidage" ON "audit_logs";
DROP TRIGGER IF EXISTS "audit_ecriture_seule" ON "audit_logs";
DROP TRIGGER IF EXISTS "audit_avant_insertion" ON "audit_logs";
DROP FUNCTION IF EXISTS "audit_pas_de_vidage"();
DROP FUNCTION IF EXISTS "audit_ecriture_seule"();
DROP FUNCTION IF EXISTS "audit_avant_insertion"();
DROP FUNCTION IF EXISTS "audit_verifier"();
DROP FUNCTION IF EXISTS "audit_sceller"(INTERVAL);
DROP FUNCTION IF EXISTS "audit_empreinte"("audit_logs", INTEGER, TEXT);
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "acteurInitial", DROP COLUMN IF EXISTS "auNomDeInitial",
  DROP COLUMN IF EXISTS "empreinte", DROP COLUMN IF EXISTS "empreintePrecedente",
  DROP COLUMN IF EXISTS "numero", DROP COLUMN IF EXISTS "rang";
DROP TABLE IF EXISTS "journal_connexions";
DROP TABLE IF EXISTS "parametres";
DROP TABLE IF EXISTS "executions_taches";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260929180000_socle_nimba_n2';
COMMIT;
