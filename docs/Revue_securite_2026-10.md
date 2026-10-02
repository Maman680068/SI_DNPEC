# Revue de sécurité — octobre 2026

Branche `feature/revue-securite`, basée sur `feature/socle-nimba-n6` (N6 se déploie d'abord). Aucune
modification du schéma de la base.

**Périmètre :**
- les 402 routes de l’API ;
- la fuite des champs protégés : motif médical, niveau 2 du dossier du personnel, pli personnel,
  rémunération ;
- les contrôles OWASP : injections, téléversements, en-têtes, limitation de débit, sessions,
  journalisation ;
- les dépendances (`pnpm audit`).

**Méthode :**
- lecture du code, module par module ;
- chaque constat vérifié dans le code, puis corrigé ;
- chaque correction prouvée par un test de bout en bout : suites `s1_routes` et `s2_securite`
  (nouvelles), `g3_2fa` et `g3_2fa_ui` (mises à jour), suite complète repassée.

## Synthèse

| Gravité | Constats | Corrigés | Acceptés (justifiés) |
|---|---|---|---|
| Haute | 3 | 3 | 0 |
| Moyenne | 6 | 6 | 0 |
| Basse | 11 | 8 | 3 |
| Information | 5 | 1 | 4 |

**Déploiement :** une seule action est nécessaire sur Render. Ajouter la variable `WEB_PROXY_SECRET`,
avec la **même valeur** (32 caractères aléatoires, par exemple) sur `dnpec-api` et sur `dnpec-web`.
Sans elle, l'application fonctionne : le verrouillage par adresse IP des connexions est alors
désactivé, mais le verrouillage par compte reste actif.

## Constats et corrections

### Hauts

**H1 — Verrouillage par IP : 5 échecs, venant de n'importe qui, bloquaient la connexion de tout le
monde pendant 15 minutes.**
- Cause : la connexion passe par le serveur du web (il pose le cookie du jeton de renouvellement).
  L'API voyait donc toutes les connexions venir de l'adresse du web. Le journal des connexions
  enregistrait lui aussi cette adresse, au lieu de celle de l'agent.
- Correction :
  - le web transmet l'adresse réelle (`X-Client-IP`), accompagnée d'un secret partagé
    (`WEB_PROXY_SECRET`, comparé en temps constant) ;
  - l'API n'en tient compte qu'avec ce secret ;
  - une adresse non attribuable ne sert jamais à un verrou commun (seul le verrou par compte
    s'applique).
- Code : `apps/api/src/common/security/client-ip.ts`, `apps/web/lib/auth/session-proxy.server.ts`.
- Tests (`s2_securite`) :
  - l'adresse A est verrouillée après 5 échecs, et l'adresse B se connecte encore ;
  - le journal enregistre A ;
  - une adresse transmise sans le secret est ignorée.

**H2 — Le filtre « type de congé » révélait les congés maladie à la cascade.**
- Cause : `GET /leaves?leaveTypeId=<maladie>` filtrait en base avant le masquage. Le DN, la DNA ou
  un chef de division obtenaient la liste exacte des congés maladie (noms et dates), même affichés
  « Absence — motif protégé ».
- Correction : le filtre s'applique au type que la personne a le droit de voir. Une ligne masquée
  n'apparaît jamais sous un filtre de type.
- Test : le DN qui filtre sur « Congé maladie » n'obtient pas la ligne.

**H3 — `pnpm audit` : 8 failles hautes.**
- `brace-expansion`, via eslint, typescript-eslint et exceljs : déni de service.
- `nodemailer` 10.0.0 : déni de service dans le parseur d'adresses.
- Correction par des montées de correctif uniquement, sans changement de version majeure :
  - `nodemailer ^10.0.9` ;
  - surcharges `brace-expansion@^1 → ^1.1.21`, `@^2 → ^2.1.7`, `@^5 → ^5.0.12` ;
  - `fast-uri ^3.1.8` (moyenne).
- Résultat : `pnpm audit` → « No known vulnerabilities found » (voir
  `docs/Securite_dependances.md`).

### Moyens

**M1 — La déconnexion ne révoquait pas la session.**
- Cause : le web appelle `POST /auth/logout` avec le seul jeton de renouvellement. La route exigeait
  un jeton d'accès : 401 silencieux, et la session restait valable 30 jours.
- Correction : la route est publique. Posséder le jeton de renouvellement suffit à révoquer la
  session qu'il désigne.
- Test : après déconnexion, le renouvellement renvoie 401.

**M2 — Aucun en-tête de sécurité sur le web.**
- Risques : clickjacking ; envoi de l'adresse de `/reset-password` (qui contient le jeton) en
  référent.
- Correction (`apps/web/next.config.ts`) :
  - politique de contenu limitée au site et à l'API, avec `frame-ancestors 'none'` et
    `object-src 'none'` ;
  - `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS ;
  - `Permissions-Policy` ;
  - plus de `X-Powered-By`.
- Test : en-têtes vérifiés sur `/`, `/login` et `/dashboard`. Toutes les suites Chromium repassent
  avec la politique active. L'aspect des pages ne change pas.

**M3 — Un jeton d'accès volé permettait d'imposer sa double authentification au titulaire et
d'obtenir une session de 30 jours.**
- Correction :
  - configurer la 2FA depuis une session exige le mot de passe (preuve de réauthentification) ;
  - le parcours qui ouvre une session (`/auth/2fa/enable`) est réservé au jeton de configuration de
    la connexion : 409 avec un jeton d'accès.
- La page Sécurité demande le mot de passe dans la fenêtre « Confirmez votre identité » déjà
  existante.
- Tests : `g3_2fa` (403 `REAUTH_REQUISE`, puis succès avec preuve ; 409 sur `enable`) et
  `g3_2fa_ui`.

**M4 — Aucune limite de débit hors connexion.**
- Constat : mot de passe oublié (rafales d'emails), inscription (comptes en masse), codes 2FA saisis
  depuis une session (ni comptés ni journalisés).
- Correction :
  - mot de passe oublié : 5 demandes par adresse email et 10 par adresse IP, par heure ;
  - inscription : 30 par adresse IP et par heure ;
  - codes 2FA d'activation et de désactivation : comptés dans le verrouillage du compte (5 échecs →
    15 min) et journalisés dans `journal_connexions`.
- Tests : quotas atteints → 429 ; 5 codes faux → compte verrouillé, échecs présents dans le
  journal.

**M5 — Les notifications et emails de congé maladie partaient vers le DN et la DNA, qui ne décident
pas.**
- Cause : en l'absence de DRH, les « décideurs » notifiés étaient le DN et la DNA, alors que seul le
  DRH décide de la demande d'un agent. À l'inverse, la demande d'un DRH notifiait les autres DRH, et
  non le DN et la DNA, qui la décident.
- Correction : les destinataires suivent exactement la règle de décision.
- Test : aucune notification au DN ni à la DNA pour la demande d'un agent.

**M6 — La lecture du motif médical dans la liste n'était pas tracée.**
- Constat : le DRH et le chef avisant recevaient le motif dans la liste des congés et dans le tableau
  de bord, sans trace. Seul le détail était tracé.
- Correction : la liste ne porte plus le motif d'un tiers. Il se lit dans le détail, derrière la
  réauthentification, et sa lecture est tracée.
- Test : motif absent de la liste du DRH ; présent dans le détail, avec une trace de plus au
  journal.

### Bas

| # | Constat | Correction |
|---|---|---|
| B1 | Textes libres du chef (motif d'avis) et du DRH (commentaire) visibles par la cascade sur un congé maladie. | Masqués avec le type. Test : le DN reçoit `avisMotif` et `decisionComment` vides. |
| B2 | La nature « congé maladie » partait dans les emails (Brevo, service extérieur) et le résumé quotidien. | Libellé « Absence — motif protégé » dans toutes les notifications de congé maladie. La nature se lit dans l'écran Congés. Test : aucune notification ne contient « maladie ». |
| B3 | Le journal d'audit gardait le texte libre du commentaire de refus et du motif d'avis (journal en écriture seule, jamais purgé). | Seule la présence d'un texte est journalisée (`commentaire: true`). Test. |
| B4 | Lien de réinitialisation : une double utilisation simultanée était possible, et les liens précédents restaient valables. | Consommation atomique. Un nouveau lien, ou une réinitialisation, invalide les autres. Tests : 2 requêtes simultanées → une seule réussit ; ancien lien → 401 ; un seul lien valable après une nouvelle demande. |
| B5 | Une suspension par l'administrateur ne révoquait pas les sessions : une réactivation leur rendait leur validité. | Sessions révoquées dès qu'un compte quitte l'état actif. La suspension d'un agent et l'expiration de la démonstration le faisaient déjà. Test. |
| B6 | Fichier déposé servi avec le type déclaré par le navigateur de la personne qui l'a déposé (un HTML pouvait être servi comme HTML). | Liste de types bureautiques sûrs, tout le reste en `application/octet-stream`, toujours en pièce jointe (`common/storage/type-servi.ts`). Test : un `.html` est servi en `octet-stream`. |
| B7 | Énumération des comptes par le temps de réponse : connexion (hachage seulement si le compte existe) et mot de passe oublié (envoi attendu seulement si le compte existe). | Vérification « à blanc » de même coût pour un compte inconnu ; email envoyé sans être attendu. Test : même réponse pour un compte inconnu et un mot de passe faux. |
| B8 | Mots de passe sans longueur maximale (un mot de passe de 100 Ko fait travailler argon2). | 200 caractères au plus dans tous les formulaires. Test : 400. |
| B9 | Verrouillage en mémoire : les tables grossissaient sans fin avec des adresses et des comptes toujours différents. | Purge des entrées expirées toutes les 10 minutes. **Accepté** : stockage par instance, perdu au redéploiement. Une seule instance aujourd'hui ; un stockage partagé exigerait une table. |
| B10 | Recherche : les caractères `%` et `_` ne sont pas échappés. | Longueur bornée à 100 caractères dans tous les filtres de recherche. **Accepté** : l'effet se limite à des résultats élargis, toujours dans le périmètre visible de la personne. Ce n'est pas une injection : toutes les requêtes sont paramétrées. |
| B11 | Un jeton d'accès déjà émis reste valable jusqu'à 15 minutes après une réinitialisation du mot de passe. | **Accepté** : les sessions (jetons de renouvellement) sont révoquées tout de suite, et le statut du compte est vérifié à chaque requête. Fermer cette fenêtre de 15 minutes demanderait une lecture de plus en base à chaque requête. |

### Information

| # | Constat | Suite donnée |
|---|---|---|
| I1 | Démarrage sans secret de signature des jetons. | L'API refuse de démarrer si `JWT_ACCESS_SECRET` manque ou fait moins de 16 caractères. Avertissement au démarrage si `CORS_ORIGIN` ou `WEB_PROXY_SECRET` est vide en production. |
| I2 | Corps des emails journalisé quand le SMTP n'est pas configuré. | Plus jamais en production, sauf demande explicite de la suite de tests (`EMAIL_JOURNAL_CORPS=1`). |
| I3 | `GET /auth/register/supervisor-options` (public) donne le nom des DN, DNA et chefs de cellule. | Accepté : le formulaire d'inscription en a besoin, et ces noms figurent dans l'organigramme public de la DNPEC. |
| I4 | L'import Excel du dossier (DRH seul) écrit le niveau 2 sans réauthentification. | Accepté : il n'en renvoie aucune valeur et la route est réservée au DRH. |
| I5 | Ligne « Absence — motif protégé » dans les soldes. | Conforme au §2.2 tel que décidé. À revoir si d'autres types deviennent protégés. |

## Contrôles conformes (vérifiés, rien à corriger)

- **Routes** :
  - 402 routes, dont 13 publiques, toutes listées dans `s1_routes`. Une nouvelle route publique
    fait échouer la suite.
  - Les 389 autres renvoient 401 sans jeton, avec un jeton forgé (signé d'un autre secret, rôle
    administrateur), expiré ou non signé (`alg: none`).
  - Le stagiaire est refusé partout hors liste blanche (`d6_role_stagiaire`).
  - Le contrôle fin, par périmètre, est dans les services et joué par la suite de chaque module :
    matrice de l'annexe 1, 304 cases.
- **Inventaire** : `s1_routes` écrit `routes_securite.md`, qui donne pour chaque route son garde
  grossier (`@Roles`, `@RolesFonctionnels` ou service) et l'ouverture aux stagiaires.
- **SQL** : aucune requête brute non paramétrée (`$queryRawUnsafe`, `$executeRawUnsafe`,
  `Prisma.raw` absents).
- **Exports et emails** :
  - en-têtes `Content-Disposition` encodés ;
  - emails échappés, résumé quotidien compris ;
  - exports Excel sans formule ;
  - aucun export CSV.
- **Stockage** : clé aléatoire et nom ramené à sa base (pas de traversée), 25 Mo au plus.
- **Sessions** :
  - jeton d'accès de 15 minutes, et statut du compte vérifié à chaque requête ;
  - jeton de renouvellement aléatoire, haché et renouvelé à chaque usage, en cookie `httpOnly`,
    `Secure` et `SameSite=Strict` ;
  - jeton d'accès en mémoire, jamais en `localStorage`.
- **Mots de passe** : argon2id ; jetons de réinitialisation aléatoires, hachés, valables 1 heure.
- **Journalisation** : tous les 403 dans `acces_refuses` ; échecs de connexion, de 2FA et de
  réauthentification dans `journal_connexions`.
- **CORS** : liste blanche, sans cookie vers l'API, donc pas de CSRF possible.
- **Validation** : `whitelist` et `forbidNonWhitelisted` ; corps JSON limité à 100 Ko ; aucune pile
  renvoyée au client.
- **Champs protégés sans fuite** :
  - détail des congés ;
  - soldes ;
  - tableau de bord ;
  - niveau 2 du dossier : toutes les routes exigent la preuve, et la lecture est tracée ;
  - effectifs : agrégats seulement ;
  - pli personnel (niveau « existence », jamais dans une notification) ;
  - exports Excel ;
  - documents générés ;
  - recherche transverse et fils de discussion (congés, dossiers et plis jamais citables) ;
  - journal d'audit (métadonnées jamais renvoyées) ;
  - journaux applicatifs.
- **Rémunération** : aucun champ de salaire dans le schéma (D5 non construit). Le seul montant est
  celui des frais de mission.

## Tests ajoutés ou modifiés

| Suite | Contrôles | Objet |
|---|---|---|
| `s1_routes` (nouvelle, 38o) | 5 | Liste exacte des routes publiques ; 401 sur 389 routes sans jeton, avec un jeton forgé, expiré ou non signé ; inventaire des gardes. |
| `s2_securite` (nouvelle, 38p) | 35 | Congés maladie (filtre, liste, détail tracé, textes libres, notifications, journal) ; verrou par IP ; déconnexion ; quotas ; liens de réinitialisation ; codes 2FA ; suspension ; type servi ; en-têtes du web et de l'API. |
| `g3_2fa` | +2 | Configuration sans mot de passe → 403 ; `enable` avec un jeton d'accès → 409. |
| `g3_2fa_ui` | — | Fenêtre « Confirmez votre identité » avant le QR code. |

## Recommandations hors périmètre de cette PR

1. Choisir une valeur forte pour `WEB_PROXY_SECRET` (au moins 32 caractères aléatoires) et la
   changer si elle a pu être divulguée. Les deux services doivent garder la même valeur.
2. Avant toute mise à l'échelle sur plusieurs instances : déplacer les compteurs de verrouillage
   dans un stockage partagé.
3. Refaire `pnpm audit` chaque trimestre (prochaine fois : 31 décembre 2026).
