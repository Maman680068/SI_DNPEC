# Guide d'utilisation du SI DNPEC — document source

*Matière destinée à la rédaction du guide d'utilisation complet (document Word) remis au personnel de la DNPEC.*

| | |
|---|---|
| Version de l'application décrite | production du 3 octobre 2026 (après la nomination d'un chef, PR #22) |
| Établi à partir de | le code de l'application (écrans web, guides intégrés, règles du serveur) |
| Captures | dossier `captures/`, liste et description dans `captures/LISTE.md` |
| Comptes utilisés pour les captures | comptes de démonstration fictifs (`…@demo.dnpec.test`), noms préfixés « TEST — » ; aucune donnée réelle |

## 0. À lire avant de commencer

### 0.1 Comment ce document est construit

- Chaque fait vient du code de l'application telle qu'elle est en production. Les libellés entre guillemets « … » sont ceux qui s'affichent à l'écran : boutons, onglets, champs, messages.
- La mention « (à confirmer) » signale un point que le code seul ne permet pas d'établir, par exemple une valeur réglée en production ou un libellé saisi au paramétrage. Faites-le vérifier par l'administrateur avant la diffusion du guide.
- Les heures sont celles de Conakry (temps universel, sans changement d'heure).
- « (obligatoire) » et « (facultatif) » indiquent si un champ doit être rempli.
- Les noms de rôles utilisés : DN, DNA, chef de division, chef de section, chef de cellule, chargé d'études, assistant(e) de direction, DRH, administrateur système, stagiaire. S'y ajoutent les habilitations, qui sont personnelles et ne sont pas des rôles : secrétariat courrier, gestionnaire logistique, tuteur de stage.

### 0.2 Principes communs à tous les modules

- **Chacun voit selon sa place dans l'organisation.** Un chef voit son unité ; la Direction (DN, DNA) voit l'ensemble.
- **Besoin d'en connaître.** Certains contenus restent protégés même pour la Direction : motif médical d'un congé, pli personnel, dossier du personnel détaillé, documents privés d'une unité dont on n'est pas membre.
- **Intérim (suppléance).** Le suppléant agit au nom du titulaire, mais n'emprunte jamais ses habilitations personnelles ni ses rôles fonctionnels. Chaque action est tracée « au nom de » le titulaire.
- **Traçabilité.** Les actions importantes sont inscrites au journal d'audit, qui ne peut être ni modifié ni effacé.
- **Avertissements.** Les notifications apparaissent dans la cloche. Elles sont aussi envoyées par email, soit tout de suite, soit dans le résumé quotidien (voir 2.5 et l'annexe B).

### 0.3 Sommaire

1. Accéder au SI DNPEC
2. Se repérer dans l'interface
3. Les modules
   - 3.1 Tâches
   - 3.2 Projets
   - 3.3 Plan de travail
   - 3.4 Instructions de la Direction
   - 3.5 Communication — messagerie, fils de discussion, annonces, sondages
   - 3.6 Boîte à suggestions
   - 3.7 Annuaire
   - 3.8 Congés et absences
   - 3.9 Jours fériés
   - 3.10 Suppléance
   - 3.11 Dossier du personnel
   - 3.12 Ressources humaines : effectifs, alertes, fiches de poste, formation, pièces requises
   - 3.13 Carrière, nomination et changement de rôle
   - 3.14 Agents
   - 3.15 Stages
   - 3.16 Archives et documents
   - 3.17 Documents générés (attestation de travail, ordre de mission, rapport d'activité)
   - 3.18 Courrier et actes
   - 3.19 Réunions
   - 3.20 Logistique (demandes, fournitures et stock, inventaire, réservations et priorité)
   - 3.21 Véhicules et carburant
   - 3.22 Organisation
   - 3.23 Utilisateurs (création, inscriptions, suspension, changement de rôle, rôles fonctionnels, onglet « Nominations »)
   - 3.24 Paramétrage et supervision
   - 3.25 Journal d'audit
   - 3.26 Aide en ligne
4. Parcours pas à pas (opérations les plus courantes)
   - P00 Activer la double authentification
   - P01 Créer une tâche, l'assigner, la terminer et la faire valider
   - P02 Rejeter une tâche soumise avec motif
   - P03 Ajouter un objectif et une activité au plan de travail et y rattacher une tâche
   - P04 Émettre une instruction (DN/DNA) et la suivre jusqu'à exécution
   - P05 Publier une annonce et créer un sondage
   - P06 Demander un congé maladie et joindre le certificat
   - P07 Donner un avis sur un congé (chef) puis le décider (DRH)
   - P08 Gérer les jours fériés de l'année
   - P09 Désigner un suppléant et agir en intérim
   - P10 Établir le plan de stage, déposer et valider le rapport de stage
   - P11 Nommer un chef : préparer le mouvement, l'acte, la signature, la confirmation du changement de rôle
   - P12 Exprimer un besoin de formation et le retenir
   - P13 Déposer un document, le faire valider et le rendre diffusable
   - P14 Enregistrer un courrier arrivé et l'imputer
   - P15 Traiter un courrier imputé (réponse, conversion en tâche)
   - P16 Rédiger un acte, le faire viser, le signer et l'expédier
   - P17 Préparer un ordre de mission
   - P18 Produire une attestation de travail
   - P19 Produire un rapport d'activité
   - P20 Créer une réunion et réserver la salle
   - P21 Réserver une salle ou une ressource
   - P22 Demander des fournitures, valider, servir
   - P23 Enregistrer un véhicule et un plein de carburant, affecter le véhicule à un ordre de mission et enregistrer le retour
   - P24 Approuver une inscription et changer le rôle d'un compte
   - P25 Consulter la supervision et vérifier l'intégrité du journal d'audit
5. Questions fréquentes et dépannage
6. Paramètres réglables et valeurs actuelles
- Annexe A — Tâches automatiques et leurs horaires
- Annexe B — Emails envoyés immédiatement
- Annexe C — Correspondance des captures

## 1. Accéder au SI DNPEC

### 1.1 Adresse et navigateurs

- **L'adresse définitive du SI DNPEC vous est communiquée par l'administrateur système (cellule CSID).** L'adresse prévue est **https://dnpec-web.onrender.com**. Elle peut toutefois être différente au moment de la mise en service (à confirmer auprès de l'administrateur).
- Le SI DNPEC s'utilise sur ordinateur comme sur téléphone. L'affichage s'adapte à la taille de l'écran (voir 2.8).
- **Navigateurs conseillés** : aucun navigateur particulier n'est imposé ni recommandé (à confirmer). Utilisez un navigateur récent et tenu à jour.
- **Premier accès de la journée** : si personne ne s'est servi de l'application depuis environ 15 minutes, le site peut mettre **jusqu'à 50 secondes environ** à se « réveiller ». Patientez puis, si besoin, rechargez la page.

**Page d'accueil publique** (avant connexion) :
- en haut : « RÉPUBLIQUE DE GUINÉE », « DNPEC · Système Interne » et le lien « Se connecter → » ;
- titre : « La coordination de la Direction, en un seul endroit. » ;
- deux boutons : **« Se connecter »** et **« Demander l'accès »** ;
- rubrique « Modules » avec cinq cartes : « Tâches », « Communication », « Congés », « Archives », « Annuaire » ;
- en pied de page : « Cellule des Systèmes d'Informations et de la Digitalisation — CSID ».

Si vous êtes déjà connecté, l'accueil vous conduit directement à votre « Tableau de bord ».

**Captures** : 01-acces-01-accueil.png

### 1.2 Demander l'accès

**À quoi ça sert** : créer vous-même votre compte. Votre demande est ensuite examinée par l'administrateur système, qui fixe votre rôle réel et votre unité.

**Accès** : page d'accueil → bouton « Demander l'accès ». Vous pouvez aussi passer par la page de connexion → « Demander l'accès → ».

En haut de la page s'affichent « DNPEC » et le lien « ← Déjà inscrit ? Se connecter ». Le titre est « Demande d'accès » : « Créez votre compte — la demande sera examinée par un administrateur de la DNPEC avant activation. »

L'assistant compte **4 étapes** : « E-mail », « Identité », « Poste », « Récapitulatif ». Le pied de page indique « Étape 1 / 4 », « Étape 2 / 4 », etc. Utilisez « Continuer → » pour avancer et « ← Retour » pour revenir. Le navigateur vous empêche d'avancer tant qu'un champ obligatoire de l'étape est vide ou mal rempli.

**Étape 1 — « Votre adresse e-mail »** (« Utilisée pour vous connecter et recevoir les notifications »)
- « Adresse e-mail » (obligatoire, format adresse e-mail, exemple « prenom.nom@exemple.com »).
- Aide affichée : « Indiquez une adresse e-mail à laquelle vous avez accès. Elle servira d'identifiant de connexion. »

**Étape 2 — « Votre identité »** (« Comment devons-nous vous appeler, et comment sécuriser votre compte ? »)
- « Prénom » (obligatoire).
- « Nom » (obligatoire).
- « Mot de passe » (obligatoire). L'écran indique « 8 caractères minimum. ». La longueur minimale réelle est réglée par l'administrateur (8 par défaut, jusqu'à 32 au maximum, voir partie 6). Le maximum est de 200 caractères.

**Étape 3 — « Poste et rattachement »** (« Aide l'administrateur à vérifier votre demande et à choisir le bon rôle »)
- « Poste actuel » (obligatoire, liste « — Sélectionner votre poste actuel — ») :
  - « Chargé d'Études / Agent »
  - « Chef de Section »
  - « Chef de Division »
  - « Chef de Cellule »
  - « Directeur National »
  - « Directeur National Adjoint »
  - « Assistant(e) de Direction »
- Ce poste est une simple **déclaration**. Le rôle réel est attribué par l'administrateur. Les rôles DRH, administrateur système et stagiaire ne se déclarent pas ici : ces comptes sont créés ou fixés par l'administrateur.
- « Votre situation actuelle » (obligatoire, sauf pour le DN et le DNA). Choisissez **une seule** option à l'aide des onglets proposés selon votre poste :

| Poste déclaré | Onglets proposés | Champs |
|---|---|---|
| Chargé d'Études / Agent | « Division » ou « Cellule transversale » | Division (obligatoire) + « — Section (optionnel) — » (facultatif), ou une cellule (obligatoire) |
| Chef de Section | « Division » | Division (obligatoire) + « — Sélectionner une section — » (obligatoire) |
| Chef de Division | « Division » | Division seule (aucune section) |
| Chef de Cellule | « Cellule transversale » | Cellule (obligatoire) |
| Assistant(e) de Direction | « Assistant de direction » | « — Sélectionner la personne assistée — » (obligatoire) |
| Directeur National / Directeur National Adjoint | aucun | aucun rattachement à déclarer |

- Seules trois cellules transversales peuvent être déclarées : celles des codes SAF, RH et CSID. Les unités suspendues n'apparaissent pas dans les listes.
- Pour la personne assistée, l'écran précise : « Seuls le Directeur National, la Direction Nationale Adjointe et les Chefs de Cellule en poste peuvent être désignés. » Seuls les comptes actifs sont proposés.

**Étape 4 — « Récapitulatif »** (« Vérifiez vos informations avant l'envoi »)
- Lignes « E-mail », « Identité », « Poste actuel » et « Rattachement ».
- Bouton **« Envoyer la demande »** (« Envoi… » pendant l'envoi). Un refus éventuel s'affiche à cette étape.

**Résultat** : l'écran « Demande envoyée » s'affiche : « Votre demande est en attente de validation par un administrateur. Vous recevrez un accès dès qu'elle aura été approuvée. » Il propose le lien « Retour à la connexion ».

**Ensuite** :
- L'administrateur système voit votre demande dans « Utilisateurs » → onglet « Inscriptions en attente ». La carte porte les badges « Poste déclaré : … » et « Souhaite : … » et les boutons « Rejeter » et « Approuver ».
- **Si la demande est approuvée**, l'administrateur choisit le « Rôle attribué », votre rattachement et votre dossier RH (« Agent (dossier RH) »). Vous recevez un email intitulé « Votre compte SI DNPEC est activé ». Il contient « Votre demande d'accès au SI DNPEC a été approuvée : votre compte est actif. », votre « Rôle : … », votre « Unité : … » et un bouton **« Se connecter »**. Connectez-vous avec l'adresse et le mot de passe choisis lors de votre demande.
- **Si la demande est rejetée**, elle est supprimée. Vous recevez l'email « Votre demande d'accès au SI DNPEC » : « Votre demande d'accès au SI DNPEC n'a pas été retenue. ». Si l'administrateur a saisi un motif, l'email ajoute « Motif indiqué par l'administrateur : … ». L'email vous invite à refaire une demande quand vous le souhaitez.
- Ces emails sont envoyés après la décision. Pensez à regarder aussi dans vos courriers indésirables. Aucune notification n'apparaît dans l'application.

**Messages que vous pouvez voir**
- « Un compte existe déjà avec cet email » → un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ? ».
- « Indiquez votre division, votre cellule actuelle, ou la personne que vous assistez. » → revenez à l'étape 3 et choisissez un rattachement.
- « Vous ne pouvez déclarer qu'une seule option parmi Division, Cellule et Assistant de direction. » → ne gardez qu'une seule option.
- « Une Section déclarée nécessite une Division déclarée. » / « Cette Section ne correspond pas à la Division déclarée. » → choisissez d'abord la division, puis une section de cette division.
- « Cette Cellule ne peut pas être déclarée à l'inscription. » → choisissez une cellule de la liste.
- « La personne déclarée comme assistée doit être un DN, une DNA ou un Chef de Cellule actif. » → choisissez une personne de la liste.
- « Le Directeur National et la Directrice Nationale Adjointe ne déclarent pas de rattachement. » → aucun rattachement pour ces deux postes.
- « Le mot de passe doit contenir au moins N caractères. » → allongez votre mot de passe.
- « Trop de demandes d'inscription depuis cette adresse. Réessayez dans une heure. » → au-delà de 30 demandes en une heure depuis le même accès Internet (par exemple un bureau partagé), attendez une heure.

**Captures** : 01-acces-03-demander-acces.png

### 1.3 Compte créé par l'administrateur

L'administrateur système peut créer votre compte directement : « Utilisateurs » → « + Nouveau compte ».

**Fenêtre « Nouveau compte »** (côté administrateur) :
- « Agent (dossier RH) » (facultatif) : rattache le compte à un agent existant qui n'a pas encore de compte, ce qui remplit le prénom et le nom. Sinon, choisissez « Nouvel agent, créé avec ce compte » avec « Matricule du nouvel agent (facultatif) » (« Sinon un matricule provisoire est attribué »).
- « Adresse e-mail » (obligatoire).
- « Prénom » (obligatoire).
- « Nom » (obligatoire).
- « Mot de passe » (obligatoire, « 8 caractères minimum. ») : mot de passe provisoire.
- « Rôle » (obligatoire) : tous les rôles sauf « Chef de Cellule ». Un chef de cellule se nomme ensuite depuis un compte existant.
- Rattachement selon le rôle (un astérisque marque les champs obligatoires) :
  - DN, DNA : aucun ;
  - assistant(e) de direction : « Personne assistée » ;
  - chef de division : « Division » ;
  - chef de section : « Division » + « Section » ;
  - chargé d'études : « Division » (« Section » facultative) ou « Cellule » ;
  - administrateur système, DRH : « Cellule » facultative ;
  - stagiaire : mêmes champs que le chargé d'études, tous facultatifs.
- Boutons « Annuler » et « Créer le compte » (« Création… »).

**Ce que vous recevez** : l'email « Votre compte SI DNPEC a été créé ». Il indique votre « Rôle : … » et votre « Unité : … » et contient un bouton **« Choisir mon mot de passe »**. Ce lien est **valable 7 jours** et ne sert qu'une fois.

**Choisir votre mot de passe** : le bouton ouvre la page « Nouveau mot de passe » (voir 1.6) avec les champs « Nouveau mot de passe » et « Confirmer le mot de passe ». Le mot de passe provisoire éventuellement communiqué par l'administrateur fonctionne aussi tant que vous ne l'avez pas changé. Si le lien a expiré, utilisez « Mot de passe oublié ? » sur la page de connexion.

### 1.4 Se connecter

**Accès** : accueil → « Se connecter ».

Écran « Connexion » : « Accédez à votre espace de travail DNPEC. »
1. « Adresse e-mail » (obligatoire) : l'adresse de votre compte.
2. « Mot de passe » (obligatoire).
3. Cliquez sur **« Se connecter »** (« Connexion… » pendant la vérification).
4. Si la double authentification est active sur votre compte, l'écran « Vérification en deux étapes » s'affiche (voir 1.5).
5. Vous arrivez sur votre « Tableau de bord », ou sur la page que vous vouliez ouvrir avant la connexion (voir 1.8).

Sous les champs se trouvent le lien « Mot de passe oublié ? » et, après « ou », le lien « Demander l'accès → ».

Si une session est déjà ouverte dans ce navigateur, la page de connexion vous conduit directement au tableau de bord.

**Captures** : 01-acces-02-connexion.png

### 1.5 Double authentification

**À quoi ça sert** : en plus du mot de passe, un code à 6 chiffres affiché par une application de votre téléphone est demandé à chaque connexion. Elle est **facultative pour tous**, mais l'écran la conseille pour les comptes de direction.

**Accès** : en bas du menu latéral, icône 🔒 « Sécurité du compte ». L'écran affiche « Mon compte » / « Sécurité du compte », puis l'encadré « Double authentification » avec le badge « Activée » ou « Désactivée ».

Texte affiché : « En plus du mot de passe, un code à 6 chiffres donné par une application de votre téléphone (Google Authenticator, Microsoft Authenticator, FreeOTP…) est demandé à chaque connexion. Facultative, mais conseillée pour les comptes de direction. »

**Activer** : voir le parcours détaillé 4.0. En résumé :
1. Cliquez sur « Activer la double authentification ».
2. Confirmez votre mot de passe.
3. Scannez le QR code.
4. Saisissez le code à 6 chiffres.
5. Cliquez sur « Confirmer l'activation ».

**Se connecter avec la double authentification** : après le mot de passe, l'écran « Vérification en deux étapes » demande : « Saisissez le code affiché par votre application d'authentification. »
- Saisissez le « Code de vérification » (6 chiffres, obligatoire).
- Cliquez sur « Valider » (« Vérification… » pendant la vérification).
- Vous disposez de **5 minutes** après la saisie du mot de passe pour saisir le code.

**Désactiver** :
1. Ouvrez 🔒 « Sécurité du compte ». L'écran indique : « Pour la désactiver, saisissez un code actuel de votre application. »
2. Saisissez le code dans « Code à 6 chiffres affiché par l'application ».
3. Cliquez sur « Désactiver ». Le message « Double authentification désactivée. » s'affiche.

L'écran rappelle : « Téléphone perdu ou changé ? Demandez à l'administrateur système de réinitialiser votre double authentification. »

**Réinitialisation par l'administrateur système** (téléphone perdu ou changé) :
1. L'administrateur ouvre « Utilisateurs », puis le compte concerné, puis « Gérer ce compte ».
2. Dans la rubrique « Double authentification », il clique sur « Réinitialiser la double authentification ». Aide affichée : « Si la personne a perdu ou changé de téléphone. Ses sessions sont fermées ; elle pourra la réactiver ensuite. »
3. Il confirme : « Confirmer : réinitialiser la double authentification de ce compte ? La personne devra se reconnecter avec son seul mot de passe. »
4. Le message « Double authentification réinitialisée. Les sessions actives de ce compte ont été fermées. » s'affiche.

L'administrateur ne peut pas réinitialiser la double authentification de son propre compte. L'application affiche alors : « Pour votre propre compte, désactivez la double authentification depuis la page Sécurité. » Si la double authentification n'est pas active : « La double authentification n'est pas activée sur ce compte. »

**Messages que vous pouvez voir**
- « Code de vérification invalide » → code faux ou périmé. Attendez le code suivant et vérifiez l'heure de votre téléphone.
- « La double authentification est déjà active : désactivez-la avant de la reconfigurer. » → désactivez-la d'abord.
- « Aucune configuration en attente : générez d'abord le QR code. » → recommencez par « Activer la double authentification ».
- « Jeton invalide ou expiré » → plus de 5 minutes se sont écoulées depuis le mot de passe. Recommencez la connexion.
- Une erreur de code compte comme un échec de connexion (voir 1.7).

**Captures** : 01-acces-05-double-authentification.png

### 1.6 Mot de passe oublié

1. Sur la page de connexion, cliquez sur « Mot de passe oublié ? ».
2. L'écran « Mot de passe oublié » s'affiche : « Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe. » Saisissez votre « Adresse e-mail » (obligatoire).
3. Cliquez sur « Envoyer le lien de réinitialisation » (« Envoi… »). Pour revenir en arrière, cliquez sur « ← Retour à la connexion ».
4. L'écran « Vérifiez votre boîte mail » s'affiche : « Si un compte existe avec l'adresse …, un email contenant un lien de réinitialisation vient de vous être envoyé. Ce lien est valable une heure. »
5. Ouvrez l'email « Réinitialisation de votre mot de passe DNPEC » et cliquez sur **« Changer mon mot de passe »**.
6. L'écran « Nouveau mot de passe » s'affiche : « Choisissez un nouveau mot de passe pour votre compte. » Remplissez :
   - « Nouveau mot de passe » (obligatoire, « 8 caractères minimum. », ou davantage si l'administrateur a relevé le minimum) ;
   - « Confirmer le mot de passe » (obligatoire, identique au premier).
7. Cliquez sur « Réinitialiser le mot de passe » (« Mise à jour… »).
8. L'écran « Mot de passe mis à jour » s'affiche : « Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe. » Cliquez sur le bouton « Se connecter ».

**Règles**
- Le lien est **valable 1 heure** et ne sert qu'**une fois**.
- Un nouveau lien annule les précédents : utilisez toujours le dernier reçu.
- L'email n'est envoyé que si le compte est **actif**. L'écran affiche le même message dans tous les cas.
- Après le changement, **toutes vos sessions sont fermées**, sur tous vos appareils.
- Vous pouvez faire au plus 5 demandes par heure pour une même adresse, et 10 par heure depuis un même accès Internet.

L'administrateur système peut aussi, depuis « Gérer ce compte » → rubrique « Mot de passe » :
- cliquer sur « Envoyer un lien de réinitialisation par email ». Le lien est valable 1 heure et le compte doit être actif (« Le compte doit être actif pour recevoir ce lien. ») ;
- utiliser « Définir un mot de passe temporaire » (« 8 caractères minimum. À communiquer vous-même à la personne concernée. ») puis « Définir ce mot de passe ». Les sessions actives du compte sont alors fermées.

**Messages que vous pouvez voir**
- « Les deux mots de passe ne correspondent pas. » → saisissez deux fois le même mot de passe.
- « Lien de réinitialisation invalide ou expiré » → le lien a plus d'une heure, a déjà servi ou a été remplacé. Redemandez-en un.
- « Lien invalide » / « Ce lien de réinitialisation est incomplet. Demandez-en un nouveau depuis l'écran de connexion. » → le lien a été mal copié. Cliquez sur « Demander un nouveau lien ».
- « Trop de demandes de réinitialisation. Réessayez dans une heure. » → attendez une heure.

**Captures** : 01-acces-04-mot-de-passe-oublie.png

### 1.7 Verrouillage après échecs

- Après **5 échecs** en **15 minutes**, l'accès est bloqué pendant **15 minutes**. Comptent comme échecs un mot de passe faux, un code de double authentification faux et une confirmation d'identité ratée.
- Le blocage s'applique **au compte** (même si l'on essaie depuis un autre appareil) **et à l'accès Internet utilisé** (même si l'on essaie un autre compte).
- L'application affiche : « Trop de tentatives échouées pour ce compte. Réessayez dans N min. » ou « Trop de tentatives échouées pour ce adresse IP. Réessayez dans N min. ». N est le nombre de minutes restantes.
- Une connexion réussie remet le compteur à zéro.
- **Que faire** : attendre la fin du délai. Si vous avez oublié votre mot de passe, utilisez « Mot de passe oublié ? » plutôt que de multiplier les essais.

### 1.8 Session, déconnexion, retour après reconnexion

- **Durée de session** : vous restez connecté tant que vous utilisez l'application. Le renouvellement se fait automatiquement en arrière-plan. Après **30 jours sans utilisation** (valeur réglable de 1 à 90 jours, voir partie 6), vous devez vous reconnecter. L'application affiche alors : « Session expirée après inactivité : reconnectez-vous. »
- **Fermeture forcée de toutes vos sessions**, sur tous vos appareils, dans ces cas : réinitialisation de votre mot de passe, mot de passe temporaire défini par l'administrateur, réinitialisation de votre double authentification.
- **Se déconnecter** : en bas du menu latéral, icône ⏻ « Se déconnecter ». Vous revenez à la page d'accueil publique. Sur un ordinateur partagé, déconnectez-vous toujours.
- **Retour après reconnexion** : si vous ouvrez un lien (par exemple dans un email) alors que votre session a expiré, l'application vous demande de vous connecter, puis **rouvre directement la page visée**, y compris après la double authentification. Après une déconnexion volontaire, vous arrivez sur le « Tableau de bord ».
- La « déconnexion de tous les appareils » et la liste de vos sessions ouvertes n'ont pas d'écran (à confirmer). Pour fermer toutes vos sessions, changez votre mot de passe.

### 1.9 Messages d'accès

| Message affiché | Signification | Que faire |
|---|---|---|
| « Identifiants invalides » | Adresse ou mot de passe inexact | Vérifiez l'adresse (c'est votre identifiant) ; sinon « Mot de passe oublié ? » |
| « Votre demande d'accès est en cours d'examen par un administrateur. Vous recevrez un accès dès qu'elle sera approuvée. » | Demande non encore approuvée | Attendre l'email d'activation ; relancer l'administrateur système |
| « Votre compte a été suspendu. Contactez un administrateur pour plus d'informations. » | Compte suspendu | Contacter l'administrateur système |
| « Ce compte a été supprimé. Contactez un administrateur pour plus d'informations. » | Compte désactivé | Contacter l'administrateur système |
| « Compte introuvable ou inactif » | Compte suspendu ou désactivé pendant votre session | Contacter l'administrateur système |
| « Code de vérification invalide » | Code de double authentification faux | Ressaisir le code en cours |
| « Trop de tentatives échouées pour ce compte. Réessayez dans N min. » | Blocage de 15 minutes | Attendre (voir 1.7) |
| « Session expirée après inactivité : reconnectez-vous. » | Plus de 30 jours sans utilisation | Se reconnecter |
| « Session invalide ou révoquée » / « Jeton d'accès invalide ou expiré » | Session fermée (mot de passe changé, etc.) | Se reconnecter |
| « Lien de réinitialisation invalide ou expiré » | Lien périmé, déjà utilisé ou remplacé | Demander un nouveau lien |
| « Le serveur de l'application ne répond pas. Réessayez dans un instant ; si le problème persiste, prévenez l'administrateur système. » | Application en cours de réveil, de redémarrage ou indisponible | Patienter jusqu'à 50 secondes, réessayer, puis prévenir l'administrateur |
| « Page introuvable » (« Erreur 404 ») — « L'adresse demandée n'existe pas ou n'est plus disponible. Vérifiez le lien, ou repartez du tableau de bord. » | Lien erroné ou page supprimée | Bouton « Retour au tableau de bord » |
| « Chargement impossible. Vérifiez la connexion puis réessayez. » (bandeau rouge) | La page n'a pas pu se charger | Bouton « Réessayer » |
| « Cette fonctionnalité n'est pas accessible aux stagiaires. » | Fonction fermée au rôle stagiaire | Normal ; s'adresser à son encadreur |
| Fenêtre « Confirmez votre identité » — « Cet élément est protégé. Saisissez votre mot de passe pour l'ouvrir ; la confirmation reste valable 10 minutes. » | Élément protégé (par exemple un dossier du personnel, ou l'activation de la double authentification) | Saisir « Votre mot de passe » (et le « Code de l'application d'authentification » si la double authentification est active), puis « Confirmer » |
| « Mot de passe incorrect » | Erreur dans la fenêtre « Confirmez votre identité » | Ressaisir le mot de passe |
| « Saisissez aussi le code de votre application d'authentification. » | Double authentification active | Saisir aussi le code |

---

## 2. Se repérer dans l'interface

### 2.1 Organisation de l'écran

Une fois connecté, l'écran comporte quatre zones.

**1. Le menu latéral (à gauche)**
- En haut : le logo, « DNPEC » et « Espace de travail ».
- Au milieu : les rubriques « Général », « Personnel » et, selon votre rôle, « Administration ». L'entrée de la page ouverte est mise en évidence par un trait doré.
- En bas : vos initiales, « Prénom Nom », votre fonction (si elle n'est pas renseignée, c'est le code de votre rôle qui s'affiche, par exemple « AGENT ») et trois icônes :
  - 🔔 « Préférences de notification » (voir 2.5) ;
  - 🔒 « Sécurité du compte » (voir 1.5) ;
  - ⏻ « Se déconnecter ».

**2. La bande tricolore et la barre du haut**, de gauche à droite :
- ☰ « Ouvrir le menu » (sur téléphone et petit écran seulement, voir 2.8) ;
- la barre de recherche « Rechercher (3 caractères au moins)… » (absente pour les stagiaires, voir 2.3) ;
- ⇄ « Agir en intérim pour… » (seulement pendant une suppléance, voir 2.6) ;
- ✉ l'enveloppe de la messagerie : une pastille rouge indique le nombre de messages reçus non lus (« 99+ » au-delà de 99). Un clic ouvre « Communication » ;
- 🔔 la cloche des notifications (voir 2.4) ;
- l'avatar : un carré doré avec vos initiales, purement informatif.

**3. Le bandeau d'intérim** (doré, sous la barre du haut), affiché seulement quand vous agissez au nom d'un titulaire (voir 2.6).

**4. La zone de travail** : la page ouverte.

### 2.2 Le menu de chaque rôle

Le menu dépend de **votre propre rôle**, de vos **rôles fonctionnels** (DRH, gestionnaire RH) et du fait d'être stagiaire. Il ne change jamais pendant un intérim : vous gardez votre menu, même quand vous agissez au nom d'un titulaire.

**Tableau croisé — Entrée × rôle** (✔ = entrée affichée)

| Rubrique | Entrée (libellé exact) | DN | DNA | Chef de division | Chef de section | Chef de cellule | Chargé d'études | Assistant(e) de direction | DRH | Administrateur système | Stagiaire |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Général | « Tableau de bord » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Général | « Mes tâches » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Général | « Plan de travail » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Général | « Instructions » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Général | « Communication » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Général | « Archives & documents » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Général | « Réunions » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Général | « Courrier » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (son courrier personnel) | |
| Général | « Logistique » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Général | « Aide » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Personnel | « Dossier du personnel » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Personnel | « Stagiaires » (« Mon stage » pour le stagiaire) | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ | | ✔ (« Mon stage ») |
| Personnel | « Congés & absences » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Personnel | « Documents générés » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Personnel | « Ressources humaines » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Personnel | « Annuaire » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Personnel | « Organisation » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Personnel | « Boîte à suggestions » | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| Personnel | « Agents » | | | | | | | | ✔ | | |
| Personnel | « Suppléances » | ✔ | ✔ | ✔ | ✔ | ✔ | | | | | |
| Personnel | « Journal d'audit » | | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| Administration | « Utilisateurs » | ✔ (lecture) | ✔ (lecture) | | | | | | | ✔ | |
| Administration | « Paramétrage et supervision » | ✔ (lecture) | ✔ (lecture) | | | | | | | ✔ | |
| Administration | « Journal d'audit » | ✔ | ✔ | | | | | | | ✔ | |
| Administration | « Courrier » (paramétrage du courrier) | | | | | | | | | ✔ | |
| Administration | « Logistique » (paramétrage de la logistique) | | | | | | | | | ✔ | |
| Administration | « Stages (réglages) » | | | | | | | | | ✔ | |

Remarques :
- La colonne DRH vaut pour le compte de rôle DRH, qui détient d'office le rôle fonctionnel DRH.
- Le contenu de chaque page (onglets, boutons) dépend ensuite de vos droits. Par exemple, « Ressources humaines » n'ouvre que les onglets auxquels vous avez droit.

#### DN (Directeur National)
- **Général** : « Tableau de bord », « Mes tâches », « Plan de travail », « Instructions », « Communication », « Archives & documents », « Réunions », « Courrier », « Logistique », « Aide ».
- **Personnel** : « Dossier du personnel », « Stagiaires », « Congés & absences », « Documents générés », « Ressources humaines », « Annuaire », « Organisation », « Boîte à suggestions », « Suppléances ».
- **Administration** : « Utilisateurs » (consultation seulement), « Paramétrage et supervision » (consultation seulement), « Journal d'audit ».
- Captures : 02-interface-01-menu-direction-dn.png

#### DNA (Directeur National Adjoint)
- Menu identique à celui du DN.
- Captures : 02-interface-02-menu-direction-dna.png

#### Chef de division
- **Général** : les 10 entrées (« Tableau de bord » à « Aide »).
- **Personnel** : « Dossier du personnel », « Stagiaires », « Congés & absences », « Documents générés », « Ressources humaines », « Annuaire », « Organisation », « Boîte à suggestions », « Suppléances », « Journal d'audit ».
- Pas de rubrique « Administration ».
- Captures : 02-interface-03-menu-chef-division.png

#### Chef de section
- Menu identique à celui du chef de division.
- Captures : 02-interface-04-menu-chef-section.png

#### Chef de cellule
- Menu identique à celui du chef de division.
- Captures : 02-interface-05-menu-chef-cellule.png

#### Chargé d'études
- **Général** : les 10 entrées.
- **Personnel** : « Dossier du personnel », « Congés & absences », « Documents générés », « Ressources humaines », « Annuaire », « Organisation », « Boîte à suggestions », « Journal d'audit ».
- Ni « Stagiaires », ni « Suppléances », ni « Administration ».
- Captures : 02-interface-06-menu-charge-etudes-tuteur.png

#### Assistant(e) de direction
- Menu identique à celui du chargé d'études.
- L'assistant(e) voit dans les pages ce que voit la personne assistée, mais n'a pas son autorité.
- Captures : 02-interface-07-menu-assistant.png

#### DRH
- **Général** : les 10 entrées.
- **Personnel** : « Dossier du personnel », « Stagiaires », « Congés & absences », « Documents générés », « Ressources humaines », « Annuaire », « Organisation », « Boîte à suggestions », « Agents », « Journal d'audit ».
- Captures : 02-interface-08-menu-drh.png

#### Administrateur système
- **Général** : les 10 entrées. Dans « Courrier », l'administrateur ne voit que son courrier personnel.
- **Personnel** : « Dossier du personnel », « Congés & absences », « Documents générés », « Ressources humaines », « Annuaire », « Organisation », « Boîte à suggestions ».
- **Administration** : « Utilisateurs », « Paramétrage et supervision », « Journal d'audit », « Courrier », « Logistique », « Stages (réglages) ». Les réglages des stages portent sur les capacités et le modèle d'attestation, jamais sur le contenu des stages.
- Captures : 02-interface-09-menu-administrateur.png

#### Stagiaire
- **Général** : « Tableau de bord », « Mes tâches », « Communication », « Aide ».
- **Personnel** : « Dossier du personnel », « Mon stage ».
- Pas de barre de recherche. Les autres fonctions lui sont fermées : « Cette fonctionnalité n'est pas accessible aux stagiaires. »
- Captures : 02-interface-10-menu-stagiaire.png

#### Effet des habilitations et des rôles fonctionnels
- **Secrétariat courrier** : aucune entrée de menu en plus, puisque « Courrier » est déjà ouvert à tous. Les fonctions du secrétariat apparaissent dans la page « Courrier », et le guide « secrétariat courrier » s'ajoute dans « Aide ». Captures : 02-interface-11-menu-secretariat-courrier.png
- **Gestionnaire logistique** : aucune entrée de menu en plus. Les fonctions de gestion apparaissent dans « Logistique ». Le guide correspondant s'ajoute dans « Aide », et la carte « Logistique » du tableau de bord affiche les demandes à traiter, les réservations à valider et les articles sous le seuil. Captures : 02-interface-12-menu-gestionnaire-logistique.png
- **Tuteur de stage** : aucune entrée de menu en plus. Le tuteur accède aux stages par ses notifications et par le tableau de bord (bloc « Stagiaires encadrés » s'il est encadreur principal, carte « Stagiaires »). Captures : 02-interface-06-menu-charge-etudes-tuteur.png
- **Rôle fonctionnel DRH** (attribué à un compte qui n'est pas DRH) : ajoute « Stagiaires » et « Agents ». Il ajoute aussi le guide DRH dans « Aide » et les blocs DRH du tableau de bord.
- **Rôle fonctionnel gestionnaire RH** : ajoute « Agents » et le guide DRH dans « Aide ».
- Les habilitations et rôles fonctionnels sont **personnels** : ils ne passent jamais à un suppléant en intérim.

### 2.3 Recherche

**À quoi ça sert** : retrouver en une fois un élément de plusieurs modules.

**Accès** : la barre « Rechercher (3 caractères au moins)… » en haut de l'écran. Elle est ouverte à tous les rôles sauf les stagiaires.

1. Tapez **au moins 3 caractères** (100 au maximum).
2. Appuyez sur Entrée.
3. La page « Résultats pour « … » » s'affiche : « Seuls les éléments que vous pouvez consulter apparaissent. Les filtres détaillés restent disponibles dans chaque module. »

**Catégories** : « Tâches », « Documents », « Courrier » (arrivées et actes), « Annuaire » (personnel actif : nom, prénom, fonction) et « Réunions ».
- Chaque catégorie affiche au plus **5 résultats**. « (5+) » signale qu'il y en a d'autres, accessibles par « Voir tout dans le module ».
- « Aucun résultat. » s'affiche si rien n'est trouvé.
- Cliquez sur un résultat pour l'ouvrir.

**Ce qui n'est jamais cherché** : les plis personnels du courrier, le dossier du personnel, les congés et les instructions. Cherchez-les depuis leur module.

**Message** : « Saisissez au moins 3 caractères dans la barre de recherche. »

**Captures** : 02-interface-14-recherche.png

### 2.4 Cloche et notifications

- La **cloche 🔔** en haut de l'écran porte une pastille rouge avec le nombre de notifications non lues (« 99+ » au-delà de 99).
- Le compteur se met à jour **chaque minute** et à chaque changement de page. Il ne se met pas à jour quand l'onglet est caché : il se rafraîchit dès votre retour.
- **Cliquez sur la cloche** : le panneau « Notifications » s'ouvre avec vos **50 dernières notifications**.
  - Les notifications non lues sont en gras, avec un point rouge et la mention « · non lue ».
  - L'ancienneté s'affiche ainsi : « à l'instant », « il y a N min », « il y a N h », puis la date.
- **Cliquez sur une notification** : elle passe en lue et l'élément concerné s'ouvre (tâche, congé, courrier…).
- Le bouton « Tout marquer comme lu » marque toutes les notifications comme lues.
- Sans notification : « Aucune notification. »
- Pour fermer le panneau, appuyez sur la touche Échap ou cliquez ailleurs.
- Il n'existe pas de page listant toutes les anciennes notifications au-delà des 50 dernières (à confirmer).
- Les notifications apparaissent **toujours immédiatement** dans la cloche. Seuls les emails peuvent être regroupés (voir 2.5).

**Captures** : 02-interface-13-cloche.png

### 2.5 Préférences de notification et résumé de 7 h

**Accès** : en bas du menu latéral, icône 🔔 « Préférences de notification ». L'écran affiche « Mon compte » / « Préférences de notification ». Il est ouvert à tous, stagiaires compris.

Texte affiché : « Les notifications s'affichent toujours immédiatement dans l'application (cloche). Vous choisissez ici comment recevoir les emails. »

**« Emails »** (un seul choix) :
- « **Résumé quotidien** (recommandé) — un seul email par jour regroupant les notifications ordinaires. » C'est le **réglage par défaut**.
- « **Tout immédiatement** — un email par notification. »

**« Heure du résumé (heure de Conakry) »** : de « 00 h 00 » à « 23 h 00 », **7 h 00 par défaut**. Ce champ n'apparaît qu'avec le résumé quotidien.

Bouton **« Enregistrer mes préférences »** → « Préférences enregistrées. » Si des emails attendent, l'écran l'indique : « N email(s) en attente du prochain résumé. »

**Le résumé quotidien**
- Il arrive à l'heure choisie avec l'objet « Résumé quotidien : N notification(s) ».
- Il liste au plus 30 notifications (« … et N autre(s) dans l'application. ») et contient le bouton « Ouvrir l'espace de travail ».
- Il n'est pas envoyé à un compte suspendu ou désactivé.
- Un email que la messagerie n'a pas pu envoyer est retenté pendant 72 heures au plus. Il reste toujours visible dans la cloche.

**Toujours envoyés immédiatement**, quel que soit votre choix : l'écran l'indique ainsi : « Toujours envoyés immédiatement, quel que soit votre choix : sécurité du compte, décision sur une de vos demandes, acte à signer, instruction de la Direction, tâche en retard, rappel ou annulation de réunion, alerte de supervision. » La liste détaillée figure en Annexe B.

**Captures** : 02-interface-15-preferences-notifications.png

### 2.6 Mode intérim (bandeau)

**Qui** : la personne désignée suppléante d'un DN, d'un DNA ou d'un chef (division, section, cellule), pendant la période de la suppléance.

1. En haut de l'écran, cliquez sur **⇄ « Agir en intérim pour… »**. Ce bouton n'apparaît que si vous avez une suppléance **en cours et conforme**.
2. Le menu « Agir au nom de… » propose « Moi-même » et chaque titulaire (nom, rôle, « jusqu'au … »).
3. Choisissez le titulaire. Le **bandeau doré** « Mode intérim » s'affiche en permanence : « Vous agissez au nom de **Nom** (Rôle), jusqu'au <date>. Vos actions sont journalisées « par intérim, au nom de ». »
4. Pour revenir à votre propre compte, cliquez sur **« Quitter l'intérim »** dans le bandeau ou choisissez « Moi-même ».

**Règles**
- Le choix vaut **pour l'onglet** du navigateur seulement. Il est perdu à la fermeture de l'onglet.
- La page se recharge à chaque changement d'identité.
- Pendant l'intérim, les pages, boutons et le tableau de bord suivent le rôle du titulaire. **Votre menu, votre « Aide », vos habilitations (secrétariat courrier, gestionnaire logistique) et vos rôles fonctionnels (DRH…) restent les vôtres.**
- Si la suppléance n'est plus valable, l'intérim s'arrête aussitôt et un bandeau rouge s'affiche : « Intérim pour X interrompu : … ». Exemples :
  - « Aucune suppléance active ne vous autorise à agir au nom de cette personne. » ;
  - « Cette suppléance ne respecte pas la règle de rang comparable ; elle doit être redésignée. »

  Fermez ce bandeau avec ✕.

### 2.7 Tableau de bord de chaque rôle

**Accès** : « Tableau de bord » (première entrée du menu). C'est aussi la page d'arrivée après la connexion. L'écran affiche « Mon périmètre » / « Tableau de bord ».

**Boutons en haut** (tous sauf stagiaire) :
- « Exporter (Excel) » ;
- « Exporter (PDF) » ;
- « Diffuser à une division » (DN, DNA, chef de division) ;
- « + Nouvelle tâche ».

**Indicateurs de tâches** (tous les rôles) :
- « Tâches en cours » (« sur le total de votre périmètre ») ;
- « En retard » (« nécessitent une relance ») ;
- « En attente de validation » (« à examiner ») ;
- « Terminées ce mois » (« sur la période en cours »).

**Blocs propres au rôle** : chaque bloc a un lien « Ouvrir ». Quand un bloc est vide, il affiche le message entre parenthèses.

| Bloc (titre exact) | DN / DNA | Chefs de division, de section, de cellule | DRH | Chargé d'études / assistant(e) | Administrateur système |
|---|---|---|---|---|---|
| « Avancement du plan de travail » (moyenne des objectifs en %, détail par unité ; « Aucun objectif pour l'année. ») | ✔ | | | | |
| « Décisions de réunion non exécutées » (« N en retard · N sans action ») | ✔ | | | | |
| « Instructions non exécutées » (5 au plus, « depuis N j » ; « Toutes les instructions sont exécutées. ») | ✔ | | | | |
| « Absences du jour » (« Aucune absence. ») | ✔ | | ✔ | | |
| « Absences des 7 prochains jours » (« Aucune absence. ») | | ✔ | | | |
| « Demandes de congé en attente de votre avis » (« avis avant le … » ; « Aucun avis attendu de vous. ») | ✔ | ✔ | | | |
| « Demandes en attente de votre décision » (type, jours, avis ; « Aucune décision attendue. ») | | | ✔ | | |
| « Alertes RH » (« N urgente(s) » : « Fins de contrat », « Fins de stage », « Avancements à instruire », « Dossiers incomplets ») | | | ✔ | | |
| « Activités du plan dont je suis responsable » (« Aucune activité à votre nom. ») | | ✔ | | | |
| « Stagiaires encadrés » (« N rapport(s) à valider ») | si encadreur principal | si encadreur principal | si encadreur principal | si encadreur principal | si encadreur principal |
| « Mon solde de congés » (« N j restants sur N » ; « Aucun solde provisionné pour l'année. ») | | ✔ | ✔ | ✔ | ✔ |
| « Mes demandes en cours » (« avis du chef attendu » ou « décision du DRH attendue » ; « Aucune demande en cours. ») | | ✔ | ✔ | ✔ | ✔ |
| « Réunions des 7 prochains jours » (« Aucune réunion prévue. ») | ✔ | ✔ | ✔ | ✔ | ✔ |
| « Comptes en attente d'activation » (« Aucune demande d'accès en attente. ») | | | | | ✔ |

- Une personne qui est à la fois chef et DRH (rôle fonctionnel) cumule les blocs des deux colonnes.
- Les absences montrent le nom, le type de congé et les dates, jamais le motif médical.
- En intérim, les blocs suivent le rôle du titulaire. Les blocs DRH restent liés à la personne.

**Cartes complémentaires**, affichées seulement s'il y a quelque chose à traiter (jamais pour un stagiaire) :
- « 📨 Courrier » avec « Ouvrir le courrier → ». Compteurs possibles : « N à imputer », « N à traiter », « N en retard », « N à viser », « N à signer », « N à expédier », « N à prendre en connaissance », « N brouillon(s) à reprendre ». Si les compteurs ne se chargent pas : « Courrier : compteurs momentanément indisponibles. »
- « 🎓 Stagiaires — N élément(s) à traiter » avec « Ouvrir → » : périodes à accepter, évaluations à rédiger ou à viser.
- « 🧰 Logistique — … » avec « Ouvrir → » : « N demande(s) à valider ». Pour le gestionnaire logistique, s'ajoutent « N à traiter », « N réservation(s) à valider » et « N article(s) sous le seuil ».

**« Suivi des tâches »** (vue tableau ou calendrier) : « Tâches en cours, et tâches terminées depuis moins de 30 jours. » Au-delà de 300 tâches : « Les 300 aux échéances les plus proches sont affichées ; l'export Excel donne la liste complète. »

**Par rôle, en résumé**
- **DN, DNA** : indicateurs, puis « Avancement du plan de travail », « Décisions de réunion non exécutées », « Instructions non exécutées », « Absences du jour », « Demandes de congé en attente de votre avis » et « Réunions des 7 prochains jours ».
- **Chef de division, chef de section, chef de cellule** : indicateurs, puis « Absences des 7 prochains jours », « Demandes de congé en attente de votre avis », « Activités du plan dont je suis responsable », « Mon solde de congés », « Mes demandes en cours » et « Réunions des 7 prochains jours ».
- **DRH** : indicateurs, puis « Absences du jour », « Demandes en attente de votre décision », « Alertes RH », « Mon solde de congés », « Mes demandes en cours » et « Réunions des 7 prochains jours ».
- **Chargé d'études, assistant(e) de direction** : indicateurs, puis « Mon solde de congés », « Mes demandes en cours » et « Réunions des 7 prochains jours ».
- **Administrateur système** : comme le chargé d'études, plus « Comptes en attente d'activation ».
- **Stagiaire** : les indicateurs et le « Suivi des tâches » de ses propres tâches seulement. Ni blocs, ni cartes, ni boutons.
- **Tuteur de stage (encadreur principal)** : le bloc « Stagiaires encadrés » s'ajoute à ceux de son rôle.

**Captures** : 12-telephone-01-tableau-de-bord.png

### 2.8 Sur téléphone

- Sur un écran étroit, le menu latéral est masqué. Touchez **☰ « Ouvrir le menu »** en haut à gauche pour le faire glisser.
- Pour le fermer, touchez ✕ « Fermer le menu » ou la zone assombrie. Le menu se referme aussi tout seul quand vous ouvrez une page.
- La barre du haut garde la recherche, l'enveloppe, la cloche et l'avatar. Le libellé « Agir en intérim pour… » est réduit à l'icône ⇄.
- Le panneau des notifications occupe toute la largeur de l'écran.
- Le bas du menu (🔔 préférences, 🔒 sécurité, ⏻ déconnexion) reste accessible dans le menu ouvert.

**Captures** : 12-telephone-01-tableau-de-bord.png, 12-telephone-02-menu.png

---

## 3. Les modules

Chaque module est présenté de la même façon : à quoi il sert, accès, écran et onglets, actions et formulaires, statuts, qui peut faire quoi, règles automatiques, messages, captures.

### 3.1 Tâches

**À quoi sert ce module**

Le module Tâches sert à confier du travail, à le suivre et à le faire valider. Une tâche passe par quatre étapes : « À faire », « En cours », soumise pour validation, puis « Terminée ». Son avancement se calcule tout seul, à partir de son étape ou de ses sous-tâches. La personne qui a confié le travail, ou un chef, valide la tâche ou la renvoie avec un motif.

**Accès**

- Menu « Général » → « Tableau de bord » : c'est là que vous **créez** une tâche (« + Nouvelle tâche ») et que vous la diffusez à toute une division (« Diffuser à une division »). Vous y voyez aussi le « Suivi des tâches » de tout votre périmètre. Tout le monde voit cette entrée.
- Menu « Général » → « Mes tâches » : vos propres tâches seulement, celles qui vous sont assignées et celles que vous avez créées. Tout le monde voit cette entrée, stagiaire compris.
- Les notifications et emails liés à une tâche ouvrent directement sa fiche, à l'intérieur de « Mes tâches ».
- Vous pouvez aussi créer une tâche depuis la fiche d'une activité du plan de travail (voir 3.3) ou depuis la fiche d'une personne dans l'Annuaire (« Assigner une tâche », voir 3.7).

**Écran et onglets**

*Tableau de bord* (en-tête « Mon périmètre » / « Tableau de bord ») :

- Boutons en haut à droite (absents pour un stagiaire) :
  - « Exporter (Excel) » ;
  - « Exporter (PDF) » ;
  - « Diffuser à une division » (DN, DNA, chef de division) ;
  - « + Nouvelle tâche ».
- Quatre indicateurs, qui comptent les tâches principales de votre périmètre (les sous-tâches ne sont pas comptées) :

| Indicateur | Ce qu'il compte |
|---|---|
| « Tâches en cours » | « sur le total de votre périmètre » |
| « En retard » | « nécessitent une relance » |
| « En attente de validation » | « à examiner » |
| « Terminées ce mois » | « sur la période en cours » |

- Bloc « Suivi des tâches » : « Tâches en cours, et tâches terminées depuis moins de 30 jours. »
  - Au plus 300 tâches, échéances les plus proches d'abord. S'il y en a davantage, l'écran l'indique : « Les 300 aux échéances les plus proches sont affichées ; l'export Excel donne la liste complète. »
  - Deux présentations au choix : « Kanban » ou « Calendrier ».

*Mes tâches* (titre « Mes tâches ») :

- Onglets : « Assignées à moi » et « Créées par moi », chacun suivi de son nombre de tâches.
- Présentation au choix : « Kanban » ou « Calendrier ».
- En Kanban, quatre colonnes : « À faire », « En cours », « Soumises », « Terminées ». Une colonne vide affiche « Aucune tâche ».
- Chaque carte montre :
  - le titre ;
  - l'étiquette « Confidentiel » si la tâche n'est pas publique ;
  - la barre d'avancement ;
  - les initiales des personnes assignées (trois au plus) ;
  - l'échéance, en rouge précédée de ⚠ si elle est dépassée.
- Seules les tâches principales sont listées. Une sous-tâche ne s'affiche pas comme une carte : vous la trouvez dans la fiche de sa tâche principale.

*Fiche d'une tâche* (volet qui s'ouvre à droite quand vous cliquez sur une carte), de haut en bas :

1. Le rattachement (division → section ou cellule), le titre et, si la case a été cochée à la création, l'étiquette « Pièce jointe obligatoire avant soumission ».
2. Une frise de 4 étapes : « À faire », « En cours », « Validation », « Terminée ».
3. Les rubriques :
   - « RESPONSABLES » (« Aucun » s'il n'y en a pas) ;
   - « PRIORITÉ » (« Urgent », « Normal », « Faible ») ;
   - « ÉCHÉANCE » (« Non définie » s'il n'y en a pas) ;
   - « CONFIDENTIALITÉ » (« Public interne », « Confidentiel », « Très confidentiel »).
4. Les boutons d'action (voir plus bas).
5. « Avancement » : barre et pourcentage, avec l'une de ces deux phrases :
   - « Calculé automatiquement à partir des sous-tâches terminées. » ;
   - « Calculé automatiquement selon le statut : à faire 0 %, en cours 50 %, soumise 90 %, terminée 100 %. »
6. « Description ».
7. « Sous-tâches (x/y) » : une case à cocher par sous-tâche, et le champ « Ajouter une sous-tâche… ».
8. « Pièces jointes » : liste des fichiers (cliquez sur un nom pour le télécharger), lien « Supprimer », sélecteur de fichiers et bouton « Ajouter ». Sans fichier : « Aucune pièce jointe. »
9. « Documents issus » : documents d'archives liés à la tâche, avec le bouton « Déposer un document ». Sans document : « Aucun document déposé depuis cet écran. »
10. « Commentaires » : champ « Écrire un commentaire… (@ pour mentionner) ». Sans commentaire : « Aucun commentaire pour l'instant. »

**Actions et formulaires**

*« + Nouvelle tâche » (Tableau de bord) → fenêtre « Nouvelle tâche »*

Depuis l'Annuaire, la fenêtre s'intitule « Nouvelle tâche pour <Prénom Nom> » et la personne est déjà cochée.

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Titre » | obligatoire | 2 à 300 caractères |
| « Description » | facultatif | texte libre |
| « Priorité » | facultatif | « Faible », « Normal » (par défaut), « Urgent » |
| « Échéance » | facultatif | une date |
| « Activité du plan de travail » | facultatif | « Aucune » ou « activité — objectif (unité) ». Le champ n'apparaît que si au moins une activité de plan de travail vous est accessible (en cours, ou terminée depuis moins d'un mois) |
| « Documents de référence » | facultatif | un ou plusieurs fichiers ; l'écran affiche « N fichier(s) sélectionné(s) » ; 25 Mo au plus par fichier, 10 fichiers au plus par envoi |
| Case « Document obligatoire avant soumission pour validation » | facultatif | si vous la cochez, la tâche ne pourra pas être soumise tant qu'aucune pièce jointe n'est déposée |
| « Assigner à » | facultatif | cases à cocher : les personnes de votre périmètre (vous n'y figurez pas), avec leur fonction |

Boutons : « Annuler » et « Créer la tâche ». Pendant l'envoi, le bouton affiche « Création… ». « Créer la tâche » reste grisé tant que le titre est vide.

Ce que fait l'application :
- elle rattache la tâche à votre division, section ou cellule ;
- la tâche est toujours « Public interne » : vous ne choisissez pas la confidentialité à l'écran ;
- après la création, la fiche de la tâche s'ouvre ;
- chaque personne assignée reçoit la notification « Nouvelle tâche assignée ».

Si les documents de référence n'ont pas pu être joints, la tâche est quand même créée et ce message s'affiche : « La tâche a été créée, mais les documents de référence n'ont pas pu être joints. Réessayez depuis le détail de la tâche. »

*« Diffuser à une division » (Tableau de bord ; DN, DNA, chef de division) → fenêtre « Diffuser une tâche à une division »*

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Division » | obligatoire | un chef de division ne voit que la sienne ; seules les divisions actives sont proposées. Sans choix possible : « Aucune division disponible » |
| « Mode de diffusion » | obligatoire | « Tâches individuelles » (par défaut) : « Une tâche par membre actif, statut indépendant pour chacune. » ; « Tâche collective » : « Une seule tâche, tous les membres actifs en co-responsables. » |
| « Titre » | obligatoire | 2 à 300 caractères |
| « Description » | facultatif | |
| « Priorité » | facultatif | « Faible », « Normal », « Urgent » |
| « Échéance » | facultatif | |
| « Documents de référence » | facultatif | « N fichier(s) — joints à chaque tâche créée » |
| Case « Document obligatoire avant soumission pour validation » | facultatif | |

Boutons : « Annuler » et « Diffuser » (« Diffusion… » pendant l'envoi). Vous-même n'êtes pas compté parmi les membres de la division qui reçoivent la tâche.

*Boutons de la fiche d'une tâche*

| Bouton | Quand il apparaît | Effet |
|---|---|---|
| « Démarrer » | tâche « À faire », pour son créateur ou une personne assignée | la tâche passe « En cours » (50 %) |
| « Soumettre pour validation » | tâche « En cours », pour son créateur ou une personne assignée comme « Responsable » | la tâche passe en validation (90 %) ; le créateur est prévenu |
| « Valider » | tâche soumise ; jamais pour une personne assignée | la tâche passe « Terminée » (100 %) ; les personnes assignées sont prévenues |
| « Rejeter » | même condition que « Valider » | ouvre la zone « Motif du rejet (visible par la personne assignée)… » avec « Confirmer le rejet » (grisé tant que le motif fait moins de 2 caractères) et « Annuler » |
| Case d'une sous-tâche | toujours affichée | coche ou décoche la sous-tâche (« Cocher comme terminée » / « Décocher ») |
| « Ajouter une sous-tâche… » | toujours affiché | tapez le titre puis appuyez sur Entrée |
| « Ajouter » (pièces jointes) | pour le créateur et les personnes assignées | dépose les fichiers choisis (« Envoi… » pendant l'envoi) |
| « Supprimer » (pièce jointe) | pour la personne qui a déposé le fichier, ou pour le créateur de la tâche | retire le fichier |
| Commentaire | toujours affiché | 1 à 4 000 caractères, envoyé par Entrée ; tapez « @ » puis un nom pour mentionner quelqu'un (5 propositions au plus) |

Quand une tâche est terminée, la fiche affiche l'étiquette « Terminée » et le commentaire de validation éventuel. Après un rejet, la tâche revient « En cours » et la fiche affiche « Rejet : <motif> ». Le motif est aussi publié dans les commentaires, précédé de « Rejet : ».

*Exports (Tableau de bord)*

- « Exporter (Excel) » télécharge le fichier « taches_AAAA-MM-JJ.xlsx ».
  - Il contient une feuille « Tâches » avec les colonnes « Titre », « Statut », « Priorité », « Confidentialité », « Échéance », « Responsables », « Avancement », « Rattachement », « Créée le ».
  - On y trouve toutes les tâches principales que vous avez le droit de voir, sans la limite de 300 ni le filtre des 30 jours de l'écran.
- « Exporter (PDF) » télécharge « tableau_de_bord_AAAA-MM-JJ.pdf ».
- Pendant la préparation, les boutons affichent « Export… ».

*Tâche créée à partir d'un courrier* (module Courrier)

Dans la fiche d'un courrier arrivé, la personne qui a imputé le courrier voit le bouton « Convertir en tâche ». Il ouvre la fenêtre « Convertir en tâche » :

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Titre de la tâche » | facultatif | 300 caractères au plus ; prérempli « Courrier <numéro> — <objet> » ; absent pour un courrier confidentiel |
| « Échéance de la tâche » | obligatoire | préremplie avec l'échéance de l'imputation |

Validez avec « Créer la tâche ».
- La tâche est assignée à la personne imputée, qui est prévenue.
- Pour un courrier confidentiel, la tâche porte un titre neutre (« Traitement du courrier <numéro> »), sans les instructions, au niveau « Très confidentiel ».
- La fiche du courrier affiche ensuite « Tâche associée → ».

**Statuts et étapes**

| Statut (colonne / étape) | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « À faire » (0 %) | la tâche est créée, le travail n'a pas commencé | le créateur ou toute personne assignée, avec « Démarrer » |
| « En cours » (50 %) | le travail est en cours, ou la tâche a été renvoyée après un rejet | le créateur ou une personne assignée comme « Responsable », avec « Soumettre pour validation » |
| « Soumises » / « Validation » (90 %) | le travail est terminé et attend une décision | le créateur de la tâche, ou un chef qui a autorité sur **toutes** les personnes assignées (DN et DNA sur tout le monde) : « Valider » mène à « Terminée », « Rejeter » ramène à « En cours » |
| « Terminées » / « Terminée » (100 %) | travail validé | étape finale |

Sous-tâches : elles ne passent pas par la validation. On les coche (terminée) ou décoche (à faire). Quand une tâche a des sous-tâches, son avancement est la part des sous-tâches cochées.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Voir une tâche | Son créateur et les personnes assignées, toujours. En plus : DN et DNA, toutes les tâches ; chef de division, sa division ; chef de cellule, sa cellule ; chef de section et chargé d'études, leur section (ou cellule), tâches publiques seulement ; assistant(e) de direction, comme son supérieur, tâches publiques seulement. L'administrateur système, le DRH et le stagiaire ne voient que leurs propres tâches | « Tâche hors de votre périmètre » |
| Voir une tâche « Confidentiel » | Son créateur et les personnes assignées ; chef de division, chef de cellule, DN, DNA | « Tâche hors de votre périmètre » |
| Voir une tâche « Très confidentiel » | Son créateur et les personnes assignées ; DN, DNA | « Tâche hors de votre périmètre » |
| Créer une tâche | Tous sauf le stagiaire | « Cette fonctionnalité n'est pas accessible aux stagiaires. » |
| Assigner quelqu'un d'autre que soi | DN et DNA (tout le monde) ; chef de division (sa division) ; chef de section (sa section) ; chef de cellule (sa cellule). Tout le monde peut s'assigner soi-même | « Seuls le créateur (ou la personne assignée/concernée) et son supérieur hiérarchique direct peuvent effectuer cette action. » |
| Diffuser à une division | DN, DNA (toute division) ; chef de division (la sienne) | « Seuls le Chef de la division concernée et la Direction peuvent diffuser une tâche à toute une division. » |
| Démarrer | Créateur, toute personne assignée (stagiaire compris) | « Seuls le créateur ou une personne assignée peuvent effectuer cette action. » |
| Soumettre pour validation | Créateur, personne assignée comme « Responsable » (stagiaire compris) | « Seuls le créateur ou un responsable assigné peuvent effectuer cette action. » |
| Valider ou rejeter | Créateur (ou son suppléant) ; chef ayant autorité sur toutes les personnes assignées. Jamais une personne assignée. Si la tâche n'a personne d'assigné : seul le supérieur direct du créateur | « Une personne assignée ne peut pas valider ou rejeter sa propre tâche. » ou « Seuls le créateur de la tâche ou un supérieur hiérarchique de toutes les personnes assignées peuvent la valider ou la rejeter. » |
| Ajouter une sous-tâche | Créateur de la tâche ou son supérieur direct (pas le stagiaire) | aucun message à l'écran (voir Questions fréquentes) |
| Cocher une sous-tâche | Créateur, personne assignée, ou leur supérieur direct | « Seuls le créateur, une personne assignée, ou leur supérieur hiérarchique direct peuvent cocher cette sous-tâche. » |
| Déposer une pièce jointe | Créateur, personne assignée, supérieur direct du créateur | « Seuls le créateur, un supérieur hiérarchique, ou une personne assignée peuvent déposer une pièce jointe. » |
| Commenter | Toute personne qui voit la tâche (stagiaire compris) | « Tâche hors de votre périmètre » |
| Exporter (Excel, PDF) | Tous sauf le stagiaire | boutons absents pour le stagiaire |
| Convertir un courrier en tâche | La personne qui a fait l'imputation | « Seul l'auteur de l'imputation peut la convertir en tâche. » |

Remarque : l'administrateur système n'a aucun droit sur le contenu des tâches des autres. Pour les tâches, il est traité comme un chargé d'études.

**Règles automatiques**

- **Avancement** : il est toujours calculé, jamais saisi.
  - Sans sous-tâche : 0 % (à faire), 50 % (en cours), 90 % (soumise), 100 % (terminée).
  - Avec sous-tâches : pourcentage de sous-tâches cochées.
- **Alerte de veille** : chaque jour à 7 h (heure de Conakry), pour toute tâche non terminée dont l'échéance tombe le lendemain, chaque personne assignée reçoit « Échéance demain » : « « <titre> » arrive à échéance demain. » Elle est envoyée une seule fois par tâche.
- **Alerte de retard** : chaque jour à 7 h, pour toute tâche non terminée dont l'échéance est dépassée, le chef le plus proche de chaque personne assignée reçoit « Tâche en retard » : « « <titre> » (<noms>) a dépassé son échéance du <date>. » Elle est envoyée une seule fois par tâche, avec un email immédiat. Une tâche sans personne assignée ne déclenche aucune alerte.
- **Notifications du circuit** :
  - à l'assignation : « Nouvelle tâche assignée » (ou « Tâche assignée ») à la personne assignée ;
  - à la soumission : « Tâche soumise pour validation » au créateur ;
  - à la validation : « Tâche validée » aux personnes assignées ;
  - au rejet : « Tâche rejetée — à reprendre » aux personnes assignées, avec le motif ;
  - à la mention dans un commentaire : « Vous avez été mentionné » à la personne citée.
- **Emails** : sauf l'alerte de retard (envoyée tout de suite), ces notifications partent par email dans le « Résumé quotidien », à moins que vous ayez choisi « Tout immédiatement » dans vos préférences de notification. Elles apparaissent toujours tout de suite dans la cloche.
- **Clôtures liées** : quand une tâche issue d'une décision de réunion est validée, la décision est clôturée. Quand une tâche issue d'un courrier est validée, l'imputation est marquée traitée (« Tâche liée terminée. ») et le statut du courrier est mis à jour.

**Messages que vous pouvez voir**

- « Cette tâche ne peut être démarrée que depuis le statut "À faire". » → la tâche a déjà été démarrée ; rechargez la page.
- « Cette tâche ne peut être soumise que depuis le statut "En cours". » → démarrez d'abord la tâche.
- « Cette tâche exige au moins une pièce jointe avant de pouvoir être soumise pour validation. » → déposez un fichier dans « Pièces jointes » → « Ajouter », puis soumettez.
- « Seule une tâche "Soumise pour validation" peut être validée. » / « Seule une tâche "Soumise pour validation" peut être rejetée. » → la tâche a déjà été traitée ou n'est pas encore soumise.
- « L'avancement se calcule automatiquement : à partir des sous-tâches, ou du statut de la tâche (démarrer, soumettre, valider). » → l'avancement ne se saisit pas.
- « Tâche hors de votre périmètre » → vous n'avez pas accès à cette tâche (lien reçu, tâche confidentielle…).
- « Tâche introuvable » → la tâche a été supprimée.
- « Aucun fichier reçu. » → choisissez au moins un fichier avant « Ajouter ».
- « La division "<nom>" est suspendue — aucune nouvelle diffusion de tâche n'y est possible tant qu'elle n'est pas réactivée. » → choisissez une autre division.
- « Cette division n'a aucun membre actif — impossible de diffuser une tâche. » → la division n'a personne à qui diffuser.
- « Les tâches ont été créées, mais les documents de référence n'ont pas pu être joints à toutes. Vérifiez chaque tâche et réessayez si besoin. » → ajoutez les fichiers depuis la fiche de chaque tâche.
- « Votre rôle ne permet pas de créer une tâche à ce niveau de confidentialité. » → niveau de confidentialité réservé à un rôle supérieur.
- « Export impossible » → l'export a échoué ; reconnectez-vous et réessayez.
- Conversion d'un courrier :
  - « Cette imputation est déjà traitée. » → l'imputation est close ;
  - « Cette imputation a déjà une tâche associée. » → la tâche existe déjà ; ouvrez « Tâche associée → » ;
  - « Une échéance est obligatoire pour convertir en tâche. » → renseignez « Échéance de la tâche » ;
  - « La personne imputée n'a pas de compte actif. » → le compte de la personne est suspendu ou désactivé.

**Captures**

- 03-taches-01-mes-taches.png
- 03-taches-02-nouvelle-tache.png
- 03-taches-03-detail-tache-a-valider.png
- 12-telephone-01-tableau-de-bord.png
- 12-telephone-04-taches.png
- 07-courrier-05-tiroir-arrivee-imputer.png (bouton « Convertir en tâche »)

---

### 3.2 Projets

**À quoi sert ce module**

L'application n'a **aucun écran « Projets »**. Il n'y a ni entrée de menu, ni bouton, ni fenêtre pour créer ou consulter un projet. Pour regrouper et piloter le travail, utilisez :

- le **Plan de travail** (3.3) : objectifs de l'année → activités datées (responsable, indicateur) → tâches. L'avancement est calculé automatiquement ;
- le **Tableau de bord** et « Mes tâches » (3.1) pour suivre les tâches elles-mêmes.

**Accès**

Aucun : le module n'est pas proposé dans le menu.

**Écran et onglets**

Aucun.

**Actions et formulaires**

Aucune action à l'écran. Pour rattacher une tâche à un ensemble de travail, choisissez son « Activité du plan de travail » dans la fenêtre « Nouvelle tâche ».

**Statuts et étapes**

Sans objet.

**Qui peut faire quoi**

Sans objet à l'écran.

**Règles automatiques**

Aucune.

**Messages que vous pouvez voir**

Aucun.

**Captures**

- 03-taches-04-plan-de-travail.png (outil à utiliser à la place)

---

### 3.3 Plan de travail

**À quoi sert ce module**

Le plan de travail présente, pour chaque unité et chaque année, les **objectifs**, les **activités** datées qui les réalisent (avec un responsable et un indicateur) et les **tâches** rattachées à chaque activité. L'avancement d'une activité et d'un objectif est calculé à partir des tâches. Personne ne le saisit.

**Accès**

Menu « Général » → « Plan de travail ». Tout le monde voit cette entrée, sauf le stagiaire. Les notifications de responsable d'activité ouvrent directement la fiche de l'activité.

**Écran et onglets**

- Titre « Plan de travail », avec la phrase : « Objectifs de l'année, activités datées (responsable, indicateur) et tâches qui les réalisent. L'avancement est calculé à partir des tâches, jamais saisi. »
- Bouton « + Nouvel objectif », visible seulement si vous gérez au moins une unité.
- Filtres :
  - « Année » : année précédente, année en cours ou année suivante ;
  - « Unité » : « Toutes les unités visibles » ou une unité précise.
- Pour chaque objectif :
  - le nom de l'unité, le libellé, la description et la barre d'avancement (en %) ;
  - les boutons « + Activité » et « Supprimer », selon vos droits ;
  - la liste des activités. Chaque ligne indique « <responsable> · du <date> au <date> · <indicateur> — cible : <cible> · N tâche(s) », la barre d'avancement et l'étiquette « En retard » le cas échéant.
- Sans objectif : « Aucun objectif pour <année>. » Sans activité : « Aucune activité. »
- *Fiche d'une activité* (cliquez sur une activité) :
  - « <unité> · Objectif « … » (<année>) » ;
  - les rubriques « Responsable », « Période », « Indicateur », « Avancement » ;
  - le bloc « Tâches (N) », avec la présentation « Kanban » ou « Calendrier » et les boutons « + Nouvelle tâche », « Modifier », « Supprimer ». Cliquer sur une tâche ouvre sa fiche ;
  - sans tâche : « Aucune tâche rattachée : l'avancement reste à 0 %. »

**Actions et formulaires**

*« + Nouvel objectif » → fenêtre « Nouvel objectif <année> »* (l'année est celle du filtre)

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Unité » | obligatoire | seulement les unités dont vous gérez le plan |
| « Libellé de l'objectif » | obligatoire | 3 à 300 caractères |
| « Description » | facultatif | 2 000 caractères au plus |

Boutons « Annuler » et « Enregistrer ».

*« + Activité » (sur un objectif) → fenêtre « Nouvelle activité — <objectif> »*

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Libellé de l'activité » | obligatoire | 3 à 300 caractères |
| « Responsable » | obligatoire | « Choisir… » ; la liste propose les membres actifs de l'unité et de ses sous-unités, stagiaires exclus (pour la Direction : tout le personnel actif hors stagiaires) |
| « Début » | obligatoire | date |
| « Fin » | obligatoire | date, pas avant le début |
| « Indicateur » | obligatoire | 3 à 300 caractères (exemple affiché : « Ex. notes publiées ») |
| « Cible » | facultatif | 200 caractères au plus (exemple : « Ex. 1 par mois ») |

Boutons « Annuler » et « Enregistrer ».

*Boutons de la fiche d'une activité*

- « + Nouvelle tâche » : ouvre la fenêtre « Nouvelle tâche » (voir 3.1) avec l'activité déjà choisie.
- « Modifier » : mêmes champs que la création, bouton « Enregistrer l'activité » (et « Annuler »).
- « Supprimer » : confirmation « Supprimer cette activité ? ». N'apparaît que si aucune tâche n'est rattachée à l'activité.

*« Supprimer » sur un objectif* : confirmation « Supprimer cet objectif ? ». N'apparaît que si l'objectif n'a plus aucune activité.

**Statuts et étapes**

Le plan de travail n'a pas de statut à faire avancer. Ce qui est suivi, c'est l'avancement :

| État | Signification | Qui le fait évoluer |
|---|---|---|
| Avancement d'une activité (%) | moyenne de l'avancement de ses tâches principales (0 % sans tâche) | les personnes qui font avancer les tâches (démarrer, soumettre, valider, cocher les sous-tâches) |
| « En retard » (activité) | date de fin dépassée et avancement inférieur à 100 % | se lève quand les tâches sont terminées |
| Avancement d'un objectif (%) | moyenne de l'avancement de ses activités | idem |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Lire le plan | Tous sauf le stagiaire : le plan de son unité et des unités au-dessus (dont la Direction), plus les unités qu'on gère. DN et DNA lisent tout. L'assistant(e) de direction lit comme son supérieur. Le responsable d'une activité peut toujours ouvrir sa fiche | « Plan de travail hors de votre périmètre. » / « Activité hors de votre périmètre. » |
| Créer, modifier ou supprimer un objectif ou une activité | DN, DNA (toutes les unités) ; chef de division (sa division et ses sections) ; chef de section (sa section) ; chef de cellule (sa cellule). Jamais l'assistant(e) de direction, le chargé d'études, le DRH ou l'administrateur système | « Le plan de travail d'une unité est géré par son chef (et le DN, la DNA). » ou « Vous ne gérez pas le plan de cette unité. » |
| Créer une tâche rattachée à une activité | Toute personne qui voit l'activité (hors stagiaire) | « Activité hors de votre périmètre. » |

**Règles automatiques**

- Avancement calculé en continu à partir des tâches (voir 3.1).
- À la création d'une activité, le responsable (s'il n'est pas l'auteur) reçoit « Vous êtes responsable d'une activité du plan de travail » : « <libellé> — du <date> au <date>. ». L'email porte le bouton « Voir l'activité ».
- Les échéances des tâches rattachées déclenchent les alertes de veille et de retard décrites en 3.1.

**Messages que vous pouvez voir**

- « Supprimez d'abord les activités de cet objectif. » → l'objectif contient encore des activités.
- « Des tâches sont rattachées à cette activité : détachez-les d'abord. » → l'activité a des tâches.
- « Le responsable doit être un membre actif de l'unité. » → choisissez une personne de l'unité.
- « La fin de l'activité précède son début. » → corrigez les dates.
- « Unité fermée. » → l'unité n'existe plus dans l'organigramme ; aucun ajout n'y est possible.
- « Unité introuvable », « Objectif introuvable », « Activité introuvable » → l'élément a été supprimé ; rechargez la page.
- Message technique en anglais du type « indicateur must be longer than or equal to 3 characters » → un champ est trop court (ici l'indicateur, 3 caractères au moins).

**Captures**

- 03-taches-04-plan-de-travail.png
- 03-taches-02-nouvelle-tache.png (champ « Activité du plan de travail »)

---

### 3.4 Instructions de la Direction

**À quoi sert ce module**

Le DN et la DNA adressent une instruction écrite à une personne nommément désignée. L'application suit cette instruction jusqu'à son exécution ou son rejet, horodate chaque étape et relance automatiquement le destinataire. Une instruction peut concerner un agent (instruction RH). Elle s'exécute alors par un acte signé du Courrier, et l'agent ne la voit qu'une fois exécutée.

**Accès**

Menu « Général » → « Instructions ». Tout le monde voit cette entrée, sauf le stagiaire. Les notifications ouvrent directement la fiche de l'instruction.

**Écran et onglets**

- Titre « Instructions de la Direction », avec le rappel : « Émise → Reçue → Prise en compte → Exécutée ou Rejetée. Relance automatique tous les 7 jours tant qu'elle reste ouverte. Une instruction qui concerne un agent s'exécute par un acte signé du Courrier ; l'agent ne la voit qu'une fois exécutée. »
- Bouton « + Nouvelle instruction » (DN et DNA seulement).
- Onglets, avec leur nombre d'instructions :
  - « Reçues » : les instructions qui vous sont adressées (toujours présent) ;
  - « Émises (Direction) » pour le DN et la DNA, qui y voient toutes les instructions (300 au plus) ;
  - « Me concernant » : les instructions exécutées dont vous êtes l'agent concerné. Cet onglet n'apparaît que s'il en existe.
- Chaque ligne indique :
  - l'objet ;
  - « <émetteur> → <destinataire> · émise le <date> · échéance <date> » ;
  - l'étiquette de statut et, le cas échéant, « En retard ».
- Liste vide : « Aucune instruction. »
- *Fiche d'une instruction* :
  - le statut, « En retard » le cas échéant, puis le texte ;
  - « De : », « À : », « Agent concerné : » ;
  - « Suivi : émise le … · reçue le … · prise en compte le … · exécutée le … (ou rejetée le …) · échéance … » ;
  - « Compte rendu : », « Acte : voir l'acte d'exécution », « Motif du rejet : ».

**Actions et formulaires**

*« + Nouvelle instruction » → fenêtre « Nouvelle instruction »*

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Objet » | obligatoire | 3 à 300 caractères |
| « Instruction » | obligatoire | 5 à 5 000 caractères |
| « Destinataire » | obligatoire | « Choisir… » : tout le personnel actif hors stagiaires, sauf vous |
| « Agent concerné » | facultatif | mention « instruction RH — facultatif ; ne la verra qu'une fois exécutée » ; « Aucun » par défaut ; le destinataire n'est pas proposé |
| « Échéance » | facultatif | date |

Boutons « Annuler » et « Émettre ».

*Boutons de la fiche (destinataire seulement)*

- « Prendre en compte » : l'instruction passe « Prise en compte ».
- « Marquer exécutée » : ouvre les champs suivants.
  - « Compte rendu d'exécution » (obligatoire, 3 à 3 000 caractères).
  - Pour une instruction RH, « Acte signé qui exécute l'instruction » (obligatoire). La liste propose les actes signés ou expédiés que vous avez rédigés et dont l'agent concerné est bénéficiaire. Si la liste est vide, l'écran indique : « Préparez puis faites signer l'acte dans le module Courrier (ou Documents générés). »
  - Boutons « Confirmer l'exécution » et « Annuler ».
- « Rejeter » : ouvre « Motif du rejet » (obligatoire, 5 à 2 000 caractères), avec les boutons « Confirmer le rejet » et « Annuler ».

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Émise » | instruction envoyée, pas encore ouverte | le destinataire, simplement en ouvrant la fiche (passage automatique à « Reçue ») ; il peut aussi « Prendre en compte » ou « Rejeter » directement |
| « Reçue » | le destinataire l'a ouverte (date enregistrée) | le destinataire : « Prendre en compte » ou « Rejeter » |
| « Prise en compte » | le destinataire s'engage à l'exécuter | le destinataire : « Marquer exécutée » ou « Rejeter » |
| « Exécutée » | travail fait, compte rendu (et acte signé pour une instruction RH) | étape finale |
| « Rejetée » | le destinataire l'a refusée, avec un motif | étape finale |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Émettre une instruction | DN, DNA | « Seuls le DN et la DNA émettent des instructions. » |
| Lire une instruction | DN, DNA, émetteur, destinataire ; l'agent concerné seulement après l'exécution | « Instruction introuvable » |
| Prendre en compte, exécuter, rejeter | Le destinataire seul (pas même le DN ou la DNA à sa place) | « Seul le destinataire traite l'instruction. » |
| Voir le motif d'un rejet | DN, DNA, émetteur, destinataire (jamais l'agent concerné) | le motif n'est pas affiché |
| Toute action | Pas le stagiaire (il ne peut pas être destinataire) | « Cette fonctionnalité n'est pas accessible aux stagiaires. » |

**Règles automatiques**

- **À l'émission** : le destinataire reçoit « Instruction de la Direction » (l'objet), avec un email immédiat et le bouton « Voir l'instruction ».
- **Prise en compte** : l'émetteur reçoit « Instruction prise en compte ».
- **Exécution** : l'émetteur reçoit « Instruction exécutée ». L'agent concerné, s'il y en a un, reçoit « Instruction de la Direction vous concernant » (« « <objet> » : exécutée. »).
- **Rejet** : l'émetteur reçoit « Instruction rejetée » avec le motif, par email immédiat.
- **Relance** : chaque jour à 7 h 05 (heure de Conakry), toute instruction encore « Émise », « Reçue » ou « Prise en compte » depuis 7 jours sans relance déclenche deux messages :
  - le destinataire reçoit « Relance : instruction de la Direction en attente » (« « <objet> », émise il y a N jours. »), par email immédiat ;
  - l'émetteur reçoit « Instruction toujours en attente ».
  La relance se répète tous les 7 jours tant que l'instruction reste ouverte.
- **En retard** : l'étiquette apparaît dès que l'échéance est dépassée et que l'instruction est encore ouverte.
- **Discrétion** : l'agent concerné ne voit rien et ne reçoit rien avant l'exécution.

**Messages que vous pouvez voir**

- « Destinataire introuvable ou inactif. » → choisissez une personne au compte actif.
- « On ne s'adresse pas une instruction à soi-même. » → changez de destinataire.
- « L'agent concerné ne peut pas être le destinataire. » → choisissez deux personnes différentes.
- « Agent concerné introuvable. » → choisissez à nouveau l'agent.
- « Une instruction qui concerne un agent s'exécute par un acte signé (module Courrier). » → choisissez l'acte signé.
- « L'acte doit être signé avant l'exécution de l'instruction. » → faites signer l'acte, puis revenez.
- « L'acte doit avoir pour bénéficiaire l'agent concerné par l'instruction. » → choisissez l'acte de l'agent concerné.
- « Acte introuvable » → l'acte n'existe plus ; choisissez-en un autre.
- « Cette action n'est plus possible à ce stade de l'instruction. » → l'instruction a déjà avancé ; rechargez-la.
- « L'instruction vient de changer : rechargez-la. » → quelqu'un a agi en même temps ; fermez et rouvrez la fiche.

**Captures**

- 03-taches-05-instructions.png
- 03-taches-06-instruction-recue.png

---

### 3.5 Communication — messagerie, fils de discussion, annonces, sondages

**À quoi sert ce module**

Le module Communication rassemble les échanges internes :
- les messages directs d'une personne à une autre ;
- les fils de discussion à plusieurs, avec accusés de lecture ;
- les annonces diffusées à une unité ;
- les sondages rapides.

**Accès**

Menu « Général » → « Communication » (titre de la page : « Messagerie & annonces »). Tout le monde voit cette entrée, stagiaire compris. La fiche d'une personne dans l'Annuaire (« Envoyer un message ») et les notifications ouvrent directement la bonne conversation, le bon fil, la bonne annonce ou le bon sondage.

**Écran et onglets**

Onglets : « Messagerie », « Fils de discussion », « Annonces », « Sondages ». Pour un stagiaire, l'onglet « Sondages » n'apparaît pas.

#### 3.5.1 Messagerie

- **Écran** :
  - à gauche, le champ « Nouvelle conversation — rechercher un nom… » et la liste des conversations (« Aucune conversation pour l'instant. ») ;
  - à droite, la conversation ouverte (« Aucun message pour l'instant. ») ou, sans conversation choisie, « Sélectionnez une conversation ou démarrez-en une nouvelle. »
- **Actions** :
  - tapez un nom ou un prénom dans le champ de recherche (20 personnes au plus, personnel actif seulement, toutes unités confondues) puis cliquez sur la personne ;
  - écrivez dans « Écrire un message… » (obligatoire, 1 à 4 000 caractères) puis cliquez sur « Envoyer » (grisé tant que le message est vide).
- **Lecture** : ouvrir une conversation marque vos messages reçus comme lus. Sous votre dernier message envoyé, l'écran affiche « · Lu à <heure> » dès que la personne l'a lu. Le compteur de l'icône messagerie, en haut de l'écran, se met à jour.
- **Qui** : tout le monde, stagiaire compris, avec tout le personnel actif, sans restriction hiérarchique.
- **Notification** : le destinataire reçoit « Nouveau message » (début du message), avec le bouton « Lire le message ».
- **Messages** :
  - « Vous ne pouvez pas vous envoyer un message à vous-même. » ;
  - « Destinataire introuvable ».

#### 3.5.2 Fils de discussion

- **Écran** :
  - bouton « + Nouveau fil » ;
  - liste des fils, avec pour chacun l'objet, une pastille indiquant le nombre de messages non lus, les participants et le dernier message ;
  - sans fil : « Aucun fil de discussion. » Sans fil ouvert : « Choisissez un fil ou démarrez-en un nouveau. »
- **Fenêtre « Nouveau fil de discussion »** :

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Objet » | obligatoire | 2 à 200 caractères |
| « Destinataires (N) » | obligatoire | champ « Filtrer par nom… » et cases à cocher (tout le personnel actif sauf vous) ; 1 à 50 personnes |
| « Message » | obligatoire | 5 000 caractères au plus |
| « Joindre un objet » | facultatif | « tâche, document, courrier, réunion — facultatif » ; tapez au moins 3 caractères dans « Rechercher (3 caractères au moins)… » puis choisissez ; « Retirer » pour l'enlever |

Bouton « Envoyer ». Si aucun destinataire n'est coché, l'écran affiche « Choisissez au moins un destinataire. »

- **Répondre** : champ « Votre message… », « Joindre un objet » (facultatif), puis « Envoyer ».
- **Accusés de lecture** : ouvrir un fil vaut lecture. Sous chaque message, tous les participants voient « Lu par <nom> le <date> » ou « Non lu par <nom> ».
- **Objet joint** : « 📎 <type> : <libellé> », cliquable pour qui y a droit. Les autres voient « 📎 <type> joint(e) — vous n'y avez pas accès. » Les types sont « Tâche », « Document », « Réunion », « Courrier arrivé », « Acte ». Un pli personnel ne peut jamais être joint.
- **Qui** : tout le monde. Le stagiaire peut écrire et répondre, mais pas joindre d'objet. Seuls les participants voient un fil. En période de suppléance, vous n'accédez pas aux fils de la personne que vous remplacez.
- **Notification** : chaque participant (sauf l'auteur) reçoit « Message de <nom> : <objet> », avec le bouton « Lire le fil ».
- **Messages** :
  - « Au moins un destinataire autre que vous. » ;
  - « Un destinataire est introuvable ou inactif. » ;
  - « Un pli personnel est protégé : il ne peut pas être joint. » ;
  - « Objet introuvable ou que vous ne voyez pas : il ne peut pas être joint. » ;
  - « Fil de discussion introuvable » (vous n'êtes pas participant).

#### 3.5.3 Annonces

- **Écran** :
  - liste des annonces, avec l'étiquette de portée (« Toute la DNPEC », « Division », « Section », « Cellule », « Groupe personnalisé »), la date, le titre, le début du texte et « Par <nom> » (ou « Par vous ») ;
  - sans annonce : « Aucune annonce pour l'instant. »
  - cliquer sur une annonce ouvre son détail. L'auteur, le DN, la DNA et l'administrateur système y voient en plus « Lue par N personne(s) », avec le nom et l'heure de chaque lecture, ou « Personne n'a encore lu cette annonce. »
- **Bouton « + Nouvelle annonce »** (sur l'onglet « Annonces ») → fenêtre « Nouvelle annonce » :

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Titre » | obligatoire | 2 à 200 caractères |
| « Message » | obligatoire | 1 à 4 000 caractères |
| « Portée » | obligatoire | selon votre rôle (tableau ci-dessous) ; selon la portée, choisissez la division (« Choisir une division… »), la section (« Choisir une section… »), la cellule (« Choisir une cellule… ») ou les « Destinataires » (cases à cocher). Votre propre unité s'affiche d'office : « Votre division : … », « Votre section : … », « Votre cellule : … » |

Boutons « Annuler » et « Publier l'annonce » (« Publication… » pendant l'envoi).

| Rôle | Portées proposées |
|---|---|
| DN, DNA | « Toute la DNPEC », « Division », « Section », « Cellule », « Groupe personnalisé » |
| Administrateur système | « Division », « Section », « Cellule », « Groupe personnalisé » |
| Chef de division | « Division » (la sienne), « Section », « Groupe personnalisé » |
| Chef de section | « Section » (la sienne), « Groupe personnalisé » |
| Chef de cellule | « Cellule » (la sienne), « Groupe personnalisé » |
| Chargé d'études, assistant(e) de direction, DRH, stagiaire | pas de bouton |

- **Qui lit** : chacun voit les annonces adressées à toute la DNPEC, à sa division, à sa section, à sa cellule, ou à un groupe dont il fait partie (stagiaire compris).
- **Notification** : chaque destinataire actif (sauf l'auteur) reçoit le titre de l'annonce, avec le bouton « Voir l'annonce ».
- **Limites** : une annonce publiée ne se modifie pas et ne se supprime pas.
- **Messages** :
  - « Seuls le DN ou la DNA peuvent diffuser une annonce à toute la DNPEC. » ;
  - « Vous n'avez pas l'autorité hiérarchique nécessaire sur cet utilisateur. » (unité ou destinataire hors de votre autorité) ;
  - « Division introuvable » ;
  - « Section introuvable pour cette division » ;
  - « Cellule introuvable » ;
  - « Un ou plusieurs destinataires sont introuvables. » ;
  - « Annonce hors de votre périmètre » ;
  - « Seul l'auteur de l'annonce (ou un dirigeant) peut consulter son suivi de lecture. »

#### 3.5.4 Sondages

- **Écran** :
  - liste des sondages, avec les étiquettes « Clôturé » et « Vous avez voté » et le nombre de votes ;
  - sans sondage : « Aucun sondage pour l'instant. »
  - cliquer sur un sondage ouvre son détail :
    - la question, les étiquettes « Clôturé » et « Vous êtes l'auteur », « Par <nom> · <date> » ;
    - « N participant(s) » et « · plusieurs choix possibles » le cas échéant ;
    - pour chaque option, « <nombre> · <pourcentage>% » et une coche ✓ sur vos choix.
  - Les résultats se mettent à jour toutes les 15 secondes tant que le détail est ouvert. L'auteur, le DN, la DNA et l'administrateur système voient aussi le nom de chaque votant sous chaque option.
- **Bouton « + Nouveau sondage »** (sur l'onglet « Sondages ») → fenêtre « Nouveau sondage » :

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Question » | obligatoire | 2 à 300 caractères |
| « Options » | obligatoire | au moins 2 options (« Option 1 », « Option 2 »), chacune de 1 à 200 caractères, sans doublon ; « + Ajouter une option » ; ✕ pour retirer une option (à partir de 3) |
| Case « Autoriser plusieurs choix par personne » | facultatif | |
| « Clôture automatique (optionnel) » | facultatif | date et heure |
| « Portée » | obligatoire | mêmes portées et mêmes rôles que pour les annonces |

Boutons « Annuler » et « Publier le sondage » (« Publication… » pendant l'envoi). « Publier le sondage » reste grisé tant que la question est vide ou qu'il y a moins de deux options remplies.

- **Voter** :
  - choix unique : cliquez sur l'option ;
  - choix multiple : cochez les options puis cliquez sur « Voter » (ou « Mettre à jour mon vote ») ;
  - vous pouvez changer d'avis tant que le sondage est ouvert : votre nouveau vote remplace l'ancien.
- **Clôturer** : l'auteur seul, avec « Clôturer le sondage ». Confirmation : « Clôturer ce sondage ? Plus personne ne pourra voter ensuite. » Le sondage se clôt aussi tout seul à la date de « Clôture automatique ».
- **Qui** : création comme pour les annonces. Les sondages sont **fermés aux stagiaires** : ils ne les voient pas, n'y votent pas et ne peuvent pas en être destinataires.
- **Notification** : chaque destinataire reçoit « Nouveau sondage » (la question), avec le bouton « Voir le sondage ». Aucun message n'est envoyé à chaque vote.
- **Messages** :
  - « Un sondage nécessite au moins deux options. » ;
  - « Les sondages ne sont pas ouverts aux stagiaires. » ;
  - « Seuls le DN ou la DNA peuvent lancer un sondage pour toute la DNPEC. » ;
  - « Ce sondage est clôturé. » ;
  - « Ce sondage n'autorise qu'un seul choix. » ;
  - « Option de vote introuvable pour ce sondage. » ;
  - « Seul l'auteur peut clôturer ce sondage. » ;
  - « Ce sondage est déjà clôturé. » ;
  - « Sondage hors de votre périmètre ».

**Actions et formulaires**

Voir les sous-parties 3.5.1 à 3.5.4 ci-dessus.

**Statuts et étapes**

| Élément | Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|---|
| Message direct | non lu → lu | « Lu à <heure> » sous votre dernier message | le destinataire, en ouvrant la conversation |
| Message de fil | « Non lu par … » → « Lu par … le … » | accusé de lecture par participant | chaque participant, en ouvrant le fil |
| Annonce | publiée → lue | suivi « Lue par N personnes » | chaque destinataire, en ouvrant l'annonce |
| Sondage | ouvert → « Clôturé » | plus aucun vote possible | l'auteur (« Clôturer le sondage ») ou la date de clôture automatique |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Envoyer un message direct | Tous, stagiaire compris | « Vous ne pouvez pas vous envoyer un message à vous-même. » |
| Créer un fil, répondre | Tous, stagiaire compris | « Fil de discussion introuvable » (non-participant) |
| Joindre un objet à un fil | Tous sauf le stagiaire ; seulement un objet que vous pouvez vous-même ouvrir | « Objet introuvable ou que vous ne voyez pas : il ne peut pas être joint. » |
| Publier une annonce à toute la DNPEC | DN, DNA | « Seuls le DN ou la DNA peuvent diffuser une annonce à toute la DNPEC. » |
| Publier une annonce à une division, section, cellule ou à un groupe | DN, DNA, administrateur système (toutes les unités) ; chef de division (sa division et ses sections) ; chef de section (sa section) ; chef de cellule (sa cellule) ; pour un groupe, seulement des personnes sur lesquelles on a autorité | « Vous n'avez pas l'autorité hiérarchique nécessaire sur cet utilisateur. » |
| Voir le suivi de lecture d'une annonce | Auteur, DN, DNA, administrateur système | « Seul l'auteur de l'annonce (ou un dirigeant) peut consulter son suivi de lecture. » |
| Créer un sondage | Mêmes rôles et portées que les annonces | mêmes messages (version « sondage ») |
| Voter | Destinataires du sondage, hors stagiaires | « Sondage hors de votre périmètre » / « Cette fonctionnalité n'est pas accessible aux stagiaires. » |
| Voir qui a voté quoi | Auteur, DN, DNA, administrateur système | les autres ne voient que les totaux |
| Clôturer un sondage | Auteur seul | « Seul l'auteur peut clôturer ce sondage. » |

**Règles automatiques**

- **Conservation limitée à 3 ans** : chaque nuit à 0 h 40 (heure de Conakry), l'application efface définitivement les messages directs et les messages de fils de discussion qui ont plus de **3 ans**, pièces jointes comprises. Un fil qui n'a plus aucun message disparaît. Les annonces, les notifications et le journal d'audit ne sont pas concernés.
- **Emails** : les notifications de message, de fil, d'annonce et de sondage partent dans le « Résumé quotidien », sauf si vous avez choisi « Tout immédiatement » dans vos préférences. Elles apparaissent toujours tout de suite dans la cloche.
- **Sondages** : clôture automatique à la date choisie ; résultats rafraîchis toutes les 15 secondes à l'écran.

**Messages que vous pouvez voir**

Voir la liste en fin de chaque sous-partie (3.5.1 à 3.5.4). En plus, sur un objet joint que vous ne pouvez pas ouvrir : « 📎 <type> joint(e) — vous n'y avez pas accès. » → demandez l'accès à l'auteur du message ou au responsable de l'objet.

**Captures**

- 05-communication-01-messages.png
- 05-communication-02-fils.png
- 05-communication-03-annonces.png
- 05-communication-04-sondages.png
- 02-interface-13-cloche.png
- 02-interface-15-preferences-notifications.png

---

### 3.6 Boîte à suggestions

**À quoi sert ce module**

La boîte à suggestions permet à chacun de proposer une idée à la Direction, en son nom ou de façon anonyme. Le DN et la DNA examinent chaque suggestion, lui donnent un statut et peuvent répondre.

**Accès**

Menu « Personnel » → « Boîte à suggestions ». Tout le monde voit cette entrée, sauf le stagiaire.

**Écran et onglets**

- Titre « Boîte à suggestions », bouton « + Nouvelle suggestion ».
- Pour le DN et la DNA, deux onglets : « Boîte de réception » (ouvert par défaut, toutes les suggestions ; un auteur anonyme apparaît comme « Anonyme ») et « Mes suggestions ».
- Pour les autres, la liste « Mes suggestions » seule : le statut, la date, le texte et, s'il y en a une, la « Réponse de la Direction ». Liste vide : « Vous n'avez pas encore soumis de suggestion (les suggestions envoyées anonymement n'apparaissent pas ici). »

**Actions et formulaires**

*« + Nouvelle suggestion » → fenêtre « Nouvelle suggestion »*

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Votre suggestion, à destination de la Direction » | obligatoire | 2 à 4 000 caractères |
| Case « Soumettre anonymement » | facultatif | « Ni la Direction ni personne d'autre ne pourra savoir que la suggestion vient de vous — en contrepartie, elle n'apparaîtra pas dans « Mes suggestions » et vous ne serez pas notifié·e de son suivi. » |

Boutons « Annuler » et « Envoyer » (« Envoi… » pendant l'envoi). « Envoyer » reste grisé tant que le texte est vide.

*Traitement (DN, DNA)* : dans « Boîte de réception », cliquez sur une suggestion. Un volet s'ouvre :

| Champ | Obligatoire ? | Précisions |
|---|---|---|
| « Statut » | obligatoire | « Reçue », « En étude », « Retenue », « Non retenue » |
| « Réponse » | facultatif | 1 à 2 000 caractères ; mention « (visible par l'auteur) » si la suggestion n'est pas anonyme |

Bouton « Enregistrer » (« Enregistrement… » pendant l'envoi).

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Reçue » | statut de départ | DN ou DNA |
| « En étude » | la Direction examine la suggestion | DN ou DNA |
| « Retenue » | suggestion acceptée | DN ou DNA (peut encore modifier) |
| « Non retenue » | suggestion écartée | DN ou DNA (peut encore modifier) |

Les statuts peuvent être choisis dans n'importe quel ordre.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Proposer une suggestion | Tous sauf le stagiaire | « Cette fonctionnalité n'est pas accessible aux stagiaires. » |
| Voir ses propres suggestions | L'auteur, si elles ne sont pas anonymes | — |
| Voir toutes les suggestions, changer leur statut, répondre | DN, DNA | « Seuls le DN ou la DNA peuvent traiter les suggestions. » |

**Règles automatiques**

- À chaque nouvelle suggestion, le DN et la DNA reçoivent « Nouvelle suggestion » (le texte), avec le bouton « Voir la suggestion ».
- À chaque changement de statut, l'auteur d'une suggestion non anonyme reçoit « Mise à jour de votre suggestion » : « Nouveau statut : <statut> », avec le bouton « Voir ma suggestion ».
- Anonymat complet : aucun nom n'est enregistré, même dans le journal de traçabilité. Aucune notification de suivi n'est donc possible pour une suggestion anonyme.

**Messages que vous pouvez voir**

- « Seuls le DN ou la DNA peuvent traiter les suggestions. » → seule la Direction traite les suggestions.
- « Suggestion introuvable » → rechargez la page.

**Captures**

- 05-communication-05-suggestions.png

---

### 3.7 Annuaire

**À quoi sert ce module**

L'annuaire liste tout le personnel actif de la DNPEC (nom, fonction, rattachement), toutes unités confondues. Il permet d'écrire à une personne et, pour un chef, de lui confier une tâche.

**Accès**

Menu « Personnel » → « Annuaire ». Tout le monde voit cette entrée, sauf le stagiaire. La recherche de la barre du haut renvoie aussi vers l'annuaire (catégorie « Annuaire »), avec le nom déjà saisi.

**Écran et onglets**

- Titre « Annuaire ». Pas d'onglet.
- Champ « Rechercher un nom ou une fonction… ».
- Filtre d'unité : « Toutes les unités », puis les groupes « Divisions », « Sections » (« code de la division · section ») et « Cellules transversales ».
- Cartes : initiales, nom, fonction (ou rôle à défaut) et rattachement.
- Sans résultat : « Aucune personne ne correspond à ces critères. »

**Actions et formulaires**

Cliquez sur une carte pour ouvrir la fiche de la personne :
- elle affiche le nom, la fonction, « Rôle » et « Rattachement » ;
- « Envoyer un message » ouvre la messagerie avec cette personne ;
- « Assigner une tâche » apparaît pour le DN, la DNA, le chef de division, le chef de section et le chef de cellule. Il ouvre « Nouvelle tâche pour <Prénom Nom> » (mêmes champs qu'en 3.1), avec la personne déjà cochée ;
- « Fermer » referme la fiche ;
- sur votre propre fiche : « C'est votre propre fiche. »

Les rôles sont affichés ainsi : « Directeur National », « Directeur National Adjoint », « Chef de Division », « Chef de Section », « Chef de Cellule », « Agent / Chargé d'Études », « Administrateur Système », « Assistant(e) de Direction », « Directeur des Ressources Humaines », « Stagiaire ».

**Statuts et étapes**

Sans objet. Seul le personnel au compte actif apparaît.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Consulter l'annuaire | Tous sauf le stagiaire | entrée absente du menu |
| Envoyer un message | Tous | — |
| Assigner une tâche depuis la fiche | DN, DNA (tout le monde) ; chef de division, de section ou de cellule (personnes de son unité) | « Seuls le créateur (ou la personne assignée/concernée) et son supérieur hiérarchique direct peuvent effectuer cette action. » |

**Règles automatiques**

Aucune. L'annuaire reflète en permanence les comptes actifs. Un compte suspendu n'y apparaît plus.

**Messages que vous pouvez voir**

- « Aucune personne ne correspond à ces critères. » → élargissez la recherche ou choisissez « Toutes les unités ».
- Le message de refus d'assignation ci-dessus → la personne n'est pas dans votre unité ; demandez à son chef.

**Captures**

- 05-communication-06-annuaire.png

---

### 3.8 Congés et absences

**À quoi sert ce module**
Vous y demandez vos congés et suivez vos demandes. Votre chef le plus proche donne un avis, puis le DRH décide. Les absences pour maladie sont protégées : leur nature n'est montrée qu'aux personnes qui ont besoin de la connaître.

**Accès**
Menu « Personnel » → « Congés & absences ». Tout le personnel voit cette entrée, sauf le stagiaire : le module ne lui est pas ouvert.

**Écran et onglets**
La page s'intitule « Congés & absences ».

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Mes congés » | Tout le monde | Le bouton « + Nouvelle demande », le bloc « Mon solde » (avec le choix de l'année) et la liste « Mes demandes ». |
| « À traiter » | DN, DNA, chef de division, chef de section, chef de cellule, DRH | Les demandes qui attendent **votre** avis ou **votre** décision. Une pastille indique leur nombre. Chaque ligne affiche le nom, « {type} · Du … au … · N jours », puis « Votre avis est attendu » ou « Votre décision est attendue », et le bouton « Examiner ». |
| « Suivi » | Les mêmes rôles | Les autres demandes de votre périmètre, en lecture seule, avec leur étape et le bouton « Consulter ». |
| « Jours fériés » | Tout le monde | Le calendrier des jours fériés (voir 3.9). |

- **« Mon solde »** : une carte par type de congé, au format « N jours restants sur T (P pris) ». Si aucun solde n'existe pour l'année, la page affiche « Aucun solde provisionné pour cette année pour l'instant. »
- **« Mes demandes »** : une carte par demande, avec son étape en majuscules (par exemple « AVIS DU CHEF ATTENDU »), les dates, la durée, le motif et, selon le cas, l'échéance de l'avis, le motif du refus ou le certificat médical. Sans demande, la liste affiche « Aucune demande de congé pour l'instant. »
- **Liste « À traiter » vide** : « Aucune demande en attente de votre avis ou de votre décision. »
- **Liste « Suivi » vide** : « Aucune demande dans votre périmètre. »

**Actions et formulaires**

- **« + Nouvelle demande »** (visible dans l'onglet « Mes congés ») ouvre la fenêtre « Nouvelle demande de congé » :
  - « Type de congé » (obligatoire) : une liste des types existants.
  - « Date de début » (obligatoire).
  - « Date de fin » (obligatoire). Elle ne peut pas précéder la date de début.
  - Un aperçu de la durée s'affiche : « Sélectionnez les deux dates pour voir le nombre de jours. », puis « Durée : N jours ». Cet aperçu compte les jours de calendrier. Le nombre retenu est recalculé à l'envoi : les jours fériés saisis en sont retirés.
  - « Motif (optionnel) » (facultatif, 1 000 caractères au maximum).
  - Boutons : « Annuler » et « Soumettre la demande ». Ce dernier reste grisé tant qu'une date manque, que la fin précède le début ou qu'aucun type de congé n'existe.
  - Ce formulaire ne permet pas de joindre un fichier. Le certificat médical s'ajoute après l'envoi, sur la carte de la demande.
- **« Joindre le certificat médical »** (sur la carte d'une demande de congé maladie, pour son auteur uniquement) : choisissez le fichier (25 Mo au maximum). Le lien « 📎 Certificat médical : {nom du fichier} » apparaît, et le bouton devient « Remplacer le certificat ». Le dépôt reste possible tant que la demande n'est ni annulée ni refusée. Le texte « Aucun certificat médical joint (visible de vous et du DRH seulement). » s'affiche tant que rien n'est joint.
- **« Annuler la demande »** (sur une demande « En attente » ou approuvée) : la demande passe à « Annulée ». Si elle était approuvée, les jours sont rendus au solde.
- **« Examiner »** ou **« Consulter »** ouvre le volet « Demande de congé ». Il contient :
  - « DU », « AU », « DURÉE » ;
  - l'encadré du circuit : l'étape, l'avis donné (avec son auteur et son motif), ou « Avis attendu avant le … ; au-delà, il est réputé favorable. » ;
  - « Motif » ;
  - « Solde {type} — {année} » : « N jours restants sur T (P déjà pris) », ou « Aucun solde provisionné pour ce type/cette année. »
  - Pour un congé maladie, quand vous en avez le droit : l'encadré « 🔒 Motif médical protégé. » et le bouton « Afficher le motif ». Celui-ci demande votre mot de passe dans la fenêtre « Confirmez votre identité ».
- **Avis du chef**, dans le volet : le texte « Vous donnez un avis ; la décision revient au DRH. » et les boutons « Avis favorable » et « Avis défavorable ».
  - « Avis défavorable » ouvre le champ « Motif de l'avis défavorable (transmis au DRH)… » (obligatoire, au moins 2 caractères, 2 000 au maximum).
  - Validez ensuite avec « Confirmer l'avis défavorable », ou revenez en arrière avec « Annuler ».
- **Décision**, dans le volet : les boutons « Approuver » et « Refuser ».
  - « Refuser » ouvre le champ « Motif du refus (visible par le demandeur)… » (obligatoire, de 2 à 2 000 caractères).
  - Validez ensuite avec « Confirmer le refus », ou revenez en arrière avec « Annuler ».
- **Fenêtre « Confirmez votre identité »** : le texte « Cet élément est protégé. Saisissez votre mot de passe pour l'ouvrir ; la confirmation reste valable 10 minutes. », le champ « Votre mot de passe » (obligatoire) et, si la double authentification est active, le champ « Code de l'application d'authentification ». Bouton « Confirmer ».

**Statuts et étapes**

| Étape affichée | Signification | Qui la fait passer à l'étape suivante |
|---|---|---|
| « Avis du chef attendu » | La demande est envoyée et attend l'avis du chef le plus proche. | Le chef le plus proche (« Avis favorable » ou « Avis défavorable »), ou l'application à l'échéance (avis réputé favorable). |
| « Décision du DRH attendue » | L'avis est donné : « Avis favorable », « Avis défavorable » ou « Avis réputé favorable (délai dépassé) ». | Le DRH (« Approuver » ou « Refuser »). Pour une demande du DRH lui-même, c'est le DN ou la DNA qui décide. |
| « Approuvée » | Le congé est accordé et les jours sont décomptés du solde. | Le demandeur ou un supérieur direct peut encore l'annuler (les jours sont alors rendus). |
| « Refusée » | Le congé est refusé, avec un motif. | — (étape finale) |
| « Annulée » | La demande est annulée. | — (étape finale) |

**Le chef le plus proche** est le premier de cette liste qui a un compte actif, autre que vous :

1. votre supérieur désigné (cas de l'assistant(e) de direction) ;
2. le chef de votre cellule ;
3. le chef de votre section ;
4. le chef de votre division ;
5. le DN ou la DNA.

Les niveaux supérieurs ne donnent pas d'avis.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Demander un congé | Tout le personnel sauf le stagiaire | « Cette fonctionnalité n'est pas accessible aux stagiaires. » |
| Donner l'avis | Le chef le plus proche du demandeur, ou son suppléant en intérim | « L'avis revient au chef d'unité de la personne. » |
| Décider (approuver ou refuser) | Le DRH. Pour une demande du DRH : le DN ou la DNA. Jamais sur sa propre demande. | « La décision revient au DRH (au DN ou à la DNA pour une demande du DRH). » |
| Annuler | Le demandeur, ou un supérieur ayant autorité directe sur lui | « Vous n'avez pas l'autorité pour annuler cette demande. » |
| Ouvrir le détail d'une demande | Le demandeur, le DRH, les supérieurs ayant autorité directe | « Cette demande de congé est hors de votre périmètre. » |
| Voir le type et le motif d'un congé maladie | Le demandeur, le chef qui donne (ou a donné) l'avis, le DRH. Le motif est montré après saisie du mot de passe ; chaque lecture est enregistrée. | Le DN, la DNA et le reste de la hiérarchie voient « Absence — motif protégé » et les dates. |
| Déposer le certificat médical | Le demandeur seulement | « Seul l'agent dépose le certificat de son congé maladie. » |
| Lire le certificat médical | Le demandeur et le DRH (après saisie du mot de passe), jamais le chef, le DN ni la DNA | « Le certificat médical est réservé à l'agent et au DRH. » |
| Voir le solde d'un agent | L'agent, le DRH, ses supérieurs | « Vous n'avez pas accès au solde de congés de cet utilisateur. » |

Pour le DN, la DNA et les chefs, la ligne « Congé maladie » du solde d'un agent s'affiche « Absence — motif protégé ». Seuls l'agent et le DRH voient son vrai nom.

**Règles automatiques**

- **Délai d'avis** : 48 heures ouvrées par défaut. L'administrateur système peut le régler entre 12 et 120 heures (paramètre « Délai d'avis du chef sur une demande de congé »).
  - Seules les heures du lundi au vendredi comptent, à l'heure de Conakry, hors jours fériés saisis.
  - Une demande déposée le week-end compte à partir du lundi 0 h.
  - Exemple : une demande déposée le vendredi à 10 h doit recevoir son avis avant le mardi 10 h (le mercredi si le lundi est férié).
- **Rappel au chef** : 12 heures ouvrées avant l'échéance, une seule fois.
  - Titre : « Rappel : avis attendu sur un congé ».
  - Texte : « … Sans avis de votre part avant le {date} UTC, il sera réputé favorable. »
  - Bouton : « Donner mon avis ».
- **Avis tacite** : à l'échéance, sans avis du chef, l'avis devient « Avis réputé favorable (délai dépassé) ».
  - Le ou les décideurs reçoivent « Congé : décision attendue » : « Sans avis du chef dans le délai, l'avis est réputé favorable. »
  - L'application vérifie les échéances toutes les 15 minutes.
- **Décompte des jours** : la durée compte tous les jours de la période, week-ends compris, moins les jours fériés saisis. Il est recalculé au moment de l'approbation, pour tenir compte d'un jour férié ajouté entre-temps.
- **Solde** : les jours sont décomptés uniquement à l'approbation. Ils sont rendus si une demande approuvée est annulée.
- **Notifications** (chaque notification ouvre la demande) :

  | Événement | Destinataires | Titre |
  |---|---|---|
  | Dépôt de la demande | Le chef le plus proche | « Demande de congé : votre avis est attendu » (bouton « Donner mon avis ») |
  | Dépôt de la demande | Le DRH (ou le DN et la DNA pour une demande du DRH) | « Nouvelle demande de congé (pour information) » |
  | Avis donné | Les décideurs | « Congé : décision attendue » (bouton « Décider ») |
  | Approbation | Le demandeur | « Demande de congé approuvée » |
  | Approbation | Le chef qui a donné l'avis | « Congé approuvé par le DRH » |
  | Refus | Le demandeur | « Demande de congé refusée », avec le motif |

  - Dans les notifications et les emails, un congé maladie apparaît toujours comme « Absence — motif protégé ».
  - L'approbation et le refus sont envoyés par email immédiatement.
  - Les messages « avis attendu », « rappel » et « décision attendue » arrivent tout de suite dans la cloche, mais par email dans le résumé quotidien.

**Messages que vous pouvez voir**

- « La date de fin ne peut pas être antérieure à la date de début. » → Corrigez les dates.
- « La période ne compte aucun jour de congé (jours fériés seulement). » → La période ne contient que des jours fériés : changez les dates.
- « Type de congé introuvable » → Le type a disparu : rechargez la page.
- « Un avis défavorable doit être motivé. » → Saisissez un motif.
- « Cette demande n'attend plus d'avis. » → La demande a été décidée ou annulée.
- « Le délai d'avis est dépassé : l'avis a été réputé favorable. » → Vous ne pouvez plus donner d'avis : le DRH décide.
- « L'avis a déjà été donné. » → Un autre chef ou un suppléant l'a déjà donné.
- « L'avis du chef d'unité est attendu avant la décision. » → Le DRH doit attendre l'avis, ou l'échéance.
- « Seule une demande en attente peut être approuvée ou refusée. » → La demande est déjà close.
- « Seule une demande en attente ou approuvée peut être annulée. » → Une demande refusée ou déjà annulée ne s'annule pas.
- « Un certificat médical ne se joint qu'à un congé maladie. » → Le type de la demande n'est pas « maladie ».
- « Cette demande est close. » → Plus de certificat possible sur une demande annulée ou refusée.
- « Le fichier du certificat est obligatoire. » → Choisissez un fichier.
- « Aucun certificat déposé. » → L'agent n'a rien joint.
- « Confirmez votre identité (mot de passe) pour ouvrir cet élément protégé. » → Saisissez votre mot de passe dans la fenêtre qui s'ouvre.
- « Cette demande de congé est introuvable ou hors de votre périmètre. » → Le lien reçu vise une demande que vous ne pouvez pas voir.

**Captures**
04-conges-01-mes-demandes.png, 04-conges-02-nouvelle-demande.png, 04-conges-03-avis-chef.png, 04-conges-04-suivi-drh.png, 04-conges-06-conge-maladie-certificat.png, 12-telephone-03-conges.png

---

### 3.9 Jours fériés

**À quoi sert ce module**
Le calendrier des jours fériés de chaque année. Ces jours sont retirés du décompte des jours de congé et du délai d'avis du chef. Si une fête n'est pas saisie, elle est comptée comme un jour ordinaire.

**Accès**
Menu « Personnel » → « Congés & absences » → onglet « Jours fériés ». Tout le monde peut le consulter. Seuls l'administrateur système et le DRH peuvent le modifier.

**Écran et onglets**
- Le titre « Jours fériés {année} », suivi du texte « Exclus du délai d'avis (heures ouvrées) et du décompte des jours de congé. »
- Le choix « Année » : de l'année précédente à deux ans en avant.
- Une ligne par jour : la date en toutes lettres, puis « {libellé} · Fête fixe » ou « {libellé} · Fête religieuse ».
- S'il n'y a rien : « Aucun jour férié saisi pour {année}. »
- Pour l'administrateur système et le DRH seulement :
  - le bandeau « Aucune fête religieuse saisie pour {année} (Tabaski, fin du Ramadan, Maouloud, lundi de Pâques…) : ajoutez-les avec leur date de l'année. » ;
  - le bandeau « Fêtes fixes absentes : … » avec le bouton « Ajouter les fêtes fixes » ;
  - le formulaire d'ajout, en bas de la liste.

**Actions et formulaires**
- **« Ajouter les fêtes fixes »** : ajoute les fêtes nationales manquantes de l'année, sans doublon : « Jour de l'An » (1er janvier), « Fête du Travail » (1er mai), « Journée de l'Afrique » (25 mai), « Assomption » (15 août), « Fête de l'Indépendance » (2 octobre), « Noël » (25 décembre).
- **Formulaire d'ajout** :
  - « Date » (obligatoire).
  - « Libellé » (obligatoire, de 2 à 120 caractères, exemple affiché « Ex. Tabaski »).
  - « Nature » : « Fête religieuse » (proposé par défaut) ou « Fête fixe ».
  - Bouton : « Ajouter le jour férié ».
- **« Modifier »** (sur une ligne) : la date et le libellé deviennent modifiables. Validez avec « Enregistrer » ou revenez en arrière avec « Annuler ».
- **« Supprimer »** (sur une ligne) : l'application demande « Supprimer « {libellé} » ? ».

**Statuts et étapes**

| Statut | Signification | Qui le fait évoluer |
|---|---|---|
| « Fête fixe » | Fête nationale à date fixe, reprise chaque année avec « Ajouter les fêtes fixes ». | L'administrateur système ou le DRH |
| « Fête religieuse » | Fête dont la date change chaque année, à saisir chaque année. | L'administrateur système ou le DRH |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Consulter le calendrier | Tout le personnel (sauf le stagiaire, qui n'a pas accès aux congés) | — |
| Ajouter, modifier, supprimer, ajouter les fêtes fixes | L'administrateur système, le DRH | « Le calendrier des jours fériés est tenu par l'administrateur système et le DRH. » |

**Règles automatiques**
- **Alerte annuelle** : chaque jour à 6 h 30 (heure de Conakry), l'application vérifie deux choses :
  - que l'année suivante a au moins un jour férié saisi ;
  - que l'année en cours a au moins une fête religieuse.
- Si l'un des deux manque, tous les administrateurs système et DRH reçoivent **une seule alerte dans l'année** :
  - titre : « Calendrier des jours fériés à compléter » ;
  - texte : « {ce qui manque}. Sans calendrier à jour, les jours fériés comptent dans les délais d'avis et les jours de congé. » ;
  - bouton : « Compléter le calendrier », qui ouvre directement l'onglet sur la bonne année.
- Un jour férié ajouté après le dépôt d'une demande est pris en compte au moment où la demande est approuvée.

**Messages que vous pouvez voir**
- « Ce jour est déjà férié. » → Cette date existe déjà : modifiez la ligne existante.
- « Jour férié introuvable » → La ligne a été supprimée entre-temps : rechargez la page.
- « Année invalide. » → Choisissez une année entre 2000 et 2100.

**Captures**
04-conges-05-jours-feries.png

---

### 3.10 Suppléance

**À quoi sert ce module**
Pendant une absence, un responsable désigne un suppléant de rang comparable. Pendant la période prévue, le suppléant peut agir au nom du titulaire, mais seulement après l'avoir choisi explicitement. Chacune de ses actions est enregistrée « par intérim, au nom de » le titulaire.

**Accès**
Menu « Personnel » → « Suppléances ». L'entrée n'apparaît que pour le DN, la DNA, les chefs de division, de section et de cellule.

**Écran et onglets**
Texte d'en-tête : « Pendant une absence, un responsable de rang comparable peut agir au nom du titulaire, sur choix explicite (« Agir en intérim »). Chaque action est journalisée « par intérim, au nom de ». »

| Section | Contenu | Message si vide |
|---|---|---|
| « Mes intérims » | « Vous êtes le suppléant : vous pouvez agir au nom du titulaire pendant la période. » Bouton « Agir en intérim » quand la suppléance est « En cours ». | « Aucune suppléance en cours ou à venir ne vous est confiée. » |
| « Mes suppléants » | « Les personnes désignées pour agir en votre nom pendant vos absences. » Bouton « Révoquer ». | « Aucun suppléant en cours ou à venir pour vous. » |
| « Désignées par moi » (si vous en avez) | « Suppléances que vous avez désignées pour des responsables de votre périmètre. » Bouton « Révoquer ». | « Aucune suppléance en cours ou à venir. » |

- Les suppléances terminées ou révoquées sont regroupées sous « Historique (N) ».
- Chaque carte indique le statut, « du … au … », le « Titulaire » et le « Suppléant » avec leur rôle.
- Le badge « Intérim actif dans cet onglet » apparaît sur la suppléance que vous utilisez en ce moment.

**Actions et formulaires**
- **« + Désigner un suppléant »** : ce bouton n'apparaît que si vous pouvez désigner pour vous-même ou pour un chef de votre périmètre. Il ouvre la fenêtre « Désigner un suppléant ». Texte : « Le suppléant pourra agir au nom du titulaire pendant la période, sur choix explicite, et chacune de ses actions sera journalisée « par intérim, au nom de ». »
  - « Titulaire » (obligatoire) : vous-même par défaut, ou un chef sur qui vous avez autorité.
  - « Suppléant (rang comparable) » (obligatoire) : la liste ne propose que des choix acceptés. Elle affiche « Chargement… », puis « Choisir… », ou « Aucun suppléant possible ».
  - « Du » (obligatoire, aujourd'hui par défaut).
  - « Au (inclus) » (obligatoire, pas avant la date de début). La période va de 0 h le premier jour à 23 h 59 le dernier jour.
  - Boutons : « Annuler » et « Désigner ».
- **Agir en intérim** : ouvrez le menu « Agir en intérim pour… » en haut de l'écran, ou cliquez sur « Agir en intérim » dans « Mes intérims ».
  - Le menu propose « Agir au nom de… », « Moi-même », puis chaque titulaire, au format « {rôle} · jusqu'au {date} ».
  - Le choix ne vaut que pour l'onglet du navigateur où vous l'avez fait.
  - Un bandeau reste affiché : « Mode intérim » — « Vous agissez au nom de {titulaire} ({rôle}), jusqu'au {date}. Vos actions sont journalisées « par intérim, au nom de ». »
  - Pour revenir à votre propre compte, cliquez sur « Quitter l'intérim ».
- **« Révoquer »** : l'application demande « Révoquer la suppléance de {nom} ? Elle cessera immédiatement. »

**Règle du rang comparable** (qui peut suppléer qui) :

| Titulaire | Suppléants possibles |
|---|---|
| DN ou DNA | DN, DNA, chef de division ou chef de cellule |
| Chef de division ou chef de cellule | Un autre chef de division ou de cellule, ou un chef de section de **sa** division |
| Chef de section | Un chef de section de la même division, ou son chef de division |

**Statuts et étapes**

| Statut | Signification | Qui le fait évoluer |
|---|---|---|
| « À venir » | La période n'a pas commencé. | Automatique à la date de début ; le titulaire ou son supérieur direct peut révoquer. |
| « En cours » | Le suppléant peut agir en intérim. | Automatique à la date de fin ; le titulaire ou son supérieur direct peut révoquer. |
| « Terminée » | La période est passée. | — |
| « Révoquée » | La suppléance a été arrêtée avant son terme. | — |
| « Non conforme — à redésigner » | Après un changement de rôle, la règle du rang comparable n'est plus respectée : « Ne respecte pas la règle de rang comparable : inutilisable, à révoquer puis redésigner. » | Le titulaire ou son supérieur : « Révoquer », puis une nouvelle désignation. |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Être titulaire | DN, DNA, chef de division, de section, de cellule | « Le titulaire doit exercer un rôle de responsable (Chef de Section/Division/Cellule, DN ou DNA). » |
| Être suppléant | Les mêmes rôles, avec un compte actif et de rang comparable | « Le suppléant désigné doit déjà exercer un rôle de responsable (Chef de Section/Division/Cellule, DN ou DNA). » / « Le suppléant désigné n'a pas de compte actif. » |
| Désigner | Le titulaire lui-même, ou son supérieur direct (dont le DN et la DNA) | « Seuls le titulaire ou son supérieur direct peuvent désigner un suppléant. » |
| Révoquer | Le titulaire, ou son supérieur direct | « Seuls le titulaire ou son supérieur direct peuvent révoquer cette suppléance. » |
| Agir en intérim | Le suppléant, pendant une suppléance « En cours » et conforme | « Aucune suppléance active ne vous autorise à agir au nom de cette personne. » |

**Pendant un intérim, le suppléant ne peut pas :**
- agir sur le titulaire lui-même (par exemple, donner un avis sur le propre congé du titulaire) ;
- utiliser les rôles fonctionnels du titulaire (par exemple DRH) ni ses habilitations (secrétariat courrier, gestionnaire logistique) ;
- appliquer une nomination (« Une nomination s'applique en votre nom propre, jamais en intérim. ») ni changer un rôle (« Un changement de rôle se fait en votre nom propre, jamais en intérim. ») ;
- faire les actions réservées à l'administrateur système.

Quand l'application demande une confirmation par mot de passe, c'est le mot de passe du suppléant qu'il faut saisir.

**Règles automatiques**
- Un titulaire ne peut avoir qu'**une seule** suppléance active ou prévue sur une même période.
- La règle du rang comparable est vérifiée de nouveau à chaque utilisation, d'après les rôles du moment.
- **Notifications à la désignation** (envoyées par email tout de suite) :
  - le suppléant reçoit « Vous avez été désigné suppléant » ;
  - si c'est le supérieur qui a désigné, le titulaire reçoit « Un suppléant a été désigné pour vous ».
- La révocation n'envoie pas de notification.

**Messages que vous pouvez voir**
- « Un responsable ne peut pas être son propre suppléant. » → Choisissez une autre personne.
- « Le suppléant doit être de rang comparable au titulaire : DN/DNA → DN, DNA, Chef de Division ou de Cellule ; Chef de Division ou de Cellule → un autre Chef de Division ou de Cellule, ou un Chef de Section de sa division ; Chef de Section → un Chef de Section de la même division ou son Chef de Division. » → Choisissez une personne de rang comparable.
- « La date de fin ne peut pas être antérieure à la date de début. » → Corrigez les dates.
- « Une suppléance est déjà active ou prévue pour ce titulaire sur cette période. » → Révoquez l'autre suppléance ou changez les dates.
- « Cette suppléance ne respecte pas la règle de rang comparable ; elle doit être redésignée. » → Révoquez-la, puis désignez une personne de rang comparable.
- « Cette suppléance est déjà révoquée. » → Rien à faire.
- « Intérim pour {nom} interrompu : … » (bandeau rouge) → La suppléance n'est plus utilisable : vous agissez de nouveau en votre propre nom.

**Captures**
10-rh-09-suppleances.png, 10-rh-12-designer-suppleant.png

---

### 3.11 Dossier du personnel

**À quoi sert ce module**
Le dossier administratif et personnel de chaque agent. Il comporte deux niveaux : la situation administrative, et les informations personnelles, qui sont protégées. Vous y relisez et confirmez vos informations, ou signalez une erreur au DRH.

**Accès**
Menu « Personnel » → « Dossier du personnel ». Tout le monde voit cette entrée, stagiaire compris. Chacun voit au moins son propre dossier.

**Écran et onglets**

- **Liste**
  - Les boutons « Mon dossier » et, pour le DRH, « Importer (Excel) ».
  - Un champ de recherche « Rechercher un nom, un poste… ».
  - Le nombre de dossiers. Si vous ne voyez que le vôtre, la liste ajoute : « — le vôtre : la consultation des autres dossiers suit la hiérarchie. »
  - La liste contient les personnes que vous pouvez consulter : vous-même ; toutes les personnes pour le DRH, le DN et la DNA ; les agents de leur périmètre pour les chefs.
- **Fiche d'une personne**, en sections :
  - **« Situation administrative »** (niveau 1) : « Statut d'emploi » (« Fonctionnaire », « Contractuel », « Stagiaire », « Mise à disposition »), « Grade », « Échelon », « Dans l'échelon depuis », « Catégorie », « Date de prise de service », « Fiche de poste » (bouton « Télécharger »).
  - **« Informations personnelles »** (niveau 2) : « Réservées à la personne et au DRH. ». Elles comprennent « Adresse personnelle », « Téléphone personnel », « Email personnel » et « Contact d'urgence ».
  - **« Diplômes »** (niveau 2). S'il n'y en a pas : « Aucun diplôme enregistré. »
  - **« Pièces administratives »** (niveau 2) : chaque pièce indique « déposée le … par … ». S'il n'y en a pas : « Aucune pièce enregistrée. »
  - **« Historique de carrière »** (niveau 2) : « Tenu automatiquement (affectations, promotions, changements de fonction) — lecture seule. »
- **Statut de chaque information** : « Non renseigné », « À vérifier » ou « Confirmé ».
- **Si vous consultez le dossier d'un autre** (chef, DN, DNA) : vous ne voyez que le niveau 1, avec la mention « Les informations personnelles, diplômes, pièces administratives et l'historique de carrière sont réservés à la personne concernée et au DRH. »
- **Pour vous-même et pour le DRH** : le niveau 2 est d'abord verrouillé. La fiche affiche « 🔒 Informations personnelles, diplômes, pièces et historique de carrière : éléments protégés. Confirmez votre identité pour les afficher. » avec le bouton « Afficher les données protégées ».

**Actions et formulaires**
- **« Afficher les données protégées »** ouvre « Confirmez votre identité » : saisissez « Votre mot de passe » (et le code si la double authentification est active). La confirmation vaut 10 minutes, et chaque ouverture est enregistrée.
- **« Modifier » (Situation administrative)** ouvre la fenêtre « Situation administrative ». Texte : « Chaque champ modifié repasse « à vérifier » jusqu'à confirmation par la personne. » Tous les champs sont facultatifs :
  - « Statut d'emploi » ;
  - « Grade » (100 caractères au maximum) ;
  - « Échelon » (50 caractères au maximum) ;
  - « Dans cet échelon depuis le » ;
  - « Catégorie (A, B, C, D…) » (20 caractères au maximum) ;
  - « Date de prise de service » ;
  - « Fiche de poste » (un fichier, qui remplace l'actuelle).

  Bouton : « Enregistrer ». Message affiché ensuite : « Situation administrative enregistrée. »
- **« Modifier » (Informations personnelles)** ouvre une fenêtre de même nom. Tous les champs sont facultatifs :
  - « Adresse personnelle » (300 caractères au maximum) ;
  - « Téléphone personnel » (30 caractères au maximum) ;
  - « Email personnel » ;
  - « Contact d'urgence — nom » (150) ;
  - « Contact d'urgence — lien » (100) ;
  - « Contact d'urgence — téléphone » (30).

  Bouton : « Enregistrer ».
- **« Ajouter » (Diplômes)** ouvre « Ajouter un diplôme » :
  - « Intitulé » (obligatoire, 200 caractères au maximum) ;
  - « Établissement (facultatif) » ;
  - « Année d'obtention (facultatif) » ;
  - « Justificatif (facultatif) ».

  Bouton : « Ajouter ». Chaque diplôme a aussi les boutons « Justificatif » et « Supprimer ».
- **« Ajouter » (Pièces administratives)** ouvre « Ajouter une pièce administrative » :
  - « Pièce requise fournie (facultatif) » : « — Autre pièce — » ou l'une des pièces de la liste du DRH ;
  - « Libellé » (150 caractères au maximum) ;
  - « Fichier » (obligatoire).

  Bouton : « Ajouter ». Chaque pièce a aussi les boutons « Télécharger » et « Supprimer ».
- **« Confirmer mes informations »** : ce bouton apparaît sur votre propre dossier quand des éléments sont « à vérifier », avec le bandeau « Des informations de votre dossier sont « à vérifier ». Relisez-les, puis confirmez-les ou signalez une erreur. » Message affiché ensuite : « Vos informations sont confirmées. »
- **« Signaler une erreur »** (sur votre propre dossier) ouvre une fenêtre de même nom : « Le DRH est prévenu et corrige le dossier. »
  - « Information concernée » (liste) : Statut d'emploi, Grade, Échelon, Date de prise de service, Fiche de poste, Adresse personnelle, Téléphone personnel, Email personnel, Contact d'urgence, Diplômes, Pièces administratives, Historique de carrière, Autre.
  - « Ce qui est inexact » (obligatoire, 2 000 caractères au maximum).

  Bouton : « Envoyer au DRH ». Message affiché ensuite : « Le DRH a été prévenu. »
- **« Importer (Excel) »** (DRH) ouvre « Importer le personnel (Excel) ». Texte : « Une ligne par personne. Adresse inconnue : un compte est créé — Chargé d'Études, ou Stagiaire si la colonne Rôle l'indique (les autres rôles s'attribuent ensuite par l'administrateur système). Adresse connue : seul le dossier est mis à jour. »
  - « Fichier .xlsx » (obligatoire, 25 Mo au maximum).
  - Colonnes reconnues sur la première ligne : Email, Prénom, Nom, Rôle, Division, Section, Cellule, Statut d'emploi, Grade, Échelon, Date de prise de service, Téléphone personnel, Adresse personnelle, Email personnel, Contact urgence nom / lien / téléphone.
  - Bouton : « Importer ».
  - Le « Rapport d'import » affiche le bilan « N lignes : X comptes créés, Y dossiers mis à jour, Z erreurs », puis une ligne par personne, au format « Ligne n (email) — message ». Chaque ligne est traitée séparément : une erreur n'annule pas les autres.

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Non renseigné » | L'information est vide. | La personne ou le DRH (« Modifier »). |
| « À vérifier » | L'information a été saisie ou modifiée. | La personne concernée, et elle seule (« Confirmer mes informations »). |
| « Confirmé » | La personne a attesté l'information. | Toute nouvelle modification la repasse « À vérifier ». |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Lire la situation administrative | La personne, le DRH, le DN, la DNA, ses chefs | « Ce dossier est hors de votre périmètre. » |
| Lire et modifier le niveau 2 (informations personnelles, diplômes, pièces, historique) | La personne et le DRH seulement, après saisie du mot de passe. Jamais le DN, la DNA ni les chefs. | « Ce contenu est réservé à la personne concernée et au DRH. » |
| Modifier la situation administrative | La personne et le DRH | « Seuls le DRH et la personne concernée peuvent modifier ce dossier. » |
| Confirmer ses informations | La personne seulement | « Seule la personne concernée peut confirmer ses propres informations. » |
| Signaler une erreur | La personne, sur son propre dossier | « Vous ne pouvez signaler une erreur que sur votre propre dossier. » |
| Importer (Excel) | Le DRH | Bouton absent |

**Règles automatiques**
- Chaque champ modifié repasse « À vérifier ».
- Un signalement d'erreur prévient tous les DRH actifs par notification.
- Chaque ouverture des données protégées est enregistrée.
- L'« Historique de carrière » se remplit automatiquement : affectations, promotions, changements de fonction, actes de carrière signés.

**Messages que vous pouvez voir**
- « Ce dossier est hors de votre périmètre. » → Vous n'avez pas autorité sur cette personne.
- « Pièce requise inconnue ou retirée de la liste. » → Choisissez une autre pièce, ou « — Autre pièce — ».
- « Aucune fiche de poste » → Aucune fiche n'est jointe au dossier.
- « Fichier Excel illisible. » / « Fichier Excel vide ou sans ligne de données. » / « Colonne "Email" introuvable dans la première ligne. » → Vérifiez le fichier et sa première ligne.
- « Email manquant » (dans le rapport) → Cette ligne n'a pas d'adresse email : elle a été ignorée.

**Captures**
10-rh-01-dossier-personnel.png

---

### 3.12 Ressources humaines : effectifs, alertes, fiches de poste, formation, pièces requises

**À quoi sert ce module**
L'écran du suivi RH. Les effectifs et les alertes sont calculés à partir des dossiers et ne se saisissent jamais. On y trouve aussi les fiches de poste, le plan de formation et la liste des pièces attendues dans chaque dossier. L'onglet « Carrière et actes » est décrit en 3.13.

**Accès**
Menu « Personnel » → « Ressources humaines ». Tout le personnel voit cette entrée, sauf le stagiaire. Les onglets affichés dépendent de votre rôle.
Texte d'en-tête : « Effectifs et alertes calculés à partir des dossiers, jamais saisis ; mouvements de carrière portés par un acte numéroté du Courrier et appliqués au dossier à sa signature. »

**Écran et onglets**

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Effectifs » | DRH, DN, DNA | Les indicateurs et les répartitions du personnel. |
| « Alertes » | DRH | Les alertes calculées. |
| « Carrière et actes » | Tout le monde | Voir 3.13. |
| « Fiches de poste » | Tout le monde | Les fiches par fonction. |
| « Formation » | DRH, DN, DNA, chefs de division, de section, de cellule | Les besoins de formation de l'année. |
| « Pièces requises » | DRH | La liste des pièces attendues dans un dossier complet. |

- **« Effectifs »**
  - Trois indicateurs :
    - « Agents en fonction » (hors départs confirmés) ;
    - « Ancienneté moyenne » (avec le nombre de dates de prise de service renseignées) ;
    - « Part des femmes » (avec le nombre de genres renseignés).
  - Trois répartitions : « Par unité », « Par statut », « Par catégorie ».
  - En bas de l'onglet : « Calculé le … à partir des dossiers ; rien n'est saisi ici. »
- **« Alertes »**
  - Une ligne par alerte : « {libellé} — {nom} », le détail, la priorité et le lien « Ouvrir ».
  - Priorités : « Urgente », « À traiter », « À compléter ».
  - S'il n'y a aucune alerte : « Aucune alerte : dossiers complets, aucune échéance proche. »
- **« Fiches de poste »**
  - Texte : « Chaque fiche décrit une fonction : tout titulaire de la fonction et sa hiérarchie la consultent. »
  - Chaque fiche présente « Missions », « Activités » et « Compétences ».
  - Le badge « Ma fonction » signale la fiche de votre fonction.
  - S'il n'y a aucune fiche : « Aucune fiche de poste rédigée. »
- **« Formation »**
  - Le choix « Année » (année précédente, en cours, suivante).
  - Une ligne par besoin : l'intitulé, « {unité} · {origine} · N agent(s) », la priorité et le statut.
  - S'il n'y a rien : « Aucun besoin exprimé pour {année}. »
  - Un chef voit les besoins de son unité et des unités qui en dépendent (par exemple, un chef de division voit ceux de ses sections). Le DRH, le DN et la DNA voient tous les besoins.
- **« Pièces requises »**
  - La liste des pièces ; une pièce retirée est barrée et porte le badge « Retirée ».

**Actions et formulaires**
- **Alertes → « Ouvrir »** : selon l'alerte, ce lien ouvre la fiche de l'agent, l'onglet « Carrière et actes » filtré sur l'agent, ou le dossier du personnel.
- **« + Nouvelle fiche de poste »** et **« Modifier »** (DRH) ouvrent « Nouvelle fiche de poste » ou « Modifier la fiche de poste » :
  - « Fonction » (obligatoire, de 2 à 160 caractères, une seule fiche par fonction) ;
  - « Missions » (obligatoire, de 10 à 6 000 caractères) ;
  - « Activités » (facultatif, 6 000 caractères au maximum) ;
  - « Compétences » (facultatif, 6 000 caractères au maximum).
- **« + Exprimer un besoin »** (chefs, DN, DNA) ouvre « Besoin de formation — {votre unité} » :
  - « Intitulé de la formation » (obligatoire, de 3 à 200 caractères) ;
  - « Priorité » (« Priorité haute », « Priorité moyenne » par défaut, « Priorité basse ») ;
  - « Origine » (« Entretien annuel » par défaut, « Plan de travail », « Nouvelle fonction », « Obligation réglementaire », « Autre ») ;
  - « Agents concernés » (de 1 à 500, 1 par défaut).

  Bouton : « Exprimer le besoin ».
- **Statut d'un besoin** (DRH) : choisissez le statut dans la liste de la ligne : « Exprimé », « Retenu », « Réalisé » ou « Écarté ».
- **Pièces requises** (DRH) :
  - champ « Nouvelle pièce requise » (de 3 à 120 caractères), puis le bouton « Ajouter la pièce » ;
  - sur chaque ligne, « Retirer » ou « Rétablir ».

**Statuts et étapes** (besoins de formation)

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Exprimé » | Le chef a exprimé le besoin. | Le DRH |
| « Retenu » | Le besoin est inscrit au plan de formation de l'année. | Le DRH (« Réalisé ») |
| « Réalisé » | La formation a eu lieu. | — |
| « Écarté » | Le besoin n'est pas retenu. | Le DRH peut changer d'avis. |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Voir les effectifs | DRH, DN, DNA | « Les effectifs sont consultés par le DRH, le DN et la DNA. » |
| Voir les alertes, gérer les pièces requises | DRH | « Réservé au DRH. » |
| Lire les fiches de poste | Tout le personnel | — |
| Rédiger ou modifier une fiche de poste | DRH | « Les fiches de poste sont rédigées par le DRH. » |
| Exprimer un besoin de formation | Chefs de division, de section, de cellule ; DN ; DNA | « Les besoins de formation sont exprimés par les chefs d'unité. » |
| Voir les besoins | Les mêmes, et le DRH | « Les besoins de formation sont exprimés par les chefs d'unité et consolidés par le DRH. » |
| Changer le statut d'un besoin | DRH | « Le plan de formation est arrêté par le DRH. » |

**Règles automatiques**
Les alertes sont calculées à chaque ouverture et ne sont pas enregistrées. Une alerte disparaît d'elle-même dès que sa cause est réglée.

| Alerte | Quand elle apparaît | Priorité | « Ouvrir » mène à |
|---|---|---|---|
| « Fin de contrat à échéance » | La fin de contrat tombe dans les 15 jours, ou elle est passée sans confirmation. Le délai de 15 jours est réglable par l'administrateur système, entre 5 et 60 jours. | « Urgente » à 3 jours ou moins, sinon « À traiter » | La fiche de l'agent |
| « Fin de stage : attestation à préparer » | Même règle, pour une fin de stage. | Idem | La fiche de l'agent |
| « Avancement d'échelon à instruire » | Un fonctionnaire est dans son échelon depuis plus de 24 mois, sans avancement ni promotion en cours. Le délai est réglable par l'administrateur système, entre 12 et 60 mois. | « À traiter » | « Carrière et actes » |
| « Dossier incomplet » | Il manque le statut d'emploi, le grade, l'échelon, la catégorie ou la date de prise de service, ou une pièce requise non retirée. Concerne les comptes actifs, hors stagiaires. | « À compléter » | Le dossier du personnel |

Exemples de détail : « Fin prévue le … (dans N jour(s)). », « Fin prévue le …, dépassée de N jour(s) : à confirmer ou prolonger. », « Échelon … depuis le … (plus de N mois). », « Manque : … ».

Pour qu'une pièce soit comptée comme fournie, il faut la choisir dans « Pièce requise fournie » au moment de l'ajouter au dossier.

**Messages que vous pouvez voir**
- « Une fiche existe déjà pour cette fonction. » → Modifiez la fiche existante.
- « Fiche de poste introuvable. » → Rechargez la page.
- « Votre unité n'est pas retrouvée dans l'organigramme. » → Votre rattachement est à corriger (voir l'administrateur système ou le DRH).
- « Le besoin a déjà ce statut. » → Rien à faire.
- « Besoin introuvable. » → Rechargez la page.
- « Cette pièce figure déjà dans la liste. » → Rétablissez la pièce existante plutôt que d'en créer une nouvelle.
- « Pièce introuvable. » → Rechargez la page.

**Captures**
10-rh-02-effectifs.png, 10-rh-03-alertes.png, 10-rh-06-fiches-de-poste.png, 10-rh-07-formation.png

---

### 3.13 Carrière, nomination et changement de rôle

**À quoi sert ce module**
Le DRH prépare les mouvements de carrière : nomination, avancement d'échelon, promotion, mutation, fin de contrat. Chaque mouvement est porté par un acte numéroté du Courrier. Le dossier n'est modifié qu'au moment où le DN ou la DNA signe l'acte. Quand une nomination vise un poste de chef, l'administrateur système applique ensuite les nouveaux droits du compte.

**Accès**
- Menu « Personnel » → « Ressources humaines » → onglet « Carrière et actes ». Tout le monde voit cet onglet. Un agent n'y voit que ses propres mouvements appliqués ; le DRH, le DN et la DNA voient tout.
- Le bloc « Familles d'actes » est visible pour le DRH, le DN, la DNA et l'administrateur système.
- L'onglet « Nominations » se trouve dans le menu « Administration » → « Utilisateurs », pour l'administrateur système seulement.

**Écran et onglets**

- **« Mouvements de carrière »**
  - Une ligne par mouvement :
    - « {type} — {agent} » ;
    - « Effet le … », suivi de « · acte n° … », ou de « · acte en cours dans le Courrier » ;
    - les changements, au format « {élément} : avant → **après** » (Fonction, Poste (droits), Échelon, Grade, Catégorie, Division, Section, Cellule, Fin de contrat).
  - Le badge de statut et, pour une nomination à un poste, le badge des droits.
  - Les boutons « Voir l'acte », « Préparer l'acte » et « Annuler ».
  - S'il n'y a rien : « Aucun mouvement de carrière. »
- **« Familles d'actes »**
  - Texte : « Chaque famille a sa séquence (celle de son registre du Courrier, continue et jamais réutilisée) et son signataire. »
  - Une ligne par famille, au format « {famille} · signataire : DN ou DNA », avec le registre associé ou « Registre à choisir ».
  - Chaque type de mouvement est rattaché à une famille :

    | Mouvement | Famille d'actes |
    |---|---|
    | Nomination | Décision de nomination |
    | Avancement d'échelon et promotion | Décision d'avancement |
    | Mutation | Arrêté d'affectation |
    | Fin de contrat | Décision de fin de contrat |

    Les libellés exacts des familles dépendent du paramétrage (à confirmer).
- **Onglet « Nominations »** (administrateur système). Les autres onglets de « Utilisateurs » sont « Tous les comptes », « Inscriptions en attente » et « Rôles fonctionnels ».
  - Texte d'introduction : « Un acte de nomination signé à un poste de responsabilité met à jour la fonction du dossier ; le rôle et l'unité du compte ne changent qu'après votre confirmation, le jour même. Motif enregistré : le numéro de l'acte. »
  - **« Nominations à appliquer »**
    - « {agent} → {rôle — unité} » ;
    - « Acte n° … · effet le … · fonction « … » · rôle actuel : … » ;
    - pour le titulaire actuel du poste : « Actuel titulaire : {nom} ({rôle}) → {rôle proposé} », ou « rôle à choisir », ou « Poste vacant : aucun titulaire à déplacer. » ;
    - si une tentative a échoué : « Dernière tentative : … » ;
    - les boutons « Confirmer… » et « Refuser… ».
    - S'il n'y a rien : « Aucune nomination en attente. »
  - **« Écarts entre fonction du dossier et rôle du compte »**
    - Texte : « Relevés à chaque ouverture, signalés chaque matin aux administrateurs et dans la supervision. »
    - Une ligne par écart : nom, rôle, fonction, raison, et ce qu'il faut faire.
    - S'il n'y a aucun écart : « Aucun écart : fonctions et rôles concordent. »
  - **« Nominations traitées »** : les nominations avec leur badge « Droits appliqués » ou « Refusé », la personne qui a décidé, la date et, le cas échéant, le motif.

**Actions et formulaires**
- **« + Nouveau mouvement »** (DRH) ouvre « Nouveau mouvement de carrière » :
  - « Agent » (obligatoire) : les comptes actifs, hors stagiaires.
  - « Mouvement » : « Nomination », « Avancement d'échelon » (choisi par défaut), « Promotion », « Mutation » ou « Fin de contrat ».
  - « Date d'effet » (obligatoire).
  - Les champs suivants dépendent du mouvement choisi :

    | Mouvement | Champs |
    |---|---|
    | Nomination | « Poste visé ». Choix possibles : « Autre fonction (texte libre, sans effet sur les droits) », ou un poste de responsabilité affiché « {fonction} (actuel : {nom}) » ou « {fonction} (vacant) ». Les postes sont « Directeur National », « Directeur National Adjoint », « Chef de Division — {unité} », « Chef de Section — {unité} », « Chef de Cellule — {unité} ». Le rôle, l'unité et la fonction en découlent. Avec « Autre fonction », remplissez « Nouvelle fonction » (obligatoire, 120 caractères au maximum). |
    | Avancement d'échelon | « Nouvel échelon » (obligatoire, 120 caractères au maximum). |
    | Promotion | « Nouveau grade » (obligatoire), « Nouvel échelon » (facultatif), « Catégorie » (facultatif). |
    | Mutation | « Division », « Section », « Cellule » : la nouvelle unité. |
    | Fin de contrat | La date d'effet devient la nouvelle date de fin du contrat. |

  - Si vous choisissez un poste visé, la fenêtre l'explique : « Fonction au dossier : … À la signature de l'acte, l'administrateur reçoit le changement de rôle pré-rempli ({titulaire} redevient Chargé(e) d'Études dans la même unité, sauf choix contraire de l'administrateur) et le confirme ou le refuse ; l'état des droits s'affiche sur le mouvement. »
  - « Motif » : facultatif, sauf pour une « Fin de contrat » où il est obligatoire (1 000 caractères au maximum).
  - Rappel en bas de la fenêtre : « Le dossier n'est modifié qu'à la signature de l'acte par le DN ou la DNA. »
  - Bouton : « Préparer le mouvement ».
- **Choisir le registre d'une famille** (DRH, administrateur système) : dans « Familles d'actes », la liste « — Registre à choisir — » propose les registres d'actes actifs de la Direction.
- **« Préparer l'acte »** (DRH) : l'application crée l'acte dans le Courrier.
  - L'objet de l'acte est « {famille} — {type} de {agent} ».
  - L'agent est bénéficiaire et doit prendre connaissance de l'acte.
  - La décision est jointe en PDF, avec la mention « PROJET — non signé ».
  - L'acte est créé **en brouillon** : ouvrez-le avec « Voir l'acte », puis cliquez sur « Soumettre au visa » dans le Courrier. Ensuite viennent le visa, puis la signature par le DN ou la DNA.
- **« Annuler »** (DRH) : possible sur un mouvement « Préparé », ou dont l'acte a été annulé dans le Courrier.
- **« Confirmer… »** (administrateur système) ouvre « Confirmer la nomination » :
  - Texte : « {agent} devient {rôle — unité} (acte n° …). Ses sessions sont fermées ; il ou elle se reconnecte avec ses nouveaux droits. »
  - Si le poste a un titulaire actuel, vous choisissez son nouveau rôle : « Rôle », « Division », « Section », « Cellule ». Ces champs sont pré-remplis avec « chargé d'études dans la même unité » quand le poste est celui d'un chef de division, de section ou de cellule. Pour un poste de DN ou de DNA, rien n'est proposé : le rôle est obligatoire à choisir. Texte : « Son rôle change d'abord (le poste est libéré), avec le même motif. »
  - « Précision (facultative, ajoutée au motif « Acte de nomination n° … ») » (500 caractères au maximum).
  - Bouton : « Appliquer les droits ».
- **« Refuser… »** (administrateur système) ouvre « Refuser la nomination » :
  - Texte : « Le rôle de {nom} ne change pas ; le DRH voit le refus et son motif sur le mouvement (acte n° …). »
  - « Motif (obligatoire) » (au moins 5 caractères, 1 000 au maximum).
  - Bouton : « Refuser ».

**Statuts et étapes**

| Statut du mouvement | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Préparé » | Le mouvement est enregistré, sans acte. | Le DRH (« Préparer l'acte » ou « Annuler ») |
| « Acte en cours » | L'acte existe dans le Courrier (brouillon, visa ou signature). | Le DRH (« Soumettre au visa »), les viseurs, puis le DN ou la DNA (signature) |
| « Appliqué » | L'acte est signé et le dossier est mis à jour. | — |
| « Annulé » | Le mouvement est abandonné. | — |

| Badge des droits (nomination à un poste) | Signification | Qui le fait évoluer |
|---|---|---|
| « Droits en attente (administrateur) » | L'acte est signé ; le rôle et l'unité du compte attendent la confirmation. | L'administrateur système (« Confirmer… » ou « Refuser… ») |
| « Droits appliqués » | Le compte a son nouveau rôle et sa nouvelle unité. Ce badge apparaît aussi directement si le compte occupait déjà le poste. | — |
| « Droits refusés » | L'administrateur a refusé. Le motif s'affiche : « Motif du refus de l'administrateur : … ». | — |

**Ce qui change à la signature de l'acte**

| Mouvement | Effet sur le dossier |
|---|---|
| Nomination | La fonction du dossier est mise à jour. Si un poste était visé, un changement de rôle pré-rempli est créé et attend l'administrateur. |
| Avancement d'échelon | Le nouvel échelon est enregistré, et « Dans l'échelon depuis » prend la date d'effet. |
| Promotion | Le grade est mis à jour, ainsi que l'échelon et la catégorie s'ils ont été renseignés. |
| Mutation | L'unité de rattachement change. |
| Fin de contrat | La date de fin de contrat de l'agent est enregistrée. |

**À la confirmation par l'administrateur** :
- Tout s'applique d'un bloc, ou rien ne s'applique :
  - le titulaire actuel du poste change d'abord de rôle (le poste est libéré), puis la personne nommée prend le poste ;
  - le motif enregistré est « Acte de nomination n° … ».
- La fonction de l'ancien titulaire suit son nouveau rôle. Elle est inscrite à son historique de carrière avec la mention « (suite à l'acte n° …) », sans nouvel acte du DRH.
- En cas d'échec, rien n'est appliqué : la nomination reste en attente et la raison s'affiche sous « Dernière tentative : … ».

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Préparer un mouvement, préparer l'acte, annuler | DRH, sauf pour son propre mouvement | « Les mouvements de carrière sont instruits par le DRH. » / « Le DRH n'instruit pas son propre mouvement de carrière. » |
| Voir tous les mouvements | DRH, DN, DNA | « Vous ne voyez que vos propres mouvements de carrière. » |
| Voir les familles d'actes | DRH, DN, DNA, administrateur système | « Réservé au DRH, à l'administrateur, au DN et à la DNA. » |
| Choisir le registre d'une famille | DRH, administrateur système | « Réservé au DRH et à l'administrateur. » |
| Signer l'acte | DN ou DNA | « Un acte de ce registre est signé par le DN ou la DNA. » ; le bénéficiaire ne signe jamais : « Le bénéficiaire d'un acte ne peut pas le signer (ni son suppléant en son nom). » |
| Confirmer ou refuser une nomination | L'administrateur système, en son nom propre (jamais en intérim) | « Seul l'administrateur système applique les droits d'une nomination. » / « Une nomination s'applique en votre nom propre, jamais en intérim. » |
| Muter un agent | Seulement pour un chargé d'études, un DRH ou un administrateur système | « Un chef, un assistant ou un membre de la Direction change de poste par le changement de rôle (Utilisateurs), pas par une mutation. » |

**Règles automatiques**
- **Nomination signée** : tous les administrateurs système reçoivent une notification urgente (email immédiat).
  - Titre : « Nomination à appliquer — acte n° … ».
  - Texte : « {nom} est nommé(e) {rôle}. Confirmez le changement de rôle pré-rempli (effet sur l'actuel titulaire du poste compris) ou refusez-le avec un motif, le jour même. »
  - Bouton : « Examiner ».
- **Mouvement appliqué** :
  - le DN et la DNA reçoivent « {type} appliqué(e) — acte n° … » (« Le dossier de l'agent a été mis à jour. », bouton « Voir le mouvement ») ;
  - l'agent reçoit « Votre dossier a été mis à jour. Prenez connaissance de l'acte dans le module Courrier. » (bouton « Voir mon dossier »).
- **Confirmation ou refus** : le DRH reçoit « Droits appliqués — acte n° … » ou « Droits refusés — acte n° … » (bouton « Voir le mouvement »).
- **Écarts fonction / rôle** : chaque jour à 6 h 40 (heure de Conakry), les administrateurs système reçoivent « Fonction et rôle : N écart(s) à traiter » (bouton « Voir les écarts »). Les écarts relevés sont :
  - un acte de nomination signé dont le changement de rôle attend encore l'administrateur ;
  - une fonction de chef ou de la Direction au dossier, sur un compte qui n'a pas ce rôle ;
  - un compte de chef ou de la Direction dont la fonction au dossier est « Chargé d'études ».

**Messages que vous pouvez voir**
- « Un mouvement de ce type est déjà en cours pour cet agent. » → Terminez ou annulez le mouvement en cours.
- « Un stagiaire n'a pas de carrière : son stage est suivi dans le module Stages. » → Utilisez le module Stages.
- « Fonction : valeur après le mouvement obligatoire. » (même message pour Échelon et Grade) → Remplissez le champ.
- « … : 120 caractères au plus. » → Raccourcissez le texte.
- « Poste de responsabilité : DN, DNA, Chef de Division, de Section ou de Cellule. » → Choisissez un poste de la liste.
- « Ce poste n'existe pas (unité suspendue ou inconnue). » → Vérifiez l'organigramme.
- « L'agent a déjà ce rattachement. » → Choisissez une autre unité.
- « Ce compte n'est rattaché à aucun agent. » → Le DRH doit d'abord rattacher le compte à une fiche agent (voir 3.14).
- « Une fin de contrat est motivée. » → Saisissez un motif.
- « Agent introuvable ou inactif. » → Le compte n'est plus actif.
- « Choisissez d'abord le registre de la famille « … » (Ressources humaines → Carrière et actes → Familles d'actes). » → Choisissez le registre, puis recommencez.
- « Choisissez un registre d'actes actif de la Direction (signature par le DN ou la DNA). » → Ce registre ne convient pas.
- « Ce registre porte déjà la famille « … » : chaque famille a sa propre séquence. » → Choisissez un autre registre.
- « L'acte de ce mouvement existe déjà (en cours dans le module Courrier) ou le mouvement est clos. » → Suivez l'acte avec « Voir l'acte ».
- « Ce mouvement est porté par un acte en cours ou est déjà appliqué : annulez d'abord l'acte dans le Courrier. » → Annulez l'acte dans le Courrier, puis le mouvement.
- « Cette nomination a déjà été traitée (droits appliqués ou refusés). » / « Cette nomination vient d'être traitée : rechargez. » → Rechargez la page.
- « Le compte nommé n'est plus actif : refusez la nomination avec un motif. » → Utilisez « Refuser… ».
- « Choisissez le nouveau rôle de {nom} ({rôle}) : aucun rôle n'est proposé d'office pour la Direction. » → Remplissez « Rôle » pour le titulaire actuel.
- « Rôle de l'actuel titulaire : Chargé d'Études, un poste de responsabilité, DRH ou administrateur. » → Choisissez l'un de ces rôles.
- « Un motif d'au moins 5 caractères est obligatoire. » → Complétez le motif du refus.

**Captures**
10-rh-04-carriere-droits-en-attente.png, 10-rh-05-nouvelle-nomination-poste-vise.png, 11-admin-02-nominations.png, 11-admin-03-confirmer-nomination.png, 07-courrier-06-acte-en-visa.png

---

### 3.14 Agents

**À quoi sert ce module**
Chaque personne de la DNPEC a une fiche agent (matricule, unité, fonction, statut), distincte de son compte de connexion. Le DRH y gère le cycle de vie des agents : création, fins de contrat ou de stage, suspension, départ, réactivation.

**Accès**
Menu « Personnel » → « Agents ». Cette entrée n'est visible que pour le DRH et le gestionnaire RH (rôles fonctionnels). L'administrateur système ne voit que les agents sans compte, quand il crée un compte depuis « Utilisateurs ».

**Écran et onglets**

- **Encadré « Reprise : points à traiter »** (quand il y en a) :
  - « N matricule(s) provisoire(s) à remplacer », avec le lien « Afficher » ;
  - « N unité(s) sans responsable : … » ;
  - « N unité(s) avec deux chefs actifs » ;
  - « N agent(s) rattaché(s) à une unité suspendue » ;
  - « N stagiaire(s) sans date de fin ».
- **Filtres**
  - Recherche « Nom, prénom ou matricule… ».
  - Statut : « Tous les statuts », « En activité » (choisi par défaut), « Suspendus », « Partis ».
  - « Toutes les unités ».
  - Case à cocher « Fin dans 15 jours ».
- **Tableau** : « Matricule » (avec « (provisoire) » le cas échéant), « Agent », « Unité », « Statut », « Fin prévue » (avec « (stage) » ou « (contrat) »).
- **Fiche d'un agent**
  - Le badge « MATRICULE PROVISOIRE » le cas échéant.
  - La fin prévue : « Fin de stage le … » ou « Fin de contrat le … (dans N jours) ».
  - L'avertissement « Sans décision, l'agent passera automatiquement « Parti » et son compte sera désactivé à l'échéance. », ou « Fin confirmée : l'agent passera « Parti » et son compte sera désactivé à l'échéance. »
  - « Unité », « Fonction », « Genre », « Compte », et la section « Historique ».

**Actions et formulaires**
- **« + Nouvel agent »** (DRH) ouvre « Nouvel agent » :
  - « Matricule (facultatif) » : sinon, un matricule provisoire est attribué ;
  - « Nom » (obligatoire) ;
  - « Prénoms » (obligatoire) ;
  - « Genre » (facultatif : « Femme », « Homme ») ;
  - « Unité » (obligatoire, une unité ouverte) ;
  - « Fonction » (facultatif) ;
  - « Fin prévue » (« Aucune », « Fin de contrat », « Fin de stage ») ; si elle est renseignée, « Date de fin » devient obligatoire.

  Texte : « Le compte de connexion se crée ensuite, par l'administrateur, à partir de cet agent. » Bouton : « Créer l'agent ».
- **« Modifier »** ouvre « Modifier {prénoms nom} » :
  - « Matricule » : à remplir pour remplacer un matricule provisoire (indication « Matricule de la Fonction publique ») ;
  - « Nom », « Prénoms » (obligatoires) ;
  - « Genre », « Fonction » (facultatifs) ;
  - « Fin de contrat (facultative) ».
- **« Prolonger le stage »** ou **« Prolonger le contrat »** : « Nouvelle date de fin » (obligatoire, après la fin actuelle) et « Motif » (obligatoire).
- **« Confirmer la fin »** : « {nom} passera « Parti » et son compte sera désactivé le lendemain du {date}. Vous ne recevrez plus de rappel. Le dossier, l'évaluation et l'attestation sont conservés. »
- **« Suspendre »** : « Le compte est suspendu aussitôt : {nom} ne peut plus se connecter. » Champ « Motif » (obligatoire).
- **« Réactiver »** : « Motif » (obligatoire) et « Nouvelle date de fin ». Cette date est obligatoire si la fin prévue est passée, facultative sinon.
- **« Enregistrer le départ »** : « Le compte est désactivé, les tâches en cours sont transférées au responsable de l'unité, les suppléances et rôles en cours sont retirés. Le dossier est conservé. » Champs « Date de départ » (obligatoire, pas dans le futur) et « Motif » (obligatoire).

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « En activité » | L'agent travaille ; son compte est utilisable. | Le DRH (« Suspendre », « Enregistrer le départ ») ou l'application (fin prévue dépassée) |
| « Suspendu » | La connexion est bloquée. | Le DRH (« Réactiver », « Enregistrer le départ ») |
| « Parti » | Le compte est désactivé ; le dossier est conservé. | Le DRH (« Réactiver ») |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Voir la liste des agents | DRH, gestionnaire RH | « Liste des agents réservée au DRH et au gestionnaire RH. » |
| Voir une fiche | DRH, gestionnaire RH, l'agent lui-même | « Fiche agent réservée au DRH, au gestionnaire RH et à l'agent lui-même. » |
| Créer, modifier, prolonger, confirmer, suspendre, réactiver, enregistrer un départ | DRH, jamais sur sa propre fiche | « Vous ne pouvez pas modifier votre propre fiche agent. » / « Vous ne pouvez pas changer votre propre situation. » |

**Règles automatiques**
Chaque jour à 0 h 15 (heure de Conakry), pour chaque agent qui a une fin prévue :
- **15 jours avant la fin** (réglable de 5 à 60 jours par l'administrateur système) : le DRH reçoit « {Fin de contrat|Fin de stage} de {nom} le {date} » : « Dans N jour(s). Vous pouvez prolonger … ou confirmer la fin. Sans décision, le passage à « Parti » sera automatique à l'échéance. » Bouton : « Décider de la fin du contrat » ou « Décider de la fin du stage ».
- **3 jours avant la fin**, sauf si la fin est confirmée : le DRH reçoit « Rappel : … de {nom} le {date} ».
- **Le lendemain de la date de fin** : l'agent passe « Parti » et son compte est désactivé. Le DRH reçoit « {nom} est passé(e) « Parti » » : « … compte désactivé automatiquement. Le dossier, l'évaluation et l'attestation sont conservés ; vous pouvez réactiver l'agent. » Bouton : « Voir l'agent ».

**Messages que vous pouvez voir**
- « Ce matricule est déjà attribué. » / « Ce matricule est déjà attribué à un autre agent. » → Vérifiez le matricule.
- « Cette unité est fermée. » → Choisissez une unité ouverte.
- « Précisez s'il s'agit d'une fin de stage ou de contrat. » → Remplissez « Fin prévue ».
- « La fin d'un stage se prolonge par l'action « Prolonger le stage ». » → Utilisez ce bouton plutôt que « Modifier ».
- « La nouvelle date de fin doit suivre la fin prévue actuelle. » → Choisissez une date plus tardive.
- « Aucune fin prévue à prolonger. » / « Aucune fin prévue à confirmer. » → L'agent n'a pas de fin prévue.
- « La fin est déjà confirmée. » → Rien à faire.
- « L'agent est parti : réactivez-le avec une nouvelle date de fin. » → Utilisez « Réactiver ».
- « La nouvelle date de fin est déjà passée. » / « La fin prévue est passée : indiquez une nouvelle date de fin, sinon l'agent repartirait aussitôt. » → Saisissez une date future.
- « L'agent est déjà en activité. » / « L'agent est déjà parti. » → Rien à faire.
- « La date de départ ne peut pas être dans le futur : utilisez la fin prévue. » → Pour un départ futur, utilisez la fin prévue.
- « Transition impossible : l'agent est « … ». » → Cette action ne convient pas au statut actuel.

**Captures**
10-rh-08-agents.png

---

### 3.15 Stages

**À quoi sert ce module**
Le suivi complet d'un stage :
- le plan de rotation entre les unités ;
- l'acceptation de chaque période par l'unité, qui désigne un tuteur de stage ;
- les évaluations ;
- le rapport de stage, validé par l'encadreur principal ;
- l'attestation finale, qui est un acte signé du Courrier.

**Accès**
Menu « Personnel » → « Stagiaires ». Cette entrée est visible pour le DRH, le DN, la DNA et les chefs de division, de section et de cellule. Pour le stagiaire, l'entrée s'appelle « Mon stage » et ouvre directement sa fiche. Un tuteur de stage y arrive par ses notifications.
Les réglages se trouvent ailleurs :
- pour l'administrateur système : menu « Administration » → « Stages (réglages) » ;
- pour le DRH : bouton « Planning, capacités, modèle » de la page « Stagiaires ».

**Écran et onglets**
- **Liste** : onglets « En cours », « À venir », « Terminés ». S'il n'y a rien : « Aucun stage dans cette rubrique. » Pour le DRH, les boutons « Planning, capacités, modèle » et « + Nouveau stage ».
- **Fiche d'un stage** :
  - **En-tête** : nom du stagiaire, établissement, diplôme, dates, « Rattachement actuel : … », statut. Si le stage a été interrompu : « Stage interrompu : {motif} ».
  - **« Plan de rotation »** : les périodes numérotées, chacune avec :
    - l'unité, les dates et le format d'évaluation ;
    - « Tuteur : … · Responsable : … » ;
    - « Objectifs : … » ;
    - « Refusée : {motif} » le cas échéant ;
    - le bloc « Évaluation — {format} ».

    S'il n'y a aucune période : « Aucune période pour l'instant. »
  - **« Rapport de stage »** : « Encadreur principal : … » ou « non désigné », puis le statut du rapport, ou « Aucun rapport déposé. »
  - **« Attestation de fin de stage »**.
- **Page des réglages** : titre « Planning, capacités et modèle d'attestation » pour le DRH et la Direction, ou « Réglages des stages » pour l'administrateur système. Sections :
  - **« Modèle d'attestation »**
    - « Modèle actif : … (Word|PDF à champs) », « modèle par défaut de la DNPEC, fourni avec l'application », lien « Télécharger » ;
    - champ « Nouveau modèle (.docx, ou .pdf à champs) » et bouton « Importer » ;
    - rubrique « Champs disponibles (N) ». Dans Word, chaque champ s'écrit entre doubles accolades, par exemple {{NOM_COMPLET}}. Dans un PDF, le champ de formulaire porte exactement le nom de la clé.
  - **« Capacités d'accueil »**
    - Texte : « Nombre maximal de stagiaires simultanés ; au-delà, une période est refusée. Une période en section compte aussi pour sa division. »
    - L'unité et le champ « Maximum » (de 0 à 100), le bouton « Fixer la capacité » et le lien « Retirer la limite ».
  - **Le planning** (DRH, DN, DNA).

**Actions et formulaires**
- **« + Nouveau stage »** (DRH) ouvre « Nouveau stage ». Texte : « Le compte du stagiaire est créé auparavant (administrateur, ou import Excel avec le rôle Stagiaire). »
  - « Stagiaire » (obligatoire). Si aucun compte ne convient : « Aucun compte stagiaire disponible ».
  - « Établissement d'origine » (obligatoire, de 2 à 200 caractères).
  - « Diplôme préparé (facultatif) » (200 caractères au maximum).
  - « Encadrant académique (facultatif) » (200 caractères au maximum).
  - « Début » (obligatoire).
  - « Fin » (obligatoire).

  Bouton : « Créer le stage ».
- **« Modifier le stage »** (DRH) : mêmes champs. Bouton : « Enregistrer ».
- **« + Ajouter une période »** et **« Modifier »** (DRH) ouvrent « Ajouter une période » ou « Modifier la période ». Texte : « La capacité d'accueil de l'unité est vérifiée ; l'unité accepte ensuite la période et désigne le tuteur. »
  - « Unité d'accueil » (obligatoire) : une division (avec une section facultative, « Toute la division » sinon), ou une cellule.
  - « Du » et « Au » (obligatoires, dans les dates du stage).
  - « Évaluation de fin de période » : « Grille (4 critères) + appréciation », « Texte libre » ou « Pas d'évaluation ».
  - « Objectifs (facultatif) » (2 000 caractères au maximum).
  - Pour une période déjà commencée : « Période en cours : seule la date de fin se modifie, avec un motif. » Le champ « Motif » est alors obligatoire (au moins 5 caractères).
- **« Retirer du plan »** (DRH, période pas encore commencée) : l'application demande « Retirer cette période du plan ? ».
- **« Accepter et désigner le tuteur »** (responsable de l'unité d'accueil) ouvre « Accepter la période » : « Tuteur » (obligatoire). Bouton : « Accepter ».
- **« Refuser »** (responsable de l'unité d'accueil) ouvre « Refuser la période » : « Le DRH est prévenu et corrige le plan. » Champ « Motif » (obligatoire, de 5 à 1 000 caractères).
- **« Changer de tuteur »** (responsable de l'unité d'accueil) : « Tuteur ». Bouton : « Changer ».
- **Évaluation** (tuteur de stage) :
  - « Format » : modifiable par le tuteur ou le DRH tant que l'évaluation n'est pas commencée.
  - Pour une grille, les critères « Assiduité », « Qualité du travail », « Autonomie », « Intégration », chacun noté « Insuffisant », « Satisfaisant » ou « Très satisfaisant ». Les 4 critères sont obligatoires.
  - « Appréciation » (obligatoire pour soumettre).
  - Boutons « Enregistrer le brouillon » et « Soumettre au visa ».
- **Visa** (responsable de l'unité, jamais le rédacteur) :
  - « Viser » : message « Évaluation visée : le stagiaire peut la lire. » ;
  - « Renvoyer au tuteur » : fenêtre « Renvoyer l'évaluation au tuteur », avec un « Motif » obligatoire.
- **« Désigner l'encadreur »** ou **« Changer d'encadreur »** (DRH) ouvre « Encadreur principal » : « Il suit le stagiaire sur toute la durée du stage et valide son rapport. » Champ « Encadreur (parmi les tuteurs du plan) » (obligatoire). Bouton : « Désigner ».
- **« Déposer mon rapport »**, puis **« Déposer une nouvelle version »** (stagiaire) : choisissez le fichier. Message : « Rapport déposé : votre encadreur est prévenu. »
- **« Télécharger le rapport »** : stagiaire, encadreur principal, DRH.
- **« Valider le rapport »** (encadreur principal) : message « Rapport validé. »
- **« Demander une reprise »** (encadreur principal) ouvre « Demander une reprise du rapport » : « Le stagiaire est prévenu et dépose une nouvelle version. » Champ « Motif » (obligatoire, de 5 à 1 000 caractères).
- **« Clôturer »** (DRH) : l'application demande « Clôturer ce stage ? ».
- **« Interrompre »** (DRH) ouvre « Interrompre le stage » : « La période en cours se termine aujourd'hui ; les périodes à venir sont retirées du plan. » Champ « Motif » (obligatoire).
- **Attestation** (DRH) :
  - « Version provisoire (PDF) » : disponible tant que l'attestation finale n'est pas signée.
  - « Document rempli ».
  - « Préparer l'attestation finale » ouvre une fenêtre de même nom : « Un acte est créé dans le module Courrier avec le document rempli ; il suit le circuit habituel (visa, signature par le DN ou la DNA, numéro). Le stagiaire en est bénéficiaire et en prend connaissance depuis son stage. » Champ « Registre d'attestations » (obligatoire). Bouton : « Créer l'acte ».
  - L'acte suit ensuite le circuit du Courrier. Si le Courrier crée cet acte en brouillon comme ceux de la carrière, il faut le soumettre au visa (à confirmer pour l'attestation).
- **« J'ai pris connaissance de mon attestation »** (stagiaire, une fois l'attestation signée).
- **« Télécharger l'attestation signée »** : stagiaire, DRH, DN, DNA.

**Statuts et étapes**

| Statut du stage | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Prévu » | Le stage n'a pas commencé. | Automatique au début de la première période |
| « En cours » | Le stagiaire est en stage. | Le DRH (« Clôturer » quand toutes les périodes sont terminées, ou « Interrompre ») |
| « Terminé » | Le stage est clôturé. | Le DRH prépare l'attestation finale. |
| « Interrompu » | Le stage est arrêté, avec un motif. | Le DRH peut préparer l'attestation finale. |

| Statut d'une période | Signification | Qui la fait passer à l'étape suivante |
|---|---|---|
| « À accepter par l'unité » | Le DRH l'a proposée. | Le responsable de l'unité (« Accepter et désigner le tuteur » ou « Refuser ») |
| « Acceptée » | Le tuteur est désigné. | Automatique à la date de début |
| « Refusée » | Refusée avec un motif ; le DRH est prévenu. | Le DRH corrige le plan. |
| « En cours » | Le stagiaire est dans l'unité. | Automatique à la date de fin |
| « Terminée » | La période est finie ; l'évaluation est attendue. | Le tuteur rédige l'évaluation. |
| « Retirée du plan » | La période est annulée. | — |

| Statut de l'évaluation | Signification | Qui la fait passer à l'étape suivante |
|---|---|---|
| « Brouillon » | Le tuteur rédige. | Le tuteur (« Soumettre au visa ») |
| « À viser » | L'évaluation est soumise. | Le responsable de l'unité (« Viser » ou « Renvoyer au tuteur ») |
| « Renvoyée au tuteur » | L'évaluation est à corriger. | Le tuteur |
| « Visée » | L'évaluation est définitive ; le stagiaire, le DN et la DNA peuvent la lire. | — |

| Statut du rapport | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| (aucun) | Aucun rapport déposé. | Le stagiaire, une fois l'encadreur désigné |
| « Déposé, en attente de validation » | Le rapport est en attente. | L'encadreur principal (« Valider le rapport » ou « Demander une reprise ») |
| « À reprendre » | Le motif est affiché au stagiaire. | Le stagiaire (« Déposer une nouvelle version ») |
| « Validé » | Le rapport est accepté ; le DRH est prévenu. | — |

**Le responsable de l'unité d'accueil** est le premier occupé de cette liste :
- le chef de la section, sinon le chef de la division ;
- ou le chef de la cellule ;
- le DN ou la DNA si le poste est vacant ;
- ou son suppléant en intérim.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Créer et modifier un stage, gérer le plan, clôturer, interrompre | DRH | « Réservé au DRH. » |
| Accepter ou refuser une période, changer le tuteur | Le responsable de l'unité d'accueil (ou son suppléant en intérim) | « Seul le responsable de l'unité d'accueil (ou son suppléant en intérim) peut décider de cette période. » |
| Rédiger l'évaluation | Le tuteur de stage de la période | « Seul le tuteur de la période rédige son évaluation. » |
| Choisir le format de l'évaluation | Le tuteur, le DRH | « Seuls le tuteur et le DRH choisissent le format de l'évaluation. » |
| Viser l'évaluation | Le responsable de l'unité, jamais le rédacteur | « Seul le responsable de l'unité d'accueil vise l'évaluation (jamais son rédacteur). » |
| Désigner l'encadreur principal | DRH | « Seul le DRH désigne l'encadreur principal. » |
| Déposer le rapport | Le stagiaire | « Seul le stagiaire dépose son rapport. » |
| Valider le rapport ou en demander la reprise | L'encadreur principal | « Seul l'encadreur principal valide le rapport. » / « Seul l'encadreur principal renvoie le rapport. » |
| Lire le rapport | Le stagiaire, l'encadreur principal, le DRH | « Rapport réservé au stagiaire, à son encadreur principal et au DRH. » |
| Préparer l'attestation finale | DRH | Bouton absent |
| Télécharger l'attestation signée | Le stagiaire, le DRH, le DN, la DNA | « Réservé au stagiaire, au DRH et à la Direction. » |
| Prendre connaissance de l'attestation | Le stagiaire | « Seul le stagiaire prend connaissance de son attestation. » |
| Régler capacités et modèle d'attestation | DRH et administrateur système (qui ne voit jamais le contenu des stages) | « Réservé au DRH et à l'administrateur système. » |
| Lire capacités et planning | DRH, DN, DNA | « Réservé au DRH, à la Direction et à l'administrateur système. » |

Voir un stage :
- le DRH, le DN et la DNA voient tous les stages ;
- le stagiaire voit le sien ;
- un chef ou un tuteur voit les stages qui concernent son unité.

Sinon, l'application affiche « Stage introuvable ».

**Règles automatiques**
Chaque jour à 0 h 05 (heure de Conakry) :
1. Les périodes en cours arrivées à leur fin passent à « Terminée ». Le tuteur reçoit « Évaluation de stage à rédiger », puis, 3 jours plus tard, « Rappel : évaluation de stage à rédiger ».
2. Les périodes acceptées dont la date de début arrive : le stagiaire change d'unité (l'historique est mis à jour). Le stagiaire et le tuteur reçoivent « Début de période de stage ». Si l'unité est suspendue ou le compte inactif, le DRH est alerté et le stagiaire reste dans son unité.
3. Les périodes proposées mais non acceptées à leur date de début : le DRH reçoit « Alerte — rotation des stagiaires ».
4. Les périodes acceptées qui commencent dans 3 jours : le stagiaire, le tuteur et le responsable reçoivent « Période de stage à venir ».

Autres notifications :

| Événement | Destinataires | Titre |
|---|---|---|
| Période proposée | Le responsable de l'unité | « Stagiaire proposé dans votre unité » (« … Acceptez la période et désignez le tuteur, ou refusez-la. ») |
| Période acceptée, ou tuteur changé | Le tuteur | « Vous êtes tuteur d'un stagiaire » |
| Période refusée | Le DRH (email immédiat) | « Période de stage refusée » |
| Plan de stage modifié | Le responsable et le tuteur de la période | « Plan de stage modifié » |
| Évaluation soumise | Les viseurs | « Évaluation de stage à viser » |
| Évaluation visée | Le stagiaire et le tuteur | « Évaluation de stage visée » |
| Évaluation renvoyée | Le tuteur | « Évaluation de stage renvoyée » |
| Encadreur désigné | L'encadreur | « Vous êtes encadreur principal d'un stage » |
| Rapport déposé | L'encadreur | « Rapport de stage à valider » (bouton « Valider le rapport ») |
| Rapport validé | Le stagiaire | « Rapport de stage validé » |
| Rapport validé | Le DRH | « Rapport de stage validé » (« … L'attestation peut être préparée. ») |
| Reprise demandée | Le stagiaire | « Rapport de stage à reprendre », avec le motif |
| Stage interrompu | Le stagiaire et les tuteurs concernés | « Stage interrompu » |

Les alertes de fin de stage destinées au DRH (15 jours avant, 3 jours avant, passage « Parti ») sont décrites en 3.14.

**Messages que vous pouvez voir**
- « Ce compte n'a pas le rôle Stagiaire. » / « Le compte du stagiaire n'est pas actif. » → Vérifiez le compte avec l'administrateur système.
- « Ce stagiaire a déjà un stage prévu ou en cours. » → Ouvrez le stage existant.
- « Des périodes du plan sortiraient des dates du stage : déplacez-les d'abord. » → Modifiez d'abord les périodes.
- « La période doit être comprise dans les dates du stage. » → Corrigez les dates de la période.
- « Cette période chevauche une autre période du plan. » → Décalez les dates.
- « Capacité d'accueil atteinte pour {unité} : N stagiaire(s) simultané(s) au maximum. » → Changez les dates ou l'unité, ou faites relever la capacité.
- « Une période se déroule dans une Division (section facultative) ou dans une Cellule. » / « Une Section ne peut être renseignée sans Division. » → Corrigez l'unité.
- « Une période commencée ne peut changer que de date de fin. » / « Un motif est obligatoire pour modifier une période commencée. » / « La nouvelle date de fin est déjà passée. » → Respectez ces règles.
- « Seule une période qui n'a pas commencé peut être retirée du plan. » → Pour un stage en cours, utilisez « Interrompre ».
- « Ce stage est clôturé ou interrompu. » → Le stage n'est plus modifiable.
- « Des périodes ne sont pas terminées : attendez leur fin ou interrompez le stage. » → Attendez la fin des périodes avant de clôturer.
- « Cette période a déjà été acceptée ou refusée. » → Rechargez la page.
- « Le tuteur doit être un membre actif de l'unité d'accueil (ou son responsable), jamais le stagiaire. » → Choisissez un membre de l'unité.
- « Le tuteur se désigne en acceptant la période. » → Utilisez « Accepter et désigner le tuteur ».
- « L'évaluation est déjà soumise : le tuteur ne peut plus changer. » → Le tuteur ne change plus à ce stade.
- « L'évaluation est commencée : son format ne change plus. » → Le format est figé.
- « Cette période n'a pas d'évaluation. » → Le format choisi est « Pas d'évaluation ».
- « L'évaluation se rédige à partir du début de la période. » → Attendez le début de la période.
- « La grille doit noter les 4 critères. » / « L'appréciation est obligatoire. » → Complétez l'évaluation.
- « L'évaluation est soumise ou visée : elle ne se modifie plus. » → Demandez un renvoi au responsable de l'unité.
- « Seule une évaluation soumise peut être visée. » / « … peut être renvoyée. » → Rechargez la page.
- « Le DRH n'a pas encore désigné d'encadreur principal. » / « Le DRH doit d'abord désigner votre encadreur principal. » → Le DRH doit désigner l'encadreur.
- « Le rapport se dépose pendant le stage ou à sa fin. » → Le stage n'a pas commencé, ou il a été interrompu.
- « Le rapport a déjà été déposé. » → Attendez la validation ou une demande de reprise.
- « Le fichier du rapport est obligatoire. » → Choisissez un fichier.
- « Aucun rapport en attente de validation. » → Rien à valider.
- « Un stagiaire ne peut pas être encadreur. » / « Encadreur introuvable ou inactif. » → Choisissez un autre encadreur.
- « Ce stage est interrompu. » / « Le rapport est déjà validé. » → L'encadreur ne peut plus être changé.
- « L'attestation finale se prépare une fois le stage clôturé ou interrompu. » → Clôturez d'abord le stage.
- « L'attestation finale de ce stage existe déjà (acte en cours dans le module Courrier). » → Suivez l'acte dans le Courrier.
- « Choisissez un registre d'actes actif de la Direction (signature par le DN ou la DNA). » → Choisissez un autre registre.
- « Le compte du stagiaire n'est plus actif : il ne peut pas être bénéficiaire de l'acte. » → Le DRH doit d'abord réactiver l'agent.
- « L'attestation finale est signée : la version provisoire n'est plus disponible. » → Téléchargez l'attestation signée.
- « L'attestation signée n'est pas encore disponible. » → L'acte n'est pas signé, ou son scan n'est pas encore joint.
- « Modèle attendu : document Word (.docx) ou PDF à champs de formulaire (.pdf). » / « Champs inconnus dans le modèle : … » → Corrigez le modèle.
- « Unité invalide. » → Choisissez l'unité dans la liste.

**Captures**
10-rh-10-stages.png, 10-rh-11-mon-stage.png, 02-interface-10-menu-stagiaire.png

---

### 3.16 Archives et documents

**À quoi sert ce module**

Ce module est la gestion électronique des documents de la DNPEC. Vous y déposez les documents produits par votre unité (division, ou cellule rattachée à la Direction). Vous les faites valider, puis les publiez pour toute la DNPEC.

Chaque document porte un statut de diffusion : « Brouillon », « Validé » ou « Diffusable ». Ce statut est imprimé sur tout fichier téléchargé.

**Accès**

- Menu de gauche, groupe « Général » → « Archives & documents ».
- L'entrée est visible pour tous les profils, sauf le stagiaire. Si un stagiaire tente d'y accéder, l'application refuse et affiche : « Cette fonctionnalité n’est pas accessible aux stagiaires. »
- Un lien reçu (notification, recherche, document déposé depuis un autre écran) ouvre directement la fiche du document concerné.

**Écran et onglets**

En-tête : « Général », titre « Archives & documents ». En haut à droite se trouve le bouton « + Nouveau document ». Il n'apparaît que dans l'onglet de l'espace de votre unité.

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Mon espace division » | membres d'une division, DN, DNA | documents privés de la division (non publiés) |
| « Mon espace cellule » | membres d'une cellule rattachée à la Direction | documents privés de la cellule |
| « Documents publiés (DNPEC) » | tous | documents publiés pour toute la DNPEC |

- **DN et DNA** : une liste « Espace documentaire » permet de choisir l'espace, en deux groupes : « Divisions » et « Cellules rattachées à la Direction ». Les autres utilisateurs voient seulement « Division : <nom> » ou « Cellule : <nom> ».
- **Dossiers (divisions seulement)** : dans l'espace d'une division, un fil de navigation s'affiche (« 🗂 Racine », puis les dossiers « 📁 <nom> »), avec le bouton « + Nouveau dossier ». Les cellules n'ont pas de dossiers.
- **Filtres** :
  - « Rechercher par titre… » ;
  - « Toutes catégories » : Étude, Rapport, Note technique, Autre ;
  - « Tous types » : Étude, Rapport, Note technique, Procès-verbal, Acte, RPEF, Note de conjoncture, Autre ;
  - « Tous statuts » : Brouillon, Validé, Diffusable ;
  - deux dates, « Déposé à partir du » et « Déposé jusqu’au ». Elles portent sur la date de dépôt, pas sur la date du document.
- **Cartes de documents** : chaque carte affiche le statut, puis « 🌐 Publié DNPEC » ou « 🔒 Privé — division », et « Final » si le document est achevé. Viennent ensuite le titre, la ligne « <Type> · v<numéro de version> · <date> », la description et « Par <auteur> ».
- Liste vide : « Aucun document ici pour l'instant. »

**Fiche d'un document** (clic sur une carte)

- **En-tête** : statut, visibilité, « Final », titre, puis « <unité> · par <auteur> ».
- **Métadonnées** :
  - « Type » ;
  - « Date » ;
  - « Période couverte » (« du … au … », ou « à compléter » en rouge) ;
  - « Classement » ;
  - « Issu de », pour un document déposé depuis une tâche ou une réunion. La ligne affiche « Tâche « … » » ou « Réunion « … » » ; si vous ne voyez pas l'élément d'origine, elle affiche « une tâche hors de votre périmètre » ou « une réunion hors de votre périmètre ».
- **« Statut de diffusion »** : boutons « Valider », « Rendre diffusable », « Retirer le statut « … » ».
- **Boutons de gestion** : « Marquer comme final », « Ajouter une version », « Modifier les métadonnées », « Publier (toute la DNPEC) ».
- **« Versions »** : la mention « Le fichier téléchargé porte la mention de son statut. », puis une ligne par version (« v<n> — <nom du fichier> », taille, date, auteur) avec le lien « Télécharger ».
- **« Historique du statut »** : chaque changement (« Brouillon → Validé »…), avec la date, l'auteur et le motif. Les changements automatiques sont signés « Système ».

Vous ne voyez que les boutons que vous avez le droit d'utiliser.

**Actions et formulaires**

*« + Nouveau document » → fenêtre « Nouveau document »*

| Champ | Obligatoire ? | Limites / remarques |
|---|---|---|
| « Titre » | obligatoire | 2 à 300 caractères |
| « Description (optionnel) » | facultatif | 2 000 caractères au plus |
| « Type » | obligatoire | « Choisir… » puis Étude, Rapport, Note technique, Procès-verbal, Acte, RPEF, Note de conjoncture, Autre |
| « Date du document » | obligatoire | aujourd'hui par défaut |
| « Période couverte : du » | obligatoire | |
| « au » | obligatoire | ne peut pas précéder le début |
| « Catégorie (classement) » | facultatif | « Autre » par défaut ; Étude, Rapport, Note technique, Autre |
| « Fichier » | obligatoire | 25 Mo au plus |

- Boutons : « Annuler » et « Envoyer » (« Envoi… » pendant l'envoi).
- « Envoyer » reste grisé tant que le titre, le type, les deux dates de période et le fichier ne sont pas renseignés.
- Le document est créé au statut « Brouillon », en version 1, visible des seuls membres de votre unité.
- Si un dossier est ouvert au moment du dépôt (espace de division), le document y est rangé.

*« + Nouveau dossier »* (espace de division) : champ « Nom du dossier » (1 à 200 caractères), puis « Créer » ou « Annuler ».

*Dépôt depuis une tâche ou une réunion* :
- Dans la fiche d'une tâche ou d'une réunion, la rubrique « Documents issus (n) » propose le bouton « Déposer un document ». Ce bouton n'apparaît que si vous êtes rattaché(e) à une division ou à une cellule.
- La même fenêtre « Nouveau document » s'ouvre, avec la mention « Issu de : tâche « … » » ou « Issu de : réunion « … » ».
- Préremplissage :
  - depuis une réunion : type « Procès-verbal », période = jour de la réunion ;
  - depuis une tâche : période = de la création de la tâche à son échéance (à défaut, jusqu'à aujourd'hui).
- Le document reste rangé dans l'espace de votre unité et garde le lien vers son origine.
- Sans document : « Aucun document déposé depuis cet écran. »

*« Marquer comme final »* : signale que le document est achevé. Cette étape est obligatoire avant la validation et avant la publication. Aucun bouton ne permet de l'annuler.

*« Ajouter une version »* : vous choisissez un nouveau fichier (25 Mo au plus). Le numéro de version augmente. Si le document était « Validé » ou « Diffusable », il redevient automatiquement « Brouillon » (voir Règles automatiques).

*« Modifier les métadonnées »* : un encadré propose « Type », « Du », « Au » → « Enregistrer les métadonnées ». Si la période couverte manque (documents anciens), l'encadré s'affiche d'office avec le message « Métadonnées à compléter avant toute validation. »

*« Valider »*, *« Rendre diffusable »* : action immédiate, sans fenêtre.

*« Retirer le statut « … » »* : une zone « Motif (obligatoire) : le document reste consultable en interne. » s'ouvre (5 caractères au moins), puis « Confirmer le retrait » (grisé tant que le motif est trop court) ou « Annuler ». Le document recule d'un statut.

*« Publier (toute la DNPEC) »* : le document passe dans l'onglet « Documents publiés (DNPEC) » et devient visible de toute la DNPEC.

*« Télécharger »* : vous recevez une copie qui porte la mention de son statut (voir Règles automatiques).

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Brouillon » | document de travail, « usage interne, non citable » | le chef de l'unité productrice (chef de division pour sa division, chef de cellule pour sa cellule), ou le DN ou la DNA en recours, par « Valider ». Le document doit d'abord être « Final » et avoir des métadonnées complètes |
| « Validé » | « usage interne à la DNPEC » | le DN ou la DNA, par « Rendre diffusable » |
| « Diffusable » | « autorisé hors de la Direction » | dernier statut. Retour possible à « Validé » par le DN ou la DNA, avec un motif |

En plus du statut :
- **« Final »** est une marque d'achèvement, posée par le créateur ou son supérieur direct.
- **La publication** (« 🔒 Privé — division » → « 🌐 Publié DNPEC ») est indépendante du statut de diffusion.

Le statut avance ou recule d'un seul cran à la fois.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Déposer un document, créer un dossier | membres de l'unité ; DN et DNA dans tout espace | « Cette division n'est pas dans votre périmètre. » / « Cette cellule n'est pas dans votre périmètre. » |
| Lire un document privé | membres de la division ou de la cellule productrice seulement (DN et DNA compris : besoin d'en connaître) | « Ce document est hors de votre périmètre. » |
| Voir les dossiers d'une division | membres de la division | « Cet espace documentaire privé est hors de votre périmètre. » |
| Lire un document publié | tous (sauf stagiaire) | — |
| Marquer comme final, ajouter une version, modifier les métadonnées | créateur du document, ou son supérieur hiérarchique direct | « Seuls le créateur ou son supérieur hiérarchique direct peuvent modifier ce document. » |
| Valider | chef de division (sa division), chef de cellule (sa cellule), DN, DNA | « La validation revient au chef de l’unité productrice (division ou cellule), au DN ou à la DNA. » |
| Rendre diffusable | DN, DNA | « Seuls le DN et la DNA rendent un document diffusable hors de la Direction. » |
| Retirer « Diffusable » | DN, DNA | « Vous ne pouvez pas retirer ce statut. » |
| Retirer « Validé » | chef de l'unité productrice, DN, DNA | « Vous ne pouvez pas retirer ce statut. » |
| Publier | chef de l'unité productrice, DN, DNA | « Seuls le DN, la DNA ou le chef de l’unité productrice (division ou cellule) peuvent publier ce document. » |

Un chef de division ne valide pas les documents d'une cellule, et un chef de cellule ne valide pas ceux d'une division.

**Règles automatiques**

- **Mention sur les fichiers téléchargés.** Le fichier enregistré n'est jamais modifié : seule la copie que vous recevez est marquée.
  - PDF : bandeau en haut de chaque page (rouge pour Brouillon, bleu pour Validé, vert pour Diffusable).
  - Word : paragraphe en gras, centré, en tête du document.
  - Autres formats : le statut est ajouté au nom du fichier, par exemple « rapport (BROUILLON).xlsx ».
  - Textes exacts des mentions :
    - « BROUILLON — usage interne, non citable »
    - « VALIDÉ — usage interne à la DNPEC »
    - « DIFFUSABLE — autorisé hors de la Direction »
- **Nouvelle version.** Un document « Validé » ou « Diffusable » redevient « Brouillon » dès qu'une nouvelle version est ajoutée. L'historique indique « Nouvelle version (v<n>) ». L'écran le signale : « Une nouvelle version ramène le document au statut « Brouillon ». »
- **Traçabilité.** Chaque changement de statut est inscrit dans l'« Historique du statut » et dans le journal d'audit.
- Ce module n'envoie aucune notification lors d'une validation ou d'une publication (à confirmer).

**Messages que vous pouvez voir**

- « Le type du document est obligatoire. » → choisissez un « Type ».
- « Le début de la période couverte est obligatoire. » / « La fin de la période couverte est obligatoire. » → renseignez les deux dates.
- « La fin de la période couverte précède son début. » → corrigez les dates.
- « Le fichier est obligatoire. » → joignez un fichier.
- « Indiquez l’unité productrice : une division ou une cellule. » → ouvrez l'onglet de votre espace avant de déposer.
- « Les dossiers sont propres aux divisions : un document de cellule n’a pas de dossier. » → déposez sans dossier.
- « Un document est issu d’une tâche ou d’une réunion, pas des deux. » → un seul lien d'origine est possible.
- « Seul un document marqué « Final » peut être validé. » → faites d'abord « Marquer comme final ».
- « Métadonnées à compléter avant validation : type, date et période couverte. » → « Modifier les métadonnées ».
- « Le document est déjà « … ». » → rien à faire.
- « Passage direct de « … » à « … » impossible : un statut à la fois. » → passez par l'étape intermédiaire.
- « Le retrait exige un motif (5 caractères au moins). » → allongez le motif.
- « Le statut vient de changer : rechargez le document. » → quelqu'un a agi en même temps ; rouvrez la fiche.
- « Seul un document marqué "Final" peut être publié. » → marquez d'abord le document comme final.
- « Ce document est hors de votre périmètre. » → document privé d'une autre unité.

**Captures**

- 06-documents-01-archives.png
- 06-documents-02-deposer.png
- 06-documents-03-detail-statut.png

---

### 3.17 Documents générés (attestation de travail, ordre de mission, rapport d'activité)

**À quoi sert ce module**

Ce module produit automatiquement, à partir des données déjà enregistrées et sans ressaisie, trois documents officiels : l'attestation de travail, l'ordre de mission et le rapport d'activité. Ils portent l'en-tête de la République et de la Direction et sont proposés en PDF ou en Word.

Les documents opposables (attestation, ordre de mission) deviennent des actes du module Courrier : ils sont visés, signés par le DN ou la DNA et numérotés.

**Accès**

- Menu de gauche, groupe « Personnel » → « Documents générés ».
- Visible pour tous les profils sauf le stagiaire.
- Texte en tête de page : « Produits à partir des données enregistrées, sans ressaisie, avec l’en-tête de la République et de la Direction. Un document signé imprimé une seconde fois porte la mention « DUPLICATA ». »

**Écran et onglets**

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Attestations de travail » | le DRH ; tout agent qui a au moins une attestation | création (DRH) et liste des attestations |
| « Ordres de mission » | toute personne qui a des agents sous son autorité directe (chef de section, chef de division, chef de cellule, DN, DNA) ; tout agent qui a au moins un ordre de mission | création et liste |
| « Rapport d’activité » | tous | production du rapport d'une période |

Pour le DRH, l'onglet « Attestations de travail » s'ouvre d'office ; pour les autres, c'est « Rapport d’activité ».

**Actions et formulaires**

*Boutons communs à chaque document*

| Bouton | Effet |
|---|---|
| « Aperçu » | ouvre le document PDF exactement tel qu'il sera imprimé (fenêtre « Aperçu — <type> »). N'enregistre rien et ne compte pas d'impression |
| « PDF » / « Word » | télécharge le document. PDF et Word ont la même présentation |
| « Déposer en GED » | visible si vous êtes rattaché(e) à une division ou à une cellule. Dépose le document dans Archives & documents, au statut « Brouillon » (type « Rapport » pour un rapport d'activité, « Acte » sinon). Message : « Document déposé dans la GED de votre division (statut Brouillon). », puis lien « Ouvrir le document déposé » |
| « Transmettre » | fenêtre avec « Destinataire » (obligatoire, toute personne au compte actif) et « Message (facultatif) » (1 000 caractères), puis « Envoyer ». Le PDF est joint à un message de la messagerie. Message : « Document transmis par la messagerie (PDF joint). » |
| « Préparer l’acte » | attestation et ordre de mission seulement : crée l'acte à signer dans le module Courrier |

*Présentation des documents* :
- En-tête :
  - « RÉPUBLIQUE DE GUINÉE » ;
  - « Travail — Justice — Solidarité » ;
  - « Ministère de l’Économie, des Finances et du Budget » ;
  - « Direction Nationale des Prévisions Économiques et de la Conjoncture (DNPEC) ».
- Titre en majuscules, puis le numéro (« N° — » tant que le document n'est pas signé).
- « Conakry, le <date> » et la signature « Le Directeur National », avec le nom du signataire une fois l'acte signé.
- Tant que l'acte n'est pas signé, le document porte la mention « PROJET — non signé ».

*Attestation de travail (DRH)*
- Onglet « Attestations de travail » → « Agent » (obligatoire, « Choisir… ») → « Nouvelle attestation de travail ».
- Message : « Attestation créée : aperçu, puis préparation de l’acte à signer. »
- Le texte est rédigé automatiquement : « Le Directeur National des Prévisions Économiques et de la Conjoncture atteste que … ». Il reprend :
  - la civilité, le nom et le matricule ;
  - le grade ;
  - la date d'entrée en service ;
  - la fonction et l'unité.
  Il se termine par « En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit. »
- Chaque carte affiche le nom de l'agent, son état et « Créée le … ».
- Liste vide : « Aucune attestation de travail. »

*Ordre de mission*
- Onglet « Ordres de mission » → « + Nouvel ordre de mission ».

| Champ | Obligatoire ? | Limites |
|---|---|---|
| « Agent » | obligatoire | seulement les agents sur lesquels vous avez une autorité directe |
| « Destination » | obligatoire | 2 à 200 caractères |
| « Objet de la mission » | obligatoire | 5 à 500 caractères |
| « Départ » | obligatoire | date |
| « Retour » | obligatoire | ne peut pas précéder le départ |
| « Moyen de transport (facultatif) » | facultatif | 200 caractères |
| « Frais de mission en francs guinéens (facultatif) » | facultatif | nombre entier, 0 ou plus |

- Boutons : « Enregistrer l’ordre de mission » ou « Annuler ». Message : « Ordre de mission enregistré. »
- **Carte** : « <agent> — <destination> », l'état, l'objet, puis « Du … au … · frais : <montant en lettres> ». Si le gestionnaire logistique a affecté un véhicule : « Véhicule de service : <immatriculation> (<marque> <modèle>) », avec les kilomètres parcourus après le retour. Le véhicule s'affiche à l'écran mais n'est jamais ajouté au document signé.
- **Contenu du document** : « Nom et prénoms », « Matricule », « Fonction », « Unité », « Destination », « Objet de la mission », « Date de départ », « Date de retour », « Moyen de transport », « Frais de mission ». Il se termine par « Les autorités civiles et militaires sont priées de faciliter l’accomplissement de la présente mission. »
- **Montant en lettres** : les frais sont écrits en toutes lettres et en chiffres, par exemple « cinq cent mille (500 000) francs guinéens ».
- Liste vide : « Aucun ordre de mission. »

*Rapport d'activité*
- Texte affiché : « Construit depuis les tâches de la période et du périmètre (celles que vous voyez), jamais ressaisi. »
- **« Périmètre »** (obligatoire) :
  - « Mon activité » : tout le monde ;
  - « Toute la Direction » : DN, DNA ;
  - une division : son chef de division, DN, DNA ;
  - une section, sous la forme « <section> (<division>) » : son chef de section, le chef de division, DN, DNA ;
  - une cellule : son chef de cellule, DN, DNA.
- **« Du »** (obligatoire, premier jour du mois par défaut) et **« Au »** (obligatoire, aujourd'hui par défaut).
- **Contenu du rapport** :
  - « Périmètre », « Période », « Établi par » ;
  - « Synthèse » : tâches suivies, terminées, en cours, dont en retard ;
  - « Tâches terminées (n) » et « Tâches en cours (n) » : tâche, assignés, échéance, statut, avancement ;
  - « Activités du plan de travail (n) ».
- Le rapport ne devient jamais un acte : il porte toujours la mention « BROUILLON — usage interne, non citable ».

*« Préparer l’acte »* (attestation, ordre de mission)
- La fenêtre explique : « <Type> : un acte est créé avec le document en projet ; il suit le circuit habituel et reçoit son numéro à la signature. »
- Champ « Registre d’actes de la Direction » (obligatoire), puis « Créer l’acte » ou « Annuler ».
- Message : « Acte créé dans le module Courrier : visa, puis signature du DN ou de la DNA. »
- Registres proposés par défaut : ATT — Attestations, DEC — Décisions, NS — Notes de service, OM — Ordres de mission. ATT est présélectionné : pour un ordre de mission, choisissez « OM — Ordres de mission ».
- L'acte est créé dans le Courrier avec :
  - l'objet « Attestation de travail — <NOM> » ou « Ordre de mission — <NOM> — <destination> » ;
  - le document en projet comme pièce jointe ;
  - l'agent comme « Agent concerné », qui devra confirmer sa prise de connaissance.

**Statuts et étapes**

| État affiché | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Projet — acte non préparé » | document créé, pas encore envoyé à la signature | le DRH (attestation), ou l'auteur de l'ordre de mission, le DN ou la DNA, par « Préparer l’acte » |
| « Acte en cours (visa, signature) » | l'acte suit le circuit du module Courrier | les viseurs, puis le DN ou la DNA qui signe (module Courrier) |
| « Signé — n° <numéro> » | document officiel, numéroté | — (l'agent prend connaissance dans le Courrier) |
| « Acte annulé » | l'acte a été annulé dans le Courrier | « Préparer l’acte » redevient possible |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Créer une attestation de travail | DRH | « Réservé au DRH. » |
| Voir et imprimer une attestation | DRH ; l'agent concerné, une fois l'acte signé | « Attestation réservée à l’agent et au DRH. » / « Votre attestation est disponible une fois signée. » |
| Créer un ordre de mission | chef direct de l'agent, DN, DNA | « L’ordre de mission est établi par le chef direct de l’agent, le DN ou la DNA. » |
| Voir un ordre de mission | l'agent concerné, l'auteur, le DRH, les supérieurs directs de l'agent | « Ordre de mission hors de votre périmètre. » |
| Préparer l'acte d'une attestation | DRH | « Réservé au DRH. » |
| Préparer l'acte d'un ordre de mission | auteur de l'ordre, DN, DNA | « L’acte est préparé par l’auteur de l’ordre de mission, le DN ou la DNA. » |
| Produire un rapport d'activité | tous, selon le périmètre ouvert | « Ce périmètre de rapport ne vous est pas ouvert. » |
| Déposer en GED | personne rattachée à une division ou à une cellule | « Vous n’avez pas d’espace documentaire de division ou de cellule : dépôt impossible. » |

**Règles automatiques**

- **Impressions comptées (« DUPLICATA »).** Pour un document signé, chaque impression est enregistrée : téléchargement PDF ou Word, « Transmettre », « Déposer en GED ». La première est l'original ; à partir de la deuxième, le document porte « DUPLICATA » et le nom du fichier se termine par « -duplicata ». « Aperçu » n'est jamais compté.
- **À la signature**, le document reprend automatiquement le numéro de l'acte et le nom du signataire.
- **Notifications** : elles sont envoyées par le module Courrier (« Acte à viser », « Acte à signer », « Acte signé », « Acte à prendre en connaissance » pour l'agent concerné).
- Le rapport d'activité ne reprend que les tâches que vous avez le droit de voir.

**Messages que vous pouvez voir**

- « Agent introuvable ou inactif. » → l'agent n'a plus de compte actif.
- « Un stagiaire reçoit une attestation de stage, pas une attestation de travail. » → utilisez le module Stagiaires.
- « La date de retour précède la date de départ. » → corrigez les dates.
- « Disponible une fois l’acte signé par la Direction. » → attendez la signature.
- « L’acte existe déjà (en cours dans le module Courrier). » → suivez l'acte dans le Courrier.
- « Choisissez un registre d’actes actif de la Direction (signature par le DN ou la DNA). » → choisissez un autre registre, ou demandez à l'administrateur système d'en activer un.
- « Aucun registre d’actes actif » (dans la liste) → aucun registre disponible : contactez l'administrateur système.
- « Période du rapport obligatoire (début et fin). » / « La fin de la période précède son début. » → corrigez la période.
- « Ce périmètre de rapport ne vous est pas ouvert. » → choisissez un périmètre de la liste.

**Captures**

- 06-documents-04-documents-generes.png
- 06-documents-05-ordre-de-mission.png
- 06-documents-06-attestation-de-travail.png
- 06-documents-07-rapport-activite.png

---

### 3.18 Courrier et actes

**À quoi sert ce module**

Le module tient les registres officiels du courrier :
- le courrier arrivé : enregistrement, imputation, traitement, classement ;
- les départs et actes : rédaction, visa, signature avec numérotation, expédition, prise de connaissance.

Il applique strictement le « besoin d'en connaître » : un courrier confidentiel ou un pli personnel n'est montré qu'aux personnes autorisées.

**Accès**

- Menu de gauche, groupe « Général » → « Courrier ». Visible pour tous les profils sauf le stagiaire.
- Titre de la page : « Courrier et actes », avec le texte « Registres du courrier arrivée, des départs et des actes : enregistrement, imputation, visa, signature et expédition. »
- **Administrateur système** :
  - la page s'intitule « Mon courrier » : « Votre courrier personnel : plis qui vous sont adressés, lettres et actes que vous rédigez ou qui vous concernent. » ;
  - le paramétrage se trouve dans le groupe « Administration » → « Courrier ».
- Les liens des notifications et des e-mails ouvrent directement le courrier ou l'acte concerné.
- Sur le tableau de bord, les compteurs du courrier renvoient vers la rubrique correspondante de « À faire ».

**Écran et onglets**

Au-dessus des onglets s'affichent des **compteurs** (seulement s'ils ne sont pas à zéro) :
- « n à imputer » ;
- « n à traiter » ;
- « n en retard » ;
- « n à viser » ;
- « n à signer » ;
- « n à expédier » ;
- « n à prendre en connaissance » ;
- « n brouillon(s) à reprendre ».

Un clic sur un compteur affiche la rubrique correspondante.

| Onglet | Contenu |
|---|---|
| « À faire » | ce qui vous attend, par rubriques : « À imputer », « À traiter », « En retard », « À viser », « À signer », « À expédier », « À prendre en connaissance », « Brouillons à reprendre ». Si rien ne vous attend : « Rien ne vous attend dans le courrier. » |
| « Arrivées » (« Mes plis personnels » pour l'administrateur système) | registre du courrier arrivé ; boutons « Exporter (Excel) » et « + Enregistrer un courrier » (secrétariat courrier seulement) |
| « Départs et actes » (« Mes actes » pour l'administrateur système) | registre des départs et des actes ; boutons « Exporter (Excel) » et « + Rédiger » |

**Filtres** des onglets « Arrivées » et « Départs et actes » :
- **année** : « Vue courante » (l'année en cours et tout ce qui est encore en cours, quelle que soit son année) ou une des six dernières années ;
- **registre** : « Tous les registres » ou un registre (un registre désactivé porte la mention « (désactivé) ») ;
- **statut** : « Tous les statuts » ou un statut ;
- **recherche** : « Numéro, objet, expéditeur… (Entrée) ».

**Ligne de courrier arrivé** : numéro, statut, confidentialité (si ce n'est pas « Ordinaire »), « Reçu le … », objet, expéditeur et registre. Pour un pli personnel dont vous n'êtes pas le destinataire : « Pli personnel pour <nom> — contenu protégé ».

**Ligne d'acte** : numéro (« Non numéroté » avant signature), statut, « CONFIDENTIEL » s'il y a lieu, « Signé le … » ou « Modifié le … », objet, registre, « Rédigé par … », « À : <destinataires> ».

**Registres livrés avec l'application.** Ils sont tous numérotés au niveau de la Direction, sous la forme « 0001/MEFB/DNPEC/<code>/<année> » :

| Code | Registre |
|---|---|
| ARR | Courrier arrivée |
| DEP | Courrier départ |
| NS | Notes de service |
| DEC | Décisions |
| OM | Ordres de mission |
| ATT | Attestations |

L'administrateur système peut en créer d'autres, y compris des registres propres à une division ou une cellule (portée « Unité »).

**Actions et formulaires — courrier arrivé**

*« + Enregistrer un courrier » → fenêtre « Enregistrer un courrier arrivée »* (sous-titre : « Le numéro est attribué par le système à l’enregistrement, dans l’ordre d’arrivée. »)

| Champ | Obligatoire ? | Limites / remarques |
|---|---|---|
| « Registre » | obligatoire | seuls les registres pour lesquels vous êtes habilité(e) |
| « Unité » | obligatoire pour un registre d'unité | unités de votre habilitation |
| « Date de réception » | obligatoire | aujourd'hui par défaut |
| « Confidentialité » | obligatoire | « Ordinaire », « Confidentiel », « Pli personnel (fermé) » |
| « Expéditeur » | obligatoire | 2 à 300 caractères |
| « Référence de l’expéditeur (facultatif) » | facultatif | 120 caractères |
| « Date du courrier (facultatif) » | facultatif | |
| « Objet » | obligatoire (sauf pli personnel) | 2 à 500 caractères |
| « Scans (facultatif) » | facultatif | 10 fichiers au plus, 25 Mo chacun |
| « Destinataire » | obligatoire pour un pli personnel | annuaire |

- **Pli personnel** : la fenêtre indique « Pli personnel : il est enregistré fermé — ni objet ni scan. Seul son destinataire en prend connaissance et le complète. »
- **Contrôle des dates** : si la date de réception est dans le futur, ou si le courrier est daté après sa réception, un encadré s'affiche : « Date inhabituelle : … Vérifiez la saisie, ou confirmez-la en indiquant le motif (il sera conservé et tracé). » Pour enregistrer quand même, cochez « Je confirme cette date » et remplissez « Motif de la dérogation (obligatoire) » (1 000 caractères). Une réception plus ancienne qu'aujourd'hui (enregistrement tardif) est normale.
- Bouton « Enregistrer ». Le numéro est attribué automatiquement, sans trou ni doublon. La fiche du courrier s'ouvre ensuite.

*Fiche d'un courrier arrivé* :
- **Informations** : numéro, statut, confidentialité, puis « Objet », « Expéditeur », « Reçu le », « Référence », « Daté du », « Date confirmée par dérogation : … ».
- **Rubriques** : « Scans », « Imputations » (« Pas encore imputé. » s'il n'y en a pas), « Accès délégués » (courrier confidentiel).
- **Boutons possibles** :
  - « Imputer » ;
  - « Rédiger une réponse » ;
  - « Compléter le pli » ;
  - « Requalifier » ;
  - « Ajouter un scan » ;
  - « Corriger » ;
  - « Classer » ;
  - « Annuler l’enregistrement ».

*« Imputer » → fenêtre « Imputer le courrier »*

| Champ | Obligatoire ? | Limites |
|---|---|---|
| « Imputer à » | obligatoire | la liste ne propose que les personnes acceptables (pour un registre d'unité : les membres de l'unité ; jamais l'administrateur système ni un stagiaire) |
| « Nature » | obligatoire | « Pour attribution », « Pour information », « Pour avis » |
| « Échéance (facultatif) » | facultatif | date future |
| « Instructions (facultatif) » | facultatif | 2 000 caractères |

Puis « Imputer ». Si personne n'est proposé, la liste affiche « Personne à qui imputer ».

*Sur une imputation qui vous concerne (rubrique « Imputations »)* :
- **« Marquer traité »** → fenêtre « Marquer comme traité » : « Compte rendu (facultatif) » (4 000 caractères). Pour une imputation « Pour avis », le champ devient « Votre avis (obligatoire) ». Puis « Marquer traité ».
- **« Sous-imputer »** → fenêtre « Sous-imputer » (« Au sein de votre périmètre, au plus tard pour le … (votre échéance). »). Mêmes champs que l'imputation. L'échéance devient obligatoire si votre propre imputation en a une, et ne peut pas la dépasser.
- **« Convertir en tâche »** (auteur de l'imputation seulement) → fenêtre « Convertir en tâche » : « Titre de la tâche » (prérempli « Courrier <n°> — <objet> », 300 caractères) et « Échéance de la tâche » (obligatoire). Puis « Créer la tâche ». Pour un courrier confidentiel : « Courrier confidentiel : la tâche portera un titre neutre, sans instructions, au niveau « Très confidentiel ». » Ensuite, le lien « Tâche associée → » s'affiche dans l'imputation.

*« Rédiger une réponse »* : ouvre la fenêtre « Rédiger une réponse » avec « En réponse au courrier <n°>. » (mêmes champs que « + Rédiger », voir plus bas). L'acte de réponse est ensuite accessible par « Voir la réponse » ou « Voir le courrier arrivée ».

*« Corriger »* → fenêtre « Corriger l’enregistrement » (« La correction est tracée (avant/après). Le numéro ne change jamais. ») :
- champs : « Date de réception », « Date du courrier », « Expéditeur », « Référence de l’expéditeur », « Objet » ;
- même contrôle des dates qu'à l'enregistrement ;
- puis « Enregistrer la correction ».

*« Ajouter un scan »* → « Fichiers (10 au plus, 25 Mo chacun) » → « Ajouter ».

*« Classer »* : confirmation « Classer le courrier <n°> ? Il sortira des courriers en cours. »

*« Annuler l’enregistrement »* : « Motif (obligatoire) » (5 à 1 000 caractères). La fenêtre précise : « Le numéro … reste consommé (jamais réattribué) ; le courrier apparaît « annulé » dans le registre. » Un courrier enregistré ne se supprime jamais.

*Pli personnel (destinataire seulement)* :
- **« Compléter le pli »** : « Objet » (obligatoire, 2 à 500 caractères), « L’objet reste visible de vous seul tant que le pli est personnel. » Puis « Enregistrer ».
- **« Requalifier »** → fenêtre « Requalifier le pli » : « Le pli entre dans le circuit normal du courrier pour être imputé. C’est définitif : il ne pourra plus redevenir personnel. » Choisissez « Nouvelle confidentialité » (« Confidentiel » ou « Ordinaire »), cochez « Je comprends que le pli ne sera plus personnel et que ce choix est définitif. », puis « Requalifier définitivement ».
- Bandeau sur la fiche : « Pli personnel qui vous est adressé : vous seul(e) le voyez. Pour le faire imputer, requalifiez-le. »

*Accès délégués (courrier confidentiel)* :
- Texte de la rubrique : « Ce courrier est confidentiel : ni votre assistant(e) ni votre suppléant(e) ne le voient sans un accès que vous ouvrez ici. »
- « Ouvrir un accès » → « Bénéficiaire » → « Ouvrir l’accès ». Explication affichée : « Seuls votre assistant(e) et votre suppléant(e) en cours peuvent recevoir un accès. Il cesse de lui-même à la fin de la suppléance. »
- « Révoquer » retire un accès, après confirmation.

**Actions et formulaires — départs et actes**

*« + Rédiger » → fenêtre « Rédiger un départ ou un acte »* (« Le numéro est attribué à la signature. Après rédaction, soumettez l’acte au circuit de visa. »)

| Champ | Obligatoire ? | Limites |
|---|---|---|
| « Registre » | obligatoire | registres de départ ou d'actes actifs ; « DEP » par défaut |
| « Confidentialité » | obligatoire | « Ordinaire » ou « Confidentiel » |
| « Objet » | obligatoire | 2 à 500 caractères |
| « Destinataires (facultatif) » | facultatif | 1 000 caractères |
| « Texte (facultatif) » | facultatif | 20 000 caractères |
| « Agent concerné (facultatif — attestation, ordre de mission…) » | facultatif | annuaire |
| case « L’agent concerné doit confirmer sa prise de connaissance une fois l’acte signé. » | facultatif | si elle est cochée, l'agent concerné devient obligatoire |
| « Annexes (facultatif) » | facultatif | 10 fichiers, 25 Mo chacun |

Puis « Enregistrer le brouillon ». La fiche de l'acte s'ouvre.

*Fiche d'un acte* :
- **Informations** : numéro (« Non numéroté » avant signature), statut, confidentialité, « Objet », « Rédigé par », « Destinataires », « Agent concerné » (avec « A pris connaissance le … »), « Expédié », « En réponse à », « Texte ».
- **Rubriques** : « Circuit de visa » (étapes, et « Soumissions précédentes (n) »), « Pièces », « Accès délégués » (acte confidentiel).
- **Bandeaux possibles** :
  - « Renvoyé pour correction : <motif> » ;
  - « Circuit à recalculer. Le viseur attendu n’occupe plus ce poste : l’acte doit être resoumis. » ;
  - « En attente de la prise de connaissance de <nom>. » ;
  - « Annulé : <motif> ».

*Boutons de la fiche d'un acte* :
- **« Soumettre au visa »** (« Resoumettre » après un renvoi ou si le circuit est à recalculer) : confirmation « Soumettre l’acte au circuit de visa ? ».
- **« Modifier »** : fenêtre « Modifier l’acte », mêmes champs, puis « Enregistrer ».
- **« Ajouter une annexe »** : « Fichiers (10 au plus, 25 Mo chacun) » → « Ajouter ».
- **« Viser »** → fenêtre « Viser l’acte » : « Commentaire (facultatif) » (2 000 caractères) → « Viser ».
- **« Renvoyer pour correction »** → « Motif (obligatoire) » (5 caractères au moins) → « Renvoyer ». Explication : « L’acte revient au rédacteur avec votre motif ; il le corrigera puis le resoumettra. »
- **« Signer »** → fenêtre « Signer l’acte » : « La signature attribue le numéro définitif du registre … ; il ne pourra plus changer. » Champ « Acte signé scanné (facultatif) », puis « Signer ».
- **« Expédier »** → fenêtre « Expédier » (« l’expédition est datée et tracée. ») : « Mode d’expédition » (obligatoire, 2 à 200 caractères ; suggestions : Courrier physique, Porteur, Courriel, Valise, Remise en main propre), puis « Marquer expédié ».
- **« J’ai pris connaissance »** : confirmation « Confirmer que vous avez pris connaissance de cet acte ? ».
- **« Supprimer »** (brouillon jamais soumis) : confirmation « Supprimer ce brouillon ? Il n’a jamais été soumis. »
- **« Annuler l’acte »** : « Motif (obligatoire) ». Pour un acte numéroté : « Le numéro … reste consommé et apparaît « annulé » dans le registre. »

*« Exporter (Excel) »* (onglets « Arrivées » et « Départs et actes ») :
- Télécharge le registre affiché, avec les filtres en cours. Le fichier ne contient jamais plus que ce que vous voyez à l'écran.
- Colonnes des arrivées : Numéro, Registre, Reçu le, Expéditeur, Objet, Confidentialité, Statut. Pour un pli personnel dont vous ne voyez que l'existence, l'objet est remplacé par « (pli personnel — contenu protégé) ».
- Colonnes des actes : Numéro, Registre, Objet, Destinataires, Confidentialité, Statut, Signé le.
- Chaque export est tracé.

**Statuts et étapes — courrier arrivé**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Enregistré » | numéroté, pas encore imputé | DN ou DNA (registre de la Direction), ou chef de division / chef de cellule de l'unité du registre, par « Imputer » |
| « Imputé » | au moins une imputation | automatique : passe à « Traité » quand toutes les imputations « Pour attribution » sont traitées par leurs destinataires |
| « Traité » | toutes les attributions sont traitées | secrétariat courrier, DN, DNA ou chef de l'unité, par « Classer » |
| « Classé » | sorti des courriers en cours | — |
| « Annulé » | enregistrement annulé, numéro conservé | — |

Une imputation est « EN COURS », « EN RETARD » (échéance passée) ou « TRAITÉE ».

**Statuts et étapes — départs et actes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « Brouillon » | en rédaction, visible du rédacteur seul | le rédacteur, par « Soumettre au visa » |
| « En visa » | circuit de visa en cours | chaque viseur attendu, par « Viser » (ou « Renvoyer pour correction ») |
| « Renvoyé » | retourné au rédacteur avec un motif | le rédacteur corrige (« Modifier ») puis « Resoumettre » |
| « À signer » | visas terminés | DN ou DNA (registre de la Direction) ; chef de division / chef de cellule de l'unité émettrice, ou DN, DNA (registre d'unité), par « Signer » |
| « Signé » | numéro définitif attribué | secrétariat courrier du registre, par « Expédier » |
| « Expédié » | envoyé, date et mode enregistrés | — |
| « Annulé » | sorti du circuit, numéro conservé s'il existait | — |

**Le circuit de visa** est calculé automatiquement à la soumission :
1. le chef de section du rédacteur (si le rédacteur est dans une section) ;
2. puis le chef de division ou le chef de cellule du rédacteur, **seulement pour un registre de la Direction**. Pour un registre d'unité, ce chef signe au lieu de viser.

Une étape est sautée (« Sans objet ») si le poste est vacant (« Poste vacant ») ou si le rédacteur est lui-même ce chef (« Le rédacteur est lui-même ce chef »). Sans aucun visa, l'acte passe directement « À signer ».

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Enregistrer un courrier arrivé | secrétariat courrier habilité sur ce registre et cette unité | « Vous n’êtes pas habilité à enregistrer le courrier de ce registre pour cette unité. » |
| Corriger, ajouter un scan, annuler l'enregistrement | secrétariat courrier habilité, DN, DNA, chef de division / chef de cellule de l'unité du registre | « Seuls le secrétariat habilité et la direction (ou le chef de l’unité) gèrent ce registre. » |
| Classer | les mêmes ; pour un pli personnel, son destinataire seul | « Seul le destinataire classe un pli personnel. » |
| Imputer | DN, DNA (registre de la Direction) ; chef de division / chef de cellule de l'unité, DN, DNA (registre d'unité) ; leur suppléant en intérim (« P.I. ») | « Seuls le DN et la DNA imputent le courrier de ce registre. » / « Seuls le chef de l’unité et la direction imputent le courrier de ce registre. » |
| Sous-imputer | la personne imputée (ou son suppléant), vers une personne de son périmètre | « Seule la personne imputée peut sous-imputer ce courrier. » / « Vous ne pouvez sous-imputer qu’à une personne de votre périmètre. » |
| Marquer traité | la personne imputée, ou son suppléant en intérim | « Seule la personne imputée (ou son suppléant en intérim) traite cette imputation. » |
| Convertir en tâche | l'auteur de l'imputation | « Seul l’auteur de l’imputation peut la convertir en tâche. » |
| Compléter, requalifier un pli personnel | son destinataire seul | « Seul le destinataire peut ouvrir et compléter un pli personnel. » |
| Ouvrir un accès délégué | une personne qui a elle-même accès au contenu, en son nom propre (pas en intérim), vers son assistant(e) ou son suppléant en cours | « Un accès délégué s’ouvre en votre nom propre, jamais en intérim. » / « L’accès ne peut être ouvert qu’à votre assistant ou à votre suppléant (suppléance en cours et conforme). » |
| Rédiger, modifier, soumettre, supprimer un brouillon | tout utilisateur (sauf stagiaire), pour ses propres actes | « Seul le rédacteur peut effectuer cette action. » |
| Viser | le viseur attendu (chef de section, chef de division, chef de cellule) ou son suppléant en intérim ; jamais le rédacteur | « Personne ne vise sa propre lettre. » / « Ce visa ne vous revient pas (ni en votre nom, ni en intérim du viseur attendu). » |
| Renvoyer pour correction | le viseur attendu, ou le signataire au stade « À signer » | « Seul le viseur attendu peut renvoyer l’acte à ce stade. » |
| Signer | registre de la Direction : DN, DNA. Registre d'unité : chef de division / chef de cellule de l'unité émettrice, DN, DNA. Suppléant possible (« au nom de »). Jamais le bénéficiaire de l'acte | « Un acte de ce registre est signé par le DN ou la DNA. » / « Un Chef de Section ne signe pas : l’acte est signé par le chef de la Division ou de la Cellule émettrice. » / « Vous ne pouvez signer que les actes de votre propre unité. » / « Le bénéficiaire d’un acte ne peut pas le signer (ni son suppléant en son nom). » |
| Expédier | secrétariat courrier habilité sur ce registre | « Seul le secrétariat habilité de ce registre expédie les actes signés. » |
| Annuler un acte | acte non numéroté : le rédacteur, DN, DNA, chef de l'unité. Acte numéroté : le signataire, DN, DNA, chef de l'unité | « Vous n’avez pas l’autorité pour annuler cet acte. » |
| Prendre connaissance | l'agent concerné lui-même | « Seul le bénéficiaire de l’acte peut en attester la prise de connaissance. » |
| Paramétrer registres, habilitations, compteurs | administrateur système | « Accès non autorisé » — « Cette page est réservée à l’Administrateur Système. » |

**Qui voit quoi (besoin d'en connaître)**

| Confidentialité | Voient tout le contenu | Voient moins |
|---|---|---|
| « Ordinaire » | DN, DNA (et leur assistant(e), leur suppléant en intérim), chef de l'unité du registre, secrétariat courrier habilité, personnes imputées et leur hiérarchie | les autres ne voient rien |
| « Confidentiel » | DN, DNA, chef de l'unité du registre (par leur propre compte, jamais en intérim ni par un assistant), personnes imputées nommément, bénéficiaires d'un accès délégué | le secrétariat courrier voit seulement l'enregistrement : « Contenu protégé. Courrier confidentiel : vous en voyez l’enregistrement, pas le contenu (scans, imputations). » |
| « Pli personnel » | son destinataire seul | DN, DNA, chef de l'unité et secrétariat courrier voient seulement son existence : « Pli fermé adressé à <nom>, reçu le … de … Son contenu n’est visible que de son destinataire. » |

Autres règles :
- Un acte au statut « Brouillon » n'est visible que de son rédacteur.
- Le secrétariat courrier ne voit un acte qu'une fois signé.
- L'administrateur système ne voit que son propre courrier.
- Le stagiaire n'a aucun accès au module.

**Les habilitations du secrétariat courrier**
- Elles sont accordées par l'administrateur système, pour un registre et une unité.
- L'écran les décrit ainsi : « Une habilitation permet d’enregistrer le courrier d’un registre (et d’expédier ses actes signés) pour une unité. Elle ne donne aucune autorité d’imputation ni de signature. »
- Elles sont personnelles : un suppléant ne les reçoit jamais pendant un intérim.

**Administration du courrier** (administrateur système, « Administration » → « Courrier », titre « Courrier — paramétrage »)

Onglets « Registres », « Habilitations », « Compteurs ».

*« Registres »* :
- « + Nouveau registre » ; sur chaque registre, « Modifier » et « Désactiver » / « Réactiver ».
- La fenêtre « Nouveau registre » précise : « Changer le gabarit ne réécrit jamais un numéro déjà attribué. Nature et portée sont figées dès la première entrée. »

| Champ | Obligatoire ? | Limites |
|---|---|---|
| « Code » | obligatoire | majuscules, chiffres, « _ » ou « - », 2 à 20 caractères ; non modifiable ensuite |
| « Libellé » | obligatoire | 2 à 200 caractères |
| « Nature » | obligatoire | « Arrivée », « Départ », « Actes » |
| « Portée » | obligatoire | « Direction (numérotation DNPEC) » ou « Unité (numérotation par Division/Cellule) » |
| « Gabarit du numéro » | obligatoire | 3 à 120 caractères ; variables : {seq} ou {seq:4} (obligatoire), {code}, {annee}, {unite} |

- L'aperçu « Prochain numéro (<année>) » montre le résultat. « Aperçu pour l’unité » permet de le voir pour un registre d'unité.
- Bouton « Enregistrer ».

*« Habilitations »* :
- « + Accorder une habilitation » → fenêtre « Accorder une habilitation » : « Personne », « Registre », « Unité » → « Accorder ».
- Chaque ligne indique « depuis le … » et propose « Révoquer ». La rubrique « Historique (n) » liste les habilitations révoquées.
- Seuls les comptes actifs et les registres actifs sont proposés. Un stagiaire ne peut pas être habilité.

*« Compteurs »* :
- Liste « Registre », puis un tableau Unité / Année / Dernier numéro / Mis à jour.
- Bouton « Reprise d’un compteur » → fenêtre « Reprise du compteur — <code> », avec l'avertissement : « À n’utiliser qu’au démarrage, pour reprendre la numérotation papier : indiquez le dernier numéro déjà attribué à la main. Refusé dès qu’une entrée a été numérotée par le système pour ce registre, cette unité et cette année. »
- Champs : « Unité » (registre d'unité), « Année » (2000 à 2100), « Dernier numéro attribué » (0 ou plus). Puis « Enregistrer la reprise ».

**Règles automatiques**

- **Numérotation.** Le numéro d'un courrier arrivé est attribué à l'enregistrement ; celui d'un acte, à la signature. La numérotation se fait par registre, par unité et par année (année du serveur), sans trou ni doublon. Un numéro attribué ne change jamais, même si le gabarit change ensuite ; un enregistrement annulé garde son numéro.
- **Notifications du courrier arrivé** :
  - Enregistrement d'un courrier ordinaire ou confidentiel : « Nouveau courrier à imputer » (ou « Nouveau courrier confidentiel à imputer », sans l'objet). Destinataires : DN et DNA (registre de la Direction) ; chef de division ou chef de cellule de l'unité (registre d'unité), ou DN et DNA si l'unité n'a pas de chef. La personne qui a enregistré le courrier n'est pas prévenue.
  - Enregistrement d'un pli personnel : son destinataire seul reçoit « Un pli personnel vous attend ».
  - Imputation ou sous-imputation : la personne imputée reçoit « Courrier imputé » (nature et échéance).
  - Conversion en tâche : la personne imputée reçoit « Nouvelle tâche assignée ».
- **Notifications des actes** :
  - « Acte à viser » : au viseur attendu.
  - « Acte à signer » : au DN et à la DNA, ou au chef de l'unité pour un registre d'unité. Le bénéficiaire de l'acte en est exclu. E-mail envoyé immédiatement.
  - « Acte renvoyé pour correction » : au rédacteur.
  - « Circuit de visa à recalculer » : au rédacteur, quand le viseur attendu a changé de poste.
  - « Acte signé » : au rédacteur. « Acte signé à expédier » : au secrétariat courrier du registre.
  - « Acte à prendre en connaissance » : à l'agent concerné, si la prise de connaissance est demandée.
- **Rappels d'échéance des imputations.** Ils sont vérifiés toutes les 30 minutes et envoyés une seule fois chacun. Les imputations traitées, et celles des courriers classés ou annulés, sont ignorées.
  - Dans les 2 jours avant l'échéance : « Échéance proche » à la personne imputée (« Le traitement du courrier … arrive à échéance le … »).
  - 24 heures après l'échéance : « Imputation en retard » à la personne imputée **et** à l'auteur de l'imputation (« … était attendu pour le … »). E-mail envoyé immédiatement.
- **Confidentialité dans les messages.** Les notifications et e-mails ne citent jamais l'objet d'un courrier confidentiel ou d'un pli personnel. Ils indiquent seulement « n° … (confidentiel) » ou « n° … (pli personnel) ».
- **Intérim.** Quand vous agissez pour un titulaire, chaque confirmation rappelle : « Sera enregistré par vous, au nom de <titulaire> (par intérim). » Les imputations et signatures portent « P.I. » ou « au nom de ».
- **Accès délégués.** Un accès délégué s'arrête de lui-même :
  - à la fin de la suppléance ;
  - si l'assistant(e) n'est plus rattaché(e) à la personne qui a ouvert l'accès ;
  - si cette personne perd elle-même l'accès au courrier.
- Les e-mails autres que les urgences partent dans le résumé quotidien, selon vos préférences de notification.

**Messages que vous pouvez voir**

- « Ce courrier est hors de votre périmètre. » → vous n'avez pas à connaître ce courrier.
- « Le contenu de ce courrier est protégé (besoin d’en connaître). » → courrier confidentiel : demandez un accès délégué au responsable.
- « Cet acte est hors de votre périmètre. » → acte non visible pour vous.
- « Registre introuvable ou inactif » → registre désactivé : contactez l'administrateur système.
- « Ce registre n’est pas un registre de courrier arrivée. » → choisissez un registre d'arrivée.
- « Un pli personnel exige son destinataire nominatif. » → choisissez le « Destinataire ».
- « Un pli personnel n’a pas d’objet au registre (pli fermé). » / « Un pli personnel ne se scanne pas (pli fermé). » → ne saisissez ni objet ni scan.
- « L’objet du courrier est obligatoire. » → saisissez l'objet.
- « Date anormale : … Pour l’enregistrer quand même, confirmez la date et indiquez le motif de la dérogation. » → corrigez la date, ou cochez « Je confirme cette date » et donnez le motif.
- « Une dérogation sur les dates exige un motif. » → remplissez le motif.
- « Un motif d’au moins 5 caractères est obligatoire. » → allongez le motif.
- « Ce courrier est annulé. » / « Ce courrier est classé. » / « Ce courrier est déjà annulé ou classé. » → plus aucune action possible.
- « Ce courrier ne peut être classé qu’une fois imputé et toutes ses attributions traitées. » → attendez que les attributions soient traitées.
- « L’objet d’un pli personnel ne peut être renseigné que par son destinataire. » → seul le destinataire complète le pli.
- « Complétez d’abord l’objet du pli avant de le requalifier. » → « Compléter le pli ».
- « Ce courrier n’est pas (ou plus) un pli personnel. » → le pli a déjà été requalifié.
- « Un pli personnel doit d’abord être requalifié par son destinataire pour être imputé. » → le destinataire doit le requalifier.
- « Le courrier d’un registre d’unité ne s’impute qu’aux membres de cette unité. » → choisissez un membre de l'unité.
- « Ce courrier est déjà imputé à cette personne. » → imputation en double.
- « L’échéance doit être dans le futur. » → choisissez une date à venir.
- « L’échéance d’une sous-imputation ne peut pas dépasser celle de l’imputation reçue. » → avancez la date.
- « L’administrateur système ne reçoit pas de courrier : il ne peut être ni imputé ni sous-imputé. » / « Un stagiaire n’a pas accès au courrier : il ne peut être ni imputé ni sous-imputé. »
- « La personne imputée n’a pas de compte actif. » → choisissez une autre personne.
- « Cette imputation est déjà traitée. » → rien à faire.
- « Une imputation pour avis exige l’avis (compte rendu). » → saisissez votre avis.
- « Une échéance est obligatoire pour convertir en tâche. » → renseignez « Échéance de la tâche ».
- « Cette imputation a déjà une tâche associée. » → ouvrez la « Tâche associée → ».
- « Un pli personnel n’est jamais délégable. » / « Un accès délégué ne concerne que les courriers confidentiels. »
- « Un accès est déjà ouvert à cette personne pour ce courrier. » / « Seule la personne qui a ouvert cet accès peut le révoquer. »
- « Un acte se rédige dans un registre de départ ou d’actes. » → changez de registre.
- « Registre d’unité : vous n’êtes rattaché à aucune Division ni Cellule. » → choisissez un registre de la Direction.
- « La prise de connaissance exige un bénéficiaire. » → choisissez l'« Agent concerné ».
- « Bénéficiaire : compte inactif. » → choisissez un agent actif.
- « Seul un brouillon ou un acte renvoyé pour correction est modifiable. » → l'acte est déjà dans le circuit.
- « Les annexes se joignent au brouillon (ou après un renvoi). »
- « Seul un brouillon, un acte renvoyé ou un circuit devenu obsolète peut être (re)soumis. »
- « Anomalie d’organisation : deux chefs actifs occupent le même niveau du circuit de visa. Contactez l’administrateur. »
- « Le viseur attendu n’occupe plus ce poste. Le rédacteur a été prévenu : il doit resoumettre l’acte pour recalculer le circuit. » → le rédacteur clique sur « Resoumettre ».
- « Cet acte n’est pas en cours de visa. » / « Ce visa a déjà été posé. » / « Cet acte n’est ni en visa ni à signer. »
- « Cet acte n’est pas à signer. » / « Cet acte vient d’être signé (ou n’est plus à signer). »
- « Seul un acte signé, pas encore expédié, peut être expédié. »
- « Cet acte a déjà été soumis : il ne peut plus être supprimé, seulement annulé (motif obligatoire). »
- « Un brouillon jamais soumis se supprime, il ne s’annule pas. »
- « Cet acte est déjà annulé. »
- « L’acte doit être signé pour en prendre connaissance. » / « La prise de connaissance a déjà été enregistrée. » / « Cet acte ne requiert pas de prise de connaissance. »
- Administration :
  - « Le code doit être en majuscules (2 à 20 caractères, ex. ARR, NS, OM). » ;
  - « Ce code de registre existe déjà. » ;
  - « Le gabarit doit contenir la séquence {seq} ou {seq:n}. » ;
  - « Variables inconnues dans le gabarit : … » ;
  - « Nature et portée sont figées dès qu’une entrée existe dans ce registre. » ;
  - « Seul un compte actif peut être habilité. » ;
  - « Un stagiaire n’a pas accès au courrier : il ne peut pas être habilité. » ;
  - « Cette personne est déjà habilitée sur ce registre pour cette unité. » ;
  - « Cette habilitation est déjà révoquée. » ;
  - « Des entrées ont déjà été numérotées par le système pour ce registre, cette unité et cette année : reprise impossible. »

**Captures**

- 07-courrier-01-a-faire.png
- 07-courrier-02-arrivees.png
- 07-courrier-03-actes.png
- 07-courrier-04-administration.png
- 07-courrier-05-tiroir-arrivee-imputer.png
- 07-courrier-06-acte-en-visa.png
- 02-interface-11-menu-secretariat-courrier.png

---

### 3.19 Réunions

**À quoi sert ce module**
Le module « Réunions » sert à planifier une réunion, à inviter des participants et à réserver la salle en même temps. Il permet ensuite de suivre les réponses des invités et de consigner les décisions prises. Une décision peut être transformée en tâche, avec un responsable et une échéance.

**Accès**
- Menu « Général » → « Réunions ».
- Tous les profils voient cette entrée, sauf le stagiaire.
- Un lien reçu dans une notification ouvre directement la réunion concernée.

**Écran et onglets**
- L'écran n'a pas d'onglets. En haut figurent le titre « Réunions » et le bouton « + Nouvelle réunion ».
- La liste montre les réunions que vous pouvez voir, de la plus proche à la plus lointaine. Pour chaque réunion, elle affiche :
  - le titre, la date et l'heure, le lieu ;
  - le nombre de participants ;
  - les badges éventuels : « Annulée », « Organisateur » ;
  - votre propre réponse : « Confirmé », « Décliné » ou « En attente ».
- Si vous ne voyez aucune réunion : « Aucune réunion pour l’instant. »
- Vous voyez une réunion si :
  - vous l'organisez ;
  - vous y êtes invité ;
  - un de vos agents y participe (vous êtes alors son supérieur hiérarchique ; la lecture seule ne vous donne aucun droit d'action) ;
  - la réunion a été déclarée ouverte à tous.
- Cliquer sur une réunion ouvre sa fiche, sur le côté droit de l'écran. La fiche contient :
  - le titre, la date et le lieu ;
  - la ligne « Organisée par … » ;
  - les blocs « Ordre du jour » et « Participants (n) », avec la réponse de chacun ;
  - le « Relevé de décisions » ;
  - les documents issus de la réunion (procès-verbal).

**Actions et formulaires**
- Bouton « + Nouvelle réunion » → fenêtre « Nouvelle réunion » :

  | Champ | Obligatoire ? | Limites |
  |---|---|---|
  | « Titre » | obligatoire | 2 à 300 caractères |
  | « Début » (date et heure) | obligatoire | — |
  | « Fin (optionnel) » | facultatif, mais **obligatoire pour réserver une salle** | après le début |
  | « Réserver une salle » | facultatif | grisé tant que début et fin ne sont pas saisis : « Indiquez le début et la fin pour voir les salles libres » ; ensuite « Aucune (lieu libre ci-dessous) » ou une salle proposée |
  | « Lieu (optionnel) » | facultatif | affiché seulement si aucune salle n'est choisie |
  | « Ordre du jour (optionnel) » | facultatif | texte libre |
  | « Participants » | facultatif | recherche « Ajouter un participant… », croix ✕ pour retirer quelqu'un |

  - Les salles proposées sont les salles libres et les salles occupées sur lesquelles vous pouvez faire valoir la priorité hiérarchique.
    - Une salle qui demande une validation porte la mention « — soumise à validation ».
    - Une salle occupée porte la mention « — occupée : priorité hiérarchique sur <noms> ». Si vous la choisissez, l'avertissement suivant s'affiche : « En créant la réunion, vous faites valoir la priorité hiérarchique : la réservation de <noms> sera annulée et la personne prévenue avec votre nom. »
  - Boutons : « Annuler » et « Créer la réunion » (« Création… » pendant l'enregistrement). Le bouton reste grisé tant que le titre ou le début manquent.
  - Vous êtes ajouté automatiquement comme participant, avec la réponse « Confirmé ».
  - La réunion et la réservation de la salle sont enregistrées **ensemble** : si la salle est refusée, la réunion n'est pas créée non plus.
- Fiche d'une réunion, pour un invité (réunion non annulée) : boutons « Confirmer ma présence » et « Décliner ». Une fois que vous avez répondu, vous ne pouvez plus revenir à « En attente ».
- Fiche d'une réunion, pour l'organisateur : bouton « Annuler la réunion ». Le message de confirmation est « Annuler cette réunion ? Les participants seront notifiés. » La salle réservée est libérée automatiquement.
- Relevé de décisions (dans la fiche) :
  - **Consigner** (organisateur) : saisir le texte dans « Consigner une décision… » (2 à 2000 caractères), puis cliquer « Ajouter la décision ».
  - « Modifier » (organisateur) : le texte se corrige sur place, puis « Enregistrer ».
  - « Convertir en action » (organisateur, si la décision n'a pas encore d'action). Le formulaire contient :
    - « Intitulé de la tâche (facultatif) », 300 caractères au plus ; vide, il reprend le texte de la décision ;
    - « Responsable » (obligatoire), à choisir dans la liste proposée ;
    - « Échéance » (obligatoire) ;
    - puis le bouton « Créer la tâche ».
  - « Clôturer » (organisateur) : le message de confirmation est « Clôturer cette décision ? Elle ne pourra plus être modifiée. »
  - « Relancer l’organisateur » (supérieur hiérarchique qui voit la décision sans être l'organisateur) : envoie une relance à l'organisateur et affiche « Relance envoyée à l’organisateur. »
- La saisie d'un compte rendu, la déclaration d'une réunion « ouverte » et la modification du titre, de la date ou des participants ne sont pas proposées à l'écran (à confirmer).

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| Planifiée (pas de badge) | Réunion à venir | L'organisateur peut l'annuler |
| « Annulée » | Réunion annulée, salle libérée | Étape finale |
| Réponse « En attente » | L'invité n'a pas encore répondu | L'invité : « Confirmer ma présence » ou « Décliner » |
| Réponse « Confirmé » / « Décliné » | Réponse donnée | L'invité peut changer entre les deux |
| Décision « En attente » | Décision consignée, sans action | Organisateur : « Convertir en action » ou « Clôturer » |
| Décision « Action en cours » | Une tâche a été créée | La décision se clôture quand la tâche est terminée, ou par « Clôturer » |
| Décision « Clôturée » | Décision close, non modifiable | Étape finale |

Messages de la fiche concernant la salle :
- « Salle « X » en attente de validation par un gestionnaire. »
- « Salle « X » perdue (priorité hiérarchique) : la réunion n’a plus de salle. » La parenthèse devient « (refusée) » si la salle a été refusée.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Créer une réunion | Tous sauf le stagiaire | « Cette fonctionnalité n’est pas accessible aux stagiaires. » |
| Inviter une personne | Tout compte actif, sauf un stagiaire | « Un stagiaire n’a pas accès aux réunions : il ne peut pas y être invité. » / « Un ou plusieurs participants n’ont pas de compte actif. » |
| Répondre à l'invitation | L'invité lui-même | « Vous n'êtes pas invité à cette réunion. » |
| Annuler la réunion | L'organisateur (ou son suppléant en intérim) | « Seul l'organisateur peut annuler cette réunion. » |
| Consigner, modifier, convertir, clôturer une décision | L'organisateur (ou son suppléant en intérim) | « Seul l’organisateur de la réunion peut gérer ses décisions. » |
| Relancer l'organisateur | La hiérarchie qui voit la réunion | — |
| Désigner le responsable d'une action | Une personne de votre périmètre, ou vous-même | « Vous ne pouvez désigner comme responsable qu’une personne de votre périmètre (ou vous-même). » |

**Règles automatiques**
- **Rappel** : environ 30 minutes avant le début, chaque participant reçoit la notification « Rappel de réunion », une seule fois. L'application vérifie toutes les 5 minutes s'il y a des rappels à envoyer.
- **Création** : les invités reçoivent « Nouvelle réunion ».
- **Annulation** : les autres participants reçoivent « Réunion annulée ».
- **Conversion en action** : le responsable reçoit « Nouvelle tâche assignée ».
- **Salle prise en priorité** : si un supérieur prend la salle de votre réunion, vous recevez « Réservation annulée pour priorité ». Le message précise : « Votre réunion est conservée, sans salle : choisissez-en une autre. »

**Messages que vous pouvez voir**
- « La fin de la réunion doit être après son début. » → Corrigez l'heure de fin.
- « Indiquez l’heure de fin pour réserver une salle. » → Saisissez « Fin (optionnel) ».
- « Un ou plusieurs participants sont introuvables. » → Retirez puis ajoutez de nouveau le participant.
- « Un ou plusieurs participants n’ont pas de compte actif. » → Retirez la personne dont le compte est suspendu ou désactivé.
- « Un stagiaire n’a pas accès aux réunions : il ne peut pas y être invité. » → Retirez le stagiaire de la liste.
- « Cette réunion est déjà annulée. » → Aucune action n'est nécessaire.
- « Cette décision est déjà clôturée. » → La décision n'est plus modifiable.
- « Cette décision a déjà une action associée. » → Suivez la tâche déjà créée (lien « Action : … »).
- « Le responsable désigné n'a pas de compte actif. » → Choisissez une autre personne.
- Les messages de réservation de salle sont détaillés au module 3.20, par exemple « « X » est déjà réservée sur ce créneau : … ».

**Captures**
- 08-reunions-01-liste.png
- 08-reunions-02-nouvelle-reunion.png

---

### 3.20 Logistique (demandes, fournitures et stock, inventaire, réservations et priorité)

**À quoi sert ce module**
Le module « Logistique » sert à demander des fournitures, du matériel ou une intervention, et à suivre le traitement de la demande. Il sert aussi à réserver une salle ou du matériel de présentation et à consulter les biens qui vous sont affectés. Les gestionnaires logistiques y tiennent l'inventaire, le stock de fournitures et les salles.

**Accès**
- Menu « Général » → « Logistique » : tous les profils sauf le stagiaire.
- Menu « Administration » → « Logistique » : administrateur système seulement. Cet écran, « Administration de la logistique », sert à gérer les gestionnaires et les catégories.
- Le tableau de bord affiche une carte « 🧰 Logistique — … » quand quelque chose vous attend : demandes à valider, à traiter, réservations à valider, articles sous le seuil. Le lien « Ouvrir → » mène au module.
- Un gestionnaire logistique voit en haut de l'écran : « Vous êtes gestionnaire logistique. »

**Écran et onglets**

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Demandes (n) » | tous | sous-onglets « Mes demandes », « À valider », « À traiter » (gestionnaire) ; boutons « Exporter » et « + Nouvelle demande » |
| « Réservations (n) » | tous | sous-onglets « Réserver », « Mes réservations », « À valider » et « Ressources » (gestionnaire) |
| « Inventaire » (gestionnaire) / « Mes biens » (autres) | tous | liste des biens, filtres « N°, désignation, série… », « Toutes catégories », « Tous états » ; boutons « Exporter » et « + Nouveau bien » (gestionnaire) |
| « Fournitures (n) » | gestionnaires logistiques seulement | articles, stock, entrées et sorties ; bouton « + Nouvel article » |
| « Véhicules » | tous | voir le module 3.21 |

- Le nombre entre parenthèses indique ce qui vous attend.
- « Mes biens » montre les biens affectés à vous-même et à votre unité. Un chef voit aussi les biens de son périmètre. Le gestionnaire logistique, le DN et la DNA voient l'inventaire complet.

**Actions et formulaires**

*Demandes*
- « + Nouvelle demande » → fenêtre « Nouvelle demande logistique » :

  | Champ | Obligatoire ? | Limites |
  |---|---|---|
  | « Type » | obligatoire | « Fournitures », « Matériel » ou « Intervention » |
  | « Article » (Fournitures) | obligatoire | articles proposés aux demandeurs |
  | « Quantité » (Fournitures, Matériel) | obligatoire | 1 à 10 000 |
  | « Catégorie de matériel » (Matériel) | obligatoire | catégories de biens actives |
  | « Bien concerné » (Intervention) | obligatoire | biens que vous pouvez signaler |
  | « Objet » | obligatoire | 3 à 300 caractères |
  | « Justification (facultatif) » | facultatif | 2000 caractères au plus |

  - Le circuit s'affiche avant l'envoi : « Circuit : votre chef valide, puis un gestionnaire traite. » ou « Circuit : transmise directement aux gestionnaires. »
  - Bouton « Envoyer la demande ». Message affiché ensuite : « Demande envoyée à votre chef pour validation. » ou « Demande transmise aux gestionnaires logistiques. »
- Fiche d'une demande : elle montre le demandeur, l'article ou le bien, la justification et le compte rendu. Elle déroule les étapes « Demandée », « Validée par le chef », « Prise en charge », « Traitée », avec la date et l'auteur de chacune. Les boutons visibles dépendent de vos droits :
  - « Annuler ma demande » (demandeur) ;
  - « Valider » (chef). Message : « Demande validée : transmise aux gestionnaires. » ;
  - « Refuser ». Fenêtre « Refuser la demande », champ « Motif (communiqué au demandeur) » (obligatoire, 3 à 500 caractères), bouton « Refuser » ;
  - « Prendre en charge » (gestionnaire) ;
  - « Traiter » (gestionnaire). Fenêtre « Traiter la demande » :
    - pour des fournitures, « Quantité remise (demandée : n) » (obligatoire, sans dépasser la quantité demandée) ;
    - « Compte rendu (facultatif) » ;
    - bouton « Marquer traitée ».
- « Exporter » : télécharge la liste affichée dans un fichier Excel « Demandes logistiques ».

*Fournitures et stock (gestionnaire logistique)*
- « + Nouvel article » → fenêtre « Nouvel article » :
  - « Catégorie » (obligatoire, catégorie de fournitures) ;
  - « Libellé » (obligatoire, 2 à 160 caractères) ;
  - « Unité » (obligatoire, 1 à 40 caractères, « unité » par défaut) ;
  - case « Suivre le stock (entrées, sorties, alerte) » ;
  - « Seuil d’alerte (facultatif) » (0 ou plus).
  - En modification, une case supplémentaire « Proposé aux demandeurs » apparaît.
- Fiche d'un article : boutons « Modifier », « Sortie », « Entrée », et liste « Mouvements » (« reste n »).
- « Entrée » ou « Sortie » → fenêtre « Entrée en stock — X » ou « Sortie de stock — X » :
  - « Quantité (unité) » (obligatoire, 1 à 1 000 000) ;
  - « Motif » : **obligatoire pour une sortie**, « Motif (facultatif) » pour une entrée ;
  - bouton « Enregistrer ».
- Le stock ne peut jamais devenir négatif.

*Inventaire (gestionnaire logistique)*
- « + Nouveau bien » → fenêtre « Nouveau bien » :
  - « Catégorie » (obligatoire) ;
  - « Désignation » (obligatoire, 2 à 200 caractères) ;
  - « Marque », « N° de série », « Emplacement », « Acquis le » (facultatifs).
  - L'application attribue elle-même le numéro d'inventaire, sous la forme CODE-ANNÉE-0001. Il se suit par catégorie et par année, sans trou ni doublon. Message affiché : « Bien enregistré sous le numéro <n°>. »
- Fiche d'un bien :
  - informations « Affecté à », « Marque », « N° de série », « Emplacement », « Acquis le » ;
  - historique complet ;
  - boutons :
    - « Signaler une panne » (tous) : ouvre une demande d'intervention préremplie « Panne : <désignation> » ;
    - « Modifier » (gestionnaire) ;
    - « Changer l’état » (gestionnaire) ;
    - « Retour » (gestionnaire) : « Motif (facultatif) », puis « Enregistrer le retour » ;
    - « Affecter » ou « Réaffecter » (gestionnaire).
- « Affecter <n°> » : choisir « Une personne » (champ « Nom de la personne… ») ou « Une unité » (division, section ou cellule), puis cliquer « Affecter ». En cas de réaffectation, le retour du précédent détenteur est enregistré automatiquement.
- « Changer l’état » : « Nouvel état » (« En service », « En panne », « En réparation », « Réformé »). Le motif est **obligatoire pour une réforme**. L'avertissement affiché est : « La réforme est définitive : le bien garde son numéro, sort du parc, et son affectation est close. » Le bouton devient alors « Réformer définitivement ».
- Un bien n'est jamais supprimé et son numéro ne change jamais.

*Réservations*
- Sous-onglet « Réserver » :
  - champs « Jour » (demain par défaut), « De » (09:00), « À » (10:00), « Ressource » (« Toutes », « Salle », « Matériel de présentation ») ;
  - bouton « Voir les disponibilités ».
- Chaque ressource affiche son type, sa capacité, son mode, le badge « Libre » ou « Occupée », et les lignes « Réservée par X de hh:mm à hh:mm ».
  - Sur une ressource libre : bouton « Réserver ».
  - Sur une ressource occupée dont vous pouvez évincer **tous** les titulaires : bouton « Faire valoir la priorité ».
- Fenêtre « Réserver <ressource> » (bouton « Réserver »), ou « Réserver en faisant valoir la priorité » (bouton « Prendre le créneau ») :
  - « Objet » (obligatoire, 2 à 300 caractères) ;
  - en priorité, l'avertissement « Ces réservations seront annulées pour priorité, et leurs titulaires prévenus avec votre nom : … » ;
  - pour une ressource à validation : « Cette ressource demande la validation d’un gestionnaire : le créneau vous est réservé en attendant. »
- Fiche d'une réservation :
  - informations « Titulaire », « Objet », « Réunion », « Priorité », « Refus », « Annulation » ;
  - boutons « Annuler la réservation », « Refuser » et « Valider » (gestionnaire). Pour refuser, ou pour une annulation faite par un gestionnaire, le champ « Motif (communiqué au titulaire) » est obligatoire (3 caractères au moins).
- Sous-onglet « Ressources » (gestionnaire) : bouton « + Nouvelle ressource » → fenêtre « Nouvelle ressource réservable » :
  - « Nom » (obligatoire, 2 à 120 caractères, unique) ;
  - « Type » ;
  - « Capacité (facultatif) » (1 à 2000) ;
  - « Confirmation » : « Confirmation immédiate » ou « Validation du gestionnaire » ;
  - « Description (facultatif) ».
  - En modification, la case « Réservable » permet de retirer une ressource, qui porte alors le badge « Inactive ».

*Administration de la logistique (administrateur système)*
- Section « Gestionnaires logistiques » : « Choisir une personne… », puis « Habiliter » ; lien « Retirer ». Le texte de la section rappelle : « Habilitation personnelle, attribuable à tout compte actif (sauf stagiaire) ; elle ne se transmet pas en intérim. »
- Section « Catégories » : création avec les champs suivants, puis le bouton « Créer » :
  - « Code » (obligatoire, 2 à 10 lettres majuscules ou chiffres : il sert de préfixe au numéro d'inventaire) ;
  - « Libellé » (obligatoire, 2 à 120 caractères) ;
  - « Nature » (« Biens inventoriés » ou « Fournitures ») ;
  - case « Validation du chef ».
- Pour chaque catégorie : « Renommer », case « Validation du chef », « Désactiver » / « Réactiver ».

**Statuts et étapes**

Demandes :

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « À valider par le chef » | La catégorie exige l'accord du chef direct | Le chef direct : « Valider » ou « Refuser » |
| « À traiter » | La demande attend un gestionnaire | Un gestionnaire (autre que le demandeur) : « Prendre en charge » ou « Refuser » |
| « En traitement » | Un gestionnaire s'en occupe | Le gestionnaire : « Traiter » ou « Refuser » |
| « Traitée » | Fournitures remises ou intervention faite | Étape finale |
| « Refusée » | Refus motivé | Étape finale |
| « Annulée » | Annulée par le demandeur (avant la prise en charge) | Étape finale |

Le circuit (avec ou sans le chef) dépend du réglage « Validation du chef » de la catégorie au moment de l'envoi.

Réservations :

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « En attente » | Ressource à validation : le créneau vous est tenu | Un gestionnaire (autre que le titulaire) : « Valider » ou « Refuser » |
| « Confirmée » | Réservation acquise | Le titulaire ou un gestionnaire peut l'annuler avant le début |
| « Refusée » | Refus motivé par un gestionnaire | Étape finale |
| « Annulée » | Annulée par le titulaire, un gestionnaire, ou l'annulation de la réunion | Étape finale |
| « Annulée pour priorité » | Un supérieur hiérarchique a pris le créneau | Étape finale |

Biens : « En service », « En panne », « En réparation », « Réformé » (définitif). Le gestionnaire change l'état.

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Créer une demande, réserver | Tous sauf le stagiaire | « Cette fonctionnalité n’est pas accessible aux stagiaires. » |
| Valider une demande | Le chef direct du demandeur (à défaut DN, DNA), jamais sur sa propre demande | « Vous ne pouvez pas valider votre propre demande. » |
| Refuser une demande à l'étape chef | Le chef direct | « Vous ne pouvez pas statuer sur votre propre demande (annulez-la). » |
| Prendre en charge, traiter, refuser à l'étape gestionnaire | Gestionnaire logistique, autre que le demandeur | « Action réservée aux gestionnaires logistiques. » / « Vous ne pouvez pas traiter votre propre demande : un autre gestionnaire s’en charge. » |
| Annuler une demande | Le demandeur (statuts « À valider par le chef » ou « À traiter ») | « Seul le demandeur peut annuler sa demande. » |
| Voir une demande | Le demandeur, sa hiérarchie, DN, DNA, les gestionnaires une fois la demande transmise | « Cette demande est hors de votre périmètre. » |
| Créer, affecter, réformer un bien ; gérer articles et stock ; gérer les ressources | Gestionnaire logistique | « Action réservée aux gestionnaires logistiques. » |
| Signaler une panne | Toute personne qui voit le bien | « Le bien <n°> est réformé. » |
| Valider ou refuser une réservation | Gestionnaire logistique, jamais sur sa propre réservation | « Vous ne pouvez pas statuer sur votre propre réservation. » |
| Annuler une réservation | Le titulaire (avant le début, hors réunion) ; un gestionnaire, avec un motif | « L’annulation par un gestionnaire exige un motif. » |
| Faire valoir la priorité | Un supérieur hiérarchique du titulaire ; DN et DNA sur tous les autres, mais pas entre eux | « Priorité impossible : … » (voir les messages) |
| Habiliter un gestionnaire, gérer les catégories | Administrateur système | — |

L'habilitation « gestionnaire logistique » est personnelle. Elle ne passe jamais au suppléant pendant un intérim.

**Règles automatiques**
- **Notifications des demandes** :
  - « Demande logistique à valider » : au chef direct du demandeur (à défaut au DN et à la DNA) ;
  - « Demande logistique à traiter » : aux gestionnaires, sauf le demandeur ;
  - « Demande logistique refusée » et « Demande logistique traitée » : au demandeur.
- **Stock** : quand une demande de fournitures est traitée, la quantité remise sort automatiquement du stock (si le stock est suivi). Si le stock est insuffisant, rien n'est enregistré.
- **Stock bas** : quand un article passe sous son seuil d'alerte, les gestionnaires reçoivent une seule fois la notification « Stock bas ». L'alerte se réarme quand le stock remonte au-dessus du seuil.
- **Réservations** :
  - pas de chevauchement possible sur une même ressource ;
  - un créneau ne dépasse pas 7 jours et ne peut pas commencer dans le passé ;
  - une réservation faite en priorité est confirmée tout de suite.
- **Notifications des réservations** :
  - « Réservation à valider » : aux gestionnaires ;
  - « Réservation confirmée », « Réservation refusée », « Réservation annulée » : au titulaire ;
  - « Réservation annulée pour priorité » : au titulaire évincé, avec le nom et la fonction de la personne prioritaire.
- **Bien à récupérer** : chaque nuit vers 00 h 20, si le détenteur d'un bien n'a plus de compte actif, les gestionnaires sont prévenus une fois. Le bien reste affecté tant que personne n'enregistre le retour.

**Messages que vous pouvez voir**
- « Stock insuffisant pour « X » : n unité disponible(s), m demandé(s). » → Faites une « Entrée » de stock, ou remettez une quantité moindre.
- « La quantité remise ne peut pas dépasser la quantité demandée (n). » → Corrigez la quantité.
- « Une sortie de stock hors demande exige un motif. » → Remplissez le « Motif ».
- « Action impossible : la demande est « <statut> ». » → La demande n'est plus à cette étape ; rechargez la page.
- « Cette demande a changé d’état : rechargez-la. » → Quelqu'un a agi en même temps que vous ; rechargez la page.
- « L’article « X » n’est plus proposé. » → Choisissez un autre article.
- « Indiquez la quantité demandée. » → Remplissez « Quantité ».
- « La catégorie « X » est désactivée. » → Choisissez une autre catégorie, ou demandez à l'administrateur de la réactiver.
- « Le bien <n°> est réformé : il n’est plus modifiable. » → Le bien est sorti du parc ; il n'est plus modifiable.
- « La réforme d’un bien exige un motif. » → Saisissez le motif.
- « Affectez le bien à une personne OU à une unité. » → Choisissez l'un ou l'autre.
- « Un bien ne peut être affecté qu’à un compte actif. » → Choisissez une personne active.
- « Ce bien n’est affecté à personne. » → Aucun retour n'est à enregistrer.
- « Une section s’indique avec sa division. » → Choisissez d'abord la division.
- « « X » est déjà réservée sur ce créneau : <liste>. » → Choisissez un autre créneau ou une autre ressource. Si le message ajoute « Vous pouvez faire valoir la priorité hiérarchique. », utilisez « Faire valoir la priorité ».
- « Vous avez déjà réservé « X » sur ce créneau. » → Votre réservation existe déjà.
- « Priorité impossible : le DN et la DNA sont pairs pour la priorité, aucun ne prend le créneau de l’autre. » → Entendez-vous directement avec l'autre membre de la Direction.
- « Priorité impossible : <nom> n’est pas sous votre autorité hiérarchique. » → Choisissez un autre créneau.
- « La fin du créneau doit être après son début. » / « Un créneau ne peut pas dépasser 7 jours. » / « Le créneau est déjà commencé ou passé. » → Corrigez les heures.
- « La ressource « X » n’est plus réservable. » → Choisissez une autre ressource.
- « Le créneau a commencé : la réservation ne peut plus être annulée. » → L'annulation n'est plus possible une fois le créneau commencé.
- « Cette salle est réservée pour une réunion : annulez la réunion pour la libérer. » → Passez par le module « Réunions ».
- « Seule une réservation en attente peut être validée. » / « Seule une réservation en attente peut être refusée. » → La réservation a déjà été traitée.
- « Cette réservation a changé d’état : rechargez-la. » → Rechargez la page.
- « Une ressource « X » existe déjà. » → Choisissez un autre nom.
- « Seul un compte actif peut être habilité. » / « Un stagiaire n’a pas accès à la logistique : il ne peut pas être habilité. » / « Cette personne est déjà gestionnaire logistique. » → Messages de l'écran d'administration.
- « Le code : 2 à 10 lettres majuscules ou chiffres (préfixe du numéro d’inventaire). » / « Le code X est déjà utilisé. » → Corrigez le code de la catégorie.
- « Aucun gestionnaire : personne ne peut traiter les demandes. » → L'administrateur système doit habiliter au moins une personne.

**Captures**
- 09-logistique-01-accueil.png
- 09-logistique-02-reservations.png
- 09-logistique-04-administration.png
- 09-logistique-05-nouvelle-demande-fournitures.png
- 09-logistique-06-reserver.png
- 09-logistique-07-fournitures-stock.png
- 02-interface-12-menu-gestionnaire-logistique.png

---

### 3.21 Véhicules et carburant

**À quoi sert ce module**
Ce module tient le parc des véhicules de service. Le gestionnaire logistique y enregistre les pleins de carburant, en litres seulement, et le compteur kilométrique. Il affecte aussi un véhicule à un ordre de mission et enregistre son retour.

**Accès**
- Menu « Général » → « Logistique » → onglet « Véhicules ».
- Tous les profils sauf le stagiaire peuvent consulter le parc (véhicules en service ou non retirés).
- Seul le gestionnaire logistique peut modifier.

**Écran et onglets**
- Section « Parc de véhicules » : une ligne par véhicule, avec l'immatriculation, la marque, le modèle, l'énergie (« Gazole » ou « Essence ») et le kilométrage.
  - Badge d'état : « En service », « En panne », « En réparation », « Réformé ».
  - Badge « Retiré du parc » pour un véhicule retiré.
  - Si le parc est vide : « Aucun véhicule enregistré. »
- Section « Ordres de mission » (gestionnaire logistique seulement) :
  - texte d'aide : « Affectez un véhicule en service ; au retour, saisissez le kilométrage du compteur. » ;
  - la liste montre les missions en cours ou à venir (et celles revenues depuis moins de 30 jours), avec l'objet, la destination, l'agent et les dates ;
  - si la liste est vide : « Aucune mission en cours ou à venir. »
- Fiche d'un véhicule (clic sur une ligne) :
  - tuiles « Compteur », « Consommation » (en L/100 km) et « Carburant » (total des litres) ;
  - liste « État » (gestionnaire) ;
  - tableau « Pleins de carburant » (colonnes « Date », « Litres », « Compteur », « Mission »).

**Actions et formulaires**
- « + Nouveau véhicule » → fenêtre « Nouveau véhicule » :

  | Champ | Obligatoire ? | Limites |
  |---|---|---|
  | « Immatriculation » | obligatoire | 4 à 15 caractères : majuscules, chiffres, tirets, espaces ; mise en majuscules automatiquement ; unique |
  | « Marque » | obligatoire | 2 à 60 caractères |
  | « Modèle » | obligatoire | 1 à 60 caractères |
  | « Énergie » | obligatoire | « Gazole » ou « Essence » |
  | « Kilométrage du compteur » | obligatoire | 0 à 2 000 000 |

  Bouton « Ajouter le véhicule ».
- Dans la fiche, la liste « État » change l'état du véhicule immédiatement.
- Formulaire de plein, en bas de la fiche :

  | Champ | Obligatoire ? | Limites |
  |---|---|---|
  | « Date » | obligatoire | pas dans le futur ; aujourd'hui par défaut |
  | « Litres » | obligatoire | 0,5 à 500, deux décimales au plus |
  | « Mission (facultatif) » | facultatif | une mission de ce véhicule |
  | « Compteur » | obligatoire | supérieur ou égal au compteur actuel |

  - Bouton « Ajouter le plein ».
  - **Aucun montant** n'est saisi : le carburant se compte en litres seulement.
- Section « Ordres de mission » :
  - la liste déroulante de la mission (« — Sans véhicule — » ou une immatriculation) affecte le véhicule immédiatement ; seuls les véhicules « En service » sont proposés ;
  - « Enregistrer le retour » → fenêtre « Retour de mission — <objet> » : rappel « Kilométrage au départ : n km », champ « Kilométrage au retour » (obligatoire), bouton « Enregistrer le retour ».

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| Véhicule « En service » | Utilisable pour une mission | Le gestionnaire logistique (liste « État ») |
| « En panne » / « En réparation » | Non affectable à une mission | Le gestionnaire logistique remet « En service » |
| « Réformé » | Sorti du parc | — |
| Mission sans véhicule (« — Sans véhicule — ») | Aucun véhicule choisi | Le gestionnaire choisit un véhicule |
| Mission avec véhicule | Kilométrage de départ = compteur du véhicule | Le gestionnaire : « Enregistrer le retour » |
| « Retour enregistré » | Kilomètres parcourus affichés | Étape finale |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Consulter le parc | Tous sauf le stagiaire | « Cette fonctionnalité n’est pas accessible aux stagiaires. » |
| Ajouter un véhicule, changer son état, saisir un plein | Gestionnaire logistique | « Action réservée aux gestionnaires logistiques. » |
| Affecter un véhicule à une mission, enregistrer le retour | Gestionnaire logistique | « Action réservée aux gestionnaires logistiques. » |

**Règles automatiques**
- Le compteur kilométrique ne recule jamais. Deux pleins saisis en même temps ne peuvent pas le faire reculer.
- Un plein met à jour le compteur du véhicule. Un retour de mission l'avance s'il est plus élevé.
- La consommation se calcule entre le premier et le dernier plein.
- Un véhicule ne peut pas servir à deux missions dont les dates se chevauchent.
- Le document signé de l'ordre de mission n'est pas modifié par l'affectation du véhicule.
- Aucune notification n'est envoyée par ce module (à confirmer).

**Messages que vous pouvez voir**
- « Immatriculation : 4 à 15 caractères (lettres majuscules, chiffres, tirets, espaces). » → Corrigez l'immatriculation.
- « Un véhicule porte déjà cette immatriculation. » → Le véhicule existe déjà dans le parc.
- « La date du plein ne peut pas être dans le futur. » → Corrigez la date.
- « Le compteur ne recule pas : n km déjà enregistrés pour ce véhicule. » → Saisissez un kilométrage au moins égal à n.
- « Cet ordre de mission n’utilise pas ce véhicule. » → Laissez « Mission » vide, ou affectez d'abord ce véhicule à la mission.
- « Véhicule introuvable ou retiré du parc. » → Choisissez un véhicule actif.
- « Cet ordre de mission est annulé. » → L'affectation n'est plus possible.
- « Le retour de cette mission est déjà enregistré. » → Aucune action n'est nécessaire.
- « Ce véhicule n’est pas en service (panne, réparation ou réforme). » → Remettez l'état « En service », ou choisissez un autre véhicule.
- « Ce véhicule est déjà affecté à la mission « X » sur ces dates. » → Choisissez un autre véhicule, ou enregistrez d'abord le retour de la mission « X ».
- « Aucun véhicule n’est affecté à cette mission. » → Choisissez d'abord un véhicule.
- « Le kilométrage au retour ne peut pas être inférieur à celui du départ (n km). » → Corrigez le kilométrage.

**Captures**
- 09-logistique-03-vehicules.png
- 09-logistique-08-fiche-vehicule-pleins.png
- 06-documents-05-ordre-de-mission.png

---

### 3.22 Organisation

**À quoi sert ce module**
Ce module présente l'organigramme de la DNPEC : divisions, sections, cellules et instances, avec leur responsable et leur effectif. Le DRH et l'administrateur système y créent, renomment et ferment les unités. L'administrateur y gère aussi les divisions, sections et cellules et nomme ou retire les chefs de cellule.

**Accès**
- Menu « Personnel » → « Organisation » : tous les profils.
- Le stagiaire peut consulter les divisions, sections et cellules (à confirmer pour l'affichage de l'entrée dans son menu, qui ne la contient pas).

**Écran et onglets**

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Organigramme » | tous | arbre des unités, responsable, effectif ; actions de gestion pour le DRH et l'administrateur |
| « Divisions & Sections » | administrateur système | divisions et leurs sections |
| « Cellules » | administrateur système | « Cellules transversales » et leur chef |

- Texte affiché dans l'organigramme :
  - à qui peut gérer : « Créez une division, une section, une cellule ou une instance, renommez-la ou fermez-la. Une unité ne se ferme que lorsqu’aucun agent n’y est plus rattaché ; son historique reste consultable. »
  - aux autres : « Unités de la DNPEC, avec leur responsable et leur effectif. »
- Mentions possibles sur une unité : « SUSPENDUE », « Pas de responsable désigné ».

**Actions et formulaires**
- Organigramme (DRH, administrateur) :
  - « + Sous-unité » → fenêtre « Nouvelle unité sous X » :
    - « Type » ;
    - « Code » (obligatoire, 20 caractères au plus ; « Lettres majuscules, chiffres ou tirets (ex. SGOP, CSID). ») ;
    - « Libellé » (obligatoire, 150 caractères au plus) ;
    - bouton « Créer l’unité ».
  - « Modifier » : « Code », « Libellé », et « Type » pour passer de cellule à instance ou l'inverse.
  - « Fermer » : « Motif de la fermeture » (obligatoire), bouton « Fermer l’unité ».
  - « Historique » (tous) : les changements de l'unité et leur auteur.
- « Divisions & Sections » (administrateur) :
  - « + Nouvelle division » → fenêtre :
    - « Code » (obligatoire, 10 caractères au plus, « 2 à 10 lettres majuscules, ex. DPE ») ;
    - « Nom complet » (obligatoire) ;
    - bouton « Enregistrer ».
  - Par division : « Modifier », « Suspendre » / « Réactiver », « Supprimer ». Le message de confirmation est « Supprimer la division "X" ? ».
  - Division dépliée : « + Section » (code « 2 à 10 caractères, ex. SSR »), puis les mêmes actions par section.
- « Cellules » (administrateur) :
  - « + Nouvelle cellule » (code « 2 à 10 lettres majuscules, ex. CSID ») ;
  - par cellule : « Retirer le chef », « Modifier », « Suspendre » / « Réactiver », « Supprimer ». La ligne indique « chef : X » ou « sans chef ».
- **Nommer un chef de cellule** : depuis « Utilisateurs », bouton « Nommer chef de cellule » sur un chargé d'études ou un chef de cellule. Fenêtre « Nommer chef de cellule » :
  - « Cellule » (obligatoire ; les cellules suspendues ne sont pas proposées) ;
  - « Motif (obligatoire) » (5 à 1000 caractères) ;
  - bouton « Nommer chef ».
  - Mention affichée : « Tracé dans l’historique ; la personne devra se reconnecter. »
- **Retirer le chef** → fenêtre « Retirer le chef » :
  - texte « X quitte la direction de <cellule> et reste dans la cellule avec le rôle choisi. » ;
  - « Nouveau rôle » : « Agent / Chargé d’Études » (par défaut), « Directeur des Ressources Humaines » ou « Administrateur Système » ;
  - « Motif (obligatoire) » (5 à 1000 caractères) ;
  - bouton « Retirer le chef ».

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| Unité active | Rattachements possibles | Administrateur : « Suspendre » ; DRH ou administrateur : « Fermer » |
| « Suspendue » | Les personnes déjà rattachées gardent tout ; aucun nouveau rattachement possible | Administrateur : « Réactiver » |
| Unité fermée | Plus modifiable ; historique conservé | Étape finale |
| Supprimée | Seulement si l'unité est vide (ni sections, ni comptes, ni tâches) | — |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Consulter l'organigramme | Tous | — |
| Créer, modifier, fermer une unité de l'organigramme | DRH, administrateur système (pas en intérim) | « Votre rôle ne permet pas cette action. » (à confirmer) |
| Créer, suspendre, supprimer une division, une section, une cellule | Administrateur système | L'onglet n'est pas affiché |
| Nommer ou retirer un chef de cellule | Administrateur système, en son nom propre | « Un changement de rôle se fait en votre nom propre, jamais en intérim. » |

**Règles automatiques**
- Nommer ou retirer un chef de cellule est un changement de rôle, décrit au module 3.23. Il entraîne la fermeture des sessions de la personne, la notification « Votre rôle a changé » et la notification des DRH.
- Un chef n'est jamais rétrogradé automatiquement : il faut d'abord changer le rôle de l'actuel chef.

**Messages que vous pouvez voir**
- « Cette Division contient encore n Section(s) — supprimez-les d’abord. » → Supprimez d'abord les sections.
- « Cette Division a encore n utilisateur(s) rattaché(s) — impossible à supprimer. » (même message pour une section ou une cellule) → Rattachez ces comptes ailleurs, ou suspendez l'unité.
- « Cette Division a encore n tâche(s) rattachée(s) — impossible à supprimer. » → Utilisez « Suspendre ».
- « Ce code de division existe déjà » / « Ce code de section existe déjà dans cette division » / « Ce code de cellule existe déjà » → Choisissez un autre code.
- « La division "X" est suspendue — aucun nouveau rattachement n'y est possible tant qu'elle n'est pas réactivée. » → Réactivez l'unité ou choisissez-en une autre.
- « Fermeture impossible : n sous-unité(s) encore ouverte(s). » → Fermez d'abord les sous-unités.
- « Fermeture impossible : n agent(s) encore rattaché(s). Mutez-les d’abord. » → Mutez d'abord les agents.
- « La date de fermeture ne peut pas être dans le futur. » → Corrigez la date.
- « La Direction ne se ferme pas. » / « La Direction ne se modifie pas ici. » → Normal : la Direction ne se ferme pas et ne se modifie pas ici.
- « Une unité fermée ne se modifie plus. » / « Cette unité est déjà fermée. » → Normal : une unité fermée ne se modifie plus.
- « Seul le passage Cellule ⇄ Instance est possible. » → Seul ce changement de type est permis.
- « Ce code est déjà utilisé sous cette unité. » → Choisissez un autre code.
- « Cette cellule a déjà un chef : changez d’abord son rôle (il n’est jamais rétrogradé automatiquement). » → Retirez d'abord le chef actuel.
- « Un DN, une DNA ou un Chef de Division ne se nomme pas chef de cellule : changez d’abord son rôle. » → Passez par « Changer de rôle ».
- « Cette cellule n’a pas de chef. » → Il n'y a aucun chef à retirer.

**Captures**
- 11-admin-04-organisation.png

---

### 3.23 Utilisateurs (création, inscriptions, suspension, changement de rôle, rôles fonctionnels, onglet « Nominations »)

**À quoi sert ce module**
Ce module gère les comptes de connexion. L'administrateur système y crée les comptes, approuve ou rejette les inscriptions, suspend ou désactive un compte et change le rôle d'une personne. Il y attribue aussi les rôles fonctionnels et applique les droits issus d'un acte de nomination. Le DN et la DNA y consultent la liste des comptes.

**Accès**
- Menu « Administration » → « Utilisateurs ».
- Visible pour l'administrateur système (gestion complète), le DN et la DNA (lecture de la liste seulement).
- Un autre profil qui ouvre l'adresse voit : « Accès non autorisé — Cette page est réservée à l’Administrateur Système et à la Direction. »

**Écran et onglets**

| Onglet | Qui le voit | Contenu |
|---|---|---|
| « Tous les comptes » | administrateur ; DN et DNA voient seulement cette liste | colonnes « Nom », « Email », « Rôle », « Rattachement », « Statut » ; bouton « + Nouveau compte » |
| « Inscriptions en attente » (pastille rouge avec le nombre) | administrateur | une carte par demande d'accès |
| « Rôles fonctionnels » | administrateur | attributions datées des rôles fonctionnels |
| « Nominations » | administrateur | nominations à appliquer, écarts fonction / rôle, nominations traitées |

- Statuts d'un compte : « Actif », « Suspendu », « Désactivé », « En attente ».
- Rôles affichés :
  - « Directeur National » ;
  - « Directeur National Adjoint » ;
  - « Chef de Division » ;
  - « Chef de Section » ;
  - « Chef de Cellule » ;
  - « Agent / Chargé d’Études » ;
  - « Administrateur Système » ;
  - « Assistant(e) de Direction » ;
  - « Directeur des Ressources Humaines » ;
  - « Stagiaire ».
- Boutons de chaque ligne (administrateur) :
  - « Nommer chef de cellule » (chargé d'études ou chef de cellule) ;
  - « Changer de rôle » (compte actif) ;
  - « Gérer ».

**Actions et formulaires**
- « + Nouveau compte » → fenêtre « Nouveau compte » :

  | Champ | Obligatoire ? | Limites |
  |---|---|---|
  | « Agent (dossier RH) » | facultatif | un agent sans compte, ou « Nouvel agent, créé avec ce compte » |
  | « Matricule du nouvel agent (facultatif) » | facultatif | « Sinon un matricule provisoire est attribué » |
  | « Adresse e-mail » | obligatoire | unique |
  | « Prénom », « Nom » | obligatoires | — |
  | « Mot de passe » | obligatoire | « 8 caractères minimum. » (longueur réglée dans le paramétrage) |
  | « Rôle » | obligatoire | tous les rôles sauf chef de cellule (qui se nomme à part) |
  | « Division », « Section », « Cellule », « Personne assistée » | selon le rôle (marqués *) | voir les rattachements ci-dessous |

  - Mention : « La personne recevra un email avec son rôle, son unité et un lien pour choisir son propre mot de passe (valable 7 jours). »
  - Bouton « Créer le compte ».
- Rattachement exigé par rôle :
  - DN, DNA : aucun rattachement.
  - Chef de division : une division.
  - Chef de section : une division et une de ses sections.
  - Chef de cellule : une cellule.
  - Chargé d'études : une division (section facultative) ou une cellule.
  - Assistant(e) de direction : une « Personne assistée » (DN, DNA ou chef de cellule).
  - DRH et administrateur système : cellule facultative.
  - Stagiaire : rattachement facultatif.
- « Gérer » → fenêtre « Gérer ce compte » :
  - « Statut du compte » :
    - « Suspendre » : confirmation « Confirmer : suspendre le compte de X ? » ;
    - « Désactiver » : confirmation « … Le compte ne pourra plus se connecter, mais rien de ce qui lui est lié (tâches, messages, historique) ne sera supprimé ni réattribué. » ;
    - « Réactiver ».
  - « Mot de passe » :
    - « Envoyer un lien de réinitialisation par email » (compte actif seulement) ;
    - « Définir un mot de passe temporaire » (obligatoire, 8 caractères minimum, « À communiquer vous-même à la personne concernée. »), puis « Définir ce mot de passe ».
  - « Double authentification » : « Réinitialiser la double authentification ». L'aide dit : « Si la personne a perdu ou changé de téléphone. Ses sessions sont fermées ; elle pourra la réactiver ensuite. »
- « Inscriptions en attente » : chaque carte montre le nom, l'email, « Inscrit le … », « Poste déclaré : … » et « Souhaite : … ».
  - « Approuver » → fenêtre « Approuver l’inscription » :
    - rappel « Poste déclaré à l’inscription » et « Rattachement déclaré » ;
    - « Rôle attribué » (obligatoire, pré-sélectionné) ;
    - rattachement ;
    - « Agent (dossier RH) » ;
    - mention « La personne recevra un email avec son rôle, son unité et un bouton « Se connecter ». » ;
    - bouton « Approuver ».
  - « Rejeter » → fenêtre « Rejeter l’inscription » :
    - texte « La demande est supprimée. La personne reçoit un email lui indiquant qu’elle n’a pas été retenue et qu’elle peut en refaire une. » ;
    - « Motif (facultatif, repris dans l’email) » (500 caractères au plus) ;
    - bouton « Rejeter la demande ».
- « Changer de rôle » → fenêtre « Changer de rôle », en deux temps.
  1. Saisie :
     - « Nouveau rôle » (obligatoire) ;
     - rattachement exigé ;
     - « Intitulé du poste (facultatif) » (200 caractères au plus) ;
     - « Motif (obligatoire) » (5 à 1000 caractères ; « Conservé dans le journal d’audit ; il n’apparaît pas dans les notifications. ») ;
     - bouton « Voir les effets ».
  2. Aperçu : « ancien rôle (unité) → nouveau rôle (unité) », puis les rubriques suivantes :
     - « Suppléances révoquées (plus conformes au rang) » ;
     - « Suppléances conservées » ;
     - « Accès délégués au courrier révoqués » ;
     - « Circuits de visa à recalculer (rédacteurs prévenus) » ;
     - « Conservé — à vérifier » (habilitations courrier, imputations, tâches en cours) ;
     - « Chef de cellule ».
     - Mention finale : « Toutes ses sessions seront fermées (n actives) ; la personne et les DRH sont prévenus. Changement immédiat, tracé dans l’historique de carrière. »
     - Boutons « Modifier » (retour à la saisie) et « Confirmer le changement ».
- « Rôles fonctionnels » : case « Rôles en cours seulement », bouton « + Attribuer un rôle ». Colonnes « Personne », « Rôle », « Période », « Attribué par » ; badges « RETIRÉ », « HORS PÉRIODE » ; mention « géré dans son module ».
  - Fenêtre « Attribuer un rôle fonctionnel » :
    - « Personne » (obligatoire) ;
    - « Rôle » (obligatoire) : Directeur des Ressources Humaines, Gestionnaire RH, Chef du SAF, Gestionnaire paie, Encadreur de stage, Assistant(e) de direction, Validateur ;
    - « Début (facultatif) », « Fin (facultative) » ;
    - « Motif (facultatif) » (exemple affiché : « Ex. note de service n°… ») ;
    - bouton « Attribuer ».
  - « Retirer » → fenêtre « Retirer « X » à Y » : « Le retrait prend effet immédiatement ; l’attribution reste dans l’historique. », « Motif du retrait » (obligatoire), bouton « Retirer le rôle ».
  - Un rôle fonctionnel donne une capacité, jamais une visibilité plus large. Il ne passe jamais au suppléant en intérim. Agent du courrier et gestionnaire logistique s'attribuent depuis les modules Courrier et Logistique.
- « Nominations » : texte « Un acte de nomination signé à un poste de responsabilité met à jour la fonction du dossier ; le rôle et l’unité du compte ne changent qu’après votre confirmation, le jour même. Motif enregistré : le numéro de l’acte. »
  - « Nominations à appliquer » (vide : « Aucune nomination en attente. ») : agent → poste, « Acte n° … · effet le … », rôle actuel, et l'une des mentions suivantes :
    - « Actuel titulaire : X → <rôle proposé> » ;
    - « rôle à choisir » ;
    - « Poste vacant : aucun titulaire à déplacer. »
    - Si une tentative précédente a échoué : « Dernière tentative : … ».
    - Boutons « Confirmer… » et « Refuser… ».
  - « Confirmer… » → fenêtre « Confirmer la nomination » :
    - texte « X devient <poste> (acte n° …). Ses sessions sont fermées ; il ou elle se reconnecte avec ses nouveaux droits. » ;
    - bloc « Nouveau rôle de <actuel titulaire> » : « Rôle » (obligatoire), « Division », « Section », « Cellule » ; « Son rôle change d’abord (le poste est libéré), avec le même motif. » ;
    - « Précision (facultative, ajoutée au motif « Acte de nomination n° … ») » (500 caractères au plus) ;
    - bouton « Appliquer les droits ».
  - « Refuser… » → fenêtre « Refuser la nomination » : motif obligatoire (5 caractères au moins), bouton « Refuser ».
  - « Écarts entre fonction du dossier et rôle du compte » : « Relevés à chaque ouverture, signalés chaque matin aux administrateurs et dans la supervision. » Si tout concorde : « Aucun écart : fonctions et rôles concordent. »
  - « Nominations traitées » : badges « Droits appliqués » ou « Refusé ».

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « En attente » (compte) | Inscription à examiner | Administrateur : « Approuver » (→ Actif) ou « Rejeter » (demande supprimée) |
| « Actif » | Peut se connecter | Administrateur : « Suspendre » ou « Désactiver » |
| « Suspendu » | Connexion bloquée, sessions fermées | Administrateur : « Réactiver » ou « Désactiver » |
| « Désactivé » | Connexion bloquée ; rien n'est supprimé | Administrateur : « Réactiver » |
| Nomination « En attente » | Acte signé, droits non encore appliqués | Administrateur : « Confirmer… » ou « Refuser… » |
| « Droits appliqués » / « Refusé » | Nomination traitée | Étape finale |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Voir la liste des comptes | Administrateur système, DN, DNA | « Accès non autorisé » |
| Créer, approuver, rejeter, suspendre, désactiver, réactiver | Administrateur système | — |
| Changer le rôle d'un compte | Administrateur système, en son nom propre, jamais sur lui-même | « Seul l’administrateur système change le rôle d’un compte. » / « Un changement de rôle se fait en votre nom propre, jamais en intérim. » / « Vous ne pouvez pas changer votre propre rôle. » |
| Attribuer ou retirer un rôle fonctionnel | Administrateur système | « Seul l’administrateur attribue les rôles fonctionnels. » / « Seul l’administrateur retire les rôles fonctionnels. » |
| Appliquer ou refuser une nomination | Administrateur système, en son nom propre | « Seul l’administrateur système applique les droits d’une nomination. » / « Une nomination s’applique en votre nom propre, jamais en intérim. » |

**Règles automatiques**
- **Création d'un compte** : la personne reçoit un email avec un lien pour choisir son mot de passe, valable 7 jours.
- **Approbation** : la personne reçoit un email avec son rôle, son unité et un bouton « Se connecter ».
- **Rejet** : la personne reçoit un email ; le motif n'y figure que s'il a été saisi.
- **Suspension ou désactivation** : toutes les sessions du compte sont fermées.
- **Changement de rôle** :
  - les sessions sont fermées ;
  - la personne reçoit « Votre rôle a changé » ;
  - les DRH reçoivent « Changement de rôle d’un agent » ;
  - les suppléances devenues non conformes sont révoquées (notification « Suppléance révoquée ») ;
  - les rédacteurs dont le circuit de visa change reçoivent « Circuit de visa à recalculer ».
- **Nomination** : après la signature d'un acte de nomination, l'administrateur reçoit « Nomination à appliquer ». En cas de refus, le DRH est informé.
- **Écarts fonction / rôle** : chaque matin à 6 h 40, les écarts entre la fonction du dossier et le rôle du compte sont signalés aux administrateurs (bouton « Voir les écarts »).

**Messages que vous pouvez voir**
- « Un compte existe déjà avec cet email » → Utilisez le compte existant.
- « Cet agent a déjà un compte. » / « Seul un agent en activité peut recevoir un compte. » / « Ce matricule est déjà attribué : choisissez l’agent existant. » → Choisissez le bon agent dans « Agent (dossier RH) ».
- « Le mot de passe doit contenir au moins n caractères. » → Allongez le mot de passe.
- « Ce compte n'est pas en attente de validation. » → L'inscription a déjà été traitée ; rechargez la page.
- « Il y a déjà un DN actif : X. Changez d'abord son rôle. » (même message pour la DNA) → Changez d'abord le rôle de l'actuel titulaire.
- « Cette division a déjà un Chef de Division actif : X. Retirez-le d'abord ou choisissez un autre rôle. » (même message pour une section) → Changez d'abord le rôle de l'actuel chef.
- « Cette cellule a déjà un Chef de Cellule : X. Changez d'abord son rôle. » → Retirez d'abord le chef actuel.
- « Un Chef de Division est rattaché à une Division. » (et les messages équivalents pour les autres rôles) → Complétez le rattachement.
- « Un utilisateur ne peut pas être rattaché à la fois à une Division et à une Cellule. » → Choisissez l'un ou l'autre.
- « Le superviseur doit être un DN, une DNA ou un Chef de Cellule. » → Choisissez une autre « Personne assistée ».
- « Seul un compte actif change de rôle (une inscription en attente se traite par l’approbation). » → Approuvez d'abord l'inscription, ou réactivez le compte.
- « Le rôle de ce compte a changé entre-temps (il est maintenant X) : recommencez. » → Fermez la fenêtre et recommencez.
- « Aucun changement : ce compte a déjà ce rôle et ce rattachement. » → Rien n'est à modifier.
- « Ce stagiaire a un stage prévu ou en cours : clôturez-le ou interrompez-le d’abord. » → Le DRH doit d'abord clore le stage.
- « C’est le dernier administrateur système actif : nommez-en un autre avant de retirer ce rôle. » → Nommez d'abord un second administrateur.
- « Réaffectez d’abord l’assistant(e) de ce compte (…) : … » → Changez d'abord le rattachement des assistant(e)s.
- « Ce compte a été modifié entre-temps : recommencez depuis l’aperçu. » / « Ce poste (X) vient d’être pourvu par ailleurs. » → Recommencez depuis le début.
- « Ce compte n’est rattaché à aucun agent. » → Le compte doit d'abord être rattaché à un agent (écran « Agents » du DRH).
- « Un stagiaire ne reçoit aucun rôle fonctionnel. » / « Seul un compte actif peut recevoir un rôle. » → Ces comptes ne peuvent pas recevoir de rôle fonctionnel.
- « Cette personne détient déjà ce rôle sur cette période. » → Changez les dates.
- « La date de fin doit suivre la date de début. » → Corrigez les dates.
- « Ce rôle n’est pas encore utilisé par la plateforme. » → Choisissez un autre rôle.
- « Le rôle Agent du courrier s’attribue par registre et par unité, depuis Courrier → Habilitations. » / « Le rôle Gestionnaire logistique s’attribue depuis Logistique → Gestionnaires logistiques. » → Utilisez l'écran du module indiqué.
- « Ce rôle se retire depuis l’écran de son module. » / « Ce rôle a déjà été retiré. » → Utilisez l'écran du module ; aucune action n'est nécessaire si le rôle est déjà retiré.
- « Cette nomination a déjà été traitée (droits appliqués ou refusés). » / « Cette nomination vient d’être traitée : rechargez. » → Rechargez la page.
- « Le compte nommé n’est plus actif : refusez la nomination avec un motif. » → Utilisez « Refuser… ».
- « Choisissez le nouveau rôle de X (…) : aucun rôle n’est proposé d’office pour la Direction. » → Remplissez « Rôle » dans le bloc de l'actuel titulaire.
- « Le compte doit être actif pour recevoir ce lien. » → Réactivez d'abord le compte, ou définissez un mot de passe temporaire.

**Captures**
- 11-admin-01-utilisateurs.png
- 11-admin-02-nominations.png
- 11-admin-03-confirmer-nomination.png
- 11-admin-10-changer-de-role.png
- 02-interface-09-menu-administrateur.png

---

### 3.24 Paramétrage et supervision

**À quoi sert ce module**
Ce module sert à régler six paramètres de fonctionnement, chacun dans des limites fixées par l'application. Il permet aussi de surveiller l'état de l'application : services, tâches automatiques, sessions, comptes à surveiller, accès refusés et sauvegardes.

**Accès**
- Menu « Administration » → « Paramétrage et supervision ».
- Visible pour l'administrateur système, le DN et la DNA.
- Seul l'administrateur système, en son nom propre (pas en intérim), peut modifier. Le DN et la DNA consultent.
- Le lien des alertes ouvre directement l'onglet « Supervision ».

**Écran et onglets**
- Onglet « Paramètres » : une carte par paramètre, avec la valeur, l'unité, l'effet, et la ligne « Bornes : min à max · défaut · référence · modifié le … par … ». Le texte d'introduction est : « Chaque valeur reste dans ses bornes, s’applique aussitôt au circuit concerné et chaque modification est tracée au journal d’audit. »
- Onglet « Supervision » : état général, 9 services, cartes « Sessions ouvertes », « Connexions (24 h) », « Sauvegardes », puis les tableaux « Tâches planifiées », « Comptes à surveiller (n) » et « Accès refusés ».

Les six paramètres :

| Paramètre | Unité | Défaut | Bornes | Effet |
|---|---|---|---|---|
| « Longueur minimale du mot de passe » | caractères | 8 | 8 à 32 | Demande d’accès, mot de passe choisi ou réinitialisé, mot de passe temporaire. |
| « Conservation des journaux de connexion » | mois | 12 | 6 à 36 | Purge quotidienne des connexions plus anciennes. |
| « Expiration de la session après inactivité » | jours | 30 | 1 à 90 | Au-delà, il faut se reconnecter. |
| « Délai d’avis du chef sur une demande de congé » | heures ouvrées | 48 | 12 à 120 | Passé ce délai, l’avis est réputé favorable et la demande va au DRH ; alerte au chef 12 heures ouvrées avant. |
| « Ancienneté dans l’échelon avant un avancement à instruire » | mois | 24 | 12 à 60 | Alerte « avancement d’échelon à instruire » au DRH. |
| « Alerte avant une fin de stage ou de contrat » | jours | 15 | 5 à 60 | Première alerte au DRH ; le rappel reste à 3 jours. |

Les 9 services surveillés :

| Service | Dégradé quand… | Indisponible quand… |
|---|---|---|
| « Base de données » | réponse en plus d'une seconde | « Base injoignable » |
| « Stockage des fichiers » | relecture du fichier témoin incorrecte | écriture impossible |
| « Envoi des emails » | serveur d'envoi non configuré, ou dernier envoi en erreur | — |
| « Quota journalier d’emails » | 80 % du quota atteint (« quota bientôt atteint ») | quota atteint (« les emails reprendront demain ») |
| « Tâches planifiées » | une tâche en échec ou en retard | — |
| « Journal d’audit » | entrées non scellées depuis plus de 10 minutes, ou dernière vérification complète de plus de 26 heures | chaîne rompue (« le journal a été altéré ») |
| « Espace disque des fichiers » | 80 % utilisés | 95 % utilisés |
| « Taille de la base » | 80 % de la taille prévue | 95 % |
| « Fonction et rôle des comptes » | écarts entre la fonction du dossier et le rôle du compte (« Utilisateurs → Nominations ») | — |

États affichés : « NOMINAL », « DÉGRADÉ », « INDISPONIBLE ». L'« État général » prend le plus mauvais état des 9 services.

**Actions et formulaires**
- « Modifier » (administrateur) sur un paramètre → fenêtre au nom du paramètre : champ « Valeur (min à max unité) » (obligatoire, nombre entier), rappel de l'effet, bouton « Enregistrer ».
- « Actualiser » : produit un nouveau relevé de la supervision.
- « Déclarer un test de restauration » (administrateur) → fenêtre « Test de restauration » :
  - « Date du test » (obligatoire, pas dans le futur) ;
  - « Résultat » (« Réussi » ou « Échec ») ;
  - « Commentaire (facultatif) » ;
  - bouton « Déclarer ».
- « Télécharger les fichiers (ZIP) » (administrateur, carte « Sauvegardes », rubrique « Fichiers déposés (disque séparé de la base) ») :
  - votre mot de passe vous est redemandé ;
  - l'archive est à ranger avec l'export de la base du même jour ;
  - pendant la préparation, le bouton affiche « Préparation de l’archive… ».
- « Accès refusés » : choix « Période » (« 24 heures », « 7 jours », « 30 jours »).
  - Le comptage se fait par motif : « Objet protégé », « Compte externe », « Hors périmètre », « Rôle insuffisant », « Autre refus ».
  - Les 30 derniers refus sont listés avec la date, le compte, l'adresse demandée, le motif et l'explication. Le contenu demandé n'est jamais montré.
- « Comptes à surveiller » : seulement le nom, l'email et le motif.
  - « Inscription en attente depuis plus de 7 jours » ;
  - « Compte actif jamais utilisé (plus de 7 jours) » ;
  - « Aucune connexion depuis 90 jours » ;
  - « Compte suspendu ».
  - Sous-partie « Fins de stage ou de contrat proches », avec la mention « (confirmée) » le cas échéant.

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| Tâche « RÉUSSIE » | Dernière exécution sans erreur | Automatique |
| Tâche « ÉCHEC » | Dernière exécution en erreur (« n échec(s) en 24 h ») | Automatique : l'exécution suivante reprend |
| Tâche « EN COURS » | Exécution en cours | Automatique |
| « Pas encore exécutée » | Aucune exécution enregistrée | Automatique |
| Test de restauration en retard | Aucun test, ou dernier test de plus de 6 mois : « Un test tous les 6 mois est recommandé. » | Administrateur : « Déclarer un test de restauration » |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Consulter les paramètres et la supervision | Administrateur système, DN, DNA | « Votre rôle ne permet pas cette action. » |
| Modifier un paramètre | Administrateur système (pas en intérim) | « Votre rôle ne permet pas cette action. » |
| Déclarer un test de restauration | Administrateur système (pas en intérim) | « Votre rôle ne permet pas cette action. » |
| Télécharger l'archive des fichiers | Administrateur système, après confirmation du mot de passe | « Votre rôle ne permet pas cette action. » |

**Règles automatiques**
- Toutes les 10 minutes, l'application contrôle les 9 services. Quand un service passe à « Dégradé » ou « Indisponible », les administrateurs actifs reçoivent une seule fois, par notification et par email urgent, « Supervision : service en difficulté » (bouton « Voir la supervision »). Le service « Fonction et rôle des comptes » a son propre signalement, chaque matin.
- Chaque nuit à 2 h 30, le journal d'audit est vérifié en entier.
- La liste complète des tâches automatiques figure à l'Annexe A.
- Chaque modification d'un paramètre ou d'un test de restauration est inscrite au journal d'audit.
- Les sauvegardes de la base sont quotidiennes et faites par l'hébergeur. Le texte affiché est : « Sauvegardes quotidiennes automatiques de la base par l’hébergeur (Render), conservées selon l’offre souscrite ; sauvegarde manuelle avant chaque mise à jour (guide d’exploitation, § 2). »

**Messages que vous pouvez voir**
- « <paramètre> : valeur entière entre min et max unité. » → Saisissez une valeur entière dans les bornes.
- « La date du test ne peut pas être dans le futur. » → Corrigez la date.
- « Un test tous les 6 mois est recommandé. » → Faites un essai de restauration, puis déclarez-le.
- « Aucun test de restauration déclaré. » → Déclarez le premier test.
- « Serveur d’envoi non configuré : aucun email ne part » → Prévenez le responsable de l'exploitation.
- « … quota atteint, les emails reprendront demain » → Attendez le lendemain ; les notifications restent visibles dans la cloche.
- « En échec : <tâches> » / « En retard : <tâches> » → Consultez le tableau « Tâches planifiées ».
- « Chaîne rompue à l’entrée n° … : le journal a été altéré » → Prévenez immédiatement le responsable de l'exploitation.
- « n entrée(s) non scellée(s) depuis plus de 10 minutes » → Surveillez le service ; la tâche de scellement reprend toute seule.
- « Aucune vérification complète enregistrée (elle a lieu chaque nuit) » → Attendez la nuit, ou lancez « Vérifier l’intégrité » (module 3.25).

**Captures**
- 11-admin-05-parametrage.png
- 11-admin-06-supervision.png

---

### 3.25 Journal d'audit

**À quoi sert ce module**
Le journal d'audit trace qui a fait quoi, quand, et sur quel type d'élément, sans jamais en montrer le contenu. Il est en écriture seule : personne, pas même l'administrateur, ne peut le modifier ni l'effacer. Les entrées sont scellées et chaînées entre elles, ce qui permet de détecter toute altération.

**Accès**
- DN, DNA, administrateur système : menu « Administration » → « Journal d’audit ».
- Tous les autres profils, sauf le stagiaire : menu « Personnel » → « Journal d’audit ».

**Écran et onglets**
- L'écran n'a pas d'onglets. Il affiche « Portée : … » :

  | Portée affichée | Pour qui |
  |---|---|
  | « Toute la Direction » | DN, DNA, administrateur système (pas en intérim) |
  | « Votre périmètre » | chefs de division, de section, de cellule : les actions des personnes de leur périmètre et les leurs |
  | « Vos propres actions » | tous les autres |

- Le texte suivant est affiché : « Le journal est en écriture seule : personne, administrateur compris, ne peut le modifier ni l’effacer. »
- Filtres :
  - « Du » et « au » (dates) ;
  - « Tous les objets » (types d'éléments) ;
  - « Toutes les actions » : « Création », « Modification », « Suppression », « Validation », « Rejet », « Publication », « Connexion », « Déconnexion ».
- Tableau :
  - « N° » ;
  - « Date » ;
  - « Auteur » : « Système » pour une action automatique, et « par intérim, au nom de X » pour un suppléant ;
  - « Action » : par exemple « Consultation d’un élément protégé », « Paramètre modifié », « Test de restauration déclaré », « Départ enregistré », « Reprise automatique du socle » ;
  - « Objet » ;
  - badge « SCELLÉE » ou « EN ATTENTE ».
- Pagination : 50 entrées par page, boutons « Précédent » et « Suivant », « Page n / m », « n entrée(s) ».
- Sans résultat : « Aucune entrée pour ces critères. »

**Actions et formulaires**
- Choisir des filtres : la liste se met à jour et revient à la page 1.
- « Vérifier l’intégrité » (administrateur système, pas en intérim) : contrôle toute la chaîne et affiche le résultat dans un bandeau.

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| « EN ATTENTE » | Entrée récente, pas encore scellée (moins d'une minute en temps normal) | Automatique, chaque minute |
| « SCELLÉE » | Entrée numérotée et liée à la précédente ; toute modification serait détectée | Étape finale |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Lire le journal | Tous sauf le stagiaire, dans leur portée | « Cette fonctionnalité n’est pas accessible aux stagiaires. » |
| Vérifier l'intégrité | Administrateur système (pas en intérim) | Bouton non affiché ; sinon « Votre rôle ne permet pas cette action. » |
| Modifier ou effacer une entrée | Personne | « Le journal d'audit est en écriture seule. » |

En intérim, vous lisez le journal avec votre propre portée, pas celle du titulaire.

**Règles automatiques**
- Chaque minute, les entrées de plus d'une minute sont scellées et chaînées.
- Chaque nuit à 2 h 30, toute la chaîne est vérifiée. Le résultat apparaît dans la supervision, service « Journal d’audit ». Si la chaîne est rompue, les administrateurs sont alertés.
- Au redémarrage de l'application, une vérification complète est lancée si la dernière date de plus de 26 heures.
- Une vérification faite à la demande remplace celle de la nuit dans la supervision.
- Le journal n'est jamais purgé.

**Messages que vous pouvez voir**
- « Chaîne intacte : n entrées scellées vérifiées, m en attente de scellement (moins d’une minute). » → Tout va bien.
- « Chaîne rompue à l’entrée n° r : le journal a été altéré en dehors de l’application. » → Prévenez immédiatement le responsable de l'exploitation et la Direction ; l'application ne permet pas de corriger le journal.
- « Aucune entrée pour ces critères. » → Élargissez les filtres.

**Captures**
- 11-admin-07-journal-audit.png
- 11-admin-09-verifier-integrite-audit.png

---

### 3.26 Aide en ligne

**À quoi sert ce module**
L'aide en ligne présente les guides d'utilisation qui correspondent à votre profil. Chaque étape indique le bouton ou le menu à utiliser, illustré par une capture d'écran.

**Accès**
- Menu « Général » → « Aide ».
- Tous les profils, stagiaire compris.

**Écran et onglets**
- L'écran n'a pas d'onglets. Il s'intitule « Guides d’utilisation » et affiche : « Les guides ci-dessous correspondent à votre profil. Chaque étape indique le bouton ou le menu à utiliser. »
- Une barre de liens en haut de la page mène à chaque guide. Chaque guide comporte des sections avec des étapes numérotées et une capture.
- Guides disponibles et profils concernés :

  | Guide | Pour qui |
  |---|---|
  | « Premiers pas » | tous |
  | « Chargé d’Études » | chargé d'études |
  | « Chef de Section » | chef de section |
  | « Chef de Division ou de Cellule » | chef de division, chef de cellule |
  | « Directeur National (DN) et Directrice Nationale Adjointe (DNA) » | DN, DNA |
  | « Assistant(e) de Direction » | assistant(e) de direction |
  | « Secrétariat courrier » | habilitation secrétariat courrier |
  | « DRH » | DRH, et toute personne qui a le rôle fonctionnel DRH ou Gestionnaire RH |
  | « Gestionnaire logistique » | habilitation gestionnaire logistique |
  | « Stagiaire » | stagiaire |
  | « Administrateur système » | administrateur système |

**Actions et formulaires**
- Cliquer sur le nom d'un guide fait défiler la page jusqu'à ce guide. Il n'y a aucun formulaire.
- Le guide imprimable (PDF) reprend le même contenu. Il n'est pas proposé en téléchargement depuis cet écran : il est distribué à part (à confirmer).

**Statuts et étapes**

| Statut | Signification | Qui le fait passer à l'étape suivante |
|---|---|---|
| Sans objet | Écran de consultation | — |

**Qui peut faire quoi**

| Action | Rôles autorisés | Si refusé (message affiché) |
|---|---|---|
| Lire les guides de son profil | Tous | — |

Les guides affichés dépendent de votre rôle propre, jamais de celui que vous empruntez en intérim, et de vos habilitations personnelles.

**Règles automatiques**
- Aucune.

**Messages que vous pouvez voir**
- Un message d'erreur de chargement si l'application ne répond pas → Rechargez la page.

**Captures**
- 11-admin-08-aide.png

---

## 4. Parcours pas à pas

Les opérations les plus courantes, clic par clic. P00 complète la partie 1 ; P01 à P25 suivent l'ordre des modules.

### P00 Activer la double authentification

**Qui** : toute personne ayant un compte actif. C'est facultatif, et conseillé pour la Direction.

**Avant de commencer**
- Installez sur votre téléphone une application d'authentification, par exemple Google Authenticator, Microsoft Authenticator ou FreeOTP.
- Ayez votre mot de passe sous la main.
- Vérifiez que l'heure de votre téléphone est juste.

**Étapes**
1. En bas du menu latéral, cliquez sur 🔒 « Sécurité du compte ». La page « Sécurité du compte » s'affiche, avec l'encadré « Double authentification » et le badge « Désactivée ».
2. Cliquez sur **« Activer la double authentification »**.
3. La fenêtre **« Confirmez votre identité »** s'ouvre : « Cet élément est protégé. Saisissez votre mot de passe pour l'ouvrir ; la confirmation reste valable 10 minutes. » Saisissez « Votre mot de passe ».
4. Cliquez sur **« Confirmer »**.
5. Les instructions s'affichent :
   « Ouvrez l'application d'authentification de votre téléphone et ajoutez un compte. »
   « Scannez ce QR code (ou saisissez la clé affichée dessous). »
   « Saisissez le code à 6 chiffres qu'elle affiche. »
   Le QR code apparaît, avec en dessous une clé à saisir à la main si le scan échoue.
6. Dans l'application du téléphone, ajoutez un compte et scannez le QR code (ou saisissez la clé).
7. Recopiez le code à 6 chiffres affiché par le téléphone dans le champ « Code à 6 chiffres affiché par l'application » (obligatoire, chiffres seulement).
8. Cliquez sur **« Confirmer l'activation »**. Le bouton reste grisé tant que le code n'a pas 6 chiffres.

**Résultat attendu**
- Le message « Double authentification activée : le code sera demandé à votre prochaine connexion. » s'affiche et le badge passe à « Activée ».
- À chaque connexion, après le mot de passe, l'écran « Vérification en deux étapes » vous demande le « Code de vérification », à saisir dans les 5 minutes.
- La fenêtre « Confirmez votre identité » demandera désormais aussi le « Code de l'application d'authentification ».
- Personne n'est prévenu : le changement est inscrit dans le journal d'audit.

**Si ça bloque**
- « Code de vérification invalide » → le code a changé entre-temps ou l'heure du téléphone est fausse. Saisissez le code suivant. Les codes faux comptent dans le verrouillage (5 échecs → 15 minutes de blocage).
- « Mot de passe incorrect » dans la fenêtre de confirmation → ressaisissez votre mot de passe.
- Téléphone perdu ou changé plus tard → demandez à l'administrateur système de cliquer sur « Réinitialiser la double authentification ». Vous vous reconnecterez avec votre seul mot de passe, puis vous pourrez la réactiver.

**Captures associées** : 01-acces-05-double-authentification.png

---

### P01 Créer une tâche, l'assigner, la terminer et la faire valider

**Qui / Avant de commencer**

- La création et l'assignation reviennent à un chef de division, de section ou de cellule, au DN ou à la DNA. La personne assignée doit faire partie de leur unité (pour le DN et la DNA : tout le monde).
- La réalisation revient à la personne assignée (chargé d'études, stagiaire, etc.).
- La validation revient au créateur, ou à un chef qui a autorité sur toutes les personnes assignées.
- Important : la tâche se crée depuis le **Tableau de bord**, pas depuis « Mes tâches ».

**Étapes**

*Le chef crée et assigne*

1. Cliquez sur « Tableau de bord » dans le menu « Général ».
2. Cliquez sur « + Nouvelle tâche ». La fenêtre « Nouvelle tâche » s'ouvre.
3. Saisissez le « Titre » (obligatoire, 2 à 300 caractères).
4. Si besoin, renseignez la « Description », la « Priorité » et l'« Échéance ».
5. Si besoin, choisissez l'« Activité du plan de travail ».
6. Si besoin, ajoutez des « Documents de référence » et cochez « Document obligatoire avant soumission pour validation ».
7. Dans « Assigner à », cochez la ou les personnes.
8. Cliquez sur « Créer la tâche ». La fiche de la tâche s'ouvre, à l'étape « À faire ».

*La personne assignée réalise la tâche*

9. Ouvrez la notification « Nouvelle tâche assignée », ou le menu « Mes tâches » → onglet « Assignées à moi », puis cliquez sur la carte.
10. Cliquez sur « Démarrer ». La tâche passe « En cours » et l'avancement à 50 %.
11. Si besoin, tapez des sous-tâches dans « Ajouter une sous-tâche… » (Entrée) et cochez-les au fur et à mesure.
12. Dans « Pièces jointes », choisissez votre livrable puis cliquez sur « Ajouter ». C'est indispensable si l'étiquette « Pièce jointe obligatoire avant soumission » est affichée.
13. Cliquez sur « Soumettre pour validation ». La tâche passe dans la colonne « Soumises » et l'avancement à 90 %.

*Le chef valide*

14. Ouvrez la notification « Tâche soumise pour validation », ou la colonne « Soumises » du « Suivi des tâches » du Tableau de bord.
15. Cliquez sur « Valider ». La tâche passe « Terminée » et l'avancement à 100 %.

**Résultat attendu / qui est prévenu**

- La tâche est « Terminée » à 100 %. Elle reste visible 30 jours dans le « Suivi des tâches », puis reste dans l'export Excel.
- Les personnes assignées reçoivent « Nouvelle tâche assignée » (étape 8) puis « Tâche validée » (étape 15).
- Le créateur reçoit « Tâche soumise pour validation » (étape 13).
- Si la tâche est rattachée à une activité, l'avancement de l'activité et de l'objectif se met à jour.

**Si ça bloque**

- Message « Seuls le créateur (ou la personne assignée/concernée) et son supérieur hiérarchique direct peuvent effectuer cette action. » à l'étape 8 : la personne cochée n'est pas dans votre unité. Retirez-la, ou demandez à son chef de créer la tâche.
- Message « Cette tâche exige au moins une pièce jointe avant de pouvoir être soumise pour validation. » à l'étape 13 : déposez d'abord un fichier (étape 12).
- « Soumettre pour validation » n'apparaît pas : la tâche n'est pas « En cours » (cliquez sur « Démarrer »), ou vous êtes « Collaborateur » et non « Responsable » de la tâche.

**Captures associées**

- 03-taches-02-nouvelle-tache.png
- 03-taches-01-mes-taches.png
- 03-taches-03-detail-tache-a-valider.png
- 12-telephone-01-tableau-de-bord.png

---

### P02 Rejeter une tâche soumise avec motif

**Qui / Avant de commencer**

- Le créateur de la tâche, ou un chef qui a autorité sur toutes les personnes assignées (le DN et la DNA sur tout le monde). Jamais une personne assignée à la tâche.
- La tâche doit être soumise pour validation (colonne « Soumises »).

**Étapes**

1. Ouvrez la notification « Tâche soumise pour validation », ou « Tableau de bord » → « Suivi des tâches » → colonne « Soumises » → cliquez sur la carte.
2. Lisez les « Pièces jointes » et les « Commentaires ».
3. Cliquez sur « Rejeter ». La zone « Motif du rejet (visible par la personne assignée)… » apparaît.
4. Rédigez le motif (au moins 2 caractères ; « Confirmer le rejet » reste grisé avant).
5. Cliquez sur « Confirmer le rejet ».

**Résultat attendu / qui est prévenu**

- La tâche revient « En cours » (50 %). Sa fiche affiche « Rejet : <motif> » et le motif est publié dans les « Commentaires » sous la forme « Rejet : <motif> ».
- Les personnes assignées reçoivent « Tâche rejetée — à reprendre », avec le motif. Elles corrigent leur travail puis cliquent à nouveau sur « Soumettre pour validation ».

**Si ça bloque**

- Les boutons « Valider » / « Rejeter » n'apparaissent pas : vous êtes assigné(e) à cette tâche. Faites-la valider par son créateur ou par votre supérieur.
- Message « Seuls le créateur de la tâche ou un supérieur hiérarchique de toutes les personnes assignées peuvent la valider ou la rejeter. » : une des personnes assignées n'est pas dans votre unité. Laissez le créateur ou la Direction décider.
- Message « Seule une tâche "Soumise pour validation" peut être rejetée. » : quelqu'un a déjà traité la tâche. Fermez et rouvrez la fiche.

**Captures associées**

- 03-taches-03-detail-tache-a-valider.png

---

### P03 Ajouter un objectif et une activité au plan de travail et y rattacher une tâche

**Qui / Avant de commencer**

- Le chef de l'unité (chef de division pour sa division et ses sections, chef de section, chef de cellule), le DN ou la DNA.
- Le futur responsable de l'activité doit être un membre actif de l'unité (pas un stagiaire).

**Étapes**

1. Cliquez sur « Plan de travail » dans le menu « Général ».
2. Choisissez l'« Année » voulue.
3. Cliquez sur « + Nouvel objectif ». La fenêtre « Nouvel objectif <année> » s'ouvre.
4. Choisissez l'« Unité ».
5. Saisissez le « Libellé de l'objectif » (3 à 300 caractères) et, si besoin, la « Description ».
6. Cliquez sur « Enregistrer ». L'objectif apparaît à 0 %.
7. Sur cet objectif, cliquez sur « + Activité ». La fenêtre « Nouvelle activité — <objectif> » s'ouvre.
8. Saisissez le « Libellé de l'activité ».
9. Choisissez le « Responsable ».
10. Renseignez le « Début » et la « Fin ».
11. Saisissez l'« Indicateur » (au moins 3 caractères) et, si besoin, la « Cible ».
12. Cliquez sur « Enregistrer ». L'activité s'affiche sous l'objectif.
13. Cliquez sur le libellé de l'activité. Sa fiche s'ouvre.
14. Cliquez sur « + Nouvelle tâche ». La fenêtre « Nouvelle tâche » s'ouvre, avec l'activité déjà choisie.
15. Remplissez la tâche et cochez les personnes dans « Assigner à » (comme dans P01, étapes 3 à 7).
16. Cliquez sur « Créer la tâche ». La tâche apparaît dans « Tâches (1) » de l'activité.

**Résultat attendu / qui est prévenu**

- Le responsable de l'activité reçoit « Vous êtes responsable d'une activité du plan de travail ».
- Les personnes assignées reçoivent « Nouvelle tâche assignée ».
- L'avancement de l'activité, puis celui de l'objectif, suit automatiquement celui des tâches rattachées. L'activité est marquée « En retard » si sa date de fin passe avant 100 %.

**Si ça bloque**

- Le bouton « + Nouvel objectif » ou « + Activité » est absent : vous ne gérez pas le plan de cette unité. Demandez à son chef.
- Message « Le responsable doit être un membre actif de l'unité. » : choisissez une personne de l'unité.
- Message « La fin de l'activité précède son début. » : corrigez les dates. Pour l'indicateur trop court, saisissez au moins 3 caractères (l'écran en accepte 2, mais l'enregistrement est refusé avec un message technique en anglais).

**Captures associées**

- 03-taches-04-plan-de-travail.png
- 03-taches-02-nouvelle-tache.png

---

### P04 Émettre une instruction (DN/DNA) et la suivre jusqu'à exécution

**Qui / Avant de commencer**

- L'émission revient au DN ou à la DNA. Le traitement revient au destinataire choisi (toute personne au compte actif, hors stagiaire).
- Pour une instruction qui concerne un agent (instruction RH), le destinataire (par exemple le DRH) devra préparer et faire signer un acte du Courrier au bénéfice de cet agent.

**Étapes**

*Le DN ou la DNA émet*

1. Cliquez sur « Instructions » dans le menu « Général ».
2. Cliquez sur « + Nouvelle instruction ». La fenêtre « Nouvelle instruction » s'ouvre.
3. Saisissez l'« Objet » (3 à 300 caractères).
4. Rédigez l'« Instruction » (5 à 5 000 caractères).
5. Choisissez le « Destinataire ».
6. Si l'instruction concerne un agent, choisissez l'« Agent concerné ».
7. Si besoin, fixez une « Échéance ».
8. Cliquez sur « Émettre ». L'onglet « Émises (Direction) » s'affiche, avec l'instruction au statut « Émise ».

*Le destinataire traite*

9. Ouvrez la notification « Instruction de la Direction », ou « Instructions » → onglet « Reçues », puis cliquez sur l'instruction. Elle passe automatiquement « Reçue ».
10. Cliquez sur « Prendre en compte ». Le statut devient « Prise en compte ».
11. Une fois le travail fait, cliquez sur « Marquer exécutée ».
12. Rédigez le « Compte rendu d'exécution » (3 caractères au moins).
13. Pour une instruction RH, choisissez l'« Acte signé qui exécute l'instruction ».
14. Cliquez sur « Confirmer l'exécution ». Le statut devient « Exécutée ».

*Le DN ou la DNA suit*

15. Dans « Instructions » → « Émises (Direction) », cliquez sur l'instruction. La ligne « Suivi » montre la date de chaque étape, puis le « Compte rendu » et, pour une instruction RH, « Acte : voir l'acte d'exécution ».

**Résultat attendu / qui est prévenu**

- Le destinataire reçoit l'instruction à l'étape 8, par email immédiat.
- L'émetteur reçoit « Instruction prise en compte » (étape 10) puis « Instruction exécutée » (étape 14).
- L'agent concerné reçoit « Instruction de la Direction vous concernant » à l'exécution et la voit alors dans l'onglet « Me concernant ». Avant l'exécution, il ne voit rien.
- Si rien ne bouge pendant 7 jours, le destinataire est relancé (« Relance : instruction de la Direction en attente ») et l'émetteur est informé (« Instruction toujours en attente »), puis tous les 7 jours.

**Si ça bloque**

- La liste « Acte signé qui exécute l'instruction » est vide (« Préparez puis faites signer l'acte dans le module Courrier (ou Documents générés). ») : faites préparer et signer l'acte au bénéfice de l'agent concerné, puis revenez.
- Le destinataire refuse : il clique sur « Rejeter », saisit un « Motif du rejet » (5 caractères au moins) puis « Confirmer le rejet ». L'émetteur reçoit « Instruction rejetée » avec le motif.
- Le DN veut faire avancer l'instruction à la place du destinataire : impossible (« Seul le destinataire traite l'instruction. »). Relancez-le, ou émettez une nouvelle instruction vers une autre personne.

**Captures associées**

- 03-taches-05-instructions.png
- 03-taches-06-instruction-recue.png

---

### P05 Publier une annonce et créer un sondage

**Qui / Avant de commencer**

- DN, DNA (toute la DNPEC), administrateur système, chef de division, chef de section, chef de cellule (leur unité, ou un groupe de personnes sur lesquelles ils ont autorité).
- Les sondages ne sont jamais proposés aux stagiaires.

**Étapes**

*Publier une annonce*

1. Cliquez sur « Communication » dans le menu « Général ».
2. Cliquez sur l'onglet « Annonces ».
3. Cliquez sur « + Nouvelle annonce ». La fenêtre « Nouvelle annonce » s'ouvre.
4. Saisissez le « Titre » (2 à 200 caractères).
5. Rédigez le « Message » (4 000 caractères au plus).
6. Choisissez la « Portée », puis la division, la section, la cellule ou les « Destinataires » selon le cas.
7. Cliquez sur « Publier l'annonce ». L'annonce apparaît en tête de liste.
8. Plus tard, cliquez sur l'annonce pour suivre « Lue par N personne(s) ».

*Créer un sondage*

9. Cliquez sur l'onglet « Sondages ».
10. Cliquez sur « + Nouveau sondage ». La fenêtre « Nouveau sondage » s'ouvre.
11. Saisissez la « Question » (2 à 300 caractères).
12. Remplissez « Option 1 » et « Option 2 ». Cliquez sur « + Ajouter une option » pour en ajouter d'autres.
13. Si besoin, cochez « Autoriser plusieurs choix par personne ».
14. Si besoin, fixez une « Clôture automatique (optionnel) ».
15. Choisissez la « Portée ».
16. Cliquez sur « Publier le sondage ».
17. Cliquez sur le sondage pour suivre les résultats (mis à jour toutes les 15 secondes).
18. Pour arrêter les votes, cliquez sur « Clôturer le sondage », puis confirmez.

**Résultat attendu / qui est prévenu**

- Chaque destinataire actif reçoit le titre de l'annonce (bouton « Voir l'annonce ») et la notification « Nouveau sondage » (bouton « Voir le sondage »).
- Les votes s'affichent en nombre et en pourcentage. Vous voyez aussi le nom des votants, car vous êtes l'auteur.

**Si ça bloque**

- Le bouton « + Nouvelle annonce » ou « + Nouveau sondage » est absent : votre rôle ne permet pas de diffuser (chargé d'études, assistant(e) de direction, DRH, stagiaire), ou vous n'êtes pas sur le bon onglet. Passez par votre chef, ou utilisez un fil de discussion.
- Message « Seuls le DN ou la DNA peuvent diffuser une annonce à toute la DNPEC. » : choisissez votre division, section ou cellule.
- « Publier le sondage » reste grisé : la question est vide ou il manque une deuxième option. Message « Les sondages ne sont pas ouverts aux stagiaires. » : retirez le stagiaire du groupe de destinataires.

**Captures associées**

- 05-communication-03-annonces.png
- 05-communication-04-sondages.png

---

### P06 Demander un congé maladie et joindre le certificat

**Qui / Avant de commencer**
Tout membre du personnel, sauf le stagiaire. Préparez le certificat médical sous forme de fichier (25 Mo au maximum).

**Étapes**
1. Dans le menu « Personnel », cliquez sur « Congés & absences ». L'onglet « Mes congés » s'ouvre.
2. Cliquez sur « + Nouvelle demande ». La fenêtre « Nouvelle demande de congé » s'ouvre.
3. Dans « Type de congé », choisissez le type « maladie ». Son nom exact dépend du paramétrage (à confirmer).
4. Remplissez « Date de début », puis « Date de fin ». La ligne « Durée : N jours » s'affiche.
5. Si besoin, écrivez un « Motif (optionnel) ». Ce motif reste protégé : seuls votre chef qui donne l'avis et le DRH pourront le lire, après saisie de leur mot de passe.
6. Cliquez sur « Soumettre la demande ». La carte apparaît dans « Mes demandes », avec l'étape « AVIS DU CHEF ATTENDU » et le texte « Votre chef donne son avis avant le … ; sans avis, il sera réputé favorable. Le DRH décide ensuite. »
7. Sur cette carte, cliquez sur « Joindre le certificat médical » et choisissez votre fichier. La ligne « 📎 Certificat médical : {nom du fichier} » apparaît.
8. Pour changer de fichier, cliquez sur « Remplacer le certificat ».

**Résultat attendu / qui est prévenu**
- Votre chef le plus proche reçoit « Demande de congé : votre avis est attendu ».
- Le DRH reçoit « Nouvelle demande de congé (pour information) ».
- Ces notifications affichent « Absence — motif protégé », jamais la nature médicale.
- Le certificat n'est lisible que par vous et le DRH.
- Après la décision, vous recevez « Demande de congé approuvée » ou « Demande de congé refusée ». Votre solde n'est mis à jour qu'en cas d'approbation.

**Si ça bloque**
- « Soumettre la demande » reste grisé : une date manque, la fin précède le début, ou aucun type de congé n'existe (prévenez l'administrateur système).
- « La période ne compte aucun jour de congé (jours fériés seulement). » : changez les dates.
- Le bouton « Joindre le certificat médical » n'apparaît pas : le type choisi n'est pas « maladie », ou la demande est annulée ou refusée.

**Captures associées**
04-conges-02-nouvelle-demande.png, 04-conges-06-conge-maladie-certificat.png, 04-conges-01-mes-demandes.png

---

### P07 Donner un avis sur un congé (chef) puis le décider (DRH)

**Qui / Avant de commencer**
- **L'avis** : le chef le plus proche du demandeur. C'est, dans l'ordre, le supérieur désigné, le chef de cellule, le chef de section, le chef de division, puis le DN ou la DNA. Un suppléant en intérim peut aussi donner l'avis.
- **La décision** : le DRH. Pour une demande du DRH lui-même, c'est le DN ou la DNA qui décide.

**Étapes — avis du chef**
1. Ouvrez la notification « Demande de congé : votre avis est attendu » et cliquez sur « Donner mon avis ». Vous pouvez aussi passer par le menu « Personnel » → « Congés & absences » → onglet « À traiter ».
2. Sur la ligne marquée « Votre avis est attendu », cliquez sur « Examiner ». Le volet « Demande de congé » s'ouvre : dates, durée, circuit, solde.
3. Pour un congé maladie, cliquez sur « Afficher le motif », saisissez « Votre mot de passe », puis cliquez sur « Confirmer ».
4. Cliquez sur « Avis favorable » : l'étape devient « Décision du DRH attendue ».
5. Ou bien cliquez sur « Avis défavorable », écrivez le motif dans « Motif de l'avis défavorable (transmis au DRH)… », puis cliquez sur « Confirmer l'avis défavorable ».

**Étapes — décision du DRH**
1. Ouvrez la notification « Congé : décision attendue » et cliquez sur « Décider ». Vous pouvez aussi ouvrir l'onglet « À traiter » : la ligne indique « Votre décision est attendue ».
2. Cliquez sur « Examiner » et lisez l'avis du chef ainsi que le solde.
3. Pour un congé maladie, cliquez sur « 📎 Certificat médical : … » pour le lire. Si votre confirmation a expiré, l'application vous redemande votre mot de passe.
4. Cliquez sur « Approuver ».
5. Ou bien cliquez sur « Refuser », écrivez le motif dans « Motif du refus (visible par le demandeur)… », puis cliquez sur « Confirmer le refus ».

**Résultat attendu / qui est prévenu**
- Après l'avis : le DRH reçoit « Congé : décision attendue ».
- Après l'approbation : le demandeur reçoit « Demande de congé approuvée », et le chef reçoit « Congé approuvé par le DRH ». Les jours sont décomptés du solde.
- Après un refus : le demandeur reçoit « Demande de congé refusée », avec le motif.

**Si ça bloque**
- La demande n'est pas dans « À traiter » :
  - si vous êtes chef, un chef plus proche existe, ou l'avis est déjà donné : la demande est dans « Suivi » ;
  - si vous êtes DRH, l'avis n'est pas encore rendu.
- « Le délai d'avis est dépassé : l'avis a été réputé favorable. » : l'échéance (48 heures ouvrées par défaut) est passée ; le DRH décide.
- Le bouton de confirmation reste grisé : écrivez un motif d'au moins 2 caractères.

**Captures associées**
04-conges-03-avis-chef.png, 04-conges-04-suivi-drh.png

---

### P08 Gérer les jours fériés de l'année

**Qui / Avant de commencer**
L'administrateur système ou le DRH. Ayez sous la main les dates officielles des fêtes religieuses de l'année.

**Étapes**
1. Ouvrez la notification « Calendrier des jours fériés à compléter » et cliquez sur « Compléter le calendrier ». Vous pouvez aussi passer par le menu « Personnel » → « Congés & absences » → onglet « Jours fériés ».
2. Dans « Année », choisissez l'année à compléter.
3. Si le bandeau « Fêtes fixes absentes : … » s'affiche, cliquez sur « Ajouter les fêtes fixes ». Les fêtes nationales s'ajoutent à la liste.
4. Dans le formulaire du bas, remplissez « Date ».
5. Remplissez « Libellé » (par exemple « Tabaski »).
6. Dans « Nature », laissez « Fête religieuse ».
7. Cliquez sur « Ajouter le jour férié ». La fête apparaît dans la liste. Recommencez pour chaque fête religieuse (fin du Ramadan, Maouloud, lundi de Pâques…).
8. Si une date officielle change, cliquez sur « Modifier » sur la ligne, corrigez, puis cliquez sur « Enregistrer ».
9. Pour enlever une ligne, cliquez sur « Supprimer », puis confirmez.

**Résultat attendu / qui est prévenu**
Les jours saisis sont retirés du décompte des jours de congé, y compris pour les demandes en attente (au moment de leur approbation), et du délai d'avis du chef. Personne d'autre n'est prévenu. Le bandeau sur les fêtes religieuses disparaît.

**Si ça bloque**
- « Ce jour est déjà férié. » : la date existe déjà dans la liste.
- Le formulaire n'apparaît pas : vous n'êtes ni administrateur système ni DRH.

**Captures associées**
04-conges-05-jours-feries.png

---

### P09 Désigner un suppléant et agir en intérim

**Qui / Avant de commencer**
- **Désigner** : le titulaire (DN, DNA, chef de division, de section ou de cellule) ou son supérieur direct.
- **Être suppléant** : un responsable avec un compte actif, de rang comparable (voir 3.10).

**Étapes — désigner**
1. Dans le menu « Personnel », cliquez sur « Suppléances ».
2. Cliquez sur « + Désigner un suppléant ». La fenêtre « Désigner un suppléant » s'ouvre.
3. Dans « Titulaire », choisissez vous-même ou le chef concerné.
4. Dans « Suppléant (rang comparable) », choisissez la personne.
5. Remplissez « Du » et « Au (inclus) ».
6. Cliquez sur « Désigner ». La suppléance apparaît dans « Mes suppléants » (ou dans « Désignées par moi ») avec le statut « À venir » ou « En cours ».

**Étapes — agir en intérim (le suppléant)**
1. Pendant la période, cliquez sur « Agir en intérim pour… » en haut de l'écran.
2. Choisissez le nom du titulaire. Vous pouvez aussi cliquer sur « Agir en intérim » dans « Mes intérims ».
3. Le bandeau « Mode intérim — Vous agissez au nom de … » s'affiche. Vous voyez et traitez ce que voit le titulaire, par exemple ses avis de congé à donner.
4. Pour revenir à votre propre compte, cliquez sur « Quitter l'intérim », ou choisissez « Moi-même » dans le menu.

**Étapes — mettre fin plus tôt**
1. Dans « Mes suppléants » (ou « Désignées par moi »), cliquez sur « Révoquer ».
2. Confirmez « Révoquer la suppléance de … ? Elle cessera immédiatement. »

**Résultat attendu / qui est prévenu**
- Le suppléant reçoit « Vous avez été désigné suppléant ». Si c'est le supérieur qui a désigné, le titulaire reçoit « Un suppléant a été désigné pour vous ».
- Chaque action faite en intérim est enregistrée « par intérim, au nom de » le titulaire.
- La révocation ne prévient personne.

**Si ça bloque**
- « Aucun suppléant possible » : aucune personne de rang comparable n'a de compte actif.
- « Une suppléance est déjà active ou prévue pour ce titulaire sur cette période. » : révoquez l'ancienne ou changez les dates.
- Le menu « Agir en intérim pour… » n'apparaît pas : la suppléance n'est pas « En cours », ou elle est « Non conforme — à redésigner ».

**Captures associées**
10-rh-09-suppleances.png, 10-rh-12-designer-suppleant.png

---

### P10 Établir le plan de stage, déposer et valider le rapport de stage

**Qui / Avant de commencer**
Ce parcours fait intervenir le DRH, le responsable de chaque unité d'accueil, le tuteur de stage, l'encadreur principal et le stagiaire. Le compte du stagiaire doit déjà exister, avec le rôle « Stagiaire ». Il est créé par l'administrateur système, ou par l'import Excel.

**Étapes**
1. (DRH) Dans le menu « Personnel », cliquez sur « Stagiaires », puis sur « + Nouveau stage ».
2. (DRH) Remplissez « Stagiaire », « Établissement d'origine », « Début » et « Fin », puis cliquez sur « Créer le stage ». La fiche du stage s'ouvre.
3. (DRH) Cliquez sur « + Ajouter une période ». Choisissez l'« Unité d'accueil », les dates « Du » et « Au », l'« Évaluation de fin de période » et, si besoin, les « Objectifs ». Cliquez sur « Enregistrer ». La période apparaît « À accepter par l'unité ». Recommencez pour chaque unité.
4. (Responsable de l'unité) Ouvrez la notification « Stagiaire proposé dans votre unité ». Sur la période, cliquez sur « Accepter et désigner le tuteur », choisissez le « Tuteur », puis cliquez sur « Accepter ». La période devient « Acceptée ».
5. (DRH) Dans « Rapport de stage », cliquez sur « Désigner l'encadreur ». Choisissez l'« Encadreur (parmi les tuteurs du plan) », puis cliquez sur « Désigner ».
6. (Tuteur, à la fin de sa période) Dans le bloc « Évaluation », remplissez les critères et l'« Appréciation », puis cliquez sur « Soumettre au visa ».
7. (Responsable de l'unité) Cliquez sur « Viser ».
8. (Stagiaire) Dans le menu, cliquez sur « Mon stage ». Dans « Rapport de stage », cliquez sur « Déposer mon rapport » et choisissez le fichier. Le message « Rapport déposé : votre encadreur est prévenu. » s'affiche.
9. (Encadreur) Ouvrez la notification « Rapport de stage à valider » et cliquez sur « Télécharger le rapport » pour le lire.
10. (Encadreur) Cliquez sur « Valider le rapport ». Ou bien cliquez sur « Demander une reprise », saisissez le « Motif », puis cliquez sur « Renvoyer ».
11. (Stagiaire, en cas de reprise) Lisez « Motif : … », puis cliquez sur « Déposer une nouvelle version ».
12. (DRH, quand toutes les périodes sont terminées) Cliquez sur « Clôturer », puis confirmez.
13. (DRH) Cliquez sur « Préparer l'attestation finale », choisissez le « Registre d'attestations », puis cliquez sur « Créer l'acte ».
14. (DN ou DNA) Signez l'acte dans le Courrier, après le visa.
15. (Stagiaire) Cliquez sur « J'ai pris connaissance de mon attestation ».

**Résultat attendu / qui est prévenu**
- Le tuteur reçoit « Vous êtes tuteur d'un stagiaire ».
- L'encadreur reçoit « Vous êtes encadreur principal d'un stage ».
- À la validation du rapport, le stagiaire et le DRH reçoivent « Rapport de stage validé » ; pour le DRH, le texte ajoute « L'attestation peut être préparée. ».
- L'attestation porte un numéro une fois signée.

**Si ça bloque**
- « Capacité d'accueil atteinte pour … » : changez les dates ou l'unité, ou faites relever la capacité.
- Le stagiaire voit « Le DRH doit d'abord désigner votre encadreur principal. » : le DRH doit faire l'étape 5.
- « Des périodes ne sont pas terminées : attendez leur fin ou interrompez le stage. » : attendez la fin des périodes, ou utilisez « Interrompre ».

**Captures associées**
10-rh-10-stages.png, 10-rh-11-mon-stage.png

---

### P11 Nommer un chef : préparer le mouvement, l'acte, la signature, la confirmation du changement de rôle

**Qui / Avant de commencer**
Ce parcours fait intervenir le DRH, les viseurs du Courrier, le DN ou la DNA (signature) et l'administrateur système. Il faut que :
- la famille d'actes des nominations ait un registre (bloc « Familles d'actes ») ;
- la personne nommée ait un compte actif.

**Étapes**
1. (DRH ou administrateur système, une seule fois) Dans le menu « Personnel », ouvrez « Ressources humaines » → « Carrière et actes ». Dans « Familles d'actes », choisissez le registre de la famille des nominations.
2. (DRH) Cliquez sur « + Nouveau mouvement ». La fenêtre « Nouveau mouvement de carrière » s'ouvre.
3. (DRH) Choisissez l'« Agent ». Dans « Mouvement », choisissez « Nomination ». Remplissez la « Date d'effet ».
4. (DRH) Dans « Poste visé », choisissez le poste, par exemple « Chef de Division — … (actuel : …) » ou « (vacant) ». Le texte « Fonction au dossier : … » explique la suite.
5. (DRH) Cliquez sur « Préparer le mouvement ». Le mouvement apparaît « Préparé ».
6. (DRH) Cliquez sur « Préparer l'acte ». Le mouvement passe « Acte en cours ».
7. (DRH) Cliquez sur « Voir l'acte ». Dans le Courrier, l'acte est un brouillon avec la décision jointe : cliquez sur « Soumettre au visa », puis confirmez.
8. (Viseurs) Dans le Courrier, cliquez sur « Viser ».
9. (DN ou DNA) Dans le Courrier, cliquez sur « Signer ». L'acte reçoit son numéro. La fonction du dossier est mise à jour, le mouvement passe « Appliqué » et affiche « Droits en attente (administrateur) ».
10. (Administrateur système) Ouvrez la notification « Nomination à appliquer — acte n° … » et cliquez sur « Examiner ». Vous arrivez dans « Utilisateurs » → onglet « Nominations ».
11. (Administrateur système) Sur la ligne, cliquez sur « Confirmer… ».
12. (Administrateur système) Vérifiez le nouveau rôle proposé pour l'actuel titulaire du poste. Pour un poste de DN ou de DNA, choisissez-le. Ajoutez une « Précision » si besoin.
13. (Administrateur système) Cliquez sur « Appliquer les droits ». Ou bien cliquez sur « Refuser… », saisissez le « Motif (obligatoire) », puis cliquez sur « Refuser ».

**Résultat attendu / qui est prévenu**
- À la signature : le DN et la DNA reçoivent « Nomination appliqué(e) — acte n° … ». L'agent reçoit « Votre dossier a été mis à jour… ». Les administrateurs système reçoivent « Nomination à appliquer — acte n° … ».
- À la confirmation :
  - la personne nommée a son nouveau rôle et sa nouvelle unité ; ses sessions sont fermées et elle doit se reconnecter ;
  - l'ancien titulaire prend son nouveau rôle, et sa fonction est inscrite « (suite à l'acte n° …) » ;
  - le mouvement affiche « Droits appliqués » ;
  - le DRH reçoit « Droits appliqués — acte n° … ».
- En cas de refus : le mouvement affiche « Droits refusés » avec le motif, et le DRH reçoit « Droits refusés — acte n° … ».

**Si ça bloque**
- « Choisissez d'abord le registre de la famille « … » … » : faites l'étape 1.
- Le mouvement reste « Acte en cours » : l'acte n'a pas été soumis au visa (étape 7), ou il attend un visa ou la signature.
- « Choisissez le nouveau rôle de … : aucun rôle n'est proposé d'office pour la Direction. » : remplissez « Rôle » pour l'actuel titulaire. Si une tentative échoue, la raison s'affiche sous « Dernière tentative : … » et rien n'est appliqué.

**Captures associées**
10-rh-05-nouvelle-nomination-poste-vise.png, 10-rh-04-carriere-droits-en-attente.png, 07-courrier-06-acte-en-visa.png, 11-admin-02-nominations.png, 11-admin-03-confirmer-nomination.png

---

### P12 Exprimer un besoin de formation et le retenir

**Qui / Avant de commencer**
- **Exprimer un besoin** : un chef de division, de section ou de cellule, le DN ou la DNA. Votre unité doit figurer dans l'organigramme.
- **Retenir un besoin** : le DRH.

**Étapes**
1. (Chef) Dans le menu « Personnel », cliquez sur « Ressources humaines », puis sur l'onglet « Formation ».
2. (Chef) Dans « Année », choisissez l'année visée.
3. (Chef) Cliquez sur « + Exprimer un besoin ». La fenêtre « Besoin de formation — {votre unité} » s'ouvre.
4. (Chef) Remplissez « Intitulé de la formation ». Choisissez la « Priorité » et l'« Origine », puis indiquez le nombre d'« Agents concernés ».
5. (Chef) Cliquez sur « Exprimer le besoin ». La ligne apparaît avec le statut « Exprimé ».
6. (DRH) Ouvrez l'onglet « Formation » et choisissez l'année. Vous voyez les besoins de toutes les unités.
7. (DRH) Dans la liste de statut de la ligne, choisissez « Retenu ». Plus tard, choisissez « Réalisé », ou « Écarté » si le besoin n'est pas retenu.

**Résultat attendu / qui est prévenu**
Le chef voit le nouveau statut des besoins de son unité. Aucune notification n'est envoyée.

**Si ça bloque**
- Le bouton « + Exprimer un besoin » n'apparaît pas : votre rôle ne le permet pas, ou votre unité n'est pas retrouvée dans l'organigramme.
- « Le besoin a déjà ce statut. » : rien à faire.

**Captures associées**
10-rh-07-formation.png

---

### P13 Déposer un document, le faire valider et le rendre diffusable

**Qui / Avant de commencer**

- Dépôt : tout membre d'une division ou d'une cellule rattachée à la Direction (chargé d'études, chefs…).
- Validation : le chef de division, ou le chef de cellule, de l'unité productrice (DN ou DNA en recours).
- Diffusion : le DN ou la DNA.
- Préparez le fichier (25 Mo au plus) et connaissez son type, sa date et la période qu'il couvre.

**Étapes**

1. Dans le menu de gauche, cliquez sur « Archives & documents ». L'onglet « Mon espace division » (ou « Mon espace cellule ») s'ouvre.
2. (Facultatif, division) Cliquez sur un dossier « 📁 … » pour y ranger le document.
3. Cliquez sur « + Nouveau document ». La fenêtre « Nouveau document » s'ouvre.
4. Saisissez le « Titre » et, si vous le souhaitez, la « Description (optionnel) ».
5. Choisissez le « Type ».
6. Vérifiez la « Date du document ».
7. Renseignez « Période couverte : du » et « au ».
8. (Facultatif) Choisissez la « Catégorie (classement) ».
9. Cliquez sur « Fichier » et choisissez le fichier.
10. Cliquez sur « Envoyer ». La carte du document apparaît avec le statut « Brouillon » et « 🔒 Privé — division ».
11. Quand le document est achevé, ouvrez sa carte et cliquez sur « Marquer comme final ». Le badge « Final » apparaît.
12. *Le chef de l'unité* ouvre le document et clique sur « Valider » (rubrique « Statut de diffusion »). Le statut devient « Validé ».
13. (Facultatif) *Le chef de l'unité, le DN ou la DNA* clique sur « Publier (toute la DNPEC) ». Le document passe dans « Documents publiés (DNPEC) ».
14. *Le DN ou la DNA* ouvre le document et clique sur « Rendre diffusable ». Le statut devient « Diffusable ».

**Résultat attendu / qui est prévenu**

- Le document est « Diffusable » : tout fichier téléchargé porte « DIFFUSABLE — autorisé hors de la Direction ».
- L'« Historique du statut » trace chaque étape.
- Aucune notification automatique n'est prévue pour ces étapes (à confirmer) : prévenez votre chef par la messagerie.

**Si ça bloque**

- « Envoyer » est grisé : il manque le titre, le type, une date de période ou le fichier.
- « Seul un document marqué « Final » peut être validé. » : cliquez d'abord sur « Marquer comme final ».
- Le DN ou la DNA ne voit pas le document : un document privé n'est visible que des membres de l'unité. Le chef de l'unité doit d'abord le publier.

**Captures associées**

- 06-documents-01-archives.png
- 06-documents-02-deposer.png
- 06-documents-03-detail-statut.png

---

### P14 Enregistrer un courrier arrivé et l'imputer

**Qui / Avant de commencer**

- Enregistrement : le secrétariat courrier, habilité par l'administrateur système sur le registre (par exemple « ARR — Courrier arrivée ») et l'unité.
- Imputation : le DN ou la DNA pour un registre de la Direction ; le chef de division ou le chef de cellule pour un registre de son unité.
- Ayez le courrier papier et, si possible, son scan.

**Étapes**

1. *Secrétariat courrier* : cliquez sur « Courrier » dans le menu, puis sur l'onglet « Arrivées ».
2. Cliquez sur « + Enregistrer un courrier ». La fenêtre « Enregistrer un courrier arrivée » s'ouvre.
3. Choisissez le « Registre » (et l'« Unité » si elle est demandée).
4. Vérifiez la « Date de réception ».
5. Choisissez la « Confidentialité » : « Ordinaire », « Confidentiel » ou « Pli personnel (fermé) ».
6. Saisissez l'« Expéditeur » et, si vous les avez, la « Référence de l’expéditeur (facultatif) » et la « Date du courrier (facultatif) ».
7. Saisissez l'« Objet » et joignez les « Scans (facultatif) ». Pour un pli personnel, choisissez seulement le « Destinataire ».
8. Si l'encadré « Date inhabituelle » s'affiche, corrigez la date, ou cochez « Je confirme cette date » et remplissez le motif.
9. Cliquez sur « Enregistrer ». Le numéro s'affiche et la fiche du courrier s'ouvre, au statut « ENREGISTRÉ ».
10. *DN, DNA ou chef de l'unité* : vous recevez la notification « Nouveau courrier à imputer ». Cliquez dessus, ou ouvrez « Courrier » → « À faire » → rubrique « À imputer ».
11. Cliquez sur la ligne du courrier, puis sur « Imputer ».
12. Choisissez « Imputer à » et la « Nature » (« Pour attribution », « Pour information » ou « Pour avis »).
13. (Facultatif) Renseignez l'« Échéance (facultatif) » et les « Instructions (facultatif) ».
14. Cliquez sur « Imputer ». L'imputation apparaît dans la rubrique « Imputations » et le courrier passe à « IMPUTÉ ».

**Résultat attendu / qui est prévenu**

- La personne imputée reçoit « Courrier imputé ».
- Avec une échéance, elle reçoit « Échéance proche » dans les 2 jours qui précèdent l'échéance. En cas de retard, elle et vous recevez « Imputation en retard » 24 heures après l'échéance.
- Un pli personnel ne s'impute pas : son destinataire reçoit « Un pli personnel vous attend ».

**Si ça bloque**

- « + Enregistrer un courrier » n'apparaît pas : vous n'avez pas d'habilitation sur un registre d'arrivée. Demandez-la à l'administrateur système.
- « Date anormale : … » : confirmez la date avec un motif, ou corrigez-la.
- La liste « Imputer à » est vide : pour un registre d'unité, seuls les membres de cette unité sont proposés.

**Captures associées**

- 07-courrier-02-arrivees.png
- 07-courrier-01-a-faire.png
- 07-courrier-05-tiroir-arrivee-imputer.png

---

### P15 Traiter un courrier imputé (réponse, conversion en tâche)

**Qui / Avant de commencer**

- La personne à qui le courrier est imputé (ou son suppléant en intérim).
- Pour convertir en tâche : la personne qui a fait l'imputation.

**Étapes**

1. Cliquez sur la notification « Courrier imputé », ou ouvrez « Courrier » → « À faire » → rubrique « À traiter » (ou « En retard »).
2. Cliquez sur la ligne du courrier. La fiche s'ouvre avec les « Scans » et vos instructions.
3. Cliquez sur le nom du scan pour le télécharger et le lire.
4. (Facultatif) Pour confier une partie du travail, cliquez sur « Sous-imputer » sur votre imputation. Choisissez « Imputer à », la « Nature » et l'« Échéance » (pas après la vôtre), puis cliquez sur « Sous-imputer ».
5. (Facultatif) Pour répondre par écrit, cliquez sur « Rédiger une réponse ». La fenêtre « Rédiger une réponse » s'ouvre avec « En réponse au courrier <n°>. ». Remplissez-la, puis cliquez sur « Enregistrer le brouillon » et poursuivez avec le parcours P16.
6. (Auteur de l'imputation, facultatif) Cliquez sur « Convertir en tâche ». Vérifiez le « Titre de la tâche » et l'« Échéance de la tâche », puis cliquez sur « Créer la tâche ». Le lien « Tâche associée → » apparaît.
7. Quand le travail est fait, cliquez sur « Marquer traité » sur votre imputation.
8. Saisissez le « Compte rendu (facultatif) », ou « Votre avis (obligatoire) » pour un avis.
9. Cliquez sur « Marquer traité ». L'imputation affiche « TRAITÉE » avec la date.
10. Quand toutes les imputations « Pour attribution » sont traitées, le courrier passe à « TRAITÉ ». *Le secrétariat courrier, le DN, la DNA ou le chef de l'unité* clique alors sur « Classer » et confirme.

**Résultat attendu / qui est prévenu**

- Le courrier sort de vos rubriques « À traiter » et « En retard ».
- En cas de conversion en tâche, la personne imputée reçoit « Nouvelle tâche assignée ». Pour un courrier confidentiel, la tâche porte le titre neutre « Traitement du courrier <n°> ».

**Si ça bloque**

- « Une imputation pour avis exige l’avis (compte rendu). » : saisissez votre avis.
- « Classer » est refusé : une imputation « Pour attribution » n'est pas encore traitée.
- « Le contenu de ce courrier est protégé (besoin d’en connaître). » : en intérim, un courrier confidentiel n'est visible que si le titulaire vous a ouvert un accès délégué.

**Captures associées**

- 07-courrier-01-a-faire.png
- 07-courrier-05-tiroir-arrivee-imputer.png

---

### P16 Rédiger un acte, le faire viser, le signer et l'expédier

**Qui / Avant de commencer**

- Rédacteur : tout utilisateur sauf le stagiaire.
- Viseurs : le chef de section, puis le chef de division ou le chef de cellule (registre de la Direction).
- Signataire : le DN ou la DNA (registre de la Direction), ou le chef de division / chef de cellule (registre de son unité).
- Expédition : le secrétariat courrier habilité sur le registre.

**Étapes**

1. *Rédacteur* : cliquez sur « Courrier », puis sur l'onglet « Départs et actes ».
2. Cliquez sur « + Rédiger ». La fenêtre « Rédiger un départ ou un acte » s'ouvre.
3. Choisissez le « Registre » (par exemple « DEP — Courrier départ », « NS — Notes de service ») et la « Confidentialité ».
4. Saisissez l'« Objet », puis, si besoin, les « Destinataires (facultatif) » et le « Texte (facultatif) ».
5. (Facultatif) Choisissez l'« Agent concerné » et cochez « L’agent concerné doit confirmer sa prise de connaissance une fois l’acte signé. ».
6. (Facultatif) Joignez les « Annexes ».
7. Cliquez sur « Enregistrer le brouillon ». La fiche de l'acte s'ouvre, « Non numéroté », au statut « BROUILLON ».
8. Cliquez sur « Soumettre au visa » et confirmez. Le « Circuit de visa » s'affiche et l'acte passe « EN VISA » (ou directement « À SIGNER » s'il n'y a aucun viseur).
9. *Viseur* : ouvrez la notification « Acte à viser », ou « À faire » → « À viser ». Cliquez sur « Viser », ajoutez un commentaire si besoin, puis cliquez sur « Viser ». Pour demander une correction, cliquez sur « Renvoyer pour correction » et saisissez le motif.
10. *Rédacteur, si l'acte est renvoyé* : lisez le bandeau « Renvoyé pour correction », cliquez sur « Modifier », corrigez, cliquez sur « Enregistrer », puis sur « Resoumettre ».
11. *Signataire* : ouvrez la notification « Acte à signer », ou « À faire » → « À signer ». Cliquez sur « Signer », joignez si besoin l'« Acte signé scanné (facultatif) », puis cliquez sur « Signer ». Le numéro définitif s'affiche et le statut passe à « SIGNÉ ».
12. *Secrétariat courrier* : ouvrez la notification « Acte signé à expédier », ou « À faire » → « À expédier ». Cliquez sur « Expédier », choisissez le « Mode d’expédition », puis cliquez sur « Marquer expédié ».
13. *Agent concerné (le cas échéant)* : « À faire » → « À prendre en connaissance » → « J’ai pris connaissance » → confirmez.

**Résultat attendu / qui est prévenu**

- L'acte est « EXPÉDIÉ », avec son numéro, la date et le mode d'expédition.
- Le rédacteur a reçu « Acte signé ».
- L'agent concerné a reçu « Acte à prendre en connaissance ».

**Si ça bloque**

- Bandeau « Circuit à recalculer. » : le viseur a changé de poste. Le rédacteur clique sur « Resoumettre ».
- « Un Chef de Section ne signe pas… » : la signature revient au chef de division ou au chef de cellule, ou au DN / à la DNA.
- « Expédier » n'apparaît pas : seule une personne habilitée sur ce registre peut expédier, et seulement un acte signé.

**Captures associées**

- 07-courrier-03-actes.png
- 07-courrier-06-acte-en-visa.png
- 07-courrier-01-a-faire.png

---

### P17 Préparer un ordre de mission

**Qui / Avant de commencer**

- Le chef direct de l'agent (chef de section, chef de division, chef de cellule), le DN ou la DNA.
- Connaissez la destination, l'objet, les dates et, s'il y a lieu, le moyen de transport et les frais en francs guinéens.

**Étapes**

1. Dans le menu, groupe « Personnel », cliquez sur « Documents générés ».
2. Cliquez sur l'onglet « Ordres de mission ».
3. Cliquez sur « + Nouvel ordre de mission ».
4. Choisissez l'« Agent ».
5. Saisissez la « Destination » et l'« Objet de la mission ».
6. Renseignez « Départ » et « Retour ».
7. (Facultatif) Renseignez « Moyen de transport (facultatif) » et « Frais de mission en francs guinéens (facultatif) ».
8. Cliquez sur « Enregistrer l’ordre de mission ». Le message « Ordre de mission enregistré. » s'affiche ; la carte indique « Projet — acte non préparé » et les frais en toutes lettres.
9. Cliquez sur « Aperçu » pour vérifier le document (mention « PROJET — non signé »).
10. Cliquez sur « Préparer l’acte ».
11. Dans « Registre d’actes de la Direction », choisissez « OM — Ordres de mission » (ATT est présélectionné).
12. Cliquez sur « Créer l’acte ». Le message « Acte créé dans le module Courrier : visa, puis signature du DN ou de la DNA. » s'affiche ; la carte indique « Acte en cours (visa, signature) ».
13. Suivez l'acte dans « Courrier » → « Départs et actes » (parcours P16, à partir de l'étape 9).
14. Après la signature, la carte indique « Signé — n° … ». Cliquez sur « PDF » ou « Word » pour imprimer l'original.

**Résultat attendu / qui est prévenu**

- Les viseurs, puis le DN et la DNA, sont prévenus par le Courrier (« Acte à viser », « Acte à signer »).
- L'agent reçoit « Acte à prendre en connaissance » après la signature.
- Le gestionnaire logistique peut ensuite affecter un véhicule à la mission (module Logistique). Le véhicule s'affiche alors sur la carte.

**Si ça bloque**

- « + Nouvel ordre de mission » n'apparaît pas : vous n'avez aucun agent sous votre autorité directe.
- « La date de retour précède la date de départ. » : corrigez les dates.
- « L’acte existe déjà (en cours dans le module Courrier). » : l'acte a déjà été préparé ; suivez-le dans le Courrier.

**Captures associées**

- 06-documents-04-documents-generes.png
- 06-documents-05-ordre-de-mission.png

---

### P18 Produire une attestation de travail

**Qui / Avant de commencer**

- Le DRH.
- Le dossier de l'agent doit être à jour (matricule, grade, date d'entrée en service, fonction), car le texte est construit à partir de ces données.

**Étapes**

1. Dans le menu, groupe « Personnel », cliquez sur « Documents générés ». L'onglet « Attestations de travail » s'ouvre.
2. Dans « Agent », choisissez la personne.
3. Cliquez sur « Nouvelle attestation de travail ». Le message « Attestation créée : aperçu, puis préparation de l’acte à signer. » s'affiche.
4. Sur la carte, cliquez sur « Aperçu » et vérifiez le texte (mention « PROJET — non signé »).
5. Cliquez sur « Préparer l’acte ».
6. Dans « Registre d’actes de la Direction », laissez « ATT — Attestations ».
7. Cliquez sur « Créer l’acte ». La carte indique « Acte en cours (visa, signature) ».
8. L'acte suit le circuit du Courrier : visa éventuel de votre chef, puis signature du DN ou de la DNA (parcours P16).
9. Après la signature, la carte indique « Signé — n° … ».
10. Cliquez sur « PDF » ou « Word » pour l'original, ou sur « Transmettre ». Dans ce cas, choisissez le « Destinataire » (l'agent est proposé par défaut), ajoutez un message si besoin, puis cliquez sur « Envoyer ».

**Résultat attendu / qui est prévenu**

- L'agent reçoit « Acte à prendre en connaissance ». Il retrouve l'attestation dans son onglet « Attestations de travail » et confirme dans le Courrier par « J’ai pris connaissance ».
- Toute impression après la première porte « DUPLICATA ».

**Si ça bloque**

- « Réservé au DRH. » : seul le DRH crée les attestations.
- « Un stagiaire reçoit une attestation de stage, pas une attestation de travail. » : passez par le module Stagiaires.
- L'agent voit « Disponible une fois l’acte signé par la Direction. » : la signature n'a pas encore eu lieu.

**Captures associées**

- 06-documents-06-attestation-de-travail.png
- 06-documents-04-documents-generes.png

---

### P19 Produire un rapport d'activité

**Qui / Avant de commencer**

- Tout utilisateur (sauf stagiaire), pour son activité.
- Le chef de section, le chef de division et le chef de cellule pour leur unité ; le DN et la DNA pour toute la Direction.
- Les tâches doivent être à jour : le rapport n'est jamais ressaisi.

**Étapes**

1. Dans le menu, groupe « Personnel », cliquez sur « Documents générés ».
2. Cliquez sur l'onglet « Rapport d’activité ».
3. Dans « Périmètre », choisissez « Mon activité », votre section, division ou cellule, ou « Toute la Direction ».
4. Renseignez « Du » et « Au ».
5. Cliquez sur « Aperçu » pour lire le rapport (synthèse, tâches terminées, tâches en cours, activités du plan de travail).
6. Cliquez sur « PDF » ou « Word » pour le télécharger.
7. (Facultatif) Cliquez sur « Déposer en GED ». Le message « Document déposé dans la GED de votre division (statut Brouillon). » s'affiche ; cliquez sur « Ouvrir le document déposé » pour poursuivre (parcours P13).
8. (Facultatif) Cliquez sur « Transmettre », choisissez le « Destinataire », puis cliquez sur « Envoyer ».

**Résultat attendu / qui est prévenu**

- Le rapport porte « BROUILLON — usage interne, non citable ».
- Le destinataire d'une transmission reçoit un message avec le PDF joint.

**Si ça bloque**

- « Ce périmètre de rapport ne vous est pas ouvert. » : choisissez un périmètre de la liste.
- « La fin de la période précède son début. » : corrigez « Du » / « Au ».
- « Déposer en GED » n'apparaît pas : vous n'êtes rattaché(e) à aucune division ni cellule.

**Captures associées**

- 06-documents-07-rapport-activite.png
- 06-documents-04-documents-generes.png

---

### P20 Créer une réunion et réserver la salle

**Qui / Avant de commencer**
- Tout profil sauf le stagiaire.
- Connaissez la date, l'heure de début **et l'heure de fin** : sans heure de fin, aucune salle n'est proposée.
- Les invités doivent avoir un compte actif et ne pas être stagiaires.

**Étapes**
1. Dans le menu, cliquez « Réunions ». La liste des réunions s'affiche.
2. Cliquez « + Nouvelle réunion ». La fenêtre « Nouvelle réunion » s'ouvre.
3. Saisissez le « Titre » (2 caractères au moins).
4. Saisissez le « Début » (date et heure).
5. Saisissez la « Fin (optionnel) ». La liste « Réserver une salle » devient active.
6. Ouvrez « Réserver une salle » et choisissez une salle :
   - une salle sans mention est libre ;
   - « — soumise à validation » : la salle demande l'accord d'un gestionnaire ;
   - « — occupée : priorité hiérarchique sur … » : si vous la choisissez, un avertissement vous rappelle que la réservation de cette personne sera annulée.
7. Si vous ne voulez pas de salle, laissez « Aucune (lieu libre ci-dessous) » et remplissez « Lieu (optionnel) ».
8. Saisissez éventuellement l'« Ordre du jour (optionnel) ».
9. Dans « Participants », tapez le début d'un nom dans « Ajouter un participant… », puis cliquez sur la personne. Recommencez pour chaque invité.
10. Cliquez « Créer la réunion ». La réunion apparaît dans la liste.

**Résultat attendu / qui est prévenu**
- La réunion et la réservation de la salle sont enregistrées ensemble. Le lieu prend le nom de la salle.
- Chaque invité reçoit « Nouvelle réunion ».
- Si la salle demande une validation, les gestionnaires logistiques reçoivent « Réservation à valider », et la fiche affiche « Salle « X » en attente de validation par un gestionnaire. »
- Si vous avez pris la salle en priorité, l'ancien titulaire reçoit « Réservation annulée pour priorité » avec votre nom.
- 30 minutes avant le début, tous les participants reçoivent « Rappel de réunion ».

**Si ça bloque**
- « Indiquez l’heure de fin pour réserver une salle. » → Saisissez la « Fin ».
- « « X » est déjà réservée sur ce créneau : … » → La salle a été prise entre-temps : choisissez-en une autre. Rien n'a été enregistré.
- « Un stagiaire n’a pas accès aux réunions : il ne peut pas y être invité. » → Retirez le stagiaire de la liste des participants.

**Captures associées**
- 08-reunions-01-liste.png
- 08-reunions-02-nouvelle-reunion.png

---

### P21 Réserver une salle ou une ressource

**Qui / Avant de commencer**
- Tout profil sauf le stagiaire.
- Les ressources (salles, matériel de présentation) doivent avoir été créées par un gestionnaire logistique.
- Pour une réunion, préférez le parcours P20 : la salle est alors liée à la réunion.

**Étapes**
1. Dans le menu, cliquez « Logistique ».
2. Cliquez l'onglet « Réservations ». Le sous-onglet « Réserver » s'affiche.
3. Choisissez le « Jour ».
4. Saisissez l'heure « De » et l'heure « À ».
5. Dans « Ressource », choisissez « Salle », « Matériel de présentation » ou « Toutes ».
6. Cliquez « Voir les disponibilités ». Chaque ressource apparaît avec le badge « Libre » ou « Occupée ».
7. Sur une ressource « Libre », cliquez « Réserver ». Sur une ressource « Occupée » dont vous êtes le supérieur hiérarchique du titulaire, cliquez « Faire valoir la priorité ».
8. Dans la fenêtre, saisissez l'« Objet » (2 à 300 caractères).
9. Cliquez « Réserver », ou « Prendre le créneau » si vous faites valoir la priorité.

**Résultat attendu / qui est prévenu**
- Message « Réservation confirmée. », ou « Réservation enregistrée : en attente de validation par un gestionnaire. » pour une ressource à validation. L'écran passe à « Mes réservations ».
- Ressource à validation : les gestionnaires reçoivent « Réservation à valider », puis vous recevez « Réservation confirmée » ou « Réservation refusée ».
- En priorité : la réservation est confirmée tout de suite, et chaque titulaire évincé reçoit « Réservation annulée pour priorité » avec votre nom.
- Pour annuler plus tard : « Mes réservations » → cliquez la réservation → « Annuler la réservation » (avant le début).

**Si ça bloque**
- « Priorité impossible : <nom> n’est pas sous votre autorité hiérarchique. » → Choisissez un autre créneau ou une autre ressource.
- « Priorité impossible : le DN et la DNA sont pairs pour la priorité, aucun ne prend le créneau de l’autre. » → Entendez-vous directement avec l'autre membre de la Direction.
- « Le créneau est déjà commencé ou passé. » → Choisissez un créneau futur.

**Captures associées**
- 09-logistique-02-reservations.png
- 09-logistique-06-reserver.png

---

### P22 Demander des fournitures, valider, servir

**Qui / Avant de commencer**
- Demandeur : tout profil sauf le stagiaire.
- Validation : le chef direct du demandeur, si la catégorie de l'article exige l'accord du chef.
- Traitement : un gestionnaire logistique **autre que le demandeur**.
- L'article doit être « Proposé aux demandeurs ».

**Étapes — le demandeur**
1. Dans le menu, cliquez « Logistique ». L'onglet « Demandes » s'affiche.
2. Cliquez « + Nouvelle demande ». La fenêtre « Nouvelle demande logistique » s'ouvre.
3. Dans « Type », laissez « Fournitures ».
4. Choisissez l'« Article ».
5. Saisissez la « Quantité » (1 ou plus).
6. Saisissez l'« Objet » (3 caractères au moins) et, si besoin, la « Justification (facultatif) ».
7. Lisez la ligne « Circuit : … ».
8. Cliquez « Envoyer la demande ». Le message « Demande envoyée à votre chef pour validation. » ou « Demande transmise aux gestionnaires logistiques. » s'affiche.

**Étapes — le chef (si sa validation est requise)**
9. Cliquez la notification « Demande logistique à valider », ou allez dans « Logistique » → « Demandes » → « À valider ».
10. Cliquez la demande. Sa fiche s'ouvre.
11. Cliquez « Valider ». Le message « Demande validée : transmise aux gestionnaires. » s'affiche. Pour refuser : « Refuser », saisissez le « Motif (communiqué au demandeur) », puis cliquez « Refuser ».

**Étapes — le gestionnaire logistique**
12. Allez dans « Logistique » → « Demandes » → « À traiter ».
13. Cliquez la demande, puis « Prendre en charge ». Le statut devient « En traitement ».
14. Cliquez « Traiter ». La fenêtre « Traiter la demande » indique le stock disponible.
15. Saisissez la « Quantité remise (demandée : n) » et, si besoin, le « Compte rendu (facultatif) ».
16. Cliquez « Marquer traitée ». Le message « Demande traitée. » s'affiche.

**Résultat attendu / qui est prévenu**
- La quantité remise sort du stock automatiquement, si le stock de l'article est suivi.
- Le demandeur reçoit « Demande logistique traitée » (ou « Demande logistique refusée »).
- Si l'article passe sous son seuil, les gestionnaires reçoivent « Stock bas ».

**Si ça bloque**
- « Stock insuffisant pour « X » : … » → Le gestionnaire fait une « Entrée » dans l'onglet « Fournitures », ou remet une quantité moindre.
- « Vous ne pouvez pas traiter votre propre demande : un autre gestionnaire s’en charge. » → Un autre gestionnaire doit s'en charger.
- « Cette demande a changé d’état : rechargez-la. » → Rechargez la page.

**Captures associées**
- 09-logistique-01-accueil.png
- 09-logistique-05-nouvelle-demande-fournitures.png
- 09-logistique-07-fournitures-stock.png

---

### P23 Enregistrer un véhicule et un plein de carburant, affecter le véhicule à un ordre de mission et enregistrer le retour

**Qui / Avant de commencer**
- Gestionnaire logistique.
- Pour l'affectation, un ordre de mission doit déjà exister (« Documents générés »).
- Ayez sous la main l'immatriculation, la marque, le modèle, l'énergie et le compteur.

**Étapes — enregistrer le véhicule**
1. Dans le menu, cliquez « Logistique ».
2. Cliquez l'onglet « Véhicules ».
3. Cliquez « + Nouveau véhicule ».
4. Saisissez l'« Immatriculation », la « Marque » et le « Modèle ».
5. Choisissez l'« Énergie » (« Gazole » ou « Essence ») et saisissez le « Kilométrage du compteur ».
6. Cliquez « Ajouter le véhicule ». Le véhicule apparaît dans « Parc de véhicules » avec le badge « En service ».

**Étapes — enregistrer un plein**
7. Cliquez sur le véhicule. Sa fiche s'ouvre.
8. En bas de la fiche, vérifiez la « Date » (aujourd'hui par défaut, jamais dans le futur).
9. Saisissez les « Litres » (de 0,5 à 500).
10. Si le plein concerne une mission, choisissez-la dans « Mission (facultatif) ».
11. Saisissez le « Compteur » (au moins égal au compteur affiché).
12. Cliquez « Ajouter le plein ». Le plein apparaît dans « Pleins de carburant », et les tuiles « Compteur », « Consommation » et « Carburant » se mettent à jour.

**Étapes — affecter le véhicule à une mission puis enregistrer le retour**
13. Fermez la fiche. Dans la section « Ordres de mission », repérez la mission.
14. Dans sa liste déroulante, choisissez l'immatriculation du véhicule. L'affectation est enregistrée aussitôt, avec le compteur actuel comme kilométrage de départ.
15. Au retour du véhicule, cliquez « Enregistrer le retour » sur la ligne de la mission.
16. Saisissez le « Kilométrage au retour ».
17. Cliquez « Enregistrer le retour ». La ligne affiche « Retour enregistré » et « n km parcourus ».

**Résultat attendu / qui est prévenu**
- Le compteur du véhicule est à jour.
- Le véhicule apparaît sur l'ordre de mission, dont le document signé n'est pas modifié.
- Aucune notification n'est envoyée (à confirmer).

**Si ça bloque**
- « Le compteur ne recule pas : n km déjà enregistrés pour ce véhicule. » → Saisissez le compteur réel, au moins égal à n.
- « Ce véhicule est déjà affecté à la mission « X » sur ces dates. » → Choisissez un autre véhicule, ou enregistrez d'abord le retour de la mission « X ».
- « Ce véhicule n’est pas en service (panne, réparation ou réforme). » → Dans la fiche, remettez l'« État » sur « En service » si le véhicule est réparé.

**Captures associées**
- 09-logistique-03-vehicules.png
- 09-logistique-08-fiche-vehicule-pleins.png
- 06-documents-05-ordre-de-mission.png

---

### P24 Approuver une inscription et changer le rôle d'un compte

**Qui / Avant de commencer**
- Administrateur système, agissant en son nom propre (pas en intérim).
- Pour un poste de chef, vérifiez qu'il est libre. Sinon, changez d'abord le rôle de l'actuel titulaire, ou passez par l'onglet « Nominations ».

**Étapes — approuver une inscription**
1. Menu « Administration » → « Utilisateurs ».
2. Cliquez l'onglet « Inscriptions en attente » (la pastille rouge indique le nombre de demandes).
3. Sur la carte de la personne, lisez « Poste déclaré » et « Souhaite ».
4. Cliquez « Approuver ». La fenêtre « Approuver l’inscription » s'ouvre.
5. Vérifiez ou corrigez le « Rôle attribué ».
6. Complétez le rattachement (champs marqués *).
7. Dans « Agent (dossier RH) », choisissez l'agent existant. Sinon, laissez « Nouvel agent, créé avec ce compte » et saisissez le matricule s'il est connu.
8. Cliquez « Approuver ». La demande quitte la liste et le compte apparaît dans « Tous les comptes ».

Pour refuser une demande : « Rejeter » → saisissez le « Motif (facultatif, repris dans l’email) » → cliquez « Rejeter la demande ».

**Étapes — changer le rôle d'un compte**
9. Cliquez l'onglet « Tous les comptes ».
10. Sur la ligne du compte (actif), cliquez « Changer de rôle ».
11. Choisissez le « Nouveau rôle ».
12. Complétez le rattachement demandé.
13. Saisissez éventuellement l'« Intitulé du poste (facultatif) ».
14. Saisissez le « Motif (obligatoire) » (5 caractères au moins).
15. Cliquez « Voir les effets ». L'aperçu s'affiche : suppléances révoquées ou conservées, accès au courrier, circuits de visa, éléments conservés, chef de cellule, sessions fermées.
16. Lisez l'aperçu. Si vous voulez corriger, cliquez « Modifier ».
17. Cliquez « Confirmer le changement ».

**Résultat attendu / qui est prévenu**
- **Approbation** : la personne reçoit un email avec son rôle, son unité et un bouton « Se connecter ».
- **Rejet** : la personne reçoit un email lui indiquant qu'elle peut refaire une demande.
- **Changement de rôle** :
  - la personne est déconnectée et reçoit « Votre rôle a changé » ;
  - les DRH reçoivent « Changement de rôle d’un agent » ;
  - les personnes dont la suppléance est révoquée reçoivent « Suppléance révoquée » ;
  - le changement est inscrit à l'historique de carrière et au journal d'audit.

**Si ça bloque**
- « Cette division a déjà un Chef de Division actif : X. … » → Changez d'abord le rôle de X.
- « Réaffectez d’abord l’assistant(e) de ce compte … » → Changez d'abord le rattachement de l'assistant(e).
- « Le rôle de ce compte a changé entre-temps … » → Fermez la fenêtre, rechargez la page et recommencez.

**Captures associées**
- 11-admin-01-utilisateurs.png
- 11-admin-10-changer-de-role.png
- 11-admin-02-nominations.png
- 11-admin-03-confirmer-nomination.png

---

### P25 Consulter la supervision et vérifier l'intégrité du journal d'audit

**Qui / Avant de commencer**
- Supervision : administrateur système, DN, DNA.
- Vérification de l'intégrité : administrateur système uniquement, en son nom propre.

**Étapes — supervision**
1. Menu « Administration » → « Paramétrage et supervision ». Vous pouvez aussi cliquer le lien d'une alerte « Supervision : service en difficulté ».
2. Cliquez l'onglet « Supervision ».
3. Lisez l'« État général » (« NOMINAL », « DÉGRADÉ » ou « INDISPONIBLE ») et l'heure du relevé.
4. Parcourez les 9 cartes de services et lisez le détail de celles qui ne sont pas « NOMINAL ».
5. Consultez « Sessions ouvertes », « Connexions (24 h) » et « Sauvegardes ».
6. Parcourez « Tâches planifiées » : repérez les badges « ÉCHEC » et les mentions « n échec(s) en 24 h ».
7. Parcourez « Comptes à surveiller ».
8. Dans « Accès refusés », choisissez la « Période » (« 24 heures », « 7 jours » ou « 30 jours »).
9. Administrateur : après un essai de restauration, cliquez « Déclarer un test de restauration », remplissez « Date du test » et « Résultat », puis cliquez « Déclarer ».
10. Cliquez « Actualiser » pour obtenir un nouveau relevé.

**Étapes — vérifier l'intégrité du journal d'audit**
11. Menu « Administration » → « Journal d’audit ».
12. Cliquez « Vérifier l’intégrité ».
13. Lisez le bandeau : « Chaîne intacte : n entrées scellées vérifiées… » ou « Chaîne rompue à l’entrée n° r : le journal a été altéré en dehors de l’application. »

**Résultat attendu / qui est prévenu**
- Le résultat de la vérification apparaît aussi dans la supervision, au service « Journal d’audit ».
- Une chaîne rompue fait passer ce service à « INDISPONIBLE », et les administrateurs reçoivent l'alerte « Supervision : service en difficulté ».

**Si ça bloque**
- Le bouton « Vérifier l’intégrité » n'apparaît pas → Vous n'êtes pas administrateur système, ou vous êtes en intérim.
- Le bouton « Déclarer un test de restauration » n'apparaît pas → Il est réservé à l'administrateur système.
- « Chaîne rompue… » → Prévenez immédiatement le responsable de l'exploitation : le journal ne se corrige pas depuis l'application.

**Captures associées**
- 11-admin-06-supervision.png
- 11-admin-07-journal-audit.png
- 11-admin-09-verifier-integrite-audit.png

---

## 5. Questions fréquentes et dépannage

Les situations bloquantes réelles relevées dans l'application, et leur solution.

### Questions fréquentes — Accès et interface

**« Quelle est l'adresse du SI DNPEC ? »**
→ L'adresse définitive vous est communiquée par l'administrateur système (CSID). L'adresse prévue est https://dnpec-web.onrender.com.

**« La page met longtemps à s'ouvrir le matin, ou j'ai le message « Le serveur de l'application ne répond pas… ». »**
→ Après environ 15 minutes sans utilisation, le site se « réveille » en 50 secondes environ. Patientez, puis cliquez sur « Réessayer » ou rechargez la page. Si le message persiste, prévenez l'administrateur système.

**« J'ai envoyé ma demande d'accès mais je ne peux pas me connecter. »**
→ Le message « Votre demande d'accès est en cours d'examen par un administrateur… » signifie que la demande n'est pas encore approuvée. Attendez l'email « Votre compte SI DNPEC est activé », en regardant aussi dans vos courriers indésirables, ou relancez l'administrateur système.

**« On me répond « Un compte existe déjà avec cet email ». »**
→ Un compte existe déjà avec cette adresse. Connectez-vous, ou utilisez « Mot de passe oublié ? ». Si le compte est suspendu ou en attente, voyez l'administrateur système.

**« Ma demande d'accès est refusée à l'étape « Récapitulatif » à cause du rattachement. »**
→ Revenez à l'étape 3 avec « ← Retour » et choisissez une seule option : division, cellule ou personne assistée. Un chef de section doit choisir sa section. Le DN et le DNA ne déclarent aucun rattachement.

**« Ma cellule n'est pas dans la liste de l'inscription. »**
→ Seules les cellules SAF, RH et CSID peuvent être déclarées. Choisissez l'unité la plus proche : l'administrateur fixera votre vrai rattachement à l'approbation.

**« La personne que j'assiste n'apparaît pas. »**
→ Seuls le DN, le DNA et les chefs de cellule dont le compte est actif sont proposés. Attendez l'activation de leur compte, ou demandez à l'administrateur de créer votre compte.

**« J'ai reçu un email disant que ma demande n'a pas été retenue. »**
→ Votre demande a été supprimée. Lisez le motif s'il est indiqué, puis refaites une demande avec « Demander l'accès » en corrigeant les informations.

**« Mon mot de passe est refusé alors qu'il a 8 caractères. »**
→ L'administrateur a peut-être relevé le minimum, jusqu'à 32 caractères. Le message « Le mot de passe doit contenir au moins N caractères. » indique la longueur exigée.

**« On me répond « Identifiants invalides ». »**
→ Vérifiez l'adresse e-mail (c'est votre identifiant) et le mot de passe (attention aux majuscules). Sinon, utilisez « Mot de passe oublié ? ».

**« Mon compte est bloqué : « Trop de tentatives échouées… Réessayez dans N min. » »**
→ Après 5 échecs en 15 minutes, l'accès est bloqué 15 minutes. Attendez le délai indiqué, puis utilisez « Mot de passe oublié ? » si vous n'êtes pas sûr du mot de passe.

**« Je ne reçois pas l'email de réinitialisation. »**
→ Vérifiez l'adresse saisie et vos courriers indésirables. L'email n'est envoyé qu'à un compte actif. Sinon, demandez à l'administrateur de cliquer sur « Envoyer un lien de réinitialisation par email » ou de définir un mot de passe temporaire.

**« Le lien de réinitialisation ne marche plus. »**
→ Le message « Lien de réinitialisation invalide ou expiré » signifie que le lien a plus d'une heure, qu'il a déjà servi ou qu'un lien plus récent l'a remplacé. Redemandez un lien et utilisez le dernier reçu.

**« Le lien « Choisir mon mot de passe » de mon email de création a expiré. »**
→ Ce lien vaut 7 jours. Utilisez « Mot de passe oublié ? » sur la page de connexion, ou le mot de passe provisoire donné par l'administrateur.

**« On me dit « Trop de demandes de réinitialisation. Réessayez dans une heure. » »**
→ Vous avez dépassé 5 demandes en une heure. Attendez une heure et utilisez le dernier email reçu.

**« Mon compte est « suspendu » ou « supprimé ». »**
→ Seul l'administrateur système peut le réactiver. Contactez-le.

**« J'ai perdu ou changé de téléphone et je n'ai plus mes codes. »**
→ Demandez à l'administrateur système de cliquer sur « Réinitialiser la double authentification ». Reconnectez-vous ensuite avec votre seul mot de passe, puis réactivez-la (parcours 4.0).

**« Mon code de double authentification est refusé. »**
→ Saisissez le code affiché en ce moment, dans les 5 minutes qui suivent le mot de passe, et vérifiez que l'heure de votre téléphone est juste. Si l'application affiche « Jeton invalide ou expiré », recommencez la connexion.

**« J'ai été déconnecté sans rien faire. »**
→ Après 30 jours sans utilisation, il faut se reconnecter. Toutes vos sessions sont aussi fermées après un changement de mot de passe ou une réinitialisation de la double authentification. Reconnectez-vous : la page que vous vouliez ouvrir s'ouvrira directement.

**« Une fenêtre « Confirmez votre identité » me demande mon mot de passe. »**
→ Vous ouvrez un élément protégé. Saisissez votre mot de passe, et le code de l'application si la double authentification est active. La confirmation vaut 10 minutes.

**« Je tombe sur « Page introuvable ». »**
→ Le lien est erroné ou la page n'existe plus. Cliquez sur « Retour au tableau de bord ».

**« Une page reste sur un bandeau rouge avec « Réessayer ». »**
→ Le chargement a échoué, par exemple à cause d'une coupure réseau. Cliquez sur « Réessayer ». Si le problème continue, prévenez l'administrateur système.

**« Je ne vois pas une entrée de menu que mon collègue a. »**
→ Le menu dépend de votre rôle, de vos rôles fonctionnels (DRH, gestionnaire RH) et du fait d'être stagiaire (voir 2.2). Le secrétariat courrier et le gestionnaire logistique n'ajoutent pas d'entrée : leurs fonctions sont dans « Courrier » et « Logistique ». Pour obtenir un rôle ou une habilitation, adressez-vous à l'administrateur système ou au DRH.

**« Je suis stagiaire et l'application affiche « Cette fonctionnalité n'est pas accessible aux stagiaires. » »**
→ C'est normal : un stagiaire n'a accès qu'au tableau de bord, à ses tâches, à la communication, à son dossier, à « Mon stage » et à l'aide. Adressez-vous à votre encadreur.

**« Je ne trouve pas la barre de recherche. »**
→ Elle est absente pour les stagiaires. Pour les autres, elle se trouve en haut de l'écran : tapez au moins 3 caractères puis appuyez sur Entrée.

**« La recherche ne trouve pas un congé, une instruction ou un dossier. »**
→ La recherche ne couvre ni les dossiers du personnel, ni les congés, ni les instructions, ni les plis personnels. Ouvrez le module concerné et utilisez ses filtres.

**« Le bouton « Agir en intérim pour… » n'apparaît pas. »**
→ Il n'apparaît que pendant une suppléance en cours et conforme. Vérifiez les dates dans « Suppléances » ou auprès du titulaire.

**« Mon intérim s'est arrêté avec un bandeau rouge « Intérim pour X interrompu… ». »**
→ La suppléance a expiré, a été révoquée ou n'est plus conforme (« …règle de rang comparable ; elle doit être redésignée. »). Demandez au titulaire de vous désigner à nouveau.

**« Je reçois trop d'emails, ou pas assez vite. »**
→ Ouvrez 🔔 « Préférences de notification » en bas du menu. Choisissez « Résumé quotidien » à l'heure voulue, ou « Tout immédiatement ». Les alertes urgentes (Annexe B) restent toujours immédiates.

**« Le compteur de la cloche ne bouge pas. »**
→ Il se met à jour chaque minute et à chaque changement de page, mais pas quand l'onglet est caché. Revenez sur l'onglet ou changez de page.

**« Je ne retrouve pas une ancienne notification. »**
→ La cloche montre les 50 dernières notifications. Retrouvez l'élément depuis son module (tâche, congé, courrier…).

**« Sur mon téléphone, je ne vois pas le menu. »**
→ Touchez ☰ « Ouvrir le menu » en haut à gauche. Le menu se referme quand vous ouvrez une page ou quand vous touchez ✕.

**« Ma demande d'accès est refusée avec « Trop de demandes d'inscription depuis cette adresse. Réessayez dans une heure. » »**
→ Plus de 30 demandes ont été faites en une heure depuis le même accès Internet (bureau partagé). Attendez une heure, ou demandez à l'administrateur de créer les comptes.
### Questions fréquentes — Tâches, plan de travail, instructions, communication

**« Je ne trouve pas le bouton pour créer une tâche dans « Mes tâches ». »**
→ C'est normal : la création se fait depuis le « Tableau de bord », bouton « + Nouvelle tâche ». Vous pouvez aussi créer une tâche depuis la fiche d'une activité du « Plan de travail » (« + Nouvelle tâche ») ou, si vous êtes chef, depuis l'« Annuaire » (« Assigner une tâche »).

**« Où est le bouton « Diffuser à une division » ? »**
→ Sur le « Tableau de bord », à côté de « + Nouvelle tâche ». Seuls le DN, la DNA et le chef de division (pour sa propre division) le voient.

**« Je suis stagiaire et je ne peux ni créer de tâche ni exporter. »**
→ C'est voulu. Votre tuteur ou votre chef crée la tâche et vous l'assigne. Vous pouvez ensuite la démarrer, la commenter, y joindre des fichiers et la soumettre.

**« Le bouton « Créer la tâche » reste grisé. »**
→ Le « Titre » est vide. Saisissez au moins 2 caractères.

**« L'application refuse quand j'assigne un collègue. »**
→ Vous ne pouvez assigner que les personnes sur lesquelles vous avez autorité (votre unité si vous êtes chef ; tout le monde pour le DN et la DNA). Un chargé d'études, un(e) assistant(e) de direction, le DRH ou l'administrateur système ne peuvent assigner une tâche qu'à eux-mêmes. Créez la tâche sans personne assignée, ou demandez au chef concerné de la créer.

**« Comment ajouter une personne à une tâche déjà créée, modifier son titre ou la supprimer ? »**
→ Ce n'est pas possible à l'écran actuellement. Les personnes assignées se choisissent à la création. Si besoin, créez une nouvelle tâche correcte.

**« Comment rendre une tâche confidentielle ? »**
→ Ce choix n'est pas proposé à l'écran actuellement : une tâche créée depuis l'écran est toujours « Public interne ». Seules les tâches issues d'un courrier confidentiel sont créées automatiquement au niveau « Très confidentiel ».

**« Je ne vois pas « Soumettre pour validation ». »**
→ Démarrez d'abord la tâche (« Démarrer »). Si elle est déjà « En cours », vous êtes probablement « Collaborateur » et non « Responsable » de la tâche : c'est le responsable ou le créateur qui soumet.

**« L'application m'empêche de soumettre : « Cette tâche exige au moins une pièce jointe… ». »**
→ La case « Document obligatoire avant soumission pour validation » a été cochée à la création. Déposez votre fichier dans « Pièces jointes » → « Ajouter », puis soumettez.

**« Je ne vois pas les boutons « Valider » et « Rejeter » sur une tâche soumise. »**
→ Vous êtes assigné(e) à cette tâche : personne ne valide sa propre tâche. La validation revient au créateur, ou à un chef qui a autorité sur toutes les personnes assignées.

**« En tant que chef, l'application refuse ma validation. »**
→ Une des personnes assignées n'appartient pas à votre unité. Laissez le créateur de la tâche, ou le DN ou la DNA, décider.

**« Le bouton « Confirmer le rejet » est grisé. »**
→ Rédigez un motif d'au moins 2 caractères : il sera montré à la personne assignée.

**« Comment modifier le pourcentage d'avancement ? »**
→ Vous ne le saisissez pas : il se calcule tout seul. Sans sous-tâche, il vaut 0 % (à faire), 50 % (en cours), 90 % (soumise) ou 100 % (terminée). Avec des sous-tâches, il correspond à la part des sous-tâches cochées.

**« J'ai tapé une sous-tâche, appuyé sur Entrée, et rien ne s'est passé. »**
→ Seuls le créateur de la tâche principale et son supérieur direct peuvent ajouter une sous-tâche. Actuellement, l'écran n'affiche aucun message dans ce cas. Demandez au créateur de la tâche de l'ajouter.

**« Une sous-tâche qui m'est confiée n'apparaît pas dans « Mes tâches ». »**
→ « Mes tâches » ne montre que les tâches principales. Ouvrez la tâche principale : vos sous-tâches sont dans la rubrique « Sous-tâches ».

**« En ouvrant le lien d'une notification, je lis « Tâche hors de votre périmètre ». »**
→ Vous n'avez plus accès à cette tâche (changement d'unité, tâche confidentielle…). Demandez à son créateur de vous l'assigner si vous devez y travailler.

**« Je reçois des messages « Échéance demain » et mon chef a reçu « Tâche en retard ». »**
→ Chaque jour à 7 h, les personnes assignées sont prévenues la veille de l'échéance. Si l'échéance est dépassée, le chef le plus proche de chacun reçoit une alerte immédiate. Chaque alerte n'est envoyée qu'une fois par tâche.

**« L'export Excel ne contient pas la même chose que l'écran. »**
→ L'écran « Suivi des tâches » se limite aux 300 tâches aux échéances les plus proches et aux tâches terminées depuis moins de 30 jours. L'export donne toutes les tâches que vous avez le droit de voir.

**« L'export affiche « Export impossible ». »**
→ Reconnectez-vous puis réessayez. Si le problème persiste, prévenez l'administrateur système.

**« Il n'y a pas de menu « Projets ». »**
→ Aucun écran Projets n'existe. Pour regrouper le travail, utilisez le « Plan de travail » (objectifs, activités, tâches) et le « Tableau de bord ».

**« Le champ « Activité du plan de travail » n'apparaît pas dans « Nouvelle tâche ». »**
→ Aucune activité de plan de travail ne vous est accessible (en cours, ou terminée depuis moins d'un mois). Demandez à votre chef d'unité de créer l'activité.

**« Je ne vois pas « + Nouvel objectif », « + Activité » ou « Modifier » dans le plan de travail. »**
→ Seul le chef de l'unité (le chef de division aussi pour ses sections), ainsi que le DN et la DNA, gèrent le plan. Les autres le consultent.

**« Je ne peux pas supprimer un objectif ou une activité. »**
→ Un objectif ne se supprime que s'il n'a plus d'activité. Une activité ne se supprime que si aucune tâche n'y est rattachée. Actuellement, détacher une tâche d'une activité n'est pas proposé à l'écran.

**« L'enregistrement de mon activité est refusé avec un message en anglais. »**
→ Un champ est trop court. Le plus souvent, c'est l'« Indicateur » : l'écran accepte 2 caractères, mais il en faut au moins 3. Ces contrôles de longueur s'affichent actuellement en anglais.

**« La personne que je veux nommer responsable n'est pas dans la liste. »**
→ Seuls les membres actifs de l'unité (et de ses sous-unités), hors stagiaires, sont proposés. Faites vérifier son rattachement par le DRH ou l'administrateur système.

**« Je ne vois pas « + Nouvelle instruction ». »**
→ Seuls le DN et la DNA émettent des instructions.

**« Pour exécuter une instruction, la liste des actes est vide. »**
→ L'instruction concerne un agent : elle s'exécute par un acte signé dont cet agent est bénéficiaire et que vous avez rédigé. Préparez l'acte dans « Courrier » ou « Documents générés », faites-le signer, puis revenez sur l'instruction.

**« L'agent concerné dit ne pas voir l'instruction. »**
→ C'est voulu : il ne la voit, dans l'onglet « Me concernant », qu'une fois l'instruction exécutée.

**« En tant que DN, je ne peux pas marquer exécutée l'instruction que j'ai émise. »**
→ Seul le destinataire fait avancer une instruction. Le destinataire est de toute façon relancé automatiquement tous les 7 jours.

**« Je lis « L'instruction vient de changer : rechargez-la ». »**
→ Quelqu'un a agi sur l'instruction en même temps que vous. Fermez la fiche et rouvrez-la.

**« Je ne vois pas « + Nouvelle annonce » ou « + Nouveau sondage ». »**
→ Ces boutons n'apparaissent que sur l'onglet concerné, et seulement pour le DN, la DNA, l'administrateur système et les chefs de division, de section et de cellule. Actuellement, ils ne sont pas proposés au DRH. Sinon, passez par votre chef, ou utilisez un fil de discussion.

**« L'application refuse « Toute la DNPEC » comme portée. »**
→ Cette portée est réservée au DN et à la DNA. Choisissez votre division, section ou cellule.

**« Je ne trouve pas l'onglet « Sondages ». »**
→ Les sondages ne sont pas ouverts aux stagiaires.

**« Le bouton « Publier le sondage » est grisé. »**
→ Saisissez la question et au moins deux options.

**« Je ne peux plus voter. »**
→ Le sondage est « Clôturé » : son auteur l'a fermé ou la date de clôture automatique est passée.

**« Comment savoir qui a lu mon annonce ? »**
→ Ouvrez l'annonce : « Lue par N personne(s) » s'affiche pour l'auteur, le DN, la DNA et l'administrateur système.

**« Comment corriger ou supprimer une annonce publiée ? »**
→ Ce n'est pas possible actuellement. Publiez au besoin une nouvelle annonce rectificative.

**« Je ne peux pas joindre une tâche ou un document à mon fil de discussion. »**
→ Vous ne pouvez joindre qu'un objet que vous pouvez vous-même ouvrir, et jamais un pli personnel. Les stagiaires ne peuvent pas joindre d'objet. Un participant qui n'a pas accès à l'objet verra « … joint(e) — vous n'y avez pas accès. ».

**« Un collègue ne trouve pas un fil dont on lui a parlé. »**
→ Seuls les participants voient un fil. Créez un nouveau fil qui l'inclut.

**« Mes anciens messages ont disparu. »**
→ Les messages directs et les messages de fils de plus de 3 ans sont effacés automatiquement chaque nuit. Rangez dans les archives ce qui doit être conservé plus longtemps.

**« Ma suggestion n'apparaît pas dans « Mes suggestions » et je n'ai reçu aucune réponse. »**
→ Vous l'avez envoyée anonymement : par principe, elle n'est rattachée à personne et aucun suivi ne vous est envoyé.

**« Je ne vois pas la « Boîte à suggestions » ni l'« Annuaire » dans mon menu. »**
→ Ces modules ne sont pas ouverts aux stagiaires.

**« Le bouton « Assigner une tâche » n'apparaît pas dans l'annuaire. »**
→ Il est réservé au DN, à la DNA et aux chefs de division, de section et de cellule. L'application refuse ensuite si la personne n'est pas dans votre unité.
### Questions fréquentes — Congés, suppléance, personnel, RH, stages

**« Je ne vois pas l'onglet « À traiter » dans Congés & absences. »**
→ Cet onglet n'existe que pour le DN, la DNA, les chefs de division, de section et de cellule, et le DRH. Un chargé d'études ou un assistant(e) de direction n'a pas de demande à traiter.

**« Je suis chef, mais la demande de mon agent n'est pas dans « À traiter ». »**
→ L'avis revient au chef **le plus proche** qui a un compte actif. Si un chef plus proche existe, ou si l'avis a déjà été donné, la demande se trouve dans « Suivi », en lecture seule.

**« Je suis DRH et une demande n'apparaît pas dans « À traiter ». »**
→ Vous décidez seulement après l'avis du chef, ou après le délai (l'avis est alors réputé favorable). Avant cela, la demande est dans « Suivi ». La demande d'un DRH est décidée par le DN ou la DNA, et personne ne décide sa propre demande.

**« Le message « L'avis du chef d'unité est attendu avant la décision. » s'affiche. »**
→ Attendez l'avis du chef, ou la fin du délai : 48 heures ouvrées par défaut. L'application vérifie les délais toutes les 15 minutes.

**« Je voulais donner mon avis, mais l'application dit « Le délai d'avis est dépassé : l'avis a été réputé favorable. ». »**
→ Le délai est passé. Vous aviez reçu un rappel 12 heures ouvrées avant. C'est maintenant le DRH qui décide.

**« Le bouton « Confirmer l'avis défavorable » ou « Confirmer le refus » est grisé. »**
→ Écrivez un motif d'au moins 2 caractères.

**« Le bouton « Soumettre la demande » est grisé. »**
→ Remplissez les deux dates, avec une fin qui ne précède pas le début, et choisissez un type de congé. Si la liste des types est vide, prévenez l'administrateur système : les types de congé ne se créent pas à l'écran.

**« Mon solde indique « Aucun solde provisionné pour cette année pour l'instant. ». »**
→ Votre droit annuel n'a pas encore été enregistré, et aucun écran ne permet de le faire (à confirmer). Adressez-vous à l'administrateur système. Vous pouvez quand même déposer une demande.

**« Ma demande compte plus de jours que prévu. »**
→ La durée comprend tous les jours de la période, week-ends compris. Seuls les jours fériés saisis dans l'onglet « Jours fériés » sont retirés.

**« Un jour férié n'a pas été retiré de mon congé. »**
→ Il n'était pas saisi dans le calendrier. Demandez au DRH ou à l'administrateur système de l'ajouter : le décompte est recalculé au moment de l'approbation.

**« Où joindre mon certificat médical ? »**
→ Il ne se joint pas dans la fenêtre de demande. Après l'envoi, cliquez sur « Joindre le certificat médical » sur la carte de votre demande, dans « Mes demandes ».

**« Mon chef ne voit pas mon certificat médical. »**
→ C'est voulu. Le certificat n'est lisible que par vous et le DRH. Votre chef voit le type et peut lire le motif après avoir saisi son mot de passe.

**« Le DN voit « Absence — motif protégé » au lieu de « Congé maladie ». »**
→ C'est le principe du « besoin d'en connaître ». Seuls le demandeur, le chef qui donne l'avis et le DRH voient la nature d'un congé maladie.

**« On me demande mon mot de passe pour « Afficher le motif » ou pour mon dossier. »**
→ Ce sont des éléments protégés. Saisissez votre mot de passe dans « Confirmez votre identité », ainsi que le code si la double authentification est active. La confirmation vaut 10 minutes.

**« Je n'ai pas reçu l'email « avis attendu ». »**
→ Ces messages arrivent tout de suite dans la cloche, mais par email dans le résumé quotidien. Seules la décision (approbation ou refus) et certaines alertes partent par email immédiatement.

**« Je n'ai pas l'entrée « Suppléances ». »**
→ La suppléance ne concerne que le DN, la DNA et les chefs de division, de section et de cellule.

**« La liste « Suppléant » affiche « Aucun suppléant possible ». »**
→ Personne de rang comparable n'a de compte actif. Revoyez la règle du rang comparable (3.10).

**« Ma suppléance est marquée « Non conforme — à redésigner ». »**
→ Un changement de rôle a rendu le binôme non conforme. Cliquez sur « Révoquer », puis désignez de nouveau quelqu'un de rang comparable.

**« Je ne trouve pas « Agir en intérim pour… ». »**
→ Ce menu n'apparaît que pendant une suppléance « En cours » et conforme. Vérifiez les dates dans « Mes intérims ».

**« En intérim, je ne peux pas décider un congé ou traiter le courrier du titulaire. »**
→ Le suppléant n'hérite ni des rôles fonctionnels (DRH…) ni des habilitations (secrétariat courrier, gestionnaire logistique). Il ne peut pas non plus agir sur le titulaire lui-même.

**« Je ne vois pas les informations personnelles d'un agent de mon équipe. »**
→ Elles sont réservées à l'agent et au DRH, même pour le DN et la DNA. Vous ne voyez que la « Situation administrative ».

**« Une information de mon dossier est fausse. »**
→ Cliquez sur « Signaler une erreur », choisissez l'« Information concernée », décrivez « Ce qui est inexact », puis cliquez sur « Envoyer au DRH ».

**« Je ne vois pas « Importer (Excel) ». »**
→ Cette fonction est réservée au DRH.

**« Il me manque des onglets dans Ressources humaines. »**
→ Les onglets dépendent de votre rôle :
- « Effectifs » : DRH, DN, DNA ;
- « Alertes » et « Pièces requises » : DRH ;
- « Formation » : chefs et Direction ;
- « Carrière et actes » et « Fiches de poste » : tout le monde.

**« Une alerte RH ne disparaît pas. »**
→ Les alertes se recalculent à chaque ouverture et disparaissent dès que leur cause est réglée. Pour une pièce manquante, il faut l'ajouter au dossier en la choisissant dans « Pièce requise fournie ».

**« « Préparer l'acte » affiche « Choisissez d'abord le registre de la famille… ». »**
→ Dans « Carrière et actes » → « Familles d'actes », choisissez le registre de cette famille. Seuls le DRH et l'administrateur système peuvent le faire.

**« Mon mouvement reste « Acte en cours ». »**
→ L'acte est créé en brouillon. Cliquez sur « Voir l'acte », puis sur « Soumettre au visa » dans le Courrier. Il faut ensuite le visa, puis la signature du DN ou de la DNA. Pour annuler le mouvement, annulez d'abord l'acte dans le Courrier.

**« « Un mouvement de ce type est déjà en cours pour cet agent. ». »**
→ Terminez ou annulez le mouvement « Préparé » ou « Acte en cours » du même type.

**« Je ne peux pas muter un chef de section. »**
→ La mutation ne concerne que les chargés d'études, le DRH et l'administrateur système. Un chef, un assistant(e) de direction ou un membre de la Direction change de poste par le changement de rôle, dans « Utilisateurs ».

**« L'acte de nomination est signé, mais le nouveau chef n'a pas ses droits. »**
→ Les droits attendent l'administrateur système : « Utilisateurs » → onglet « Nominations » → « Confirmer… ». Le mouvement affiche « Droits en attente (administrateur) » d'ici là. Après la confirmation, la personne doit se reconnecter.

**« La confirmation de la nomination échoue. »**
→ Lisez « Dernière tentative : … » sous la ligne : rien n'a été appliqué. Pour un poste de DN ou de DNA occupé, choisissez le rôle de l'actuel titulaire. Si le compte nommé n'est plus actif, refusez la nomination avec un motif.

**« L'onglet « Nominations » signale des écarts. »**
→ La fonction du dossier et le rôle du compte ne correspondent pas. Chaque ligne indique qui doit agir : l'administrateur système (rôle du compte), ou le DRH (fonction, par un acte).

**« Je ne vois pas « + Exprimer un besoin ». »**
→ Ce bouton est réservé aux chefs, au DN et à la DNA, et seulement si votre unité est retrouvée dans l'organigramme. Sinon, faites corriger votre rattachement.

**« Je ne vois pas l'entrée « Agents ». »**
→ Elle est réservée au DRH et au gestionnaire RH.

**« Un agent est passé « Parti » tout seul. »**
→ Sa fin de contrat ou de stage était dépassée sans décision. Le DRH peut cliquer sur « Réactiver » en indiquant une nouvelle date de fin.

**« « Capacité d'accueil atteinte pour … ». »**
→ L'unité a déjà son maximum de stagiaires sur ces dates. Une période en section compte aussi pour sa division. Changez les dates ou l'unité, ou demandez au DRH de relever la capacité.

**« Je suis stagiaire et je ne peux pas déposer mon rapport. »**
→ Le DRH doit d'abord désigner votre encadreur principal. Le rapport se dépose pendant le stage ou à sa fin, et une seule version à la fois : attendez la validation ou une demande de reprise.

**« Je suis stagiaire et je ne vois pas mon évaluation. »**
→ Elle s'affiche une fois « Visée » par le responsable de l'unité.

**« Le DRH ne trouve pas d'encadreur dans la liste. »**
→ L'encadreur se choisit parmi les tuteurs du plan. Il faut d'abord qu'une période ait été acceptée avec un tuteur.

**« Je ne peux pas clôturer le stage. »**
→ Des périodes ne sont pas terminées. Attendez leur fin, ou utilisez « Interrompre ».

**« « Préparer l'attestation finale » n'apparaît pas. »**
→ Le stage doit être clôturé ou interrompu, et aucune attestation ne doit déjà être en cours dans le Courrier.

**« Je suis stagiaire et je n'ai pas accès aux congés. »**
→ Les congés, les ressources humaines, le courrier et la logistique ne sont pas ouverts aux stagiaires (« Cette fonctionnalité n'est pas accessible aux stagiaires. »). Vous avez accès au tableau de bord, à vos tâches, à la communication, à votre dossier, à « Mon stage » et à l'aide.
### Questions fréquentes — Documents, documents générés, courrier

**« Le bouton « Envoyer » reste grisé quand je dépose un document. »**
→ Il manque un élément obligatoire : « Titre », « Type », « Période couverte : du », « au » ou « Fichier ». Remplissez-les tous.

**« Je ne vois pas le bouton « + Nouveau document ». »**
→ Vous êtes dans l'onglet « Documents publiés (DNPEC) ». Revenez à « Mon espace division » (ou « Mon espace cellule »).

**« Je ne vois pas le bouton « Valider ». »**
→ Seuls le chef de l'unité productrice, le DN et la DNA valident, et seulement un document au statut « Brouillon ». Demandez à votre chef de division ou de cellule.

**« On me répond « Seul un document marqué « Final » peut être validé. » »**
→ Le créateur du document (ou son supérieur direct) doit d'abord cliquer sur « Marquer comme final ».

**« Le document affiche « Métadonnées à compléter avant toute validation. » »**
→ La période couverte manque. Remplissez « Du » et « Au » dans l'encadré, puis cliquez sur « Enregistrer les métadonnées ».

**« Mon document validé est redevenu « Brouillon ». »**
→ Une nouvelle version a été ajoutée. C'est automatique : faites-le valider à nouveau.

**« Je suis chef de division et je ne peux pas rendre le document diffusable. »**
→ Seuls le DN et la DNA rendent un document « Diffusable ».

**« Le bouton « Confirmer le retrait » est grisé. »**
→ Le motif doit faire au moins 5 caractères.

**« Je suis DN (ou DNA) et je ne trouve pas un document d'une division. »**
→ Un document privé n'est lisible que par les membres de l'unité (besoin d'en connaître). Le chef de l'unité doit le publier avec « Publier (toute la DNPEC) ».

**« Je ne peux pas créer de dossier dans l'espace de ma cellule. »**
→ Les dossiers n'existent que pour les divisions. Classez vos documents avec le « Type » et la « Catégorie (classement) ».

**« L'onglet « Attestations de travail » n'apparaît pas. »**
→ Il est visible du DRH et des agents qui ont déjà une attestation. Adressez votre demande au DRH.

**« Je ne vois pas « + Nouvel ordre de mission ». »**
→ Vous n'avez aucun agent sous votre autorité directe. L'ordre est établi par le chef direct de l'agent, le DN ou la DNA.

**« La liste « Registre d’actes de la Direction » affiche « Aucun registre d’actes actif ». »**
→ Aucun registre d'actes de la Direction n'est actif. L'administrateur système doit en créer ou en réactiver un (« Administration » → « Courrier »).

**« Mon ordre de mission est parti dans le registre des attestations. »**
→ « ATT » est présélectionné : choisissez « OM — Ordres de mission » avant « Créer l’acte ». Si l'acte est déjà créé, faites-le annuler (avec un motif) dans le Courrier, puis cliquez de nouveau sur « Préparer l’acte ».

**« On me dit « L’acte existe déjà (en cours dans le module Courrier). » »**
→ L'acte a déjà été préparé. Suivez-le dans « Courrier » → « Départs et actes ». Pour le refaire, il faut d'abord l'annuler.

**« Mon attestation affiche « Disponible une fois l’acte signé par la Direction. » »**
→ L'acte n'est pas encore signé par le DN ou la DNA. Vous serez prévenu(e) par « Acte à prendre en connaissance ».

**« Pourquoi mon document imprimé porte-t-il « DUPLICATA » ? »**
→ Ce n'est pas la première impression d'un document signé (téléchargement, transmission ou dépôt en GED). Pour simplement consulter, utilisez « Aperçu », qui n'est pas compté.

**« On me répond « Ce périmètre de rapport ne vous est pas ouvert. » »**
→ Vous ne pouvez produire le rapport que de votre activité ou de l'unité que vous dirigez. Choisissez un périmètre proposé dans la liste.

**« Je ne vois pas « + Enregistrer un courrier ». »**
→ Vous n'êtes pas habilité(e) au secrétariat courrier pour un registre d'arrivée. Demandez l'habilitation à l'administrateur système.

**« L'enregistrement est refusé avec « Date anormale : … ». »**
→ La date de réception est dans le futur, ou le courrier est daté après sa réception. Corrigez la date, ou cochez « Je confirme cette date » et saisissez le motif.

**« Je me suis trompé(e) en enregistrant un courrier : comment le supprimer ? »**
→ Un courrier enregistré ne se supprime pas. Utilisez « Corriger » (le numéro ne change pas), ou « Annuler l’enregistrement » avec un motif (le numéro reste consommé).

**« Je ne vois pas le bouton « Imputer ». »**
→ Seuls le DN et la DNA (registre de la Direction), ou le chef de l'unité (registre d'unité), imputent. Un pli personnel doit d'abord être requalifié par son destinataire ; un courrier classé ou annulé ne s'impute plus.

**« La liste « Imputer à » est vide (« Personne à qui imputer »). »**
→ Pour un registre d'unité, seuls les membres de l'unité sont proposés. Les personnes déjà imputées, l'administrateur système et les stagiaires sont exclus.

**« Je ne peux pas classer le courrier. »**
→ Toutes les imputations « Pour attribution » doivent être marquées traitées. Un pli personnel n'est classé que par son destinataire.

**« Je n'arrive pas à requalifier mon pli personnel. »**
→ Cliquez d'abord sur « Compléter le pli » pour saisir l'objet, puis sur « Requalifier ». Attention : ce choix est définitif.

**« En intérim (ou comme assistant(e)), je ne vois pas un courrier confidentiel. »**
→ C'est le besoin d'en connaître : un rôle emprunté ne suffit pas. Le titulaire doit vous ouvrir un accès dans la rubrique « Accès délégués » (« Ouvrir un accès »).

**« Je ne peux pas convertir l'imputation en tâche. »**
→ Seul l'auteur de l'imputation peut le faire, une seule fois, et une échéance est obligatoire.

**« L'acte affiche « Circuit à recalculer. » »**
→ Le viseur attendu a changé de poste. Le rédacteur clique sur « Resoumettre » ; le circuit est recalculé.

**« On me dit « Anomalie d’organisation : deux chefs actifs… ». »**
→ Deux chefs occupent le même poste dans l'organisation. Prévenez l'administrateur système.

**« Je suis chef de section et je ne peux pas signer. »**
→ Un chef de section vise mais ne signe jamais. La signature revient au chef de division ou au chef de cellule (registre de l'unité), ou au DN ou à la DNA.

**« Je suis DN et je ne peux pas signer cet acte. »**
→ Vous en êtes le bénéficiaire : le bénéficiaire d'un acte ne le signe jamais. La DNA le signe.

**« Le bouton « Supprimer » a disparu de mon acte. »**
→ L'acte a déjà été soumis au visa. Il ne peut plus être que annulé, avec un motif (« Annuler l’acte »).

**« Je ne peux pas modifier mon acte. »**
→ Seul un acte au statut « Brouillon » ou « Renvoyé » se modifie. Pendant le visa, demandez au viseur de le « Renvoyer pour correction ».

**« Le bouton « Expédier » n'apparaît pas. »**
→ Seul le secrétariat courrier habilité sur ce registre expédie, et seulement un acte « Signé ».

**« Je ne reçois pas l'e-mail d'un courrier imputé tout de suite. »**
→ Les notifications ordinaires partent dans le résumé quotidien. « Acte à signer » et « Imputation en retard » partent immédiatement. Vous pouvez choisir « Tout immédiatement » dans vos préférences de notification.

**« L'export Excel ne contient pas tous les courriers. »**
→ L'export reprend exactement ce que vous voyez à l'écran, avec les filtres en cours (année, registre, statut, recherche). Choisissez « Vue courante » ou une autre année.

**« La reprise d'un compteur est refusée. »** (administrateur système)
→ Des numéros ont déjà été attribués par le système pour ce registre, cette unité et cette année. La reprise ne sert qu'au démarrage.

**« Je suis stagiaire : je ne vois ni Courrier, ni Archives, ni Documents générés. »**
→ Ces modules ne sont pas ouverts aux stagiaires. Votre attestation de stage se trouve dans « Mon stage ».
### Questions fréquentes — Réunions, logistique, administration

**« Je ne vois aucune salle dans la liste quand je crée ma réunion. »**
→ Saisissez d'abord le « Début » et la « Fin ». Seules les salles libres sont ensuite proposées, ainsi que les salles occupées par une personne sur laquelle vous avez la priorité hiérarchique.

**« L'application me dit « Indiquez l’heure de fin pour réserver une salle. » »**
→ Une salle se réserve pour un créneau précis : remplissez « Fin (optionnel) ».

**« Ma réunion affiche « Salle « X » perdue (priorité hiérarchique) : la réunion n’a plus de salle.» »**
→ Un supérieur a pris la salle. Votre réunion est conservée : réservez une autre salle dans « Logistique » → « Réservations ».

**« Je ne peux pas inviter un stagiaire à une réunion. »**
→ C'est normal : le module « Réunions » n'est pas ouvert aux stagiaires.

**« Je ne peux pas annuler la réservation de la salle de ma réunion. »**
→ Le message est « Cette salle est réservée pour une réunion : annulez la réunion pour la libérer. » Annulez la réunion : la salle est libérée automatiquement.

**« On me dit « « X » est déjà réservée sur ce créneau ». »**
→ Choisissez un autre créneau ou une autre ressource. Si le message ajoute « Vous pouvez faire valoir la priorité hiérarchique. », cliquez « Faire valoir la priorité ».

**« « Priorité impossible » s'affiche alors que je suis chef. »**
→ La priorité ne joue que sur les personnes placées sous votre autorité. Elle ne joue jamais entre le DN et la DNA, ni sur la personne dont vous assurez l'intérim.

**« Ma réservation a été annulée sans que je le demande. »**
→ Soit un supérieur a fait valoir la priorité (statut « Annulée pour priorité », avec son nom), soit un gestionnaire l'a annulée avec un motif. Consultez la fiche de la réservation.

**« Je ne vois pas l'onglet « Fournitures » ni le sous-onglet « À traiter ». »**
→ Ils sont réservés aux gestionnaires logistiques. Cette habilitation est donnée par l'administrateur système : « Administration » → « Logistique » → « Habiliter ».

**« Je suis gestionnaire mais je ne peux pas traiter ma propre demande. »**
→ C'est voulu : « Vous ne pouvez pas traiter votre propre demande : un autre gestionnaire s’en charge. » Il faut au moins deux gestionnaires.

**« Pendant mon intérim, je n'ai pas les droits de gestionnaire de la personne que je remplace. »**
→ L'habilitation « gestionnaire logistique » est personnelle : elle ne passe jamais au suppléant.

**« « Stock insuffisant » s'affiche quand je traite une demande. »**
→ Faites une « Entrée » de stock dans « Fournitures », ou remettez une quantité moindre. Rien n'a été enregistré.

**« Aucun gestionnaire ne traite les demandes. »**
→ L'écran d'administration indique « Aucun gestionnaire : personne ne peut traiter les demandes. » L'administrateur système doit habiliter au moins une personne.

**« Je ne peux plus modifier un bien. »**
→ Il est réformé : « Le bien <n°> est réformé : il n’est plus modifiable. » La réforme est définitive. Le bien garde son numéro et son historique.

**« Je veux supprimer un bien saisi par erreur. »**
→ C'est impossible : un bien n'est jamais supprimé. Réformez-le avec un motif.

**« Le compteur du véhicule refuse ma saisie. »**
→ « Le compteur ne recule pas : n km déjà enregistrés pour ce véhicule. » Saisissez un kilométrage au moins égal à n.

**« Je ne trouve pas mon véhicule dans la liste de la mission. »**
→ Seuls les véhicules « En service » sont proposés. Remettez l'état « En service » dans la fiche du véhicule s'il est réparé.

**« « Ce véhicule est déjà affecté à la mission « X » sur ces dates. » »**
→ Choisissez un autre véhicule, ou enregistrez d'abord le retour de la mission « X ».

**« Mon plein est refusé : « Cet ordre de mission n’utilise pas ce véhicule. » »**
→ Laissez « Mission (facultatif) » vide, ou affectez d'abord ce véhicule à la mission.

**« Je ne peux pas supprimer une division. »**
→ Elle contient encore des sections, des comptes ou des tâches. Videz-la, ou utilisez « Suspendre » : les personnes rattachées gardent tout.

**« Je ne peux pas fermer une unité dans l'organigramme. »**
→ « Fermeture impossible : n agent(s) encore rattaché(s). Mutez-les d’abord. » ou « … sous-unité(s) encore ouverte(s) ». Mutez les agents et fermez d'abord les sous-unités.

**« On ne peut plus rattacher personne à une unité. »**
→ Elle est suspendue : « … aucun nouveau rattachement n'y est possible tant qu'elle n'est pas réactivée. » L'administrateur doit cliquer « Réactiver ».

**« Je ne peux pas nommer ce chef de cellule. »**
→ La cellule a déjà un chef : retirez-le d'abord (« Retirer le chef »). Un DN, une DNA ou un chef de division doit d'abord changer de rôle.

**« « Cette division a déjà un Chef de Division actif » s'affiche. »**
→ Un seul chef actif est possible par unité. Changez d'abord le rôle de l'actuel chef, ou passez par l'onglet « Nominations », qui fait les deux changements en une seule fois.

**« « Réaffectez d’abord l’assistant(e) de ce compte » s'affiche. »**
→ Le nouveau rôle ne supervise pas d'assistant(e). Rattachez d'abord l'assistant(e) à un autre superviseur.

**« Je ne peux pas retirer le rôle d'administrateur. »**
→ « C’est le dernier administrateur système actif : nommez-en un autre avant de retirer ce rôle. »

**« Je ne peux pas changer le rôle d'un stagiaire. »**
→ « Ce stagiaire a un stage prévu ou en cours : clôturez-le ou interrompez-le d’abord. » Le DRH doit d'abord clore le stage.

**« « Le rôle de ce compte a changé entre-temps » ou « Ce compte a été modifié entre-temps » s'affiche. »**
→ Quelqu'un a modifié le compte en même temps que vous. Fermez la fenêtre, rechargez la page et recommencez depuis « Voir les effets ».

**« Je ne peux pas changer un rôle pendant mon intérim. »**
→ Un changement de rôle se fait toujours en votre nom propre. Quittez l'intérim.

**« Je ne peux pas attribuer le rôle « Gestionnaire logistique » depuis « Rôles fonctionnels ». »**
→ Ce rôle s'attribue depuis « Administration » → « Logistique ». Agent du courrier s'attribue depuis « Courrier » → « Habilitations ».

**« « Ce compte n’est rattaché à aucun agent. » s'affiche quand j'attribue un rôle. »**
→ Le compte doit d'abord être rattaché à un agent. Le DRH le fait dans l'écran « Agents ».

**« Une nomination ne peut pas être confirmée : « Le compte nommé n’est plus actif ». »**
→ Utilisez « Refuser… » avec un motif. Le DRH est informé.

**« « Choisissez le nouveau rôle de X » s'affiche à la confirmation d'une nomination. »**
→ L'actuel titulaire fait partie de la Direction : aucun rôle ne lui est proposé d'office. Choisissez son « Rôle » dans le bloc prévu.

**« Je ne peux pas envoyer de lien de réinitialisation. »**
→ « Le compte doit être actif pour recevoir ce lien. » Réactivez le compte, ou utilisez « Définir un mot de passe temporaire ».

**« « Ce compte n'est pas en attente de validation. » s'affiche. »**
→ L'inscription a déjà été traitée. Rechargez la liste.

**« Je n'ai pas le bouton « Modifier » dans « Paramètres ». »**
→ Seul l'administrateur système, en son nom propre, modifie les paramètres. Le DN et la DNA consultent.

**« Ma valeur de paramètre est refusée. »**
→ « <paramètre> : valeur entière entre min et max unité. » Saisissez un nombre entier dans les bornes affichées.

**« La supervision affiche « DÉGRADÉ » pour les tâches planifiées. »**
→ Regardez le tableau « Tâches planifiées » : une tâche est en « ÉCHEC » ou en retard. L'exécution suivante reprend automatiquement. Si l'échec persiste, prévenez le responsable de l'exploitation.

**« La supervision indique « quota atteint, les emails reprendront demain ». »**
→ Les emails partiront le lendemain. Les notifications restent visibles dans la cloche.

**« La supervision recommande un test de restauration. »**
→ « Un test tous les 6 mois est recommandé. » Faites un essai de restauration, puis cliquez « Déclarer un test de restauration ».

**« Le journal d'audit indique « Chaîne rompue ». »**
→ Le journal a été altéré en dehors de l'application. Prévenez immédiatement le responsable de l'exploitation et la Direction ; le journal ne se corrige pas depuis l'application.

**« Je ne vois que mes propres actions dans le journal d'audit. »**
→ C'est normal : la portée dépend de votre rôle. Les chefs voient leur périmètre ; le DN, la DNA et l'administrateur voient toute la Direction.

**« Je n'ai pas le bouton « Vérifier l’intégrité ». »**
→ Il est réservé à l'administrateur système, hors intérim.

**« La page « Utilisateurs » affiche « Accès non autorisé ». »**
→ Elle est réservée à l'administrateur système, au DN et à la DNA.

**« L'application affiche « Cette fonctionnalité n’est pas accessible aux stagiaires. » »**
→ Les réunions, la logistique et l'administration ne sont pas ouvertes aux stagiaires. L'aide, elle, leur est ouverte.

**« Je ne trouve pas le guide PDF dans l'application. »**
→ La page « Aide » n'en propose pas le téléchargement. Le guide imprimable est distribué à part (à confirmer).

**« Je ne vois pas le guide « Gestionnaire logistique » dans l'aide. »**
→ Les guides suivent votre profil et vos habilitations. Une fois habilité, le guide apparaît. En intérim, ce sont toujours vos propres guides qui s'affichent.

---

## 6. Paramètres réglables et valeurs actuelles

Ces réglages se trouvent dans « Administration » → « Paramétrage et supervision » → onglet « Paramètres ».
- **L'administrateur système** les modifie (bouton « Modifier », champ « Valeur (min à max unité) »). Il ne peut pas le faire en intérim.
- **Le DN et le DNA** les consultent sans pouvoir les modifier.

L'écran précise : « Chaque valeur reste dans ses bornes, s'applique aussitôt au circuit concerné et chaque modification est tracée au journal d'audit. » Sous chaque paramètre s'affichent les bornes, la valeur par défaut et, s'il a été modifié, la date et l'auteur de la modification. Les valeurs ci-dessous sont les valeurs par défaut. La valeur en vigueur dans votre installation est celle affichée à l'écran (à confirmer auprès de l'administrateur).

| Paramètre (libellé écran) | Valeur par défaut | Bornes | Qui modifie | Effet (texte de l'écran) |
|---|---|---|---|---|
| « Longueur minimale du mot de passe » | 8 caractères | 8 à 32 caractères | Administrateur système | « Demande d'accès, mot de passe choisi ou réinitialisé, mot de passe temporaire. » |
| « Conservation des journaux de connexion » | 12 mois | 6 à 36 mois | Administrateur système | « Purge quotidienne des connexions plus anciennes. » |
| « Expiration de la session après inactivité » | 30 jours | 1 à 90 jours | Administrateur système | « Au-delà, il faut se reconnecter. » |
| « Délai d'avis du chef sur une demande de congé » | 48 heures ouvrées | 12 à 120 heures ouvrées | Administrateur système | « Passé ce délai, l'avis est réputé favorable et la demande va au DRH ; alerte au chef 12 heures ouvrées avant. » |
| « Ancienneté dans l'échelon avant un avancement à instruire » | 24 mois | 12 à 60 mois | Administrateur système | « Alerte « avancement d'échelon à instruire » au DRH pour un fonctionnaire resté plus longtemps dans son échelon. » |
| « Alerte avant une fin de stage ou de contrat » | 15 jours | 5 à 60 jours | Administrateur système | « Première alerte au DRH ; le rappel reste à 3 jours. » |

Une valeur hors bornes est refusée avec le message : « <libellé> : valeur entière entre <min> et <max> <unité>. »

Bon à savoir : les écrans affichent toujours « 8 caractères minimum. ». Si le minimum est relevé, l'application refuse un mot de passe trop court avec le message « Le mot de passe doit contenir au moins N caractères. »

### Autres délais fixes

Ces valeurs ne se règlent pas à l'écran.

| Élément | Valeur |
|---|---|
| Renouvellement automatique de la connexion pendant l'utilisation | toutes les 15 minutes (invisible pour vous) |
| Délai pour saisir le code de double authentification après le mot de passe | 5 minutes |
| Validité de la fenêtre « Confirmez votre identité » | 10 minutes |
| Lien « Mot de passe oublié » ou lien envoyé par l'administrateur | 1 heure, usage unique, le dernier lien annule les précédents |
| Lien de premier accès (compte créé par l'administrateur ou par l'import du DRH) | 7 jours, usage unique |
| Verrouillage | 5 échecs en 15 minutes → blocage de 15 minutes, par compte et par accès Internet |
| Demandes d'accès | 30 par heure depuis un même accès Internet |
| Demandes de mot de passe oublié | 5 par heure par adresse e-mail, 10 par heure par accès Internet |
| Longueur maximale d'un mot de passe | 200 caractères |
| Rafraîchissement de la cloche et de l'enveloppe | chaque minute (pas quand l'onglet est caché) |
| Notifications affichées dans la cloche | les 50 dernières |
| Résumé quotidien des emails | 7 h 00 (heure de Conakry) par défaut, réglable par chacun ; 30 lignes au plus |
| Nouvel essai d'un email non parti | jusqu'à 72 heures, puis l'email est abandonné (la notification reste dans la cloche) |
| Recherche | 3 à 100 caractères, 5 résultats par catégorie |
| Suivi des tâches au tableau de bord | tâches terminées depuis moins de 30 jours, 300 tâches au plus |
| Messages directs et fils de discussion | effacés automatiquement après 3 ans |
| Emails envoyés par jour (offre de messagerie) | 300, alerte de supervision à 80 % |
| Réveil du site après inactivité | jusqu'à 50 secondes environ après 15 minutes sans utilisation |

---

## Annexe A — Tâches automatiques et leurs horaires

L'application exécute seule les tâches suivantes. Les heures sont celles de Conakry. Les treize premières figurent dans le tableau « Tâches planifiées » de la supervision ; les quatre dernières n'y figurent pas.

| Tâche | Heure de Conakry | Ce qu'elle fait | Qui est prévenu |
|---|---|---|---|
| « Fins de stage et de contrat (alertes, départs) » | chaque jour à 0 h 15 | Alerte avant une fin de stage ou de contrat (15 jours avant par défaut, réglable), rappel 3 jours avant si la fin n'est pas confirmée. Le lendemain de la date de fin, l'agent passe « Parti » et son compte est désactivé. | Les DRH |
| « Rotation des stagiaires » | chaque jour à 0 h 05 | Clôt les périodes de stage terminées et demande l'évaluation, avec une relance 3 jours après. Change l'unité du stagiaire au début d'une période. Signale les périodes non acceptées. Prévient 3 jours avant une nouvelle période. | Le tuteur, le stagiaire, le responsable de l'unité, le DRH |
| « Purge des journaux de connexion » | chaque jour à 0 h 30 | Efface les connexions plus anciennes que la durée de conservation (12 mois par défaut) et l'historique des tâches de plus de 30 jours. | Personne |
| « Scellement du journal d’audit » | chaque minute | Scelle et chaîne les entrées du journal d'audit de plus d'une minute. | Personne (un retard apparaît dans la supervision) |
| « Surveillance des services » | toutes les 10 minutes | Contrôle les 9 services. Alerte quand un service se dégrade, une fois par changement d'état. | Les administrateurs système (notification et email urgents) |
| « Congés : avis attendus, rappels, avis tacites » | toutes les 15 minutes | Rappelle au chef qu'un avis est attendu, 12 heures ouvrées avant l'échéance. Une fois le délai passé (48 heures ouvrées par défaut), l'avis est réputé favorable et la demande passe au DRH. | Le chef qui doit donner l'avis ; les décideurs (DRH, ou DN et DNA pour une demande d'un DRH) |
| « Purge des messages de plus de 3 ans » | chaque jour à 0 h 40 | Efface les messages directs de plus de 3 ans, pièces jointes comprises. Les notifications, annonces et le journal d'audit ne sont pas concernés. | Personne |
| « Calendrier des jours fériés : alerte si l’année suivante est vide » | chaque jour à 6 h 30 | Une fois par an, signale qu'aucun jour férié n'est saisi pour l'année suivante, ou aucune fête religieuse pour l'année en cours. | Les administrateurs système et les DRH (« Calendrier des jours fériés à compléter ») |
| « Tâches : alertes la veille de l’échéance et en retard » | chaque jour à 7 h 00 | La veille de l'échéance d'une tâche, puis une fois l'échéance dépassée. Chaque alerte n'est envoyée qu'une fois. | La veille : les personnes assignées ; en retard : le chef le plus proche de chaque assigné |
| « Instructions de la Direction : relance à 7 jours » | chaque jour à 7 h 05 | Relance une instruction restée ouverte depuis 7 jours. | Le destinataire (« Relance : instruction de la Direction en attente ») et l'émetteur (« Instruction toujours en attente ») |
| « Résumé quotidien des notifications par email » | toutes les heures, à l'heure pile | Envoie par email les notifications regroupées dont l'heure est venue (7 h par défaut, réglable dans vos préférences de notification). | Chaque personne concernée |
| « Fonction du dossier et rôle du compte : écarts signalés » | chaque jour à 6 h 40 | Signale les écarts entre la fonction inscrite au dossier et le rôle du compte. | Les administrateurs système (bouton « Voir les écarts ») |
| « Vérification complète du journal d’audit (chaque nuit) » | chaque jour à 2 h 30 (et au redémarrage si la dernière date de plus de 26 heures) | Vérifie toute la chaîne du journal d'audit ; le résultat est repris dans la supervision. | Les administrateurs système, par l'alerte de supervision si la chaîne est rompue |
| Rappel de réunion (non suivi dans la supervision) | toutes les 5 minutes | Rappelle une réunion qui commence dans les 30 minutes, une seule fois. | Tous les participants (« Rappel de réunion ») |
| Rappels du courrier (non suivi dans la supervision) | toutes les 30 minutes | Rappelle une imputation de courrier 2 jours avant son échéance, puis en cas de retard. | La personne à qui le courrier est imputé (à confirmer pour les autres destinataires) |
| Bien à récupérer (non suivi dans la supervision) | chaque jour à 0 h 20 | Signale un bien encore affecté à une personne dont le compte n'est plus actif. Rien n'est déplacé automatiquement. | Les gestionnaires logistiques, une seule fois par bien |
| Expiration des comptes de démonstration (non suivi dans la supervision) | chaque jour à 0 h 20 (et au démarrage) | Suspend les comptes de démonstration 14 jours après leur création. | Personne |

## Annexe B — Emails envoyés immédiatement

Toutes les notifications s'affichent tout de suite dans la cloche. Pour les **emails** :
- par défaut, ils sont regroupés dans le **résumé quotidien de 7 h** (heure modifiable dans « Préférences de notification ») ;
- si vous avez choisi « Tout immédiatement », chaque notification donne un email immédiat.

**Les emails suivants partent toujours immédiatement**, quel que soit votre choix :

**Votre compte et vos suppléances**
- Changement de votre rôle (bouton « Ouvrir l'espace de travail »).
- Désignation comme suppléant (« Voir la suppléance »).
- Révocation d'une suppléance (« Voir mes suppléances »).

**Décisions sur vos demandes**
- Congé validé (« Voir ma demande de congé »).
- Congé rejeté (« Voir la demande »).
- Demande logistique traitée (« Voir la demande »).
- Demande logistique refusée (« Voir la demande »).
- Réservation confirmée (« Voir la réservation »).
- Réservation refusée (« Voir la réservation »).
- Réservation annulée au profit d'une demande prioritaire (« Voir la réservation »).
- Période de stage refusée (« Voir le stage »).

**Courrier et actes**
- Acte à signer (« Voir l'acte »).
- Imputation de courrier en retard (« Voir le courrier »).

**Tâches et réunions**
- Tâche en retard (« Voir la tâche »).
- Rappel de réunion (« Voir la réunion »).
- Réunion annulée (« Voir la réunion »).

**Toujours urgents**
- Instruction de la Direction reçue (« Voir l'instruction »).
- Relance d'une instruction de la Direction en attente (« Voir l'instruction »).
- Instruction rejetée, pour son émetteur (« Voir l'instruction »).
- Alerte de supervision, pour l'administration (« Voir la supervision »).
- Mouvement de carrière à examiner, pour le service RH (« Examiner »).

**Emails de compte**, envoyés en dehors des préférences :
- « Votre compte SI DNPEC est activé » ;
- « Votre demande d'accès au SI DNPEC » (rejet) ;
- « Votre compte SI DNPEC a été créé » ;
- « Réinitialisation de votre mot de passe DNPEC ».

---

## Annexe C — Correspondance des captures

Les captures se trouvent dans `captures/`. Leur nom suit le plan de ce document : `NN-module-MM-sujet.png`. Le fichier `captures/LISTE.md` décrit chacune en une ligne et indique le compte utilisé. Préfixes :

| Préfixe | Partie du guide |
|---|---|
| 01-acces | 1. Accéder au SI DNPEC |
| 02-interface | 2. Se repérer dans l'interface (menu et tableau de bord de chaque rôle) |
| 03-taches | 3.1 à 3.4 (tâches, plan de travail, instructions) |
| 04-conges | 3.8 et 3.9 (congés, jours fériés) |
| 05-communication | 3.5 à 3.7 (communication, suggestions, annuaire) |
| 06-documents | 3.16 et 3.17 (archives et documents, documents générés) |
| 07-courrier | 3.18 (courrier et actes) |
| 08-reunions | 3.19 (réunions) |
| 09-logistique | 3.20 et 3.21 (logistique, véhicules) |
| 10-rh | 3.10 à 3.15 (suppléance, personnel, RH, carrière, agents, stages) |
| 11-admin | 3.22 à 3.26 (organisation, utilisateurs, paramétrage, supervision, audit, aide) |
| 12-telephone | 2.8 (usage sur téléphone) |
