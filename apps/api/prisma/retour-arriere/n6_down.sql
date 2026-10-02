-- Retour arrière DÉFINITIF du lot N6 (effectifs et alertes RH, carrière et actes, fiches de poste,
-- besoins de formation, véhicules et carburant). À n'utiliser que pour abandonner N6 : pour revenir à
-- la version précédente, redéployer suffit (colonnes facultatives, tables ignorées par N5).
-- Ordre inverse des lots : N6 avant N5, N4…
-- Perd : pièces requises et rattachement des pièces du dossier, catégorie et date du dernier échelon,
-- mouvements de carrière (les actes signés restent dans le Courrier, les dossiers gardent les valeurs
-- appliquées), familles d'actes, fiches de poste, besoins de formation, véhicules, pleins de carburant,
-- véhicule et kilométrage des ordres de mission.
-- Contrôlé par la phase 39l de tests/e2e/run_all.sh (schéma identique à celui d'avant N6).
BEGIN;
DROP TABLE IF EXISTS "pleins_carburant";
ALTER TABLE "ordres_mission" DROP CONSTRAINT IF EXISTS "ordres_mission_kilometrage";
ALTER TABLE "ordres_mission" DROP CONSTRAINT IF EXISTS "ordres_mission_vehiculeId_fkey";
ALTER TABLE "ordres_mission" DROP COLUMN IF EXISTS "vehiculeId", DROP COLUMN IF EXISTS "kilometrageDepart", DROP COLUMN IF EXISTS "kilometrageRetour";
DROP TABLE IF EXISTS "vehicules";
DROP TABLE IF EXISTS "besoins_formation";
DROP TABLE IF EXISTS "fiches_poste";
DROP TABLE IF EXISTS "mouvements_carriere";
DROP TABLE IF EXISTS "familles_actes_rh";
ALTER TABLE "personnel_documents" DROP CONSTRAINT IF EXISTS "personnel_documents_pieceRequiseId_fkey";
ALTER TABLE "personnel_documents" DROP COLUMN IF EXISTS "pieceRequiseId";
DROP TABLE IF EXISTS "pieces_requises";
ALTER TABLE "personnel_files_basic" DROP COLUMN IF EXISTS "categorie", DROP COLUMN IF EXISTS "echelonDepuis";
DROP TYPE IF EXISTS "statut_mouvement_carriere";
DROP TYPE IF EXISTS "type_mouvement_carriere";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261003080000_socle_nimba_n6';
COMMIT;
