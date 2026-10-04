# Journal de la refonte de l'interface — étapes 3 à 8

Reprise après interruption : lire ce journal de haut en bas, puis la dernière entrée « À faire ensuite ».

## Contexte
- Branche : `feature/ui-refonte-etapes-3-8` (partie de la production `main`,
  après la fusion de la PR #23 — étapes 1 et 2).
- Maquettes : étapes 3 à 7 (12 écrans) et étape 8 (6 écrans : instructions, annuaire, effectifs,
  paramètres, fenêtre d'acte, fenêtre de réunion).
- Règles : aucune migration, aucun changement de droits ni de règle métier, accueil / connexion /
  demande d'accès intouchés ; toute donnée nouvelle par une route de lecture avec test 403 ; ne rien fusionner.
- Composants communs : `apps/web/components/ui/Charte.tsx` (+ `FenetreDetail.tsx`).

## Avancement
| Étape | Écrans | État |
|---|---|---|
| 3 | Congés : page agent, fenêtres avis / décision ; `GET api/v1/conges/:id/contexte` | fait (agent), à intégrer |
| 4 | Archives : page, fenêtre document ; `GET api/v1/documents/synthese` | fait (agent), à intégrer |
| 5 | Courrier : page, fenêtres arrivée / acte ; compteurs `GET /courrier/tableau-de-bord` | fait (agent), à intégrer |
| 6 | Messagerie, Réunions, Plan ; `api/v1/messages/avec/:id/contexte`, décisions à suivre | en cours (agent) |
| 7 | Personnel (`GET api/v1/rh/dossiers`), Logistique, Supervision | fait (agent), à intégrer |
| — | Écrans non maquettés (instructions, annuaire, RH, stagiaires, organisation, agents, suggestions, documents générés…) | fait (agent), à reprendre avec l'étape 8 |
| 8 | Instructions, Annuaire, Effectifs, Paramètres, fenêtre d'acte, fenêtre de réunion | à faire |
| — | Passe de cohérence, suite complète, guide + PDF, captures, PR, CI | à faire |

## Entrées
### 2026-10-04 00:00
- Captures « avant » prises sur la production : `scratchpad/ecrans37_avant/` (script `scratchpad/captures37.js`).
- Branche renommée `feature/ui-refonte-etapes-3-7` → `feature/ui-refonte-etapes-3-8` (rien n'était poussé).
- À faire ensuite : attendre l'agent de l'étape 6 ; étape 8 ; nettoyage (`apps/web_ag6`, `apps/web_docs`,
  `tests/e2e/api/_tmp_*`) ; passe de cohérence ; `run_all.sh` (nouvelles suites) ; suite complète.

### 2026-10-04 00:30
- Captures « avant » de l'étape 8 prises sur la production locale (scratchpad `ecrans37_avant/` 13, 14, 15, 28–34).
- Agents lancés pour l'étape 8 : A (instructions, annuaire, suggestions + fenêtre, documents générés, organisation ;
  ports 3410/3420), B (RH effectifs + onglets, stagiaires, fiche agent ; 3430/3440), C (fenêtre d'acte, paramètres,
  journal d'audit ; 3450/3460). L'agent de l'étape 6 a reçu en plus la fenêtre de réunion (maquette) et les
  fenêtres annonce/sondage. Brief : scratchpad `BRIEF_ETAPE_8.md`.
- Fait par moi : filtre de lecture « Période couverte » (`GET /documents?couvreDu=&couvreAu=`, chevauchement) +
  tests dans `u_archives.js` ; 5 nouvelles suites ajoutées à `run_all.sh` (38m-quinquies → nonies).
- Typecheck API et web : OK à 00:30.
- À faire ensuite : comptes rendus des 4 agents → intégration ; guide (libellés, vérifier dans le code au moment
  de l'écrire) ; nettoyage ; passe de cohérence ; suite complète.

### 2026-10-04 (après les comptes rendus 6, 8B, 8C)
- Reçus : étape 6 (+ fenêtre réunion, annonce, sondage), 8B (RH effectifs + export agrégé, stagiaires, agents),
  8C (fenêtre d'acte, paramètres, journal d'audit). Choix tranchés consignés dans scratchpad `CHOIX_AGENTS.md`.
- `run_all.sh` : + `u_effectifs_indicateurs.js` (38m-decies). « Documents issus » passé à la charte.
  `CarteStages.tsx` (mort, émoji) supprimé. Copies `apps/web_ag6`, `apps/web_docs` supprimées.
- En attente : agent 8A (instructions, annuaire, suggestions, documents générés, organisation) — suites
  `u_annuaire.js`, `u_instructions_export.js` en cours chez lui.

### 2026-10-04 (tous les agents rendus, passe de cohérence)
- Agent 8A reçu. Retiré : la route `api/v1/annuaire` qui exposait l'email de tout le personnel (élargissement de
  visibilité, interdit) → annuaire sans bouton Email ; suite `u_annuaire.js` supprimée, test UI adapté.
- `run_all.sh` : + `u_instructions_export.js`, `ui/u_annuaire_suggestions_ui.js`.
- Cohérence : refus = « Rejeter avec un motif » partout (congés DRH, logistique demandes et réservations,
  périodes de stage, nominations), décision positive = « Valider » (congés DRH : « Approuver » → « Valider ») ;
  « Ouvrir » → « Voir » (blocs du tableau de bord) ; « + Attribuer un rôle » → bouton charte ; tons : Annulé = gris
  partout, « À valider » = ambre.
- Guide `guides.json` mis à jour (libellés des 4 agents + harmonisation). Typecheck OK.
- Serveurs « avant » (3000/3100) arrêtés. Suite complète lancée (log scratchpad `ui_e2e.log`).
- À faire ensuite : lire le bilan, corriger ; puis captures aide + PDF (`ui_aide.sh`), captures après, commit, PR.

### 2026-10-04 01:10 — 1re suite complète : 25 contrôles rouges, cause trouvée
- L'ancien web « avant » (et une copie d'agent) tenait encore le port 3100 : les tests d'interface ont tourné
  contre l'ancienne interface. Processus tués (vérifier `lsof -i :3100` avant toute relance).
- Vrai défaut : `CongesContexteController` dans le fichier de `LeaveRequestsController` → l'inventaire des
  routes (s1_routes, d6_role_stagiaire) l'attribuait à `/leaves`. Déplacé dans `conges-contexte.controller.ts`.
- 2e suite complète lancée.

### 2026-10-04 — 2e suite complète : 3964 conformes, 3 non conformes (corrigés)
- c2_arrivee et n4_documents_ui : lecture du titre / de l'onglet avant fin de chargement → attente ajoutée.
- z_demo_ui : débordement horizontal de /reunions au téléphone (textes `sr-only` hors cadre) → `relative` sur
  leurs conteneurs. Contrôle de débordement refait sur 19 écrans au téléphone : aucun.
- En cours : rejeu des suites fonctionnelles (sans reprises) puis captures de l'aide + PDF (`ui_aide.sh`).
- Ensuite : captures « après » (base de démonstration, `ui_start.sh` + `captures37.js` → `ecrans37_apres/`),
  copie dans `docs/refonte_interface/captures/etapes_3_8/`, commit, push, PR, CI.

### 2026-10-04 — captures, commit
- Rejeu des suites fonctionnelles : 3295 conformes, 2 non conformes (f_messagerie_ui : lecture avant chargement →
  attentes ajoutées ; reste « aucune pastille » qui dépend des non-lus laissés par les exécutions précédentes,
  vert sur base neuve). Captures de l'aide (30) et PDF régénérés ; `captures_aide.js` suit les nouveaux sélecteurs.
- Captures avant/après (33 + 33) dans `docs/refonte_interface/captures/etapes_3_8/`.
- Commit sur `feature/ui-refonte-etapes-3-8`, puis push et PR vers la production.

### 2026-10-04 — PR ouverte
- PR https://github.com/Maman680068/SI_DNPEC/pull/24 (feature/ui-refonte-etapes-3-8 → production), abonnement
  aux événements. CI `e2e` en file. À faire : attendre la CI ; si rouge, corriger et pousser. Ne rien fusionner.

## Étape 9 — finitions (branche `feature/ui-finitions`, partie de la production b155b75)

### 2026-10-04 — démarrage
- Maquettes : scratchpad `maquettes9/` (profil, form-tache, form-conge, cloche, recherche, toast-squelette).
- Captures « avant » : scratchpad `ecrans9_avant/` (22 fichiers : vérification + profil introuvable, erreur
  d'imputation, Instructions vide, barres de défilement), prises sur la base locale `dnpec_verif` (code = production).
- Fait par moi : API — points de supervision dans « À traiter » de l'administrateur
  (`SupervisionService.pointsATraiter`, cache 1 min ; `ATraiter.detail/gravite`), route de lecture
  `GET api/v1/conges/simulation` (règle de `create`) ; web — kit commun `components/ui/Formulaire.tsx`
  (FenetreFormulaire, Champ, Saisie, ZoneTexte, Liste, ChoixSegment, ChampDate, ZoneDepot, SelecteurPersonnes,
  Case, validation dans la fenêtre), `Toast.tsx` (ToastProvider dans le layout), `Squelette.tsx` (Chargement →
  squelette, démarrage → SqueletteApplication), `Filtres` (Charte), barres de défilement (globals.css, limitées à
  `.contraste-aa`) + `DefilementVisible`, `Fenetre` = nouveau modèle ; tableau de bord : prénom sans « TEST — »,
  « À traiter » avec points de supervision.
- Agents lancés (brief scratchpad `BRIEF_ETAPE_9.md`) : A tâches/congés/réunions/instructions/plan/tableau de bord
  (3510/3520), B courrier/documents/documents générés/logistique (3530/3540), C RH/personnel/agents/organisation/
  stages/utilisateurs/suppléances/paramétrage/journal (3550/3560), D communication/suggestions/annuaire/recherche/aide
  (3570/3580).
- À faire moi : page Mon profil + redirections, cloche, recherche de la barre du haut, démo (instructions).

### 2026-10-04 — ma part de l'étape 9 (pendant que les agents travaillent)
- API : `GET api/v1/profil` (module `profil/`, son propre profil seulement, ouvert aux stagiaires, ajouté à la
  liste blanche de `d6_role_stagiaire`), lien de l'email de résumé → `/compte?section=notifications`.
- Web : page `/compte` « Mon profil » (identité, unité, chef direct, matricule, complétude ; Sécurité : mot de passe
  par lien envoyé (route existante forgot-password), double authentification, sessions ouvertes (routes existantes) ;
  Notifications ; Aide). Anciennes pages supprimées, redirigées (`anciens-liens.json`). Menu « Mon compte » →
  Mon profil / Sécurité / Préférences. Cloche refaite (jours, filtres, icônes). Recherche pendant la frappe dans
  la barre du haut. Démo : bloc « Instructions de la Direction » (DN de démonstration seulement), testé
  création + suppression sur base jetable `dnpec_demo9` ; contrôle ajouté à `z_demo_creer`.
- Tests : `api/u_profil.js`, `ui/u_finitions_ui.js` (ajoutés à run_all), `ui/g3_2fa_ui.js` adapté.
- Reste moi : n5_pilotage_ui (préférences → profil) et captures_aide (securite.png) après l'agent A ; guide.

### 2026-10-04 — retour des agents et intégration
- A (tâches, congés, réunions, instructions, plan, tableau de bord), B (courrier dont imputation, archives, documents
  générés, logistique), C (RH, personnel, agents, organisation, stages, utilisateurs, suppléances, paramétrage,
  journal), D (communication, suggestions, annuaire, recherche, aide) : formulaires convertis, toasts, squelettes,
  `Filtres` ; tests UI adaptés ; nouvelle suite `api/u_conges_simulation.js` (ajoutée à run_all).
- Composants communs corrigés d'après leurs retours : `ChampDate` (calendrier en position fixe, jamais coupé par la
  fenêtre ; saisie qui remplace la date affichée ; date hors bornes → message), `SelecteurPersonnes` (liste ouverte
  au clic ou à la frappe, nommée « Personnes proposées »), Échap qui ne ferme plus une fiche quand une liste est
  ouverte, `messageErreur` sans message anglais de validation, `Saisie` avec `step`/`inputMode`, messages des
  champs retirés effacés.
- Guide : libellés repris (congé, réunion, plan, instructions, tâche, jours fériés, attestation, stage, mouvement).
- Typecheck API et web verts ; `n6_accessibilite_ui` couvre aussi `/compte`, `/recherche`, tableau de bord admin.
- Suite complète lancée.

### 2026-10-04 — validation et livraison
- Suite complète locale : 122 suites, 4 245 contrôles conformes, 0 non conforme (après correction : contrôles de
  `u_profil` — le DN lit la supervision, règle N2 inchangée ; cache d'une minute —, `u_finitions_ui` — précision de
  supervision variable —, `n4_documents_ui` — message de date hors bornes —, `i_liens` — sections de « Mon profil »).
  Un premier passage avait échoué parce qu'un serveur web de capture tournait encore sur le port 3100 (pages
  périmées) : arrêt systématique des serveurs entre deux étapes.
- Rejeu fonctionnel (81 suites, 3 473 conformes), captures du guide et PDF régénérés.
- Matrice des habilitations régénérée : identique (mêmes 4 écarts connus, aucun non conforme) ; le document datait
  de N5 et est rafraîchi depuis la sortie de `n1_matrice.js`, inchangé dans cette branche.
- Captures avant/après : `docs/refonte_interface/captures/etape_9/` (22 + 37, `LISTE.md`). Point 11 : Chromium
  sans fenêtre masque les barres ; « avant » reconstituée en retirant les seules règles de l'étape 9.
- Instructions : état vide sans droit d'émettre ni archives → lien « Comment fonctionnent les instructions ».
- Commit sur `feature/ui-finitions`, push, PR vers la production.
