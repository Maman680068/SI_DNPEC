# Matrice des habilitations — état N6

Généré par `tests/e2e/api/n1_matrice.js` (annexe 1 du cahier NIMBA v2.2). « ÉCART » : comportement actuel conservé en N1 et vérifié tel quel.

| Objet | Profil | Action | Annexe | Obtenu | Issue |
|---|---|---|---|---|---|
| Unité organisationnelle | DN | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | DNA | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Chef de division | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Chef de section | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Agent | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | DRH | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Chef SAF | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Assistant DN | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | Administrateur | lire (organigramme complet) | L(T) | accès | CONFORME |
| Unité organisationnelle | DN | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DN | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DNA | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DNA | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de division | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de division | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de section | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef de section | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Agent | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Agent | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | DRH | créer | CLM(T) | accès | CONFORME |
| Unité organisationnelle | DRH | modifier | CLM(T) | accès | CONFORME |
| Unité organisationnelle | Chef SAF | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Chef SAF | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Assistant DN | créer | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Assistant DN | modifier | L(T) | refus (403) | CONFORME |
| Unité organisationnelle | Administrateur | créer | CLM(T) | accès | CONFORME |
| Unité organisationnelle | Administrateur | modifier | CLM(T) | accès | CONFORME |
| Compte utilisateur | DN | lister (toute la Direction) | L(T) | accès | CONFORME |
| Compte utilisateur | DNA | lister (toute la Direction) | L(T) | accès | CONFORME |
| Compte utilisateur | DRH | lister (toute la Direction) | L(T) | accès | CONFORME |
| Compte utilisateur | Administrateur | lister (toute la Direction) | CLMS(T) | accès | CONFORME |
| Compte utilisateur | Agent | lister (soi-même) | L(S) | accès | CONFORME |
| Compte utilisateur | Chef de division | lire un compte de son périmètre | L(P) | accès | CONFORME |
| Compte utilisateur | Chef de division | lire un compte hors périmètre | L(P) | refus (403) | CONFORME |
| Compte utilisateur | Chef de section | lire un compte de son périmètre | L(P) | accès | CONFORME |
| Compte utilisateur | Chef de section | lire un compte hors périmètre | L(P) | refus (403) | CONFORME |
| Compte utilisateur | Agent | lire le compte d’un collègue | L(S) | refus (403) | CONFORME |
| Compte utilisateur | Assistant DN | lister les comptes | — (annexe 1.4 : compte réservé à l’administrateur) | accès | ÉCART |
| Compte utilisateur | DN | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | DNA | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Chef de division | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Chef de section | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Agent | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | DRH | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Chef SAF | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Compte utilisateur | Assistant DN | créer | C réservé à l’administrateur | refus (403) | CONFORME |
| Dossier agent | DN | lire (toute la Direction) | L*(T) | accès | CONFORME |
| Dossier agent | DNA | lire (toute la Direction) | L*(T) | accès | CONFORME |
| Dossier agent | Chef de division | lire (périmètre) | L*(P) | accès | CONFORME |
| Dossier agent | Chef de division | lire (hors périmètre) | L*(P) | refus (403) | CONFORME |
| Dossier agent | Chef de section | lire (hors périmètre) | L*(P) | refus (403) | CONFORME |
| Dossier agent | Agent | lire le sien | L(S) | accès | CONFORME |
| Dossier agent | Agent | lire celui d’un collègue | L(S) | refus (403) | CONFORME |
| Dossier agent | DRH | lire (toute la Direction) | CLM(T) | accès | CONFORME |
| Dossier agent | Administrateur | lire | — | refus (403) | CONFORME |
| Dossier agent | Assistant DN | lire | — (jamais d’objet protégé par délégation) | refus (403) | CONFORME |
| Dossier agent | Chef SAF | lire (toute la Direction) | L*(T) (SAF / paie) | refus (403) | ÉCART |
| Dossier agent (liste des agents) | DN | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | DNA | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Chef de division | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Chef de section | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Agent | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | DRH | lister | CLM(T) | accès | CONFORME |
| Dossier agent (liste des agents) | Chef SAF | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Assistant DN | lister | lecture par le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Administrateur | lister | — (agents sans compte seulement, pour le rapprochement) | refus (403) | CONFORME |
| Dossier agent (liste des agents) | Administrateur | lister les agents sans compte (identité, unité) | rapprochement compte ↔ agent (annexe 2.3) | accès | CONFORME |
| Dossier agent (fiche agent) | Agent | lire la sienne | L(S) | accès | CONFORME |
| Dossier agent (fiche agent) | DN | lire celle d’un agent | L*(T/P) via le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (fiche agent) | Chef de division | lire celle d’un agent | L*(T/P) via le dossier du personnel | refus (403) | CONFORME |
| Dossier agent (fiche agent) | Administrateur | lire celle d’un agent | — | refus (403) | CONFORME |
| Dossier agent (fiche agent) | Assistant DN | lire celle d’un agent | — | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | DN | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | DNA | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Chef de division | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Chef de section | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Agent | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Chef SAF | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Assistant DN | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Agent — cycle de vie (annexe 2.2) | Administrateur | suspendre | DRH exclusivement | refus (403) | CONFORME |
| Rôle fonctionnel | DN | attribuer | L(T) | refus (403) | CONFORME |
| Rôle fonctionnel | DNA | attribuer | L(T) | refus (403) | CONFORME |
| Rôle fonctionnel | Chef de division | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Chef de section | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Agent | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | DRH | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Chef SAF | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Assistant DN | attribuer | — | refus (403) | CONFORME |
| Rôle fonctionnel | Administrateur | attribuer | CLMV(T) | accès | CONFORME |
| Rôle fonctionnel | DN | lire toutes les attributions | L(T) | refus (403) | ÉCART |
| Journal d’audit | DN | lire (toute la direction) | L(T) | accès | CONFORME |
| Journal d’audit | DNA | lire (toute la direction) | L(T) | accès | CONFORME |
| Journal d’audit | Administrateur | lire (toute la direction) | L(T) | accès | CONFORME |
| Journal d’audit | Chef de division | lire (votre périmètre) | L(P) | accès | CONFORME |
| Journal d’audit | Chef de section | lire (votre périmètre) | L(P) | accès | CONFORME |
| Journal d’audit | Agent | lire (vos propres actions) | L(S) | accès | CONFORME |
| Journal d’audit | DRH | lire (ses propres actions) | L(P) | accès | ÉCART |
| Paramétrage | DN | lire | L(T) | accès | CONFORME |
| Paramétrage | DN | modifier | L(T) | refus (403) | CONFORME |
| Paramétrage | DNA | lire | L(T) | accès | CONFORME |
| Paramétrage | DNA | modifier | L(T) | refus (403) | CONFORME |
| Paramétrage | Chef de division | lire | — | refus (403) | CONFORME |
| Paramétrage | Chef de division | modifier | — | refus (403) | CONFORME |
| Paramétrage | Chef de section | lire | — | refus (403) | CONFORME |
| Paramétrage | Chef de section | modifier | — | refus (403) | CONFORME |
| Paramétrage | Agent | lire | — | refus (403) | CONFORME |
| Paramétrage | Agent | modifier | — | refus (403) | CONFORME |
| Paramétrage | DRH | lire | M(D4, D6) — réglages des stages dans leur écran | refus (403) | CONFORME |
| Paramétrage | DRH | modifier | — | refus (403) | CONFORME |
| Paramétrage | Chef SAF | lire | — | refus (403) | CONFORME |
| Paramétrage | Chef SAF | modifier | — | refus (403) | CONFORME |
| Paramétrage | Assistant DN | lire | — | refus (403) | CONFORME |
| Paramétrage | Assistant DN | modifier | — | refus (403) | CONFORME |
| Paramétrage | Administrateur | lire | CLM(T) | accès | CONFORME |
| Paramétrage | Administrateur | modifier | CLM(T) | accès | CONFORME |
| Justificatif médical (motif) | DN | lire | — (« Absence — motif protégé » et dates seulement) | refus (403) | CONFORME |
| Justificatif médical (motif) | DNA | lire | — (« Absence — motif protégé » et dates seulement) | refus (403) | CONFORME |
| Justificatif médical (motif) | Chef de division | lire | — (« Absence — motif protégé » et dates seulement) | refus (403) | CONFORME |
| Justificatif médical (motif) | Chef de section | lire | L — chef qui donne l’avis, après réauthentification | accès | CONFORME |
| Justificatif médical (motif) | Agent | lire | C(S) — le demandeur | accès | CONFORME |
| Justificatif médical (motif) | DRH | lire | L(T) après réauthentification | accès | CONFORME |
| Justificatif médical (motif) | Chef SAF | lire | — (« Absence — motif protégé » et dates seulement) | refus (403) | CONFORME |
| Justificatif médical (motif) | Assistant DN | lire | — (« Absence — motif protégé » et dates seulement) | refus (403) | CONFORME |
| Justificatif médical (motif) | Administrateur | lire | — (« Absence — motif protégé » et dates seulement) | refus (403) | CONFORME |
| Certificat médical | DN | lire | — | refus (403) | CONFORME |
| Certificat médical | DNA | lire | — | refus (403) | CONFORME |
| Certificat médical | Chef de division | lire | — | refus (403) | CONFORME |
| Certificat médical | Chef de section | lire | — | refus (403) | CONFORME |
| Certificat médical | Agent | lire | C(S) — le demandeur | accès | CONFORME |
| Certificat médical | DRH | lire | L(T) après réauthentification | accès | CONFORME |
| Certificat médical | Chef SAF | lire | — | refus (403) | CONFORME |
| Certificat médical | Assistant DN | lire | — | refus (403) | CONFORME |
| Certificat médical | Administrateur | lire | — | refus (403) | CONFORME |
| Jour férié | DN | créer | L(T) | refus (403) | CONFORME |
| Jour férié | DNA | créer | L(T) | refus (403) | CONFORME |
| Jour férié | Chef de division | créer | L(T) | refus (403) | CONFORME |
| Jour férié | Chef de section | créer | L(T) | refus (403) | CONFORME |
| Jour férié | Agent | créer | L(T) | refus (403) | CONFORME |
| Jour férié | DRH | créer | CLMS(T) | accès | CONFORME |
| Jour férié | Chef SAF | créer | L(T) | refus (403) | CONFORME |
| Jour férié | Assistant DN | créer | L(T) | refus (403) | CONFORME |
| Jour férié | Administrateur | créer | CLMS(T) | accès | CONFORME |
| Demande d’absence — avis | DN | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | DNA | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | Chef de division | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | Agent | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | DRH | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | Chef SAF | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | Assistant DN | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | Administrateur | donner l’avis | — | refus (403) | CONFORME |
| Demande d’absence — avis | Chef de section | donner l’avis | V (chef d’unité le plus proche) | accès | CONFORME |
| Demande d’absence — décision | DN | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | DNA | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | Chef de division | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | Chef de section | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | Agent | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | Chef SAF | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | Assistant DN | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | Administrateur | approuver | — | refus (403) | CONFORME |
| Demande d’absence — décision | DRH | approuver | V (DRH) | accès | CONFORME |
| Document — statut de diffusion | DN | valider | V (responsable métier / Direction) | accès | CONFORME |
| Document — statut de diffusion | DNA | valider | V (responsable métier / Direction) | accès | CONFORME |
| Document — statut de diffusion | Chef de division | valider | V (responsable métier / Direction) | accès | CONFORME |
| Document — statut de diffusion | Chef de section | valider | — | refus (403) | CONFORME |
| Document — statut de diffusion | Agent | valider | — | refus (403) | CONFORME |
| Document — statut de diffusion | DRH | valider | — | refus (403) | CONFORME |
| Document — statut de diffusion | Chef SAF | valider | — | refus (403) | CONFORME |
| Document — statut de diffusion | Assistant DN | valider | — | refus (403) | CONFORME |
| Document — statut de diffusion | Administrateur | valider | — | refus (403) | CONFORME |
| Document de cellule — statut de diffusion | DN | valider | V (chef de cellule / Direction) | accès | CONFORME |
| Document de cellule — statut de diffusion | DNA | valider | V (chef de cellule / Direction) | accès | CONFORME |
| Document de cellule — statut de diffusion | Chef de division | valider | — | refus (403) | CONFORME |
| Document de cellule — statut de diffusion | Chef de section | valider | — | refus (403) | CONFORME |
| Document de cellule — statut de diffusion | Agent | valider | — | refus (403) | CONFORME |
| Document de cellule — statut de diffusion | DRH | valider | — | refus (403) | CONFORME |
| Document de cellule — statut de diffusion | Chef SAF | valider | V (chef de cellule / Direction) | accès | CONFORME |
| Document de cellule — statut de diffusion | Assistant DN | valider | — | refus (403) | CONFORME |
| Document de cellule — statut de diffusion | Administrateur | valider | — | refus (403) | CONFORME |
| Document — statut de diffusion | DN | rendre diffusable | V (DN, DNA) | accès | CONFORME |
| Document — statut de diffusion | DNA | rendre diffusable | V (DN, DNA) | accès | CONFORME |
| Document — statut de diffusion | Chef de division | rendre diffusable | — | refus (403) | CONFORME |
| Document — statut de diffusion | Chef de section | rendre diffusable | — | refus (403) | CONFORME |
| Document — statut de diffusion | Agent | rendre diffusable | — | refus (403) | CONFORME |
| Document — statut de diffusion | DRH | rendre diffusable | — | refus (403) | CONFORME |
| Document — statut de diffusion | Chef SAF | rendre diffusable | — | refus (403) | CONFORME |
| Document — statut de diffusion | Assistant DN | rendre diffusable | — | refus (403) | CONFORME |
| Document — statut de diffusion | Administrateur | rendre diffusable | — | refus (403) | CONFORME |
| Activité / plan de travail | DN | lire le plan de la section | L(P) — unité, unités au-dessus, périmètre | accès | CONFORME |
| Activité / plan de travail | DNA | lire le plan de la section | L(P) — unité, unités au-dessus, périmètre | accès | CONFORME |
| Activité / plan de travail | Chef de division | lire le plan de la section | L(P) — unité, unités au-dessus, périmètre | accès | CONFORME |
| Activité / plan de travail | Chef de section | lire le plan de la section | L(P) — unité, unités au-dessus, périmètre | accès | CONFORME |
| Activité / plan de travail | Agent | lire le plan de la section | L(P) — unité, unités au-dessus, périmètre | accès | CONFORME |
| Activité / plan de travail | DRH | lire le plan de la section | — | refus (403) | CONFORME |
| Activité / plan de travail | Chef SAF | lire le plan de la section | — | refus (403) | CONFORME |
| Activité / plan de travail | Assistant DN | lire le plan de la section | L(P) — unité, unités au-dessus, périmètre | accès | CONFORME |
| Activité / plan de travail | Administrateur | lire le plan de la section | — | refus (403) | CONFORME |
| Activité / plan de travail | DN | créer un objectif de la section | CLM(P) — chef de l’unité, Direction | accès | CONFORME |
| Activité / plan de travail | DNA | créer un objectif de la section | CLM(P) — chef de l’unité, Direction | accès | CONFORME |
| Activité / plan de travail | Chef de division | créer un objectif de la section | CLM(P) — chef de l’unité, Direction | accès | CONFORME |
| Activité / plan de travail | Chef de section | créer un objectif de la section | CLM(P) — chef de l’unité, Direction | accès | CONFORME |
| Activité / plan de travail | Agent | créer un objectif de la section | L(P) ou — | refus (403) | CONFORME |
| Activité / plan de travail | DRH | créer un objectif de la section | L(P) ou — | refus (403) | CONFORME |
| Activité / plan de travail | Chef SAF | créer un objectif de la section | L(P) ou — | refus (403) | CONFORME |
| Activité / plan de travail | Assistant DN | créer un objectif de la section | L(P) ou — | refus (403) | CONFORME |
| Activité / plan de travail | Administrateur | créer un objectif de la section | L(P) ou — | refus (403) | CONFORME |
| Instruction de la Direction | DN | émettre | C (DN, DNA) | accès | CONFORME |
| Instruction de la Direction | DNA | émettre | C (DN, DNA) | accès | CONFORME |
| Instruction de la Direction | Chef de division | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | Chef de section | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | Agent | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | DRH | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | Chef SAF | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | Assistant DN | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | Administrateur | émettre | — | refus (403) | CONFORME |
| Instruction de la Direction | DN | lire (agent concerné : pas avant l’exécution) | L (émetteur, destinataire, Direction) | accès | CONFORME |
| Instruction de la Direction | DNA | lire (agent concerné : pas avant l’exécution) | L (émetteur, destinataire, Direction) | accès | CONFORME |
| Instruction de la Direction | Chef de division | lire (agent concerné : pas avant l’exécution) | — (inexistante pour lui : 404) | refus (403) | CONFORME |
| Instruction de la Direction | Chef de section | lire (agent concerné : pas avant l’exécution) | L (émetteur, destinataire, Direction) | accès | CONFORME |
| Instruction de la Direction | Agent | lire (agent concerné : pas avant l’exécution) | — (inexistante pour lui : 404) | refus (403) | CONFORME |
| Instruction de la Direction | DRH | lire (agent concerné : pas avant l’exécution) | — (inexistante pour lui : 404) | refus (403) | CONFORME |
| Instruction de la Direction | Chef SAF | lire (agent concerné : pas avant l’exécution) | — (inexistante pour lui : 404) | refus (403) | CONFORME |
| Instruction de la Direction | Assistant DN | lire (agent concerné : pas avant l’exécution) | — (inexistante pour lui : 404) | refus (403) | CONFORME |
| Instruction de la Direction | Administrateur | lire (agent concerné : pas avant l’exécution) | — (inexistante pour lui : 404) | refus (403) | CONFORME |
| Effectifs RH | DN | lire | L (DRH, DN, DNA) | accès | CONFORME |
| Effectifs RH | DNA | lire | L (DRH, DN, DNA) | accès | CONFORME |
| Effectifs RH | Chef de division | lire | — | refus (403) | CONFORME |
| Effectifs RH | Chef de section | lire | — | refus (403) | CONFORME |
| Effectifs RH | Agent | lire | — | refus (403) | CONFORME |
| Effectifs RH | DRH | lire | L (DRH, DN, DNA) | accès | CONFORME |
| Effectifs RH | Chef SAF | lire | — | refus (403) | CONFORME |
| Effectifs RH | Assistant DN | lire | — | refus (403) | CONFORME |
| Effectifs RH | Administrateur | lire | — | refus (403) | CONFORME |
| Alertes RH | DN | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | DNA | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | Chef de division | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | Chef de section | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | Agent | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | DRH | lire (elles nomment des agents) | L (DRH) | accès | CONFORME |
| Alertes RH | Chef SAF | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | Assistant DN | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Alertes RH | Administrateur | lire (elles nomment des agents) | — | refus (403) | CONFORME |
| Mouvement de carrière | DN | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | DNA | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | Chef de division | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | Chef de section | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | Agent | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | DRH | préparer (acte du Courrier signé par la Direction) | C (DRH) | accès | CONFORME |
| Mouvement de carrière | Chef SAF | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | Assistant DN | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | Administrateur | préparer (acte du Courrier signé par la Direction) | — | refus (403) | CONFORME |
| Mouvement de carrière | DN | lire ceux d’un autre agent | L (DRH, DN, DNA ; l’agent : les siens, appliqués) | accès | CONFORME |
| Mouvement de carrière | DNA | lire ceux d’un autre agent | L (DRH, DN, DNA ; l’agent : les siens, appliqués) | accès | CONFORME |
| Mouvement de carrière | Chef de division | lire ceux d’un autre agent | — | refus (403) | CONFORME |
| Mouvement de carrière | Chef de section | lire ceux d’un autre agent | — | refus (403) | CONFORME |
| Mouvement de carrière | Agent | lire ceux d’un autre agent | — | refus (403) | CONFORME |
| Mouvement de carrière | DRH | lire ceux d’un autre agent | L (DRH, DN, DNA ; l’agent : les siens, appliqués) | accès | CONFORME |
| Mouvement de carrière | Chef SAF | lire ceux d’un autre agent | — | refus (403) | CONFORME |
| Mouvement de carrière | Assistant DN | lire ceux d’un autre agent | — | refus (403) | CONFORME |
| Mouvement de carrière | Administrateur | lire ceux d’un autre agent | — | refus (403) | CONFORME |
| Fiche de poste | DN | lire | L (tous) | accès | CONFORME |
| Fiche de poste | DN | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | DNA | lire | L (tous) | accès | CONFORME |
| Fiche de poste | DNA | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | Chef de division | lire | L (tous) | accès | CONFORME |
| Fiche de poste | Chef de division | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | Chef de section | lire | L (tous) | accès | CONFORME |
| Fiche de poste | Chef de section | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | Agent | lire | L (tous) | accès | CONFORME |
| Fiche de poste | Agent | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | DRH | lire | L (tous) | accès | CONFORME |
| Fiche de poste | DRH | rédiger | CLM (DRH) | accès | CONFORME |
| Fiche de poste | Chef SAF | lire | L (tous) | accès | CONFORME |
| Fiche de poste | Chef SAF | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | Assistant DN | lire | L (tous) | accès | CONFORME |
| Fiche de poste | Assistant DN | rédiger | — | refus (403) | CONFORME |
| Fiche de poste | Administrateur | lire | L (tous) | accès | CONFORME |
| Fiche de poste | Administrateur | rédiger | — | refus (403) | CONFORME |
| Besoin de formation | DN | lire (son unité ; tout pour le DRH) | L(P) — chefs, Direction, DRH | accès | CONFORME |
| Besoin de formation | DNA | lire (son unité ; tout pour le DRH) | L(P) — chefs, Direction, DRH | accès | CONFORME |
| Besoin de formation | Chef de division | lire (son unité ; tout pour le DRH) | L(P) — chefs, Direction, DRH | accès | CONFORME |
| Besoin de formation | Chef de section | lire (son unité ; tout pour le DRH) | L(P) — chefs, Direction, DRH | accès | CONFORME |
| Besoin de formation | Agent | lire (son unité ; tout pour le DRH) | — | refus (403) | CONFORME |
| Besoin de formation | DRH | lire (son unité ; tout pour le DRH) | L(P) — chefs, Direction, DRH | accès | CONFORME |
| Besoin de formation | Chef SAF | lire (son unité ; tout pour le DRH) | L(P) — chefs, Direction, DRH | accès | CONFORME |
| Besoin de formation | Assistant DN | lire (son unité ; tout pour le DRH) | — | refus (403) | CONFORME |
| Besoin de formation | Administrateur | lire (son unité ; tout pour le DRH) | — | refus (403) | CONFORME |
| Véhicule de service | DN | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | DN | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | DNA | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | DNA | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | Chef de division | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | Chef de division | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | Chef de section | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | Chef de section | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | Agent | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | Agent | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | DRH | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | DRH | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | Chef SAF | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | Chef SAF | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | Assistant DN | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | Assistant DN | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |
| Véhicule de service | Administrateur | lire le parc | L (tous) | accès | CONFORME |
| Tableau de bord par rôle | Administrateur | lire le sien | L (chacun, jamais plus que ses écrans) | accès | CONFORME |

## Écarts conservés en N1

- **Compte utilisateur — Assistant DN** : L’assistant hérite de la visibilité de la liste de son superviseur (règle v2.3 de la DNPEC) ; la fiche détaillée reste refusée. À aligner avec l’annexe 1.4.
- **Dossier agent — Chef SAF** : La lecture par le SAF sert la paie (D5), hors périmètre ; le chef SAF garde la portée de chef de cellule.
- **Rôle fonctionnel — DN** : En N1, seuls l’administrateur et le DRH voient toutes les attributions ; le DN voit les siennes. La lecture DN/DNA arrive avec l’écran de supervision (N2).
- **Journal d’audit — DRH** : Le DRH n’a pas de périmètre hiérarchique propre en N1/N2 : il lit ses propres actions ; l’accès aux traces RH passera par les écrans RH (N6).

## Objets livrés par un lot ultérieur (non joués en N1)

- Campagne et bulletin de paie, élément de rémunération, ordre de paiement : hors périmètre (D5, finances SAF)
- Objets du domaine modélisation (annexe 1.3) : hors périmètre (domaine B)

Les autres objets déjà en service (tâche, réunion, décision, courrier, document, annonce, stage) restent
couverts par leurs suites existantes (`a*`, `b*`, `c*`, `d*`) ; ils seront rejoués dans cette matrice lorsqu’ils
passeront sur le moteur d’autorisation du socle.
