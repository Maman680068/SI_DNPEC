# Liste de vérification — démarrage réel du socle NIMBA

À dérouler **une fois N6 en production**, avant la séance de formation et l'annonce aux agents.

**Repérer le travail à faire :**
- Lancez d'abord le **rapport de qualité des données** : GitHub → Actions → « Rapport de qualité
  des données (manuel, lecture seule) » → `qualite`.
- Il donne, rubrique par rubrique, le **nombre** d'éléments à traiter, sans aucun nom.
- Les noms se lisent ensuite dans les écrans indiqués.
- Relancez-le à la fin : chaque ligne à zéro (ou expliquée) vaut coche.

| # | Vérification | Qui | Où, dans l'application | Fait quand |
|---|---|---|---|---|
| 1 | **Jours fériés de l'année et de l'année suivante**, fêtes religieuses comprises (Tabaski, Maouloud, Ramadan, Lundi de Pâques, Assomption, Noël…). Les fêtes fixes sont pré-remplies ; les dates variables se saisissent chaque année. | DRH ou administrateur | Personnel → « Congés & absences » → onglet « Jours fériés » → « + Ajouter » | Rubrique « Années sans jour férié saisi » à 0, et les dates religieuses de l'année présentes |
| 2 | **Registres des familles d'actes RH.** Les 4 familles obligatoires (arrêté d'affectation, décisions de nomination, d'avancement et de fin de contrat) reliées chacune à son registre du Courrier, de portée « Direction » et de nature « Actes ». | Administrateur (registres), DRH (choix) | Administration → « Courrier » → « + Nouveau registre » ; puis Ressources humaines → « Carrière et actes » → « Familles d'actes » | Rubrique « Familles d'actes RH sans registre » à 2 au plus (les attestations, facultatives) |
| 3 | **Matricules provisoires** remplacés par les matricules définitifs. | DRH | Personnel → « Agents » → filtre « Matricule provisoire » → fiche de l'agent → « Modifier » | Rubrique « Matricules provisoires à remplacer » à 0 |
| 4 | **Dossiers « à vérifier »** confirmés par chaque agent. | Chaque agent (le DRH relance) | Personnel → « Dossier du personnel » → « Confirmer mes informations » | Rubrique « Dossiers avec des informations à vérifier » en baisse chaque semaine |
| 5 | **Dossiers incomplets** : pièces requises déposées (pièce d'identité, acte de naissance, diplôme, casier judiciaire, procès-verbal de prise de service). | DRH | Ressources humaines → « Alertes » ; dossier → « Ajouter une pièce » → choisir la pièce requise | Rubrique « Dossiers incomplets » en baisse |
| 6 | **Chefs d'unité non pourvus.** Chaque division, section et cellule a son responsable. | Administrateur, sur décision de la Direction | Utilisateurs → « Gérer » → « Changer de rôle » (chef de division ou de section) ; Organisation (chef de cellule) | Rubrique « Unités sans chef désigné » à 0 |
| 7 | **Chefs en double** sur une même unité. | Administrateur | Utilisateurs → changement de rôle de l'un des deux | Rubrique « Unités avec deux chefs actifs » à 0 |
| 8 | **Agents sans unité** rattachés. | DRH | Personnel → « Agents » → fiche → « Modifier » → unité | Rubrique « Agents sans unité » à 0 |
| 9 | **Comptes inactifs.** Comptes jamais utilisés, ou sans connexion depuis 90 jours : relancer la personne, enregistrer son départ (DRH) ou suspendre le compte (administrateur). | Administrateur et DRH | Administration → « Paramétrage et supervision » → « Comptes à surveiller » ; Utilisateurs | Les deux rubriques « Comptes… » expliquées une à une |
| 10 | **Inscriptions en attente** traitées. | Administrateur | Utilisateurs → « Inscriptions en attente » | Rubrique à 0 |
| 11 | **Deux administrateurs** au moins, chacun avec la double authentification. | Administrateur | Utilisateurs ; cadenas 🔒 → « Sécurité du compte » | — |
| 12 | **Secret `WEB_PROXY_SECRET`** saisi avec la même valeur sur l'API et le web (revue de sécurité ; une fois cette PR déployée). | Responsable du projet | Render → `dnpec-api` et `dnpec-web` → Environment | Plus d'avertissement « WEB_PROXY_SECRET est vide » dans les journaux de l'API |
| 13 | **Première sauvegarde complète** : export de la base **et** archive des fichiers, rangés ensemble ; puis « Déclarer un test de restauration » après un essai. | Responsable du projet, administrateur | Render → la base → Recovery ; Supervision → « Télécharger les fichiers (ZIP) » (une fois la PR d'exploitation déployée) | — |
| 14 | **Supervision au vert** (hors emails si le SMTP n'est pas configuré). | Administrateur | Administration → « Paramétrage et supervision » → onglet « Supervision » | État global « nominal » |
| 15 | **Séance de formation** planifiée, fiches d'une page imprimées, note d'annonce publiée. | Direction, CSID | `docs/formation/Support_formation_45min.md`, `Prise_en_main_*.pdf`, `Annonce_socle_NIMBA.md` | — |

Ordre conseillé :
- d'abord 6, 7 et 8 : les unités et leurs chefs conditionnent les avis de congé et la visibilité ;
- puis 1 et 2 ;
- puis 3, 4 et 5, au fil des semaines ;
- 9 à 15 le jour du démarrage.
