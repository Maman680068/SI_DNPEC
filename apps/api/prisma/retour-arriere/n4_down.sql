-- Retour arrière DÉFINITIF du lot N4 (statut de diffusion, métadonnées GED, documents générés).
-- À n'utiliser que pour abandonner N4 : pour revenir à la version précédente, redéployer suffit
-- (les colonnes N4 ont des valeurs par défaut, l'ancienne API les ignore). Ordre inverse des lots :
-- N4 avant N3, N2 et N1.
-- Perd : statuts de diffusion et leur journal, type, date et période des documents, lien vers une
-- réunion, ordres de mission, attestations de travail et éditions des documents générés (les actes
-- correspondants restent dans le module Courrier, les documents déposés restent dans la GED).
-- Documents de cellule : le retour arrière est REFUSÉ tant qu'il en existe (la version N3 exige une
-- division pour chaque document) ; les rattacher d'abord à une division ou les supprimer à l'écran.
-- Contrôlé par la phase 39j de tests/e2e/run_all.sh (schéma identique à celui d'avant N4).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "documents" WHERE "celluleId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Retour arrière N4 refusé : % document(s) de cellule existent ; la version N3 exige une division pour chaque document.',
      (SELECT count(*) FROM "documents" WHERE "celluleId" IS NOT NULL);
  END IF;
END $$;
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_unite_productrice";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_celluleId_fkey";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "celluleId";
ALTER TABLE "documents" ALTER COLUMN "divisionId" SET NOT NULL;
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
