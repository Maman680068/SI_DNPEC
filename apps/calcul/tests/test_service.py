"""Tests du service de calcul avec le paquet factice (Python pur, sans IPOPT) : tournent en CI.

  cd apps/calcul && python -m pytest -q
"""
from __future__ import annotations

import io
import json
import os
import sys
import zipfile
from pathlib import Path

import pytest

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "exemples"))

SECRET = "secret-de-test-calcul-0123456789"
os.environ["CALCUL_SECRET"] = SECRET
os.environ.setdefault("CALCUL_DELAI_VERIFICATION_S", "20")
os.environ.setdefault("CALCUL_DELAI_EXECUTION_S", "20")

from fastapi.testclient import TestClient  # noqa: E402

from calcul import app as service  # noqa: E402
from calcul.paquets import PaquetRefuse, controler, empreinte  # noqa: E402
from construire_paquet import construire  # noqa: E402

FACTICE = RACINE / "exemples" / "paquet_factice"
client = TestClient(service.app)
H = {"X-Calcul-Secret": SECRET}


def paquet(tmp_path, fiche=None, piege=None) -> bytes:
    sortie = tmp_path / "p.zip"
    construire(str(FACTICE), str(sortie), fiche, piege)
    return sortie.read_bytes()


def verifier(contenu: bytes, entetes=H):
    return client.post("/paquets/verifier", files={"paquet": ("p.zip", contenu, "application/zip")}, headers=entetes)


def executer(emp: str, scenario: dict, contenu: bytes | None = None):
    files = {"paquet": ("p.zip", contenu, "application/zip")} if contenu else None
    return client.post("/executer", data={"empreinte": emp, "scenario": json.dumps(scenario)}, files=files, headers=H)


def test_sante_sans_secret_et_sans_donnee():
    r = client.get("/sante")
    assert r.status_code == 200
    assert r.json()["statut"] == "ok"
    assert "CALCUL_SECRET" not in r.text and SECRET not in r.text


def test_secret_absent_ou_faux_refuse_401(tmp_path):
    contenu = paquet(tmp_path)
    assert verifier(contenu, {}).status_code == 401
    assert verifier(contenu, {"X-Calcul-Secret": SECRET + "x"}).status_code == 401
    r = client.post("/executer", data={"empreinte": "0" * 64, "scenario": "{}"})
    assert r.status_code == 401


def test_verification_renvoie_info_et_controles(tmp_path):
    contenu = paquet(tmp_path)
    r = verifier(contenu)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["statut"] == "ok"
    assert d["empreinte"] == empreinte(contenu)
    assert d["info"]["code"] == "TEST_DEMONSTRATION"
    ids = {c["id"]: c for c in d["controles"]}
    assert ids["paquet_complet"]["ok"] and ids["equilibre"]["ok"] and ids["replication_base"]["ok"]
    assert ids["dynamique"]["type"] == "alerte"


def test_controle_bloquant_en_echec(tmp_path):
    d = verifier(paquet(tmp_path, {"essai": {"controle_en_echec": "equilibre"}})).json()
    eq = next(c for c in d["controles"] if c["id"] == "equilibre")
    assert eq["ok"] is False and eq["type"] == "bloquant"


def test_execution_puis_paquet_inconnu(tmp_path):
    contenu = paquet(tmp_path, {"code": "TEST_EXEC"})
    emp = empreinte(contenu)
    service.CACHE.dossier.joinpath(f"{emp}.zip").unlink(missing_ok=True)
    r = executer(emp, {"mode": "statique"})
    assert r.status_code == 409 and r.json()["code"] == "PAQUET_INCONNU"
    r = executer(emp, {"mode": "dynamique", "chocs": [{"manette": "prix_petrole", "valeur": 20}]}, contenu)
    assert r.status_code == 200, r.text
    res = r.json()["resultat"]
    assert res["statut"] == "ok" and len(res["annees"]) == 5
    # Le paquet est maintenant en cache : l'empreinte seule suffit.
    r = executer(emp, {"mode": "statique", "chocs": [{"manette": "consommation_publique", "valeur": 10}]})
    assert r.status_code == 200 and r.json()["resultat"]["statut"] == "ok"


def test_choc_hors_bornes_refuse_par_le_modele(tmp_path):
    contenu = paquet(tmp_path)
    r = executer(empreinte(contenu), {"mode": "statique", "chocs": [{"manette": "prix_petrole", "valeur": 500}]}, contenu)
    assert r.json()["resultat"]["statut"] == "refuse"


def test_empreinte_annoncee_differente(tmp_path):
    contenu = paquet(tmp_path)
    r = executer("a" * 64, {"mode": "statique"}, contenu)
    assert r.status_code == 422 and r.json()["code"] == "EMPREINTE_DIFFERENTE"


@pytest.mark.parametrize("piege", ["absolu", "remontee", "lien", "sans_modele"])
def test_zip_piege_refuse(tmp_path, piege):
    contenu = paquet(tmp_path, piege=piege)
    with pytest.raises(PaquetRefuse):
        controler(contenu)
    r = verifier(contenu)
    assert r.status_code == 422 and r.json()["code"] == "PAQUET_REFUSE"


def test_zip_illisible_ou_trop_gros():
    assert verifier(b"pas un zip").status_code == 422
    with pytest.raises(PaquetRefuse):
        controler(b"0" * (50 * 1024 * 1024 + 1))


def test_bombe_zip_refusee():
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("modele.json", "{}")
        zf.writestr("modele.py", "")
        zf.writestr("gros.bin", b"\0" * (301 * 1024 * 1024))
    with pytest.raises(PaquetRefuse, match="300 Mo"):
        controler(tampon.getvalue())


def test_plantage_du_modele_sans_detail_interne(tmp_path):
    d = verifier(paquet(tmp_path, {"essai": {"plantage": True}})).json()
    assert d["statut"] == "echec"
    assert "Le code du modèle a échoué" in d["message"] and "Traceback" not in d["message"]


def test_delai_maximal(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "DELAI_VERIFICATION", 2)
    d = verifier(paquet(tmp_path, {"essai": {"attente_s": 10}})).json()
    assert d["statut"] == "echec" and "Délai maximal" in d["message"]


def test_le_paquet_ne_voit_pas_le_secret(tmp_path):
    """Le sous-processus reçoit un environnement réduit : le code du paquet ne lit pas CALCUL_SECRET."""
    dossier = tmp_path / "espion"
    (dossier / "donnees").mkdir(parents=True)
    (dossier / "modele.json").write_text(json.dumps({"format": "dnpec-modele/1", "code": "ESPION"}))
    (dossier / "modele.py").write_text(
        "import os\n"
        "def info():\n    return {'code': 'ESPION'}\n"
        "def controles_depot(dossier):\n"
        "    return [{'id': 'env', 'type': 'alerte', 'ok': True, 'valeur': os.environ.get('CALCUL_SECRET', 'absent')}]\n"
        "def executer(s, d):\n    return {}\n"
    )
    sortie = tmp_path / "e.zip"
    construire(str(dossier), str(sortie))
    d = verifier(sortie.read_bytes()).json()
    assert d["controles"][0]["valeur"] == "absent"


def test_sortie_du_paquet_ne_pollue_pas_la_reponse(tmp_path):
    dossier = tmp_path / "bavard"
    dossier.mkdir()
    (dossier / "modele.json").write_text(json.dumps({"format": "dnpec-modele/1", "code": "BAVARD"}))
    (dossier / "modele.py").write_text(
        "def info():\n    print('bruit'); return {'code': 'BAVARD', 'x': float('nan')}\n"
        "def controles_depot(dossier):\n    print('encore du bruit'); return []\n"
        "def executer(s, d):\n    return {}\n"
    )
    sortie = tmp_path / "b.zip"
    construire(str(dossier), str(sortie))
    d = verifier(sortie.read_bytes()).json()
    assert d["statut"] == "ok" and d["info"]["x"] is None


def test_paquet_de_demonstration_a_jour():
    """apps/api/assets/paquet-demonstration.zip (démonstration) = le paquet factice d'exemples/, fichier par fichier."""
    zf = zipfile.ZipFile(RACINE.parent / "api" / "assets" / "paquet-demonstration.zip")
    noms = sorted(n for n in zf.namelist() if not n.endswith("/"))
    attendus = sorted(str(p.relative_to(FACTICE)).replace(os.sep, "/") for p in FACTICE.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    assert noms == attendus
    for n in noms:
        assert zf.read(n) == (FACTICE / n).read_bytes(), n
