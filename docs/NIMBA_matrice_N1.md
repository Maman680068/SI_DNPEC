# Matrice des habilitations — état N1

Généré par `tests/e2e/api/n1_matrice.js` (annexe 1 du cahier NIMBA v2.2). « ÉCART » : comportement actuel conservé en N1 et vérifié tel quel.

| Objet | Profil | Action | Annexe | Obtenu | Issue |
|---|---|---|---|---|---|
| Unité organisationnelle | DN | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | DNA | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Chef de division | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Chef de section | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Agent | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | DRH | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Chef SAF | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Assistant DN | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Administrateur | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | DN | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DN | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DNA | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DNA | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de division | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de division | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de section | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de section | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Agent | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Agent | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DRH | créer | CLM(T) | accès | CONFORME |
| Unité organisationnelle | DRH | modifier | CLM(T) | accès | CONFORME |
| Unité organisationnelle | Chef SAF | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef SAF | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Assistant DN | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Assistant DN | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Administrateur | créer | CLM(T) | accès | CONFORME |
| Unité organisationnelle | Administrateur | modifier | CLM(T) | accès | CONFORME |
| Compte utilisateur | DN | lister (toute la Direction) | L(T) | accès | CONFORME |
| Compte utilisateur | DNA | lister (toute la Direction) | L(T) | accès | CONFORME |
| Compte utilisateur | DRH | lister (toute la Direction) | L(T) | accès | CONFORME |
| Compte utilisateur | Administrateur | lister (toute la Direction) | CLMS(T) | accès | CONFORME |
| Compte utilisateur | Agent | lister (soi-même) | L(S) | accès | CONFORME |
| Compte utilisateur | Chef de division | lire un compte de son périmètre | L(P) | accès | CONFORME |
| Compte utilisateur | Chef de division | lire un compte hors périmètre | L(P) | refus (403) | CONFORME |
| Compte utilisateur | Chef de section | lire un compte de son périmètre | L(P) | accès | CONFORME |
| Compte utilisateur | Chef de section | lire un compte hors périmètre | L(P) | refus (403) | CONFORME |
| Compte utilisateur | Agent | lire le compte d’un collègue | L(S) | refus (403) | CONFORME |
| Compte utilisateur | Assistant DN | lister les comptes | — (annexe 1.4 : compte réservé à l’administrateur) | accès | ÉCART |
| Compte utilisateur | DN | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | DNA | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Chef de division | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Chef de section | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Agent | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | DRH | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Chef SAF | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Assistant DN | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Dossier agent | DN | lire (toute la Direction) | L*(T) | accès | CONFORME |
| Dossier agent | DNA | lire (toute la Direction) | L*(T) | accès | CONFORME |
| Dossier agent | Chef de division | lire (périmètre) | L*(P) | accès | CONFORME |
| Dossier agent | Chef de division | lire (hors périmètre) | L*(P) | refus (403) | CONFORME |
| Dossier agent | Chef de section | lire (hors périmètre) | L*(P) | refus (403) | CONFORME |
| Dossier agent | Agent | lire le sien | L(S) | accès | CONFORME |
| Dossier agent | Agent | lire celui d’un collègue | L(S) | refus (403) | CONFORME |
| Dossier agent | DRH | lire (toute la Direction) | CLM(T) | accès | CONFORME |
| Dossier agent | Administrateur | lire | — | refus (403) | CONFORME |
| Dossier agent | Assistant DN | lire | — (jamais d’objet protégé par délégation) | refus (403) | CONFORME |
| Dossier agent | Chef SAF | lire (toute la Direction) | L*(T) (SAF / paie) | refus (403) | ÉCART |
| Dossier agent (liste des agents) | DN | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | DNA | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Chef de division | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Chef de section | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Agent | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | DRH | lister | CLM(T) | accès | CONFORME |
| Dossier agent (liste des agents) | Chef SAF | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Assistant DN | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Administrateur | lister | — (agents sans compte seulement, pour le rapprochement) | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Administrateur | lister les agents sans compte (identité, unité) | rapprochement compte ↔ agent (annexe 2.3) | accès | CONFORME |
| Dossier agent (fiche agent) | Agent | lire la sienne | L(S) | accès | CONFORME |
| Dossier agent (fiche agent) | DN | lire celle d’un agent | L*(T/P) via le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (fiche agent) | Chef de division | lire celle d’un agent | L*(T/P) via le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (fiche agent) | Administrateur | lire celle d’un agent | — | refus (403) | CONFORME |
| Dossier agent (fiche agent) | Assistant DN | lire celle d’un agent | — | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | DN | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | DNA | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Chef de division | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Chef de section | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Agent | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Chef SAF | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Assistant DN | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Administrateur | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Rôle fonctionnel | DN | attribuer | L(T) | refus (403) | CONFORME |
| Rôle fonctionnel | DNA | attribuer | L(T) | refus (403) | CONFORME |
| Rôle fonctionnel | Chef de division | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Chef de section | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Agent | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | DRH | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Chef SAF | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Assistant DN | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Administrateur | attribuer | CLMV(T) | accès | CONFORME |
| Rôle fonctionnel | DN | lire toutes les attributions | L(T) | refus (403) | ÉCART |

## Écarts conservés en N1

- **Compte utilisateur — Assistant DN** : L’assistant hérite de la visibilité de la liste de son superviseur (règle v2.3 de la DNPEC) ; la fiche détaillée reste refusée. À aligner avec l’annexe 1.4.
- **Dossier agent — Chef SAF** : La lecture par le SAF sert la paie (D5), hors périmètre ; le chef SAF garde la portée de chef de cellule.
- **Rôle fonctionnel — DN** : En N1, seuls l’administrateur et le DRH voient toutes les attributions ; le DN voit les siennes. La lecture DN/DNA arrive avec l’écran de supervision (N2).

## Objets livrés par un lot ultérieur (non joués en N1)

- Justificatif médical : N3 (motif médical visible du seul DRH)
- Activité / plan de travail : N5 (plan de travail objectif → activité → tâche)
- Instruction de la Direction : N5
- Journal d’audit : N2 (lecture de l’audit)
- Paramétrage : N2 (écran « Paramétrage et supervision »)
- Demande d’absence — avis et décision : N3 (circuit avis du chef 48 h ouvrées, décision DRH)
- Mouvement de carrière et acte RH, effectifs et alertes RH : N6
- Document publié — statut de diffusion : N4
- Campagne et bulletin de paie, élément de rémunération, ordre de paiement : hors périmètre (D5, finances SAF)
- Objets du domaine modélisation (annexe 1.3) : hors périmètre (domaine B)

Les autres objets déjà en service (tâche, réunion, décision, courrier, document, annonce, stage) restent
couverts par leurs suites existantes (`a*`, `b*`, `c*`, `d*`) ; ils seront rejoués dans cette matrice lorsqu’ils
passeront sur le moteur d’autorisation du socle.
