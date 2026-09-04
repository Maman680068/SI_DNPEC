# @dnpec/web

Frontend web du SI DNPEC — **Next.js 15 (App Router) + TypeScript + Tailwind CSS**.

## Authentification

- Access token : gardé en mémoire uniquement (contexte React `AuthProvider`), jamais
  persisté côté client. Perdu au rechargement de page, régénéré silencieusement via
  `POST /api/auth/refresh` au montage de l'application.
- Refresh token : jamais exposé au JavaScript client. Posé en cookie `httpOnly` /
  `Secure` (en production) / `SameSite=Strict` (`path=/`, nécessaire pour que
  `middleware.ts` puisse vérifier sa présence sur les requêtes de page) par les Route
  Handlers `app/api/auth/*` qui interceptent la réponse de l'API réelle avant de la
  transmettre au navigateur.
- Trois routes upstream renvoient un `{accessToken, refreshToken}` complet
  (`POST /auth/login`, `POST /auth/login/2fa`, `POST /auth/2fa/enable`) : les trois
  passent obligatoirement par un Route Handler. Tout le reste (`2fa/setup`, `tasks/*`,
  `me`…) est appelé directement par le navigateur avec `Authorization: Bearer` depuis
  la mémoire.
- `middleware.ts` ne fait qu'une redirection de confort selon la présence du cookie de
  refresh — l'autorisation réelle reste entièrement côté API NestJS.

## Développement

```bash
cp .env.example .env.local   # API_BASE_URL / NEXT_PUBLIC_API_BASE_URL
pnpm --filter @dnpec/web dev
```

Écrans de référence : `docs/maquette_dnpec_finale.html`. Tokens de design :
`docs/architecture-proposition.md` §3 (repris dans `tailwind.config.ts`).
