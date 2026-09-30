-- Retour arrière DÉFINITIF du lot N4 (statut de diffusion, métadonnées GED, documents générés).
-- À n'utiliser que pour abandonner N4 : pour revenir à la version précédente, redéployer suffit
-- (les colonnes N4 ont des valeurs par défaut, l'ancienne API les ignore). Ordre inverse des lots :
-- N4 avant N3, N2 et N1.
-- Perd : statuts de diffusion et leur journal, type, date et période des documents, lien vers une
-- réunion, ordres de mission, attestations de travail et éditions des documents générés (les actes
-- correspondants restent dans le module Courrier, les documents déposés restent dans la GED).
-- Contrôlé par la phase 39j de tests/e2e/run_all.sh (schéma identique à celui d'avant N4).
BEGIN;
DROP TABLE IF EXISTS "attestations_travail";
DROP TABLE IF EXISTS "documents_generes";
DROP TABLE IF EXISTS "ordres_mission";
DROP TABLE IF EXISTS "changements_statut";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_sourceMeetingId_fkey";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "dateDocument", DROP COLUMN IF EXISTS "periodeDebut",
  DROP COLUMN IF EXISTS "periodeFin", DROP COLUMN IF EXISTS "sourceMeetingId",
  DROP COLUMN IF EXISTS "statutDiffusion", DROP COLUMN IF EXISTS "typeDocument";
DROP TYPE IF EXISTS "type_document";
DROP TYPE IF EXISTS "statut_diffusion";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261001080000_socle_nimba_n4';
COMMIT;
