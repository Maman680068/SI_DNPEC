# SI DNPEC — Système d'information interne

Système d'information interne de la Direction Nationale des Prévisions Économiques et de la
Conjoncture (DNPEC, Ministère de l'Économie, des Finances et du Budget, Guinée). En production
depuis septembre 2026.

- **Domaine A — fonctionnement de la Direction** : tableau de bord par profil, tâches et plan de
  travail, instructions, réunions et décisions, messagerie, courrier et actes numérotés, archives
  (GED), congés, personnel et ressources humaines, formation, stages, logistique, supervision et
  journal d'audit.
- **Domaine B — modélisation et simulation** : référentiel des modèles de la Direction, dépôt et
  contrôle des modèles par paquet, service de calcul Python (lot B1) ; simulations, données et
  rapports à venir (lots B2 et suivants).

## Structure du dépôt

```
apps/
  web/      Interface web — Next.js 15, React 19, Tailwind
  api/      API — NestJS, Prisma 5, PostgreSQL 16
  calcul/   Service de calcul des modèles — Python 3.11, FastAPI, Pyomo, IPOPT (Docker)
tests/e2e/  Suite de bout en bout (appels API réels et Chromium, base locale)
docs/       Conception, exploitation, guides
```

## Démarrage

Prérequis : Node.js 22, pnpm 10, PostgreSQL 16 (base **locale**), Python 3.11.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # puis indiquer une base PostgreSQL locale
pnpm --filter @dnpec/api exec prisma migrate dev
pnpm --filter @dnpec/api typecheck && pnpm --filter @dnpec/web typecheck
bash tests/e2e/run_all.sh                    # suite complète, base locale uniquement
```

## Documentation

- Règles et mécanismes communs : [`docs/Guide_developpeur.md`](docs/Guide_developpeur.md) — à lire avant toute modification
- Exploitation, sauvegardes, mise à jour : [`docs/Exploitation.md`](docs/Exploitation.md)
- Domaine B : [`docs/conception_domaine_B_modeles.md`](docs/conception_domaine_B_modeles.md) et
  [`docs/conception_B1_referentiel_modeles.md`](docs/conception_B1_referentiel_modeles.md)
- Guide d'utilisation : [`docs/Guide_utilisateur_SI_DNPEC.pdf`](docs/Guide_utilisateur_SI_DNPEC.pdf)
- Cahiers des charges : [`docs/Cahier_des_charges_DNPEC_SI.docx`](docs/Cahier_des_charges_DNPEC_SI.docx),
  [`docs/NIMBA_Cahier_des_charges_v2.2.docx`](docs/NIMBA_Cahier_des_charges_v2.2.docx)

## Contribuer

Une branche par travail, puis une pull request vers `main` : l'intégration continue relance la
suite complète, la fusion et les migrations de production sont faites par la responsable du projet.
Les migrations de base sont toujours créées et testées sur une base locale, jamais appliquées à la
production depuis un poste.
