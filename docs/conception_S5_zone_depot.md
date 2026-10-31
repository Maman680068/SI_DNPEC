# S5 — Zone de dépôt de fichiers entièrement cliquable (correctif)

**Constat** : dans `ZoneDepot` (`apps/web/components/ui/Formulaire.tsx`), seul le lien « parcourez votre
ordinateur » ouvrait l'explorateur ; un clic sur l'icône, sur « Glissez votre fichier ici » ou dans le cadre
ne faisait rien.

**Données** : aucune. **Droits** : inchangés (le composant ne fait qu'ouvrir le choix du fichier).

**Écran** :
- le cadre entier est un bouton (`role="button"`, `tabIndex=0`, nom accessible « <libellé> : glissez votre
  fichier ici ou parcourez votre ordinateur », aide reliée par `aria-describedby`) ; clic, Entrée et Espace
  ouvrent le choix du fichier ; curseur main, survol et contour au clavier ;
- « parcourez votre ordinateur » n'est plus un bouton imbriqué (texte souligné au survol) ; le champ
  `input type=file` est sorti du cadre et retiré de l'ordre de tabulation : aucun élément interactif
  imbriqué, une seule ouverture par clic (les clics venus d'un bouton ou d'un champ sont ignorés) ;
- glisser-déposer inchangé. Vaut pour tous les usages (Archives, tâches, diffusion, scans du courrier,
  modèles, modèle d'attestation), qui passent tous par `ZoneDepot`.

**Test** : `tests/e2e/ui/s5_zone_depot_ui.js` (texte, icône, lien, cadre, Entrée, Espace, fichier pris).
