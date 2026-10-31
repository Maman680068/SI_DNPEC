# S3c — Sécurité : clés de stockage dans les messages

**Constat** : `CreateMessageDto` acceptait `attachmentKey` et `attachmentName` venant du navigateur
(`POST /messages`). Un utilisateur pouvait y mettre la clé de stockage d'un autre fichier (un document des
Archives par exemple) ; la purge de conservation des messages (`socle/conservation.service.ts`, trois ans)
aurait ensuite supprimé ce fichier.

**Données** : aucune migration. Les colonnes `direct_messages.attachmentKey` / `attachmentName` restent ;
seul le serveur les écrit.

**API** :
- `CreateMessageDto` : destinataire et texte seulement ; le `ValidationPipe` (`forbidNonWhitelisted`)
  renvoie 400 si un des deux champs est envoyé ;
- `MessagesService.send(actor, dto, piece?)` : la pièce jointe (`{ cle, nom }`) est un paramètre interne,
  posé par le générateur de documents (`transmettre`) et par l'envoi d'un fichier (S3) ;
- toutes les lectures de messages passent par `MESSAGE_SELECT` : `attachmentKey` n'est jamais renvoyée
  (envoi, conversations, fil) ; le web n'a plus ce champ (`lib/communication/types.ts`).

**Droits** : inchangés.

**Test** : `tests/e2e/api/s3c_messages_cle.js`.
