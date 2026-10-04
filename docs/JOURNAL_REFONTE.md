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
