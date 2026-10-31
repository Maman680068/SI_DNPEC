-- S1 — Demandes de réunion (docs/conception_S1_demandes_reunion.md). Migration ADDITIVE : deux tables
-- nouvelles et un type ; aucune table existante modifiée. Retour arrière :
-- prisma/retour-arriere/demandes_reunion_down.sql (contrôlé par la phase 39q de tests/e2e/run_all.sh).

-- CreateEnum
CREATE TYPE "etat_demande_reunion" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'UTILISEE');

-- CreateTable
CREATE TABLE "demandes_reunion" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "explication" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "participantIds" TEXT[],
    "uniteIds" TEXT[],
    "etat" "etat_demande_reunion" NOT NULL DEFAULT 'EN_ATTENTE',
    "decideurIds" TEXT[],
    "decideParId" TEXT,
    "decideeLe" TIMESTAMP(3),
    "motifRefus" TEXT,
    "reunionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_reunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapes_demande_reunion" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "parId" TEXT,
    "versIds" TEXT[],
    "motif" TEXT,
    "le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etapes_demande_reunion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demandes_reunion_reunionId_key" ON "demandes_reunion"("reunionId");

-- CreateIndex
CREATE INDEX "demandes_reunion_demandeurId_idx" ON "demandes_reunion"("demandeurId");

-- CreateIndex
CREATE INDEX "demandes_reunion_etat_idx" ON "demandes_reunion"("etat");

-- CreateIndex
CREATE INDEX "etapes_demande_reunion_demandeId_idx" ON "etapes_demande_reunion"("demandeId");

-- AddForeignKey
ALTER TABLE "demandes_reunion" ADD CONSTRAINT "demandes_reunion_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_reunion" ADD CONSTRAINT "demandes_reunion_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_reunion" ADD CONSTRAINT "demandes_reunion_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_demande_reunion" ADD CONSTRAINT "etapes_demande_reunion_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_reunion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_demande_reunion" ADD CONSTRAINT "etapes_demande_reunion_parId_fkey" FOREIGN KEY ("parId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Garde-fous : la fin suit le début ; un refus porte toujours son motif.
ALTER TABLE "demandes_reunion" ADD CONSTRAINT "demandes_reunion_periode" CHECK ("fin" > "debut");
ALTER TABLE "demandes_reunion" ADD CONSTRAINT "demandes_reunion_motif_refus" CHECK ("etat" <> 'REFUSEE' OR ("motifRefus" IS NOT NULL AND length(btrim("motifRefus")) > 0));
