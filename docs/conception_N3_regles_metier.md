# Conception N3 — Règles métier des congés, des tâches, des stages et de la conservation

Lot N3 du socle NIMBA (cahier NIMBA v2.2 : circuit A6.1, SIG-RF-STG-05/11, annexe 4 ; décisions N1
point 4 : « motif médical et décision des congés en N3 »). Livré après N2, dans sa propre pull request.
Aucun nouvel écran : les règles s'appliquent dans les modules existants.

## 1. Congés et absences — circuit A6.1

| Étape | Qui | Règle |
|---|---|---|
| Dépôt | l'agent | échéance d'avis = dépôt + délai (paramètre `conges.delaiAvisHeures`, 48 h ouvrées, bornes 12–120) ; chef prévenu (« Donner mon avis »), DRH informé |
| Avis | le chef le plus proche | favorable, ou défavorable avec motif ; une seule fois (409 ensuite) |
| Rappel | système | 12 heures ouvrées avant l'échéance, une seule fois |
| Avis tacite | système | échéance passée sans avis : avis « réputé favorable » (TACITE), tracé (auteur : système), décideurs prévenus |
| Décision | le DRH | approuve, ou refuse avec motif ; après l'avis seulement (409 sinon) |

- **Chef le plus proche** : supérieur désigné (assistant), puis chef de la cellule ou de la section,
  puis chef de la division, enfin DN ou DNA ; le premier niveau pourvu d'un compte actif (autre que le
  demandeur) donne l'avis, les niveaux au-dessus ne le donnent pas. Suppléance : le suppléant agit pour
  le chef qu'il remplace.
- **Heures ouvrées** : du lundi au vendredi, heure de Conakry (UTC), sans calendrier des fériés
  (`socle/heures-ouvrees.ts`).
- **Demande d'un DRH** : décidée par le DN ou la DNA ; le DRH ne décide jamais sa propre demande.
- **Traitement** `avis-conges` toutes les 15 minutes (`LeaveRequestsService.executer(date)`, supervisé) :
  échéance posée pour les demandes d'avant N3, rappel, avis tacite.
- **Routes** : `POST /leaves/:id/avis { avis, motif? }` ; `approve`/`reject` réservés au décideur.
  Chaque demande renvoie `etape`, `avisEtat`, `avisEcheance`, `avisPar`, `motifVerrouille` et
  `droits { peutDonnerAvis, peutDecider, peutAnnuler }`.
- **Web** : onglets « Mes congés », « À traiter » (avis ou décision attendus de soi), « Suivi » (autres
  demandes de son périmètre, en lecture) ; circuit et échéance dans le tiroir.

## 2. Motif médical — besoin d'en connaître

- Type « congé maladie » et motif visibles du demandeur et du DRH seulement. Les responsables, DN et DNA
  compris, voient « Absence — motif protégé » et la durée ; le chef donne son avis sans la nature.
- Le motif n'est transmis au DRH qu'avec une preuve de réauthentification (N2, en-tête `X-Reauth`) ;
  sans preuve, `motifVerrouille: true`. Chaque lecture est tracée (`acces_objet_protege`).

## 3. Avancement des tâches calculé

- Déclencheur `tache_avancement_calcule` (BEFORE INSERT/UPDATE sur `tasks`) : part des sous-tâches
  terminées ; sans sous-tâche, selon le statut (à faire 0, en cours 50, rejetée 50, soumise 90,
  terminée ou validée 100). `tache_avancement_parent` recalcule le parent quand une sous-tâche change.
- `PATCH /tasks/:id/progress` conservé (anciens écrans) mais refusé : 409.

## 4. Stage — encadreur principal et rapport (SIG-RF-STG-05/11)

- `GET /stages/:id/encadrants-possibles` (tuteurs du plan), `POST /stages/:id/encadrant-principal`
  (DRH ; compte actif, jamais un stagiaire ; non modifiable après validation du rapport).
- `POST /stages/:id/rapport` (stagiaire seul, stage en cours ou terminé, encadreur désigné),
  `GET /stages/:id/rapport` (stagiaire, encadreur, DRH), `POST …/rapport/valider`,
  `POST …/rapport/renvoyer { motif }` (encadreur). Fichier via `StorageService`.
- Notifications : encadreur (dépôt, « Valider le rapport »), stagiaire (validation, reprise), DRH
  (validation). La fiche du stage affiche le bloc « Rapport de stage » selon `rapport.droits`.

## 5. Conservation (annexe 4)

- Messages directs de plus de 3 ans effacés chaque nuit (0 h 40), pièces jointes comprises
  (`ConservationService.purgerMessages(date)`, tâche supervisée `purge-messages`). L'audit n'est
  jamais effacé.

## Migration, reprise, retour arrière

- `20260930080000_socle_nimba_n3`, additive : 6 colonnes facultatives sur `leave_requests`, 8 sur
  `stages`, un index, deux déclencheurs sur `tasks`, recalcul de l'avancement existant.
- Reprise : l'avancement des tâches existantes est recalculé par la migration ; les congés en attente
  reçoivent leur échéance au premier passage du traitement (48 h ouvrées à partir de ce passage) ;
  aucun avis n'est inventé, les congés décidés restent tels quels.
- Retour arrière : `prisma/retour-arriere/n3_down.sql` (colonnes, index, déclencheurs ; l'avancement
  garde sa dernière valeur), testé par la phase 39i de `run_all.sh`. Ordre inverse : N3 avant N2 et N1.
