# Guide du développeur — SI DNPEC

Système d'information interne de la DNPEC (Guinée), **en production** sur Render
(PostgreSQL, API NestJS et frontend Next.js en services distincts, emails réels via Brevo).
Référence fonctionnelle : cahier des charges v2.0 (§2.2 « besoin d'en connaître », §4.10
suppléance, Annexe B = journal des décisions) : `docs/Cahier_des_charges_DNPEC_SI.docx`.

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
squelettes non utilisés. **Aucun framework de test automatisé** : les validations se font par
appels API réels sur serveur local (voir les messages de commit existants).

### API (`apps/api/src`)
- Un dossier par module : `<module>.module.ts`, `*.controller.ts` (mince, `@CurrentUser()`),
  `*.service.ts` (toute la logique d'autorisation), `dto/*.dto.ts` (class-validator ;
  `ValidationPipe` global avec `whitelist` + `forbidNonWhitelisted`).
- Guards globaux : `JwtAuthGuard` (tout est authentifié sauf `@Public()`), puis `RolesGuard`
  (`@Roles(...)`, contrôle grossier). L'autorisation fine est dans les services via `CascadeService`.
- Erreurs : exceptions Nest (`ForbiddenException` 403, `ConflictException` 409 pour une transition
  d'état invalide, `NotFoundException` 404), messages en français. `HttpExceptionFilter` ne capte
  que les `HttpException` : une erreur Prisma non traduite (ex. P2002) sort en 500.
- Sélections Prisma explicites via constantes `XXX_SELECT` + `satisfies Prisma.XxxSelect`.
- Rôles (`SystemRole`) : DN, DNA, CHEF_DIVISION, CHEF_SECTION, CHEF_CELLULE, AGENT
  (= Chargé d'Études), ASSISTANT_DIRECTION (rattaché via `supervisorId` à DN/DNA/CHEF_CELLULE),
  ADMIN_SYSTEME, DRH. Rattachement : `divisionId`/`sectionId` OU `celluleId`.
  Seule `Cellule` a un `chefId` ; le chef d'une Division/Section se retrouve par
  `role + divisionId (+ sectionId) + status ACTIF`.
- `CascadeService` : `hasDirectAuthorityOver` (DN/DNA + chef direct ; **jamais sur soi-même**,
  ni sur le titulaire en intérim), `getVisibleUserWhereForLeadershipScope`,
  `isActingFor(actor, userId)` (identité littérale ou intérim), `isMemberOfDivision` (besoin d'en
  connaître GED). L'Assistant hérite de la *visibilité* du superviseur, jamais de son autorité.
- Suppléance : en-tête `X-Interim-For: <titulaireId>` validé par `JwtAuthGuard` → `role`/rattachement
  du titulaire empruntés pour la requête, `id` reste celui du suppléant, `interimForId` renseigné,
  `AuditLog.onBehalfOfId` posé automatiquement (AsyncLocalStorage).
- `AuditService.log({ actorId, action, entityType, entityId, metadata })` écrit via le client
  global — **pas de paramètre de transaction** ; convention actuelle : audit après le commit.
  Détail des événements dans `metadata.event`.
- `NotificationsService.notify(userId, type, title, body, link?, subjectDetail?)` : in-app + email
  synchrones. Tout nouveau `NotificationType` exige une entrée dans `NOTIFICATION_BUTTON_LABELS`.
- `StorageService.save(buffer, name) → { fileKey, sizeBytes }`, `createReadStream`, `delete`.
  Uploads via `FileInterceptor` + `memoryStorage()`, limite 25 Mo.

### Web (`apps/web`)
- `app/(app)/<route>/page.tsx` (client components), `components/<module>/*` (Modal, Drawer,
  List, Card), `lib/api/<module>.ts` (`apiFetch`), `lib/<module>/types.ts`.
- Tokens Tailwind (`ink`, `gold`, `sage`, `clay`, `line`, `text-muted`...) issus de la maquette ;
  navigation dans `components/layout/Sidebar.tsx` ; ouverture profonde via `?id=`.

## Commandes utiles
```bash
pnpm install
pnpm --filter @dnpec/api exec prisma migrate dev --name <nom>   # base LOCALE uniquement
pnpm --filter @dnpec/api typecheck && pnpm --filter @dnpec/web typecheck
pnpm --filter @dnpec/api start:dev
```

## Reste à faire

- **Cloche de notifications in-app** : l'icône de la barre du haut n'est reliée à rien ;
  l'API expose déjà `GET /notifications`, le comptage des non-lues et le marquage lu.
- **Retour à la page visée après reconnexion** : un lien d'email ouvert avec une session
  expirée mène à l'accueil, puis au tableau de bord après connexion — la page visée est perdue.
- **Erreurs de chargement non affichées** sur certaines pages (ex. Réunions : `getMeetings()`
  sans `catch`) — l'erreur ne remonte qu'en console.
- **Lot D** : écrans web de D2 (décisions de réunion) et de D3 (dossier du personnel),
  dont la route `/personnel/:id` utilisée par les emails de notification.
- **Changement de rôle d'un compte existant** (dont l'attribution de DRH à un compte déjà
  actif) : aucun endpoint aujourd'hui ; à concevoir (rattachement propre à chaque rôle,
  unicité des chefs, `Cellule.chefId`, historique de carrière, suppléances en cours).
