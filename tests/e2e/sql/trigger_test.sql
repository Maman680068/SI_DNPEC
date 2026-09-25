-- Test des triggers d'intégrité (SQL direct, tout est annulé à la fin).
\set ON_ERROR_STOP off
BEGIN;
INSERT INTO registres_courrier (id, code, libelle, nature, portee, "gabaritNumero", "updatedAt")
  VALUES ('reg_t', 'TSTTRIG', 'Test trigger', 'ARRIVEE', 'DIRECTION', '{seq:4}/{annee}', now()),
         ('reg_t2', 'TSTTRIG2', 'Test trigger 2', 'ARRIVEE', 'DIRECTION', '{seq:4}/{annee}', now());
INSERT INTO courriers_arrivee (id, "registreId", "uniteKey", annee, sequence, numero, "dateReception", expediteur, confidentialite, "enregistreParId", "updatedAt")
  SELECT 'arr_t', 'reg_t', 'DNPEC', 2026, 1, '0001/2026', now(), 'Test', 'ORDINAIRE', id, now() FROM users WHERE email='admin@test.local';
INSERT INTO actes_courrier (id, "registreId", "uniteKey", objet, confidentialite, "redacteurId", "updatedAt")
  SELECT 'acte_brouillon', 'reg_t', 'DNPEC', 'Brouillon', 'ORDINAIRE', id, now() FROM users WHERE email='admin@test.local';
INSERT INTO actes_courrier (id, "registreId", "uniteKey", annee, sequence, numero, objet, confidentialite, "redacteurId", statut, "updatedAt")
  SELECT 'acte_signe', 'reg_t', 'DNPEC', 2026, 7, '0007/2026', 'Signé', 'ORDINAIRE', id, 'SIGNE', now() FROM users WHERE email='admin@test.local';

\echo '--- 1. DELETE d une arrivée (attendu : refus)'
SAVEPOINT s1; DELETE FROM courriers_arrivee WHERE id='arr_t'; ROLLBACK TO s1;
\echo '--- 2. UPDATE du numéro d une arrivée (attendu : refus)'
SAVEPOINT s2; UPDATE courriers_arrivee SET numero='9999/2026' WHERE id='arr_t'; ROLLBACK TO s2;
\echo '--- 3. UPDATE de la séquence / annee / registreId / uniteKey d une arrivée (attendu : 4 refus)'
SAVEPOINT s3a; UPDATE courriers_arrivee SET sequence=2 WHERE id='arr_t'; ROLLBACK TO s3a;
SAVEPOINT s3b; UPDATE courriers_arrivee SET annee=2025 WHERE id='arr_t'; ROLLBACK TO s3b;
SAVEPOINT s3c; UPDATE courriers_arrivee SET "uniteKey"='DIV:x' WHERE id='arr_t'; ROLLBACK TO s3c;
SAVEPOINT s3d; UPDATE courriers_arrivee SET "registreId"='reg_t2' WHERE id='arr_t'; ROLLBACK TO s3d;
\echo '--- 4. UPDATE d une métadonnée d une arrivée (attendu : accepté, UPDATE 1)'
SAVEPOINT s4; UPDATE courriers_arrivee SET expediteur='Corrigé' WHERE id='arr_t'; ROLLBACK TO s4;
\echo '--- 5. DELETE d un acte numéroté (attendu : refus)'
SAVEPOINT s5; DELETE FROM actes_courrier WHERE id='acte_signe'; ROLLBACK TO s5;
\echo '--- 6. UPDATE du numéro / de la séquence d un acte numéroté (attendu : 2 refus)'
SAVEPOINT s6a; UPDATE actes_courrier SET numero='X' WHERE id='acte_signe'; ROLLBACK TO s6a;
SAVEPOINT s6b; UPDATE actes_courrier SET sequence=NULL, numero=NULL, annee=NULL WHERE id='acte_signe'; ROLLBACK TO s6b;
\echo '--- 7. UPDATE du statut d un acte numéroté (attendu : accepté — annulation)'
SAVEPOINT s7; UPDATE actes_courrier SET statut='ANNULE', "motifAnnulation"='test' WHERE id='acte_signe'; ROLLBACK TO s7;
\echo '--- 8. Brouillon : numérotation à la signature puis DELETE (attendu : UPDATE 1 puis DELETE 1 avant numérotation)'
SAVEPOINT s8; UPDATE actes_courrier SET objet='Modifié' WHERE id='acte_brouillon'; DELETE FROM actes_courrier WHERE id='acte_brouillon'; ROLLBACK TO s8;
SAVEPOINT s9; UPDATE actes_courrier SET annee=2026, sequence=8, numero='0008/2026', statut='SIGNE' WHERE id='acte_brouillon'; DELETE FROM actes_courrier WHERE id='acte_brouillon'; ROLLBACK TO s9;
ROLLBACK;
\echo '--- Après ROLLBACK : lignes de test restantes (attendu 0)'
SELECT count(*) FROM registres_courrier WHERE code='TSTTRIG';
