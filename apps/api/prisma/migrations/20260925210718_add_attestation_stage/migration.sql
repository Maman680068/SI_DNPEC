-- CreateEnum
CREATE TYPE "modele_attestation_type" AS ENUM ('DOCX', 'PDF');

-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "attestationActeId" TEXT;

-- CreateTable
CREATE TABLE "modeles_attestation" (
    "id" TEXT NOT NULL,
    "type" "modele_attestation_type" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "champs" JSONB NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "importeParId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modeles_attestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stages_attestationActeId_key" ON "stages"("attestationActeId");

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_attestationActeId_fkey" FOREIGN KEY ("attestationActeId") REFERENCES "actes_courrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeles_attestation" ADD CONSTRAINT "modeles_attestation_importeParId_fkey" FOREIGN KEY ("importeParId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

