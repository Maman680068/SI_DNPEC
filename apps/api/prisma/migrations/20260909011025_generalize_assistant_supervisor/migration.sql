/*
  Warnings:

  - You are about to drop the column `dnOrDnaId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_dnOrDnaId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "dnOrDnaId",
ADD COLUMN     "supervisorId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
