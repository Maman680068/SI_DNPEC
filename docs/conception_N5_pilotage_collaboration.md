# Conception N5 — Pilotage et collaboration

Lot N5 du socle NIMBA (cahier NIMBA v2.2 : SIG-RF-PTA, SIG-RF-TAC, SIG-RF-MSG, §9 notifications,
A2.8 recherche transverse, SIG-RF-INS ; périmètre fixé par la Direction : points 15 à 20). Livré
après N4, dans sa propre pull request. **Hors N5** : SMS et WhatsApp, branche « paie » des
instructions (D5).

## 1. Plan de travail (SIG-RF-PTA)

Objectif → activité datée (responsable, indicateur) → tâche. Les « Projets » restent un regroupement
libre, sans changement.

| Objet | Champs | Qui crée / modifie |
|---|---|---|
| Objectif | année, unité (Direction, division, section ou cellule), libellé, description | chef de l'unité ; DN, DNA pour toute unité et la Direction |
| Activité | objectif, libellé, responsable (membre actif de l'unité), début, fin, indicateur, cible | mêmes droits que l'objectif |
| Tâche | lien facultatif `activiteId` | créateur de la tâche qui voit l'activité |

- **Avancement d'une activité calculé** (jamais saisi) : moyenne de l'avancement de ses tâches
  principales (avancement N3, déjà calculé en base) ; 0 % sans tâche. Avancement d'un objectif :
  moyenne de ses activités. Activité « en retard » si sa fin est passée et l'avancement < 100 %.
- Visibilité : plan de son unité et des unités au-dessus ; un chef voit les plans des unités de son
  périmètre ; DN, DNA : toute la Direction.
- Rapport d'activité (N4) enrichi : section « Activités du plan de travail » (avancement, indicateur,
  retard) pour le périmètre et la période ; toujours exportable en PDF et Word.
- Écran « Plan de travail » (menu Général) : arbre objectif → activités → tâches, filtres année et unité.

## 2. Tâches : vues et alertes d'échéance (SIG-RF-TAC)

- Vues **Kanban** et **Calendrier** sur tous les écrans de tâches (tableau de bord, « Mes tâches »,
  projet, activité).
- Job quotidien `echeances-taches` (7 h) : la **veille de l'échéance**, notification à chaque assigné
  (une fois, `alerteVeilleAt`) ; **retard** (échéance dépassée, tâche non terminée) : notification au
  chef direct de chaque assigné (une fois, `alerteRetardAt`). Appelable avec une date simulée.

## 3. Messagerie enrichie (SIG-RF-MSG)

- **Fil de discussion** : objet, plusieurs destinataires (tout compte actif), messages successifs.
- **Accusé de lecture par destinataire** (« lu par X à 14 h 32 »).
- **Pièce jointe = renvoi vers un objet de la plateforme** (tâche, document, réunion, courrier) : le
  lien n'est ouvert qu'à qui a le droit de voir l'objet ; un objet protégé (dossier du personnel,
  congé maladie, pli personnel) ne peut pas être joint (400).
- La messagerie directe existante (un à un) reste disponible et son historique conservé.
- Conservation : les messages des fils suivent la règle des 3 ans (N3).

## 4. Notifications : urgentes et résumé quotidien (§9)

- Deux niveaux : **immédiat** (liste fermée : sécurité, décision sur une demande, acte à signer,
  instruction de la Direction, tâche en retard, alerte de supervision) et **regroupé**.
- La notification dans l'application est toujours immédiate. L'email d'un événement regroupé part
  dans un **résumé quotidien** à l'heure choisie par l'agent (défaut 7 h, heure de Conakry) ; les
  immédiats partent tout de suite et **ne peuvent pas être désactivés**.
- Préférences par agent (`/compte/notifications`) : « Résumé quotidien » (défaut) ou « Tout
  immédiatement », heure du résumé. Aucun SMS ni WhatsApp.
- Job horaire `resume-quotidien` : un seul email par agent, liste des événements, liens.

## 5. Recherche transverse (A2.8)

- Barre du haut : `GET /api/v1/recherche?q=` (3 caractères au moins) → tâches, documents, courrier,
  annuaire, réunions (5 résultats par catégorie, lien vers chaque écran).
- **Strictement limitée aux droits** : chaque catégorie réutilise la requête de son module (mêmes
  filtres de visibilité que l'écran) ; aucun objet protégé ; l'administrateur n'obtient que ce que ses
  droits lui ouvrent. Les filtres de recherche de chaque module sont conservés.
- Page « Résultats » (`/recherche?q=`) pour tout voir.

## 6. Instructions de la Direction (SIG-RF-INS)

| Étape | Qui | Règle |
|---|---|---|
| Émise | DN, DNA seulement | objet, texte, destinataire (compte actif), échéance, agent concerné facultatif |
| Reçue | destinataire | à l'ouverture (horodatée) |
| Prise en compte | destinataire | engagement explicite |
| Exécutée | destinataire | avec, pour une instruction RH, l'acte du Courrier qui l'exécute |
| Rejetée | destinataire | motif obligatoire ; l'émetteur est prévenu |

- **Invisible pour l'agent concerné avant l'exécution** (ni liste, ni recherche, ni notification) ;
  visible ensuite, sans le texte de rejet.
- **Relance à 7 jours** : job quotidien, au destinataire (et information à l'émetteur) tant que
  l'instruction n'est ni exécutée ni rejetée, une fois par période de 7 jours.
- Écran « Instructions » : émises (DN, DNA), reçues (destinataires), celles qui me concernent (après
  exécution).

## Modèle de données (migration `socle_nimba_n5`, additive)

- `objectifs`, `activites` ; `tasks.activiteId`, `tasks.alerteVeilleAt`, `tasks.alerteRetardAt`.
- `fils_messages`, `participants_fil`, `messages_fil` (lien facultatif `lienType`, `lienId`),
  `lectures_message`.
- `preferences_notification` (mode, heure) ; `notifications.aEnvoyerLe` (email différé).
- `instructions` (statut, dates de chaque étape, motif, acte lié, `relanceAt`).

## Reprise, retour arrière

- Reprise : aucune donnée à transformer ; toutes les tâches gardent `activiteId` nul ; préférences
  par défaut (résumé quotidien à 7 h) créées à la première lecture ; les emails d'avant N5 restent
  « envoyés ».
- Retour arrière : `prisma/retour-arriere/n5_down.sql` ; phase 39k de `run_all.sh` ; ordre inverse
  des lots (N5 avant N4).
