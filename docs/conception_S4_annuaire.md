# S4 — Annuaire repensé

**Données** : aucune migration ; pas de champ « bureau » pour l'instant. L'état du jour est **calculé à la
lecture** à partir de l'existant, visible de tous, **sans motif ni type de congé** :
- « En congé » : demande de congé **approuvée** couvrant aujourd'hui (un congé maladie n'apparaît que
  comme « En congé ») ;
- « En mission » : ordre de mission couvrant aujourd'hui **dont l'acte est signé** (choix prudent : un
  ordre en préparation ne dit pas que la personne est partie) ;
- « Intérim » : suppléance active non révoquée, badge sur le suppléant « supplée X ».
Pas de « Présent » (aucun pointage) : « Disponible » ou rien ; compteur « N disponibles aujourd'hui »
(personnel actif moins les personnes en congé ou en mission).

**API** (`users/annuaire.*`) : `GET api/v1/annuaire?q=` → `{ total, disponibles, personnes, unites, resultats }` ;
unités : Direction (DN, DNA, personnes sans unité), divisions (sections comprises), cellules — chef ou DN et
DNA en tête, nombre d'agents ; recherche par le moteur de S2 (nom, fonction, unité, sigle, sans accents) ;
`GET api/v1/annuaire/:id` → fiche (unité complète, « rend compte à » = `chefsLesPlusProches`, suppléant en
cours, équipe, `peutAssigner` par `CascadeService.hasDirectAuthorityOver`). Ni email ni téléphone.

**Droits** : inchangés — tout compte connecté, stagiaires exclus (comme l'annuaire actuel).

**Écran** (`app/(app)/annuaire/page.tsx`) : vue « Par unité » par défaut (bloc par unité : sigle, chef,
nombre d'agents ; chef en tête, fond doré et badge ; cartes : initiales, nom, fonction et section, état du
jour, bouton Message) ; colonne des sigles (unités non vides ; unités vides repliées sous « Unités sans agent
(n) ») ; fiche à droite au clic (fenêtre sous 1280 px) ; vue « Liste » conservée ; téléphone : sigles en
boutons qui défilent, cartes empilées. Pas d'organigramme ici (il est dans Organisation, S8). L'ancienne
fiche `PersonDetailModal` est remplacée (son « Assigner une tâche » est repris, droit donné par l'API).

**Tests** : `tests/e2e/api/s4_annuaire.js`, `tests/e2e/ui/u_annuaire_suggestions_ui.js` (réécrit).
