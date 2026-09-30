-- Socle NIMBA, lot N5 : plan de travail, alertes d'échéance des tâches, messagerie en fils,
-- notifications regroupées (résumé quotidien), instructions de la Direction. Additive, sans reprise de
-- données. Retour arrière : prisma/retour-arriere/n5_down.sql.

-- CreateEnum
CREATE TYPE "statut_instruction" AS ENUM ('EMISE', 'RECUE', 'PRISE_EN_COMPTE', 'EXECUTEE', 'REJETEE');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "aEnvoyerLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "activiteId" TEXT,
ADD COLUMN     "alerteRetardAt" TIMESTAMP(3),
ADD COLUMN     "alerteVeilleAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "objectifs" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "uniteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activites" (
    "id" TEXT NOT NULL,
    "objectifId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "indicateur" TEXT NOT NULL,
    "cible" TEXT,
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fils_messages" (
    "id" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "creeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernierMessageLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fils_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants_fil" (
    "filId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ajouteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_fil_pkey" PRIMARY KEY ("filId","userId")
);

-- CreateTable
CREATE TABLE "messages_fil" (
    "id" TEXT NOT NULL,
    "filId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "lienType" TEXT,
    "lienId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_fil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectures_message" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "luLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lectures_message_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "preferences_notification" (
    "userId" TEXT NOT NULL,
    "resumeQuotidien" BOOLEAN NOT NULL DEFAULT true,
    "heureResume" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_notification_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "instructions" (
    "id" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "emetteurId" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "agentConcerneId" TEXT,
    "echeance" DATE,
    "statut" "statut_instruction" NOT NULL DEFAULT 'EMISE',
    "emiseLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recueLe" TIMESTAMP(3),
    "priseEnCompteLe" TIMESTAMP(3),
    "executeeLe" TIMESTAMP(3),
    "rejeteeLe" TIMESTAMP(3),
    "motifRejet" TEXT,
    "compteRendu" TEXT,
    "acteId" TEXT,
    "relanceLe" TIMESTAMP(3),

    CONSTRAINT "instructions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "objectifs_annee_uniteId_idx" ON "objectifs"("annee", "uniteId");

-- CreateIndex
CREATE INDEX "activites_objectifId_idx" ON "activites"("objectifId");

-- CreateIndex
CREATE INDEX "activites_responsableId_idx" ON "activites"("responsableId");

-- CreateIndex
CREATE INDEX "fils_messages_dernierMessageLe_idx" ON "fils_messages"("dernierMessageLe");

-- CreateIndex
CREATE INDEX "participants_fil_userId_idx" ON "participants_fil"("userId");

-- CreateIndex
CREATE INDEX "messages_fil_filId_createdAt_idx" ON "messages_fil"("filId", "createdAt");

-- CreateIndex
CREATE INDEX "instructions_destinataireId_statut_idx" ON "instructions"("destinataireId", "statut");

-- CreateIndex
CREATE INDEX "instructions_emetteurId_idx" ON "instructions"("emetteurId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "activites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectifs" ADD CONSTRAINT "objectifs_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "unites_organisationnelles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites" ADD CONSTRAINT "activites_objectifId_fkey" FOREIGN KEY ("objectifId") REFERENCES "objectifs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activites" ADD CONSTRAINT "activites_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants_fil" ADD CONSTRAINT "participants_fil_filId_fkey" FOREIGN KEY ("filId") REFERENCES "fils_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants_fil" ADD CONSTRAINT "participants_fil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_fil" ADD CONSTRAINT "messages_fil_filId_fkey" FOREIGN KEY ("filId") REFERENCES "fils_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_fil" ADD CONSTRAINT "messages_fil_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures_message" ADD CONSTRAINT "lectures_message_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages_fil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences_notification" ADD CONSTRAINT "preferences_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_emetteurId_fkey" FOREIGN KEY ("emetteurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_destinataireId_fkey" FOREIGN KEY ("destinataireId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_agentConcerneId_fkey" FOREIGN KEY ("agentConcerneId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

