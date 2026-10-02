# Performance du SI DNPEC — mesures et corrections (octobre 2026)

Branche `feature/performance` (après N6). Aucune modification du schéma ni migration.

## 1. Conditions de mesure

**Jeu de données gonflé** (`tests/e2e/outils/volume.js`, base locale uniquement) ajouté au jeu de
test :

| Élément | Volume |
|---|---|
| Comptes | 318 (300 Chargés d'études répartis dans les sections et cellules, 18 comptes de test) |
| Agents (socle N1) | 618 |
| Tâches | 20 000 (une ou deux personnes assignées, statuts et échéances variés) |
| Demandes de congé | 3 000 |
| Documents de la GED | 3 000 |
| Courriers arrivée | 2 000 |
| Notifications | 150 000 |
| Lignes du journal d'audit | 100 000, scellées |
| Taille de la base | 127 Mo |

**Générateur de charge** (`tests/e2e/outils/charge.js`) :
- 100 utilisateurs simultanés : la Direction, les chefs, le DRH, les secrétariats et 82 Chargés
  d'études ;
- chacun ouvre d'abord le tableau de bord, puis des écrans tirés au hasard selon leur fréquence
  (tableau de bord, compteur de la cloche, notifications, tâches, congés, GED, courrier, réunions,
  annuaire, recherche) ;
- un temps de réflexion aléatoire entre deux écrans, autour de 1 s (stress), 5 s (usage soutenu) ou
  30 s (rythme de bureau) ;
- mesure par écran : p50, p95, p99, taille de la réponse et erreurs.

**Trois bases PostgreSQL 16 :**
- **locale** : sans limite, sur le poste de mesure ;
- **« Render 0.1 CPU »** : conteneur limité à 0,1 CPU et 256 Mo, comme l'offre actuelle
  `basic-256mb` ;
- **« Render 0.5 CPU »** : conteneur limité à 0,5 CPU et 1 Go, comme l'offre `basic-1gb`.

L'API tourne en local (`NODE_ENV=production`) ; voir § 5 pour l'effet de l'offre `starter` de l'API.

« Avant » = code de N6 (`feature/socle-nimba-n6`, f8f0b38) ; « après » = cette branche.

## 2. Ce qui était lent, et pourquoi

| Écran | Constat (avant) | Cause | Correction |
|---|---|---|---|
| **Tableau de bord** (`/dashboard`) et « Suivi des tâches » | Le web téléchargeait **toutes** les tâches du périmètre : **22 Mo** (20 000 tâches) pour la Direction, 4,9 Mo pour un chef de division. 2,5 s rien que pour l'API. | Aucune borne : `GET /tasks` sans filtre. | Vue de suivi `GET /tasks?suivi=true&limite=301` : tâches non closes, et closes depuis moins de 30 jours. Le web en affiche 300 au plus (échéances les plus proches d'abord) et le signale ; l'export Excel garde la liste complète. **339 Ko, 96 ms.** |
| **Mes tâches** (`/tasks`) | Téléchargeait tout le périmètre, puis filtrait dans le navigateur. | Idem. | Deux requêtes ciblées : `assigneeId` et `createdById` (nouveau filtre), sans sortir du périmètre. |
| **Congés** (liste ; blocs « absences », « avis », « décisions » du tableau de bord) | 2,8 s pour la Direction, 1,1 s pour le DRH. Le tableau de bord de la Direction appelait la liste trois fois : **2,2 s**. | **N+1** : pour chaque demande, le « chef le plus proche » était relu en base (jusqu'à 5 requêtes par ligne). | Chefs relus une fois par niveau et par requête (`chefsLesPlusProchesMemo`), même règle. **0,37 s** ; tableau de bord **0,27 s**. |
| **GED** (liste) | 2,5 s pour un chef de division (3 000 documents). | **N+1** : le créateur de chaque document relu pour le droit « modifier ». | Créateurs lus en une requête pour la liste (`presenterListe`). **0,15 s.** |
| **Indicateurs des tâches** (`/tasks/dashboard`) | 5 décomptes du périmètre : 0,5 s sur une base à 0,1 CPU. | 5 parcours de la table. | Décompte par statut (`groupBy`) + 2 décomptes : 3 parcours, **0,29 s** sur la même base. |
| **Cloche et messages** | Interrogés chaque minute, même onglet caché. | — | Pas d'interrogation quand l'onglet est caché. |

**Contrôles :**
- les droits renvoyés par les listes restent identiques au détail (`p_performance`, congés et GED
  comparés ligne à ligne) ;
- la vue de suivi et les filtres ne sortent jamais du périmètre (sous-ensemble de la liste complète,
  agent d'une autre division) ;
- valeurs hors bornes refusées en 400.

## 3. Mesures avant / après

### 3.1 Requête seule, base locale (meilleur de 3)

| Écran | Profil | Avant | Après |
|---|---|---|---|
| Tableau de bord par rôle | DN | 2 169 ms | 268 ms |
| Tableau de bord par rôle | DRH | 1 020 ms | 280 ms |
| Liste des tâches de l'écran d'accueil | DN | 2 516 ms, 22 295 Ko | 96 ms, 339 Ko |
| Liste des tâches de l'écran d'accueil | Chef de division | 507 ms, 4 887 Ko | 66 ms, 329 Ko |
| Congés | DN | 2 765 ms | 372 ms |
| Congés | DRH | 1 093 ms | 327 ms |
| GED | Chef de division | 2 520 ms | 152 ms |

### 3.2 100 utilisateurs simultanés

| Base | Rythme | Code | Requêtes/s | p50 | p95 | p99 | Erreurs |
|---|---|---|---|---|---|---|---|
| Locale | stress (1 s) | avant | 11,7 | 6 066 ms | 14 661 ms | 26 525 ms | 32 coupures réseau |
| Locale | stress (1 s) | **après** | **50,9** | **816 ms** | **1 779 ms** | **3 381 ms** | **0** |
| Render 0.5 CPU | bureau (30 s) | avant | 3,1 | 241 ms | 3 495 ms | 6 321 ms | 0 |
| Render 0.5 CPU | bureau (30 s) | **après** | 3,1 | **34 ms** | **192 ms** | **362 ms** | **0** |
| Render 0.5 CPU | soutenu (5 s) | après | 17,5 | 69 ms | 4 138 ms | 5 346 ms | 0 |
| Render 0.1 CPU | bureau (30 s) | avant | 2,1 | 11 599 ms | 39 355 ms | 42 682 ms | **75** (500 : réserve de connexions saturée) |
| Render 0.1 CPU | bureau (30 s) | après | 2,7 | 611 ms | 21 223 ms | 27 965 ms | 0 |
| Render 0.1 CPU | soutenu (5 s) | avant | 3,3 | 18 464 ms | 32 668 ms | 37 644 ms | **184** |
| Render 0.1 CPU | soutenu (5 s) | après | 3,6 | 16 852 ms | 41 559 ms | 53 894 ms | **98** |
| Render 0.1 CPU | soutenu (5 s), **25 utilisateurs** | après | 3,7 | 726 ms | 6 741 ms | 9 716 ms | 0 |
| Render 0.1 CPU | soutenu (5 s), **50 utilisateurs** | après | 5,2 | 2 462 ms | 15 580 ms | 19 330 ms | 0 |

Détail par écran : fichiers JSON produits par `charge.js` (`SORTIE=`), non versionnés.

**Lecture :**
- **Les corrections divisent les temps par 5 à 10** et suppriment les erreurs à volume égal.
- **Sur la base actuelle (0,1 CPU), 100 personnes actives ne tiennent pas.** La base plafonne vers
  4 à 5 requêtes par seconde.
  - Au rythme de bureau, le régime établi est correct (p50 0,6 s).
  - Mais l'**arrivée groupée** du matin (100 personnes qui ouvrent le tableau de bord en 30 s)
    fait attendre : tableau de bord p50 13 s, p95 23 s.
  - Au-delà de 50 utilisateurs en usage soutenu, la réserve de connexions de l'API se sature et
    des requêtes échouent (erreur 500 P2024).
- **Sur 0,5 CPU, la même charge passe largement** : p95 de 0,19 s au rythme de bureau.

## 4. Emails : envoi par lots, reprise après un échec de Brevo, quota

**Constat (avant) :**
- un email **immédiat** refusé par Brevo (panne, quota atteint, clé révoquée) était marqué envoyé,
  puis perdu ;
- un **résumé quotidien** refusé aussi (il était marqué avant l'envoi) ;
- seule la cloche gardait l'information ;
- aucun signal avant d'atteindre le quota journalier de Brevo (300 emails par jour dans l'offre
  gratuite).

**Corrections, sans changer le schéma :**
- **Reprise.**
  - Un email immédiat refusé est remis en file : `sentAt` nul, `aEnvoyerLe` = maintenant + 15 min.
    Le passage horaire suivant du résumé (`resume-quotidien`) l'envoie.
  - Un résumé refusé est remis en file pour l'heure suivante.
  - Chaque essai est journalisé.
  - Passé **72 heures** après sa création (24 h au plus d’attente du résumé, puis 48 h de reprises), un email non parti est **abandonné**
    (`aEnvoyerLe` nul) : il reste dans la cloche et n'est jamais envoyé en retard.
- **Lots.**
  - Le résumé part par lots de `EMAIL_LOT` emails (20), avec une pause de `EMAIL_PAUSE_MS`
    (1 000 ms) entre deux lots.
  - Les connexions SMTP sont réutilisées (`pool`, 2 connexions au plus).
- **Quota.**
  - Les emails acceptés par Brevo sont comptés par jour UTC.
  - La supervision affiche « **Quota journalier d’emails** » : **dégradé à 80 %**, indisponible
    une fois le quota atteint (« les emails reprendront demain »).
  - Le passage en dégradé alerte les administrateurs (notification et email), comme les autres
    services, grâce à la vérification toutes les 10 minutes.
  - Le quota se règle avec `BREVO_QUOTA_JOUR` (300 par défaut, dans `render.yaml`).
  - Le compteur est celui du processus : il repart de zéro à un redémarrage de l'API. C'est une
    alerte précoce, pas une comptabilité ; la référence reste le tableau de bord de Brevo.

**Testé** (`p_performance`, serveur d'envoi simulé en panne puis rétabli, sans réseau) :
- l'email immédiat est remis en file pour 15 min ;
- au passage suivant, toujours en panne, il est retenté une heure plus tard ;
- une fois le serveur rétabli, il part ;
- un email de plus de 72 h est abandonné ;
- 25 résumés partent en lots, avec une pause entre deux lots ;
- les seuils du quota (79 %, 80 %, 100 %) donnent les bons états ;
- la supervision est lisible par l'administrateur et refusée (403) à un agent.

## 5. L'offre Render tient-elle ?

**Base de données — `basic-256mb` (0,1 CPU, 256 Mo) : non, pas pour 100 utilisateurs actifs.**
- Mesuré avec le jeu gonflé, après corrections :
  - jusqu'à **25 utilisateurs actifs** (un écran toutes les 5 s) : p50 0,7 s, p95 6,7 s ;
  - à **50** : p50 2,5 s, p95 16 s ;
  - à **100** au rythme de bureau, le régime établi passe, mais l'arrivée du matin fait attendre
    plus de 10 s ;
  - en usage soutenu, des requêtes échouent.
- **Seuil retenu : au-delà d'une vingtaine de personnes connectées en même temps, ou dès que les
  agents signalent des lenteurs le matin**, passer à l'offre au-dessus.
- Aujourd'hui, la production a beaucoup moins de données (quelques centaines de tâches) : l'offre
  actuelle suffit pour le démarrage, mais pas pour l'objectif de 100 utilisateurs.

**Offre recommandée : `basic-1gb` (0,5 CPU, 1 Go).**
- Même charge (100 utilisateurs, rythme de bureau) : p50 34 ms, p95 192 ms, aucune erreur.
- À 100 utilisateurs en usage soutenu (un écran toutes les 5 s, soit 17 requêtes par seconde) :
  p50 69 ms, p95 4,1 s. C'est la limite haute de cette offre.
- Changement :
  - Render → la base → **Settings** → **Instance type** ;
  - sans perte de données, avec une courte coupure (quelques minutes) ;
  - à faire hors des heures de bureau ;
  - prix à vérifier sur la page des tarifs de Render.
- La restauration d'une sauvegarde est aussi bien plus rapide sur une base plus puissante :
  - export puis import du jeu gonflé (127 Mo) en **69 s** sur 0,1 CPU ;
  - **10 s** sur 0,5 CPU ;
  - **3 s** sans limite.

**API — offre `starter` (0,5 CPU, 512 Mo) : suffisante au rythme de bureau.** Voir § 5 bis.

**Disque des fichiers** : 1 Go. Voir `docs/Plan_reprise_incident.md` et l'alerte « Espace disque des
fichiers » de la PR « exploitation ».

### 5 bis. API limitée à 0,5 CPU et 512 Mo (offre `starter`)

API lancée dans un conteneur limité à 0,5 CPU et 512 Mo, sur la base « Render 0.5 CPU », code
après corrections :

| Rythme | Requêtes/s | p50 | p95 | p99 | Erreurs | Mémoire de l'API |
|---|---|---|---|---|---|---|
| bureau (30 s), 100 utilisateurs | 3,1 | 50 ms | 1 141 ms | 1 681 ms | 0 | 151 Mo |
| soutenu (5 s), 100 utilisateurs | 7,4 | 6 832 ms | 14 664 ms | 22 639 ms | 0 | — |

**Lecture :**
- **Au rythme de bureau, l'offre `starter` de l'API suffit**, arrivée du matin comprise : tableau de
  bord p95 1,5 s.
- En usage soutenu, l'API plafonne vers 7 requêtes par seconde. Si l'usage réel s'en approche
  (supervision : temps de réponse, plaintes des agents), passer l'API à l'offre `standard`
  (1 CPU, 2 Go).
- La mémoire reste loin de la limite.

**En résumé, pour 100 utilisateurs :**
- base `basic-1gb` (indispensable) ;
- API `starter` (suffisante au rythme de bureau, `standard` si l'usage devient soutenu).

## 6. Index : recommandés, pas indispensables (aucune migration)

Huit index ont été essayés sur la base « Render 0.1 CPU » :
- `tasks` : `createdById`, (`divisionId`, `sectionId`), `celluleId`, `parentTaskId` ;
- `task_assignees` : `userId` ;
- `leave_requests` : `userId` ;
- `documents` : `divisionId` ;
- `notifications` : (`userId`, `createdAt`).

**Gain mesuré :**
- tableau de bord d'un agent : 292 → 131 ms ;
- tableau de bord de la Direction : 747 → 581 ms ;
- indicateurs des tâches : 290 → 200-260 ms ;
- le reste sans changement notable.

La requête des tâches combine plusieurs conditions de visibilité, dont une sous-requête sur les
personnes assignées : PostgreSQL parcourt alors la table quoi qu'il arrive.

**Choix :**
- conformément à la consigne (« aucune modification du schéma sauf si c'est indispensable »), ces
  index **ne sont pas** ajoutés : le gain ne change pas la conclusion du § 5 ;
- ils sont prêts pour une future migration additive de consolidation (`CREATE INDEX` /
  `DROP INDEX` dans le retour arrière) si la Direction garde l'offre 0,1 CPU ;
- la recherche transverse (environ 0,5 s sur 0,1 CPU, `ILIKE` sur 5 tables) bénéficierait d'un index
  trigramme (`pg_trgm`), qui demande une extension : même remarque.

## 7. Ce qui reste volumineux, et quand s'en occuper

Les listes des **congés** (DRH, DN, DNA : toutes les demandes) et de la **GED** (3 000 documents :
2 Mo) restent complètes, car l'écran filtre et trie dans le navigateur. À ce volume, chaque liste
reste sous 0,4 s.

Le profil CPU de l'API sous charge le confirme : le coût restant tient à la taille des réponses
(lecture des résultats par Prisma 28 %, ramasse-miettes 17 %, sérialisation JSON 7 %).

**Recommandations :**
- Paginer côté serveur ces deux écrans quand une liste dépasse environ 5 000 lignes. Cela suppose de
  revoir leurs filtres, aujourd'hui calculés dans le navigateur.
- Vérifier que les réponses de l'API arrivent compressées : en-tête `content-encoding` dans l'onglet
  Réseau du navigateur, en production.
  - Sinon, ajouter une compression (gzip) à l'API.
  - Mesuré : la liste des congés du jeu gonflé passe de 2 Mo à 68 Ko en gzip. Ces données sont très
    répétitives ; compter plutôt 5 à 15 % sur des données réelles.

## 8. Rejouer les mesures

```bash
# Base LOCALE uniquement (les deux outils refusent toute autre adresse)
E2E_SUITES="c1_setup" bash tests/e2e/run_all.sh                    # jeu de test
NODE_PATH=apps/api/node_modules node tests/e2e/outils/volume.js     # jeu gonflé (≈ 1 min)
# API sur ce jeu (port 3000), puis :
UTILISATEURS=100 DUREE=60 REFLEXION_MS=5000 node tests/e2e/outils/charge.js
CHARGE_AVANT=1 …   # même écran d'accueil qu'avant la correction (liste complète des tâches)
# Base bridée comme Render :
docker run -d --network host --cpus=0.1 --memory=256m -e POSTGRES_USER=dnpec -e POSTGRES_PASSWORD=dnpec postgres:16 -p 5433
```

## 9. Choix tranchés seul (avec recommandation)

1. **Aucune migration, donc pas de branche `feature/consolidation-post-socle`.** Les index essayés
   (§ 6) apportent 20 à 55 % sur certains écrans, sans changer la conclusion sur l'offre de la base.
   *Recommandation* : les ajouter dans une migration de consolidation seulement si la base reste en
   0,1 CPU.
2. **Tableau de bord : 300 tâches au plus, celles dont l'échéance est la plus proche**, tâches closes
   depuis plus de 30 jours masquées, mention à l'écran.
   - Les indicateurs (KPI) restent calculés sur tout le périmètre.
   - « Mes tâches » et l'export Excel gardent la liste complète.
   - *Recommandation* : valider le seuil de 300 et les 30 jours avec la Direction.
3. **Listes des congés et de la GED non paginées.** Elles restent sous 0,4 s à ce volume, et paginer
   demanderait de revoir les filtres de ces écrans. *Recommandation* : à reprendre au-delà
   d'environ 5 000 lignes (§ 7).
4. **Reprise des emails par le passage horaire du résumé**, sans nouvelle table.
   - Un email immédiat refusé repart groupé, sous l'objet « Résumé quotidien » ; il est abandonné
     après 72 h.
   - *Recommandation* : acceptable tant que les pannes de Brevo restent rares.
5. **Quota compté en mémoire, par jour UTC**, seulement quand le SMTP est configuré ; alerte à 80 %.
   *Recommandation* : garder le tableau de bord de Brevo comme référence.
6. **Cache des chefs avisants limité à la requête**, avec une durée de vie de 5 s pour les scripts
   qui gardent le même acteur. Il ne modifie jamais une règle d'autorisation : le test compare
   liste et détail ligne à ligne.
7. **Compteurs de la cloche et des messages suspendus quand l'onglet est caché.** Ils se mettent à
   jour à chaque changement de page et à la minute suivante.
8. **Offres Render** : base `basic-1gb` recommandée (indispensable pour 100 utilisateurs), API
   `starter` maintenue.
   - *Recommandation* : changer l'offre de la base avant la séance de formation et l'annonce aux
     agents.
