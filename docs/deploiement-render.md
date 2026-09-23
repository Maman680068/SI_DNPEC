# Déploiement de l'API et du frontend sur Render — checklist manuelle

Ce document accompagne `render.yaml` (racine du repo). Le Blueprint décrit
*quoi* déployer (build, start, disque, variables) ; ce document décrit les
étapes que **vous seul** pouvez faire, parce qu'elles nécessitent un compte
Render et/ou un compte Brevo auxquels l'équipe de développement n'a pas accès depuis son poste.

Rien dans `render.yaml` ne contient de secret : chaque variable marquée
`sync: false` doit être saisie une fois, à la main, dans le tableau de bord
Render. `JWT_ACCESS_SECRET` n'a rien à saisir : Render la génère seul.

---

## 1. Appliquer le Blueprint

1. Dashboard Render → **New** → **Blueprint**.
2. Connectez le repo GitHub `si_dnpec`. Render demande ensuite quelle
   branche utiliser pour cette application du Blueprint — choisissez la
   branche qui contient le travail à déployer (`render.yaml` n'impose
   volontairement aucune branche : voir le commentaire en tête du fichier).
3. Render détecte `render.yaml` à la racine et propose **deux** services web :
   - `dnpec-api` (plan **Starter**, région **Frankfurt**, disque persistant
     1 Go monté sur `/var/data/documents`). Le plan **Starter** est
     nécessaire ici : le plan gratuit ne permet pas d'attacher un disque
     persistant.
   - `dnpec-web` (plan **Free** par défaut, région **Frankfurt**). Le plan
     gratuit met le service en veille après 15 min d'inactivité (réveil
     jusqu'à ~50s à la requête suivante) — passez `plan: starter` dans
     `render.yaml` avant d'appliquer si ce délai n'est pas acceptable pour
     vos utilisateurs.
   - Vérifiez que ces coûts (Starter pour l'API, Free ou Starter pour le
     web) correspondent à ce que vous attendez avant de valider.
4. Render vous demande alors les valeurs des variables `sync: false`
   (voir sections 2 et 3 ci-dessous) — vous pouvez aussi les renseigner
   juste après, dans **Environment** sur le service une fois créé.
5. Cliquez **Apply**. Le premier build/deploy démarre.

## 2. `DATABASE_URL` — base PostgreSQL déjà provisionnée

1. Dashboard Render → votre instance PostgreSQL existante → onglet
   **Connect**.
2. Copiez la **Internal Database URL** (pas l'externe : le service web et
   la base sont dans la même région Render, la connexion interne est plus
   rapide et ne transite pas par l'extérieur).
3. Collez-la telle quelle dans le champ `DATABASE_URL` du service
   `dnpec-api`.

Rappel : les migrations Prisma ne se déclenchent PAS automatiquement au
déploiement (comportement volontaire, inchangé). Une fois l'URL en place,
lancez le workflow GitHub Actions manuel `db-migrate.yml`
(`workflow_dispatch`, confirmation texte requise) pour appliquer le schéma
sur cette base, si ce n'est pas déjà fait.

**État constaté le 05/09/2026** : `db-migrate.yml` n'a été exécuté qu'une
seule fois (04/09/2026 03:18 UTC), sur le commit qui venait tout juste
d'ajouter le workflow — donc juste après la migration `init`
(`20260904025514_init`, qui contient déjà GED et `cellules.chefId`), mais
avant les deux migrations suivantes créées le même jour :
`20260904040650_add_task_cellule` (`Task.celluleId`) et
`20260904143504_add_cellule_scope_to_announcements`
(`Announcement.celluleId`). Ces deux dernières n'ont donc **jamais** été
appliquées sur la base Render — relancez `db-migrate.yml` pour les
appliquer avant d'utiliser les fonctionnalités de visibilité en cascade de
CHEF_CELLULE sur les tâches et les annonces en production.

## 3. Compte Brevo (SMTP) pour les emails de notification

1. Créez un compte sur https://www.brevo.com (le plan gratuit couvre
   largement les besoins de démarrage — 300 emails/jour).
2. Vérifiez un expéditeur : **Senders, Domains & Dedicated IPs** →
   **Senders** → ajoutez l'adresse `no-reply@dnpec.gov.gn` (ou l'adresse
   réelle choisie) et validez l'email de confirmation Brevo envoyé à cette
   adresse. Sans expéditeur vérifié, Brevo rejettera les envois.
3. Récupérez les identifiants SMTP : **Settings** (icône engrenage) →
   **SMTP & API** → onglet **SMTP**. Vous obtenez :
   - **Serveur SMTP** : `smtp-relay.brevo.com`
   - **Port** : `587` (déjà la valeur par défaut dans `render.yaml`)
   - **Login** : votre email de compte Brevo
   - **Mot de passe** : la **clé SMTP** générée (pas votre mot de passe de
     compte Brevo — cliquez **Generate a new SMTP key** si aucune n'existe)
4. Dans le service Render `dnpec-api`, renseignez :
   - `SMTP_HOST` = `smtp-relay.brevo.com`
   - `SMTP_USER` = votre login Brevo (email)
   - `SMTP_PASSWORD` = la clé SMTP générée à l'étape précédente
   - (`SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` ont déjà des valeurs par
     défaut dans `render.yaml` — à ajuster seulement si `SMTP_FROM` doit
     être une adresse différente de celle vérifiée à l'étape 2)

Tant que `SMTP_HOST` est vide, `EmailService` bascule automatiquement sur
`jsonTransport` (aucun envoi réel, juste un log) — voir le commentaire dans
`apps/api/src/communication/notifications/email.service.ts`. Dès que les
trois variables ci-dessus sont renseignées, les emails partent réellement,
sans aucun changement de code.

## 4. Vérifier le déploiement

1. Dashboard Render → service `dnpec-api` → onglet **Logs** : attendez
   `Nest application successfully started`.
2. Render affiche l'URL publique du service (forme
   `https://dnpec-api.onrender.com`, ou un nom que Render choisit si
   `dnpec-api` est déjà pris ailleurs — l'URL exacte est visible en haut de
   la page du service).
3. Testez `GET https://<votre-url>.onrender.com/health` → doit répondre
   `200 {"status":"ok"}`. C'est aussi ce chemin que le health check interne
   de Render utilise pour juger le déploiement en bonne santé.
4. Testez un endpoint réel, ex. `POST /auth/login` avec un compte existant,
   pour confirmer que la connexion à `DATABASE_URL` fonctionne.

## 5. `apps/web` : déployé avec l'URL de l'API déjà renseignée

`render.yaml` déclare maintenant `dnpec-web` avec `API_BASE_URL` et
`NEXT_PUBLIC_API_BASE_URL` déjà pointées, en dur, sur
`https://dnpec-api.onrender.com` (ce ne sont pas des secrets — une URL
publique — donc pas de `sync: false` ici, rien à saisir à la main). Testé
en local en mode production avant d'écrire ces valeurs : `next start`
respecte nativement la variable `PORT` injectée par Render, `GET /` répond
200 sans dépendre de l'API (page racine = composant client qui ne rend
rien côté serveur), et `NEXT_PUBLIC_API_BASE_URL` est bien injectée dans le
bundle JS au moment du build (vérifié dans les fichiers compilés).

**Si `dnpec-api` n'est pas le nom exact retenu par Render** (nom déjà pris,
etc.), ou si vous changez de nom pour `dnpec-web`, mettez à jour ces deux
valeurs dans `render.yaml` avant d'appliquer le Blueprint, ou directement
dans **Environment** sur le service `dnpec-web` après coup (nécessite un
redeploy pour que `NEXT_PUBLIC_API_BASE_URL` soit re-injectée au build).

## 6. CORS

`main.ts` autorise, par défaut (`CORS_ORIGIN` non renseignée), **toute**
origine à appeler l'API — un choix volontairement permissif tant que
l'URL du frontend n'était pas connue. Les appels directs du navigateur à
l'API n'utilisent qu'un en-tête `Authorization: Bearer`, jamais de cookie
(voir `apps/web/lib/api/client.ts`), donc cette permissivité temporaire
n'a exposé aucune session.

Maintenant que `dnpec-web` est déclaré dans `render.yaml`, l'URL prévisible
du frontend est `https://dnpec-web.onrender.com` (même remarque que pour
`dnpec-api` : si ce nom est déjà pris, Render en choisit un autre — vérifiez
l'URL réelle affichée sur la page du service une fois déployé).

**Valeur à saisir dans `CORS_ORIGIN`** (dashboard Render, service
`dnpec-api`, après le déploiement de `dnpec-web`) :

```
https://dnpec-web.onrender.com
```

(remplacez par l'URL réelle si Render en a assigné une différente).
Plusieurs origines séparées par des virgules sont acceptées si besoin
(ex. un environnement de préproduction en plus). Sans cette variable, le
comportement actuel (permissif) continue — ce n'est pas bloquant pour le
premier déploiement du frontend, seulement moins strict.

## 7. Vulnérabilité connue et acceptée dans les dépendances

**Constaté le 23/09/2026** : sur les 9 alertes Dependabot ouvertes sur le
dépôt à cette date, 4 (`multer`, DoS/fuite de descripteur de fichier) ont
été corrigées en mettant à jour `@nestjs/platform-express` vers `12.1.0`
(dans le range `^12.0.1` déjà déclaré dans `apps/api/package.json` — aucune
modification de `package.json` n'a été nécessaire, seul le lockfile
`pnpm-lock.yaml` a changé de résolution).

Une alerte reste **sciemment non corrigée** :

- **`uuid@8.3.2` — vérification de limites de buffer manquante
  (v3/v5/v6 avec `buf` fourni)**, sévérité modérée. Cette dépendance
  n'est pas directe : elle vient d'`exceljs@4.4.0` (utilisé pour l'import
  Excel du personnel et l'export `.xlsx` des tâches), qui exige
  `uuid@^8.3.0`. Le correctif amont nécessite `uuid >= 11.1.1`, une
  montée majeure (v8 → v11, passage à un package ESM-only) — vérifié le
  23/09/2026 : ni `exceljs@4.4.0` (dernière version stable), ni la
  préversion `4.4.1-prerelease.0` ne mettent à jour cette dépendance.
  Forcer un override pnpm sur `uuid` casserait potentiellement la
  génération de fichiers `.xlsx` (usage interne d'exceljs non vérifié
  avec uuid v11+) sans bénéfice de sécurité vérifié en pratique (uuid
  n'est utilisé par exceljs que pour générer des identifiants internes,
  jamais à partir d'un `buf` fourni par un utilisateur externe).

**Action de suivi** : revérifier la page npm d'`exceljs` (ou son dépôt
GitHub) lors d'une prochaine intervention sur les dépendances, pour voir
si une version publiée après le 23/09/2026 met à jour sa dépendance `uuid`
vers une version corrigée — et dans ce cas, mettre à jour `exceljs` plutôt
que de forcer un override.
