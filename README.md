# SI DNPEC — Système d'Information Interne

Système d'information interne de la Direction Nationale des Prévisions
Économiques et de la Conjoncture (DNPEC) : gestion des tâches, communication
interne et archivage électronique des documents.

## Documentation

- Cahier des charges : [`docs/Cahier_des_charges_DNPEC_SI.docx`](docs/Cahier_des_charges_DNPEC_SI.docx)
- Maquette de référence : [`docs/maquette_dnpec_finale.html`](docs/maquette_dnpec_finale.html)
- Proposition d'architecture (structure + tokens de design) : [`docs/architecture-proposition.md`](docs/architecture-proposition.md)

## Structure du monorepo

```
apps/
  web/      Frontend Next.js + Tailwind CSS
  api/      Backend NestJS + Prisma
  mobile/   Application React Native (Expo)
packages/
  ui/       Design system partagé (tokens + composants)
  types/    Types/DTOs partagés
  config/   Configuration partagée (TypeScript, ESLint, Prettier)
  i18n/     Textes externalisés (FR au lancement)
infra/      Docker, Nginx, Meilisearch
```

## État du projet

Scaffold initial uniquement (dossiers + configuration d'outillage). Aucune
fonctionnalité applicative n'est encore développée. Prochaine étape : validation
du schéma de base de données (`apps/api/prisma/schema.prisma`).

## Démarrage

```bash
pnpm install
pnpm dev      # une fois les apps initialisées
pnpm lint
pnpm typecheck
```

Prérequis : Node.js 22+, pnpm 10+.
