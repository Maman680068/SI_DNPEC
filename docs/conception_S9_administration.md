# S9 — Pages d'administration

Droits inchangés pour toutes les pages S9. Aucune migration.

## S9a. Journal d'audit

- **Phrase en français** calculée par l'API (`socle/journal-audit.phrases.ts`) : auteur + verbe + objet nommé
  (table des libellés par `entityType` : objet, domaine, sensibilité, lien ; résolution groupée du nom de l'objet,
  une requête par type). Verbes par action et par événement (« a consulté », « a téléchargé », « a exporté »…).
- **Besoin d'en connaître** : objets protégés (courrier confidentiel ou personnel, imputations et pièces de
  courrier, dossiers du personnel et leurs pièces, certificat médical, demande de congé — jamais son type ni son
  motif —, évaluation de stage, mouvement de carrière, instruction, calcul de simulation, pièce jointe de
  message, consultation d'un élément protégé) : libellé générique, sans titre, sans identifiant, sans
  avant / après, même pour l'administrateur.
- Regroupement par jour, icône par action ; **sceau une seule fois en tête** (état de la dernière vérification,
  nombre d'entrées, date, « Vérifier maintenant » pour l'administrateur) ; vérification de nuit (tâche
  `verification-audit`, existante) et **notification de l'administrateur en cas de rupture**
  (`alerterRupture`, urgente).
- Fiche : auteur (et intérim), action, objet, lien pour l'ouvrir, tableau avant / après tiré des métadonnées
  (`avant`, `apres`), empreinte, scellement.
- Filtres : recherche (auteur, libellé du type d'objet, identifiant exact), période, auteur, domaine, action,
  « Sensibles seulement » (suppressions, types sensibles ou protégés, événements sensibles).
- Export `GET api/v1/journal-audit/export?format=csv|pdf` (mêmes filtres et même portée, 5 000 lignes au
  plus) ; chaque export est lui-même inscrit au journal (`JournalAudit`, `export`). Le journal reste en écriture
  seule ; aucune entrée existante n'est modifiée.

## S9b. Utilisateurs

- `GET api/v1/comptes/synthese` (droits inchangés : administrateur ; DN et DNA en lecture ; intérim refusé)
  rend en plus `chiffres` (actifs ; suspendus dont démonstration ; inscriptions à examiner ; actifs sans double
  authentification, dont droits élevés ; actifs jamais connectés) et, par compte : sigle d'unité, droits élevés
  (administrateur, DN, DNA, DRH), dernière connexion réussie (journal des connexions), marque de
  démonstration (adresse `@demo.dnpec.test`, `estAdresseDemo`), droit « Renvoyer l'invitation ». Jamais le
  secret de double authentification.
- `POST api/v1/comptes/rappel-double-authentification` (administrateur) : notification urgente (donc e-mail
  immédiat) vers « Mon profil » à chaque compte actif sans double authentification, hors démonstration ;
  type existant `ROLE_MODIFIE` réutilisé avec son propre bouton (aucune nouvelle valeur de type) ; une entrée
  au journal avec le nombre de personnes.
- `POST api/v1/comptes/:id/renvoyer-invitation` (administrateur) : compte actif sans aucune connexion réussie ;
  réutilise `ComptesEmailsService.compteCree` (nouveau lien de premier accès, 7 jours) ; 409 sinon ; journalisé.
- Écran : chiffres, alerte (rouge si un compte aux droits élevés est concerné), tableau sans texte coupé,
  interrupteur « Masquer les comptes de démonstration (TEST) » activé par défaut (préférence du navigateur,
  composant `Interrupteur` / `usePreference` de la charte), filtres d'affichage, onglet « Agents sans compte »
  avec compteur (`?onglet=agents-sans-compte`, `?onglet=inscriptions`).
- Limite assumée : « jamais connecté » se lit dans le journal des connexions, purgé après sa durée de
  conservation ; un compte silencieux depuis plus longtemps est donc compté comme jamais connecté.
