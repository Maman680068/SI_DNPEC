-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('FONCTIONNAIRE', 'CONTRACTUEL', 'STAGIAIRE', 'MISE_A_DISPOSITION');

-- CreateEnum
CREATE TYPE "career_event_type" AS ENUM ('AFFECTATION', 'PROMOTION', 'CHANGEMENT_FONCTION');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'DOSSIER_ERREUR_SIGNALEE';

-- AlterEnum
ALTER TYPE "system_role" ADD VALUE 'DRH';

-- CreateTable
CREATE TABLE "personnel_files_basic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employmentStatus" "employment_status",
    "grade" TEXT,
    "echelon" TEXT,
    "serviceStartDate" TIMESTAMP(3),
    "jobDescriptionFileKey" TEXT,
    "jobDescriptionFileName" TEXT,
    "verifiedFields" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_files_basic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_files_sensitive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalAddress" TEXT,
    "personalPhone" TEXT,
    "personalEmail" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelation" TEXT,
    "emergencyContactPhone" TEXT,
    "verifiedFields" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_files_sensitive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_diplomas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT,
    "obtainedYear" INTEGER,
    "fileKey" TEXT,
    "fileName" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_diplomas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_career_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "career_event_type" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_career_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personnel_files_basic_userId_key" ON "personnel_files_basic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_files_sensitive_userId_key" ON "personnel_files_sensitive"("userId");

-- AddForeignKey
ALTER TABLE "personnel_files_basic" ADD CONSTRAINT "personnel_files_basic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_files_sensitive" ADD CONSTRAINT "personnel_files_sensitive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_diplomas" ADD CONSTRAINT "personnel_diplomas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_documents" ADD CONSTRAINT "personnel_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_documents" ADD CONSTRAINT "personnel_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_career_events" ADD CONSTRAINT "personnel_career_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_career_events" ADD CONSTRAINT "personnel_career_events_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
