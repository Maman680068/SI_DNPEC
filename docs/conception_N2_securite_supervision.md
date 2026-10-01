# Conception N2 — Sécurité, journal inaltérable, paramétrage et supervision

Lot N2 du socle NIMBA (cahier NIMBA v2.2 : Partie 0 §3.2, §4.4, §13.6, SOC-SEC-04/05/11,
SOC-SUP-01 à 10 ; décisions N1 point 4). Livré après N1, dans sa propre pull request.

Décisions de la Direction reprises : **double authentification facultative** et **mot de passe de
8 caractères au minimum** conservés (écart assumé avec §4.4, qui demande 12 caractères et un TOTP
obligatoire pour certains rôles) ; lecture de l'audit et paramétrage livrés en N2 ; contrainte
« aucun compte sans agent » posée en base en N2.

## 1. Réauthentification avant un objet protégé (§4.4, §3.2)

Objets protégés existant aujourd'hui : **niveau 2 du dossier du personnel** (données sensibles,
diplômes, pièces, historique de carrière). Le motif médical (N3) et les autres objets protégés
rejoindront le même mécanisme à leur arrivée.

- `POST /api/v1/reauthentification { motDePasse, code? }` : mot de passe du compte (et code TOTP si
  la double authentification est active). Renvoie une **preuve** courte (jeton signé, 10 minutes,
  liée au compte réel et à la session) ; refus 401, tentatives comptées par le même verrouillage
  que la connexion.
- Les routes d'un objet protégé exigent l'en-tête `X-Reauth: <preuve>` : sans preuve valide, 403
  `{ code: 'REAUTH_REQUISE' }` (routes historiques : même corps plus `code`). Le dossier du personnel
  se lit sans preuve pour le niveau 1 ; le niveau 2 est renvoyé verrouillé (`niveau2Verrouille`).
- Web : `apiFetch` reconnaît `REAUTH_REQUISE`, ouvre la fenêtre « Confirmez votre identité »
  (mot de passe, code si besoin), puis rejoue la requête avec la preuve (gardée en mémoire, jamais
  en stockage). En intérim, la preuve est celle du suppléant (identité réelle).
- Chaque consultation d'un objet protégé est journalisée (`metadata.event = 'acces_objet_protege'`).

## 2. Journal d'audit inaltérable (SOC-SEC-04)

- Colonnes ajoutées à `audit_logs` : `numero` (séquence), `empreintePrecedente`, `empreinte`
  (SHA-256 du contenu canonique et de l'empreinte précédente) — **chaînage** calculé en base par un
  déclencheur `BEFORE INSERT` (verrou transactionnel, fonction `sha256` native de PostgreSQL).
- Déclencheur `BEFORE UPDATE OR DELETE` : refus (« Le journal d'audit est en écriture seule »), pour
  tous, administrateur compris. `TRUNCATE` refusé aussi.
- Migration : empreintes calculées pour les lignes existantes, dans l'ordre chronologique.
- `GET /api/v1/journal-audit/verification` (administrateur) : recalcule la chaîne et signale la
  première rupture éventuelle ; affichée dans la supervision.

## 3. Journaux de connexion, 12 mois glissants (SOC-SEC-05)

- Table `journal_connexions` (compte, adresse saisie, résultat, motif d'échec, IP, navigateur, date).
  Les connexions n'écrivent plus d'entrée `CONNEXION` dans l'audit (les anciennes y restent).
- Purge quotidienne au-delà de la durée de conservation (paramètre, 12 mois, bornes 6–36).

## 4. Lecture du journal d'audit (annexe 1 : L(T) DN/DNA et administrateur, L(P) chefs, DRH, SAF, L(S) agent)

- `GET /api/v1/journal-audit` paginé, filtres (période, acteur, type d'objet, action). Portée :
  toute la Direction pour DN, DNA et administrateur ; entrées dont l'auteur est dans son périmètre
  pour les chefs, le DRH et le chef du SAF ; ses propres entrées pour les autres.
- Jamais le contenu d'un objet protégé : seuls l'action, l'objet (type, identifiant), l'auteur,
  l'« au nom de » (intérim), la date et le libellé de l'événement ; aucune métadonnée brute.
- Écran « Journal d'audit » (menu Administration pour l'administrateur, Personnel pour les autres).

## 5. Paramétrage (§13.6) et supervision (SOC-SUP)

Écran **« Paramétrage et supervision »** : administrateur (modification), DN/DNA (lecture).

Paramètres branchés dès N2 (table `parametres`, bornes contrôlées par le serveur, chaque
modification auditée et visible dans le circuit qu'elle gouverne) :

| Paramètre | Défaut | Bornes | Effet |
|---|---|---|---|
| Longueur minimale du mot de passe | 8 | 8 – 32 | inscription, réinitialisation, changement |
| Conservation des journaux de connexion | 12 mois | 6 – 36 | purge quotidienne |
| Expiration de session après inactivité | 30 jours | 1 – 90 | jeton de rafraîchissement |
| Alerte avant une fin de stage ou de contrat | 15 jours | 5 – 60 | première alerte au DRH (le rappel reste à J-3) |

Les autres paramètres du §13.6 arrivent avec leur lot (délai d'avis du chef : N3).

Supervision (aucun objet protégé, SOC-SUP-10) :
- état des services : base (latence), stockage des fichiers (écriture et relecture d'un témoin),
  envoi d'emails (configuration, dernier envoi en erreur), tâches planifiées (dernière exécution,
  résultat) — nominal, dégradé ou indisponible ;
- sonde `/health` enrichie de l'état des dépendances (SOC-SUP-08), sans donnée sensible ;
- sauvegardes : gérées par Render ; date et résultat du dernier test de restauration saisis par
  l'administrateur (SOC-SUP-03) ;
- sessions ouvertes (nombre), comptes à surveiller (en attente depuis plus de 7 jours, jamais
  connectés, sans connexion depuis 90 jours, suspendus, fins prévues proches) ;
- accès refusés comptés par étape et type d'objet sur 24 h, 7 et 30 jours, liste sans contenu ;
- intégrité du journal d'audit (§2) ;
- alerte à l'administrateur (notification et email) quand un service passe en état dégradé ou
  indisponible (vérification toutes les 10 minutes, une alerte par changement d'état).

## 6. Aucun compte sans agent, en base

Déclencheur `BEFORE INSERT OR UPDATE` sur `users` : un compte qui n'est pas « en attente » et n'a
pas d'agent en reçoit un aussitôt (matricule provisoire, unité de son rattachement), puis contrainte
`CHECK (status = 'EN_ATTENTE' OR "agentId" IS NOT NULL)`. Filet de sécurité compatible avec toute
version de l'application (y compris N1 en cas de retour arrière) ; les écrans de N2 continuent de
rattacher explicitement l'agent choisi.

## Migration, reprise, retour arrière

- Migration additive : tables `parametres`, `journal_connexions`, `executions_taches`,
  `etat_supervision` ; colonnes d'empreinte de `audit_logs` ; déclencheurs et contrainte.
- Reprise : empreintes des lignes existantes calculées par la migration ; agents manquants créés par
  le déclencheur avant la pose de la contrainte.
- Retour arrière : `prisma/retour-arriere/n2_down.sql` (déclencheurs, contrainte, colonnes et tables
  retirés ; audit et comptes intacts), testé par la même phase que N1.
