# Plan de formation individuel — note de conception

Aujourd'hui, seuls les **besoins** de formation existent (`BesoinFormation`, par unité : exprimé, retenu, réalisé,
écarté). Ce lot ajoute des **sessions de formation par agent**, qui forment le plan de formation individuel.

## Données (migration additive `20261024080000_plan_formation`)

Table `sessions_formation` (modèle `SessionFormation`) :

| Champ | Contenu |
|---|---|
| `intitule` | intitulé de la formation |
| `agentId` | le **compte** de l'agent (`users`) : c'est lui qui est prévenu et dont on retrouve le chef le plus proche |
| `besoinId` | besoin d'origine, facultatif ; doit être **retenu** au moment où la session est créée |
| `dateDebut` | date de début (obligatoire) |
| `dateFin` / `dureeJours` | date de fin **ou** durée en jours (au moins l'un des deux ; fin ≥ début) |
| `organisme` | facultatif |
| `etat` | `SOUHAITEE`, `PLANIFIEE`, `SUIVIE`, `ANNULEE` (type `etat_session_formation`) |
| `creeParId`, `createdAt`, `updatedAt` | traçabilité |
| `alerteDebutAt` | horodatage de l'alerte « début dans 15 jours » (envoyée une seule fois) |

Garde-fous en base : clés étrangères vers `users` et `besoins_formation` (aucune suppression en cascade d'un
besoin), contrainte `CHECK` « fin ≥ début » et « fin ou durée renseignée ». Aucune table existante n'est
modifiée. Retour arrière : `prisma/retour-arriere/formation_down.sql`, contrôlé par la phase 39p de
`run_all.sh` (schéma identique après retour, données d'avant intactes).

## Droits

| Profil | Lecture | Écriture |
|---|---|---|
| DRH (`estDrh`, jamais emprunté en intérim) | toutes les sessions | créer (souhaitée ou planifiée), planifier (dates), marquer « suivie », annuler |
| DN, DNA | toutes les sessions | — |
| Chef le plus proche (`chefsLesPlusProches`, comme l'avis de congé) | sessions de ses agents | — |
| L'agent | ses propres sessions (`GET api/v1/profil/formations`, « Mon profil ») | — |
| Tout autre profil (stagiaire, administrateur, assistant, agent sur le plan d'un autre…) | 403 sur le plan | — |

Routes (`api/v1/rh/formations`) : `GET` (plan visible, avec `droits`), `POST` (DRH), `PATCH :id` (dates,
organisme : DRH), `POST :id/planifier`, `POST :id/suivie`, `POST :id/annuler` (DRH ; transitions
invalides → 409). Chaque écriture est auditée (`SessionFormation`). La liste des agents proposés et des besoins
retenus est donnée par l'API.

## Alerte

Tâche planifiée quotidienne `alertes-formation` (enveloppée par `TachesPlanifieesService.suivre`) : pour chaque
session **planifiée** qui commence dans les `rh.formationAlerteJours` jours (paramètre borné, 15 par défaut, de
3 à 60), notification à l'agent et à son chef le plus proche, une seule fois (`alerteDebutAt`). Notification
existante (`notify(..., { libelleBouton })`), sans nouveau type ; lien vers « Mon profil » pour l'agent, vers
Ressources humaines → Formation pour le chef.

## Écrans

- Ressources humaines → onglet Formation : tableau « Plan de formation » (formation, agent, période, durée,
  état) au-dessus des besoins ; bouton « Planifier une formation » sur un besoin retenu (DRH) ; actions
  « Marquer suivie », « Annuler » (DRH).
- « Mon profil » : section « Mes formations ».

## Démonstration

Deux sessions de démonstration (une planifiée, une suivie) dans le mode « creer », supprimées par le mode
« supprimer » (identifiants « demo-… »).
