# Indicateurs de succès — note de conception

Onglet « Indicateurs de succès » de « Paramétrage et supervision ». Il dit, à partir des vraies données de
l'application, si les objectifs d'usage du SI sont atteints. **Rien n'est stocké** : chaque valeur est
calculée à la lecture. Seules les **cibles** sont enregistrées, comme paramètres bornés.

## Droits

| Profil | Lecture | Modifier une cible |
|---|---|---|
| Administrateur système | oui | oui (`PATCH api/v1/parametres/:cle`, borné, audité) |
| DN, DNA | oui | non |
| Tout autre profil (stagiaire compris) | 403 (refus journalisé dans `acces_refuses`) | non |

Mêmes règles que les paramètres (`ParametresService.exigerLecture` / `exigerAdministrateur`, par
`AutorisationService`). En intérim, la règle des paramètres s'applique telle quelle (lecture avec la position
empruntée, jamais de modification : `peutModifier` exige le compte propre de l'administrateur).

Route : `GET api/v1/indicateurs-succes` → `{ droits: { peutModifier }, calculeLe, indicateurs: [...] }`.
Chaque indicateur : `cle`, `libelle`, `valeur` (nombre ou `null` si rien à mesurer), `unite`, `cible`
(valeur du paramètre), `sens` (`MIN` : la valeur doit atteindre la cible ; `MAX` : ne pas la dépasser),
`atteint` (`true`, `false`, ou `null` si non mesurable sur la période), `periode` (texte), `base`
(nombre d'éléments mesurés), `cleCible` (paramètre à modifier).

Aucune donnée nominative, aucun texte libre : uniquement des comptes et des moyennes.

## Indicateurs retenus (mesurables avec les données existantes)

| Clé | Calcul | Période | Cible (paramètre, défaut, bornes) |
|---|---|---|---|
| `connexionsHebdomadaires` | Comptes `ACTIF` (hors comptes de démonstration `@demo.dnpec.test`) ayant au moins une connexion **réussie** (`journal_connexions.resultat = 'SUCCES'`) dans **chacune** des 4 dernières semaines glissantes (fenêtres de 7 jours se terminant maintenant) ÷ comptes actifs. | 4 dernières semaines. Le journal est purgé après `connexions.conservationMois` (au moins 6 mois) : la fenêtre de 4 semaines est toujours couverte une fois le journal plein. Si la plus ancienne connexion gardée est plus récente que le début de la fenêtre (mise en service), la période est raccourcie et le libellé le dit ; seules les semaines complètes couvertes sont exigées. | `indicateurs.cibleConnexionsPct`, 70 %, 10–100 |
| `decisionsEnTache` | Décisions de réunion créées sur la période ayant une action (`Task.sourceDecisionId`) ÷ décisions créées sur la période. | 12 derniers mois | `indicateurs.cibleDecisionsTachePct`, 60 %, 10–100 |
| `delaiDecisionConge` | Moyenne, en **jours ouvrés**, entre la demande de congé (`createdAt`) et sa décision (`decidedAt`), demandes approuvées ou refusées sur la période. Jours ouvrés : heures ouvrées entre les deux instants (lundi–vendredi, hors jours fériés du calendrier, `heuresOuvreesEntre`) ÷ 24. Les demandes annulées ne comptent pas. | décisions des 12 derniers mois | `indicateurs.cibleDelaiCongeJours`, 5 jours (ne pas dépasser), 1–30 |
| `imputationsDansLesDelais` | Imputations de courrier **à échéance** dont l'échéance est passée sur la période : traitées (`traiteeAt`) au plus tard à l'échéance ÷ imputations à échéance échue. | échéances des 12 derniers mois | `indicateurs.cibleImputationsPct`, 80 %, 10–100 |
| `tachesDansLesDelais` | Tâches principales (hors sous-tâches) **à échéance** terminées sur la période (`completedAt`) : terminées au plus tard le jour de l'échéance ÷ tâches terminées à échéance. | tâches terminées les 12 derniers mois | `indicateurs.cibleTachesPct`, 75 %, 10–100 |

Une base vide (aucun élément sur la période) donne `valeur: null`, `atteint: null` et « Non mesurable sur la
période » à l'écran.

### Écarté ou adapté

- « Part des courriers imputés avant leur échéance » : un courrier arrivé **n'a pas d'échéance** dans le
  modèle (seule l'imputation en porte une, fixée par celui qui impute). L'indicateur mesurable le plus proche
  est retenu : la part des imputations traitées avant leur échéance. Le libellé à l'écran le dit.
- Aucun autre indicateur écarté.

## Cibles

Cinq paramètres bornés ajoutés à `PARAMETRES` (`socle/parametres.service.ts`) avec la rubrique
`indicateurs` : ils ne sont pas listés dans l'onglet « Paramètres » (ils le sont dans l'onglet « Indicateurs
de succès »), mais suivent exactement le même circuit (valeur bornée par le serveur, modification
par l'administrateur seul, audit `parametre_modifie`). Le paramétrage initial (`prisma/parametrage.ts`) crée
leur ligne avec la valeur par défaut selon le modèle existant (création seulement, trace « Système », jamais
recréée) ; une ligne créée par le script n'est pas affichée comme « modifiée » (aucun auteur).

## Performance

Cinq requêtes d'agrégat (comptages en base, `COUNT … FILTER`), une lecture des connexions réussies de 4
semaines groupée par compte et par semaine, une lecture des demandes de congé décidées (dates seulement) et
des jours fériés de la période. Aucune requête par ligne.

## Tests

`tests/e2e/api/n2_indicateurs.js` : droits (administrateur, DN, DNA, 403 pour chef, agent, DRH, stagiaire ;
refus journalisé), valeurs recalculées indépendamment en SQL sur la base de test, modification d'une cible
(bornes, 400, 403 pour le DN), rien de stocké (aucune table nouvelle, aucune ligne écrite à la lecture).
`tests/e2e/ui/n2_securite_ui.js` : onglet visible de l'administrateur (cible modifiable), du DN (lecture
seule), absent pour un agent.
