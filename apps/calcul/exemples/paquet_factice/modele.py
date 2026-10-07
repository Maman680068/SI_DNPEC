"""Modèle factice « TEST — Modèle de démonstration » (contrat « dnpec-modele/1 »).

Python pur, sans solveur ni dépendance : PIB = C + G + I + X − M sur des valeurs fictives.
Il sert aux tests de la plateforme (CI) et à la démonstration ; ses chiffres n'ont aucune
portée économique.

La rubrique « essai » de modele.json permet aux tests de provoquer un comportement :
  {"controle_en_echec": "equilibre"}  un contrôle bloquant en échec au dépôt
  {"attente_s": 5}                    un calcul lent (délai maximal)
  {"plantage": true}                  une exception dans le code du modèle
  {"non_convergence": true}           une exécution qui échoue sans aucun chiffre
"""
from __future__ import annotations

import json
import os
import time

ICI = os.path.dirname(os.path.abspath(__file__))


def info():
    with open(os.path.join(ICI, "modele.json"), encoding="utf-8") as f:
        return json.load(f)


def _essai():
    return info().get("essai") or {}


def _base(dossier=None):
    with open(os.path.join(dossier or ICI, "donnees", "base.json"), encoding="utf-8") as f:
        return json.load(f)


def _comptes(b, f_g=1.0, f_petrole=1.0, f_mines=None):
    f_mines = f_mines or {}
    exportations = sum(v * f_mines.get(k, 1.0) for k, v in b["exportations"].items())
    importations = b["importations_hors_petrole"] + b["importations_petrole"] * f_petrole
    g = b["consommation_publique"] * f_g
    c = b["consommation_privee"] + 0.4 * (exportations - sum(b["exportations"].values()))
    pib = c + g + b["investissement"] + exportations - importations
    recettes = 0.15 * pib
    return {
        "pib_reel": {"total": pib},
        "consommation": {"privee": c, "publique": g},
        "etat": {"recettes": recettes, "solde": recettes - g},
        "commerce_exterieur": {"importations": importations, "exportations": exportations},
    }


def _ecart(a, b):
    if isinstance(a, dict):
        return {k: _ecart(a[k], b[k]) for k in a}
    return None if b == 0 else 100.0 * (a / b - 1)


def executer(scenario, dossier=None):
    t0 = time.time()
    e = _essai()
    if e.get("attente_s"):
        time.sleep(float(e["attente_s"]))
    if e.get("plantage"):
        raise RuntimeError("plantage volontaire du modèle de démonstration")
    meta = info()
    manettes = {m["id"]: m for m in meta["manettes"]}
    f_g, f_p, f_m = 1.0, 1.0, {}
    croissance = 0.02
    try:
        for ch in scenario.get("chocs", []):
            m = manettes.get(ch.get("manette"))
            if not m or m["type"] != "choc":
                raise ValueError(f"manette inconnue ou non autorisée : {ch.get('manette')}")
            v = float(ch["valeur"])
            if not (m["min"] <= v <= m["max"]):
                raise ValueError(f"{m['libelle']} : {v} hors des bornes [{m['min']} ; {m['max']}]")
            f = 1 + v / 100
            if m["id"] == "consommation_publique":
                f_g *= f
            elif m["id"] == "prix_petrole":
                f_p *= f
            else:
                for k in ch.get("indices") or [x["code"] for x in m["indices"]]:
                    f_m[k] = f_m.get(k, 1.0) * f
        for h in scenario.get("hypotheses", []):
            m = manettes.get(h.get("manette"))
            if not m or m["type"] != "hypothese":
                raise ValueError(f"hypothèse inconnue : {h.get('manette')}")
            v = float(h["valeur"])
            if not (m["min"] <= v <= m["max"]):
                raise ValueError(f"{m['libelle']} : {v} hors des bornes [{m['min']} ; {m['max']}]")
            croissance = v / 100
    except ValueError as err:
        return {"statut": "refuse", "message": str(err)}
    if e.get("non_convergence"):
        return {"statut": "echec", "message": "Le modèle n'a pas convergé : aucun résultat n'est publié.", "duree_s": round(time.time() - t0, 2)}
    b = _base(dossier)
    mode = scenario.get("mode", "statique")
    debut, fin = meta["horizon"]["debut"], meta["horizon"]["fin"]
    annees = [debut] if mode == "statique" else list(range(debut, fin + 1))
    ref, sce = {}, {}
    for i, a in enumerate(annees):
        echelle = (1 + croissance) ** i
        bb = {k: ({kk: vv * echelle for kk, vv in v.items()} if isinstance(v, dict) else v * echelle) for k, v in b.items()}
        ref[a] = _comptes(bb)
        actif = lambda ch: not ch.get("annees") or a in ch["annees"]  # noqa: E731
        if all(actif(ch) for ch in scenario.get("chocs", [])):
            sce[a] = _comptes(bb, f_g, f_p, f_m)
        else:
            sce[a] = ref[a]
    return {
        "statut": "ok",
        "message": "",
        "annees": annees,
        "reference": ref,
        "scenario": sce,
        "ecarts_pct": {a: _ecart(sce[a], ref[a]) for a in annees},
        "controles": [{"id": "equilibre", "ok": True, "valeur": "0"}],
        "duree_s": round(time.time() - t0, 2),
    }


def controles_depot(dossier=None):
    dossier = dossier or ICI
    e = _essai()
    if e.get("attente_s"):
        time.sleep(float(e["attente_s"]))
    if e.get("plantage"):
        raise RuntimeError("plantage volontaire du modèle de démonstration")
    meta = info()
    attendus = [f["chemin"] for f in meta["fichiers"]]
    manquants = [p for p in attendus if not os.path.exists(os.path.join(dossier, p))]
    out = [{"id": "paquet_complet", "type": "bloquant", "ok": not manquants,
            "valeur": f"{len(attendus)} fichiers" if not manquants else f"manquants : {manquants}"}]
    if manquants:
        return out
    b = _base(dossier)
    comptes = _comptes(b)
    emplois = comptes["consommation"]["privee"] + comptes["consommation"]["publique"] + b["investissement"] + comptes["commerce_exterieur"]["exportations"]
    ressources = comptes["pib_reel"]["total"] + comptes["commerce_exterieur"]["importations"]
    ecart = abs(emplois - ressources) / ressources
    if e.get("controle_en_echec") == "equilibre":
        ecart = 0.0042
    out.append({"id": "equilibre", "type": "bloquant", "ok": ecart <= 1e-4, "valeur": f"écart {100 * ecart:.2f} %"})
    with open(os.path.join(dossier, meta["reference"]["fichier"]), encoding="utf-8") as f:
        attendu = json.load(f)["pib_reel"]
    e0 = abs(comptes["pib_reel"]["total"] - attendu) / attendu
    out.append({"id": "replication_base", "type": "bloquant", "ok": e0 <= 0.005, "valeur": f"écart max {100 * e0:.4f} %"})
    out.append({"id": "dynamique", "type": "alerte", "ok": False, "valeur": "pas de référence : non comparée"})
    return out
