-- AlterEnum
ALTER TYPE "announcement_scope" ADD VALUE 'CELLULE';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "celluleId" TEXT;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_celluleId_fkey" FOREIGN KEY ("celluleId") REFERENCES "cellules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
