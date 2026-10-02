## Mettre en production n7 : nomination d'un chef et changement de rôle (option A)

**Ordre exact**
1. **CI verte** sur la PR `feature/nomination-role` (sur le dernier commit).
2. **Sauvegarde de la base** : Render → la base → **Recovery** → **Create export** → **Download**, fichier `dnpec_avant_n7_<date>.dump`, rangé hors de Render. Notez aussi l'heure exacte.
3. **Migration** :
   - Actions → « Migration base de données (manuel) » ;
   - **Use workflow from : `feature/nomination-role`** ;
   - tapez `migrate`, puis **Run workflow**.
   - **Migration attendue, et elle seule** : `20261004080000_socle_nimba_n7`. Toute autre ligne : arrêtez-vous et prévenez-moi.
   - Elle est additive : 1 table (`changements_role_nomination`), 1 type. Aucune donnée existante n'est modifiée, aucune reprise : les nominations déjà signées restent telles quelles.
4. **Fusion** de la PR. Attendez que `dnpec-api` puis `dnpec-web` soient **Live**.
5. **Contrôle technique** :
   - `https://<api>/health` affiche le commit de la fusion ;
   - `https://<api>/health/dependances` répond avec `"base":"NOMINAL"` (le nouveau contrôle « fonction et rôle » n'y figure pas : c'est une donnée de gestion, pas une panne).
6. **Écarts déjà présents** : Administration → « Utilisateurs » → onglet **« Nominations »** → section « Écarts entre fonction du dossier et rôle du compte ». Au premier déploiement, les comptes dont la fonction du dossier (« Chef de la division … », « Chargé d'études »…) ne correspond pas au rôle apparaissent ici et dans la supervision (« Fonction et rôle des comptes » : dégradé tant qu'il en reste). Chaque ligne dit qui agit : l'administrateur (« Changer de rôle ») ou le DRH (acte de nomination qui corrige la fonction).

**Ce qui change, en une phrase par profil**
- **DRH** : pour une nomination à un poste de chef (division, section, cellule) ou de DN/DNA, le DRH choisit le « Poste visé » dans la liste ; le rôle, l'unité et l'intitulé de la fonction en découlent. Les autres nominations gardent le texte libre, sans effet sur les droits. Après la signature, le mouvement affiche « Droits en attente (administrateur) », puis « Droits appliqués » ou « Droits refusés » avec le motif.
- **Administrateur** : notification et email immédiats « Nomination à appliquer — acte n° … ». Onglet « Nominations » : « Confirmer… » (l'actuel titulaire du poste redevient par défaut Chargé(e) d'Études dans la même unité, modifiable ; les deux changements s'appliquent ensemble, tout ou rien ; l'intitulé de fonction de l'ancien titulaire suit son nouveau rôle et son unité, inscrit à son historique de carrière « suite à l'acte n° … », sans acte supplémentaire du DRH ; motif enregistré : le numéro de l'acte) ou « Refuser… » (motif obligatoire, transmis au DRH). Chaque matin (6 h 40 UTC), une notification s'il reste des écarts.
- **DN, DNA** : signent l'acte comme aujourd'hui ; rien d'autre.
- **Le nommé et l'ancien titulaire** : prévenus par le changement de rôle habituel (sessions fermées, reconnexion avec les nouveaux droits).

**Vérifications, compte par compte**

| Compte | À vérifier |
|---|---|
| DRH | Ressources humaines → « Carrière et actes » → « + Nouveau mouvement » → type Nomination : la liste « Poste visé » (chaque poste avec son titulaire actuel ou « vacant ») et l'intitulé de la fonction qui en découle ; « Autre fonction » garde le texte libre. Sur un mouvement existant : le badge d'état des droits n'apparaît que sur les nominations à un poste. |
| Administrateur | Utilisateurs : 4 onglets, dont « Nominations ». Supervision : 9 services, dont « Fonction et rôle des comptes ». Tâches planifiées : « Fonction du dossier et rôle du compte : écarts signalés » (première exécution le lendemain matin). |
| DN / DNA | Supervision : même nouveau service. Signature des actes inchangée. |
| Autres profils | Inchangés (l'onglet et les routes sont réservés à l'administrateur). |

**Premier essai réel, conseillé**
1. DRH : nomination d'un chargé d'études à un poste vacant, « Poste visé » choisi dans la liste → « Préparer l'acte ».
2. DN ou DNA : signature dans le Courrier.
3. Administrateur : la notification arrive ; onglet « Nominations » : la ligne montre le poste, l'acte et l'actuel titulaire → « Confirmer… ».
4. DRH : le mouvement affiche « Droits appliqués » ; si le poste avait un titulaire, son dossier porte sa nouvelle fonction (« Chargé d'Études — … ») et son historique la mention « suite à l'acte n° … ».
5. Administrateur : l'onglet « Nominations » ne montre plus d'écart pour ces deux personnes.

**Si quelque chose bloque**
- **« Confirmer » échoue** (poste repris entre-temps, assistant à réaffecter, compte inactif…) : rien n'est appliqué (ni au nommé, ni à l'actuel titulaire) : la nomination reste en attente, avec la raison affichée sous la ligne. Réglez la cause, puis « Confirmer… » à nouveau, ou « Refuser… » avec un motif.
- **Nomination du DN ou de la DNA** : aucun rôle n'est proposé d'office pour l'actuel titulaire ; choisissez-le dans la fenêtre (sinon le message « Choisissez le nouveau rôle de … » s'affiche).
- **Un blocage plus large** : Render → `dnpec-api` → Events → **Rollback** vers le déploiement précédent, puis `dnpec-web`. La base reste compatible (la table ajoutée est ignorée par l'ancienne version) ; une nomination en attente se traite alors par « Changer de rôle » (motif : le numéro de l'acte).
- **Abandon définitif**, sur décision seulement :
  - nouvelle sauvegarde ;
  - Actions → « Retour arrière d'un lot NIMBA (manuel) » → lot `n7`, tapez `retour-arriere n7` ;
  - à jouer **avant** tout retour arrière de N6 ;
  - perdus : les changements de rôle issus des actes (en attente, appliqués, refusés, avec leurs motifs). Restent : les rôles déjà appliqués aux comptes, les mouvements de carrière et les actes.

**Tests joués avant la mise en production** (suite de bout en bout, base locale et CI)
- `r_nomination_role` (API) : liste des postes et intitulé dérivé, texte libre sans effet, préparation contrôlée (400), « tout ou rien » (échec simulé en fin de transaction : aucun des deux rôles ne change), fonction et historique de l'ancien titulaire mis à jour à la confirmation (plus aucun écart), signature → changement en attente, actuel titulaire relevé, administrateur notifié ; écran réservé à l'administrateur (403 pour DRH, DN, chef, agent) ; confirmation (rôles des deux comptes, audit, DRH informé), échec gardé en attente puis réussite ; 409 sur une seconde décision ; poste déjà tenu → appliqué d'emblée ; refus motivé ; DN/DNA sans rôle proposé (400) ; écarts quotidiens et supervision ; sonde publique inchangée.
- `r_nomination_role_ui` (Chromium, bureau et téléphone) : formulaire du DRH, badges d'état, onglet ouvert par le lien des notifications, confirmation et refus, sans défilement horizontal.
- Phase 39m (`n7_reprise`) : migration sur une base N6 réaliste, retour arrière (schéma identique à celui d'avant, données intactes), ré-application.
