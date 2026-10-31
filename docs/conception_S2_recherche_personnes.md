# S2 — Messagerie : recherche du destinataire « comme une messagerie »

**Constat** : `NewConversationSearch.tsx` interrogeait `/users/search` dès la première lettre, rien avant
de taper ; « Mariame Cam » ou « Camara Mariame » ne trouvaient rien (prénom OU nom, chaîne entière) ; les
accents comptaient (« Sekou » ≠ « Sékou ») ; ni fonction ni unité.

**Données** : aucune migration (tout le personnel actif est lu à chaque recherche : quelques centaines de
comptes ; correspondants récents tirés de `direct_messages`).

**Moteur** (`apps/api/src/common/recherche/texte.ts`, réutilisé par l'annuaire S4) : texte normalisé (sans
accents ni majuscules, signes en espaces) ; chaque mot tapé doit se retrouver dans un des champs
(prénom, nom, fonction, sigle de l'unité — section, sinon cellule ou division —, sigle de la division) ;
score : un mot trouvé en début de mot passe avant un mot trouvé à l'intérieur, puis ordre des champs, puis
correspondants récents.

**API** : `GET api/v1/personnes/recherche?q=` (`users/recherche-personnes.*`) →
`{ recents, personnes }` ; lignes `{ id, prenom, nom, fonction, unite (sigle), uniteLibelle, conversation }`,
jamais d'email ni de téléphone. Sans texte : six correspondants récents au plus, puis tout le personnel
actif (sans doublon, sans soi) ; avec texte : soixante résultats au plus, triés par le moteur.

**Droits** : comme `/users/search` aujourd'hui (messagerie sans restriction de cascade, RF-COM-01) : tout
compte connecté, stagiaires compris (comportement actuel de la messagerie gardé) ; comptes actifs seulement.

**Écran** (`components/communication/NewConversationSearch.tsx`) : liste dès le clic (« Récents », « Tout
le personnel »), requête à chaque lettre, lettres trouvées en gras (`lib/recherche/surligner.tsx`, même
normalisation, mise en évidence seulement) ; chaque ligne : initiales, nom, fonction, sigle d'unité,
mention « Conversation » ; choisir une personne ouvre la conversation existante.

**Tests** : `tests/e2e/api/s2_recherche_personnes.js`, `tests/e2e/ui/s2_recherche_ui.js`.
