-- DropForeignKey
ALTER TABLE "capacites_accueil" DROP CONSTRAINT "capacites_accueil_fixeeParId_fkey";

-- DropForeignKey
ALTER TABLE "modeles_attestation" DROP CONSTRAINT "modeles_attestation_importeParId_fkey";

-- AlterTable
ALTER TABLE "capacites_accueil" ALTER COLUMN "fixeeParId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "modeles_attestation" ALTER COLUMN "importeParId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "capacites_accueil" ADD CONSTRAINT "capacites_accueil_fixeeParId_fkey" FOREIGN KEY ("fixeeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeles_attestation" ADD CONSTRAINT "modeles_attestation_importeParId_fkey" FOREIGN KEY ("importeParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
