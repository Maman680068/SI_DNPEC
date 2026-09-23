-- AlterTable
ALTER TABLE "cellules" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "divisions" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

