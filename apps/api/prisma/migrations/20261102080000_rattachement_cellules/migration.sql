-- S8 — Organisation : rattachement des cellules (DN ou DNA) et nature affichée (cellule, service, instance).
-- Migration ADDITIVE : deux colonnes ajoutées à « cellules », valeurs initiales par code ; aucune donnée
-- existante modifiée. Retour arrière : prisma/retour-arriere/rattachement_cellules_down.sql (phase 39r).

-- AlterTable
ALTER TABLE "cellules" ADD COLUMN     "nature" TEXT NOT NULL DEFAULT 'CELLULE',
ADD COLUMN     "rattachement" TEXT NOT NULL DEFAULT 'DN';

-- Garde-fous : valeurs fermées.
ALTER TABLE "cellules" ADD CONSTRAINT "cellules_rattachement" CHECK ("rattachement" IN ('DN', 'DNA'));
ALTER TABLE "cellules" ADD CONSTRAINT "cellules_nature" CHECK ("nature" IN ('CELLULE', 'SERVICE', 'INSTANCE'));

-- Valeurs initiales par code : CTSCM et CNC rattachées au DN ; SAF, RH et CSID à la DNA ; toute autre cellule au
-- DN (valeur par défaut). Le CNC est une instance ; le SAF un service.
UPDATE "cellules" SET "rattachement" = 'DNA' WHERE "code" IN ('SAF', 'RH', 'CSID');
UPDATE "cellules" SET "nature" = 'INSTANCE' WHERE "code" = 'CNC';
UPDATE "cellules" SET "nature" = 'SERVICE' WHERE "code" = 'SAF';
