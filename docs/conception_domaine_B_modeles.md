# Conception du domaine B — Modélisation et simulation (NIMBA)

*Document de conception, sans code applicatif. SI DNPEC, octobre 2026.*
*Références : cahier NIMBA v2.2 (Partie 0, Partie B, annexes) ; architecture en production décrite dans `docs/Guide_developpeur.md` (socle N1 à N6).*
*Convention : une règle du cahier est citée avec sa référence. Quand le cahier ne dit rien, le texte porte la mention « (proposition) ».*

---

## 1. Objet, périmètre et principes

### 1.1 Objet

Ce document décrit comment ajouter au SI en production le domaine B du cahier NIMBA : référentiel des modèles, exécution, scénarios et chocs, contrôles de cohérence, restitution, diffusion. Il réutilise le socle déjà livré (N1 à N6) et ne touche à aucun module du domaine A. Il sert de base à la validation demandée par la règle de travail n° 2 de `docs/Guide_developpeur.md` : aucune ligne de code avant l'accord du responsable du projet.

### 1.2 Périmètre

Dans le périmètre :
- le référentiel (B3, B4) : modèles, versions immuables, fichiers, bases de référence, paramètres de choc, indicateurs de sortie, contrôles déclarés ;
- l'exécution (B5, B10) : scénarios, chocs, file d'exécution, scénario de référence, fiche de simulation, rejeu ;
- les contrôles (B6) : batterie déclarée, bloquant ou alerte, dérogation ;
- la restitution (B7.1, B7.2), la comparaison, le test de sensibilité et les exports ;
- les données (B3.4, B9.15) : séries, imports, dictionnaire des variables ;
- les rapports (B7.5, B9.10) : RPEF, note de conjoncture et éléments de cadrage du CDMT, rattachés à la GED et aux actes du Courrier ;
- les huit modèles demandés : TOFE, PIB_3FEUILLES, PIB_DEMANDE, IHPC, programmation financière trimestrielle (avec le module Dette/AVD), CDMT, famille MEGC sous GAMS et tableau entrées-sorties.

Hors périmètre de ce document, ou repoussé à un lot tardif :
- la couche d'IA (B11, MOD-EF-47 à 59) : le mode expert (B11.4, MOD-EF-74) suffit pour tout le cycle. Le recours à un service externe attend la décision D-08 ;
- les enchaînements entre modèles (B5.8, MOD-EF-60 à 63, D-27) ;
- le modèle de prévision infra-annuelle (B1.3, D-26) ;
- les connecteurs BCRG/INS (B3.4) et l'archivage à valeur probante (B13.2).

### 1.3 Principes repris du cahier

| Principe | Référence | Traduction dans la conception |
|---|---|---|
| Le produit ne réécrit aucun modèle : il les héberge, les exécute et les trace | B1, MOD-EF-81, B13.2 | Les fichiers sont conservés tels quels. La seule modification admise est l'inclusion d'un fichier de chocs (B10.2) |
| Le référentiel fait foi ; une version déposée est immuable | B3.1, MOD-EF-02/03, CR-02, D-11 | La base refuse toute modification d'une version déposée (déclencheur), comme elle le fait déjà pour `audit_logs` |
| Toute exécution produit une fiche, et une fiche est rejouable | B3.3, B5.7, MOD-EF-70 | Les entrées sont figées dans la fiche et une empreinte est calculée (MOD-EF-76) |
| Les deux axes sont orthogonaux ; le rang ne donne aucun privilège dans le domaine B | §5, §5.3 règle 4, §5.4 | `AutorisationService.exiger` avec `perimetre: 'IGNORE'` et des rôles B requis. Visibilité par statut |
| Une simulation exploratoire est un objet protégé | §3.2, annexe 1.3 | Étape 1 de `exiger` (protégé → besoin d'en connaître) |
| L'état d'exécution est produit par le moteur ; le statut de diffusion est décidé par un rôle | §7.1 | Deux colonnes distinctes. Une simulation échouée ou non convergée ne porte aucun statut |
| Le service de calcul est un exécutant sans état, qui n'écrit jamais en base | §11.3 | Le dorsal NestJS porte la machine à états, la file, les écritures. Le moteur ne connaît que le contrat |
| Une seule interface pour tous les moteurs | B10.1, §11.3 | Interface `MoteurCalcul` à six opérations. Les adaptateurs sont interchangeables (simulé, Python, Excel, GAMS) |
| Aucun chiffre ne vient de l'IA ni d'une saisie manuelle de coefficients en production | MOD-EF-79, D-32 | Le moteur simulé est un dispositif de développement et de recette, marqué comme tel et jamais diffusable (§3) |
| Les lots 0 à 2 ne dépendent pas de la licence GAMS | §17.1, §16.3 | Lots B1 à B4 sur moteur simulé, B5 et B6 en Python, GAMS en dernier (§7) |

---

## 2. Architecture intégrée au socle existant

### 2.1 Vue d'ensemble

```
Navigateur (apps/web, écrans /modelisation/*)
        │  apiFetch, routes /api/v1
        ▼
API NestJS (apps/api) ── module modeles/ (nouveau)
  ├─ ReferentielService     modèles, versions, fichiers, bases, paramètres, indicateurs
  ├─ ScenariosService       scénarios, chocs, chocs types
  ├─ SimulationsService     fiche, statut de diffusion, rejeu, comparaison, sensibilité
  ├─ FileExecutionService   file (table) + tâche planifiée « file-simulations »
  ├─ MoteursService         choix de l'adaptateur → interface MoteurCalcul (B10.1)
  │     ├─ MoteurSimule     (dans le processus de l'API, lots B1 à B4)
  │     └─ MoteurDistant    (client du service de calcul : HTTP ou agent qui vient chercher le travail)
  └─ réutilise : AutorisationService, PreuveIdentiteService, AuditService, NotificationsService,
                 StorageService, ExportsService, ParametresService, TachesPlanifieesService,
                 ActesService (surSignature), DocumentsService, Activite (plan de travail)
        │
        ▼ (lots B5 et suivants) compte de service unique (SOC-HEB-04)
Service de calcul (Python, sans état, aucun accès à la base) ── adaptateurs Python / Excel / GAMS
        └─ une exécution = un répertoire de travail isolé, détruit après la collecte (B10.6)
```

### 2.2 Module `modeles/` dans l'API

Il suit la structure en place : `modeles.module.ts`, des contrôleurs minces sous `@Controller('api/v1')`, toute l'autorisation dans les services, des DTO class-validator et des sélections `XXX_SELECT satisfies Prisma.XxxSelect`. Les erreurs utilisent l'enveloppe `{ code, message, details, trace_id }` déjà produite par `HttpExceptionFilter` pour les routes `/api/v1`. Les codes métier sont ceux du §11.5 : `MODELE_SANS_VERSION_ACTIVE` (409), `PARAMETRE_NON_DECLARE` et `BORNE_DEPASSEE` (422), `CONTROLE_BLOQUANT` (422), `CAPACITE_MOTEUR_ATTEINTE` (503), `MOTEUR_INDISPONIBLE` (B10.2).

Les routes ne sont pas `@OuvertAuxStagiaires()`. Le `StagiaireGuard` les ferme donc par défaut, ce qui est cohérent : un stagiaire ne reçoit aucun rôle fonctionnel (`RolesFonctionnelsService.attribuer`).

### 2.3 Habilitations : rôles fonctionnels du domaine B

**Ce qui existe déjà.** L'énumération `RoleFonctionnel` (schema.prisma) contient déjà `RESPONSABLE_MODELE`, `ANALYSTE`, `DECIDEUR` et `VALIDATEUR`. `ReprisesN1Service` a attribué `VALIDATEUR` au DN et au DNA. Les rôles B sont aujourd'hui listés dans `ROLES_SANS_ECRAN` (`socle/roles-fonctionnels.ts`), et `attribuer` refuse de les accorder (« Ce rôle n'est pas encore utilisé par la plateforme »).

**Ce qui change (lot B1).**
- On retire `RESPONSABLE_MODELE`, `ANALYSTE` et `DECIDEUR` de `ROLES_SANS_ECRAN`. L'attribution passe alors par l'écran générique (administrateur seul, daté, motivé, audité, notifié `ROLE_MODIFIE`), conformément au §5.4 : « attribué explicitement par l'administrateur, sur décision du chef de la Division des Prévisions Économiques ». Le motif saisi cite cette décision (proposition, DB-4).
- Le **Responsable de modèle** est, de plus, désigné par modèle (`modele.responsableId`). Le rôle fonctionnel ouvre les écrans ; la désignation sur le modèle fonde les droits « sur ses modèles » de l'annexe 1.3.
- L'**Administrateur** du domaine B est la position `ADMIN_SYSTEME`, reçue dans `positionsAcceptees`. Le §5.2 interdit qu'il active seul une version, valide quoi que ce soit ou accède à un objet protégé.
- Les rôles fonctionnels ne sont **jamais empruntés en intérim** (`AuthenticatedUser.rolesFonctionnels`). Un suppléant du DN n'hérite donc pas du rôle Validateur du DN (règle existante). Le §3.3 cite toutefois « validation d'une simulation diffusable » parmi les circuits qu'une absence ne doit pas bloquer : DB-17 traite ce point.

**Contrôle grossier.** `@RolesFonctionnels(ANALYSTE, RESPONSABLE_MODELE, DECIDEUR, VALIDATEUR)` sur les contrôleurs, avec `ADMIN_SYSTEME` accepté.

**Contrôle fin.** `AutorisationService.exiger(acteur, { action, objet, rolesRequis, positionsAcceptees, perimetre: 'IGNORE' })`. L'ordre normatif du §5.5 est respecté :
1. **Protégé.** Pour une simulation `EXPLORATOIRE`, `objet.protege = true` et `besoinDEnConnaitre = (auteur ∨ responsable du modèle utilisé ∨ ADMIN_SYSTEME)` (annexe 1.3, deux lignes de lecture). Le DN, le Décideur, le Validateur et la hiérarchie de l'auteur sont refusés à cette étape, et le refus est journalisé dans `acces_refuses`.
2. **Externe.** L'étape existe déjà et répond toujours « non » : aucun compte externe tant que DB-6 n'est pas tranchée.
3. **Périmètre.** Ignoré (`perimetre: 'IGNORE'`) : les objets B appartiennent à la Direction (§5.3 règle 4).
4. **Rôle.** C'est la matrice de l'annexe 1.3, traduite en table `DROITS_DOMAINE_B` (proposition), qui sera aussi la référence de recette.

**Visibilité de l'existence.** Le §3.2 laisse au DN et au DNA la connaissance de l'existence des objets (« qu'une simulation a été exécutée »). Le tableau de bord du DN (`api/v1/tableau-de-bord`) peut afficher un compteur de simulations par modèle et par statut, sans titre, sans auteur et sans chiffre pour les exploratoires (proposition).

**Navigation.** Le domaine B n'apparaît dans `Sidebar.tsx` que si l'API renvoie un droit `modelisation` (compte détenteur d'un rôle B ou administrateur). C'est le cas « chef de division sans rôle de modélisation » du §5.4. Le web ne calcule rien (règle « Écrans » de `docs/Guide_developpeur.md`).

### 2.4 Visibilité par statut (annexe 1.3)

| Objet / statut | Analyste | Responsable de modèle | Décideur | Validateur | Administrateur |
|---|---|---|---|---|---|
| Simulation exploratoire | CLMS sur les siennes | L sur ses modèles | — | — | L |
| Simulation validée | L | L, V (exploratoire → validée) | L | L | L |
| Simulation diffusable | L | L | L | V (validée → diffusable) | L |
| Scénario | CLMS les siens, L les scénarios partagés | CLM | L | L | L |
| Dérogation | — | V sur ses modèles | — | — | C (notifiée au responsable) |
| Version de modèle | L | L, V sur ses modèles | L | L | CL, activation sur visa |

Le statut de diffusion réutilise l'énumération `StatutDiffusion` (BROUILLON, VALIDE, DIFFUSABLE). Le libellé « Exploratoire » est affiché pour BROUILLON dans le domaine B (§7.1 : « Exploratoire (domaine B) ou Brouillon (domaine A) »). Chaque changement est écrit dans `changements_statut` (`objetType: 'Simulation'`), table générique prévue à cet effet par N4.

### 2.5 Machines à états

**Version de modèle (B3.2).** `DEPOSEE → CONTROLES_EN_COURS → CONFORME | NON_CONFORME → ACTIVE → REMPLACEE → ARCHIVEE`.
- Les contrôles sont lancés par l'administrateur.
- Une version `NON_CONFORME` ne peut être activée qu'après une dérogation (administrateur, motif obligatoire, notification au responsable, MOD-EF-36).
- L'administrateur demande l'activation ; le responsable du modèle l'approuve. Aucun des deux n'agit seul (annexe 1.3, MOD-EF-58).
- Une demande d'activation expire au bout de 15 jours (annexe 5).
- Il y a une seule version `ACTIVE` par modèle (index unique partiel). L'activation fait passer la précédente à `REMPLACEE` dans la même transaction.
- L'association d'une nouvelle base crée une nouvelle version marquée « calibrage à valider » (MOD-EF-14).

**Exécution (B10.1).** `EN_FILE → EN_COURS → TERMINEE | NON_CONVERGEE | ECHOUEE | ANNULEE`, plus `MOTEUR_INDISPONIBLE` comme cause d'attente, non comme échec. Une tâche `ECHOUEE` pour cause technique est réessayée une fois ; une tâche `NON_CONVERGEE` ne l'est jamais. Une tâche perdue est détectée par expiration et passe `ECHOUEE`, journal conservé (B10.5).

**Simulation (fiche).** L'état d'exécution suit celui de l'exécution qu'elle référence. Le statut de diffusion `EXPLORATOIRE → VALIDE → DIFFUSABLE`, avec retrait motivé d'un cran, n'est permis que si l'exécution est `TERMINEE` et qu'aucun contrôle bloquant n'est en échec sans dérogation (§7.1, MOD-EF-36).

### 2.6 File d'exécution : une table et une tâche planifiée supervisée

Le cahier demande une « file de tâches asynchrone persistante, ou équivalent » (§11.2). Le socle n'a ni Redis ni courtier de messages. La file est donc une table PostgreSQL (proposition) :

- **Mise en file.** `POST /api/v1/simulations/:id/execution` avec l'en-tête `Idempotency-Key` obligatoire (§11.4).
  - On calcule l'empreinte SHA-256 des entrées canonisées : version, base, scénario de référence, chocs, fermeture, options (MOD-EF-76).
  - Si une exécution de même empreinte est déjà `EN_FILE` ou `EN_COURS`, la simulation s'y rattache : c'est la fusion de MOD-EF-77.
  - Sinon, une ligne `execution_moteur` est créée.
  - La réponse arrive en moins de 5 s (SOC-PRF-06), puisque rien n'est calculé à ce moment.
- **Distribution.** Une tâche `@Cron('*/15 * * * * *')` (proposition : toutes les 15 s), enveloppée par `TachesPlanifieesService.suivre('file-simulations', …)` et ajoutée à `TACHES_SUIVIES` (période attendue : 1 min), prend les tâches `EN_FILE` par moteur, dans l'ordre d'arrivée et sans préemption (B10.5). Elle utilise `SELECT … FOR UPDATE SKIP LOCKED`, dans la limite de `modeles.concurrence.<moteur>`.
- **Suivi.** La même tâche interroge `etat`, collecte et contrôle les tâches terminées, applique la durée maximale (`modeles.dureeMaxMinutes`, surchargée par modèle, B6.5) et détecte les tâches perdues.
- **Lecture.** Le client interroge `GET /simulations/:id` à intervalle régulier (§11.4 : « aucune attente bloquante »). La position dans la file et la durée moyenne observée du modèle (E3, SOC-PRF-08) sont calculées à la lecture.
- **Effet sur le domaine A.** Le calcul se fait hors du processus de l'API (sauf pour le moteur simulé, qui est léger). Une file saturée ne ralentit donc pas les écrans du domaine A (SOC-PRF-07). La supervision (`SupervisionService`) gagne deux contrôles : « Service de calcul » (sonde `/sante`) et « File d'exécution » (âge de la plus ancienne tâche en file).

**Nouveaux paramètres bornés** (`PARAMETRES`, `ParametresService.valeur`, annexe 5) : `modeles.dureeMaxMinutes` (30, de 1 à 240), `modeles.memoireMaxGo` (8), `modeles.disqueMaxGo` (5), `modeles.concurrence` (5), `modeles.toleranceRejeuExposant` (−6), `modeles.toleranceNonRegressionExposant` (−4), `modeles.expirationActivationJours` (15), `modeles.executionsParHeure` (10). Ce sont des valeurs numériques et elles restent modifiables à l'écran : aucune n'est codée en dur (annexe 5 : « ne les code jamais en dur »).

### 2.7 Stockage des fichiers

`StorageService.save` / `saveThen` sert pour les fichiers de version (`.gms`, `.inc`, `.gdx`, `.xlsx`, `.py`, `requirements.txt`, ainsi que `modele.simule.json` pour le moteur simulé), les bases importées, les journaux d'exécution et les artefacts (fichier d'inclusion des chocs, GDX de sortie). Chaque fichier porte sa taille, son type et son empreinte SHA-256 (MOD-EF-81). Les plafonds sont de 200 Mo par fichier de modèle et 50 Mo par base (annexe 5). La limite actuelle de 25 Mo des `FileInterceptor` est relevée pour les seules routes de dépôt du domaine B.

**Point de vigilance.** Le disque persistant de production fait 1 Go (`render.yaml`, `dnpec-documents`). Les fichiers de modèles et les GDX le satureraient. DB-13 traite ce point.

Les **valeurs** ne sont pas stockées en fichiers. Seuls les indicateurs de sortie déclarés sont écrits dans `resultat_valeur`, en pleine précision (`double precision`, B12.1). Le GDX complet reste un artefact. Cette séparation maintient le volume en base sous contrôle : 10⁵ à 10⁶ valeurs par simulation EGC selon l'annexe 5, à mesurer par l'essai de charge SOC-PRF-10.

### 2.8 Intégrations avec le socle

| Socle | Usage dans le domaine B |
|---|---|
| `AuditService.log` | `entityType` parmi `Modele`, `VersionModele`, `BaseReference`, `Scenario`, `Simulation`, `Derogation`, `Rejeu`, `ImportDonnees`. Chaque dépôt, contrôle, dérogation, demande et approbation d'activation, mise en file, fin d'exécution, changement de statut, archivage, rejeu (avec son verdict) et export est tracé, avec `metadata.event` et l'empreinte. Le journal est inaltérable et chaîné (N2) |
| `PreuveIdentiteService.exiger` | Avant le passage au statut diffusable d'une simulation ou d'un rapport (§4.4 : « passage d'une simulation ou d'un rapport au statut diffusable ») |
| `NotificationsService.notify` | Événements du §9 (tableau ci-dessous). Aucun nouveau `NotificationType` (règle N1) : des types existants sont réutilisés avec `{ libelleBouton, urgent }`. La correspondance exacte est fixée en conception détaillée de B2 (proposition) |
| `ExportsService.marquer` | Tout export Excel, PDF ou Word d'une fiche, d'une comparaison ou d'un rapport. La mention de statut figure sur chaque page (B8.4, MOD-EF-68). Une mention « MOTEUR SIMULÉ — valeurs fictives » s'y ajoute le cas échéant |
| `DocumentsService` (GED) | Un rapport est un `Document` de type `RPEF`, `NOTE_CONJONCTURE` ou `RAPPORT` (éléments de cadrage du CDMT), avec une table de liaison `document_simulation` (référence et statut à la date du dépôt, §8). Règle du §6.4 : le statut d'un rapport ne dépasse pas le statut le plus faible des simulations qu'il cite. Il faut un point d'extension dans `DocumentsService.changerStatut`, du même type que `ActesService.surSignature` (voir §2.9) |
| `ActesService` | Le RPEF et la note de conjoncture sont des familles d'actes numérotés (§7.3). Deux registres sont créés par `parametrage.ts` (création seule, identité stable) : « RPEF » et « Note de conjoncture ». Un écouteur `surSignature` fait passer le rapport au statut Diffusable dans la transaction de signature (DB-10) |
| Plan de travail | `simulation.activiteId` facultatif (« une simulation rattachable à une activité »). Côté activité, seules les simulations que le lecteur a le droit de voir sont listées ; une exploratoire d'autrui n'est pas listée, même pour le chef qui pilote l'activité (§3.2 prime sur la cascade). L'avancement de l'activité reste calculé sur les tâches (N5) |
| `TachesPlanifieesService` | `file-simulations` (15 s), `expiration-activations` (quotidienne), `alertes-modeles` (quotidienne : version remplacée, demande d'activation expirée) |
| `ParametresService` | Quotas et seuils globaux (§2.6). Les seuils propres à chaque contrôle sont dans `controle_declare`, modifiables par le responsable du modèle (D-17) |
| Démonstration (`demo.ts`) | Le module est ajouté aux modes « creer » et « supprimer » : modèle « TEST — Modèle simulé », comptes `@demo.dnpec.test` dotés des rôles B, simulations exploratoires et validées. Le test `z_demo_*` est complété (règle de `docs/Guide_developpeur.md`) |
| Aide (`guides.json`) | Guide « Analyste » et guide « Responsable de modèle », rattachés aux rôles fonctionnels par `GET /aide/profils` |

**Notifications (§9).** Immédiates : exécution échouée ou non convergée et contrôle bloquant (auteur, responsable du modèle) ; dérogation accordée (responsable, administrateurs) ; simulation diffusable (auteur, validateur, administrateurs) ; simulation source rétrogradée (auteur et validateur des rapports concernés) ; nouveau modèle déposé (responsable désigné, administrateurs). En résumé quotidien : exécution terminée (auteur) ; version activée (détenteurs ANALYSTE via `detenteursWhere`, responsable) ; version remplacée ou archivée (auteurs des simulations rattachées).

### 2.9 Modèle de données envisagé

Les noms reprennent les objets du §6.3 (domaine B). Les modèles Prisma sont nommés en PascalCase et mappés en snake_case (`@@map`), comme le reste du schéma. Les champs `id`, `createdAt` et `creeParId` sont implicites.

| Table (`@@map`) | Champs principaux | Contraintes et remarques |
|---|---|---|
| `modeles` | `code` (unique, majuscules, jamais réutilisé, B12.2), `intitule`, `description`, `famille` (A_EGC, B_CADRAGE, C_ECONOMETRIE), `nature` (DYNAMIQUE, STATIQUE), `frequence`, `horizonDebut`, `horizonFin`, `responsableId`, `fermetures` (JSON), `fermetureDefaut`, `donneesRequises`, `dureeMaxMinutes?`, `elementsProteges` (JSON, MOD-EF-59), `archiveLe` | Fiche d'identité (B3.1, MOD-EF-07). Libellés modifiables sans nouvelle version ; noms techniques jamais (B12.4) |
| `versions_modele` | `modeleId`, `numero`, `moteur` (SIMULE, PYTHON, EXCEL, GAMS), `etat`, `calibrageAValider`, `baseReferenceId`, `noteVersion`, `empreinte`, `dependances` (JSON : version de GAMS, solveur, paquets), `deposeParId`, `activationDemandeeParId/Le`, `viseParId/Le`, `activeLe` | `@@unique([modeleId, numero])`. Index unique partiel sur `etat = 'ACTIVE'`. Déclencheur : seules les colonnes d'état et de visa peuvent changer ; DELETE interdit (CR-02). Le moteur est porté par la version, ce qui permet la bascule de moteur (§3.5) |
| `fichiers_modele` | `versionId`, `nom`, `type`, `role` (MODELE, INCLUSION_CHOCS, DONNEES, DEPENDANCES, DESCRIPTEUR_SIMULE), `tailleOctets`, `fileKey`, `sha256` | Insertion seulement (déclencheur) |
| `bases_reference` | `code`, `version` (incrémentale, jamais réattribuée), `nature` (MCS, TRE, BASE_TRIMESTRIELLE, COMPTES_SECTORIELS, SERIES), `annee`, `source`, `importeLe`, `fileKey`, `sha256`, `etatImport` (CONFORME, REJETEE), `rapportControle` (JSON) | Immuable. Une base rejetée ne peut pas être associée (E11, MOD-EF-13) |
| `series` | `code`, `libelle`, `domaine`, `frequence`, `unite`, `source`, `couverture`, `majLe` | MOD-EF-95 |
| `valeurs_serie` | `serieId`, `periode` (« 2026 », « 2026T1 », « 2026M03 »), `valeur`, `importId` | `@@unique([serieId, periode, importId])`. Le jeu en vigueur est désigné par import |
| `imports_donnees` | `nature`, `fichierKey`, `statut` (CONFORME, REJETE), `anomalies` (JSON), `parId` | Un import en échec n'alimente rien ; son rapport est conservé (MOD-EF-97) |
| `correspondances_variable` | `concept`, `modeleId`, `nomVariable`, `valideParId`, `valideLe` | Dictionnaire (MOD-EF-16, MOD-EF-98) |
| `parametres_choc` | `modeleId`, `libelle`, `nomVariable`, `unite`, `valeurDefaut`, `borneMin`, `borneMax`, `dimensions` (JSON), `modesAdmis`, `baseApplication` (référence ou année de base, B12.4), `obsoleteLe` | Jamais supprimé dès qu'il est référencé (B12.4). Seule voie de choc (MOD-EF-84, CR-16) |
| `indicateurs_sortie` | `modeleId`, `libelle`, `nomVariable`, `unite`, `valeurReference`, `socle` (booléen), `principal` (booléen), `dimensions`, `borneAlerteMin/Max`, `ordre`, `obsoleteLe` | MOD-EF-85, MOD-EF-87. Bornes de plausibilité (MOD-EF-37) |
| `controles_declares` | `modeleId`, `code` (34.1…, TOFE-ID-1…), `libelle`, `methode`, `seuil`, `caractere` (BLOQUANT, ALERTE), `actif` | Batterie (B4.1 étape 6, B6). Les seuils sont confirmés par le responsable (D-17) |
| `chocs_types` | `modeleId`, `categorie` (EXTERNE, BUDGETAIRE, MONETAIRE_CHANGE, STRUCTUREL), `libelle`, `chocs` (JSON) | Le chargement ne déclenche aucune exécution (MOD-EF-89) |
| `scenarios` | `modeleId`, `libelle`, `nature` (REFERENCE, ALTERNATIF, EXPLORATOIRE), `auteurId`, `partage`, `origineId` (duplication), `fermeture`, `horizonDebut/Fin`, `options` (JSON), `verrou` (version) | Un seul scénario de référence par modèle (B5.2, index partiel). En-tête conditionnel ; conflit en 409 (§11.4) |
| `chocs` | `scenarioId`, `parametreChocId`, `index` (JSON), `mode` (NIVEAU, POURCENT), `valeur`, `periodeType` (ANNEE, PLAGE, PERMANENT), `debut`, `fin` | Unicité (scénario, paramètre, index, période) (B12.4) |
| `simulations` | `question`, `modeleId`, `versionId`, `baseReferenceId`, `scenarioId`, `entrees` (JSON figé : chocs, fermeture, horizon, options), `empreinte`, `executionReferenceId`, `executionChoqueeId`, `etatExecution`, `statutDiffusion`, `auteurId`, `activiteId?`, `serieSensibiliteId?`, `enchainementId?`, `etape?`, `archiveLe/ParId` | La fiche (B3.3). Pas de suppression par l'auteur ; l'archivage est réservé à l'administrateur et journalisé (MOD-EF-73) |
| `executions_moteur` | `empreinte`, `moteur`, `versionId`, `nature` (REFERENCE, CHOC, CONTROLE_VERSION, REJEU), `etat`, `tacheMoteurId`, `cleIdempotence` (unique), `enFileLe`, `debuteLe`, `termineLe`, `expireLe`, `tentatives`, `statutSolveur` (JSON brut : modelStat, solveStat), `messageUtilisateur`, `journalKey`, `artefactsKey`, `dureeMs`, `tailleResultats` | Une exécution moteur peut servir plusieurs fiches (fusion, cache de référence MOD-EF-78). Cache valable pour (version, base, fermeture) |
| `resultats_valeur` | `executionId`, `indicateurId`, `index` (texte canonique), `periode`, `valeur` (double precision) | Clé (exécution, indicateur, index, période). La fiche rapproche les valeurs de référence et de choc pour l'affichage (B7.2). Partitionnement prévu (SOC-PRF-11) |
| `controles_resultat` | `executionId` ou `versionId`, `controleDeclareId`, `ecart`, `seuil`, `reussi`, `caractere`, `detail` | Batterie consignée dans la fiche (MOD-EF-33, CR-05) |
| `derogations` | `controleResultatId`, `versionId?`, `simulationId?`, `motif`, `accordeeParId` (administrateur), `viseeParId?` (responsable), `le` | MOD-EF-36, B6.3. Notifiée au responsable |
| `rejeux` | `simulationId`, `executionId`, `ecartRelatifMax`, `tolerance`, `verdict` (CONFORME, DERIVE), `parId` | B5.7, MOD-EF-94. Le verdict est aussi journalisé à l'audit |
| `series_sensibilite` | `scenarioId`, `parametreChocId`, `min`, `max`, `pas` | Une simulation par valeur (MOD-EF-90, CR-20) |
| `comparaisons` | `simulationIds` (2 à 4), `auteurId` | Facultative : seule une comparaison enregistrée est persistée (B5.6) |
| `enchainements` | `etapes` (JSON), `correspondances`, `valideParIds` | Lot tardif (D-27, MOD-EF-99) |
| `documents_simulation` | `documentId`, `simulationId`, `statutAuDepot` | §6.4 et §8. Liaison GED |
| `rapports_actes` | `documentId`, `acteId` | Lien rapport ↔ acte numéroté du Courrier (§7.3) |

**Migration.** Une migration Prisma **additive** est créée dans un lot dédié (`2026xxxx_domaine_b_b1`, puis une par lot). Elle ne contient que des `CREATE TABLE`, des `CREATE TYPE` pour les nouvelles énumérations, des index et des déclencheurs d'immuabilité. Aucune table existante n'est modifiée et aucune énumération existante n'est étendue : `RoleFonctionnel` contient déjà les rôles B, `TypeDocument` contient déjà `RPEF` et `NOTE_CONJONCTURE`, et `StatutDiffusion` sert tel quel. Les nouvelles tables pointent vers les anciennes (`users`, `activites`, `documents`, `actes_courrier`), jamais l'inverse. Un retour arrière ne touche donc jamais le domaine A.

Un script `prisma/retour-arriere/b1_down.sql` (DROP des seules tables du lot) est contrôlé par une phase de `run_all.sh`, sur le modèle de la phase 39g, et passe par le workflow manuel `db-retour-arriere.yml`. La migration est appliquée en local (`DATABASE_URL` vérifiée sur localhost), puis en production par `db-migrate.yml` uniquement, déclenché par le responsable.

### 2.10 Endpoints (préfixe `/api/v1`, chemins du §11.5)

| Méthode et chemin | Objet | Droit (annexe 1.3) |
|---|---|---|
| `GET /modeles` | Liste ; version active, responsable, dernier calibrage. Seuls les modèles ayant une version active pour un analyste (CR-15) | Rôle B |
| `GET /modeles/:id` | Fiche, paramètres de choc, indicateurs, contrôles déclarés, fermetures | Rôle B |
| `POST /modeles` · `PATCH /modeles/:id` | Création et mise à jour de la fiche | Administrateur ; libellés aussi par le responsable |
| `POST /modeles/:id/parametres` · `/indicateurs` · `/controles` | Déclaration (B4 étapes 4 à 6) ; passage en obsolète, jamais en suppression s'il est référencé | Administrateur, responsable |
| `POST /modeles/:id/versions` | Dépôt multipart → v*n* `DEPOSEE` | Administrateur |
| `GET /modeles/:id/versions` · `GET /versions/:id/diff?avec=` | Historique ; comparaison de deux versions (fichiers, fiche, résultats sur un scénario témoin, MOD-EF-09) | Rôle B |
| `POST /versions/:id/controles` | Lancement de la batterie (exécution `CONTROLE_VERSION`) | Administrateur |
| `POST /versions/:id/derogation` | Dérogation motivée | Administrateur |
| `POST /versions/:id/activation` · `/activation/approbation` · `/activation/refus` | Demande, visa ou refus | Administrateur ; responsable du modèle |
| `POST /bases` · `POST /bases/:id/association` · `GET /bases` | Dépôt contrôlé, association (nouvelle version « calibrage à valider ») | Administrateur ; lecture rôle B |
| `POST /imports` · `GET /series` · `GET/POST /correspondances` | Séries, imports et dictionnaire | Administrateur, responsable ; lecture rôle B |
| `GET/POST /scenarios` · `PATCH /scenarios/:id` · `POST /scenarios/:id/duplication` | Scénarios et chocs. 422 `PARAMETRE_NON_DECLARE` ou `BORNE_DEPASSEE` | Analyste (les siens), responsable |
| `GET /chocs-types` · `POST /chocs-types` | Bibliothèque | Lecture analyste ; écriture responsable |
| `POST /simulations` | Fiche `BROUILLON` d'exécution (question, scénario, activité facultative) | Analyste |
| `POST /simulations/:id/execution` | Mise en file. `Idempotency-Key` obligatoire ; 409 `MODELE_SANS_VERSION_ACTIVE` ; 503 `CAPACITE_MOTEUR_ATTEINTE` au-delà du quota horaire | Analyste auteur |
| `DELETE /simulations/:id/execution` | Annulation (MOD-EF-23) | Auteur ou administrateur |
| `GET /simulations` · `GET /simulations/:id` · `GET /simulations/:id/resultats` | Historique filtré et paginé (50 par défaut, 500 au plus) ; fiche ; résultats par indicateur et période | Selon le statut |
| `POST /simulations/:id/statut` | `{ vers, motif }`. Validée : responsable du modèle. Diffusable : validateur et `X-Reauth`. Retrait : motif obligatoire | Annexe 1.3 |
| `POST /simulations/:id/rejeu` | Réexécution sans cache ni fusion, verdict | Analyste |
| `POST /simulations/:id/archivage` | Archivage | Administrateur |
| `POST /sensibilites` | Série de simulations sur une plage et un pas | Analyste |
| `GET /comparaisons?ids=` | Alignement sur le socle et signalement des écarts de version (MOD-EF-93) | Rôle B |
| `POST /simulations/:id/export` · `GET /comparaisons/export` | Excel et PDF marqués (`ExportsService.marquer`) | Lecteurs autorisés |
| `POST /rapports` · `POST /rapports/:id/statut` | Projet de rapport = document GED lié aux fiches ; propagation des statuts | Analyste ; validateur |
| `GET /modelisation/consommation` | Durées, tailles et file par moteur (SOC-PRF-08/09, E12) | Administrateur ; responsable (ses modèles) |
| `GET /calcul/sante` (côté service de calcul) | Sonde lue par la supervision | Interne |

---

## 3. Moteur de calcul simulé d'abord

### 3.1 Pourquoi

Le choix du serveur de calcul et la licence GAMS sont ouverts (D-07, D-16) ; le cahier conçoit déjà les lots 0 à 2 « pour ne pas en dépendre » (§17.1). Le cycle complet (scénario → exécution → contrôles → validation → diffusion) contient l'essentiel des règles du domaine B : immuabilité, empreinte, fusion, file, statuts, objets protégés, dérogation, rejeu, exports marqués. Tout cela peut être construit et recetté avec un moteur qui respecte le contrat B10 sans calculer d'économie. Ce moteur est le dispositif de maquette prévu par la décision D-32 (« réservé à la démonstration et au plan de recette ; [...] pas une fonction du produit »).

### 3.2 Le modèle simulé est un vrai modèle du référentiel

Le moteur simulé n'exécute que des versions dont `moteur = SIMULE` et qui contiennent un fichier `modele.simule.json` (rôle `DESCRIPTEUR_SIMULE`). Le parcours de dépôt est donc exercé réellement : fiche, fichiers, base, paramètres, indicateurs, contrôles, visa. Le descripteur (proposition) déclare :

- **les indicateurs** et leur trajectoire de référence : un niveau de base et une croissance par période, ou la lecture d'une série de la base de référence désignée ;
- **les réponses aux chocs** : pour un couple (paramètre, indicateur), une élasticité, un retard et un taux d'amortissement ;
- **les identités comptables** à respecter, par exemple `PIB = C + G + I + X − M`, ainsi qu'un `desequilibre` facultatif pour fabriquer une version volontairement déséquilibrée (CR-06) ;
- **les verdicts des contrôles non calculables** (34.1, 34.2, 34.4 à 34.6) sous forme d'écarts déclarés, pour exercer les cas bloquant et alerte ;
- **les comportements de test** : `dureeMs`, une règle de non-convergence (« si |valeur du choc sur tel paramètre| > seuil »), un échec technique à la première tentative (pour tester la relance unique), une indisponibilité du moteur (pour tester `MOTEUR_INDISPONIBLE`) et le dépassement de la durée maximale.

### 3.3 Respect du contrat B10.1

| Opération | Comportement du moteur simulé |
|---|---|
| `preparer` | Lit le descripteur et les entrées figées, canonise, calcule l'empreinte. Aucune écriture dans les fichiers de version |
| `soumettre` | Renvoie un identifiant de tâche dérivé de l'empreinte et de la clé d'idempotence ; mémorise l'heure de début dans `executions_moteur` (rien en mémoire, donc rien de perdu au redémarrage de l'API) |
| `etat` | `EN_COURS` tant que `début + dureeMs` n'est pas atteint (avancement proportionnel), puis `TERMINEE`, `NON_CONVERGEE` ou `ECHOUEE` selon les règles du descripteur |
| `collecter` | Calcule les valeurs : référence `r(i,t)` ; choquée `y(i,t) = r(i,t) × (1 + Σₖ eₖᵢ × sₖ(t − retard) × amortissement)` ; indicateurs dépendants recalculés par les identités. Renvoie aussi un statut solveur fictif mais au format réel (`modelStat`/`solveStat`), un journal texte et des artefacts (le fichier d'inclusion des chocs tel que l'adaptateur GAMS le produira) |
| `controler` | Évalue les identités, les bornes de plausibilité (−15 %/+15 % par défaut sur la croissance du PIB réel, annexe 5) et les verdicts déclarés, puis renvoie des `controle_resultat` |
| `annuler` | Marque la tâche annulée ; une collecte ultérieure est refusée |

**Déterminisme.** Les valeurs ne dépendent que des entrées figées et du descripteur, sans aléa, horloge ni état. Le rejeu donne donc un écart nul et le verdict est `CONFORME`. Une variable d'environnement réservée aux tests, `MOTEUR_SIMULE_DERIVE` (par exemple 1e-5), introduit une dérive volontaire pour vérifier l'alerte de MOD-EF-70 et B12.4. Elle est interdite en production (refusée au démarrage si `NODE_ENV=production`).

### 3.4 Garde-fous (proposition, DB-11)

- Toute fiche issue du moteur simulé porte `moteur = SIMULE`. L'en-tête E4 et chaque page exportée affichent « MOTEUR SIMULÉ — valeurs fictives, sans portée économique ».
- Une simulation simulée ne peut pas dépasser le statut **Validé** (409). Elle n'est jamais diffusable et ne peut pas être citée dans un rapport soumis.
- En production, le moteur simulé n'est accepté que pour les modèles de démonstration (code `TEST_…`, intitulé « TEST — »), comme les autres marques de `demo.ts`.

### 3.5 Bascule vers l'adaptateur réel sans rien changer d'autre

1. `MoteursService` choisit l'adaptateur selon le **moteur de la version exécutée** : SIMULE → `MoteurSimule` ; PYTHON, EXCEL ou GAMS → `MoteurDistant`, qui transmet l'ordre complet au service de calcul. Ce service porte les adaptateurs B10.2 à B10.4 et répond avec le même contrat.
2. Pour un modèle réel, la bascule consiste à **déposer une nouvelle version** (fichiers `.py`, `.xlsx` ou `.gms`, moteur réel), à exécuter ses contrôles, puis à obtenir le visa et l'activation. Les paramètres de choc, indicateurs, contrôles déclarés, scénarios, chocs types et écrans appartiennent au **modèle**, pas à la version : ils restent inchangés (§6.4 : « un parametre_choc et un indicateur_sortie appartiennent à un modele »).
3. Les noms techniques déclarés (`nomVariable`) sont dès le départ ceux du moteur réel : symbole GAMS ou clé du dictionnaire Python. Le descripteur simulé les reprend à l'identique. La lecture « par nom, jamais par position » (MOD-EF-20, CR-04) est donc testée dès B2.
4. Les anciennes fiches simulées restent consultables et rejouables avec leur version, comme toute version antérieure (MOD-EF-06).
5. Un **jeu de contrat** commun (mêmes entrées, mêmes assertions sur la forme des sorties, les états, les erreurs et le journal) est exécuté contre chaque adaptateur. C'est la preuve que la bascule ne change rien pour le dorsal.

---

## 4. Fiches par modèle

**Règles communes à tous les modèles (cahier).** Fiche d'identité complète (MOD-EF-07). Scénario de référence identifié, exécuté et conservé ; tout choc est présenté par écart à cette référence (B5.2). Restitution limitée aux indicateurs déclarés (MOD-EF-87). Exploratoire → Validé par le **responsable du modèle** ; Validé → Diffusable par le **Validateur** (DN, DNA), après réauthentification (annexe 1.3, §4.4). Exports via `ExportsService.marquer`. Les tableaux publiés le sont dans un document GED lié aux fiches, puis dans un acte numéroté s'il s'agit du RPEF ou d'une note de conjoncture (§7.3, §8).

**Natures de scénario (proposition).** *Référence* : une par modèle, détenue par le responsable. *Alternatif* : partagé, destiné à être validé. *Exploratoire* : personnel et protégé tant qu'il n'est pas validé.

### 4.1 TOFE (MSFP 2014)

- **Nature et moteur.** Famille B : cadrage macro-budgétaire, opérations financières de l'État, mensuel et trimestriel, horizon continu, opérationnel (B1.2). Moteur Excel ou Python ; la voie relève de D-25. Lot 6 du cahier.
- **Entrées.**
  - Séries de finances publiques : recettes fiscales par impôt, recettes non fiscales, dons, charges (personnel, biens et services, intérêts, transferts), acquisition nette d'actifs non financiers, financement intérieur et extérieur.
  - PIB nominal, pour les ratios. Il entre comme série tant que les enchaînements ne sont pas ouverts (D-27).
  - Paramètres : taux de recouvrement, élasticités des recettes au PIB (proposition, à confirmer par l'état des lieux B2.1).
  - Chocs facultatifs (B3.1) : variation d'une recette ou d'une dépense, en niveau ou en pourcentage, sur une plage de périodes.
- **Sorties.** TOFE présentation MSFP 2014. Solde de gestion opérationnel net, capacité ou besoin de financement, solde primaire, solde global base engagements et base caisse. Recettes et dépenses en % du PIB. Financement.
- **Scénarios.** Référence = loi de finances ou exécution en cours. Alternatifs = loi de finances rectificative ou variantes de recettes (proposition).
- **Contrôles.** « Cohérence des identités du TOFE » (B6.2, MOD-EF-38). Proposition :
  - **bloquants** : (1) recettes − charges = solde de gestion opérationnel net ; (2) ce solde − acquisition nette d'actifs non financiers = capacité ou besoin de financement ; (3) besoin de financement = financement total, à l'écart statistique déclaré près ; (4) somme des mois = trimestre ;
  - **alertes** : variation d'un poste au-delà d'une borne ; écart statistique au-dessus de 0,5 % du PIB ;
  - non-régression 10⁻⁴ sur un exercice témoin si le classeur est porté en Python (B6.4, CR-12).
- **Validation et statut.** Responsable du modèle TOFE (Validé), Validateur (Diffusable).
- **Publication.** Tableaux du TOFE en annexe du RPEF ; export Excel marqué.

### 4.2 PIB_3FEUILLES (PIB par l'offre)

- **Nature et moteur.** Famille C, annuelle, opérationnel (B1.3). Classeur Excel à trois feuilles d'après son nom. La structure exacte est à relever par l'état des lieux (B2.1) ; le moteur cible est Python (D-25, proposition).
- **Entrées.** Valeur ajoutée par branche (primaire, secondaire dont mines, tertiaire) en volume et en prix, impôts nets sur les produits, déflateurs. Chocs : croissance d'une branche (production de bauxite ou d'or, par exemple), prix d'une branche.
- **Sorties.** PIB réel et nominal, croissance, déflateur, contributions sectorielles à la croissance.
- **Scénarios.** Référence = cadrage en vigueur. Alternatifs = hypothèses minières et agricoles.
- **Contrôles** (proposition) :
  - **bloquants** : somme des VA + impôts nets = PIB, aux prix courants et en volume ; reproduction de l'exercice témoin (B6.2) ; continuité des séries importées (MOD-EF-96) ;
  - **alerte** : croissance du PIB réel hors de −15 %/+15 % (annexe 5).
- **Validation et publication.** Responsable du modèle, puis Validateur. Tableau « PIB optique offre » du RPEF et de la note de conjoncture.

### 4.3 PIB_DEMANDE (PIB par la demande)

- **Nature et moteur.** Famille C, trimestrielle, six composantes, opérationnel (B1.3). Moteur Excel ou Python (D-25).
- **Entrées.** Séries trimestrielles des six composantes. Le cahier ne les énumère pas ; probablement consommation finale des ménages et des administrations, FBCF, variation de stocks, exportations, importations (à confirmer). Chocs : investissement public, exportations minières, consommation publique.
- **Sorties.** PIB par la demande trimestriel et annuel, contributions des composantes, taux d'investissement.
- **Scénarios.** Référence trimestrielle ; alternatifs pour la note de conjoncture.
- **Contrôles** (proposition) :
  - **bloquants** : somme des composantes = PIB ; somme des trimestres = année ; reproduction de l'exercice témoin ;
  - **alerte** : écart avec le PIB par l'offre de la même année au-delà d'un seuil. Cette alerte n'est calculée que si une simulation PIB_3FEUILLES de référence validée existe ; c'est une lecture croisée, pas un enchaînement (MOD-EF-60).
- **Validation et publication.** Responsable, puis Validateur. Tableau « emplois du PIB » du RPEF.

### 4.4 IHPC (inflation)

- **Nature et moteur.** Famille C, économétrique, trimestrielle, opérationnel (B1.3). Moteur actuel non précisé par le cahier ; cible Python (statsmodels, §11.2).
- **Entrées.** IHPC par fonction de consommation et pondérations. Variables explicatives probables : prix à l'importation, taux de change GNF/USD, prix des carburants, masse monétaire (à confirmer par l'état des lieux). Chocs : prix à la pompe, dépréciation du change, prix d'un produit importé.
- **Sorties.** Inflation trimestrielle, en glissement annuel et en moyenne annuelle ; contributions par fonction.
- **Scénarios.** Référence = projection centrale ; alternatifs = chocs de change ou de carburant.
- **Contrôles** (proposition) :
  - **bloquants** : pondérations sommant à 1 ; agrégation des sous-indices = indice global ; reproduction de l'exercice témoin (B6.2) ;
  - **alerte** : inflation hors d'une borne déclarée par le responsable.
- **Validation et publication.** Responsable, puis Validateur. Note de conjoncture (section des prix) et RPEF.

### 4.5 Programmation financière trimestrielle (avec le module Dette/AVD)

- **Nature et moteur.** Famille B : cadre intégré à quatre secteurs (réel, finances publiques, extérieur, monétaire), support du RPEF, trimestriel, horizon 2026-2030, « en consolidation » (B1.2). Le module Dette/AVD est annuel, horizon 2040, et fait partie de la programmation financière. Moteur Excel aujourd'hui ; pilotage du classeur ou portage en Python selon D-25. CR-11 : pilotable de bout en bout sans manipulation Excel manuelle.
- **Entrées.** Les quatre secteurs (PIB, TOFE, balance des paiements, situation monétaire), hypothèses de change et de prix, encours et conditions de la dette (taux, échéances, part concessionnelle). Chocs : prix des exportations minières, dépenses d'investissement, taux de change, nouveaux emprunts.
- **Sorties.** Tableaux du RPEF (secteurs réel, public, extérieur, monétaire). Indicateurs de soutenabilité : dette/PIB, service de la dette/recettes, valeur actualisée de la dette/exportations, sur l'horizon 2040.
- **Scénarios.** Référence = cadrage du RPEF ; alternatifs = scénarios de risque de l'AVD.
- **Contrôles.** « Bouclage comptable du cadre macro-budgétaire » (B6.2). Proposition :
  - **bloquants** : solde budgétaire = financement (TOFE) ; solde courant + compte de capital + compte financier + erreurs et omissions = variation des réserves (balance des paiements) ; avoirs extérieurs nets + avoirs intérieurs nets = masse monétaire ; épargne − investissement privé + solde public + solde extérieur = 0 ; encours de dette de t = encours de t−1 + tirages − amortissements ± effet de change ;
  - **alertes** : ratios de dette au-dessus des seuils de l'AVD déclarés par le responsable ;
  - non-régression 10⁻⁴ par rapport au classeur (CR-12).
- **Validation et publication.** Responsable, puis Validateur. Base du RPEF, publié comme acte numéroté (§7.3).

### 4.6 CDMT

- **Ce que dit le cahier.** Le CDMT n'est **pas** un modèle du catalogue (B1). Il n'apparaît qu'en livrable : « éléments de cadrage du CDMT » (B7.5, MOD-EF-65, lot 7).
- **Proposition (DB-15).** Le traiter comme un **modèle de rapport** de la GED (type `RAPPORT`, catégorie « éléments de cadrage du CDMT »), composé à partir de fiches validées de la programmation financière et du TOFE : enveloppes globales, solde, plafonds de dépenses. Il ne reçoit pas de fiche de modèle tant que l'état des lieux (B2.1) n'a pas révélé un classeur CDMT propre. Si un tel classeur existe, il entre en famille B avec la même fiche que le TOFE. Les contrôles proposés sont alors : somme des enveloppes sectorielles = enveloppe globale (bloquant), et enveloppe globale cohérente avec la dépense du TOFE de référence (alerte).
- **Statut et publication.** Le rapport ne peut dépasser le statut de ses sources (§6.4). Comme il n'est pas une famille d'actes du §7.3, il reste un document GED Validé ou Diffusable (Diffusable : Validateur).

### 4.7 MEGC sous GAMS (famille A)

- **Nature et moteur.** Six modèles (B1.1) :
  - SYLI Standard (MCS 2021, 30 produits, 28 branches, dynamique 2021-2030, CNS) ;
  - MEGC Mines (NLP) ;
  - SYLI Finances (bloc monétaire, 6 variantes, CNS) ;
  - SYLI Énergie (MCS Énergie 2023, NLP) ;
  - ECOSIM CEDEAO (15 pays, statique, CNS) ;
  - agPMP (programmation mathématique positive, NLP, calibrage en deux étapes).

  Moteur GAMS, licence serveur obligatoire (§17.1, D-16). Priorité : SYLI Standard d'abord (lot 2 du cahier), les cinq autres ensuite (lot 4). Les variantes de SYLI Finances sont des versions ou des fermetures, pas des modèles distincts (B2.1).
- **Entrées.** Base = MCS (`bases_reference` nature MCS, contrôle d'équilibre à l'import, B12.3). Paramètres de choc déclarés, par exemple `pwe` indexé par produit (exemple B11.2 : +15 % permanent sur l'or à partir de 2026). Fermetures (budgétaire, extérieure, épargne-investissement), avec une fermeture par défaut affichée (MOD-EF-28). Chocs écrits dans le fichier d'inclusion dédié, jamais dans le code (B10.2).
- **Sorties.** Lues dans le GDX par nom de symbole (MOD-EF-20, CR-04). Socle (B7.1, MOD-EF-39) : PIB, exportations, importations, consommation finale, investissement, valeur ajoutée totale et par grand secteur, recettes fiscales par type. Statut solveur traduit selon B10.2 (optimal ou localement optimal → `TERMINEE` ; infaisable, non borné ou interrompu → `NON_CONVERGEE` ; erreur de compilation ou d'exécution → `ECHOUEE`).
- **Scénarios.** La référence est mise en cache par (version, base, fermeture) (MOD-EF-78). Variantes : chocs externes, budgétaires, monétaires et de change, réformes (bibliothèque B5.4). Tests de sensibilité (B5.5).
- **Contrôles.** Batterie B6.1 et annexe 5, tous **bloquants** sauf la plausibilité :
  - 34.1 homogénéité des prix (0,1 %) ;
  - 34.2 homogénéité des quantités (0,1 %) ;
  - 34.3 équilibre de la MCS (0,01 % du total du compte) ;
  - 34.4 loi de Walras (0,1 % du PIB) ;
  - 34.5 réplication de l'année de base (0,5 %) ;
  - 34.6 comptage des équations et des variables (égalité) ;
  - 37 bornes de croissance du PIB réel (−15 %/+15 %, **alerte**).

  Pour agPMP et ECOSIM, la batterie est à adapter par le responsable (proposition). Les tests 34.1 et 34.2 supposent des exécutions supplémentaires (numéraire doublé), qu'il faut compter dans la capacité du moteur.
- **Validation et publication.** Responsable du modèle (Validé), Validateur (Diffusable). Tableaux d'impact en annexe du RPEF ou de notes d'analyse.

### 4.8 Tableau entrées-sorties (Input-Output, TRE 2021)

- **Nature et moteur.** Famille C, 31 branches, TRE 2021, annuel, « disponible » (B1.3). Le moteur n'est pas précisé. Le calcul de Leontief, `x = (I − A)⁻¹ f`, s'écrit en quelques lignes de NumPy : c'est le **meilleur premier modèle réel en Python** (proposition, DB-7).
- **Entrées.** Base = TRE 2021 (nature TRE). Chocs : demande finale par branche (en niveau ou en pourcentage), éventuellement coefficients d'importation.
- **Sorties.** Production, valeur ajoutée et importations par branche ; multiplicateurs de production et de valeur ajoutée ; effets directs et indirects. Modèle statique : présentation avant/après (MOD-EF-42).
- **Scénarios.** Référence = année de base ; alternatifs = chocs de demande (investissement public, exportations minières).
- **Contrôles** (proposition) :
  - **bloquants** : équilibre ressources-emplois par produit ; coefficients techniques ≥ 0 et somme par colonne < 1 (condition de Hawkins-Simon) ; reproduction de la production de l'année de base à 10⁻⁶ ;
  - **alerte** : multiplicateur hors d'une plage déclarée.
- **Validation et publication.** Responsable, puis Validateur. Tableaux d'analyse sectorielle en GED.

---

## 5. Options de serveur de calcul

### 5.1 Contraintes communes

- **Isolation (SOC-SEC-10, B10.6).** Chaque exécution tourne dans un conteneur sans privilèges, sans accès à la base, au stockage documentaire ni au réseau interne, avec des plafonds de CPU, de mémoire (8 Go), de disque (5 Go) et de durée (30 min). Un modèle témoin d'isolation sert de preuve (CR-05).
- **Compte de service unique** auprès du moteur (SOC-HEB-04) ; secrets hors du code (B12.5).
- **Souveraineté.** Les données sensibles avant publication (§10.1) restent sous maîtrise nationale à terme (SOC-HEB-03). Aucune donnée réelle sensible en développement ou en recette (SOC-SEC-09).
- **Capacité cible.** 5 exécutions concurrentes et 20 utilisateurs (SOC-DIM-04) ; 500 simulations par an (annexe 5).
- **Compétences.** Reprise par la CSID (§11.1).

### 5.2 Option (a) : Python/R dans un conteneur séparé (Render ou équivalent)

- **Principe.** Un service privé (sans adresse publique) héberge le service de calcul Python. L'API l'appelle en HTTP interne avec un jeton de service. Chaque exécution est un sous-processus avec un utilisateur dédié, un répertoire temporaire et des limites `setrlimit`.
- **Coûts** (tarifs publics, à vérifier). Une instance Render de 2 Go coûte environ 25 USD par mois, une de 4 Go environ 85 USD, une de 8 Go environ 175 USD. Les 8 Go par exécution de l'annexe 5 ne concernent pas les modèles B et C, qui sont légers : 2 à 4 Go suffisent au départ. Aucune licence. Développement : un service Python et des adaptateurs Python ou Excel.
- **Risques.**
  - **Isolation partielle.** Une plateforme gérée ne permet ni de couper le réseau sortant d'un processus ni de lancer un conteneur par exécution. SOC-SEC-10 n'est donc tenu qu'en partie : pas d'identifiants de base dans l'environnement, mais l'accès réseau sortant reste possible. C'est acceptable pour des modèles internes vérifiés, pas pour une recette CR-05 stricte.
  - **Souveraineté.** Hébergement hors du territoire (Francfort), en contradiction avec SOC-HEB-03 pour des données sensibles réelles (D-07).
  - **Pas de GAMS.** Les licences actuelles sont individuelles (§17.1).
- **Prérequis.** CSID à l'aise avec Python et Docker ; jeu témoin par modèle ; décision D-25.
- **Compatibilité.** TRE, IHPC, PIB_3FEUILLES, PIB_DEMANDE, TOFE, programmation financière et dette si elles sont portées en Python (D-25). La voie Excel côté serveur (B10.4, sans macro, recalcul via une bibliothèque libre) est **fragile** (§16.3). **Famille A : non.**

### 5.3 Option (b) : GAMS sous licence sur un serveur dédié

- **Principe.** Un nœud dédié, sur un serveur de la DNPEC ou de l'infrastructure nationale, porte GAMS Engine auto-hébergé ou une licence réseau. Ce même nœud héberge l'exécuteur Python, chaque exécution tournant dans `docker run --network none` avec des cgroups. Un agent de calcul vient chercher le travail auprès de l'API en HTTPS sortant (mode « pull »), ce qui évite d'ouvrir un port entrant à la DNPEC (proposition).
- **Coûts** (le §17 ne chiffre rien ; ordres de grandeur à confirmer par devis de l'éditeur, D-16).
  - Licence GAMS : module de base et chaque solveur utilisé (CONOPT, PATH ou autre, à relever par l'état des lieux) de l'ordre de quelques milliers d'USD chacun. Les licences réseau ou multi-utilisateurs et GAMS Engine se négocient sur devis, à plusieurs fois le prix d'une licence poste. Maintenance annuelle de l'ordre de 20 %. Des conditions pour administration publique sont à demander.
  - Serveur : achat d'un serveur de 16 cœurs et 64 Go avec onduleur, de l'ordre de 5 000 à 10 000 USD, ou location d'un serveur dédié de l'ordre de 100 à 300 USD par mois.
  - Exploitation : sauvegardes, supervision, correctifs, à la charge de la CSID.
- **Risques.**
  - Licence non obtenue ou trop chère : c'est le point bloquant (§16.3).
  - Électricité et connexion à la DNPEC (§16.4). Le mode « pull » limite le risque à un retard de file, sans perte.
  - Compétences d'administration Linux et Docker.
  - Délais d'achat.
- **Prérequis.** D-16 rendue ; D-07 (hébergement) ; réseau sortant HTTPS stable ; une équipe CSID formée ; GAMS de même version que celle des modèles.
- **Compatibilité.** Tous les modèles : la famille A par GAMS, les familles B et C par l'exécuteur Python sur le même nœud. **Conformité SOC-SEC-10 totale.**

### 5.4 Option (c) : service hybride

- **Principe.** Python et Excel tournent dans un conteneur hébergé, comme en (a), dès que les familles B et C sont prêtes. GAMS tourne sur un nœud dédié, comme en (b), dès que la licence est obtenue. Les deux sont appelés par le même `MoteurDistant`, et le routage se fait selon le moteur de la version.
- **Coûts.** (a) tout de suite, environ 25 à 85 USD par mois ; (b) seulement au moment où GAMS est réellement disponible. L'investissement suit les jalons du cahier : rien n'est engagé au-delà du lot 2 sans démonstration (§12, point de décision).
- **Risques.** Deux environnements à exploiter. L'isolation reste partielle sur la partie hébergée tant que les données réelles y transitent : la recette CR-05 se fait sur le nœud dédié. À éviter : GAMS exécuté sur le **poste** d'un économiste. Sa licence individuelle n'autorise pas l'exécution serveur (§17.1) et le poste n'offre ni disponibilité ni isolation.
- **Prérequis.** Ceux de (a) maintenant, ceux de (b) plus tard.
- **Compatibilité.** Toutes les familles, chacune au moment où son moteur est disponible.

### 5.5 Tableau comparatif

| Critère | (a) Conteneur Python | (b) Serveur dédié GAMS + Python | (c) Hybride |
|---|---|---|---|
| Coût initial | Nul | Élevé (licence et serveur) | Nul, puis celui de (b) au moment de GAMS |
| Coût récurrent | 25 à 175 USD par mois | Maintenance GAMS (~20 %) et exploitation | (a) plus, plus tard, (b) |
| Familles B et C | Oui (avec D-25) | Oui | Oui |
| Famille A (GAMS) | Non | Oui | Oui, une fois la licence obtenue |
| Isolation SOC-SEC-10 | Partielle | Complète | Partielle puis complète |
| Souveraineté (SOC-HEB-03) | Non (hébergeur étranger) | Oui, si hébergé en Guinée | Partielle |
| Dépendance à D-16 | Aucune | Totale | Seulement pour la famille A |
| Délai de mise en route | Semaines | Mois (achat, licence) | Semaines, puis mois |
| Charge CSID | Faible | Forte | Moyenne |

### 5.6 Recommandation

**Option (c), en deux temps, avec l'option (b) comme cible** une fois D-07 rendue.
- Lots B1 à B4 : moteur simulé, aucun coût.
- Lots B5 et B6 : conteneur Python hébergé, avec des données fictives ou publiées tant que D-07 n'est pas rendue (SOC-SEC-09).
- Lot B7 : nœud dédié pour GAMS dès que D-16 est obtenue. Ce nœud peut ensuite accueillir aussi l'exécuteur Python. Le transfert se fait par configuration, grâce au contrat unique (§3.5).

Cette trajectoire suit le cahier : rien n'est engagé avant la démonstration (§12) et les premiers lots ne dépendent pas de la licence (§17.1).

---

## 6. Décisions à soumettre au responsable

**DB-1 — Choix du serveur de calcul.**
- *Question.* Où s'exécutent les modèles réels ?
- *Options.* (a) conteneur Python hébergé ; (b) serveur dédié avec GAMS et Python ; (c) hybride.
- *Recommandation.* (c) en deux temps, avec (b) comme cible (§5.6).
- *Justification.* Aucun coût avant que la valeur soit démontrée ; aucune dépendance à la licence pour les familles B et C ; conformité totale à SOC-SEC-10 à terme.
- *Si l'on attend.* B1 à B4 ne sont pas bloqués (moteur simulé). B5 l'est.

**DB-2 — Licence GAMS (D-16).**
- *Question.* Quelle licence demander à l'éditeur, et quand ?
- *Options.* Licence réseau ; GAMS Engine auto-hébergé ; licence d'évaluation serveur d'abord.
- *Recommandation.* Demander **maintenant** une licence d'évaluation couvrant explicitement l'exécution serveur (§17.1), et des devis pour une licence réseau à 2 exécutions concurrentes et pour GAMS Engine, avec les solveurs relevés par l'état des lieux.
- *Justification.* C'est le point bloquant du domaine B (§16.3) ; les délais d'achat sont longs ; la capacité réelle sera mesurée au lot B7 (§17.6).
- *Si l'on attend.* La famille A (six modèles) est repoussée d'autant ; aucun autre lot n'est touché.

**DB-3 — Hébergement des données du domaine B (D-07).**
- *Question.* Des données réelles « sensibles avant publication » (§10.1) peuvent-elles transiter par l'hébergement actuel (Render, Francfort) ?
- *Options.* Oui ; non (données fictives ou déjà publiées seulement) ; oui pour les seules données publiées.
- *Recommandation.* Non tant que D-07 n'est pas rendue : B1 à B6 avec données fictives ou déjà publiées.
- *Justification.* SOC-HEB-03, SOC-SEC-09, SOC-DCP-05.
- *Si l'on attend.* La recette sur les « modèles réels de la Direction » (B13.1) se fait sur données publiées, ce qui reste possible pour le TRE, l'IHPC et le PIB.

**DB-4 — Attribution des rôles du domaine B.**
- *Question.* Qui attribue les rôles Analyste, Responsable de modèle et Décideur ?
- *Options.* Administrateur sur décision du chef de la DPE (§5.4) ; administrateur seul ; chef de la DPE directement à l'écran.
- *Recommandation.* Administrateur, avec un motif obligatoire citant la décision du chef de la DPE (pour le Décideur, la décision du DN, proposition). Le chef de la DPE consulte la liste des titulaires.
- *Justification.* C'est la lettre du §5.4, et cela réutilise l'écran existant en levant `ROLES_SANS_ECRAN`.
- *Si l'on attend.* Personne ne peut utiliser le domaine B, même en démonstration.

**DB-5 — Responsables de modèle et deux administrateurs (D-09).**
- *Question.* Qui est responsable de chacun des huit modèles ?
- *Options.* Désignation par le chef de la DPE avant B1 ; désignation au fil des lots.
- *Recommandation.* Le chef de la DPE désigne, avant B1, deux administrateurs et au moins le responsable des modèles des lots B5 et B6.
- *Justification.* L'activation exige le visa du responsable (annexe 1.3) ; sans lui, aucun modèle n'est simulable (CR-15).
- *Si l'on attend.* Seul le modèle de démonstration avance.

**DB-6 — Comptes externes (FMI, Banque mondiale) au lancement.**
- *Question.* Faut-il ouvrir des comptes externes ?
- *Options.* Oui, avec les tables `organisation_invitee`, expiration à 90 jours et parrain (§4.3) ; non, la diffusion passant par l'acte signé et l'export marqué.
- *Recommandation.* **Non au lancement.**
- *Justification.* Les comptes externes touchent au socle : la règle en base « aucun compte sans agent » (déclencheur N2) doit admettre une exception, et il faut un deuxième facteur obligatoire pour ces comptes et une recette de cloisonnement (CR-10). L'étape 2 de `exiger` est déjà en place, mais toujours négative. Les objets diffusables sortent aujourd'hui de façon contrôlée par un acte numéroté.
- *Si l'on attend.* Les partenaires reçoivent des PDF marqués « Diffusable » au lieu d'un accès direct.

**DB-7 — Ordre d'intégration des modèles.**
- *Question.* Faut-il garder l'ordre du cahier (SYLI Standard d'abord, §12 lot 2) ?
- *Options.* Ordre du cahier ; ordre « Python d'abord » : TRE, puis IHPC et PIB_3FEUILLES, puis PIB_DEMANDE et TOFE, puis programmation financière et dette, puis les modèles GAMS.
- *Recommandation.* « Python d'abord », soumis au comité de pilotage puisque le lotissement relève de D-04.
- *Justification.* La licence GAMS bloque SYLI Standard. Le TRE est le modèle réel le plus simple et prouve le contrat de bout en bout. Le RPEF (CR-13) dépend surtout des familles B et C.
- *Si l'on attend.* B5 ne peut pas démarrer faute de premier modèle désigné.

**DB-8 — Données de référence initiales et état des lieux (B2, D-11).**
- *Question.* Quelles bases et quels jeux témoins charger en premier ?
- *Options.* Registre complet des modèles d'abord ; registre modèle par modèle.
- *Recommandation.* Registre modèle par modèle, dans l'ordre de DB-7. Pour chacun : fichier qui fait foi, base (TRE 2021, MCS 2021, séries), exercice témoin, seuils confirmés (D-17). Le gel des fichiers sur les postes (D-11) intervient à la mise en service de chaque modèle.
- *Justification.* Le registre conditionne le référentiel (§12.2) ; le découpage permet d'avancer.
- *Si l'on attend.* B5 et suivants n'ont ni base ni exercice témoin, et aucune non-régression (CR-12) n'est vérifiable.

**DB-9 — Conservation des simulations.**
- *Question.* Combien de temps conserver fiches, résultats et artefacts ?
- *Options.* Sans limite (MOD-EF-69) ; 5 ans sans purge (SOC-DIM-05, annexe 5) ; fiches et résultats sans limite, artefacts lourds 5 ans.
- *Recommandation.* Fiches, entrées et résultats du socle **sans limite**, pour garder le rejeu possible. GDX et journaux : 5 ans, puis suppression proposée et validée, jamais automatique (§8). Versions et bases : sans limite tant que le modèle est au référentiel (annexe 4). À confirmer avec les Archives nationales (D-23).
- *Justification.* Le cahier se contredit (MOD-EF-69 contre SOC-DIM-05) ; cette option respecte les deux et SOC-PRF-11.
- *Si l'on attend.* Aucun impact avant cinq ans, mais le schéma de partitionnement doit être choisi dès B2.

**DB-10 — RPEF et note de conjoncture en actes numérotés.**
- *Question.* Comment ces rapports deviennent-ils diffusables ?
- *Options.* Statut Diffusable de la GED seul ; acte numéroté du Courrier dont la signature confère le statut Diffusable.
- *Recommandation.* Acte numéroté : registres « RPEF » et « Note de conjoncture » créés par `parametrage.ts`, signataire le DN, numérotation `DNPEC/RPEF/{annee}/{seq}`. La signature fait passer le document au statut Diffusable par `surSignature`, dans la même transaction.
- *Justification.* §7.3 : « un rapport diffusable est un acte numéroté ». Le mécanisme existe déjà (mouvements de carrière N6).
- *Si l'on attend.* B8 ne peut pas être livré tel que prévu.

**DB-11 — Moteur simulé en production.**
- *Question.* Le moteur simulé peut-il exister en production ?
- *Options.* Interdit ; permis pour les seuls modèles de démonstration ; permis partout.
- *Recommandation.* Permis pour les seuls modèles « TEST — », jamais au-delà de Validé, avec la mention « moteur simulé » sur chaque écran et chaque export.
- *Justification.* D-32 réserve ce dispositif à la démonstration et à la recette. La démonstration en production est déjà prévue (`db-demo.yml`).
- *Si l'on attend.* Pas de démonstration du domaine B en production.

**DB-12 — Voie Excel ou Python (D-25).**
- *Question.* Pour la programmation financière, le TOFE et les PIB, faut-il piloter les classeurs ou les porter en Python ?
- *Options.* Pilotage du classeur (B10.4) ; portage en Python.
- *Recommandation.* Portage en Python, avec non-régression à 10⁻⁴ sur un exercice témoin (B6.4, CR-12), modèle par modèle.
- *Justification.* L'exécution d'Excel côté serveur est fragile et sans macros (§16.3, B10.4). Un recalcul par un tableur libre n'est pas garanti identique à Excel.
- *Si l'on attend.* B6 bloqué.

**DB-13 — Capacité de stockage.**
- *Question.* Comment absorber les fichiers de modèles et les artefacts ?
- *Options.* Agrandir le disque persistant ; stockage objet compatible S3 (§11.2).
- *Recommandation.* Agrandir le disque à 10–20 Go dès B1 (coût marginal). Passer au S3 auto-hébergé lors de l'hébergement définitif (D-07). `StorageService` est le seul point de contact.
- *Justification.* Le disque actuel fait 1 Go ; un fichier de modèle peut atteindre 200 Mo (annexe 5).
- *Si l'on attend.* Risque de saturation de la GED en production.

**DB-14 — Couche d'IA (D-08, B11).**
- *Question.* Faut-il construire la couche d'IA ?
- *Options.* Dès le départ ; après la mise en service du mode expert.
- *Recommandation.* Après, dans un lot à part, une fois D-08 rendue.
- *Justification.* MOD-EF-74 et CR-09 exigent un cycle complet sans IA ; SOC-IA-05 impose un cloisonnement strict.
- *Si l'on attend.* Aucun impact sur le cycle.

**DB-15 — Statut du CDMT.**
- *Question.* Le CDMT est-il un modèle du référentiel ou un modèle de rapport ?
- *Options.* Modèle ; modèle de rapport.
- *Recommandation.* Modèle de rapport, sauf si l'état des lieux révèle un classeur propre (§4.6).
- *Justification.* Le catalogue B1 ne le contient pas ; B7.5 et MOD-EF-65 en font un livrable.
- *Si l'on attend.* Pas d'impact avant B8.

**DB-16 — Seuils des contrôles (D-17).**
- *Question.* Quels seuils appliquer aux contrôles ?
- *Options.* Valeurs de l'annexe 5 dès B1, puis confirmation ; attendre les seuils définitifs.
- *Recommandation.* Valeurs de l'annexe 5, modifiables par le responsable et tracées.
- *Justification.* L'annexe 5 est faite pour démarrer sans attendre.
- *Si l'on attend.* Aucun blocage.

**DB-17 — Règles de validation des simulations.**
- *Question.* (1) Un responsable de modèle peut-il valider sa propre simulation ? (2) Le suppléant d'un validateur peut-il rendre une simulation diffusable (§3.3), alors que les rôles fonctionnels ne s'empruntent pas ?
- *Options.* (1) oui ou non ; (2) intérim admis, ou attribution temporaire du rôle Validateur.
- *Recommandation.* (1) Non : la validation exige deux personnes. Chaque modèle reçoit donc un responsable suppléant désigné, qui valide les simulations du responsable titulaire. L'administrateur ne peut pas le faire, car il « ne valide rien » (§5.2) (proposition). (2) Attribution temporaire et datée du rôle Validateur au suppléant, par l'administrateur, plutôt que l'emprunt.
- *Justification.* Le cahier est muet sur (1). Pour (2), la règle « jamais empruntés en intérim » du socle tient, sans bloquer le circuit.
- *Si l'on attend.* B2 se livre avec une hypothèse à corriger plus tard.

---

## 7. Découpage en lots

Chaque lot fait l'objet d'une PR, d'une migration additive (si besoin) et d'un script de retour arrière. Chaque lot ajoute ses suites dans `tests/e2e/api/` et `tests/e2e/ui/`, ainsi que sa ligne dans `run_all.sh`. Le cycle est le même que pour N1 à N6 : conception validée, tests locaux, CI verte, migration manuelle, fusion.

### B1 — Référentiel des modèles (moteur simulé seul)

- **Contenu.**
  - Levée de `ROLES_SANS_ECRAN` pour les rôles B.
  - Tables : `modeles`, `versions_modele`, `fichiers_modele`, `bases_reference`, `parametres_choc`, `indicateurs_sortie`, `controles_declares`, `executions_moteur` et `controles_resultat` (pour les contrôles d'activation), `derogations`.
  - Déclencheurs d'immuabilité.
  - Interface `MoteurCalcul` et `MoteurSimule`.
  - Assistant d'intégration en six étapes (MOD-EF-80).
  - Circuit contrôles → dérogation → demande d'activation → visa du responsable.
  - Écrans E8, E9, E10 et E11.
  - Audit et notifications (« nouveau modèle déposé », « version activée », « dérogation »).
  - Paramètres bornés ; démonstration ; guide d'aide.
  - Disque agrandi (DB-13).
- **Dépendances.** DB-4, DB-11 et DB-13 rendues ; DB-5 pour un vrai responsable (sinon, comptes de démonstration).
- **Critères d'acceptation.**
  - CR-01 et CR-14 sur le modèle « TEST — » ; CR-02 (une modification ou suppression de version est refusée, en base comme par l'API) ; CR-15.
  - MOD-EF-82 : refus d'un dépôt sans base.
  - Index « une seule version active ».
  - L'administrateur ne peut pas activer seul (403) ; le responsable ne peut pas déposer (403).
- **Tests de bout en bout.** `b1_referentiel.js` couvre :
  - dépôt de la version 1, contrôles conformes puis visa → active ;
  - version déséquilibrée → non conforme → 409 sur l'activation sans dérogation → dérogation → visa ;
  - tentative de mise à jour SQL directe d'une version → erreur ;
  - un chef de division sans rôle B → 403 et absence du menu ;
  - un stagiaire → 403 ;
  - expiration d'une demande d'activation (tâche planifiée avec date simulée).

  `b1_referentiel_ui` (Chromium) parcourt l'assistant en six étapes. La phase de retour arrière `b1_down.sql` est vérifiée.

### B2 — Simulation de bout en bout (moteur simulé)

- **Contenu.**
  - Tables : `scenarios`, `chocs`, `simulations`, `resultats_valeur`.
  - File, avec la tâche planifiée `file-simulations` supervisée.
  - Empreinte, `Idempotency-Key`, fusion, cache de la référence.
  - Durée maximale, annulation, relance unique après échec technique, détection des tâches perdues.
  - Non-convergence : message clair, pas de chiffre, retour à E2.
  - Contrôles à chaque simulation ; statut Exploratoire → Validé ; objet protégé.
  - Écrans E2, E3, E4 et E6 ; rattachement à une activité ; notifications de fin et d'échec.
- **Dépendances.** B1 ; DB-17.
- **Critères d'acceptation.**
  - CR-03, CR-05, CR-06 et CR-07 sur le moteur simulé ; CR-16 ; CR-17.
  - SOC-PRF-06 (mise en file en moins de 5 s).
  - Une exploratoire est invisible pour le DN, le Décideur, le Validateur et le chef de l'auteur.
  - Deux mises en file simultanées de même empreinte → une seule exécution.
- **Tests de bout en bout.** `b2_simulation.js` couvre :
  - choc → TERMINEE → résultats par nom ;
  - choc sur un paramètre non déclaré → 422 `PARAMETRE_NON_DECLARE` ; hors bornes → 422 `BORNE_DEPASSEE` ;
  - divergence → NON_CONVERGEE sans résultats ;
  - échec technique → relance → TERMINEE ;
  - dépassement de durée → arrêt et signalement ;
  - annulation par l'auteur (200) et par un tiers (403) ;
  - accès à une exploratoire par le DN → 403 journalisé dans `acces_refuses` ;
  - validation par le responsable (200), par un analyste (403), d'une simulation échouée (409) ;
  - idempotence (même clé → même exécution) ;
  - ordre des indicateurs inversé dans le descripteur → restitution identique (CR-04).

  `b2_simulation_ui` parcourt E2 → E3 → E4.

### B3 — Données, séries et dictionnaire

- **Contenu.** Tables `series`, `valeurs_serie`, `imports_donnees`, `correspondances_variable`. Import Excel et CSV au format long (B12.3) avec contrôles : périodes, continuité, unité, doublons, valeurs aberrantes. Import d'une MCS ou d'un TRE avec contrôle d'équilibre. Rapport d'anomalies. Écran « Données et séries ». Le moteur simulé lit ses trajectoires de référence dans la base désignée.
- **Dépendances.** B1 ; données fictives ou publiées (DB-3).
- **Critères d'acceptation.** MOD-EF-13, MOD-EF-15, MOD-EF-95 à MOD-EF-98. Un import en échec n'alimente aucun modèle. Une base rejetée ne peut pas être associée.
- **Tests de bout en bout.** `b3_donnees.js` couvre : import conforme ; import avec doublon → rejet et rapport ; MCS déséquilibrée → rejet listant les comptes fautifs ; association d'une base rejetée → 409 ; association d'une nouvelle base → nouvelle version « calibrage à valider ».

### B4 — Analyse, rejeu et diffusion des simulations

- **Contenu.** Bibliothèque de chocs types ; test de sensibilité (une fiche par valeur) ; comparaison de 2 à 4 simulations avec signalement des écarts de version ; rejeu avec verdict ; exports Excel et PDF via `ExportsService.marquer` (toutes les rubriques de la fiche, MOD-EF-46) ; statut Validé → Diffusable par le Validateur avec `X-Reauth` ; retrait motivé ; archivage par l'administrateur ; écran E5 ; compteur pour le tableau de bord du DN (existence seule).
- **Dépendances.** B2.
- **Critères d'acceptation.** CR-08 (rejeu conforme), CR-19, CR-20, MOD-EF-68, MOD-EF-73. Une simulation du moteur simulé ne peut pas être rendue diffusable (409, DB-11).
- **Tests de bout en bout.** `b4_analyse.js` couvre :
  - sensibilité sur 5 valeurs → 5 fiches ;
  - comparaison entre versions → avertissement ;
  - rejeu → CONFORME ; avec `MOTEUR_SIMULE_DERIVE` → DERIVE et alerte ;
  - passage en Diffusable sans réauthentification → 403 `REAUTH_REQUISE`, avec réauthentification → 200 ;
  - export PDF avec bandeau de statut sur chaque page ;
  - suppression par l'auteur → 403 ; archivage par l'administrateur → journalisé.

  À la fin de B4, la démonstration du domaine B en production devient possible (`db-demo.yml`).

### B5 — Service de calcul Python et premier modèle réel (TRE)

- **Contenu.**
  - Service de calcul Python sans état : contrat B10.1, adaptateur Python B10.3, dépendances figées par version.
  - Isolation : sous-processus, `rlimit`, répertoire détruit après collecte, aucune variable d'identifiants de base.
  - Transport HTTP interne ou agent « pull » ; compte de service ; sonde `/sante` lue par la supervision.
  - `MoteurDistant` ; jeu de contrat commun aux deux adaptateurs.
  - Modèle témoin d'isolation.
  - Intégration du TRE 2021 (§4.8).
  - Mesures SOC-PRF-08 et 09.
- **Dépendances.** DB-1, DB-3, DB-5 et DB-7 ; registre du TRE (DB-8) ; service privé provisionné.
- **Critères d'acceptation.** Le jeu de contrat passe à l'identique sur les deux adaptateurs. CR-12 sur l'exercice témoin du TRE (10⁻⁴). Le modèle témoin d'isolation ne lit ni la base ni le stockage (CR-05 partiel en hébergé : l'écart est consigné au PV). Un service de calcul arrêté → `MOTEUR_INDISPONIBLE`, et la file reprend au redémarrage.
- **Tests de bout en bout.** La CI démarre le service de calcul dans un conteneur et exécute `b5_calcul_python.js`. Le jeu de contrat ; un choc de demande finale → multiplicateurs ; une tâche perdue (service tué) → ECHOUEE avec journal.

### B6 — Familles B et C

- **Contenu.** Portage et intégration, dans l'ordre de DB-7 : IHPC, PIB_3FEUILLES, PIB_DEMANDE, TOFE, programmation financière et dette (§4.1 à 4.5), chacun avec sa batterie déclarée et son exercice témoin.
- **Dépendances.** B5 ; DB-12 ; registres des modèles (DB-8).
- **Critères d'acceptation.** CR-11 (programmation financière pilotable sans Excel), CR-12 pour chaque modèle porté, CR-17 (restitutions propres à chaque modèle).
- **Tests de bout en bout.** Un fichier `b6_<modele>.js` par modèle : référence → choc type → contrôles (une identité volontairement rompue → bloquant) → validation par le responsable.

### B7 — GAMS et famille A

- **Contenu.** Adaptateur GAMS (B10.2) : fichier d'inclusion des chocs, lecture du GDX par nom, traduction des statuts, plafond de licence, `MOTEUR_INDISPONIBLE`. Nœud dédié (option b). Exécution des tests 34.1 à 34.6. Intégration de SYLI Standard, puis des cinq autres modèles.
- **Dépendances.** DB-2 (licence au moins d'évaluation serveur), DB-1 ; registre de SYLI (DB-8) ; convention d'inclusion mise en place dans le modèle.
- **Critères d'acceptation.** CR-03, CR-04 et CR-06 sur SYLI Standard ; CR-05 complet sur le nœud dédié ; durées mesurées pour dimensionner la licence (§17.6).
- **Tests de bout en bout.** Faute de licence en CI, le jeu de contrat est exécuté contre l'adaptateur GAMS sur le nœud dédié (recette manuelle consignée) et contre un double de GAMS en CI (lecture de GDX témoins) (proposition).

### B8 — Rapports, GED et actes

- **Contenu.**
  - Composition d'un rapport (E7) à partir de fiches ; table `documents_simulation`.
  - Règle du §6.4 (statut plafonné) avec un point d'extension dans `DocumentsService.changerStatut`.
  - Propagation des rétrogradations : rapport « à revoir » et notifications (§7.2).
  - Registres « RPEF » et « Note de conjoncture » dans `parametrage.ts` ; écouteur `surSignature` → statut Diffusable ; table `rapports_actes`.
  - Modèles de rapport : RPEF, note de conjoncture, éléments de cadrage du CDMT (DB-15) ; exports Word, PDF et Excel marqués (MOD-EF-67).
- **Dépendances.** B4 ; B6 pour un RPEF réel ; DB-10.
- **Critères d'acceptation.** CR-13 (RPEF d'un trimestre réel), MOD-EF-64, MOD-EF-66 et MOD-EF-68. Aucun rapport soumis avec une source exploratoire (409).
- **Tests de bout en bout.** `b8_rapports.js` couvre :
  - rapport avec une source validée → Validé ;
  - acte signé → numéro et Diffusable ;
  - rétrogradation d'une source → rapport « à revoir » et notifications ;
  - test des liens (`i_liens.js`) pour les nouvelles routes web.

### B9 — Extensions sur décision

Enchaînements supervisés (D-27, MOD-EF-60 à 63, MOD-EF-99), comptes externes (DB-6), couche d'IA en mode restreint (DB-14, D-08), copilote d'administration. Chacune fait l'objet d'une conception propre au moment où la décision est rendue.

---

*Fin du document. Aucun code n'est écrit tant que cette conception n'est pas validée (règle de travail n° 2).*
