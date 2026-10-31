# S1 — Réunions : demande des chargés d'études, unités entières

## Données (migration additive `20261101080000_demandes_reunion`)

- `demandes_reunion` (`DemandeReunion`) : demandeur, objet, courte explication, début et fin proposés puis
  validés, `participantIds` (personnes, unités déjà dépliées — liste figée), `uniteIds` (unités choisies,
  pour mémoire), état `EN_ATTENTE | ACCEPTEE | REFUSEE | UTILISEE` (type `etat_demande_reunion`),
  `decideurIds` (décideur(s) courant(s)), `decideParId`, `decideeLe`, `motifRefus`, `reunionId` (unique :
  réunion créée avec l'autorisation). « Expirée » est calculée à la lecture (acceptée, non utilisée, date
  passée).
- `etapes_demande_reunion` : historique (DEMANDEE, TRANSMISE, ACCEPTEE, REFUSEE, REUNION_CREEE ; par, vers,
  motif, date), supprimé avec la demande.
- Garde-fous en base : fin > début ; un refus porte toujours son motif ; clés étrangères. Aucune table
  existante modifiée. Retour arrière `prisma/retour-arriere/demandes_reunion_down.sql` (avant
  `formation_down.sql`), phase 39q de `run_all.sh`.

## Droits

| Profil | Réunion | Demande |
|---|---|---|
| Chefs de section, de division, de cellule ; DN ; DNA ; assistants de direction ; DRH | crée directement | — |
| Chargé d'études, administrateur système | 403 sur la création directe ; crée seulement avec sa demande acceptée | « Demander une réunion » |
| Stagiaire | aucun accès (inchangé) | 403 |

- Décideur : le chef le plus proche du demandeur (`chefsLesPlusProches`) — ou son suppléant en intérim
  (en-tête `X-Interim-For`, décision au nom réel du suppléant, journal « par intérim »). Tout autre compte :
  403 sur accepter / refuser / transmettre.
- Accepter : date, heures et participants modifiables. Refuser : motif obligatoire, visible du demandeur
  (jamais dans la notification). Transmettre : au chef le plus proche du décideur ; le DN et la DNA
  décident en dernier (409 s'ils transmettent). Une seule décision (mise à jour conditionnelle).
- Autorisation à usage unique : `POST /meetings { demandeReunionId }` par le demandeur en personne ; date,
  heures et participants validés s'imposent ; seconde utilisation, demande non acceptée ou date passée :
  409. La réunion affiche « Validée par … » (`Meeting.demandeReunion.decidePar`).

## API

`GET api/v1/reunions/droits`, `GET api/v1/reunions/participants-possibles` (personnes actives sans les
stagiaires ; unités ouvertes du socle avec leurs membres, sous-unités comprises), `GET|POST
api/v1/demandes-reunion`, `GET api/v1/demandes-reunion/:id` (demandeur et décideurs seulement),
`POST api/v1/demandes-reunion/:id/accepter|refuser|transmettre`. Notifications (types existants, bouton
nommé) : décideur « Examiner la demande » (`/reunions?demande=`), demandeur « Créer la réunion »
(`/reunions?demande=…&creer=1`) ou « Voir le motif ». « À traiter » du tableau de bord : « Demandes de
réunion à décider » (`/reunions?onglet=demandes`), comptées dans la pastille Réunions.

## Écrans

- Réunions : « Nouvelle réunion » ou « Demander une réunion » selon les droits renvoyés par l'API ;
  panneau « Demandes de réunion à décider » / « Mes demandes de réunion » (état, chez qui, étapes) ;
  fenêtre de décision (Accepter, Refuser, Transmettre à mon chef) ; création préremplie et verrouillée.
- Sélecteur de participants commun (demande et création) : « Ajouter une unité » (toute unité de la DNPEC,
  sous-unités comprises) puis ajout et retrait individuels ; plus aucun stagiaire proposé.

## Démonstration

Deux demandes « TEST — » (une en attente chez la cheffe de section, une acceptée puis utilisée), créées
par le mode « creer » et supprimées par le mode « supprimer ».
