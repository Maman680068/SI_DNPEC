# S6 — Jours fériés

**Données** : aucune migration. La table des dates estimées des fêtes religieuses est tenue dans le code
(`socle/jours-feries.service.ts`, `DATES_ESTIMEES`) : 2026 (Lailatoul Qadr 17/03, Korité 20/03, Tabaski
27/05, lendemain de la Tabaski 28/05, Maouloud 25/08). Aucune date publiée n'étant disponible pour 2027, ses
champs restent vides (à saisir). Le lundi de Pâques est **calculé** (algorithme de Pâques, `dimancheDePaques`).

**API** (`api/v1/jours-feries`, droits inchangés : lecture par tous, gestion par l'administrateur et le DRH) :
- `GET ?annee=` : en plus de la liste, `prochain` (date, libellé, délai en jours), `chiffres` (saisis, en
  semaine, en week-end), drapeaux `weekEnd` / `passe` / `prochain` par jour, `religieusesProposees`
  (gestionnaires) et `aRecalculer` ;
- `POST lot` : « Vérifier et ajouter » (fêtes cochées, jamais en double) ;
- `POST fetes-fixes` (existant) : « Préparer [année + 1] » ;
- création, modification, suppression : renvoient `aRecalculer` de l'année ;
- `POST conges/:id/recalculer` : **DRH seul**, un congé approuvé à la fois, `daysCount` remis selon le
  calendrier et `usedDays` du solde ajusté de l'écart, dans une transaction conditionnelle ; audité
  (`LeaveRequest`, `recalcul_jours_feries`, avant / après). Aucun recalcul automatique.
- `aRecalculer` : congés approuvés de l'année dont le nombre de jours enregistré ne correspond plus au
  calendrier ; détail (agent, période, jours avant / après — jamais le type ni le motif) pour le DRH,
  **nombre seul** pour l'administrateur.

**Choix prudent** : la règle de décompte des congés n'est pas changée (jours calendaires moins les fériés).
Un férié tombant un week-end reste donc retiré d'un congé qui le couvre ; il est sans effet sur les délais
d'avis (heures ouvrées). L'écran l'écrit ainsi : « Week-end · sans effet sur les délais ».

**Écran** (`components/leaves/JoursFeries.tsx`) : ‹ année ›, « Préparer [année + 1] », quatre chiffres, liste
groupée par mois (tuile date et jour, badges « Fête fixe » / « Fête religieuse » / week-end, passé grisé,
prochain mis en avant, ⋯ Modifier / Supprimer avec confirmation), vue annuelle (12 mini-calendriers : fixe
en bleu, religieuse en vert, aujourd'hui entouré), bandeau « Vérifier et ajouter », liste des congés à
recalculer.

**Tests** : `tests/e2e/api/s6_jours_feries.js`, `tests/e2e/ui/s6_jours_feries_ui.js`, `ui/n3_metier_ui.js` adapté.
