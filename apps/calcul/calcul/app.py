"""Service de calcul de la plateforme DNPEC (« dnpec-calcul »).

Exécutant sans état : il ne connaît ni la base de données ni le stockage de l'application.
Seule l'API l'appelle, avec le secret partagé CALCUL_SECRET (en-tête X-Calcul-Secret).

  GET  /sante              sonde (sans secret, sans aucune donnée)
  POST /paquets/verifier   zip → info() + controles_depot()
  POST /executer           empreinte (+ zip si le cache ne l'a plus) + scénario → executer()

Le zip est gardé dans un cache disque éphémère, rangé par empreinte SHA-256 ; s'il n'y est
plus (redémarrage, réveil du service), /executer répond 409 « paquet inconnu » et l'API le renvoie.
"""
from __future__ import annotations

import hmac
import importlib.util
import json
import os
import shutil
import tempfile
import threading
import time

from fastapi import FastAPI, File, Form, Header, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from . import isolation
from .paquets import TAILLE_MAX, Cache, PaquetRefuse, controler, empreinte, extraire

VERSION = "1.0.0"


def _entier(nom: str, defaut: int) -> int:
    try:
        return int(os.environ.get(nom, defaut))
    except ValueError:
        return defaut


DELAI_VERIFICATION = _entier("CALCUL_DELAI_VERIFICATION_S", 300)
DELAI_EXECUTION = _entier("CALCUL_DELAI_EXECUTION_S", 600)
MEMOIRE_MO = _entier("CALCUL_MEMOIRE_MO", 2048)
CACHE = Cache(os.environ.get("CALCUL_CACHE_DIR", os.path.join(tempfile.gettempdir(), "dnpec-paquets")), _entier("CALCUL_CACHE_MAX_MO", 300) * 1024 * 1024)
DEMARRE_LE = time.time()

app = FastAPI(title="dnpec-calcul", docs_url=None, redoc_url=None, openapi_url=None)
_occupe = threading.Lock()  # un seul calcul à la fois (service gratuit : 0,1 processeur)
OCCUPE = "Un calcul est déjà en cours : nouvel essai dans un instant."


def _erreur(statut: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=statut, content={"code": code, "message": message})


def _autorise(secret: str | None) -> JSONResponse | None:
    attendu = os.environ.get("CALCUL_SECRET", "")
    if len(attendu) < 16:
        return _erreur(503, "NON_CONFIGURE", "Service de calcul non configuré (CALCUL_SECRET absent ou trop court).")
    if not secret or not hmac.compare_digest(secret.encode("utf-8"), attendu.encode("utf-8")):
        return _erreur(401, "NON_AUTORISE", "Secret absent ou incorrect.")
    return None


async def _lire(fichier: UploadFile) -> bytes:
    contenu = await fichier.read(TAILLE_MAX + 1)
    if len(contenu) > TAILLE_MAX:
        raise PaquetRefuse("Le paquet dépasse 50 Mo.")
    return contenu


def _avec_paquet(contenu: bytes, op: str, scenario: dict | None, delai: int) -> dict | None:
    """Calcul dans un fil à part (la sonde /sante répond pendant ce temps) ; None si déjà occupé."""
    if not _occupe.acquire(timeout=1):
        return None
    try:
        return _calcul(contenu, op, scenario, delai)
    finally:
        _occupe.release()


def _calcul(contenu: bytes, op: str, scenario: dict | None, delai: int) -> dict:
    controle = controler(contenu)
    parent = tempfile.mkdtemp(prefix="paquets-")
    try:
        dossier = extraire(contenu, controle, parent)
        return isolation.lancer(op, dossier, scenario, delai, MEMOIRE_MO)
    finally:
        shutil.rmtree(parent, ignore_errors=True)


@app.get("/sante")
def sante():
    return {
        "statut": "ok",
        "service": "dnpec-calcul",
        "version": VERSION,
        "solveurs": {"ipopt": importlib.util.find_spec("cyipopt") is not None},
        "eveille_depuis_s": round(time.time() - DEMARRE_LE),
    }


@app.post("/paquets/verifier")
async def verifier(
    paquet: UploadFile = File(...),
    empreinte_attendue: str | None = Form(None, alias="empreinte"),
    x_calcul_secret: str | None = Header(None),
):
    refus = _autorise(x_calcul_secret)
    if refus:
        return refus
    try:
        contenu = await _lire(paquet)
        emp = empreinte(contenu)
        if empreinte_attendue and empreinte_attendue != emp:
            return _erreur(422, "EMPREINTE_DIFFERENTE", "L'empreinte du paquet reçu ne correspond pas à celle annoncée.")
        controler(contenu)
        CACHE.ranger(emp, contenu)
    except PaquetRefuse as e:
        return _erreur(422, "PAQUET_REFUSE", str(e))
    r = await run_in_threadpool(_avec_paquet, contenu, "verifier", None, DELAI_VERIFICATION)
    if r is None:
        return _erreur(503, "OCCUPE", OCCUPE)
    r["empreinte"] = emp
    return r


@app.post("/executer")
async def executer(
    empreinte_paquet: str = Form(..., alias="empreinte"),
    scenario: str = Form(...),
    paquet: UploadFile | None = File(None),
    x_calcul_secret: str | None = Header(None),
):
    refus = _autorise(x_calcul_secret)
    if refus:
        return refus
    try:
        sc = json.loads(scenario)
        if not isinstance(sc, dict):
            raise ValueError
    except ValueError:
        return _erreur(422, "SCENARIO_INVALIDE", "Le scénario doit être un objet JSON.")
    try:
        if paquet is not None:
            contenu = await _lire(paquet)
            if empreinte(contenu) != empreinte_paquet:
                return _erreur(422, "EMPREINTE_DIFFERENTE", "L'empreinte du paquet reçu ne correspond pas à celle annoncée.")
            controler(contenu)
            CACHE.ranger(empreinte_paquet, contenu)
        else:
            contenu = CACHE.lire(empreinte_paquet)
            if contenu is None:
                return _erreur(409, "PAQUET_INCONNU", "Paquet inconnu du service de calcul : renvoyez-le avec la demande.")
    except PaquetRefuse as e:
        return _erreur(422, "PAQUET_REFUSE", str(e))
    r = await run_in_threadpool(_avec_paquet, contenu, "executer", sc, DELAI_EXECUTION)
    return r if r is not None else _erreur(503, "OCCUPE", OCCUPE)
