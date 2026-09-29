-- Retour arrière DÉFINITIF du lot N3 (circuit des congés à avis, rapport de stage).
-- À n'utiliser que pour abandonner N3 : pour revenir à la version précédente, redéployer suffit
-- (les colonnes N3 sont facultatives, l'ancienne API les ignore). Ordre inverse des lots : N3 avant N2.
-- Perd : avis rendus sur les congés (les décisions du DRH restent : statut, décideur, date),
-- encadreur principal et rapports de stage déposés (les fichiers restent dans le stockage).
-- L'avancement des tâches garde sa dernière valeur calculée (il redevient modifiable à la main).
-- Contrôlé par la phase 39i de tests/e2e/run_all.sh (schéma identique à celui d'avant N3).
BEGIN;
DROP TRIGGER IF EXISTS "tache_avancement_parent" ON "tasks";
DROP TRIGGER IF EXISTS "tache_avancement_calcule" ON "tasks";
DROP FUNCTION IF EXISTS "tache_avancement_parent"();
DROP FUNCTION IF EXISTS "tache_avancement_calcule"();
DROP INDEX IF EXISTS "leave_requests_status_avisEtat_idx";
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "alerteAvisAt", DROP COLUMN IF EXISTS "avisEcheance",
  DROP COLUMN IF EXISTS "avisEtat", DROP COLUMN IF EXISTS "avisLe", DROP COLUMN IF EXISTS "avisMotif",
  DROP COLUMN IF EXISTS "avisParId";
ALTER TABLE "stages" DROP COLUMN IF EXISTS "encadrantPrincipalId", DROP COLUMN IF EXISTS "rapportDeposeLe",
  DROP COLUMN IF EXISTS "rapportFileKey", DROP COLUMN IF EXISTS "rapportFileName", DROP COLUMN IF EXISTS "rapportMotif",
  DROP COLUMN IF EXISTS "rapportStatut", DROP COLUMN IF EXISTS "rapportValideLe", DROP COLUMN IF EXISTS "rapportValideParId";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260930080000_socle_nimba_n3';
COMMIT;
