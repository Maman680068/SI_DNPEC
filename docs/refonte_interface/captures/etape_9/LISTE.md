# Étape 9 — captures avant / après

Base de démonstration **locale** (`demo.ts`, comptes `@demo.dnpec.test`), bureau 1440 × 900 et téléphone 390 × 844.
« Avant » = code de la production (b155b75) ; « après » = branche `feature/ui-finitions`.

| Point | Avant | Après |
|---|---|---|
| 1. Mon profil | `01-mon-profil-introuvable` (404) | `01-mon-profil`, `01e-mon-profil-telephone` |
| 1. Menu « Mon compte » | `01b-menu-mon-compte` | `01b-menu-mon-compte` |
| 1. Sécurité (ancienne adresse redirigée) | `01c-securite-du-compte` | `01c-securite-du-compte` |
| 1. Préférences (ancienne adresse redirigée, toast « Annuler ») | `01d-preferences-de-notification` | `01d-preferences-de-notification` |
| 2. Imputation sans destinataire | `02-imputation-erreur` (erreur technique) | `02-imputation-validation` (« Choisissez un destinataire. ») |
| 3. Instructions vides | `03-instructions-vide` | `03-instructions-vide` (action proposée), `03b-instructions-demonstration` (démo) |
| 4. « À traiter » de l'administrateur | `04-tableau-de-bord-administrateur` | `04-tableau-de-bord-administrateur` (points de supervision) |
| 5. Prénom de l'accueil | `05-prenom-accueil` (« TEST — … ») | `05-prenom-accueil` |
| 6. Formulaires | `06-formulaire-*` (5) | `06-formulaire-*` (7, vides puis `-validation` après un envoi vide), `06b-conge-calcul-pendant-la-saisie`, `06c-calendrier-ouvert`, `06d-selecteur-de-personnes` |
| 7. Cloche | `07-cloche` | `07-cloche` |
| 8. Recherche | `08-recherche-saisie` | `08-recherche-saisie` (résultats pendant la frappe) |
| 9. Toast après une action | `09-apres-valider-la-tache` | `09-apres-valider-la-tache` |
| 10. Chargement | `10-chargement-page`, `10b-chargement-liste` | idem (squelettes) |
| 11. Barres de défilement | `11-barres-de-defilement` (*) | `11-barres-de-defilement` |
| 12. Téléphone, filtres | `12-*`, `12b-*`, `12c-*` | idem (« Filtres »), `12d-telephone-panneau-filtres` |

(*) Chromium sans fenêtre masque les barres de défilement ; les deux captures du point 11 sont prises avec
les barres affichées. La production n'ayant aucune règle de barre de défilement, la capture « avant » est la
même page dont on a retiré les seules règles ajoutées par l'étape 9 (barres par défaut du navigateur).
