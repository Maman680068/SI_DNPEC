# Lot B1 — Référentiel des modèles et dépôt par paquet (domaine B)

*Conception écrite avec le code (règle validée pour ce lot), validation sur la PR avant déploiement.*
*Base : `docs/conception_domaine_B_modeles.md` ; les décisions validées pour B1 (ci-dessous) la remplacent
là où elles diffèrent.*

## 1. Décisions appliquées

| N° | Décision | Traduction |
|---|---|---|
| 1 | Rôles de modélisation, le rang ne donne aucun droit | Table `affectations_modelisation` : **Analyste** (attribué par l'administrateur ; jamais un stagiaire, jamais l'administrateur), **Responsable** et **Suppléant** d'un modèle (désignés par l'administrateur, le DN ou la DNA ; une personne peut l'être de plusieurs modèles, jamais les deux pour un même modèle). **Administrateur des modèles** = la position `ADMIN_SYSTEME`. Pas de rôle « Décideur ». Rôles personnels : jamais empruntés en intérim |
| 2 | Personne ne valide ni n'active son propre travail | L'auteur du dépôt ne peut pas approuver ni refuser (403) ; si le responsable est l'auteur, le suppléant approuve. Contrainte en base : `approbateurId ≠ auteurId` |
| 3 | L'administrateur ne voit jamais les chiffres d'une simulation | Il ne lance aucune simulation (403) ; l'état d'un travail lui est donné sans résultat. Les valeurs des contrôles de dépôt (écarts, résidus) sont techniques : il les voit |
| 4 | Dérogation à deux | Demandée par le responsable (ou le suppléant) avec motif écrit, confirmée par l'administrateur (jamais sa propre demande) ; mention « activée avec dérogation » définitive (déclencheur) |
| 5 | Version immuable, une seule active | Empreinte SHA-256 ; déclencheur `versions_modele_garde` (contenu figé, aucune suppression, états définitifs) ; index unique partiel `versions_modele_une_active` |
| 6 | Données publiées ou fictives seulement | Case obligatoire au dépôt, contrôlée par le serveur, tracée dans l'audit (`depot_version`) |
| 7 | Service Render gratuit `dnpec-calcul` | `apps/calcul` (Python 3.11, Docker, IPOPT) ; écrans « Réveil du service de calcul… » puis « Calcul en cours… » |

## 2. Service de calcul (`apps/calcul`)

- `GET /sante` (public, sans donnée), `POST /paquets/verifier` (zip → `info()` + `controles_depot()`),
  `POST /executer` (empreinte + scénario ; zip renvoyé par l'API si le service répond 409 « paquet inconnu »).
- Secret partagé `X-Calcul-Secret` = `CALCUL_SECRET` (comparaison à temps constant ; 401 sinon ; 503 si
  le secret n'est pas configuré). Aucun accès à la base, aucune autre variable sensible.
- Zip contrôlé avant extraction : 50 Mo, 2 000 fichiers, 300 Mo décompressés, ni chemin absolu, ni « .. »,
  ni lien symbolique, ni chiffrement ; extraction fichier par fichier dans un dossier temporaire.
- Chaque appel dans un **sous-processus** : délai (vérification 300 s, exécution 600 s, groupe tué),
  mémoire (`RLIMIT_AS`), temps processeur, taille des fichiers, environnement réduit (le code du paquet
  ne voit pas `CALCUL_SECRET`), sortie du paquet séparée de la réponse, JSON strict (NaN → null).
- Un calcul à la fois (service à 0,1 processeur) ; la sonde répond pendant un calcul.
- Image : `pyomo download-extensions` puis `pyomo build-extensions` (depuis pyomo 6.10, l'interface
  pynumero utilisée par cyipopt est compilée, plus téléchargée) ; `scipy` ajouté (requis par pynumero).
- Tests : `apps/calcul/tests` (paquet factice en Python pur, en CI) ; test local SYLI (`-m local`,
  `SYLI_ZIP=…`), jamais en CI. La CI construit aussi l'image et l'essaie (sonde, IPOPT, vérification).

## 3. Données (migration additive `20261006080000_domaine_b_b1`)

| Table | Contenu |
|---|---|
| `modeles` | code (unique, lu dans modele.json), nom, famille, description ; créé au premier dépôt |
| `versions_modele` | numéro, empreinte, fichier (StorageService), fiche `modele.json` validée, statut `DEPOSEE → CONTROLEE → EN_ATTENTE → ACTIVE \| REFUSEE`, `ARCHIVEE` (remplacée) ; contrôles, réglage des manettes et compteurs (jamais dans le zip), dérogations, auteur, approbateur, dates |
| `affectations_modelisation` | personne, rôle, modèle éventuel, attribué par, motif, début ; fin datée et motivée (historique) |
| `travaux_calcul` | file en base : vérification ou exécution, `EN_FILE → EN_COURS → TERMINE \| ECHEC`, étape `REVEIL`/`CALCUL`, essais, prochaine tentative, durée ; résultat d'une exécution (lu par le demandeur seul) |

Les tables nouvelles désignent les comptes par leur identifiant ; aucune table existante n'est modifiée.

## 4. Endpoints (`/api/v1`, fermés aux stagiaires)

| Route | Droit |
|---|---|
| `GET /modeles`, `GET /modeles/:id`, `GET /modeles/versions/:id` | rôle de modélisation ou administrateur |
| `POST /modeles/versions` (multipart : `paquet`, `donneesConfirmees`) | administrateur |
| `POST …/versions/:id/verification`, `PUT …/reglages`, `POST …/envoi`, `POST …/abandon` | administrateur |
| `POST …/versions/:id/derogations` | responsable ou suppléant du modèle |
| `POST …/derogations/:controleId/confirmation` | administrateur, jamais sa propre demande |
| `POST …/versions/:id/approbation`, `POST …/refus` | responsable ou suppléant, jamais l'auteur |
| `POST /modeles/:id/executer` (202) | analyste, responsable ou suppléant ; jamais l'administrateur ; version active ; manettes actives et bornes réglées (422 `BORNE_DEPASSEE`, `MANETTE_NON_AUTORISEE`) ; 409 `MODELE_SANS_VERSION_ACTIVE` |
| `GET /modelisation/travaux/:id` | le demandeur (avec résultat) ; l'administrateur (état technique seul) |
| `GET/POST /modelisation/affectations`, `POST …/:id/fin`, `GET /modelisation/personnes` | analyste : administrateur ; responsable, suppléant : administrateur, DN, DNA |

Validation serveur de `modele.json` : format `dnpec-modele/1`, code, identifiants uniques (manettes,
compteurs, contrôles), manettes avec `min < max` et valeur par défaut dans les bornes, indices uniques.
Les bornes réglées par l'administrateur ne peuvent que resserrer celles du paquet.

## 5. File de travaux, réveil du service

Un travail est créé avec le dépôt (vérification) ou la demande d'exécution, puis traité aussitôt et par une
reprise toutes les 30 secondes (`SKIP LOCKED`, un à la fois). Étape `REVEIL` : `GET /sante` (jusqu'à 90 s,
le temps que Render réveille le service gratuit) ; étape `CALCUL` : l'appel. Service injoignable ou occupé :
travail remis en file (`calcul.delaiRelanceSecondes`, 30 s) jusqu'à `calcul.tentativesMax` essais (10),
puis échec signalé. Travail resté « en cours » au redémarrage de l'API : repris.

## 6. Notifications, audit, supervision, navigation, aide

- Notifications (types existants, `libelleBouton`) : version à approuver → responsable et suppléant (et
  à la désignation d'un responsable quand une version attend) ; demande de dérogation → administrateurs
  (urgent) ; dérogation confirmée, version active ou refusée → intéressés ; rôle attribué ou terminé → la
  personne.
- Audit (`metadata.event`) : `modele_cree`, `depot_version` (avec la confirmation des données),
  `controles_depot`, `verification_paquet_echec`, `verification_relancee`, `reglage_manettes`,
  `envoi_responsable`, `derogation_demandee`, `derogation_confirmee`, `approbation`, `activation`, `refus`,
  `depot_abandonne`, `execution_demandee`, `execution_echec`, `attribution_role_modelisation`,
  `fin_role_modelisation`.
- Supervision : « Service de calcul (modèles) » et « Paquets de modèles » (sans sonde active).
- Navigation : entrée « Modélisation → Modèles » donnée par l'API (`navigation.modelisation`) ; « À traiter » :
  versions à approuver, dérogations à confirmer, manettes à régler.
- Aide : guides « Responsable de modèle » et « Analyste (modélisation) », section « Modèles » du guide de
  l'administrateur (`GET /aide/profils` : `ANALYSTE_MODELE`, `RESPONSABLE_MODELE`).

## 7. Démonstration

`demo.ts` crée « TEST — Modèle de démonstration » (paquet factice livré, `integre:paquet-demonstration.zip`),
son responsable, son suppléant et deux analystes de démonstration. Le dépôt passe par le vrai service, au
nom du compte technique de la démonstration (aucun administrateur de démonstration n'existe). Avec le
service de calcul configuré : vérification, envoi, approbation et une simulation ; sinon la version attend
en file et l'API de production la vérifie. Le mode « supprimer » retire modèle, versions (verrou levé dans
sa seule transaction), travaux et rôles de modélisation des comptes de démonstration.

## 8. Écarts avec `conception_domaine_B_modeles.md`

- Pas de moteur simulé : le premier vrai paquet (SYLI Standard) et un paquet factice en Python pur
  passent par le vrai service de calcul ; le dépôt est un paquet unique (zip) au lieu de fichiers séparés.
- Rôles de modélisation dans une table dédiée (et non les rôles fonctionnels `ANALYSTE`,
  `RESPONSABLE_MODELE`, `DECIDEUR`, laissés sans écran) ; pas de Décideur.
- États de version simplifiés (`DEPOSEE`, `CONTROLEE`, `EN_ATTENTE`, `ACTIVE`, `REFUSEE`, `ARCHIVEE`) ;
  la dérogation est demandée par le responsable et confirmée par l'administrateur (et non l'inverse).
