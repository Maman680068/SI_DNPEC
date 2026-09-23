-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'SUPPLEANCE_DESIGNEE';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "onBehalfOfId" TEXT;

-- CreateTable
CREATE TABLE "suppleances" (
    "id" TEXT NOT NULL,
    "titulaireId" TEXT NOT NULL,
    "suppleantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppleances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_onBehalfOfId_idx" ON "audit_logs"("onBehalfOfId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_onBehalfOfId_fkey" FOREIGN KEY ("onBehalfOfId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppleances" ADD CONSTRAINT "suppleances_titulaireId_fkey" FOREIGN KEY ("titulaireId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppleances" ADD CONSTRAINT "suppleances_suppleantId_fkey" FOREIGN KEY ("suppleantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppleances" ADD CONSTRAINT "suppleances_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppleances" ADD CONSTRAINT "suppleances_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

