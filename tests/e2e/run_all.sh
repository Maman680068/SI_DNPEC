#!/usr/bin/env bash
# Suite complète de bout en bout (API + Chromium) sur une base LOCALE VIDÉE puis remplie
# par les migrations, le seed et le jeu de données de test. Voir README.md.
#
#   bash tests/e2e/run_all.sh            # tout
#   E2E_SANS_BUILD=1 bash ...            # sans recompiler l'API ni le web
#   E2E_SUITES="d9_logistique d9_reservations" bash ...   # quelques suites seulement
#
# Code de sortie : 0 si toutes les suites sont conformes, 1 sinon.
set -uo pipefail
ICI=$(cd "$(dirname "$0")" && pwd); RACINE=$(cd "$ICI/../.." && pwd)
export E2E_OUT=${E2E_OUT:-$ICI/out}
API="$RACINE/apps/api"

# Environnement : variables déjà définies (CI), sinon apps/api/.env (poste local).
if [ -z "${DATABASE_URL:-}" ] && [ -f "$API/.env" ]; then set -a; . "$API/.env"; set +a; fi
bash "$ICI/scripts/garde-locale.sh" || exit 1
export JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:-secret-de-test-e2e-uniquement-local}
export JWT_ACCESS_EXPIRES_IN=${JWT_ACCESS_EXPIRES_IN:-2h}
# Secret partagé web → API (adresse du client des connexions relayées, revue de sécurité 2026-10).
export WEB_PROXY_SECRET=${WEB_PROXY_SECRET:-secret-proxy-e2e-uniquement-local}
# Corps des emails non envoyés écrit dans le journal de l'API (les suites y lisent les liens).
export EMAIL_JOURNAL_CORPS=1
export WEB_APP_URL=${WEB_APP_URL:-http://localhost:3100}
# CORS strict comme en production (jamais « toute origine ») : l'adresse du web saisie avec
# une barre finale et des espaces, plus une seconde origine — l'API doit la normaliser.
export CORS_ORIGIN=${CORS_ORIGIN:-" http://localhost:3100/ ,https://preproduction.exemple.invalid"}
export SMTP_HOST=""   # jamais d'email réel pendant les tests
export DOCUMENTS_STORAGE_PATH="$E2E_OUT/storage"
export NODE_PATH="$API/node_modules"
PSQL_URL="${DATABASE_URL%%\?*}"

rm -rf "$E2E_OUT/etat" "$E2E_OUT/storage" "$E2E_OUT/tmp" && mkdir -p "$E2E_OUT"/{etat,storage,tmp,shots,logs}
RESUME="$E2E_OUT/resume.txt"; : > "$RESUME"
echo "################ 0. BASE NEUVE (locale) ET DÉMARRAGE"
psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' 2>&1 | grep -v NOTICE
(cd "$API" && pnpm exec prisma migrate deploy 2>&1 | grep -E "migrations? found|All migrations|Error") || exit 1
(cd "$API" && pnpm exec prisma generate >/dev/null && pnpm run db:seed 2>&1 | tail -1)
node "$ICI/fixtures.js" >/dev/null || { echo "Jeu de données : échec"; exit 1; }
if [ -z "${E2E_SANS_BUILD:-}" ]; then
  (cd "$API" && pnpm run build >/dev/null) || { echo "Build API KO"; exit 1; }
  (cd "$RACINE/apps/web" && pnpm run build > "$E2E_OUT/logs/web-build.log" 2>&1) || { echo "Build web KO"; tail -30 "$E2E_OUT/logs/web-build.log"; exit 1; }
fi
bash "$ICI/scripts/api.sh" normal || exit 1
bash "$ICI/scripts/api.sh" annee || exit 1
bash "$ICI/scripts/web.sh" || exit 1

# Base neuve : migrations, seed, jeu de données de test (réutilisé entre phases).
base_neuve() {
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  node "$ICI/fixtures.js" >/dev/null || { echo "Jeu de données : échec"; exit 1; }
}

veut() { [ -z "${E2E_SUITES:-}" ] || [[ " $E2E_SUITES " == *" $1 "* ]]; }
lancer() { # titre fichier (api/… ou ui/…)
  local nom; nom=$(basename "$2" .js); veut "$nom" || return 0
  echo; echo "################ $1"
  local sortie; sortie=$(cd "$ICI/$(dirname "$2")" && timeout 900 node "$(basename "$2")" 2>&1); local code=$?
  echo "$sortie"
  local bilan; bilan=$(echo "$sortie" | grep -E "^Bilan : " | tail -1)
  if [ -z "$bilan" ]; then bilan="Bilan : 0 conformes, 1 non conformes (suite interrompue, code $code)"; fi
  echo "$nom | $bilan" >> "$RESUME"
}
sql_triggers() {
  veut trigger_test || return 0
  echo; echo "################ 5. TRIGGERS (SQL direct, transaction annulée)"
  local sortie; sortie=$(psql "$PSQL_URL" -f "$ICI/sql/trigger_test.sql" 2>&1); echo "$sortie" | grep -E "^---|ERROR"
  local refus reste; refus=$(echo "$sortie" | grep -c "ERROR:"); reste=$(echo "$sortie" | tail -3 | grep -E "^ +[0-9]+$" | tr -d ' ')
  if [ "$refus" = 10 ] && [ "$reste" = 0 ]; then echo "trigger_test | Bilan : 2 conformes, 0 non conformes" >> "$RESUME"
  else echo "trigger_test | Bilan : 0 conformes, 2 non conformes (refus $refus/10, reste $reste)" >> "$RESUME"; fi
  tail -1 "$RESUME"
}

# Phase dédiée au paramétrage initial (il crée les registres ARR, DEP… que c1_setup crée aussi) :
# sur la base neuve, puis nouvelle base neuve pour le reste de la suite.
lancer "0a. PARAMÉTRAGE INITIAL (SCRIPT)" api/p_parametrage.js
lancer "0b. CHROMIUM — RÉGLAGES DES STAGES, CATÉGORIES" ui/p_parametrage_ui.js
echo; echo "################ 0c. NOUVELLE BASE NEUVE POUR LA SUITE"
base_neuve
bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
bash "$ICI/scripts/api.sh" annee >/dev/null || exit 1

lancer "1. MISE EN PLACE" api/c1_setup.js
lancer "2. CONCURRENCE" api/c1_concurrence.js
lancer "3. ARRIVÉES" api/c1_arrivees.js
lancer "4. ACTES" api/c1_actes.js
sql_triggers
lancer "6. ANNÉES ET REPRISE" api/c1_annee.js
lancer "7. RAPPELS" api/c1_rappels.js
lancer "8. EXPORT" api/c1_export.js
lancer "9. NOUVEAU COURRIER À IMPUTER" api/c1_a_imputer.js
lancer "10. CHANGEMENT D'ANNÉE" api/c1_report.js
lancer "11. C2 — ROUTES IMPUTABLES / DÉLÉGATAIRES" api/c2_routes.js
lancer "12. C2 — PROJECTION (NOMS, DROITS)" api/c2_projection.js
lancer "13. C2 — TABLEAU DE BORD = DROITS" api/c2_tableau.js
lancer "14. C2 — CONTRÔLE DES DATES (DÉROGATION)" api/c2_dates.js
lancer "15. C2 — COURRIER PERSONNEL DE L’ADMINISTRATEUR" api/c2_admin_courrier.js
lancer "16. E1 — ACCÈS DÉLÉGUÉ ET DROIT DE L'OUVREUR" api/e1_acces_ouvreur.js
lancer "17. E2 — CHANGEMENT DE RÔLE" api/e2_role.js
lancer "18. D2 — DÉCISIONS DE RÉUNION" api/d2_decisions.js
lancer "19. D3 — IMPORT EXCEL" api/d3_import.js
lancer "20. D3 — DOSSIER DU PERSONNEL (NIVEAU 2)" api/d3_dossier.js
lancer "21. F — CLOCHE (API)" api/f1_notifications.js
lancer "21a. D6 — RÔLE STAGIAIRE (TOUTES LES ROUTES)" api/d6_role_stagiaire.js
lancer "21b. D6 — STAGES" api/d6_stages.js
lancer "21c. D6 — ATTESTATION" api/d6_attestation.js
lancer "21d. D6 — LISTES DE CHOIX" api/d6_listes.js
lancer "21e. D9 — LOGISTIQUE" api/d9_logistique.js
lancer "21f. D9 — RÉSERVATIONS ET PRIORITÉ" api/d9_reservations.js
lancer "21g. G3 — DOUBLE AUTHENTIFICATION (API)" api/g3_2fa.js
lancer "21h. G3 — SOCLE : INSCRIPTION, MOT DE PASSE, TÂCHES, CONGÉS, GED, ANNONCES, SONDAGES" api/g3_socle.js
lancer "21i. G4 — AIDE EN LIGNE : PROFILS" api/g4_aide.js
lancer "21j. H — EMAILS DE COMPTE (APPROBATION, REJET, CRÉATION)" api/h_email_comptes.js
lancer "22. CHROMIUM — C2 PAGE" ui/c2_page.js
lancer "23. CHROMIUM — C2 ARRIVÉE" ui/c2_arrivee.js
lancer "24. CHROMIUM — C2 ACTE" ui/c2_acte.js
lancer "25. CHROMIUM — C2 ADMINISTRATION" ui/c2_admin.js
lancer "26. CHROMIUM — C2 CARTE" ui/c2_carte.js
lancer "27. CHROMIUM — C2 DATES" ui/c2_dates_ui.js
lancer "28. CHROMIUM — E3 CHANGEMENT DE RÔLE" ui/e3_role_ui.js
lancer "29. CHROMIUM — D2 DÉCISIONS" ui/d2_decisions_ui.js
lancer "30. CHROMIUM — D3 DOSSIER DU PERSONNEL" ui/d3_dossier_ui.js
lancer "31. CHROMIUM — F CLOCHE, RETOUR, ERREURS" ui/f_finitions_ui.js
lancer "32. CHROMIUM — MESSAGERIE" ui/f_messagerie_ui.js
lancer "33. CHROMIUM — D6 RÔLE STAGIAIRE" ui/d6_role_ui.js
lancer "34. CHROMIUM — D6 STAGES" ui/d6_stages_ui.js
lancer "35. CHROMIUM — D9 LOGISTIQUE" ui/d9_logistique_ui.js
lancer "36. CHROMIUM — G3 DOUBLE AUTHENTIFICATION" ui/g3_2fa_ui.js
lancer "37. CHROMIUM — G4 AIDE EN LIGNE" ui/g4_aide_ui.js
lancer "38. CHROMIUM — H EMAILS DE COMPTE" ui/h_email_comptes_ui.js
lancer "38b. SOCLE N1 : REPRISE, ORGANIGRAMME, AGENTS, FINS PRÉVUES, RÔLES FONCTIONNELS, REFUS JOURNALISÉS" api/n1_socle.js
lancer "38c. CHROMIUM — SOCLE N1 : ORGANIGRAMME, AGENTS ET FIN PRÉVUE, RÔLES FONCTIONNELS (BUREAU, TÉLÉPHONE)" ui/n1_socle_ui.js
lancer "38d. SOCLE N2 : RÉAUTHENTIFICATION, JOURNAL INALTÉRABLE, CONNEXIONS, PARAMÈTRES, SUPERVISION, COMPTE ↔ AGENT" api/n2_securite.js
lancer "38e. CHROMIUM — SOCLE N2 : RÉAUTHENTIFICATION, JOURNAL D’AUDIT, PARAMÉTRAGE ET SUPERVISION (BUREAU, TÉLÉPHONE)" ui/n2_securite_ui.js
lancer "38e-bis. EXPLOITATION : DISQUE, TAILLE DE LA BASE, VÉRIFICATION NOCTURNE DU JOURNAL D’AUDIT, SAUVEGARDE DES FICHIERS" api/x_exploitation.js
lancer "38f. SOCLE N3 : CIRCUIT DES CONGÉS (AVIS, ALERTE, TACITE, DRH), MOTIF MÉDICAL, PURGE DES MESSAGES, AVANCEMENT, RAPPORT DE STAGE" api/n3_metier.js
lancer "38g. CHROMIUM — SOCLE N3 : AVIS ET DÉCISION DE CONGÉ, AVANCEMENT CALCULÉ, RAPPORT DE STAGE (BUREAU, TÉLÉPHONE)" ui/n3_metier_ui.js
lancer "38h. SOCLE N4 : STATUT DE DIFFUSION, MENTION SUR LES EXPORTS, MÉTADONNÉES ET LIENS GED, DOCUMENTS GÉNÉRÉS" api/n4_documents.js
lancer "38i. CHROMIUM — SOCLE N4 : STATUT ET MÉTADONNÉES GED, DÉPÔT DEPUIS UNE TÂCHE, DOCUMENTS GÉNÉRÉS (BUREAU, TÉLÉPHONE)" ui/n4_documents_ui.js
lancer "38j. SOCLE N5 : PLAN DE TRAVAIL, ALERTES D'ÉCHÉANCE, NOTIFICATIONS ET RÉSUMÉ, FILS DE DISCUSSION, RECHERCHE, INSTRUCTIONS" api/n5_pilotage.js
lancer "38j-bis. PERFORMANCE : VUE DE SUIVI DES TÂCHES, DÉCOMPTES, LISTES = DÉTAIL, REPRISE DES EMAILS, LOTS, QUOTA" api/p_performance.js
lancer "38j-ter. CHROMIUM — PERFORMANCE : TABLEAU DE BORD BORNÉ, MES TÂCHES, COMPTEURS SUSPENDUS ONGLET CACHÉ" ui/p_performance_ui.js
lancer "38k. CHROMIUM — SOCLE N5 : PLAN DE TRAVAIL, RECHERCHE, FIL, PRÉFÉRENCES, INSTRUCTIONS (BUREAU, TÉLÉPHONE)" ui/n5_pilotage_ui.js
lancer "38l. SOCLE N6 : EFFECTIFS ET ALERTES RH, CARRIÈRE ET ACTES, FICHES DE POSTE, FORMATION, VÉHICULES, TABLEAU DE BORD PAR RÔLE" api/n6_rh.js
lancer "38m. CHROMIUM — SOCLE N6 : RESSOURCES HUMAINES, VÉHICULES, TABLEAU DE BORD PAR RÔLE (BUREAU, TÉLÉPHONE)" ui/n6_rh_ui.js
lancer "38n. CHROMIUM — ACCESSIBILITÉ WCAG 2.1 AA DES ÉCRANS PRINCIPAUX (AXE, BUREAU, TÉLÉPHONE)" ui/n6_accessibilite_ui.js
lancer "38o. SÉCURITÉ : ROUTES PUBLIQUES, 401 SANS JETON, JETON FORGÉ, EXPIRÉ OU NON SIGNÉ, INVENTAIRE DES GARDES" api/s1_routes.js
lancer "38p. SÉCURITÉ : CONGÉS MALADIE, VERROU PAR IP, DÉCONNEXION, QUOTAS, 2FA, LIENS DE RÉINITIALISATION, SESSIONS, TÉLÉCHARGEMENTS, EN-TÊTES" api/s2_securite.js
# Liens : après toutes les suites, pour contrôler aussi les notifications et emails réellement produits.
lancer "39a. LIENS DE L'API VERS LE WEB (CODE, NOTIFICATIONS, EMAILS) ET ANCIENS FORMATS" api/i_liens.js
lancer "39b. CHROMIUM — ANCIENS LIENS (CONNECTÉ, NON CONNECTÉ) ET PAGE 404" ui/i_liens_ui.js
lancer "39b-bis. RAPPORT DE QUALITÉ DES DONNÉES (LECTURE SEULE, CHIFFRES EXACTS, SANS NOMS POUR LE WORKFLOW)" api/q_qualite_donnees.js
lancer "39c. CONFIGURATION DE PRODUCTION : CORS STRICT, ORIGINES REFUSÉES, VERSION DÉPLOYÉE" api/j_production.js
lancer "39d. CHROMIUM — CLOCHE EN CONDITIONS DE PRODUCTION, ORIGINE REFUSÉE, API INJOIGNABLE" ui/j_cloche_production_ui.js
lancer "39e. CHROMIUM — ACCUEIL PUBLIC COMPACT (4 ÉCRANS, TÉLÉPHONE, TABLETTE)" ui/k_accueil_ui.js
lancer "39f. MATRICE DES HABILITATIONS (ANNEXE 1) : CASES JOUÉES, ÉCARTS CONSERVÉS, LOTS À VENIR" api/n1_matrice.js

# Reprise N1 sur un jeu réaliste : base d'avant N1, chargement, N1 appliqué (reprise au démarrage de
# l'API), retour arrière (n1_down.sql), schéma et données comparés, puis ré-application.
if veut n1_reprise; then
  echo; echo "################ 39g. REPRISE N1 SUR UN JEU RÉALISTE — AVANT, APRÈS, RETOUR ARRIÈRE, RÉ-APPLICATION"
  arreter_api() { for f in "$E2E_OUT"/logs/api-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done; sleep 1; }
  arreter_api
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  # Retour arrière dans l'ordre inverse des lots : N5, N4, N3, N2 puis N1.
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n3_down.sql" >/dev/null || { echo "Retour arrière N3 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n2_down.sql" >/dev/null || { echo "Retour arrière N2 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n1_down.sql" >/dev/null || { echo "Retour arrière N1 : échec"; exit 1; }
  export N1_MODE=charger; lancer "39g-1. ÉTAT D'AVANT N1 : JEU RÉALISTE CHARGÉ, EMPREINTE" api/n1_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Migration N1 : échec"; exit 1; }
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
  export N1_MODE=apres; lancer "39g-2. N1 APPLIQUÉ : REPRISE CONTRÔLÉE, DONNÉES D'AVANT INTACTES" api/n1_reprise.js
  arreter_api
  # Retour arrière dans l'ordre inverse des lots : N5, N4, N3, N2 puis N1.
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n3_down.sql" >/dev/null || { echo "Retour arrière N3 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n2_down.sql" >/dev/null || { echo "Retour arrière N2 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n1_down.sql" >/dev/null || { echo "Retour arrière N1 : échec"; exit 1; }
  export N1_MODE=retour; lancer "39g-3. RETOUR ARRIÈRE : SCHÉMA ET DONNÉES D'AVANT RETROUVÉS" api/n1_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Ré-application N1 : échec"; exit 1; }
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
  export N1_MODE=apres; lancer "39g-4. RÉ-APPLICATION DE N1 : MÊME REPRISE" api/n1_reprise.js
  unset N1_MODE
fi

# Migration N2 sur une base N1 chargée (journal d'audit volumineux, comptes sans agent), retour
# arrière (n2_down.sql), schéma et données comparés, puis ré-application. API arrêtée : la phase
# ne touche que la base.
if veut n2_reprise; then
  echo; echo "################ 39h. MIGRATION N2 SUR UNE BASE N1 — APRÈS, RETOUR ARRIÈRE, RÉ-APPLICATION"
  for f in "$E2E_OUT"/logs/api-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done; sleep 1
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n3_down.sql" >/dev/null || { echo "Retour arrière N3 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n2_down.sql" >/dev/null || { echo "Retour arrière N2 : échec"; exit 1; }
  export N2_MODE=charger; lancer "39h-1. ÉTAT N1 : COMPTES ET JOURNAL D'AUDIT CHARGÉS, EMPREINTE" api/n2_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Migration N2 : échec"; exit 1; }
  export N2_MODE=apres; lancer "39h-2. N2 APPLIQUÉ : JOURNAL SCELLÉ, COMPTES AVEC AGENT, DONNÉES INTACTES" api/n2_reprise.js
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n3_down.sql" >/dev/null || { echo "Retour arrière N3 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n2_down.sql" >/dev/null || { echo "Retour arrière N2 : échec"; exit 1; }
  export N2_MODE=retour; lancer "39h-3. RETOUR ARRIÈRE : SCHÉMA ET DONNÉES D'AVANT N2" api/n2_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Ré-application N2 : échec"; exit 1; }
  export N2_MODE=apres; lancer "39h-4. RÉ-APPLICATION DE N2" api/n2_reprise.js
  unset N2_MODE
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
fi

# Migration N3 sur une base N2 chargée (tâches à avancement saisi, congés, stage), retour arrière
# (n3_down.sql), schéma et données comparés, puis ré-application. API arrêtée.
if veut n3_reprise; then
  echo; echo "################ 39i. MIGRATION N3 SUR UNE BASE N2 — APRÈS, RETOUR ARRIÈRE, RÉ-APPLICATION"
  for f in "$E2E_OUT"/logs/api-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done; sleep 1
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n3_down.sql" >/dev/null || { echo "Retour arrière N3 : échec"; exit 1; }
  export N3_MODE=charger; lancer "39i-1. ÉTAT N2 : TÂCHES, CONGÉS ET STAGE CHARGÉS, EMPREINTE" api/n3_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Migration N3 : échec"; exit 1; }
  export N3_MODE=apres; lancer "39i-2. N3 APPLIQUÉ : AVANCEMENT RECALCULÉ, AUCUN AVIS INVENTÉ, DONNÉES INTACTES" api/n3_reprise.js
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n3_down.sql" >/dev/null || { echo "Retour arrière N3 : échec"; exit 1; }
  export N3_MODE=retour; lancer "39i-3. RETOUR ARRIÈRE : SCHÉMA ET DONNÉES D'AVANT N3" api/n3_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Ré-application N3 : échec"; exit 1; }
  export N3_MODE=apres; lancer "39i-4. RÉ-APPLICATION DE N3" api/n3_reprise.js
  unset N3_MODE
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
fi

# Migration N4 sur une base N3 chargée (documents privés et publiés sur deux ans), retour arrière
# (n4_down.sql), schéma et données comparés, puis ré-application. API arrêtée.
if veut n4_reprise; then
  echo; echo "################ 39j. MIGRATION N4 SUR UNE BASE N3 — APRÈS, RETOUR ARRIÈRE, RÉ-APPLICATION"
  for f in "$E2E_OUT"/logs/api-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done; sleep 1
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  export N4_MODE=charger; lancer "39j-1. ÉTAT N3 : DOCUMENTS CHARGÉS, EMPREINTE" api/n4_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Migration N4 : échec"; exit 1; }
  export N4_MODE=apres; lancer "39j-2. N4 APPLIQUÉ : TYPE, DATE, STATUT REPRIS, DONNÉES INTACTES" api/n4_reprise.js
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n4_down.sql" >/dev/null || { echo "Retour arrière N4 : échec"; exit 1; }
  export N4_MODE=retour; lancer "39j-3. RETOUR ARRIÈRE : SCHÉMA ET DONNÉES D'AVANT N4" api/n4_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Ré-application N4 : échec"; exit 1; }
  export N4_MODE=apres; lancer "39j-4. RÉ-APPLICATION DE N4" api/n4_reprise.js
  unset N4_MODE
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
fi

# Migration N5 sur une base N4 chargée (tâches en retard ou non, emails déjà partis), retour arrière
# (n5_down.sql), schéma et données comparés, puis ré-application. API arrêtée.
if veut n5_reprise; then
  echo; echo "################ 39k. MIGRATION N5 SUR UNE BASE N4 — APRÈS, RETOUR ARRIÈRE, RÉ-APPLICATION"
  for f in "$E2E_OUT"/logs/api-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done; sleep 1
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  export N5_MODE=charger; lancer "39k-1. ÉTAT N4 : TÂCHES ET NOTIFICATIONS CHARGÉES, EMPREINTE" api/n5_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Migration N5 : échec"; exit 1; }
  export N5_MODE=apres; lancer "39k-2. N5 APPLIQUÉ : RETARDS ANCIENS RÉPUTÉS SIGNALÉS, EMAILS PARTIS, DONNÉES INTACTES" api/n5_reprise.js
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n5_down.sql" >/dev/null || { echo "Retour arrière N5 : échec"; exit 1; }
  export N5_MODE=retour; lancer "39k-3. RETOUR ARRIÈRE : SCHÉMA ET DONNÉES D'AVANT N5" api/n5_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Ré-application N5 : échec"; exit 1; }
  export N5_MODE=apres; lancer "39k-4. RÉ-APPLICATION DE N5" api/n5_reprise.js
  unset N5_MODE
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
fi

# Migration N6 sur une base N5 chargée (dossiers, pièces, ordres de mission), retour arrière
# (n6_down.sql), schéma et données comparés, puis ré-application. API arrêtée.
if veut n6_reprise; then
  echo; echo "################ 39l. MIGRATION N6 SUR UNE BASE N5 — APRÈS, RETOUR ARRIÈRE, RÉ-APPLICATION"
  for f in "$E2E_OUT"/logs/api-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done; sleep 1
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  export N6_MODE=charger; lancer "39l-1. ÉTAT N5 : DOSSIERS, PIÈCES ET ORDRES DE MISSION CHARGÉS, EMPREINTE" api/n6_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Migration N6 : échec"; exit 1; }
  export N6_MODE=apres; lancer "39l-2. N6 APPLIQUÉ : COLONNES VIDES, PARAMÉTRAGE LIVRÉ, DONNÉES INTACTES" api/n6_reprise.js
  psql -q -v ON_ERROR_STOP=1 "$PSQL_URL" -f "$API/prisma/retour-arriere/n6_down.sql" >/dev/null || { echo "Retour arrière N6 : échec"; exit 1; }
  export N6_MODE=retour; lancer "39l-3. RETOUR ARRIÈRE : SCHÉMA ET DONNÉES D'AVANT N6" api/n6_reprise.js
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1) || { echo "Ré-application N6 : échec"; exit 1; }
  export N6_MODE=apres; lancer "39l-4. RÉ-APPLICATION DE N6" api/n6_reprise.js
  unset N6_MODE
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
fi

# Données de démonstration (prisma/demo.ts) : en dernier, car chaque phase repart d'une base neuve.
demo_voulue() { veut z_demo_creer || veut z_demo_ui || veut z_demo_supprimer || veut z_demo_apres_ui || veut z_demo_sans_dn; }
if demo_voulue; then
  echo; echo "################ 40. DÉMONSTRATION — BASE NEUVE, PARAMÉTRAGE, JEU DE TEST « RÉEL »"
  base_neuve
  (cd "$API" && pnpm run -s db:parametrage >/dev/null) || { echo "Paramétrage : échec"; exit 1; }
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
  lancer "40a. DÉMONSTRATION : CRÉATION, DONNÉES RÉELLES INTACTES, EMAILS, RELANCE, EXPIRATION" api/z_demo_creer.js
  lancer "40b. CHROMIUM — DÉMONSTRATION : ÉCRANS REMPLIS, VUE DIRECTION" ui/z_demo_ui.js
  lancer "40c. DÉMONSTRATION : SUPPRESSION" api/z_demo_supprimer.js
  lancer "40d. CHROMIUM — DÉMONSTRATION : PLUS RIEN DE « TEST » À L'ÉCRAN" ui/z_demo_apres_ui.js
  echo; echo "################ 41. DÉMONSTRATION SUR UNE BASE SANS AUCUN COMPTE RÉEL"
  psql -q "$PSQL_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' >/dev/null 2>&1
  (cd "$API" && pnpm exec prisma migrate deploy >/dev/null 2>&1 && pnpm run -s db:seed >/dev/null && pnpm run -s db:parametrage >/dev/null) || { echo "Base neuve : échec"; exit 1; }
  bash "$ICI/scripts/api.sh" normal >/dev/null || exit 1
  lancer "41. DÉMONSTRATION : DN DE DÉMONSTRATION SI AUCUN DN RÉEL" api/z_demo_sans_dn.js
fi

for f in "$E2E_OUT"/logs/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; done
echo; echo "################ RÉSUMÉ"
cat "$RESUME"
awk -F'Bilan : ' '{ split($2, a, " "); ok += a[1]; ko += a[3]; n++ } END { printf "\nTOTAL : %d suites, %d contrôles conformes, %d non conformes\n", n, ok, ko; exit (ko > 0 || n == 0) }' "$RESUME"
