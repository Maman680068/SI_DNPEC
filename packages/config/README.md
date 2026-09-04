# @dnpec/config

Configurations partagées par tous les `apps/*` et `packages/*` du monorepo :

- `typescript/base.json` — configuration TypeScript de base (étendue par chaque package/app).
- `eslint/base.js` — configuration ESLint (flat config) de base.
- `prettier/index.js` — configuration Prettier de base.

Aucune logique applicative ici : uniquement des réglages d'outillage.
