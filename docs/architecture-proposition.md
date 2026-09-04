# DNPEC SI — Proposition d'architecture (à valider)

Ce document propose une structure de projet et des tokens de design, sur la base du
cahier des charges (`docs/Cahier_des_charges_DNPEC_SI.docx`, §7.7 et §5) et de la
maquette de référence (`docs/maquette_dnpec_finale.html`).

**Aucun code applicatif n'a été écrit.** Ce document sert de base de discussion avant
le démarrage du développement.

---

## 1. Choix d'organisation : monorepo pnpm + Turborepo

Le cahier des charges (§7.7) impose TypeScript de bout en bout (Next.js, NestJS,
React Native/Expo) pour permettre à la CSID de reprendre le projet avec une seule
stack. Un monorepo est donc recommandé pour :
- partager les types/DTOs entre `web`, `api` et `mobile` (ex. statuts de tâche,
  rôles, enums de confidentialité) ;
- partager le design system / tokens entre `web` et `mobile` ;
- un seul pipeline CI/CD (GitHub Actions, §7.7) avec builds incrémentaux.

**Outils proposés :** `pnpm` (workspaces) + `Turborepo` (cache de build, exécution
parallèle des tâches lint/test/build par package).

Alternative plus simple si on préfère éviter Turborepo au démarrage : pnpm workspaces
seul, sans cache de build (à discuter — Turborepo apporte peu de complexité en plus).

---

## 2. Structure de dossiers proposée

```
si_dnpec/
├── apps/
│   ├── web/                     # Frontend Next.js (App Router) + Tailwind CSS
│   │   ├── app/                 # Routes (login, dashboard, tâches, communication...)
│   │   ├── components/          # Composants spécifiques au web
│   │   ├── lib/                 # Client API, hooks, helpers front
│   │   └── public/
│   │
│   ├── api/                     # Backend NestJS (API REST + WebSocket)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/            # JWT + TOTP 2FA (RF-SEC-02/03)
│   │   │   │   ├── users/           # Comptes, rôles, rattachement Division/Section
│   │   │   │   ├── org/             # Divisions, Sections, hiérarchie (§2)
│   │   │   │   ├── tasks/           # Module Tâches (RF-TAC-*)
│   │   │   │   ├── communication/   # Messagerie, annonces (RF-COM-*)
│   │   │   │   ├── documents/       # GED / archivage (RF-GED-*)
│   │   │   │   ├── leaves/          # Congés et absences (RF-CNG-*)
│   │   │   │   ├── directory/       # Annuaire du personnel (RF-CPL-02)
│   │   │   │   ├── meetings/        # Calendrier de réunions (RF-CPL-03)
│   │   │   │   ├── polls/           # Sondages (RF-CPL-04)
│   │   │   │   ├── suggestions/     # Boîte à suggestions (RF-CPL-05)
│   │   │   │   ├── notifications/   # in-app + email + SMS
│   │   │   │   ├── audit/           # Journal d'audit (RF-SEC-04)
│   │   │   │   └── search/          # Intégration Meilisearch
│   │   │   ├── common/          # Guards, decorators (rôles, cascade hiérarchique)
│   │   │   └── main.ts
│   │   └── prisma/
│   │       ├── schema.prisma    # Modèle de données (users, org, tasks, documents...)
│   │       └── migrations/
│   │
│   └── mobile/                  # React Native (Expo) — Vague 2, mode hors-ligne (SQLite)
│       ├── app/
│       └── src/
│
├── packages/
│   ├── ui/                      # Design system partagé (web + mobile à terme)
│   │   ├── tokens/               # Couleurs, typographies, espacements (voir §3)
│   │   └── components/           # Composants shadcn/ui personnalisés
│   ├── types/                    # Types/DTOs partagés (Role, TaskStatus, Confidentialité...)
│   ├── config/                   # tsconfig, eslint, prettier partagés
│   └── i18n/                     # Textes externalisés (FR au lancement, prêt pour EN — §7.4)
│
├── infra/
│   ├── docker/                   # Dockerfiles (api, web), docker-compose.yml (dev)
│   │   └── docker-compose.render.yml  # config proche de l'hébergement Render (§7.8)
│   ├── nginx/                    # reverse proxy (hébergement définitif, §7.2)
│   └── meilisearch/               # config recherche full-text
│
├── docs/
│   ├── Cahier_des_charges_DNPEC_SI.docx
│   ├── maquette_dnpec_finale.html
│   └── architecture-proposition.md
│
├── .github/
│   └── workflows/                # CI/CD (lint, test, build, deploy Render)
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

### Points d'attention à valider avec vous

1. **Mobile (`apps/mobile`)** : le cahier des charges classe l'app mobile dans le
   périmètre global, mais sans la placer explicitement en MVP (Vague 1). Je propose
   de créer le dossier dès maintenant (structure vide) mais de ne développer qu'après
   le MVP web, sauf indication contraire.
2. **Prisma** : schéma placé dans `apps/api/prisma` (couplé au backend) plutôt que
   dans un package séparé — plus simple pour une seule API consommatrice. À confirmer.
3. **Recherche (Meilisearch) et OCR (Tesseract)** : prévus comme services Docker
   séparés dans `infra/`, appelés depuis le module `search` de l'API. Ils correspondent
   aux exigences SHOULD (RF-GED-06), donc Vague 2 — la structure est prête mais vide au
   départ.
4. **Nommage racine** : le dépôt s'appelle `SI_DNPEC` ; je garde ce nom, dites-moi si
   vous préférez un autre nom de package racine (`@dnpec/*` par exemple pour les
   packages internes).

---

## 3. Tokens de design (extraits de la maquette)

La maquette (`docs/maquette_dnpec_finale.html`) définit déjà une charte cohérente,
inspirée du drapeau guinéen (rouge/jaune/vert). Voici les tokens tels qu'ils
apparaissent dans `:root`, à reprendre tels quels comme base du design system
(`packages/ui/tokens`), en variables CSS **et** en extension Tailwind.

### 3.1 Couleurs

| Token maquette   | Valeur    | Usage observé dans la maquette                              |
|------------------|-----------|---------------------------------------------------------------|
| `--ink`          | `#1B2A6B` | Couleur de marque principale (sidebar active, boutons primaires, emblème) |
| `--ink-2`        | `#142057` | Hover du bouton primaire (ink assombri)                        |
| `--accent`       | `#1B2A6B` | Alias sémantique de `--ink` (liens, focus, tags de division)  |
| `--accent-soft`  | `#E7E9F5` | Fond des tags "division", item de nav actif                   |
| `--gold`         | `#F0B429` | Accent secondaire (bouton "Nouvelle tâche", avatar, jalon "en cours") |
| `--gold-soft`    | `#FDF1D6` | Fond note OTP/2FA                                              |
| `--sage`         | `#1C8B4B` | Succès / validé / terminé (vert drapeau)                       |
| `--sage-soft`    | `#E1F3E7` | Fond badges liés au succès                                     |
| `--clay`         | `#CE1126` | Urgent / retard / erreur (rouge drapeau)                        |
| `--clay-soft`    | `#FBE3E5` | Fond tags "Confidentiel", badges de retard                     |
| `--green-flag`   | `#1C8B4B` | Bande drapeau (identique à `--sage`)                            |
| `--red-flag`     | `#CE1126` | Bande drapeau (identique à `--clay`)                            |
| `--bg`           | `#F5F6FA` | Fond de page                                                    |
| `--surface`      | `#FFFFFF` | Fond des cartes, sidebar, topbar                                |
| `--line`         | `#E2E4EE` | Bordures, séparateurs                                           |
| `--text`         | `#1C2233` | Texte principal                                                 |
| `--text-muted`   | `#5C6270` | Texte secondaire                                                |
| `--text-faint`   | `#9298A8` | Texte tertiaire / placeholders                                   |

La bande tricolore (`.flag-stripe` : rouge / jaune / vert) est un motif d'identité
visuelle à conserver (rappel du drapeau guinéen), affiché en haut de l'écran de
connexion et du shell applicatif.

### 3.2 Typographies

| Rôle                          | Police       | Graisses utilisées    |
|-------------------------------|--------------|------------------------|
| Titres (`h1`, `h2`, `h3`)     | Montserrat   | 600, 700, 800          |
| Valeurs KPI (`.kpi .val`)     | Montserrat   | 800                    |
| Corps de texte / UI           | Inter        | 400, 500, 600, 700     |

(Correction appliquée dans la maquette : les valeurs KPI utilisent désormais
Montserrat 800, au lieu de `Space Grotesk` qui n'était pas importée.)

### 3.3 Proposition de mapping Tailwind (à valider, non implémenté)

```ts
// packages/ui/tokens/colors.ts (proposition — pas encore créé)
export const colors = {
  ink: { DEFAULT: '#1B2A6B', dark: '#142057' },
  gold: { DEFAULT: '#F0B429', soft: '#FDF1D6' },
  sage: { DEFAULT: '#1C8B4B', soft: '#E1F3E7' },   // succès / vert drapeau
  clay: { DEFAULT: '#CE1126', soft: '#FBE3E5' },   // urgent / rouge drapeau
  accent: { DEFAULT: '#1B2A6B', soft: '#E7E9F5' },
  surface: '#FFFFFF',
  bg: '#F5F6FA',
  line: '#E2E4EE',
  text: { DEFAULT: '#1C2233', muted: '#5C6270', faint: '#9298A8' },
}

// packages/ui/tokens/fonts.ts (proposition)
export const fontFamily = {
  heading: ['Montserrat', 'sans-serif'],
  sans: ['Inter', 'sans-serif'],
}
```

Ces tokens seraient exposés :
- en **variables CSS** (`:root { --ink: ... }`) pour un usage direct et pour le mode
  sombre éventuel (non demandé au cahier des charges, mais l'architecture n'empêche
  rien) ;
- en **préréglage Tailwind** (`tailwind.config` étendu depuis `packages/ui`) partagé
  par `apps/web` et, si besoin, `apps/mobile` via NativeWind.

---

## 4. Prochaines étapes proposées

1. Valider ou ajuster la structure de dossiers ci-dessus (§2).
2. Trancher l'incohérence Space Grotesk (§3.2).
3. Une fois validé : initialiser le monorepo (pnpm + Turborepo), scaffolder
   `apps/web` (Next.js) et `apps/api` (NestJS) vides, poser les tokens dans
   `packages/ui`, puis attaquer le MVP dans l'ordre du §5.7 du cahier des charges
   (Tâches → Communication → Archivage → Congés → Sécurité).
