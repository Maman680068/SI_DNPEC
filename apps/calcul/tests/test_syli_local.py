"""Test LOCAL avec le vrai paquet SYLI Standard (jamais commité : données de la DNPEC).

  SYLI_ZIP=/chemin/SYLI_Standard_v1.zip python -m pytest -q -m local

Ignoré si le zip n'est pas fourni ou si IPOPT (cyipopt) est absent — donc jamais exécuté en CI.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
SECRET = "secret-de-test-calcul-0123456789"
os.environ["CALCUL_SECRET"] = SECRET

ZIP = os.environ.get("SYLI_ZIP")
pytestmark = [
    pytest.mark.local,
    pytest.mark.skipif(not ZIP or not Path(ZIP).exists(), reason="SYLI_ZIP non fourni"),
    pytest.mark.skipif(importlib.util.find_spec("cyipopt") is None, reason="IPOPT (cyipopt) absent"),
]


def test_syli_verification_et_simulation():
    from fastapi.testclient import TestClient

    from calcul import app as service
    from calcul.paquets import empreinte

    client = TestClient(service.app)
    contenu = Path(ZIP).read_bytes()
    r = client.post("/paquets/verifier", files={"paquet": ("syli.zip", contenu, "application/zip")}, headers={"X-Calcul-Secret": SECRET})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["statut"] == "ok", d
    assert d["info"]["code"] == "SYLI_STANDARD"
    controles = {c["id"]: c for c in d["controles"]}
    for cid in ("paquet_complet", "systeme_carre", "resolution_base", "replication_base", "homogeneite", "walras"):
        assert controles[cid]["ok"], (cid, controles[cid])
    assert controles["systeme_carre"]["valeur"] == "1719 = 1719"
    sc = {"mode": "statique", "chocs": [{"manette": "prix_mondial_importations", "indices": ["i12"], "valeur": 20}]}
    r = client.post("/executer", data={"empreinte": empreinte(contenu), "scenario": json.dumps(sc)}, headers={"X-Calcul-Secret": SECRET})
    res = r.json()["resultat"]
    assert res["statut"] == "ok", res.get("message")
    assert "2021" in res["ecarts_pct"]
    sc = {"mode": "statique", "chocs": [{"manette": "productivite", "valeur": 50}]}
    r = client.post("/executer", data={"empreinte": empreinte(contenu), "scenario": json.dumps(sc)}, headers={"X-Calcul-Secret": SECRET})
    assert r.json()["resultat"]["statut"] == "refuse"
