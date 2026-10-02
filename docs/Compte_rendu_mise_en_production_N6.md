## Mettre N6 en production

**Ordre exact**
1. **CI verte** sur la PR #16 (sur le dernier commit).
2. **Sauvegarde de la base** : Render → la base → **Recovery** → **Create export** → **Download**, fichier `dnpec_avant_N6_<date>.dump`, rangé hors de Render. Notez aussi l'heure exacte (restauration à une heure précise).
3. **Migration** :
   - Actions → « Migration base de données (manuel) » ;
   - **Use workflow from : `feature/socle-nimba-n6`** ;
   - tapez `migrate`, puis **Run workflow**.
   - **Migration attendue, et elle seule** : `20261003080000_socle_nimba_n6`. Toute autre ligne : arrêtez-vous et prévenez-moi.
   - Elle est additive :
     - 7 tables, 2 types ;
     - colonnes facultatives sur les dossiers, les pièces des dossiers et les ordres de mission ;
     - 5 pièces requises et 6 familles d'actes livrées.
   - Elle ne modifie aucune donnée existante.
4. **Fusion** de la PR #16. Attendez que `dnpec-api` puis `dnpec-web` soient **Live**.
5. **Contrôle technique** :
   - `https://<api>/health` affiche le commit de la fusion ;
   - `https://<api>/health/dependances` répond avec `"base":"NOMINAL"`.
6. **Premier réglage : relier les familles d'actes RH à un registre du Courrier** (voir la section suivante). À faire avant le premier mouvement de carrière.

**Familles d'actes RH à relier à un registre du Courrier**

Chaque famille a sa propre séquence de numéros : celle de son registre. Il faut donc un registre distinct par famille, de nature « Actes » et de portée « Direction ». Le signataire est le DN ou la DNA.

| Famille (libellé à l'écran) | Mouvements qui l'utilisent | Exemple de registre (code — gabarit) | Obligatoire |
|---|---|---|---|
| Arrêté d'affectation | Mutation | `RH-AFF` — `AAF/{seq:3}/{annee}` | Oui |
| Décision de nomination | Nomination | `RH-NOM` — `DNO/{seq:3}/{annee}` | Oui |
| Décision d'avancement | Avancement d'échelon, promotion | `RH-AVA` — `DAV/{seq:3}/{annee}` | Oui |
| Décision de fin de contrat | Fin de contrat | `RH-FIN` — `DFC/{seq:3}/{annee}` | Oui |
| Attestation de travail | Aucun mouvement | — | Non |
| Attestation de stage | Aucun mouvement | — | Non |

Les codes et gabarits ne sont que des exemples : gardez la numérotation officielle de la DNPEC si elle existe.

Les deux familles d'attestations sont affichées à titre de référence, sans effet sur la numérotation. Les attestations de travail (Documents générés) et de stage (Stages) restent numérotées dans le registre choisi au moment où on les produit. Ne leur attribuez pas l'un des quatre registres ci-dessus : un registre ne sert qu'à une famille.

Marche à suivre à l'écran :
1. **Administrateur** — Administration → « Courrier » → « + Nouveau registre ». Pour chacune des 4 familles obligatoires :
   - Code ;
   - Libellé (par exemple « Décisions d'avancement ») ;
   - Nature : **Actes** ;
   - Portée : **Direction (numérotation DNPEC)** ;
   - Gabarit du numéro ;
   - puis « Enregistrer ».
   
   Un registre d'actes de la Direction déjà en service peut servir, s'il n'est utilisé par aucune autre famille.
2. **DRH** — Personnel → « Ressources humaines » → onglet « Carrière et actes » → section « Familles d'actes ». En face de chaque famille obligatoire, choisissez son registre dans la liste « — Registre à choisir — ». L'enregistrement est immédiat.
   - Si le registre sert déjà à une autre famille, le message « Ce registre porte déjà la famille « … » : chaque famille a sa propre séquence » s'affiche : prenez-en un autre.
   - L'administrateur peut aussi faire ce choix. Le DN et la DNA voient les familles et leurs registres, sans pouvoir les modifier.
3. **Contrôle** :
   - les 4 familles obligatoires affichent leur registre ;
   - « + Nouveau mouvement » → « Préparer le mouvement » → « Préparer l'acte » crée l'acte dans le Courrier, sans le message « registre à choisir ».
   - Si ce mouvement n'était qu'un essai, « Annuler » sur le mouvement, puis annulez l'acte dans le Courrier avant toute signature.

**Vérifications, compte par compte**

| Compte | À vérifier |
|---|---|
| Agent | Personnel → « Ressources humaines » : onglets « Carrière et actes » (ses mouvements, une fois l'acte signé) et « Fiches de poste ». Tableau de bord : ses tâches, puis « Mon solde de congés », « Mes demandes en cours », « Réunions des 7 prochains jours ». Logistique → « Véhicules » : le parc, en lecture. |
| Chef de section, de division, de cellule | Tableau de bord : absences de l'équipe sur 7 jours (sans motif médical), avis de congé attendus, activités dont il est responsable. « Ressources humaines » → « Formation » → « + Exprimer un besoin ». |
| DN / DNA | « Ressources humaines » → « Effectifs » (par unité, statut, catégorie). Tableau de bord : avancement du plan, décisions de réunion, instructions ouvertes, absences du jour. Les actes de carrière arrivent dans le Courrier comme les autres actes à signer : le dossier n'est modifié qu'à la signature. |
| DRH | Onglets « Effectifs », « Alertes », « Carrière et actes », « Fiches de poste », « Formation », « Pièces requises ». Un mouvement d'essai : « + Nouveau mouvement » → « Préparer l'acte » → l'acte est dans le Courrier. Tableau de bord : « Alertes RH » et « Demandes en attente de votre décision ». |
| Gestionnaire logistique | Logistique → « Véhicules » → « + Nouveau véhicule ». Fiche du véhicule : plein **en litres** (aucun montant) avec le compteur. « Ordres de mission » : affecter le véhicule, puis « Enregistrer le retour ». Le véhicule s'affiche sur l'ordre de mission dans « Documents générés ». |
| Administrateur | Paramétrage : 6 paramètres, dont « Ancienneté dans l'échelon avant un avancement à instruire » (24 mois). Supervision inchangée. |
| Page d'accueil et connexion | Identiques à aujourd'hui (couleurs DNPEC, bande tricolore). |
| Stagiaire | Inchangé (pas d'accès aux Ressources humaines). |

**Si un agent perd un accès**
- **« Je ne vois pas Ressources humaines en entier »** : normal, les onglets dépendent du rôle :
  - effectifs : DRH, DN et DNA ;
  - alertes et pièces requises : DRH seul ;
  - formation : chefs, Direction et DRH ;
  - carrière et fiches de poste : tout le monde.
- **« L'acte d'un mouvement est refusé »** : la famille d'actes n'a pas encore de registre (étape 6).
- **« Je ne peux pas muter ce chef »** : une mutation ne vise qu'un chargé d'études (ou un DRH, un administrateur). Un chef, un assistant ou un stagiaire change d'unité par le changement de rôle (Organisation).
- **Un blocage plus large** : Render → `dnpec-api` → Events → **Rollback** vers le déploiement N5, puis `dnpec-web`. La base N6 reste compatible avec N5 (colonnes facultatives, tables ignorées).
- **Abandon définitif de N6**, sur décision seulement :
  - nouvelle sauvegarde ;
  - puis workflow « Retour arrière d'un lot NIMBA », lot **`n6`**, mot `retour-arriere n6`.
  - Sont conservés : les actes du Courrier, les valeurs déjà appliquées aux dossiers (fonction, échelon, grade, rattachement), les pièces déposées, les ordres de mission (sans véhicule).
  - Sont perdus : mouvements de carrière, familles d'actes, pièces requises, catégorie et date du dernier échelon, fiches de poste, besoins de formation, véhicules et pleins.

**Ce qui change visiblement pour les agents**
- **Tout le monde** :
  - tableau de bord adapté au rôle ;
  - « Ressources humaines » (sa carrière, les fiches de poste) ;
  - parc de véhicules en lecture ;
  - contrastes renforcés dans l'application (vert et gris clair un peu plus foncés). Accueil et connexion sont inchangés.
- **Chefs** : besoins de formation de leur unité.
- **DN et DNA** : effectifs ; actes de carrière à signer.
- **DRH** : effectifs, alertes, carrière et actes, fiches de poste, plan de formation, pièces requises.
- **Gestionnaires logistiques** : véhicules, carburant en litres, affectation aux ordres de mission.

**Choix tranchés seul** : liste complète dans la description de la PR #16. Déjà validé : l'ordre de mission signé n'est pas modifié par une affectation de véhicule après coup. À valider en priorité :
- alertes RH calculées à la lecture, avec une liste de pièces requises modifiable ;
- un registre du Courrier par famille d'actes, choisi par le DRH ;
- application au dossier à la signature ; mutation limitée aux chargés d'études ;
- avancement d'échelon à instruire après 24 mois par défaut.
