# Guide du développeur — SI DNPEC

Système d'information interne de la DNPEC (Guinée), **en production** sur Render
(PostgreSQL, API NestJS et frontend Next.js en services distincts, emails réels via Brevo).
Référence fonctionnelle : cahier des charges v2.5 (§2.2 « besoin d'en connaître », §3.2 changement
de rôle, §4.10 suppléance, §4.11 courrier et actes, §4.15 socle NIMBA N1, §4.16 N2, §4.17 N3, Annexe B = journal des décisions) : `docs/Cahier_des_charges_DNPEC_SI.docx`.
Programme en cours : socle NIMBA, lots N1 → N6 (`docs/NIMBA_Cahier_des_charges_v2.2.docx`), une PR par lot,
déployés dans l'ordre ; conception N1 : `docs/conception_N1_socle_NIMBA.md`.

## Règles de travail (strictes, non négociables)

1. **Aucune modification du schéma sans vraie migration Prisma** (`prisma migrate dev` en local).
   Jamais de migration appliquée sur la production : elle passe uniquement par le workflow
   manuel `.github/workflows/db-migrate.yml`, déclenché par le responsable du projet.
   **Avant toute commande Prisma, vérifier que `DATABASE_URL` pointe vers une base LOCALE**
   (localhost), jamais vers Render.
2. Présenter la conception (modèle de données, endpoints, sécurité/visibilité) **avant** de coder,
   et attendre une validation explicite.
3. Tester réellement chaque fonctionnalité de bout en bout (serveur local + base réelle locale),
   y compris les cas limites (403 et 409 attendus), avant de montrer un résultat.
4. Nettoyer les fichiers de test temporaires et vérifier `git status` avant chaque commit.
   **Ne rien pousser sans accord explicite.**
5. Réutiliser l'existant : `CascadeService` (autorité/visibilité), `AuditService` (traçabilité),
   `NotificationsService` (notifications), `StorageService` (fichiers). Ne jamais recréer un
   mécanisme existant.
6. **Besoin d'en connaître (§2.2)** : la visibilité du DN/DNA s'arrête où commence le contenu
   protégé. Ce principe prévaut sur la cascade hiérarchique.

## Architecture

Monorepo pnpm 10 + turbo, Node 22. `apps/api` (NestJS 12, Prisma 5, PostgreSQL),
`apps/web` (Next.js 15, React 19, Tailwind 3). `apps/mobile`, `packages/*` et `infra/` sont des
squelettes non utilisés. **Pas de tests unitaires** : les validations se font par appels API
réels et sous Chromium, sur serveur local, avec la suite de bout en bout `tests/e2e/`
(`bash tests/e2e/run_all.sh`, voir son README ; refuse toute base non locale). Elle tourne
aussi en CI sur chaque PR (`.github/workflows/ci.yml`, base Postgres jetable). Toute nouvelle
fonctionnalité ajoute sa suite (`tests/e2e/api/`, `tests/e2e/ui/`) et sa ligne dans `run_all.sh`.

### API (`apps/api/src`)
- Un dossier par module : `<module>.module.ts`, `*.controller.ts` (mince, `@CurrentUser()`),
  `*.service.ts` (toute la logique d'autorisation), `dto/*.dto.ts` (class-validator ;
  `ValidationPipe` global avec `whitelist` + `forbidNonWhitelisted`).
- Guards globaux : `JwtAuthGuard` (tout est authentifié sauf `@Public()`), puis `RolesGuard`
  (`@Roles(...)`, contrôle grossier), puis `StagiaireGuard` : un STAGIAIRE est refusé (403) partout
  sauf routes ou contrôleurs marqués `@OuvertAuxStagiaires()` — toute nouvelle route lui est fermée
  par défaut. L'autorisation fine est dans les services via `CascadeService`.
- Erreurs : exceptions Nest (`ForbiddenException` 403, `ConflictException` 409 pour une transition
  d'état invalide, `NotFoundException` 404), messages en français. `HttpExceptionFilter` ne capte
  que les `HttpException` : une erreur Prisma non traduite (ex. P2002) sort en 500.
- Sélections Prisma explicites via constantes `XXX_SELECT` + `satisfies Prisma.XxxSelect`.
- Rôles (`SystemRole`) : DN, DNA, CHEF_DIVISION, CHEF_SECTION, CHEF_CELLULE, AGENT
  (= Chargé d'Études), ASSISTANT_DIRECTION (rattaché via `supervisorId` à DN/DNA/CHEF_CELLULE),
  ADMIN_SYSTEME, DRH, STAGIAIRE (rattachement facultatif, aucun droit par défaut, jamais habilitable).
  Rattachement : `divisionId`/`sectionId` OU `celluleId`.
  Seule `Cellule` a un `chefId` ; le chef d'une Division/Section se retrouve par
  `role + divisionId (+ sectionId) + status ACTIF`.
- `CascadeService` : `hasDirectAuthorityOver` (DN/DNA + chef direct ; **jamais sur soi-même**,
  ni sur le titulaire en intérim), `getVisibleUserWhereForLeadershipScope`,
  `isActingFor(actor, userId)` (identité littérale ou intérim), `isMemberOfDivision` (besoin d'en
  connaître GED). L'Assistant hérite de la *visibilité* du superviseur, jamais de son autorité.
- Suppléance : en-tête `X-Interim-For: <titulaireId>` validé par `JwtAuthGuard` → `role`/rattachement
  du titulaire empruntés pour la requête, `id` reste celui du suppléant, `interimForId` renseigné,
  `AuditLog.onBehalfOfId` posé automatiquement (AsyncLocalStorage).
- `AuditService.log({ actorId, action, entityType, entityId, metadata }, tx?)` : client global
  par défaut (audit après le commit), ou `tx` pour un audit annulé avec la transaction.
  Détail des événements dans `metadata.event`.
- `NotificationsService.notify(userId, type, title, body, link?, subjectDetail?)` : in-app + email
  synchrones. Tout nouveau `NotificationType` exige une entrée dans `NOTIFICATION_BUTTON_LABELS`.
- `StorageService.save(buffer, name) → { fileKey, sizeBytes }`, `createReadStream`, `delete`.
  Uploads via `FileInterceptor` + `memoryStorage()`, limite 25 Mo.
- Changement de rôle (`role-change/`) : une seule préparation pour l'aperçu et l'action ;
  toute attribution de rôle à un compte existant (dont chef de cellule) passe par là.
  Rattachement exigé par rôle : `rattachementPourRole` (`role-change/roles.ts`).
- Habilitations (pas des rôles) : courrier (`HabilitationCourrier`, par registre et unité) et
  gestionnaire logistique (`GestionnairesLogistiqueService`), personnelles : jugées sur `actor.id`,
  jamais empruntées en intérim.
- Socle NIMBA (`socle/`, lot N1, module `@Global`) — **pont additif** : les tables historiques
  (divisions/sections/cellules, `users.role`, habilitations) restent la source des modules ; les tables
  du socle (`UniteOrganisationnelle`, `Agent`, `AttributionRole`, `AccesRefuse`…) les reflètent.
  `ReprisesN1Service.reconcilier()` (au démarrage de l'API, idempotent, ne modifie aucune donnée
  historique) et `synchroniserCompte(userId)` après toute écriture historique d'un compte ou d'une unité.
  Deux axes : position (`role` + rattachement → périmètre) et rôles fonctionnels (`rolesActifs`,
  `estDrh`, `detenteursWhere(role)`), portés par `AuthenticatedUser.rolesFonctionnels`, **jamais
  empruntés en intérim** ; `@RolesFonctionnels(...)` pour le contrôle grossier. Contrôle fin :
  `AutorisationService.exiger()` (ordre : protégé → périmètre → rôle), 403 journalisé dans
  `acces_refuses` par `HttpExceptionFilter`. Un « DRH » se teste par `estDrh(actor)`, jamais par
  `role === DRH`. Aucun nouveau `NotificationType` : `notify(..., { libelleBouton })`.
  Routes nouvelles sous `api/v1/` : erreur `{ code, message, details, trace_id }`, en-tête `X-Trace-Id`.
  Agents : cycle de vie DRH seul (`AgentsService`), job quotidien `executer(now)` (fins prévues
  J-15/J-3/lendemain). Retour arrière d'un lot : `prisma/retour-arriere/<lot>_down.sql` (workflow
  manuel `db-retour-arriere.yml`), contrôlé par la phase 39g de `run_all.sh`.
- Socle N2 (`socle/`) : réauthentification avant un objet protégé (`PreuveIdentiteService.exiger/
  estValide`, en-tête `X-Reauth`, `POST /api/v1/reauthentification`, 403 `REAUTH_REQUISE` non
  journalisé ; le web rejoue la requête après la fenêtre `ReauthProvider`) — niveau 2 du dossier du
  personnel aujourd'hui, tout futur objet protégé ensuite. Journal d'audit **en écriture seule en
  base** (déclencheurs), scellé et chaîné chaque minute (`audit_sceller`, `audit_verifier`) : ne
  jamais écrire d'UPDATE/DELETE sur `audit_logs`. Connexions dans `journal_connexions` (purgées),
  plus dans l'audit. Paramètres bornés (`ParametresService.valeur(cle)`, §13.6) ; tâches planifiées
  enveloppées par `TachesPlanifieesService.suivre(nom, fn)` (supervision). « Aucun compte sans
  agent » en base : un compte actif reçoit d'office un agent provisoire (déclencheur), que
  `AgentsService.rattacherCompte` remplace par l'agent choisi.
- Socle N3 (règles métier) : congés à **avis du chef le plus proche** (`avisants`, supérieur désigné →
  cellule/section → division → DN/DNA) dans `conges.delaiAvisHeures` heures ouvrées
  (`socle/heures-ouvrees.ts`), rappel 12 h avant, avis tacite ensuite (job `executer(now)` toutes les
  15 min, tâche `avis-conges`), **décision du DRH** (`estDrh`) ; demande d'un DRH décidée par DN/DNA.
  Motif médical : demandeur et DRH seuls, motif derrière `PreuveIdentiteService` (lecture tracée).
  Avancement des tâches **calculé en base** (déclencheurs ; `PATCH /tasks/:id/progress` → 409).
  Stage : encadreur principal (DRH) et rapport (stagiaire dépose, encadreur valide/renvoie).
  Messages directs purgés après 3 ans (`ConservationService`, tâche `purge-messages`).
- Stages (`stages/`, D6) : job quotidien `StagesRotationService.executer(now)` (appelable avec une
  date simulée) ; attestation finale = acte du Courrier (`ActesService`).
  Réglages (capacités, modèle d'attestation) : DRH **et** administrateur système
  (`stages/reglages-stages.ts`) ; le contenu des stages reste au DRH. Modèle livré avec
  l'application : clé de fichier `integre:<nom>` → `apps/api/assets/`.
- Paramétrage initial : `apps/api/prisma/parametrage.ts` (workflow manuel
  `db-parametrage.yml`, mot « parametrer »). Création seulement, identité stable, trace
  d'audit « Système » (`entityType: 'Parametrage'`) : un élément supprimé à l'écran n'est
  jamais recréé. Tout nouvel élément de paramétrage doit suivre ce modèle et rester
  modifiable à l'écran ; aucun élément ne dépend du compte qui l'a créé.
- Démonstration : `apps/api/prisma/demo.ts` (workflow manuel `db-demo.yml`, modes
  « creer » / « supprimer », mot « demo », mot de passe saisi au lancement). Passe par les VRAIS
  services (contexte Nest) ; marques : unités et contenus « TEST — », comptes
  `@demo.dnpec.test` (`demo/demo.constantes.ts`), registres TEST-ARR/TEST-DEP, catégories TST/TSF,
  ids « demo-… ». Garde-fous : `EmailService` n'envoie jamais vers le domaine de démonstration ;
  le script filtre toute notification vers un compte réel ; fichiers → `integre:` (jamais le
  stockage). Comptes suspendus 14 jours après le dernier « creer » (`DemoExpirationService`).
  Un nouveau module doit être ajouté aux deux modes (création, suppression) et au test `z_demo_*`.
- Logistique (`logistique/`, D9) : numérotation d'inventaire et stock protégés en base (triggers,
  CHECK) ; réservations sans chevauchement (trigger qui verrouille la ressource) ; priorité
  hiérarchique = `ReservationsService.peutEvincer` (cascade ; DN et DNA pairs entre eux) ; une réunion
  réserve sa salle dans sa propre transaction (`creerDansTransaction`).
- Emails de compte (`users/comptes-emails.service.ts`) : inscription approuvée (rôle, unité,
  « Se connecter »), rejetée (motif facultatif `POST /users/:id/reject { motif? }`), compte créé
  par l'admin (lien de premier accès 7 jours, `creerLienPremierAcces`, partagé avec l'import).
  Envoyés après l'action, jamais bloquants (A7) ; pas de notification in-app.
- Double authentification (`auth/`) : `GET /auth/2fa/status`, `POST /auth/2fa/setup` (409 si
  active), `POST /auth/2fa/activate`, `POST /auth/2fa/disable` (code exigé) ; réinitialisation
  par l'administrateur `POST /users/:id/2fa/reset` (jamais sur soi-même). Écran
  `/compte/securite`.
- Aide (`aide/`) : `GET /aide/profils` = rôle propre (jamais celui de l'intérim) +
  habilitations (`SECRETARIAT_COURRIER`, `GESTIONNAIRE_LOGISTIQUE`) + guide DRH pour les rôles
  fonctionnels DRH et gestionnaire RH ; ouverte aux stagiaires.
  Contenu : `apps/web/lib/aide/guides.json`, captures `apps/web/public/aide/` ; toute évolution
  d'écran qui change un libellé cité doit mettre le guide à jour, puis régénérer captures et PDF
  (`tests/e2e/outils/captures_aide.js`, `guide_pdf.js`).
- Écrans : l'API renvoie les droits (`droits`, `peutAjouter`...) et les listes de choix
  (« responsables possibles »...) ; le web n'en calcule aucun.

### Web (`apps/web`)
- `app/(app)/<route>/page.tsx` (client components), `components/<module>/*` (Modal, Drawer,
  List, Card), `lib/api/<module>.ts` (`apiFetch`), `lib/<module>/types.ts`.
- Tokens Tailwind (`ink`, `gold`, `sage`, `clay`, `line`, `text-muted`...) issus de la maquette ;
  navigation dans `components/layout/Sidebar.tsx` ; ouverture profonde via `?id=`.
- Liens vers le web (notifications, emails) : chaque lien de l'API doit viser une page
  existante qui lit ses paramètres (contrôlé par `tests/e2e/api/i_liens.js`). Renommer ou
  supprimer une page déjà visée par des liens envoyés : ajouter l'ancien format à
  `apps/web/anciens-liens.json` (redirection de `next.config.ts`), jamais migrer les
  notifications stockées. Adresse inconnue : `app/not-found.tsx` (page 404 en français).
- Appels du navigateur à l'API : `apiFetch`/`appelApi` (`lib/api/client.ts`), jamais `fetch`
  direct (une erreur réseau devient `MESSAGE_API_INJOIGNABLE`, en français). CORS :
  `apps/api/src/common/cors.ts` (CORS_ORIGIN normalisée, refus journalisés) ; la suite e2e
  tourne avec un CORS strict. Version en ligne : API `/health`, web `/api/version`.
- Chargement d'une page : `.catch` obligatoire, message affiché par `ErreurChargement`
  (`components/ui/ErreurChargement.tsx`). Page visée avant connexion : `lib/auth/suite.ts`.

## Commandes utiles
```bash
pnpm install
pnpm --filter @dnpec/api exec prisma migrate dev --name <nom>   # base LOCALE uniquement
pnpm --filter @dnpec/api typecheck && pnpm --filter @dnpec/web typecheck
pnpm --filter @dnpec/api start:dev
bash tests/e2e/run_all.sh                                        # suite complète, base LOCALE
pnpm audit                                                        # voir docs/Securite_dependances.md
```

Exploitation (sauvegardes, mise à jour PR → CI verte → migration → fusion, pannes, secrets) :
`docs/Exploitation.md`.

## Reste à faire

- **Module non construit** : D5 (rémunération), hors périmètre (§5 du cahier des charges).
