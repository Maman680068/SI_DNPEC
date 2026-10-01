-- Socle NIMBA, lot N3 : circuit des congés (avis du chef d'unité, échéance en heures ouvrées, alerte,
-- décision du DRH) et rapport de stage (encadreur principal). Additive : colonnes facultatives seulement.
-- Jours fériés (calendrier saisi à l'écran) et certificat médical d'un congé maladie.
-- Reprise : faite par l'API (échéance d'avis posée pour les demandes en attente au démarrage) ;
-- fêtes fixes nationales de 2026 et 2027 pré-remplies (modifiables et supprimables à l'écran).
-- Retour arrière : prisma/retour-arriere/n3_down.sql.

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "alerteAvisAt" TIMESTAMP(3),
ADD COLUMN     "avisEcheance" TIMESTAMP(3),
ADD COLUMN     "avisEtat" TEXT,
ADD COLUMN     "avisLe" TIMESTAMP(3),
ADD COLUMN     "avisMotif" TEXT,
ADD COLUMN     "avisParId" TEXT;

-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "encadrantPrincipalId" TEXT,
ADD COLUMN     "rapportDeposeLe" TIMESTAMP(3),
ADD COLUMN     "rapportFileKey" TEXT,
ADD COLUMN     "rapportFileName" TEXT,
ADD COLUMN     "rapportMotif" TEXT,
ADD COLUMN     "rapportStatut" TEXT,
ADD COLUMN     "rapportValideLe" TIMESTAMP(3),
ADD COLUMN     "rapportValideParId" TEXT;

-- CreateIndex
CREATE INDEX "leave_requests_status_avisEtat_idx" ON "leave_requests"("status", "avisEtat");


-- Avancement des tâches toujours calculé (SIG-RF-TAC-04) : proportion de sous-tâches terminées s'il y
-- en a, sinon selon le statut. Tenu par la base, quel que soit le chemin d'écriture.
CREATE FUNCTION "tache_avancement_calcule"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total INTEGER; faites INTEGER;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE "status" = 'TERMINEE') INTO total, faites FROM "tasks" WHERE "parentTaskId" = NEW."id";
  IF total > 0 THEN
    NEW."progressPercent" := round(100.0 * faites / total);
  ELSE
    NEW."progressPercent" := CASE NEW."status" WHEN 'A_FAIRE' THEN 0 WHEN 'EN_COURS' THEN 50 WHEN 'REJETEE' THEN 50 WHEN 'SOUMISE_VALIDATION' THEN 90 ELSE 100 END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "tache_avancement_calcule" BEFORE INSERT OR UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION "tache_avancement_calcule"();

-- Une sous-tâche créée, déplacée, supprimée ou changeant de statut fait recalculer sa tâche mère.
CREATE FUNCTION "tache_avancement_parent"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW."parentTaskId" IS NOT NULL THEN
    UPDATE "tasks" SET "progressPercent" = "progressPercent" WHERE "id" = NEW."parentTaskId";
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."parentTaskId" IS NOT NULL AND (TG_OP = 'DELETE' OR OLD."parentTaskId" IS DISTINCT FROM NEW."parentTaskId") THEN
    UPDATE "tasks" SET "progressPercent" = "progressPercent" WHERE "id" = OLD."parentTaskId";
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER "tache_avancement_parent" AFTER INSERT OR DELETE OR UPDATE OF "status", "parentTaskId" ON "tasks" FOR EACH ROW EXECUTE FUNCTION "tache_avancement_parent"();

-- Reprise : avancement recalculé pour toutes les tâches (sous-tâches d'abord).
UPDATE "tasks" SET "progressPercent" = "progressPercent" WHERE "parentTaskId" IS NOT NULL;
UPDATE "tasks" SET "progressPercent" = "progressPercent" WHERE "parentTaskId" IS NULL;

-- AlterTable (certificat médical d'un congé maladie : agent et DRH seulement)
ALTER TABLE "leave_requests" ADD COLUMN     "certificatDeposeLe" TIMESTAMP(3),
ADD COLUMN     "certificatFileKey" TEXT,
ADD COLUMN     "certificatFileName" TEXT;

-- CreateTable
CREATE TABLE "jours_feries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "libelle" TEXT NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'FIXE',
    "creeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jours_feries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jours_feries_date_key" ON "jours_feries"("date");

-- Reprise : fêtes fixes nationales de 2026 et 2027 (les fêtes religieuses se saisissent chaque année).
INSERT INTO "jours_feries" ("id", "date", "libelle", "nature", "updatedAt") VALUES
('jf-2026-01-01', DATE '2026-01-01', 'Jour de l’An', 'FIXE', now()),
('jf-2026-05-01', DATE '2026-05-01', 'Fête du Travail', 'FIXE', now()),
('jf-2026-05-25', DATE '2026-05-25', 'Journée de l’Afrique', 'FIXE', now()),
('jf-2026-08-15', DATE '2026-08-15', 'Assomption', 'FIXE', now()),
('jf-2026-10-02', DATE '2026-10-02', 'Fête de l’Indépendance', 'FIXE', now()),
('jf-2026-12-25', DATE '2026-12-25', 'Noël', 'FIXE', now()),
('jf-2027-01-01', DATE '2027-01-01', 'Jour de l’An', 'FIXE', now()),
('jf-2027-05-01', DATE '2027-05-01', 'Fête du Travail', 'FIXE', now()),
('jf-2027-05-25', DATE '2027-05-25', 'Journée de l’Afrique', 'FIXE', now()),
('jf-2027-08-15', DATE '2027-08-15', 'Assomption', 'FIXE', now()),
('jf-2027-10-02', DATE '2027-10-02', 'Fête de l’Indépendance', 'FIXE', now()),
('jf-2027-12-25', DATE '2027-12-25', 'Noël', 'FIXE', now());
