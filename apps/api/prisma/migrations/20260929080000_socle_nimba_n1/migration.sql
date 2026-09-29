-- Socle NIMBA, lot N1 : organigramme, agents, habilitation à deux axes.
-- STRICTEMENT ADDITIF : aucune table, colonne ou valeur d'énumération existante n'est
-- modifiée ; l'ancienne version de l'API fonctionne sur ce schéma. La reprise des
-- données est faite par l'API (ReprisesN1Service, idempotente) et non ici.
-- Retour arrière : prisma/retour-arriere/n1_down.sql (voir docs/Exploitation.md).

-- CreateEnum
CREATE TYPE "type_unite" AS ENUM ('DIRECTION', 'DIVISION', 'SECTION', 'CELLULE', 'INSTANCE');

-- CreateEnum
CREATE TYPE "statut_agent" AS ENUM ('EN_ACTIVITE', 'SUSPENDU', 'PARTI');

-- CreateEnum
CREATE TYPE "role_fonctionnel" AS ENUM ('DRH', 'GESTIONNAIRE_RH', 'CHEF_SAF', 'GESTIONNAIRE_PAIE', 'ENCADREUR_STAGE', 'AGENT_COURRIER', 'ASSISTANT', 'VALIDATEUR', 'GESTIONNAIRE_LOGISTIQUE', 'RESPONSABLE_MODELE', 'ANALYSTE', 'DECIDEUR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agentId" TEXT;

-- CreateTable
CREATE TABLE "unites_organisationnelles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "type_unite" NOT NULL,
    "parentId" TEXT,
    "responsableId" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFermeture" TIMESTAMP(3),
    "motifFermeture" TEXT,
    "fermeeParId" TEXT,
    "divisionId" TEXT,
    "sectionId" TEXT,
    "celluleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unites_organisationnelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_unites" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "avant" JSONB,
    "apres" JSONB,
    "dateEffet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_unites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "matriculeProvisoire" BOOLEAN NOT NULL DEFAULT false,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "genre" TEXT,
    "uniteId" TEXT,
    "fonction" TEXT,
    "statut" "statut_agent" NOT NULL DEFAULT 'EN_ACTIVITE',
    "dateFinPrevue" DATE,
    "natureFinPrevue" TEXT,
    "alerteJ15At" TIMESTAMP(3),
    "alerteJ3At" TIMESTAMP(3),
    "finConfirmeeAt" TIMESTAMP(3),
    "dateDepart" TIMESTAMP(3),
    "motifDepart" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_agents" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "avant" JSONB,
    "apres" JSONB,
    "motif" TEXT,
    "dateEffet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributions_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "role_fonctionnel" NOT NULL,
    "registreId" TEXT,
    "uniteKey" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "motif" TEXT,
    "attribueParId" TEXT,
    "retireLe" TIMESTAMP(3),
    "retireParId" TEXT,
    "motifRetrait" TEXT,
    "habilitationCourrierId" TEXT,
    "habilitationLogistiqueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attributions_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acces_refuses" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "interimForId" TEXT,
    "methode" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "objetType" TEXT,
    "objetId" TEXT,
    "etape" TEXT,
    "motif" TEXT NOT NULL,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acces_refuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unites_organisationnelles_divisionId_key" ON "unites_organisationnelles"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "unites_organisationnelles_sectionId_key" ON "unites_organisationnelles"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "unites_organisationnelles_celluleId_key" ON "unites_organisationnelles"("celluleId");

-- CreateIndex
CREATE INDEX "unites_organisationnelles_parentId_idx" ON "unites_organisationnelles"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "unites_organisationnelles_parentId_code_key" ON "unites_organisationnelles"("parentId", "code");

-- CreateIndex
CREATE INDEX "historique_unites_uniteId_idx" ON "historique_unites"("uniteId");

-- CreateIndex
CREATE UNIQUE INDEX "agents_matricule_key" ON "agents"("matricule");

-- CreateIndex
CREATE INDEX "agents_statut_idx" ON "agents"("statut");

-- CreateIndex
CREATE INDEX "mouvements_agents_agentId_idx" ON "mouvements_agents"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "attributions_roles_habilitationCourrierId_key" ON "attributions_roles"("habilitationCourrierId");

-- CreateIndex
CREATE UNIQUE INDEX "attributions_roles_habilitationLogistiqueId_key" ON "attributions_roles"("habilitationLogistiqueId");

-- CreateIndex
CREATE INDEX "attributions_roles_userId_role_idx" ON "attributions_roles"("userId", "role");

-- CreateIndex
CREATE INDEX "acces_refuses_createdAt_idx" ON "acces_refuses"("createdAt");

-- CreateIndex
CREATE INDEX "acces_refuses_userId_idx" ON "acces_refuses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_agentId_key" ON "users"("agentId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unites_organisationnelles" ADD CONSTRAINT "unites_organisationnelles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "unites_organisationnelles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unites_organisationnelles" ADD CONSTRAINT "unites_organisationnelles_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unites_organisationnelles" ADD CONSTRAINT "unites_organisationnelles_fermeeParId_fkey" FOREIGN KEY ("fermeeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unites_organisationnelles" ADD CONSTRAINT "unites_organisationnelles_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unites_organisationnelles" ADD CONSTRAINT "unites_organisationnelles_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unites_organisationnelles" ADD CONSTRAINT "unites_organisationnelles_celluleId_fkey" FOREIGN KEY ("celluleId") REFERENCES "cellules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_unites" ADD CONSTRAINT "historique_unites_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "unites_organisationnelles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_unites" ADD CONSTRAINT "historique_unites_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "unites_organisationnelles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_agents" ADD CONSTRAINT "mouvements_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_agents" ADD CONSTRAINT "mouvements_agents_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions_roles" ADD CONSTRAINT "attributions_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions_roles" ADD CONSTRAINT "attributions_roles_attribueParId_fkey" FOREIGN KEY ("attribueParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions_roles" ADD CONSTRAINT "attributions_roles_retireParId_fkey" FOREIGN KEY ("retireParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Matricules provisoires (P-000001…) attribués à la reprise, remplacés ensuite par le DRH.
CREATE SEQUENCE "matricule_provisoire_seq" START 1;
