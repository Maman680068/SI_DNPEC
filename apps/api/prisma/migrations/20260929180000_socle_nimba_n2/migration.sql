-- Socle NIMBA, lot N2 : journal d'audit inaltérable et chaîné, journal des connexions, paramètres,
-- exécutions des tâches planifiées, aucun compte sans agent (en base).
-- Additive : ajoute des tables, des colonnes (audit_logs), des fonctions, des déclencheurs et une
-- contrainte ; ne modifie aucune donnée existante hors colonnes ajoutées.
-- Retour arrière : prisma/retour-arriere/n2_down.sql.

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "acteurInitial" TEXT,
ADD COLUMN     "auNomDeInitial" TEXT,
ADD COLUMN     "empreinte" TEXT,
ADD COLUMN     "empreintePrecedente" TEXT,
ADD COLUMN     "numero" SERIAL NOT NULL,
ADD COLUMN     "rang" INTEGER;

-- CreateTable
CREATE TABLE "journal_connexions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "resultat" TEXT NOT NULL,
    "motif" TEXT,
    "ip" TEXT,
    "navigateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_connexions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres" (
    "cle" TEXT NOT NULL,
    "valeur" JSONB NOT NULL,
    "modifieParId" TEXT,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametres_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "executions_taches" (
    "id" TEXT NOT NULL,
    "tache" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "statut" TEXT NOT NULL,
    "message" TEXT,
    "details" JSONB,

    CONSTRAINT "executions_taches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_connexions_createdAt_idx" ON "journal_connexions"("createdAt");

-- CreateIndex
CREATE INDEX "journal_connexions_userId_createdAt_idx" ON "journal_connexions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "executions_taches_tache_debut_idx" ON "executions_taches"("tache", "debut");

-- ===========================================================================================
-- N2 — partie écrite à la main (après le SQL généré par prisma migrate diff).
-- ===========================================================================================

-- 1. Journal d'audit : numéro d'ordre, acteur figé, scellement chaîné, écriture seule ----------
-- Lignes existantes numérotées dans l'ordre chronologique (SERIAL les numérote dans un ordre quelconque).
UPDATE "audit_logs" a SET "numero" = s.n, "acteurInitial" = a."actorId", "auNomDeInitial" = a."onBehalfOfId"
FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS n FROM "audit_logs") s
WHERE s.id = a.id;
SELECT setval('"audit_logs_numero_seq"', COALESCE((SELECT max("numero") FROM "audit_logs"), 0) + 1, false);

-- Acteur figé à l'écriture (la clé étrangère actorId peut passer à NULL si un compte en attente est
-- supprimé ; l'empreinte porte sur acteurInitial, qui ne change jamais).
CREATE FUNCTION "audit_avant_insertion"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."acteurInitial" := NEW."actorId";
  NEW."auNomDeInitial" := NEW."onBehalfOfId";
  NEW."rang" := NULL; NEW."empreinte" := NULL; NEW."empreintePrecedente" := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER "audit_avant_insertion" BEFORE INSERT ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION "audit_avant_insertion"();

-- Contenu canonique d'une ligne scellée.
CREATE FUNCTION "audit_empreinte"(r "audit_logs", rang INTEGER, precedente TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(concat_ws('|',
    rang::text, r."numero"::text, r."action"::text, r."entityType", r."entityId", COALESCE(r."metadata"::text, ''),
    COALESCE(r."acteurInitial", ''), COALESCE(r."auNomDeInitial", ''),
    to_char(r."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS'), COALESCE(precedente, '')), 'UTF8')), 'hex')
$$;

-- Scellement : les lignes non scellées, plus anciennes que `delai`, dans l'ordre de leur numéro,
-- reçoivent un rang et une empreinte chaînée à la précédente. Un seul scellement à la fois.
CREATE FUNCTION "audit_sceller"(delai INTERVAL DEFAULT INTERVAL '1 minute') RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  r "audit_logs"; prec TEXT; rg INTEGER; n INTEGER := 0; e TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(7272740);
  SELECT "empreinte", "rang" INTO prec, rg FROM "audit_logs" WHERE "rang" IS NOT NULL ORDER BY "rang" DESC LIMIT 1;
  rg := COALESCE(rg, 0);
  FOR r IN SELECT * FROM "audit_logs" WHERE "rang" IS NULL AND "createdAt" <= (now() AT TIME ZONE 'UTC') - delai ORDER BY "numero" FOR UPDATE LOOP
    rg := rg + 1;
    e := "audit_empreinte"(r, rg, prec);
    UPDATE "audit_logs" SET "rang" = rg, "empreintePrecedente" = prec, "empreinte" = e WHERE "id" = r."id";
    prec := e; n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Vérification : première ligne dont l'empreinte ne correspond plus (NULL si la chaîne est intacte).
CREATE FUNCTION "audit_verifier"() RETURNS TABLE("rangRompu" INTEGER, "lignesVerifiees" INTEGER) LANGUAGE plpgsql AS $$
DECLARE r "audit_logs"; prec TEXT; attendu INTEGER := 0;
BEGIN
  "lignesVerifiees" := 0;
  FOR r IN SELECT * FROM "audit_logs" WHERE "rang" IS NOT NULL ORDER BY "rang" LOOP
    attendu := attendu + 1;
    IF r."rang" <> attendu OR r."empreintePrecedente" IS DISTINCT FROM prec OR r."empreinte" <> "audit_empreinte"(r, r."rang", prec) THEN
      "rangRompu" := attendu; RETURN NEXT; RETURN;
    END IF;
    prec := r."empreinte"; "lignesVerifiees" := "lignesVerifiees" + 1;
  END LOOP;
  "rangRompu" := NULL; RETURN NEXT;
END $$;

-- Écriture seule : aucune modification ni suppression, sauf (a) le scellement d'une ligne non
-- scellée, (b) la remise à NULL de actorId / onBehalfOfId par la suppression d'un compte.
CREATE FUNCTION "audit_ecriture_seule"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."id" = OLD."id" AND NEW."numero" = OLD."numero" AND NEW."action" = OLD."action"
     AND NEW."entityType" = OLD."entityType" AND NEW."entityId" = OLD."entityId"
     AND NEW."metadata" IS NOT DISTINCT FROM OLD."metadata" AND NEW."createdAt" = OLD."createdAt"
     AND NEW."acteurInitial" IS NOT DISTINCT FROM OLD."acteurInitial" AND NEW."auNomDeInitial" IS NOT DISTINCT FROM OLD."auNomDeInitial"
     AND (NEW."actorId" IS NOT DISTINCT FROM OLD."actorId" OR NEW."actorId" IS NULL)
     AND (NEW."onBehalfOfId" IS NOT DISTINCT FROM OLD."onBehalfOfId" OR NEW."onBehalfOfId" IS NULL)
     AND (
       (NEW."rang" IS NOT DISTINCT FROM OLD."rang" AND NEW."empreinte" IS NOT DISTINCT FROM OLD."empreinte" AND NEW."empreintePrecedente" IS NOT DISTINCT FROM OLD."empreintePrecedente")
       OR (OLD."rang" IS NULL AND OLD."empreinte" IS NULL)
     ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Le journal d''audit est en écriture seule.' USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER "audit_ecriture_seule" BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION "audit_ecriture_seule"();
CREATE FUNCTION "audit_pas_de_vidage"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Le journal d''audit est en écriture seule.' USING ERRCODE = 'insufficient_privilege'; END $$;
CREATE TRIGGER "audit_pas_de_vidage" BEFORE TRUNCATE ON "audit_logs" FOR EACH STATEMENT EXECUTE FUNCTION "audit_pas_de_vidage"();

-- Lignes existantes : scellées tout de suite.
SELECT "audit_sceller"(INTERVAL '0 second');

-- 2. Aucun compte sans agent -------------------------------------------------------------------
CREATE FUNCTION "compte_agent_obligatoire"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE u TEXT; sup RECORD; aid TEXT; mat TEXT;
BEGIN
  IF NEW."status" = 'EN_ATTENTE' OR NEW."agentId" IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW."sectionId" IS NOT NULL THEN SELECT "id" INTO u FROM "unites_organisationnelles" WHERE "sectionId" = NEW."sectionId";
  ELSIF NEW."divisionId" IS NOT NULL THEN SELECT "id" INTO u FROM "unites_organisationnelles" WHERE "divisionId" = NEW."divisionId";
  ELSIF NEW."celluleId" IS NOT NULL THEN SELECT "id" INTO u FROM "unites_organisationnelles" WHERE "celluleId" = NEW."celluleId";
  ELSIF NEW."role" = 'ASSISTANT_DIRECTION' AND NEW."supervisorId" IS NOT NULL THEN
    SELECT "role", "celluleId" INTO sup FROM "users" WHERE "id" = NEW."supervisorId";
    IF sup."role" = 'CHEF_CELLULE' THEN SELECT "id" INTO u FROM "unites_organisationnelles" WHERE "celluleId" = sup."celluleId";
    ELSE SELECT "id" INTO u FROM "unites_organisationnelles" WHERE "code" = 'SECDIR' AND "dateFermeture" IS NULL; END IF;
  END IF;
  IF u IS NULL THEN SELECT "id" INTO u FROM "unites_organisationnelles" WHERE "type" = 'DIRECTION' AND "parentId" IS NULL LIMIT 1; END IF;
  aid := 'agt' || replace(gen_random_uuid()::text, '-', '');
  mat := 'P-' || lpad(nextval('matricule_provisoire_seq')::text, 6, '0');
  INSERT INTO "agents" ("id", "matricule", "matriculeProvisoire", "nom", "prenoms", "fonction", "uniteId", "statut", "createdAt", "updatedAt")
  VALUES (aid, mat, true, NEW."lastName", NEW."firstName", NEW."jobTitle", u,
          (CASE NEW."status" WHEN 'SUSPENDU' THEN 'SUSPENDU' WHEN 'SUPPRIME' THEN 'PARTI' ELSE 'EN_ACTIVITE' END)::"statut_agent",
          now(), now());
  INSERT INTO "mouvements_agents" ("id", "agentId", "type", "apres", "motif", "dateEffet", "createdAt")
  VALUES ('mvt' || replace(gen_random_uuid()::text, '-', ''), aid, 'ENTREE', jsonb_build_object('matricule', mat, 'uniteId', u), 'Compte sans agent : agent créé par la base', now(), now());
  NEW."agentId" := aid;
  RETURN NEW;
END $$;
CREATE TRIGGER "compte_agent_obligatoire" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "compte_agent_obligatoire"();
-- Comptes existants sans agent (normalement aucun après la reprise N1) : le déclencheur les complète.
UPDATE "users" SET "agentId" = NULL WHERE "status" <> 'EN_ATTENTE' AND "agentId" IS NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_compte_avec_agent" CHECK ("status" = 'EN_ATTENTE' OR "agentId" IS NOT NULL);
