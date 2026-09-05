# Déploiement de l'API sur Render — checklist manuelle

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
3. Render détecte `render.yaml` à la racine et propose un service web
   `dnpec-api` (plan **Starter**, région **Frankfurt**, disque persistant
   1 Go monté sur `/var/data/documents`).
   - Le plan **Starter** est nécessaire : le plan gratuit ne permet pas
     d'attacher un disque persistant. Vérifiez que c'est le coût attendu
     avant de valider.
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

## 5. Une fois l'URL confirmée : configurer `apps/web`

Voir la réponse dédiée à l'étape 4 de la demande initiale — en résumé,
`apps/web` a besoin de deux variables pointant vers l'URL Render obtenue
ci-dessus au lieu de `http://localhost:3000` :

- `API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`

(voir `apps/web/.env.example` pour leur usage exact : la première est lue
côté serveur par les Route Handlers `app/api/auth/*`, la seconde est
exposée au navigateur pour les appels directs à l'API).
