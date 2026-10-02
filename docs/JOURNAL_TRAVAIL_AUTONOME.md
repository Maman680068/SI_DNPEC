# Journal du travail autonome — octobre 2026

Tenu sur la branche `journal/travail` (aucune PR : simple journal). En cas d'interruption,
reprendre à la première ligne « En cours » ou « Reste à faire ».

Règles rappelées : aucune fusion, aucun workflow sur la production, aucune modification de la
branche de production ni de Render ; une branche et une PR par chantier, basées sur
`feature/socle-nimba-n6` ; schéma inchangé sauf nécessité (alors une seule migration additive dans
`feature/consolidation-post-socle`) ; page de connexion, page d'accueil et identité visuelle intactes.

## PR ouvertes

| PR | Branche | Objet | Migration | CI |
|---|---|---|---|---|
| [#16](https://github.com/Maman680068/SI_DNPEC/pull/16) | `feature/socle-nimba-n6` | Socle NIMBA N6 | `20261003080000_socle_nimba_n6` | **verte** (f8f0b38) |
| [#17](https://github.com/Maman680068/SI_DNPEC/pull/17) | `feature/conception-domaine-b` | Conception du domaine B (document) | aucune | en cours |
| [#18](https://github.com/Maman680068/SI_DNPEC/pull/18) | `feature/revue-securite` | Revue de sécurité | aucune (variable Render `WEB_PROXY_SECRET`) | en cours |
| [#19](https://github.com/Maman680068/SI_DNPEC/pull/19) | `feature/exploitation` | Exploitation et reprise après incident | aucune | en cours |
| [#20](https://github.com/Maman680068/SI_DNPEC/pull/20) | `feature/formation` | Documentation et formation | aucune | en cours |

## Fait

- 2026-10-02 — N6 : suite complète locale (98 suites), captures avant/après, guide PDF, push,
  PR #16, compte rendu de mise en production (`docs/Compte_rendu_mise_en_production_N6.md`).
- 2026-10-02 03:40 — CI de la PR #16 verte sur le dernier commit (f8f0b38), PR fusionnable.

- 2026-10-02 — Chantier 5 : `docs/conception_domaine_B_modeles.md`, PR #17.
- 2026-10-02 — Chantier 1 : revue de sécurité, 25 constats (3 hauts, 6 moyens corrigés), suites s1_routes et
  s2_securite, suite complète 100 suites ; PR #18.
- 2026-10-02 — Chantier 3 : supervision disque/base/audit de nuit, sauvegarde ZIP des fichiers, plan de reprise
  chronométré ; PR #19.
- 2026-10-02 — Chantier 4 : fiches par profil, support 45 min, annonce, liste de démarrage, rapport de qualité ;
  PR #20.

## En cours

- Chantier 2 — performance et robustesse (`feature/performance`) : base de volume locale `dnpec_volume`
  (20 000 tâches, 100 000 notifications, 50 000 lignes d'audit) prête.

## Reste à faire

1. Chantier 2 — performance (test de charge, N+1, index, pagination, emails par lots, quota Brevo).
2. Suivre la CI des PR #17 à #21.
3. Récapitulatif final.

## Choix tranchés seul (hors N6, listés dans la PR #16)

_(à compléter au fil des chantiers)_
