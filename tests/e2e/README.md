# Suite de bout en bout — SI DNPEC

Tests **réels** : l'API NestJS et le frontend Next.js tournent vraiment, sur une base
PostgreSQL **locale**, et sont appelés comme par un navigateur (HTTP) ou pilotés dans
Chromium (Playwright), en format bureau et mobile. Chaque suite vérifie aussi les cas
de refus attendus (403, 409, 400).

**⚠️ La suite VIDE la base avant de la remplir.**
`scripts/garde-locale.sh` refuse de s'exécuter si `DATABASE_URL` ne désigne pas
`localhost` ou `127.0.0.1`. Ne la contournez jamais.

## Lancer la suite

Prérequis :

- Node 22 et pnpm 10 ;
- une base PostgreSQL 16 locale, vide ou jetable ;
- `psql` et `lsof` ;
- `python3` avec `python-docx` (`pip install python-docx`), pour fabriquer des modèles
  Word d'attestation.

```bash
pnpm install --frozen-lockfile
pnpm --filter @dnpec/e2e exec playwright install chromium   # une fois
bash tests/e2e/run_all.sh
```

Environnement :

- `DATABASE_URL` est lue dans l'environnement, sinon dans `apps/api/.env`. Elle doit
  être locale.
- Les autres variables ont des valeurs de test par défaut, en clair : ce ne sont pas
  des secrets. Les emails ne sont **jamais** envoyés (`SMTP_HOST` vide).
- `PW_CHROMIUM` : chemin d'un Chromium déjà installé (facultatif).

Options :

| Variable | Effet |
|---|---|
| `E2E_SANS_BUILD=1` | ne recompile ni l'API ni le web (gain de temps quand rien n'a changé) |
| `E2E_SUITES="d9_logistique d9_reservations"` | ne lance que ces suites (noms de fichier sans `.js` ; `trigger_test` pour le SQL) |
| `E2E_OUT=/chemin` | dossier des résultats (défaut : `tests/e2e/out`, ignoré par git) |

Durée : environ 20 à 30 minutes pour la suite complète.

## Résultats

Chaque suite affiche ses contrôles (`OK` / `KO!`) et se termine par
`Bilan : N conformes, M non conformes`.

`run_all.sh` récapitule tous les bilans dans `out/resume.txt`. Il sort en **erreur** si
un seul contrôle est non conforme, ou si une suite s'arrête sans bilan.

Dans `out/` :

- `logs/` : journaux de l'API et du web ;
- `shots/` : captures d'écran des parcours Chromium ;
- `etat/` : identifiants partagés entre suites.

## Organisation

| Dossier | Contenu |
|---|---|
| `fixtures.js` | Jeu de données : 18 comptes fictifs `<clé>@test.local` (mot de passe de test commun), divisions DPE/DEE, sections SSR/SFP/SE, cellule SAF |
| `lib.js` | Appels HTTP authentifiés (`call`, `upload`, `login`), `check`, `expect`, `bilan` |
| `api/` | Suites API, dans l'ordre de `run_all.sh` : courrier (C1, C2), accès délégués (E1), changement de rôle (E2), décisions (D2), dossier du personnel (D3), cloche (F), stagiaires (D6), logistique et réservations (D9) |
| `ui/` | Parcours Chromium (bureau + mobile) des mêmes modules |
| `sql/` | Triggers d'intégrité du registre, en SQL direct, dans une transaction annulée |
| `scripts/` | Démarrage de l'API (port 3000, et 3001 avec l'horloge avancée d'un an pour le changement d'année), du web (port 3100), garde « base locale » |

Les suites `i_liens` (API) et `i_liens_ui` (Chromium) passent après toutes les autres :
elles vérifient que chaque lien produit par l'API (code, notifications enregistrées,
emails journalisés) mène à une page web existante qui lit ses paramètres, que les anciens
formats (`apps/web/anciens-liens.json`) sont redirigés, et la page 404 en français.

Les phases `z_demo_*` (données de démonstration, `apps/api/prisma/demo.ts`) passent en
dernier : elles repartent chacune d'une base neuve (avec puis sans le jeu de test).

Les suites s'enchaînent : `c1_setup` crée les registres utilisés ensuite, et plusieurs
suites C1 réutilisent les courriers créés par `c1_arrivees` et `c1_actes`. Pour lancer
une suite seule après une relance complète, utilisez `E2E_SUITES` : la base garde les
données de la relance précédente.

## Intégration continue

`.github/workflows/ci.yml` lance exactement cette suite sur chaque pull request, avec
une base PostgreSQL jetable créée par GitHub. Elle n'utilise aucun secret et ne touche
jamais la production. Les résultats (résumé, journaux, captures) sont téléchargeables
dans l'onglet **Actions**, artefact `resultats-e2e`.

## Écrire une nouvelle suite

1. Créez `api/<lot>_<sujet>.js` (ou `ui/...`) sur le modèle d'une suite existante.
2. Utilisez `require('../lib')` et `require('../config')` : aucun chemin écrit en dur.
3. Terminez par `bilan()` et `process.exitCode`.
4. Ajoutez une ligne `lancer "..." api/<fichier>.js` dans `run_all.sh`.
5. Testez toujours le cas autorisé **et** les refus attendus.
