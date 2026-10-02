# Sécurité des dépendances

Contrôle : `pnpm audit` à la racine du dépôt. À refaire **chaque trimestre** et avant chaque
mise en production importante (voir `docs/Exploitation.md`, § 7).

## État au 2 octobre 2026 (revue de sécurité)

`pnpm audit` avant correction : 15 failles (8 hautes, 7 moyennes), toutes corrigées par des montées
de **correctif** (aucun changement de version majeure). Après : **aucune faille connue**.

| Paquet | Faille | Avant | Après | Comment |
|---|---|---|---|---|
| `nodemailer` (API) | 2 hautes, 3 moyennes : déni de service du parseur d'adresses, enveloppe malformée, cache DNS | 10.0.0 | 10.0.9+ | version déclarée `^10.0.9` dans `apps/api/package.json` |
| `brace-expansion` (eslint, typescript-eslint, exceljs) | 6 hautes, 3 moyennes : déni de service (récursion, expansion quadratique) | 1.1.18 / 2.1.4 / 5.0.9 | 1.1.21+ / 2.1.7+ / 5.0.12+ | **surcharges pnpm** par branche majeure (`brace-expansion@^1`, `@^2`, `@^5`) |
| `fast-uri` (outil de compilation Nest) | moyenne : normalisation de l'hôte | 3.1.7 | 3.1.8+ | **surcharge pnpm** `fast-uri@^3` |

Exposition réelle : `brace-expansion` et `fast-uri` ne servent qu'aux outils de développement et à
l'archivage interne d'exceljs (aucune donnée d'utilisateur) ; `nodemailer` reçoit des adresses de
comptes déjà validées. Risque faible, corrigé quand même. Voir aussi `docs/Revue_securite_2026-10.md`.

## État au 25 septembre 2026 (lot G)

`pnpm audit` : **aucune faille connue** (« No known vulnerabilities found »).

Corrections appliquées (suite de bout en bout complète repassée ensuite) :

| Paquet | Faille | Avant | Après | Comment |
|---|---|---|---|---|
| `next` (web) | — (mise à jour de maintenance) | 15.5.25 | 15.5.26 | version déclarée `^15.5.26` dans `apps/web/package.json` |
| `postcss` (via `next`) | 2 hautes, 3 moyennes : lecture de fichier arbitraire, traversée de chemin par carte source, XSS par `</style>` non échappé | 8.4.31 | 8.5.28 | Next 15.5.26 embarque toujours 8.4.31 : **surcharge pnpm** `next>postcss` dans `package.json` |
| `uuid` (via `exceljs`) | moyenne : contrôle de bornes absent dans v3/v5/v6 avec un tampon fourni | 8.3.2 | 11.1.1 | exceljs 4.4.0 (dernière version publiée) exige `uuid ^8.3.0` : **surcharge pnpm** `exceljs>uuid`. exceljs n'utilise que `v4`, dont l'API est identique ; export Excel du registre du courrier vérifié |

### Exposition réelle avant correction (pour mémoire)
- **postcss** ne sert qu'à la **compilation** des feuilles de style de Next, à partir des
  fichiers du dépôt. Aucune donnée d'utilisateur n'y passe : risque réel faible, corrigé quand
  même.
- **uuid** : la fonction fautive (v3/v5/v6 avec tampon) n'est jamais appelée. Risque nul,
  corrigé quand même.

## Surcharges à surveiller

Les surcharges (`pnpm.overrides` dans `package.json`) forcent une version plus récente que
celle demandée par le paquet parent. À chaque montée de version de `next`, `exceljs`, `eslint`,
`typescript-eslint` ou `@nestjs/cli` :
1. vérifier si le parent embarque enfin une version corrigée ;
2. si oui, retirer la surcharge correspondante ;
3. relancer `pnpm install`, `pnpm audit` et la suite de bout en bout (`tests/e2e/run_all.sh`).

**Prochaine réévaluation : 31 décembre 2026.**
