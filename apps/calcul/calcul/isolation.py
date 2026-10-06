"""Exécution du code d'un paquet dans un sous-processus borné.

- délai maximal (vérification 300 s, exécution 600 s par défaut), groupe de processus tué au-delà ;
- mémoire (RLIMIT_AS), temps processeur, taille des fichiers écrits et nombre de fichiers ouverts bornés ;
- environnement réduit au strict nécessaire : aucune variable du service (ni CALCUL_SECRET, ni autre),
  seulement PATH, la langue et PYOMO_CONFIG_DIR (emplacement des bibliothèques de pyomo) ;
- dossier de travail temporaire, détruit après l'appel.
"""
from __future__ import annotations

import json
import os
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RACINE_SERVICE = str(Path(__file__).resolve().parent.parent)


def _limites(memoire_octets: int, cpu_s: int):
    def appliquer():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_AS, (memoire_octets, memoire_octets))
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_s, cpu_s + 5))
        resource.setrlimit(resource.RLIMIT_FSIZE, (50 * 1024 * 1024, 50 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

    return appliquer


def lancer(op: str, dossier_paquet: str, scenario: dict | None, delai_s: int, memoire_mo: int) -> dict:
    """Lance l'opération ; renvoie {"statut": "ok", ...} ou {"statut": "echec", "message": ...}."""
    travail = tempfile.mkdtemp(prefix="travail-")
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": travail,
        "TMPDIR": travail,
        "PYTHONPATH": RACINE_SERVICE,
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONIOENCODING": "utf-8",
        "OMP_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "LANG": "C.UTF-8",
    }
    # Bibliothèques compilées de pyomo (pynumero) : chemin seulement, aucune donnée sensible.
    if os.environ.get("PYOMO_CONFIG_DIR"):
        env["PYOMO_CONFIG_DIR"] = os.environ["PYOMO_CONFIG_DIR"]
    ordre = json.dumps({"op": op, "dossier": dossier_paquet, "scenario": scenario})
    t0 = time.monotonic()
    proc = subprocess.Popen(
        [sys.executable, "-m", "calcul.executeur"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=travail,
        env=env,
        preexec_fn=_limites(memoire_mo * 1024 * 1024, delai_s + 5),
    )
    try:
        sortie, erreurs = proc.communicate(ordre.encode("utf-8"), timeout=delai_s)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.communicate()
        shutil.rmtree(travail, ignore_errors=True)
        return {"statut": "echec", "message": f"Délai maximal dépassé ({delai_s} s) : le calcul a été arrêté.", "duree_s": round(time.monotonic() - t0, 1)}
    finally:
        shutil.rmtree(travail, ignore_errors=True)
    duree = round(time.monotonic() - t0, 1)
    if proc.returncode != 0 or not sortie:
        if proc.returncode in (-signal.SIGKILL, -signal.SIGXCPU):
            message = "Le calcul a été arrêté (temps processeur ou mémoire dépassé)."
        elif b"MemoryError" in (erreurs or b""):
            message = "Mémoire insuffisante pour ce calcul."
        else:
            message = f"Le calcul s'est arrêté anormalement (code {proc.returncode})."
        return {"statut": "echec", "message": message, "duree_s": duree}
    try:
        reponse = json.loads(sortie.decode("utf-8"))
    except ValueError:
        return {"statut": "echec", "message": "Réponse illisible du code du modèle.", "duree_s": duree}
    reponse["duree_s"] = duree
    return reponse
