-- CreateEnum
CREATE TYPE "decision_status" AS ENUM ('EN_ATTENTE', 'CLOTUREE');

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "isOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minutesText" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "sourceDecisionId" TEXT;

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "decision_status" NOT NULL DEFAULT 'EN_ATTENTE',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_sourceDecisionId_key" ON "tasks"("sourceDecisionId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceDecisionId_fkey" FOREIGN KEY ("sourceDecisionId") REFERENCES "decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

