# Lot N1 — Droits et organigramme : conception

Programme « socle NIMBA » appliqué à l'existant. Référence : cahier NIMBA v2.2 (Partie 0 §3 à §6,
§13.5, annexes 1 et 2), **les décisions du responsable du projet primant sur le cahier**.
Document à valider avant tout code. Aucune production n'est touchée par cette conception.

---

## 0. Principe directeur : un pont, pas une refonte

Il n'y a pas d'environnement de recette. N1 ne remplace donc rien d'un coup :

- **Tout est additif.** Nouvelles tables et nouvelles colonnes facultatives uniquement. Aucune
  colonne existante n'est supprimée, renommée ni retypée ; aucune valeur d'énumération n'est
  ajoutée à une table déjà lue par le code actuel (une ancienne version de l'API qui lirait une
  valeur inconnue planterait).
- **L'ancien et le nouveau coexistent.** Les tables `divisions`, `sections`, `cellules`, le champ
  `users.role` et les tables d'habilitation courrier et logistique restent en place **et restent
  à jour** (écriture miroir). Conséquence : revenir à la version précédente de l'API reste
  possible à tout moment, sans perte (voir §6).
- **Les modules métier ne changent pas de comportement en N1** (tâches, GED, congés, réunions,
  courrier, stages, logistique). Ils continuent de lire les rattachements actuels. Ils basculeront
  sur le nouveau référentiel lot par lot, chacun avec sa propre PR.
- **Les nouvelles routes suivent les conventions NIMBA** (`/api/v1/...`, enveloppe d'erreur
  `{ code, message, details, trace_id }`) ; les routes existantes ne changent pas.

---

## 1. Organigramme souple (§3)

### 1.1 Modèle

**`UniteOrganisationnelle`** (table `unites_organisationnelles`) :

| Champ | Contenu |
|---|---|
| `id`, `code` (unique), `libelle` | identité |
| `type` | `DIRECTION`, `DIVISION`, `SECTION`, `CELLULE`, `INSTANCE` (nouvelle énumération) |
| `parentId` | unité parente (récursif) ; nul pour la seule Direction |
| `responsableId` | compte du responsable désigné (voir 1.3) |
| `dateCreation`, `dateFermeture`, `motifFermeture`, `fermeeParId` | cycle de vie daté |
| `divisionId` / `sectionId` / `celluleId` (uniques, facultatifs) | **lien vers la ligne historique** correspondante |

**`HistoriqueUnite`** : une ligne par événement (création, renommage, changement de code, de type,
de parent, de responsable, fermeture), avec valeurs avant/après, date d'effet et auteur. Plus une
trace dans le journal d'audit.

### 1.2 Règles

- **Types et parentés autorisés en N1** : Direction (racine unique) → Division → Section ;
  Direction → Cellule ; Direction → Instance. La structure est récursive en base, mais N1 n'ouvre
  que les combinaisons que les modules actuels savent exploiter. Chaque unité Division, Section,
  Cellule ou Instance créée à l'écran crée **dans la même transaction** sa ligne historique
  (une Instance est portée par une ligne `cellules`). Les combinaisons plus profondes (section
  d'une cellule, etc.) s'ouvriront quand les modules liront `uniteId` (N3 et suivants), sans
  migration de structure.
- **Secrétariat de direction** : unité de type Cellule, code `SECDIR`, rattachée à la Direction,
  créée par la reprise. Ses membres sont les assistants du DN et de la DNA.
- **Fermeture** : datée et motivée. **Refusée (409)** s'il reste un agent En activité ou Suspendu
  rattaché à l'unité ou à une sous-unité, ou une sous-unité ouverte. Une unité fermée garde son
  historique, n'accepte plus de rattachement et n'apparaît plus dans les listes de choix ; ses
  anciens objets restent consultables. La fermeture désactive aussi la ligne historique
  (`isActive = false`).
- **La suspension actuelle (§2.3) reste inchangée**. C'est un état temporaire, distinct de la
  fermeture, qui est définitive.
- **Qui gère** : le DRH et l'administrateur (annexe 1.2 : « Unité organisationnelle CLM(T) »).
  Tout le monde lit l'organigramme (L(T)).
- **Écrans** : la page **Organisation** devient l'organigramme interactif (arbre dépliable,
  responsable, effectif, unités fermées masquables). Les actions sont créer, renommer, changer
  de code, de type ou de parent dans les combinaisons autorisées, désigner le responsable et
  fermer. Aucun développement n'est nécessaire pour créer une cellule ou une section (critère
  CA-A-02).

### 1.3 Responsable d'unité

Aujourd'hui, le chef se déduit du rôle (chef de division ou de section) ou de `Cellule.chefId`.
En N1, **le changement de rôle actuel reste la seule porte d'entrée** pour nommer un chef :
quand quelqu'un devient chef de X, `responsableId` est mis à jour dans la même transaction.
Le **suppléant** d'une unité est celui de la suppléance active de son responsable (modèle
`Suppleance` actuel, inchangé). Aucun second champ n'est créé, pour éviter deux sources qui
divergent.

---

## 2. Agent séparé du compte (§4, §6)

### 2.1 Modèle

**`Agent`** (table `agents`) — la personne physique, qui survit au départ :

| Champ | Contenu |
|---|---|
| `matricule` | **unique, obligatoire** ; `matriculeProvisoire` (booléen) tant que le DRH ne l'a pas remplacé |
| `nom`, `prenoms`, `genre` (facultatif, pour les effectifs de N6) | identité |
| `uniteId` | rattachement canonique (unité organisationnelle) |
| `fonction` | intitulé du poste (repris de `jobTitle`) |
| `statut` | `EN_ACTIVITE`, `SUSPENDU`, `PARTI` (nouvelle énumération) |
| `dateFinPrevue` | fin de stage ou de contrat (alerte J-15, désactivation automatique) |
| `dateDepart`, `motifDepart` | renseignés au passage à Parti |

**`MouvementAgent`** : historique daté (entrée, mutation, suspension, retour en activité, départ),
avec l'auteur et le motif.

**`users.agentId`** : nouvelle colonne facultative et unique. Le compte reste la table `users`,
et ses états actuels suffisent : En attente, Actif, Suspendu, et **`SUPPRIME`, affiché
« Désactivé »** (même sens : connexion bloquée, rien n'est effacé). Aucune nouvelle valeur n'est
ajoutée.

Le **dossier du personnel** (niveaux 1 et 2) reste attaché au compte. Il survit déjà au départ,
car un compte n'est jamais supprimé physiquement. Son rattachement direct à l'agent se fera en
N6 (carrière), avec les actes RH.

### 2.2 « Aucun compte sans agent »

- **En N1, par l'application.** Chaque création de compte crée ou rattache un agent :
  - création par l'administrateur (choix d'un agent existant, ou création du dossier agent
    dans le même formulaire) ;
  - approbation d'une inscription (agent créé à l'approbation ; une inscription en attente n'a
    pas encore d'agent) ;
  - import Excel du personnel ;
  - création d'un stagiaire ;
  - script de démonstration.

  Au démarrage, un **rattrapage idempotent** crée l'agent manquant de tout compte actif créé
  entre la migration et le déploiement de la nouvelle API. Il est tracé et vide en temps normal.
- **En base, en deux temps.** La contrainte `CHECK (status <> 'ACTIF' OR agent_id IS NOT NULL)`
  n'est posée qu'en N2, une fois la nouvelle API en service. La poser dès N1 ferait échouer
  l'ancienne API pendant la fenêtre entre la migration et le déploiement.

### 2.3 Cycle de vie (DRH seul)

| Passage | Effets automatiques, dans une transaction |
|---|---|
| En activité → **Suspendu** (motif obligatoire) | Compte suspendu, sessions fermées |
| Suspendu → **En activité** | Compte réactivé |
| → **Parti** (date et motif obligatoires) | Compte désactivé, sessions fermées ; **tâches en cours transférées au responsable de l'unité** (tâches non terminées dont l'agent est responsable ou co-responsable, remplacé par le chef, avec une trace et une notification) ; suppléances en cours révoquées ; rôles fonctionnels clos à la date de départ ; s'il était responsable d'unité, le poste devient vacant et le DRH est alerté ; dossier conservé |
| **Fin de stage** (tâche planifiée quotidienne) | À J-15 : alerte au DRH (une seule fois). À l'échéance : compte désactivé et agent passé Parti, motif « Fin de stage », effectué par le système et tracé |

Même traitement pour une **fin de contrat** si `dateFinPrevue` est renseignée. Refus en 403 pour
tout autre que le DRH ; 409 pour une transition invalide (par exemple Parti vers Suspendu).
Le DRH ne peut pas agir sur son propre agent.

---

## 3. Habilitation à deux axes (§5)

### 3.1 Axe 1 — le périmètre (calculé, jamais saisi)

Le périmètre se calcule depuis la position de la personne, c'est-à-dire son rôle hiérarchique
actuel (`users.role`), son unité et ses suppléances actives :

| Position | Périmètre |
|---|---|
| DN, DNA | Direction (même niveau) |
| Chef de division, de section, de cellule | Son unité et ses sous-unités |
| Agent (Chargé d'études) | Son unité d'affectation |
| Assistant | Direction par délégation, pour un assistant du DN ou de la DNA (courrier, réunions, suivi ; jamais un objet protégé), ou périmètre de son chef de cellule — **comportement actuel conservé** |
| Stagiaire | Restreint — **comportement actuel conservé** (liste blanche) |
| Administrateur | Aucun périmètre hiérarchique |

**Intérim conservé tel quel** : l'en-tête `X-Interim-For` fait emprunter la position, donc le
périmètre, du titulaire. Les rôles fonctionnels ne s'empruntent jamais, comme aujourd'hui pour
les habilitations.

### 3.2 Axe 2 — les rôles fonctionnels (attribués, datés, cumulables)

**`AttributionRole`** (table `attributions_roles`) : compte, rôle, **portée facultative** (pour
l'agent du courrier : registre + unité, soit la granularité actuelle), `dateDebut`, `dateFin`,
motif, attribué par ; retrait daté, motivé et journalisé. Aucune suppression physique.

Rôles (nouvelle énumération) : `DRH`, `GESTIONNAIRE_RH`, `CHEF_SAF`, `GESTIONNAIRE_PAIE`,
`ENCADREUR_STAGE`, `AGENT_COURRIER`, `ASSISTANT`, `VALIDATEUR`, `GESTIONNAIRE_LOGISTIQUE` ;
prévus sans écran : `RESPONSABLE_MODELE`, `ANALYSTE`, `DECIDEUR`.

- **Attribution et retrait** : l'administrateur, écran « Rôles fonctionnels » de la gestion des
  comptes. Les écrans actuels d'habilitation (courrier → Habilitations, logistique →
  Gestionnaires) restent et écrivent désormais des attributions. Leur miroir vers les anciennes
  tables est maintenu.
- **Un rôle ne donne jamais de périmètre** et ne perce jamais un objet protégé.
- **Rôle DRH** : les droits aujourd'hui liés à `users.role = DRH` passent sur l'attribution
  `DRH`. La valeur `DRH` de `users.role` reste une position sans périmètre ; la réaffectation des
  personnes concernées sur une vraie position (agent ou chef de la cellule RH) pourra se faire
  ensuite par le changement de rôle, sans urgence.

### 3.3 Ordre d'évaluation (§5.5) et refus journalisés

Un nouveau service **`AutorisationService.evaluer(acteur, action, objet)`** applique l'ordre
normatif. Il s'arrête à la première étape décisive :

1. **L'objet est-il protégé ?** Si oui, l'accès est décidé par le seul besoin d'en connaître.
   La liste est déclarée en un endroit unique : motif et certificat médicaux, dossier niveau 2,
   suggestion anonyme, espace privé d'unité, évaluation individuelle. Les règles actuelles de
   chaque objet sont conservées.
2. **Compte externe ?** Étape présente mais toujours négative (comptes externes hors périmètre).
3. **Le périmètre couvre-t-il l'objet ?** Sinon, refus.
4. **Le rôle fonctionnel requis est-il détenu ?** Sinon, refus.

Les nouvelles routes l'utilisent directement. `CascadeService` garde exactement son interface
et ses résultats, car tous les modules l'appellent. Ses méthodes « rôle transverse » (DRH) lisent
désormais les attributions.

**Refus journalisés** : nouvelle table `acces_refuses` (compte, intérim, méthode, route, type et
identifiant d'objet si connus, étape de refus, `trace_id`, date). Elle est alimentée par le
service **et** par le filtre d'erreurs, de sorte que tout 403, ancien ou nouveau, est tracé. Une
table dédiée évite d'ajouter une valeur à l'énumération du journal d'audit, lue par l'ancien code.

### 3.4 Matrice de l'annexe 1 en tests automatisés

La suite `n1_matrice` rejoue, côté serveur, chaque ligne de l'annexe 1.1, 1.2 et 1.4 pour les
objets **qui existent aujourd'hui**. Chaque ligne est jouée pour chaque colonne (DN/DNA, chef de
division, chef de section, agent, DRH, SAF, encadreur, administrateur, assistant, stagiaire),
avec les codes C/L/M/V/S et les portées T/P/U/S : accès accordé ou 403, refus présent dans
`acces_refuses`.

Les lignes des objets à venir sont écrites mais marquées « lot N3/N5/N6 », et s'activent avec
leur lot. Le domaine B est exclu.

**Écarts entre l'annexe 1 et l'existant** : le comportement actuel est conservé en N1, et
l'alignement se fait dans le lot indiqué. La suite de tests documente chaque écart.

| Objet | Annexe 1 | Aujourd'hui | Aligné en |
|---|---|---|---|
| Motif médical | DRH seul | DN/DNA le voient quand aucun chef plus proche n'existe | N3 (décision n°8) |
| Demande d'absence | Avis du chef, décision du DRH | Validation par le chef | N3 (décision n°7) |
| Journal d'audit | Lecture DN/DNA (T), chefs (P), agent (S) | Aucun écran de lecture | N2 |
| Paramétrage | Lecture DN/DNA, modification admin/DRH/SAF bornée | Absent | N2 |
| Activité, instruction, acte RH | — | Objets absents | N5, N6 |

---

## 4. Reprise automatique (dans la migration, déterministe)

La reprise est écrite en SQL dans la migration. Elle est idempotente, n'utilise que des
identifiants stables, et laisse une trace d'audit « Système ».

1. **Direction** : une unité `DNPEC` de type Direction ; responsable = le DN actif le plus ancien.
2. **Divisions → unités Division ; sections → unités Section** sous leur division ;
   **5 cellules → unités Cellule**, avec les mêmes codes et libellés, la date de création
   d'origine et le lien vers la ligne historique. Les unités suspendues restent ouvertes et
   suspendues.
3. **Secrétariat de direction** (`SECDIR`) créé, avec sa ligne `cellules` associée.
4. **Responsables** : chef de division ou de section actif (rôle et rattachement),
   `Cellule.chefId`. Un doublon n'est pas tranché : il est signalé en anomalie.
5. **Agents** : un par compte non « en attente ».

   | Compte | Agent |
   |---|---|
   | Actif | En activité |
   | Suspendu | Suspendu |
   | Supprimé | Parti (date = dernière modification, motif « Reprise ») |

   Matricule provisoire `P-000001`… (par ordre d'ancienneté), marqué provisoire. Unité issue du
   rattachement actuel : section, sinon division, sinon cellule. Les assistants du DN ou de la
   DNA vont dans `SECDIR` ; ceux d'un chef de cellule dans cette cellule. Le DN, la DNA et un
   administrateur sans rattachement vont dans la Direction. Pour un stagiaire, `dateFinPrevue`
   = fin du stage en cours. Fonction reprise de `jobTitle`. Le DRH remplace les matricules
   provisoires au fil de l'eau.
6. **Rôles fonctionnels** :

   | Situation actuelle | Rôle fonctionnel |
   |---|---|
   | `role = DRH` | `DRH` |
   | Assistant de direction | `ASSISTANT` |
   | Habilitations courrier, actives et révoquées | `AGENT_COURRIER` (registre + unité, dates d'origine) |
   | Gestionnaires logistiques | `GESTIONNAIRE_LOGISTIQUE` |
   | Tuteurs des stages en cours | `ENCADREUR_STAGE` |
   | Chef de la cellule SAF | `CHEF_SAF` |
   | DN et DNA | `VALIDATEUR` (§5.4) |
7. **Congés en cours** : rien n'est modifié. Les demandes soumises, approuvées ou à venir
   continuent leur circuit actuel, ce qui est vérifié par les tests.
8. **Rapport d'anomalies** : écran DRH « Reprise : points à traiter ». Il est calculé en direct
   et chaque point disparaît quand sa cause est traitée :
   - matricules provisoires ;
   - unités sans responsable ;
   - chefs en double ;
   - agents rattachés à une unité suspendue ;
   - stagiaires sans date de fin.

**Test sur jeu réaliste** : une phase de la suite construit une base à l'état **d'avant N1**
(toutes les migrations sauf N1). Elle y charge un jeu réaliste :
- l'organigramme complet du glossaire (5 divisions, 19 sections, 5 cellules) ;
- environ 60 comptes de tous rôles et états (dont inscriptions en attente, suspendus,
  supprimés) ;
- stagiaires, habilitations accordées puis révoquées, gestionnaires logistiques, suppléances ;
- congés dans tous les états.

Elle applique ensuite N1 et vérifie, chiffre par chiffre, qu'aucune donnée n'est perdue ni
modifiée : comptes, rôles, rattachements, congés, habilitations. Elle rejoue ensuite le retour
arrière, puis réapplique N1.

---

## 5. Impacts module par module

| Module | En N1 |
|---|---|
| **auth** | Le compte connecté porte son agent et ses rôles fonctionnels actifs ; connexion refusée si l'agent est Suspendu ou Parti (déjà le cas par l'état du compte) ; `trace_id` sur chaque requête (en-tête `X-Trace-Id`) |
| **org** | Nouveau : unités (`/api/v1/unites`), organigramme, historique, fermeture. Les écrans de suspension actuels restent |
| **users / role-change** | Création, approbation et import créent l'agent ; le changement de rôle met à jour responsable et unité de l'agent ; nouvel onglet Rôles fonctionnels ; le libellé « Supprimé » devient « Désactivé » |
| **personnel** | Nouvel écran DRH « Agents » : liste, matricule, cycle de vie, fins prévues, points de reprise. Dossier niveaux 1 et 2 inchangé |
| **courrier** | Habilitations lues depuis `AGENT_COURRIER`, écrites avec miroir ; comportement identique |
| **logistique** | Gestionnaires lus depuis `GESTIONNAIRE_LOGISTIQUE`, miroir ; comportement identique |
| **stages** | Fin de stage : alerte J-15 et désactivation automatique ; encadreurs inchangés (encadreur principal en N3) |
| **tâches** | Transfert au chef lors d'un départ ; visibilité inchangée |
| **GED, congés, réunions, communication, suggestions** | Inchangés (ils basculent sur `uniteId` dans leurs lots) |
| **suppléances** | Inchangées ; révoquées au départ d'un agent |
| **paramétrage initial / démonstration** | `parametrage.ts` : unités Direction et `SECDIR` si absentes. `demo.ts` : agents des comptes et unités « TEST — » dans les deux modes, et test `z_demo_*` |
| **aide** | Guides DRH (Agents, points de reprise), administrateur (Rôles fonctionnels, Organigramme), tous (organigramme) ; captures et PDF régénérés |
| **cahier des charges** | v2.4 : N1 et journal des décisions |

**Nouvelles routes** (conventions NIMBA) :
- `GET/POST /api/v1/unites`, `PATCH /api/v1/unites/:id`, `POST /api/v1/unites/:id/fermeture`,
  `GET /api/v1/organigramme` ;
- `GET/POST /api/v1/agents`, `POST /api/v1/agents/:id/{suspension,reactivation,depart}`,
  `GET /api/v1/agents/reprise` ;
- `GET/POST /api/v1/attributions-roles`, `POST /api/v1/attributions-roles/:id/retrait`.

Chaque réponse renvoie les droits de l'écran (`droits`) ; le web n'en calcule aucun.

---

## 6. Retour arrière

- **Niveau 1, immédiat et sans perte : revenir au déploiement précédent** (Render → service →
  Events → Rollback, API puis web). L'ancienne API fonctionne sur le schéma migré, car celui-ci
  est purement additif. Les écritures miroir gardent `divisions`, `sections`, `cellules`,
  `habilitations_courrier` et `habilitations_logistique` à jour. Ce qui a été créé
  exclusivement dans N1 dort sans gêner l'ancienne version : historique d'unité, cycle de vie,
  matricules, refus journalisés, et unités créées au-delà des types historiques (il n'y en a
  pas en N1). Un redéploiement de N1 ensuite retrouve tout.
- **Niveau 2, abandon définitif de N1 : script `apps/api/prisma/retour-arriere/n1_down.sql`.**
  Il supprime les nouvelles tables, colonnes et énumérations, puis marque la migration comme
  annulée. Il n'efface aucune donnée antérieure à N1. Il est lancé par un workflow manuel, sur
  le même modèle que les migrations, et jamais par moi.
- **Vérifié en CI** : sur le jeu réaliste, N1 est appliqué, retiré, puis réappliqué. Le schéma
  après retrait est comparé au schéma d'avant (`pg_dump --schema-only`), puis la suite complète
  est rejouée.
- **Documentation** : `docs/Exploitation.md`, nouvelle section « Retour arrière d'un lot ».

**Ordre de déploiement de N1** :
1. PR, puis CI verte ;
2. migration par `db-migrate.yml`, lancée par vous ;
3. fusion ;
4. Render redéploie l'API puis le web ;
5. vérifier `/health` et `/api/version` (commit de fusion) ;
6. vérifier l'écran « Reprise : points à traiter ».

---

## 7. Choix techniques proposés (à valider avec la conception)

1. **Pont additif plutôt que refonte** : les anciennes tables restent la source des modules
   jusqu'à leur bascule ; en N1, les types et parentés sont limités aux combinaisons que les
   modules exploitent déjà.
2. **Matricule provisoire** généré à la reprise (`P-000001`…) et signalé, le matricule restant
   unique et obligatoire.
3. **Compte « Désactivé » = état `SUPPRIME` existant** relibellé, sans nouvelle valeur.
4. **« Aucun compte sans agent » en deux temps** : par l'application en N1, par une contrainte
   en base en N2.
5. **Refus journalisés dans une table dédiée**, alimentée aussi par le filtre d'erreurs (tout 403
   tracé).
6. **Écarts à l'annexe 1 conservés en N1** et alignés dans les lots N2, N3, N5 et N6 (§3.4).
7. **Reprise des rôles** : DN et DNA reçoivent Validateur ; le chef de la cellule SAF reçoit
   Chef SAF ; aucun Gestionnaire RH ni Gestionnaire paie n'est déduit automatiquement.
8. **Rôles fonctionnels jamais empruntés en intérim**, comme les habilitations actuelles.
9. **Fin de stage** : l'agent passe automatiquement Parti (motif « Fin de stage »), en plus de la
   désactivation du compte.
10. **Dossier du personnel** laissé attaché au compte en N1 (rattachement à l'agent en N6).

Note : `docs/nimba-plateforme-complete.html` (prototype) n'est pas présent sur la branche par
défaut ; seul le cahier `.docx` a été déposé.
