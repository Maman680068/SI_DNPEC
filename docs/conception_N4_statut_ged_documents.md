# Conception N4 — Statut de diffusion, GED et documents générés

Lot N4 du socle NIMBA (cahier NIMBA v2.2 : Partie 0 §7.1–7.4 et §8, SIG-RF-GED-01 à 08,
SIG-RF-DOC-01 à 07 ; périmètre fixé par la Direction : points 12 à 14). Livré après N3, dans sa
propre pull request. **Hors N4** : durées de conservation, proposition d'élimination, OCR (GED-06/09),
activités du plan de travail (N5), bulletins de paie (D5).

## 1. Statut de diffusion commun (§7.1)

Trois statuts, un seul vocabulaire, portés aujourd'hui par les documents de la GED et prévus pour les
simulations et rapports du domaine B : **Brouillon** (par défaut, usage interne, non citable) →
**Validé** (vérifié par le responsable métier) → **Diffusable** (autorisé pour un usage hors de la
Direction).

| Transition | Qui | Conditions |
|---|---|---|
| Brouillon → Validé | chef de l'unité productrice (chef de division ; chef de cellule pour un document d'une cellule rattachée à la Direction : SAF, RH, CSID, CTSCM, CNC), DN, DNA en recours | document marqué « Final », métadonnées complètes |
| Validé → Diffusable | DN, DNA | — |
| Retrait (Diffusable → Validé, Validé → Brouillon) | qui peut faire la transition inverse | motif obligatoire ; le document reste consultable en interne |

- Chaque changement est journalisé dans `changements_statut` (objet, de, vers, motif, auteur, date),
  table générique réutilisable par le domaine B, et tracé à l'audit.
- Une **nouvelle version** d'un document Validé ou Diffusable le ramène à Brouillon (journalisé,
  motif « nouvelle version »).
- Publication dans l'espace DNPEC (inchangée) et statut de diffusion sont indépendants.
- Routes : `POST /api/v1/documents/:id/statut { vers, motif? }`, `GET /api/v1/documents/:id/statut`
  (historique). Le document renvoie `statutDiffusion` et `droits.statut { valider, rendreDiffusable, retirer }`.

## 2. Service d'export unique (mention du statut)

`socle/exports.service.ts` : **tout fichier qui sort d'un objet porteur d'un statut** passe par lui.

- PDF : bandeau en haut de chaque page (« BROUILLON — usage interne, non citable », « VALIDÉ — usage
  interne », « DIFFUSABLE ») ; Word (.docx) : paragraphe d'en-tête inséré en tête du document ;
  autres formats : statut ajouté au nom du fichier. En-tête HTTP `X-Statut-Diffusion` dans tous les cas.
- Branché sur : téléchargement d'une version de la GED, documents générés (§4).
- Les exports de listes existants (tâches, registre du courrier, inventaire) ne portent pas d'objet à
  statut : inchangés.

## 3. GED : métadonnées obligatoires et liens (§8, GED-07/08)

- Nouvelles métadonnées : **type** (étude, rapport, note technique, procès-verbal, acte, RPEF, note
  de conjoncture, autre), **date du document**, **période couverte** (début, fin). L'unité productrice
  reste la division ; l'auteur, le déposant. Obligatoires au dépôt (400 sinon).
- Documents existants : type repris de la catégorie, date = date de dépôt, période à compléter ; un
  document incomplet ne peut pas être Validé (409 « métadonnées à compléter »).
- **Lien vers l'objet d'origine** : tâche (existant) ou réunion (nouveau) ; l'activité viendra avec le
  plan de travail (N5). Le lien n'affiche le titre de l'objet que si le lecteur peut le voir.
- **Dépôt direct** : bouton « Déposer un document » dans la fiche d'une tâche et d'une réunion
  (formulaire de la GED prérempli avec le lien et la période).

## 4. Documents générés (SIG-RF-DOC)

Moteur `generateur/` : un modèle de page commun, rendu à l'identique en **PDF** (aperçu fidèle à
l'écran = le même PDF) et en **Word** (.docx), avec l'en-tête **République de Guinée — Travail,
Justice, Solidarité / Ministère de l'Économie, des Finances et du Budget / DNPEC**, numéro, lieu et
date, bloc de signature.

| Document | Qui le produit | Données (sans ressaisie) | Acte |
|---|---|---|---|
| Attestation de travail | DRH | compte, agent (matricule, fonction, unité), dossier (grade, prise de service) | oui, registre d'actes de la Direction (signature DN/DNA) |
| Ordre de mission | chef direct ou DN/DNA | ordre de mission enregistré (agent, objet, destination, dates, transport, frais) | oui |
| Rapport d'activité | chacun pour son périmètre (agent : soi ; chef : son unité ; DN/DNA : Direction) | tâches de la période et du périmètre, calculées | non |
| Attestation de stage | DRH (existant) | stage | oui (existant) — mise en page standard désormais produite par le moteur, PDF et Word |

- Actions depuis l'aperçu : **Télécharger PDF**, **Télécharger Word**, **Déposer en GED** (document
  Brouillon lié à l'objet), **Transmettre** (message direct avec le PDF en pièce jointe),
  **Préparer l'acte** (module Courrier, comme l'attestation de stage).
- Avant signature de l'acte : mention « PROJET — non signé ». Après : numéro et signataire.
- **Duplicata** : chaque édition d'un document signé est enregistrée (`documents_generes`) ; toute
  édition après la première porte « DUPLICATA » et est journalisée avec l'identité de qui l'imprime.
- **Montant en toutes lettres** (`socle/montant-en-lettres.ts`) : accords du français (« cinq cent
  mille », « quatre-vingts mille », « quatre-vingt-un mille », « deux cents francs »), utilisé pour les
  frais d'un ordre de mission (et la paie D5 plus tard).
- Écran « Documents générés » (menu Personnel) : choix du document, formulaire limité aux choix
  (agent, période, ordre de mission), aperçu, actions ; les listes de choix et droits viennent de l'API.

## Modèle de données (migration `socle_nimba_n4`, additive)

- enum `statut_diffusion` (BROUILLON, VALIDE, DIFFUSABLE), enum `type_document`.
- `documents` : `statutDiffusion` (défaut BROUILLON), `typeDocument`, `dateDocument`,
  `periodeDebut`, `periodeFin`, `sourceMeetingId`.
- `changements_statut` : `objetType`, `objetId`, `de`, `vers`, `motif`, `parId`, `le`.
- `ordres_mission` : agent, objet, destination, dates, transport, frais (montant), créateur, acte lié.
- `documents_generes` : type, objet, acte, édition n°, `parId`, `le`.

## Reprise, retour arrière

- Reprise par la migration : type repris de la catégorie, date du document = date de dépôt, statut
  Brouillon ; documents déjà publiés dans l'espace DNPEC → **Validé** (journalisé « reprise N4 »).
- Retour arrière : `prisma/retour-arriere/n4_down.sql` (colonnes, tables, types) ; phase 39j de
  `run_all.sh` ; ordre inverse des lots (N4 avant N3).

## Complément (décision de la Direction) : documents produits par une cellule

- Une cellule rattachée à la Direction (SAF, RH, CSID, CTSCM, CNC) a son propre espace documentaire,
  comme une division : `documents.celluleId`, `divisionId` devenu facultatif, contrainte
  `documents_unite_productrice` (exactement une unité). Les dossiers restent propres aux divisions.
- Dépôt : membres de la cellule, DN, DNA. Lecture du privé : membres de la cellule seulement (besoin
  d'en connaître, comme pour une division).
- Validation : chef de la cellule ; DN et DNA en recours (sur ce qu'ils voient) ; un chef de division
  reçoit 403.
- Retour arrière N4 refusé tant qu'un document de cellule existe ; rollback Render vers N3 sûr
  seulement avant le premier dépôt d'un document de cellule.
