# Plan de reprise après incident — SI DNPEC

Version d'octobre 2026, à relire à chaque changement d'offre Render.

Ce plan complète `docs/Exploitation.md` (§ 2 Sauvegardes, § 4 Pannes). Les durées indiquées ont
été **mesurées** lors d'un essai réel en local ; voir « Essai chronométré » à la fin.

## 0. Ce qui doit être sauvegardé, et où

| Élément | Où il vit | Sauvegarde | Qui restaure |
|---|---|---|---|
| **Base de données** (comptes, tâches, congés, courrier, dossiers, journal d'audit…) | Render, base PostgreSQL | Automatique (offre payante 0.1c-256mb : restauration à une **date et une heure précises** sur 3 jours) + **export hebdomadaire** téléchargé et rangé hors de Render | Responsable du projet |
| **Fichiers déposés** (pièces des tâches, GED, scans du courrier, certificats, rapports de stage) | Disque persistant `dnpec-documents` du service `dnpec-api` (1 Go) | **Pas** dans l'export de la base. Instantanés quotidiens de Render (service → Disks → Snapshots) + **archive ZIP hebdomadaire** (Supervision → « Télécharger les fichiers (ZIP) ») | Responsable du projet, administrateur |
| **Code et configuration** | GitHub (branche de production), `render.yaml` | Le dépôt lui-même | Responsable du projet |
| **Secrets** (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `SMTP_*`, `WEB_PROXY_SECRET`) | Render → Environment ; secrets GitHub | Coffre du responsable du projet (hors ligne) | Responsable du projet |

Objectifs retenus :
- **perte de données maximale** : 24 heures pour la base (export de la veille), 1 heure si la
  restauration à l'heure près est possible ; 7 jours pour les fichiers (archive hebdomadaire),
  1 jour avec les instantanés Render ;
- **remise en service** : 1 heure.

## 1. Restauration complète depuis un export, vers une base neuve

À utiliser quand la base est perdue, corrompue, ou abîmée au-delà de 3 jours (au-delà de la
restauration à l'heure près).

1. **Décider à deux.** Prévenir les agents : l'application sera indisponible, et ce qui a été saisi
   depuis l'export sera perdu.
2. **Créer une base neuve** :
   - Render → New → PostgreSQL ;
   - même région (Frankfurt), même offre ;
   - noter l'« External Database URL ».
3. **Restaurer l'export**, depuis un poste qui a les outils PostgreSQL 16 :
   ```bash
   pg_restore --no-owner --no-privileges --exit-on-error -d "<External Database URL de la base neuve>" dnpec_AAAA-MM-JJ.dump
   ```
   Durée mesurée : voir la fin du document. Elle croît à peu près avec la taille de l'export.
4. **Contrôler la base restaurée**, avant de brancher l'application :
   ```bash
   psql "<URL>" -c "SELECT count(*) FROM users;" -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;" -c 'SELECT * FROM "audit_verifier"();'
   ```
   - nombre de comptes plausible ;
   - dernière migration = celle du dernier lot déployé ;
   - `rangRompu` vide : chaîne d'audit intacte.
5. **Brancher l'application.** Mettre la nouvelle adresse dans le secret `DATABASE_URL`, à deux
   endroits :
   - Render → `dnpec-api` → Environment ;
   - GitHub → Settings → Secrets → Actions.
6. **Redémarrer** `dnpec-api` (Manual Deploy → Restart service).
7. **Vérifier** :
   - `/health` répond ;
   - connexion d'un administrateur ;
   - Administration → Journal d'audit → « Vérifier l'intégrité » (la supervision affiche sinon la
     dernière vérification de la base d'origine) ;
   - Supervision au vert ;
   - un congé, une tâche et un courrier récents sont présents.
8. **Déclarer le test** : Supervision → « Déclarer un test de restauration » (date, résultat).
9. **Supprimer l'ancienne base** seulement une semaine plus tard, après un nouvel export de la
   base restaurée.

## 2. Restauration à l'heure près (offre payante, 3 derniers jours)

À utiliser après une erreur humaine datée, par exemple une suppression massive ou une mauvaise
manipulation du paramétrage.

1. Retrouver l'heure de l'erreur : Administration → « Journal d'audit » (filtre par date). Retenir
   l'heure **juste avant** l'erreur (UTC).
2. Render → la base → **Recovery** → « Point-in-time recovery » : choisir la date et l'heure
   → **Restore**. Render crée une **nouvelle** base.
3. Suivre les étapes 4 à 9 du § 1.
4. Ce qui a été saisi après l'heure choisie est perdu. Prévenir les agents concernés : le journal
   d'audit de l'ancienne base, encore consultable, dit qui a fait quoi après cette heure.

## 3. Le disque des fichiers tombe ou est perdu

**Symptômes :**
- Supervision : « Stockage des fichiers » indisponible ;
- les agents voient des erreurs à l'ouverture d'une pièce jointe ;
- le reste de l'application (tâches, congés, courrier sans scan) fonctionne.

1. Render → `dnpec-api` → **Disks** : le disque est-il monté, plein, en erreur ?
   - **Plein** (Supervision : « Espace disque des fichiers » ≥ 95 %) : agrandir le disque, puis
     redémarrer. Aucune donnée n'est perdue.
2. **Perdu ou abîmé** : Disks → **Snapshots** → choisir l'instantané de la veille → **Restore**.
3. Sans instantané utilisable : repartir de la dernière **archive ZIP**, en décompressant tous les
   fichiers à la racine de `/var/data/documents` :
   - avec Render Shell (offre payante du service) ;
   - sinon, attacher un disque neuf, le remplir via un déploiement temporaire, ou demander
     l'assistance de Render.
4. Les fichiers déposés **après** l'archive sont perdus. La base les référence toujours : leur
   ouverture échoue avec un message clair. Demander aux auteurs de les redéposer ; le journal
   d'audit donne la liste des dépôts postérieurs à l'archive.

## 4. Brevo (emails) est indisponible

**Symptômes :** Supervision « Envoi des emails » dégradé (« Dernier envoi en erreur… ») ; alerte
aux administrateurs.

- **Rien ne bloque.** Toutes les actions aboutissent et les notifications restent dans la cloche
  🔔. Seuls les emails ne partent pas.
- Vérifier sur status.brevo.com, puis sur le compte Brevo : quota journalier atteint, clé SMTP
  révoquée, domaine bloqué.
  - **Quota atteint** : il se réinitialise le lendemain. Pour une campagne exceptionnelle,
    souscrire un palier supérieur.
  - **Clé révoquée** : en créer une nouvelle, la recopier dans Render → `dnpec-api` → `SMTP_PASSWORD`,
    puis redémarrer.
- Emails non envoyés pendant la panne : voir la PR « performance », qui ajoute la reprise
  automatique des emails en échec et une alerte avant d'atteindre le quota journalier. Avant elle,
  un email en échec n'est pas renvoyé : les agents retrouvent l'information dans la cloche.
- Un lien de réinitialisation de mot de passe non reçu se redemande sur la page de connexion.

## 5. L'API ou le web ne répondent plus

Voir `docs/Exploitation.md`, § 4 : relance du service, CORS, rollback de déploiement.

Une version déployée qui casse l'application se défait en deux temps : Render → service → Events
→ **Rollback**, pour l'API puis pour le web. La base reste compatible avec la version précédente
(migrations additives).

## 6. Sauvegarde du stockage des fichiers : le geste hebdomadaire

1. Administrateur : Administration → « Paramétrage et supervision » → onglet « Supervision »
   → bloc « Sauvegardes » → « Télécharger les fichiers (ZIP) ».
   - Le mot de passe est demandé, car l'archive contient des pièces protégées.
   - Le téléchargement est tracé dans le journal d'audit.
2. Ranger l'archive `dnpec_fichiers_AAAA-MM-JJ.zip` avec l'export de la base du même jour, hors de
   Render (disque chiffré du service, coffre). Garder les 4 dernières.
3. **Pourquoi pas un workflow GitHub automatique ?**
   - GitHub ne peut atteindre le disque de Render qu'à travers l'API de l'application, avec un
     compte administrateur et son mot de passe enregistrés comme secret GitHub, ou avec une clé
     d'API Render.
   - Ce serait un **accès supplémentaire** à créer et à protéger : écarté.
   - Si la Direction le souhaite plus tard, la marche à suivre est la suivante :
     1. créer une clé d'API Render en lecture seule ;
     2. la stocker comme secret GitHub ;
     3. utiliser l'API « Disk snapshots » de Render ;
     4. le tout dans un workflow manuel, avec un mot de confirmation, sur le modèle de
        `db-migrate.yml`.

## 7. Contrôles réguliers

| Fréquence | Contrôle | Où |
|---|---|---|
| Chaque matin | Supervision au vert, en particulier « Journal d'audit », vérifié chaque nuit à 2 h 30 UTC | Administration → Paramétrage et supervision |
| Chaque semaine | Export de la base et archive des fichiers, rangés ensemble | § 6 et `Exploitation.md` § 2 |
| Chaque mois | « Taille de la base » et « Espace disque des fichiers » sous 80 % | Supervision |
| Tous les 6 mois | Essai de restauration (§ 1, sur une base de test), puis « Déclarer un test de restauration » | Supervision |

## Essai chronométré (local, octobre 2026)

Essai réalisé sur une copie de la base de test **gonflée à un volume réaliste** : 20 000 tâches,
100 000 notifications et 50 018 lignes de journal d'audit scellées, soit 74 Mo en base.
PostgreSQL 16, sur le même poste.

| Étape | Commande | Durée mesurée |
|---|---|---|
| Export (format « custom ») | `pg_dump --format=custom --no-owner` | **0,8 s** (fichier de 4,5 Mo) |
| Création de la base neuve | `CREATE DATABASE` | < 1 s |
| Restauration | `pg_restore --no-owner --no-privileges --exit-on-error` | **2,2 s**, sans erreur |
| Contrôles (§ 1, étape 4) | comptes, dernière migration (`20261003080000_socle_nimba_n6`), `audit_verifier()` | **0,7 s** : 50 018 lignes vérifiées, chaîne intacte |
| Démarrage de l'API sur la base restaurée | `node dist/main.js` jusqu'à `/health` = 200 | **2,6 s** |
| État de la supervision | `/health/dependances` | base, stockage, journal d'audit nominaux |

**Lecture :**
- Sur ce volume, la partie technique prend **moins de 10 secondes**. Le reste du délai de
  remise en service (objectif : 1 heure) tient au téléchargement de l'export depuis Render, à la
  création de la base sur Render (quelques minutes), à la mise à jour de `DATABASE_URL` et au
  redémarrage.
- Pour une base de production 10 fois plus grosse, compter une minute de restauration.

**Point relevé pendant l'essai :**
- La dernière vérification de nuit du journal d'audit est enregistrée dans la base : une base
  restaurée affiche donc celle de la base d'origine.
- Après une restauration, l'administrateur clique sur « Vérifier l'intégrité » (Administration →
  Journal d'audit). La vérification complète se refait et met à jour la supervision. La commande
  `audit_verifier()` de l'étape 4 donne le même résultat en ligne de commande.
