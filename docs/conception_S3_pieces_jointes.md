# S3 — Messagerie : pièces jointes

**Données** : aucune migration. Les colonnes existantes `direct_messages.attachmentKey` / `attachmentName`
portent le fichier envoyé (clé posée par le serveur seulement, voir S3c) ; stockage privé par
`StorageService` ; purge par la conservation existante (messages de plus de trois ans, fichier compris).

**API** (`communication/messages/pieces-jointes.*`, déclaré dans `CollaborationModule`, routes `api/v1/messages`) :
- `POST fichier` (multipart : `recipientId`, `body` facultatif, `fichier`) : PDF, Word (.doc, .docx), Excel
  (.xls, .xlsx), images (PNG, JPEG, GIF, WebP) ; **10 Mo** au plus (413) ; type vérifié par le **contenu**
  (premiers octets : `%PDF-`, signatures PNG/JPEG/GIF/WebP, conteneur OLE, paquet Office avec `word/` ou
  `xl/`) et cohérent avec l'extension, sinon 400 ; envoi par `MessagesService.send(..., { cle, nom })` ;
  notification « Pièce jointe : … » quand le message n'a pas de texte ;
- `GET :id/piece-jointe` : expéditeur ou destinataire **en personne** (jamais par intérim, jamais un tiers,
  même le DN : 403) ; type servi par `typeServi` ; chaque téléchargement audité (`DirectMessage`,
  `telechargement_piece_jointe`, sans nom de fichier) ;
- `GET avec/:userId/documents-a-citer?q=` : documents que l'acteur peut ouvrir (`DocumentsService.
  findAllVisibleTo`, droits des Archives inchangés) ; sans texte : déjà échangés avec ce correspondant
  (en tête, `echange`), puis récents de son unité ; avec texte : moteur de S2 sur le titre et le nom du
  fichier. Chaque résultat : emplacement (`Archives · unité · dossier`) et version. Les documents
  n'ont pas de numéro propre : le filtre porte sur le titre et le nom du fichier.
- Fiche de la conversation (`avec/:userId/contexte`) : `droits.joindre` et `droits.classer`.

**Droits** : joindre (fichier ou document) et documents à citer : tout compte sauf stagiaire (la GED leur
est fermée ; choix prudent, comme le trombone d'aujourd'hui) ; téléchargement : les deux personnes,
stagiaire compris ; « Classer dans les Archives » : expéditeur et destinataire rattachés à une division ou
une cellule — c'est le **dépôt normal** (`POST /documents`, mêmes métadonnées obligatoires, statut
Brouillon, droits normaux), le fichier étant relu depuis la pièce jointe.

**Écran** (`MessageThread.tsx`, `ChoixDocument.tsx`) : trombone « Joindre » → « Depuis mon ordinateur » /
« Depuis les Archives » ; fichier choisi rappelé avant l'envoi ; carte de la pièce jointe avec
« Télécharger » et « Classer dans les Archives » (fenêtre de dépôt des Archives préremplie) ; « Citer un
document des Archives » : liste dès l'ouverture, filtre à chaque lettre ; le destinataire sans droit voit
« Document des Archives — vous n'y avez pas accès ».

**Tests** : `tests/e2e/api/s3_pieces_jointes.js`, `tests/e2e/ui/s3_pieces_jointes_ui.js`.
