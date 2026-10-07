# TEST — Modèle de démonstration (format « dnpec-modele/1 »)

Paquet **factice** : Python pur, sans solveur, valeurs fictives sans portée économique.
Il sert aux tests de la plateforme (intégration continue) et à la démonstration.

Même contrat que tout paquet de modèle : `modele.json` (fiche), `modele.py` (`info()`,
`controles_depot(dossier)`, `executer(scenario, dossier)`), `donnees/`, `reference/`.

Construire le zip : `python apps/calcul/exemples/construire_paquet.py <dossier> <sortie.zip>`.
