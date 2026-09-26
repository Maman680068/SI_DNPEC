# Données de démonstration

Pour une présentation de validation à la Direction, en production, puis retrait complet.
Script : `apps/api/prisma/demo.ts`. Workflow : **Données de démonstration (manuel)**.

## Lancer la démonstration

1. GitHub → **Actions** → « Données de démonstration (manuel) » → **Run workflow**.
2. Branche : `main`.
3. Mode : `creer`.
4. Mot de passe : choisissez un mot de passe **provisoire** (10 caractères au moins), commun à
   tous les comptes de démonstration.
   - Il est masqué dans les journaux.
   - Il reste visible dans le détail de l'exécution pour les personnes qui ont accès au dépôt.
   - Ne réutilisez donc jamais un vrai mot de passe.
5. Confirmation : tapez `demo`, puis **Run workflow**.
6. Ouvrez l'exécution → l'étape « Données de démonstration — creer ». Le journal donne :
   - la liste de ce qui a été créé ;
   - le compte qui sert à la **vue Direction**. Si un DN ou une DNA réel(le) est actif(ve),
     c'est son compte. Sinon, un DN de démonstration est créé (`dn@demo.dnpec.test`).

Relancer `creer` ne duplique rien. Cela remet le mot de passe saisi et repart pour
14 jours.

**Après 14 jours**, les comptes de démonstration sont suspendus automatiquement.

## Comptes de démonstration

Même mot de passe pour tous : celui saisi au lancement.

| Email | Rôle | Unité | À montrer |
|---|---|---|---|
| `chef.division@demo.dnpec.test` | Chef de Division | TEST — Division Démo | Tableau de bord, réunions, imputation et signature du courrier |
| `chef.section.analyses@demo.dnpec.test` | Cheffe de Section | TEST — Section Analyses | Validation des tâches ; suppléée (suppléance en cours) |
| `chef.section.syntheses@demo.dnpec.test` | Chef de Section | TEST — Section Synthèses | Congé maladie à valider, suppléance (agir en intérim) |
| `chef.cellule@demo.dnpec.test` | Cheffe de Cellule | TEST — Cellule Démo | Tâches de la cellule, annonce, atelier ouvert |
| `agent.conde@demo.dnpec.test` | Chargé d'Études | TEST — Section Analyses | Mes tâches, documents, messagerie ; tuteur du stagiaire |
| `agent.barry@demo.dnpec.test` | Chargée d'Études | TEST — Section Analyses | Tâche soumise, acte en visa, congé en attente |
| `agent.keita@demo.dnpec.test` | Chargé d'Études | TEST — Section Synthèses | Tâche rejetée avec motif, congé refusé |
| `agent.toure@demo.dnpec.test` | Chargée d'Études | TEST — Section Synthèses | Congé maladie (masqué pour la Direction) |
| `agent.sylla@demo.dnpec.test` | Chargé d'Études | TEST — Cellule Démo | Tâches de la cellule, suggestion anonyme |
| `assistant@demo.dnpec.test` | Assistante de Direction | auprès de la Cheffe de Cellule | Visibilité héritée de sa supérieure |
| `stagiaire@demo.dnpec.test` | Stagiaire | (plan de rotation) | Mon stage : 2 périodes, évaluation visée |
| `secretariat@demo.dnpec.test` | Chargée d'Études, secrétariat courrier | TEST — Division Démo | Courrier : registres TEST-ARR et TEST-DEP |
| `logistique@demo.dnpec.test` | Chargé d'Études, gestionnaire logistique | TEST — Cellule Démo | Demandes, inventaire, réservations, stock |

Deux autres comptes existent :
- `systeme@demo.dnpec.test` : compte technique (DRH), **jamais connectable**, qui a créé le stage et
  les dossiers du personnel.
- `dn@demo.dnpec.test` : créé **seulement** s'il n'y a aucun DN ni DNA réel.

Tous les noms commencent par « TEST — ».

## Ce qui est créé

- **Tâches** : ≈ 30, dans tous les états :
  - à faire, en cours, en retard, soumises, terminées ;
  - des sous-tâches et des commentaires ;
  - une tâche rejetée avec son motif ;
  - une tâche diffusée à toute la division.
- **Réunions** : 4.
  - Une passée, avec compte rendu et deux décisions, dont une convertie en tâche.
  - Un séminaire à venir, avec la salle de démonstration réservée.
  - Un atelier ouvert.
  - Un point hebdomadaire.
- **Congés** : 5, dont un congé maladie en attente. Le chef le voit ; la Direction voit
  « Absence — motif protégé ».
- **Communication** :
  - 2 annonces ;
  - 1 sondage avec 6 votes ;
  - des messages ;
  - 2 suggestions, dont une anonyme.
- **GED** : 3 documents (privé, final, publié). Les fichiers sont un PDF « document de
  démonstration » livré avec l'application.
- **Dossiers du personnel** : 4 fiches partielles et une suppléance en cours.
- **Courrier**, dans les registres dédiés TEST-ARR et TEST-DEP (jamais les vrais registres) :
  - 4 arrivées, dont 3 imputées ;
  - un acte en visa ;
  - un acte signé, numéroté et expédié.
- **Stage** : plan de rotation en 2 périodes, évaluation visée.
- **Logistique** :
  - 3 biens inventoriés dans la catégorie TST (numéros TST-…) ;
  - des demandes ;
  - du stock ;
  - des réservations sur des ressources de démonstration.

## Garanties

- **Rien de réel n'est modifié.** Aucune unité, aucun compte, aucun registre, aucune donnée existante.
  Cela est vérifié par empreinte de toute la base avant et après, dans les tests.
- **Aucun email** n'est envoyé vers `@demo.dnpec.test` : c'est bloqué dans le service d'emails
  lui-même.
- **Aucune notification** n'est envoyée à un compte réel par le script.

À savoir :
- Les comptes réels de la Direction, du DRH et des gestionnaires logistiques **voient** les données
  de démonstration, parce qu'elles sont dans leur périmètre.
- À l'inverse, le gestionnaire logistique de démonstration voit tout l'inventaire. S'il est créé,
  le DN de démonstration voit aussi les contenus réels de son périmètre. Donnez ces accès
  uniquement aux personnes présentes à la présentation.

## Retirer la démonstration (après la présentation)

Même workflow, mode `supprimer`, confirmation `demo` (mot de passe inutile).

**Supprimés** : tâches, réunions, congés, annonces, sondages, suggestions, messages,
notifications, documents, suppléance, dossiers du personnel, stage, demandes logistiques,
habilitations, et les unités de démonstration (sauf si un compte réel y a été rattaché
entre-temps : elles sont alors seulement désactivées).

**Conservés, car la base interdit leur suppression** :

| Élément | État après suppression | Visible où |
|---|---|---|
| Courrier TEST-ARR / TEST-DEP numéroté | **annulé** | Courrier → Arrivées / Départs (Direction), marqué ANNULÉ, « unité supprimée » |
| Registres TEST-ARR, TEST-DEP | désactivés | filtre des registres, marqués « (désactivé) » |
| Biens TST | **réformés** | Logistique → Inventaire (gestionnaires), état Réformé |
| Réservations de démonstration | **annulées** | historique des ressources de démonstration (désactivées) |
| Catégories TST, TSF, articles, ressources | désactivés | Administration → Logistique |
| Comptes `@demo.dnpec.test` | **SUPPRIME** | Administration → Utilisateurs et Dossier du personnel (vue Direction/DRH), marqués « Supprimé » |
| Journal d'audit | conservé | traçabilité |

Relancer `supprimer` ne fait rien de plus.
