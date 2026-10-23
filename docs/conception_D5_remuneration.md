# Domaine D5 — Rémunération (SAF, paie) : conception à valider

*Conception seulement : aucun code n'est écrit avant validation (règle 2 du guide du développeur).
Les questions de la section 10 doivent être tranchées avant le premier lot.*

L'exclusion D5 (§5 du cahier des charges) est levée. Le domaine couvre la paie et les finances tenues
par le Service administratif et financier (cellule SAF). Il introduit pour la première fois des
**montants** dans le SI : c'est le point le plus sensible de cette conception (section 5).

## 1. Périmètre

| Bloc | Contenu | Hors périmètre |
|---|---|---|
| Campagne de paie | Une campagne par mois (ouverte, calculée, contrôlée, validée, clôturée) ; une seule campagne ouverte à la fois ; rappel de la campagne précédente. | Paie des stagiaires (gratification : question 9). |
| Éléments de salaire | Par agent : traitement de base (grille, catégorie, échelon repris du dossier N6), indemnités et primes, retenues (cotisations sociales, impôt, avances, oppositions), avec date d'effet et pièce justificative. | Calcul de l'impôt par un moteur externe (le barème est un paramètre daté). |
| Bulletins | Un bulletin par agent et par campagne, figé à la validation (immuable, empreinte), PDF produit par le modèle de page commun (`generateur/mise-en-page.ts`). | Bulletin rectificatif hors campagne (question 5). |
| Paiements et missions | Ordre de paiement des salaires (état de virement par banque) ; frais de mission : liquidation de l'ordre de mission N4 (indemnités, transport), paiement. | Exécution bancaire (fichier de virement seulement, question 6). |
| Budget et engagements | Lignes budgétaires de l'année (dotation), engagements (bon de commande, ordre de mission, campagne de paie), liquidation, mandatement ; disponible calculé. | Comptabilité générale (plan comptable, balance). |
| Rapports financiers | Masse salariale par mois, unité, catégorie ; exécution budgétaire par ligne ; frais de mission par unité. Exports marqués. | Tableaux de bord prévisionnels. |
| Attestations | Attestation de salaire, certificat de non-rémunération, état des sommes versées dans l'année — actes du Courrier. | — |

## 2. Modèle de données (migration additive envisagée, lot par lot)

Aucune table existante n'est modifiée, sauf ajouts de colonnes facultatives (référence vers l'agent
du socle, `Agent`, jamais vers le compte : un agent sans compte est payé).

| Table | Champs principaux | Garde-fous en base |
|---|---|---|
| `campagnes_paie` | annee, mois, statut (OUVERTE, CALCULEE, CONTROLEE, VALIDEE, CLOTUREE), ouverteParId, valideeParId, valideeLe | Index unique (annee, mois) ; une seule campagne non clôturée ; valideur ≠ gestionnaire qui a calculé (CHECK) |
| `rubriques_paie` | code, libelle, nature (GAIN, RETENUE, COTISATION_SALARIALE, COTISATION_PATRONALE), mode (FIXE, TAUX, BAREME), imposable, ordre | Rubrique utilisée jamais supprimée (désactivée) |
| `baremes` | rubriqueId, dateEffet, tranches (JSON) | Barème appliqué figé (déclencheur) |
| `elements_salaire` | agentId, rubriqueId, montant ou taux, dateDebut, dateFin, pieceId (GED), saisiParId | Montant en **centimes entiers** (`BIGINT`), jamais en flottant ; CHECK montant ≥ 0 |
| `bulletins` | campagneId, agentId, lignes (JSON figé : rubrique, base, taux, montant), brut, net, cotisationsPatronales, empreinte, fichierKey, statut (BROUILLON, VALIDE, ANNULE) | Bulletin VALIDE immuable (déclencheur, comme `versions_modele_garde`) ; unique (campagneId, agentId) |
| `ordres_paiement` | campagneId ou missionId, montant, banque, statut, acteId (Courrier) | Montant = somme des bulletins (contrôle à la validation) |
| `lignes_budgetaires` | annee, code, libelle, dotation | — |
| `engagements` | ligneId, objet (type + id : ordre de mission, campagne, bon), montant, statut (ENGAGE, LIQUIDE, MANDATE, ANNULE) | Disponible ≥ 0 (contrôle en transaction avec verrou sur la ligne) |
| `liquidations_mission` | ordreMissionId (N4), indemnites (JSON), total, liquideeParId | Une liquidation par ordre de mission signé |

Montants : entiers en francs guinéens (GNF n'a pas de subdivision usuelle ; question 3) ; montants en
lettres par `socle/montant-en-lettres.ts` (déjà utilisé par les frais de mission N4).

Retour arrière : `prisma/retour-arriere/d5_<lot>_down.sql` pour chaque lot, contrôlé par une phase de
`run_all.sh` (même schéma que N1 → B1 et « références courtes »).

## 3. Rôles

Rôles **fonctionnels** du socle (`AttributionRole`, jamais une position, jamais empruntés en intérim,
jamais un stagiaire) :

| Rôle | Qui | Droits |
|---|---|---|
| Gestionnaire de paie | Agents de la cellule SAF désignés par le DRH et le chef SAF | Saisit les éléments de salaire, ouvre et calcule la campagne, prépare les ordres de paiement et liquidations ; ne valide jamais ce qu'il a calculé. |
| Chef SAF | Chef de la cellule SAF (position) + rôle « ordonnateur délégué » | Contrôle et valide la campagne, engage les dépenses, signe les ordres de paiement (acte du Courrier) ; lit tous les bulletins. |
| Agent | Tout agent payé | Voit **son propre** bulletin et ses attestations, rien d'autre. |
| Direction (DN, DNA) | Positions | Lit les rapports agrégés (masse salariale, exécution budgétaire) ; **ne lit pas les bulletins nominatifs** (besoin d'en connaître) sauf rôle explicite (question 7) ; signe les actes réservés. |
| DRH | Rôle fonctionnel | Fournit les données de carrière (grade, échelon, position) déjà tenues en N6 ; ne lit pas les bulletins (question 7). |
| Administrateur système | Position | Paramètre les rubriques et barèmes (avec le chef SAF, question 8) ; ne voit **aucun montant nominatif** (comme les chiffres des simulations en B1). |

Contrôle fin : `AutorisationService.exiger()` (ordre : protégé → périmètre → rôle), refus journalisé dans
`acces_refuses`.

## 4. Le bulletin, objet protégé

Le bulletin (et toute ligne d'élément de salaire nominative) est un **objet protégé** au sens du §2.2
« besoin d'en connaître » :

- lecture réservée à l'agent lui-même, au gestionnaire de paie et au chef SAF ;
- **jamais visible par la cascade hiérarchique** (`CascadeService` n'ouvre rien : un chef, le DN, la DNA
  ne lisent pas le bulletin d'un subordonné) ni **en intérim** (le suppléant n'emprunte jamais l'accès :
  rôles fonctionnels personnels, `actor.id` littéral) ;
- chaque lecture par un tiers (gestionnaire, chef SAF) passe par `PreuveIdentiteService.exiger`
  (réauthentification, fenêtre `X-Reauth`) et est **tracée** (`preuves.tracerAcces`), comme le motif
  médical N3 et le dossier du personnel de niveau 2 ;
- l'agent lit le sien sans réauthentification (question 4) ;
- aucun montant ni nom dans une notification, un email, le résumé quotidien, le journal d'audit
  (métadonnées : identifiants et événements seulement), la recherche transverse ou un fil de discussion ;
- tout fichier exporté (bulletin PDF, état de virement, rapport) passe par `ExportsService.marquer`
  avec une mention « CONFIDENTIEL — PAIE » (nouvelle mention, en plus des statuts de diffusion) et le nom
  du lecteur et la date en pied de page ;
- le dépôt en GED d'un bulletin est interdit (jamais `Document`), seuls les actes (attestations) y vont.

## 5. Abandon contrôlé de la règle « aucun montant »

Jusqu'ici : aucun champ de salaire (revue de sécurité 2026-10), carburant en litres seulement (N6), seul
montant = frais d'un ordre de mission (N4). L'abandon est **limité et vérifiable** :

1. Les montants n'existent que dans les tables du domaine D5 (liste fermée de la section 2) ; un test
   (`d5_routes`) vérifie qu'aucune autre route ne renvoie un champ de montant (inventaire des réponses,
   comme `s1_routes` pour les routes publiques).
2. Montants en centimes entiers, jamais en flottant ; arrondis à la règle définie (question 3).
3. Les véhicules restent en litres ; le lien carburant → dépense passe par un engagement, pas par la fiche
   véhicule.
4. Le tableau de bord n'affiche aucun montant nominatif ; seuls des agrégats aux rôles autorisés.
5. La règle et ses exceptions sont écrites dans le guide du développeur et la revue de sécurité est mise à
   jour (nouvelle section « Rémunération »).

## 6. Audit et actes du Courrier

- Audit (`AuditService.log`) de chaque écriture : élément saisi, modifié, clôturé ; campagne ouverte,
  calculée, validée, clôturée ; bulletin validé ou annulé ; engagement, liquidation, mandatement — sans
  montant dans les métadonnées (identifiants, événement, auteur, au nom de).
- Lecture d'un bulletin par un tiers : trace `acces_objet_protege` (section 4).
- Pièces **opposables** = actes du Courrier (`ActesService`, registre et famille d'actes, numéro,
  signataire, visa) : ordre de paiement, attestation de salaire, certificat de non-rémunération, état
  annuel des sommes versées ; les éditions sont comptées (`documents_generes`, « DUPLICATA »), comme
  l'attestation de travail N4. Un acte signé ne change plus.
- Validation de campagne : séparation des tâches (calcul ≠ validation), contrainte en base.

## 7. Découpage en lots

| Lot | Contenu | Dépend de |
|---|---|---|
| D5-1 | Rubriques, barèmes datés, éléments de salaire par agent (saisie, pièces), rôles gestionnaire et chef SAF, bulletin consultable « à blanc » par le gestionnaire. | Socle N6 (dossier, échelon) |
| D5-2 | Campagne mensuelle : calcul, contrôle (écarts au mois précédent), validation, bulletins figés, « Mon bulletin » pour l'agent, exports marqués. | D5-1 |
| D5-3 | Ordres de paiement (acte du Courrier), état de virement par banque, attestations de salaire. | D5-2 |
| D5-4 | Budget : lignes, engagements, liquidation des ordres de mission N4, mandatement, disponible. | D5-3 |
| D5-5 | Rapports financiers (masse salariale, exécution budgétaire, missions), indicateurs Direction. | D5-4 |

Chaque lot : conception validée, migration additive, retour arrière, suites API et Chromium avec leurs
403, aide et captures, paramétrage initial (rubriques usuelles) selon `prisma/parametrage.ts`, données de
démonstration (`prisma/demo.ts`, montants fictifs marqués « TEST — »).

## 8. Reprise

Reprise des éléments de salaire en cours (fichier Excel du SAF, même mécanisme que l'import D3) ; aucune
reprise des bulletins passés dans le SI (archives papier ou PDF déposés en GED par le SAF comme documents
non diffusables, question 10).

## 9. Risques

- Fuite de montants nominatifs (notifications, exports, journaux) : contrôlée par la section 4 et le test
  d'inventaire des réponses.
- Erreurs de calcul : barèmes datés, bulletin figé, contrôle des écarts avant validation, rectification par
  un nouveau bulletin, jamais une modification.
- Dépendance au dossier N6 (échelon, position) : une incohérence bloque le calcul de l'agent concerné, avec
  un message au gestionnaire, jamais une valeur par défaut silencieuse.

## 10. Questions à trancher avant de coder

1. Qui exerce le rôle « gestionnaire de paie » aujourd'hui (nombre de personnes, cellule SAF seulement) et
   qui le désigne (DRH, chef SAF, DN) ?
2. Le chef SAF valide-t-il seul la campagne, ou faut-il un visa de la Direction (DN/DNA) avant paiement ?
3. Monnaie et arrondis : montants entiers en GNF ; arrondi du net au franc, à la dizaine, à la centaine ?
4. L'agent doit-il confirmer son mot de passe pour lire son propre bulletin (comme un tiers), ou
   l'ouverture de session suffit-elle ?
5. Rectification : un bulletin erroné se corrige-t-il par un bulletin rectificatif dans la campagne
   suivante, ou par une campagne complémentaire du même mois ?
6. Paiement : fichier de virement à produire (format de quelle banque ?) ou seulement l'état papier signé ?
7. La Direction (DN, DNA) et le DRH doivent-ils lire des bulletins nominatifs, ou seulement des agrégats ?
8. Qui paramètre les rubriques et barèmes (impôt, cotisations) : chef SAF, administrateur, les deux à deux
   personnes ?
9. Les gratifications de stage entrent-elles dans D5 (la conception D6 les avait exclues) ?
10. Faut-il reprendre l'historique des bulletins passés, et sur combien d'années ?
11. Budget : la nomenclature des lignes budgétaires est-elle imposée (code de la loi de finances) ? Qui
    l'importe chaque année ?
12. Frais de mission : barème des indemnités journalières par catégorie et destination — document de
    référence à fournir.
13. Les états financiers doivent-ils être transmis à un service extérieur (Trésor, contrôle financier) et
    sous quel format ?
14. Durée de conservation des bulletins et pièces de paie dans le SI (et purge éventuelle, comme les
    messages directs à 3 ans) ?
