# Sécurité des dépendances

Contrôle : `pnpm audit` à la racine du dépôt. À refaire **chaque trimestre** et avant chaque
mise en production importante (voir `docs/Exploitation.md`, § 7).

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
celle demandée par le paquet parent. À chaque montée de version de `next` ou `exceljs` :
1. vérifier si le parent embarque enfin une version corrigée ;
2. si oui, retirer la surcharge correspondante ;
3. relancer `pnpm install`, `pnpm audit` et la suite de bout en bout (`tests/e2e/run_all.sh`).

**Prochaine réévaluation : 31 décembre 2026.**
