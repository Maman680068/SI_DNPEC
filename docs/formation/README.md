# Documentation et formation — socle NIMBA (octobre 2026)

| Document | Pour qui | Usage |
|---|---|---|
| `Prise_en_main_<profil>.pdf` (10 fiches) et `Prise_en_main_tous_profils.pdf` | Chaque agent, selon son profil | Une page à imprimer et à distribuer : gestes essentiels, points à retenir, capture de l'écran principal. |
| `Support_formation_45min.md` | Animateur (CSID, DRH) | Déroulé minute par minute, cas pratiques sur les comptes de démonstration, questions fréquentes ; séance complémentaire de 20 minutes pour les chefs, la Direction et le DRH. |
| `Annonce_socle_NIMBA.md` | Direction, administrateur | Texte prêt à publier en annonce dans l'application (Communication → Annonces). |
| `Liste_demarrage_reel.md` | Responsable du projet, administrateur, DRH | Liste de vérification du démarrage réel, avec l'écran et le critère de chaque point. |
| Rapport de qualité des données | Administrateur, DRH | Local : `pnpm --filter @dnpec/api run db:qualite` (avec les noms). Production : GitHub → Actions → « Rapport de qualité des données (manuel, lecture seule) », mot `qualite` (chiffres seulement). |

**Régénérer les fiches** après un changement d'écran :
1. régénérer les captures de l'aide (`tests/e2e/outils/captures_aide.js`) ;
2. lancer `PW_CHROMIUM=/opt/pw-browsers/chromium node tests/e2e/outils/prise_en_main_pdf.js`.

Le contenu des fiches est dans `prise_en_main.json`. Le script échoue si une fiche dépasse une page.
