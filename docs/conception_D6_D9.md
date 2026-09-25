# Conception — D6 Rotation des stagiaires et D9 Logistique

**Conception seulement : aucun code, aucune migration.** Ce document est à valider par
la Direction avant tout développement. Le cahier des charges v2.1 ne décrit pas ces
deux modules (§5 et §7). Le périmètre proposé ici part de ce qui existe déjà :
- cascade hiérarchique (§2.1) ;
- « besoin d'en connaître » (§2.2) ;
- suspension d'une unité (§2.3) ;
- suppléance (§4.10) ;
- journal d'audit, notifications (in-app + email), stockage de fichiers ;
- dossier du personnel (D3) ;
- actes et courrier (D7).

Chaque module se termine par **au plus 5 questions métier** pour la Direction, chacune
avec une recommandation. Tout le reste est tranché ci-dessous : ce sont des choix
techniques ou des conséquences directes des règles existantes.

---

## D6 — Rotation des stagiaires

### Ce que fait le module

La DNPEC accueille des stagiaires : étudiants, jeunes diplômés, agents en formation.
Un stage se déroule en **périodes successives** dans différentes unités (divisions,
sections, cellules). Chaque période a un **tuteur**. Le module couvre le stage de bout
en bout :

1. **Dossier de stage** : identité du stagiaire, établissement, diplôme préparé,
   encadrant académique, dates, convention de stage (fichier).
2. **Plan de rotation** : suite ordonnée de périodes (unité, dates, tuteur, objectifs),
   sans chevauchement, comprises dans les dates du stage.
3. **Accueil par l'unité** : chaque chef d'unité concerné est prévenu de la période
   prévue chez lui et désigne le tuteur (selon la question D6-2).
4. **Passage d'une unité à l'autre, automatique** : le jour du début d'une période, le
   rattachement du stagiaire devient l'unité d'accueil. L'historique de carrière (D3)
   enregistre une affectation. Le stagiaire, l'ancien tuteur et le nouveau sont
   prévenus.
5. **Évaluation de fin de période** par le tuteur, visée par le chef d'unité.
6. **Clôture** : bilan des évaluations, puis attestation de stage (selon D6-4).

### Qui fait quoi

| Acteur | Peut |
|---|---|
| DRH | Créer le dossier de stage et le plan de rotation, les modifier, interrompre ou clôturer un stage ; voir tous les stages et toutes les évaluations. |
| Chef de l'unité d'accueil (Division, Section ou Cellule, ou son suppléant en intérim) | Voir les stagiaires prévus et présents dans son unité ; désigner le tuteur ; viser les évaluations de son unité. |
| Tuteur (tout agent actif de l'unité d'accueil, chef compris) | Voir le stage pendant sa période ; rédiger et soumettre l'évaluation. |
| Stagiaire | Voir son propre plan et ses tuteurs ; voir ses évaluations une fois visées (selon D6-3). |
| DN / DNA | Tableau de synthèse (qui est où, stages en cours et à venir) ; évaluations visibles comme pour la hiérarchie, **jamais** les pièces personnelles (§2.2). |
| Administrateur système | Création du compte du stagiaire seulement (comme tout compte) ; aucun accès au contenu des stages. |

### Règles tranchées

- **Données personnelles du stagiaire** : elles restent dans le dossier du personnel
  (D3, niveau 2 : coordonnées, diplômes, pièces), avec les mêmes règles. Le module de
  stage ne duplique aucune donnée personnelle. La **convention de stage** est une pièce
  administrative du niveau 2 (personne concernée et DRH seulement).
- **Rattachement automatique** : un job quotidien à 00 h 05, sur le modèle des rappels
  du courrier, applique les changements d'unité du jour. Chaque changement passe par
  les mêmes contrôles que `UsersService` :
  - unité active (§2.3) ;
  - événement de carrière « Affectation » ;
  - audit.

  Une unité **suspendue** au moment du passage bloque le passage. Le DRH est alerté
  et le stagiaire reste dans son unité précédente jusqu'à correction du plan.
- **Plan** :
  - périodes contiguës ou espacées, jamais chevauchantes ;
  - dates comprises dans celles du stage ;
  - une période commencée ne peut plus changer d'unité ; seule sa date de fin reste
    modifiable par le DRH, avec un motif ;
  - toute modification du plan est auditée (avant/après) et notifiée aux tuteurs et
    aux chefs concernés.
- **Tuteur** : compte actif, rattaché à l'unité d'accueil ou chef de cette unité ;
  jamais le stagiaire lui-même. Un tuteur qui change d'unité ou de rôle en cours de
  période est signalé au chef, qui en désigne un autre.
- **Évaluation** :
  - une par période ;
  - rédigée par le tuteur, puis visée par le chef d'unité, selon le même principe que
    le visa des actes (D7) ;
  - le chef peut renvoyer l'évaluation avec un motif ;
  - une évaluation visée est figée ; seul le DRH peut la rouvrir, avec un motif et un
    audit.
- **Notifications** (nouveaux types, chacun avec un libellé de bouton) :
  - `STAGE_PERIODE_A_VENIR` : 3 jours avant, au chef et au tuteur de l'unité d'accueil,
    et au stagiaire ;
  - `STAGE_PERIODE_DEBUT` : le jour même ;
  - `STAGE_EVALUATION_A_FAIRE` : à la fin de la période, puis rappel 3 jours plus tard ;
  - `STAGE_EVALUATION_A_VISER` ;
  - `STAGE_EVALUATION_VISEE`.

  Chaque rappel n'est envoyé qu'une seule fois, comme les rappels du courrier.
- **Visibilité** : un stage n'est visible que par le stagiaire, le DRH, DN/DNA, les
  chefs et tuteurs **des unités de son plan** (pour la période en cours et les
  suivantes ; pour les passées, seulement leur propre évaluation), et les suppléants en
  intérim de ces chefs. La cascade ordinaire ne donne pas accès aux évaluations d'une
  autre unité : un chef ne voit pas ce qu'une autre unité a écrit sur le stagiaire.
- **Hors périmètre** : gratification ou indemnité de stage (liée à la paie, D5) ;
  recrutement ou sélection des candidats ; relation avec les établissements au-delà de
  l'encadrant académique.

### Modèle de données (Prisma, une migration)

```
Stage
  id, userId (le stagiaire, compte), etablissement, diplomePrepare, encadrantAcademique?,
  dateDebut, dateFin, statut (PREVU | EN_COURS | TERMINE | INTERROMPU),
  motifInterruption?, conventionDocumentId? (→ PersonnelDocument, niveau 2),
  attestationActeId? (→ Acte, D7), createdById, createdAt, updatedAt

PeriodeStage
  id, stageId, ordre, divisionId?, sectionId?, celluleId? (même invariant que User),
  dateDebut, dateFin, tuteurId?, objectifs?, statut (PREVUE | ACCEPTEE | EN_COURS | TERMINEE | REFUSEE),
  motifRefus?, rattachementAppliqueAt?, rappelEvaluationAt?, createdAt, updatedAt
  unique (stageId, ordre)

EvaluationStage
  id, periodeId (unique), tuteurId, criteres (Json : { cle: niveau }), appreciation,
  statut (BROUILLON | SOUMISE | RENVOYEE | VISEE), motifRenvoi?, viseeParId?, viseeAt?,
  soumiseAt?, createdAt, updatedAt
```

Contrainte « pas de chevauchement » : vérifiée par le service et, en base, par une
contrainte d'exclusion PostgreSQL sur `(stageId, tsrange(dateDebut, dateFin))`, comme
les triggers d'intégrité du registre du courrier.

### Écrans

- **Personnel → « Stagiaires »**, visible si l'API renvoie au moins un stage lisible :
  - onglets « En cours », « À venir », « Terminés » ;
  - filtre par unité ;
  - pour le DRH : bouton « Nouveau stage » et vue **planning** (lignes = unités,
    colonnes = semaines).
- **Fiche d'un stage** (`/stages/:id`, lien des emails) :
  - en-tête (stagiaire, établissement, dates, statut) ;
  - frise des périodes (unité, tuteur, statut) ;
  - une évaluation par période ;
  - toutes les actions viennent des droits renvoyés par l'API, comme D2 et D3.
- **Fenêtres** : plan de rotation (ajouter, déplacer, modifier une période), désigner
  le tuteur, évaluation (grille et appréciation), visa ou renvoi, interruption
  motivée, clôture.
- **Tableau de bord** : carte « Stagiaires » (présents dans mon unité, évaluations à
  faire ou à viser), affichée seulement si non vide, comme la carte Courrier.

### Questions métier pour la Direction (D6)

**D6-1. Les stagiaires ont-ils un compte dans le système ?**
- a) **Oui, avec un nouveau rôle « Stagiaire » limité** : ses tâches assignées, la
  messagerie, l'annuaire, son stage. Il ne voit jamais les tâches de la section. —
  *Recommandé* : le stagiaire participe au travail sans voir ce qui ne le concerne pas
  (§2.2).
- b) Oui, avec le rôle Chargé d'Études existant : il voit alors les tâches de sa
  section, comme un agent.
- c) Non : le suivi est tenu par le DRH et les tuteurs seulement, sans accès du
  stagiaire.

**D6-2. Qui construit le plan de rotation ?**
- a) **Le DRH planifie ; chaque chef d'unité accepte sa période et désigne le tuteur,
  ou refuse avec un motif.** — *Recommandé* : une seule personne coordonne, et aucune
  unité ne reçoit un stagiaire sans l'avoir accepté.
- b) Le DRH seul, tuteurs compris ; les chefs sont seulement informés.
- c) Le chef de la première unité d'accueil, le DRH validant l'ensemble.

**D6-3. Quelle forme pour l'évaluation, et le stagiaire la voit-il ?**
- a) **Grille fixe de 4 critères** (assiduité, qualité du travail, autonomie,
  intégration ; niveaux : insuffisant, satisfaisant, très satisfaisant) **plus une
  appréciation écrite ; visible par le stagiaire une fois visée par le chef.** —
  *Recommandé*.
- b) Appréciation écrite seule, visible par le stagiaire.
- c) Grille avec note sur 20, **non** visible par le stagiaire (DRH et hiérarchie
  seulement).

**D6-4. Comment délivrer l'attestation de fin de stage ?**
- a) **Comme un acte du module Courrier et actes** : rédigé par le DRH, numéroté dans
  le registre de la Direction, signé par le DN ou la DNA, puis scan joint. —
  *Recommandé* : numérotation officielle, sans trou, et traçabilité déjà en place.
- b) Document PDF généré par le système depuis le dossier, sans numéro officiel.
- c) Hors système (papier), le stage étant seulement marqué « Terminé ».

**D6-5. Faut-il des limites d'accueil ?**
- a) **Aucune limite imposée : le planning signale seulement une unité qui accueille
  plus de 2 stagiaires en même temps.** — *Recommandé* : simple, et le chef garde la
  main par l'acceptation (D6-2).
- b) Capacité maximale par unité, fixée par l'administrateur et bloquante.
- c) Durée minimale d'une période (par exemple 4 semaines), bloquante.

---

## D9 — Logistique (priorité basse)

### Ce que fait le module

Trois volets simples, sans comptabilité :

1. **Inventaire des biens** : matériel informatique, mobilier, équipements. Chaque bien
   porte un numéro d'inventaire, un état et un emplacement, et peut être **affecté** à
   une personne ou à une unité. L'historique des mouvements (affectation, retour,
   réparation, réforme) est complet et jamais effacé.
2. **Demandes logistiques** : fournitures, matériel, intervention (panne, réparation).
   Circuit : demande, validation par le chef direct, traitement par le gestionnaire,
   livraison ou clôture.
3. **Réservation des ressources partagées** : salles, vidéoprojecteur, véhicule selon
   D9-3, avec un calendrier par ressource. Une réunion peut réserver sa salle
   directement.

### Qui fait quoi

| Acteur | Peut |
|---|---|
| Gestionnaire logistique (habilitation donnée par l'administrateur, **pas un rôle** : même principe que les habilitations courrier) | Tenir l'inventaire (biens, mouvements, réforme) ; traiter les demandes validées ; gérer les ressources réservables et annuler une réservation, avec un motif. |
| Chef direct du demandeur (cascade, ou son suppléant en intérim) | Valider ou refuser les demandes de son périmètre, jamais les siennes : elles remontent au chef supérieur, ou à DN/DNA, comme pour les congés. |
| Tout agent actif | Faire une demande, suivre les siennes ; voir les biens qui lui sont affectés et signaler une panne ; réserver une ressource partagée. |
| DN / DNA | Tableau de synthèse : demandes en attente, biens par unité, taux d'occupation des ressources. |
| Administrateur système | Donner et retirer l'habilitation de gestionnaire ; aucun traitement. |

### Règles tranchées

- **Numéro d'inventaire** : attribué par le système, séquentiel par catégorie et par
  année, sans trou ni doublon, avec le même compteur transactionnel que le courrier.
  Un bien réformé garde son numéro, jamais réattribué, et ne peut pas être supprimé :
  ni suppression physique, ni renumérotation, garanties par trigger comme pour le
  registre du courrier.
- **Affectation** :
  - un bien a au plus une affectation en cours, à une personne active ou à une unité
    active (§2.3) ;
  - une personne qui quitte la DNPEC (compte suspendu ou supprimé) garde ses biens en
    affectation ; le gestionnaire est alerté pour organiser le retour ;
  - un changement de rôle ou d'unité ne déplace jamais un bien automatiquement.
- **Circuit des demandes** :
  - états : brouillon → soumise → validée par le chef → en traitement → livrée ou
    clôturée ;
  - refus possible à chaque étape, avec un motif ;
  - validateur : le chef direct, selon la même règle que la validation des congés ;
  - une demande « intervention » sur un bien est rattachée à ce bien et apparaît dans
    son historique.
- **Réservations** :
  - pas de chevauchement sur une même ressource (contrainte d'exclusion en base) ;
  - annulation par le demandeur tant que le créneau n'a pas commencé ;
  - le gestionnaire peut annuler avec un motif, et le demandeur est notifié ;
  - une réunion peut réserver sa salle : le lieu de la réunion (aujourd'hui du texte
    libre) devient alors la salle réservée, et annuler la réunion libère la salle.
- **Notifications** :
  - `LOGISTIQUE_DEMANDE_A_VALIDER` (chef) ;
  - `LOGISTIQUE_DEMANDE_A_TRAITER` (gestionnaires) ;
  - `LOGISTIQUE_DEMANDE_TRAITEE` et `LOGISTIQUE_DEMANDE_REFUSEE` (demandeur) ;
  - `RESERVATION_ANNULEE` ;
  - `BIEN_A_RECUPERER` (gestionnaire, départ d'un détenteur).
- **Besoin d'en connaître** : les demandes sont visibles par le demandeur, sa chaîne
  hiérarchique, les gestionnaires et DN/DNA. L'inventaire complet est visible par les
  gestionnaires et DN/DNA ; un agent voit ses biens ; un chef voit ceux de son unité et
  de ses agents. Aucune donnée personnelle n'est concernée.
- **Export Excel** de l'inventaire et des demandes (audité), comme le registre du
  courrier.
- **Hors périmètre** : achats, bons de commande, fournisseurs, budget, amortissement
  comptable et, selon D9-4, les montants ; gestion de stock fine des consommables
  (quantités en magasin).

### Modèle de données (Prisma, une migration)

```
CategorieBien      id, code (unique), libelle, reservable (bool), actif
Bien               id, numeroInventaire (unique), sequence, annee, categorieId, designation,
                   marque?, numeroSerie?, etat (EN_SERVICE | EN_PANNE | EN_REPARATION | REFORME),
                   emplacement?, valeurAcquisition? (selon D9-4), dateAcquisition?,
                   reservable (bool), createdAt, updatedAt
AffectationBien    id, bienId, userId?, divisionId?, sectionId?, celluleId?, debut, fin?,
                   parId, motif?          -- au plus une affectation ouverte par bien
MouvementBien      id, bienId, type (ACQUISITION | AFFECTATION | RETOUR | PANNE | REPARATION | REFORME),
                   detail (Json), parId, createdAt     -- journal append-only
DemandeLogistique  id, demandeurId, type (FOURNITURE | MATERIEL | INTERVENTION), objet,
                   quantite?, justification, bienId?, statut, validateurId?, valideeAt?,
                   traiteeParId?, traiteeAt?, motifRefus?, compteRendu?, createdAt, updatedAt
Reservation        id, bienId, userId, debut, fin, motif, meetingId?, statut (ACTIVE | ANNULEE),
                   annuleeParId?, motifAnnulation?, createdAt
HabilitationLogistique  id, userId, accordeeParId, createdAt, revoqueeAt?, revoqueeParId?
CompteurInventaire  categorieId, annee, dernier     -- même mécanisme que le courrier
```

### Écrans

- **Général → « Logistique »**, pour tous :
  - onglets « Mes demandes », « À valider » (si l'API en renvoie), « À traiter »
    (gestionnaires), « Réservations » (calendrier par ressource, créneaux libres),
    « Mes biens » ;
  - pour les gestionnaires : onglet « Inventaire », avec recherche, filtres
    (catégorie, état, unité) et export.
- **Fiches** : bien (caractéristiques, affectation en cours, historique des mouvements),
  demande (étapes, comme le circuit de visa des actes).
- **Réunions** : dans la fenêtre de création, choix « Réserver une salle » parmi les
  salles libres sur le créneau, liste renvoyée par l'API.
- **Administration** : « Logistique », avec les catégories et les habilitations de
  gestionnaire.
- **Tableau de bord** : carte « Logistique » (demandes à valider ou à traiter), seulement
  si non vide.

### Questions métier pour la Direction (D9)

**D9-1. Qui est gestionnaire logistique ?**
- a) **Des agents du SAF désignés, via une habilitation donnée par l'administrateur
  système.** — *Recommandé* : même souplesse que les habilitations courrier, sans
  nouveau rôle.
- b) Le Chef du SAF seul.
- c) Un gestionnaire par unité, pour ses propres biens et demandes.

**D9-2. Quel circuit de validation pour les demandes ?**
- a) **Chef direct, puis gestionnaire.** — *Recommandé*, identique aux congés.
- b) Gestionnaire seul, sans validation hiérarchique.
- c) Chef direct, puis DN/DNA pour les demandes de matériel (hors fournitures), puis
  gestionnaire.

**D9-3. Quelles ressources sont réservables, et la réservation est-elle automatique ?**
- a) **Salles de réunion et matériel de présentation ; confirmation immédiate si le
  créneau est libre.** — *Recommandé*.
- b) Même chose, plus les **véhicules de service**, avec validation du gestionnaire
  pour les véhicules.
- c) Salles seulement, réservées uniquement depuis une réunion.

**D9-4. L'inventaire suit-il la valeur des biens ?**
- a) **Non : aucun montant.** — *Recommandé* : pas de comptabilité, pas de donnée
  financière à protéger.
- b) Valeur d'acquisition indicative, visible des gestionnaires et de DN/DNA
  seulement.
- c) Valeur et amortissement annuel (suppose un accord avec la comptabilité).

**D9-5. Faut-il gérer le stock des fournitures ?**
- a) **Non : une demande de fournitures est traitée au cas par cas, sans quantités en
  magasin.** — *Recommandé* pour une priorité basse.
- b) Stock simple par article (entrées, sorties, seuil d'alerte).
- c) Stock par article et par unité.

---

## Ordre de réalisation proposé, après validation

1. **D6** d'abord : il est demandé plus tôt (§7) et s'appuie sur D3 et D7, déjà en
   production.
   - API et migration, puis écrans.
   - Tests : droits par rôle ; le plan est égal à ce que l'API accepte ; le job de
     changement d'unité ; aucune pièce du niveau 2 transmise aux chefs.
2. **D9** ensuite, en deux lots :
   - inventaire et demandes ;
   - puis réservations et lien avec les réunions.
3. Chaque lot suit la même méthode : conception validée, commits testés, cahier des
   charges mis à jour (nouvelles sections du §4 et Annexe B).
