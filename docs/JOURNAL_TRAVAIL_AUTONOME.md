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
| [#17](https://github.com/Maman680068/SI_DNPEC/pull/17) | `feature/conception-domaine-b` | Conception du domaine B (document) | aucune | verte |
| [#18](https://github.com/Maman680068/SI_DNPEC/pull/18) | `feature/revue-securite` | Revue de sécurité | aucune (variable Render `WEB_PROXY_SECRET`) | verte |
| [#19](https://github.com/Maman680068/SI_DNPEC/pull/19) | `feature/exploitation` | Exploitation et reprise après incident | aucune | **verte** (e385ee1, après correction de z_demo_supprimer) |
| [#21](https://github.com/Maman680068/SI_DNPEC/pull/21) | `feature/performance` | Performance, emails par lots et reprise, quota Brevo | aucune (variable `BREVO_QUOTA_JOUR`, non secrète) | **verte** (e903a75) |
| [#20](https://github.com/Maman680068/SI_DNPEC/pull/20) | `feature/formation` | Documentation et formation | aucune | verte |

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

- 2026-10-02 — Chantier 2 : jeu gonflé (300 agents, 20 000 tâches), test de charge à 100 utilisateurs sur bases
  bridées comme Render (0,1 et 0,5 CPU), corrections (tableau de bord borné, N+1 congés et GED, décompte groupé),
  emails par lots avec reprise et quota ; aucune migration (index documentés, non indispensables) ; PR #21.
- 2026-10-02 — PR #19 : CI rouge (z_demo_supprimer, paramètre `audit.verificationNocturne` réécrit par l'API
  décalée d'un an) ; corrigée (e385ee1) et vérifiée en local (c1_setup, x_exploitation, z_demo_creer,
  z_demo_supprimer conformes).

## En cours

- Rien : les six PR (#16 à #21) ont une CI verte sur leur dernier commit (02/10/2026, 06:27 UTC).

## Reste à faire

- Décisions du responsable : fusion dans l'ordre conseillé, offre de base Render `basic-1gb`,
  variable `WEB_PROXY_SECRET`, décisions DB-1 à DB-17 du domaine B.

## Ordre de déploiement conseillé

#16 (N6, migration) → #18 sécurité (`WEB_PROXY_SECRET` sur l'API et le web) → #19 exploitation → #21 performance
(passer la base en `basic-1gb` avant ou avec) → #20 formation → #17 domaine B (document).
Conflits attendus entre #18, #19, #20, #21 : `run_all.sh`, `docs/Guide_developpeur.md`, `supervision.service.ts`,
compteur de services de `n2_securite_ui` (8 après #19 et #21).

## Choix tranchés seul (hors N6, listés dans la PR #16)

- **#18 sécurité** :
  - verrou par IP via secret partagé web → API (sans lui, pas de verrou par IP) ;
  - configurer la 2FA depuis une session exige le mot de passe ;
  - motif médical retiré de la liste des congés (détail tracé) ;
  - « Absence — motif protégé » dans toutes les notifications de congé maladie ;
  - quotas oubli 5/email et 10/IP par heure, inscription 30/IP par heure ;
  - fichiers servis selon une liste de types sûrs ;
  - jeton d'accès valable jusqu'à 15 min après une réinitialisation (sessions révoquées tout de suite) ;
  - démarrage refusé si `JWT_ACCESS_SECRET` fait moins de 16 caractères.
- **#19 exploitation** :
  - seuils 80/95 % réglables par variables ;
  - vérification complète de l'audit la nuit et au démarrage du serveur si elle a plus de 26 h ;
  - sauvegarde des fichiers par téléchargement de l'administrateur (pas de workflow, pas d'accès en plus) ;
  - « Vérifier l'intégrité » après une restauration ;
  - empreinte de la démonstration sans `audit.verificationNocturne`.
- **#20 formation** :
  - workflow de qualité sans aucun nom ;
  - fiches régénérées depuis un fichier de contenu et les captures ;
  - cas pratiques sur les comptes de démonstration.
- **#21 performance** :
  - pas de migration ;
  - tableau de bord à 300 tâches (closes depuis plus de 30 jours masquées) ;
  - congés et GED non paginés ;
  - reprise des emails par le résumé, abandon à 72 h ;
  - quota en mémoire par jour UTC ;
  - cache des chefs avisants limité à la requête ;
  - compteurs suspendus onglet caché ;
  - base `basic-1gb` recommandée, API `starter` maintenue.
