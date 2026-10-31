# S8 — Organisation (trois onglets)

## Données (migration additive `20261102080000_rattachement_cellules`)

Deux colonnes sur `cellules` : `rattachement` ('DN' | 'DNA') et `nature` ('CELLULE' | 'SERVICE' | 'INSTANCE'),
valeurs fermées en base (CHECK). Valeurs initiales par code : CTSCM et CNC → DN ; SAF, RH et CSID → DNA ; toute
autre cellule → DN ; CNC = instance, SAF = service. Le type « Instance » existait déjà dans le socle
(`TypeUnite.INSTANCE`) mais le CNC y est une cellule : la nature affichée est portée par la colonne `nature`
(sans toucher aux unités du socle). Le seed pose les mêmes valeurs à la création. Retour arrière
`prisma/retour-arriere/rattachement_cellules_down.sql` (avant `demandes_reunion_down.sql`), phase 39r ; les
phases de reprise antérieures ignorent ces deux colonnes dans leurs empreintes (comme `tasks.numero`).

## API

`GET api/v1/organisation` (tout compte connecté, stagiaires exclus) : direction (DN, DNA, « Chargés d'études
auprès du DN » = agents rattachés directement à la Direction, case calculée, pas une unité), divisions
(chef et suppléance en cours, agents, en congé aujourd'hui — nombre seul —, sections actives, sections sans
chef, agents sans section, jauge chefs désignés / postes de chef, sections avec chef, agents et état Complète /
Chef à désigner / Sans agent), cellules (nature, rattachement, responsable, équipe, en congé, rôles tenus par
ses agents : Rôle DRH, Logistique, Courrier, Administration du SI ; « membres d'autres institutions » pour une
instance sans agent), unités sans responsable ; droits. `PATCH api/v1/organisation/cellules/:id`
(`rattachement`, `nature`) : administrateur et DRH, audité.

## Droits (inchangés)

Tout le monde consulte. Structure (créer, modifier, suspendre, supprimer) et désignation des chefs :
administrateur, par les routes existantes et la procédure de changement de rôle (aperçu, motif, audit) ;
rattachement et nature d'une cellule : administrateur et DRH.

## Écrans (`app/(app)/organisation/page.tsx`)

- **Organigramme** (`SchemaOrganigramme.tsx`) : DN en haut, DNA dessous ; cellules SUR LE CÔTÉ de l'axe, reliées
  en pointillés, cases plus petites, plus pâles, en pointillés ; case calculée « auprès du DN » ; divisions en
  cases principales (liseré bleu nuit, ombre) sur la barre en trait plein, sections empilées dessous ; bord rouge
  sans responsable ; pastille du nombre d'agents ; fiche au clic (chef, suppléant, agents dont en congé,
  sections sans chef, « Voir les agents », « Désigner un chef » / « Changer le chef » si droit) ; filtres
  Toutes / Sans responsable / Sans agent ; bascule Schéma | Liste (l'organigramme du socle) ; « Imprimer / PDF »
  (A4 paysage) ; zoom ; sur téléphone, liste d'office.
- **Divisions & Sections** (`OngletDivisions.tsx`) : liste des divisions (filtres Toutes / À compléter /
  Suspendues, « Nouvelle division ») et fiche (chef et suppléance, « Changer le chef », « Voir les agents »,
  quatre chiffres, tableau des sections avec « Désigner un chef », Modifier, ⋯ Suspendre / Supprimer,
  « Nouvelle section », alerte « agents sans section » avec « Les affecter »).
- **Cellules** (`OngletCellules.tsx`) : groupes « Rattachées au DN » / « Rattachées à la DNA », note « structures
  d'appui, à côté des divisions et non au-dessus » ; carte par cellule (sigle en cadre pointillé, nom, nature,
  responsable ou bandeau rouge « Désigner », équipe, en congé, rôles) ; filtres ; « Nouvelle cellule ou
  instance » ; menu ⋯ : rattachement DN / DNA, nature, Retirer le chef, Suspendre, Supprimer.
- Anciens panneaux `DivisionsPanel` et `CellulesPanel` remplacés.

**Tests** : `tests/e2e/api/s8_organisation.js`, `tests/e2e/ui/s8_organisation_ui.js`, `api/rattachement_cellules_reprise.js` (39r).
