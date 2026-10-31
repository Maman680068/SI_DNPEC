# S7 — Familles d'actes et mouvements de carrière

**Constat** : un registre ne porte qu'une famille (`choisirRegistre`, 409) ; en production le registre ATT est
rattaché à « Arrêté d'affectation » et cinq familles n'ont pas de registre ; créer un registre obligeait à
passer par Courrier (administration).

**Données** : aucune migration. Codes attendus (dans le code, `rh/familles-actes.service.ts`) : AFF (arrêté
d'affectation), NOM (nomination), AVA (avancement), FDC (fin de contrat), ATS (attestation de stage), ATT
(attestation de travail). Registres créés ici : nature ACTE, portée DIRECTION, format
`{seq:4}/MEFB/DNPEC/{code}/{annee}`, par `RegistresService.create` du Courrier (même contrôle, même audit).

**API** (`api/v1/rh/familles-actes`, droits inchangés : DRH et administrateur configurent, DN et DNA lisent) :
- `GET` : `pretes` / `total` (jauge), et par famille : état PRETE (registre d'actes actif de la Direction au bon
  code), A_CORRIGER (code différent : alerte « ATT ne correspond pas à … »), BLOQUEE (sans registre : l'acte ne
  peut être ni préparé ni signé) ; registre ; **prochain numéro** = aperçu `NumerotationService.apercu` (lecture
  du compteur, **sans consommer la séquence**) ; nombre d'actes numérotés de l'année ; action proposée (« Créer
  le registre XXX », « Rattacher le registre XXX », « Passer au registre XXX », « Lui donner XXX ») ; plan de
  « Configurer les N registres manquants » (ce qui sera créé ou rattaché) ;
- `POST :code/registre-attendu` : registre au code attendu créé s'il manque, retiré à la famille qui le tenait,
  rattaché — en une fois, audité (`FamilleActeRh`, `registre_attendu`) ;
- `POST configurer` : la même chose pour chaque famille non prête ;
- `PATCH :code` (existant) : choix manuel d'un registre.
- `GET api/v1/rh/mouvements?annee=&type=` : filtres appliqués par l'API, quatre compteurs (en préparation, en
  attente de signature, signés et appliqués, annulés) et la liste des types.

**Écran** (`components/rh/OngletCarriere.tsx`) : panneau « Familles d'actes » en tête (jauge, phrase sur
l'effet, tableau famille / état ✓ ! ✕ / registre / prochain numéro / actes de l'année / action, « Configurer
les N registres manquants » avec confirmation qui liste ce qui sera créé, lien « Registres du Courrier ») ;
mouvements : filtres année et type, quatre compteurs, état vide explicatif ; « Préparer un mouvement »
(DRH seul).

**Tests** : `tests/e2e/api/s7_familles_actes.js` ; `n6_rh_ui`, `r_nomination_role_ui` adaptés.
