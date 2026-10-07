"""Construit le zip d'un paquet de modèle à partir d'un dossier (dates fixes : zip reproductible).

  python construire_paquet.py <dossier> <sortie.zip> [--fiche '{"code": "...", "essai": {...}}'] [--piege PIEGE]

--fiche  fusionne ces clés dans modele.json (tests : autre code, essai…).
--piege  ajoute un piège que la plateforme doit refuser (tests) :
         absolu (chemin /etc/x), remontee (../x), lien (lien symbolique), sans_modele (modele.py retiré).
"""
from __future__ import annotations

import argparse
import json
import os
import zipfile

DATE = (2026, 1, 1, 0, 0, 0)


def _ajouter(zf: zipfile.ZipFile, nom: str, contenu: bytes, mode: int = 0o644) -> None:
    info = zipfile.ZipInfo(nom, DATE)
    info.external_attr = (0o100000 | mode) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, contenu)


def construire(dossier: str, sortie: str, fiche: dict | None = None, piege: str | None = None) -> None:
    fichiers = []
    for racine, _, noms in os.walk(dossier):
        for n in noms:
            if n.endswith(".pyc") or "__pycache__" in racine:
                continue
            chemin = os.path.join(racine, n)
            fichiers.append((os.path.relpath(chemin, dossier).replace(os.sep, "/"), chemin))
    with zipfile.ZipFile(sortie, "w") as zf:
        for nom, chemin in sorted(fichiers):
            if piege == "sans_modele" and nom == "modele.py":
                continue
            with open(chemin, "rb") as f:
                contenu = f.read()
            if nom == "modele.json" and fiche:
                d = json.loads(contenu)
                d.update(fiche)
                contenu = json.dumps(d, ensure_ascii=False, indent=2).encode("utf-8")
            _ajouter(zf, nom, contenu)
        if piege == "absolu":
            _ajouter(zf, "/etc/dnpec-piege.txt", b"piege")
        elif piege == "remontee":
            _ajouter(zf, "../dnpec-piege.txt", b"piege")
        elif piege == "lien":
            info = zipfile.ZipInfo("lien-vers-etc", DATE)
            info.external_attr = (0o120777) << 16
            zf.writestr(info, "/etc/passwd")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("dossier")
    p.add_argument("sortie")
    p.add_argument("--fiche")
    p.add_argument("--piege", choices=["absolu", "remontee", "lien", "sans_modele"])
    a = p.parse_args()
    construire(a.dossier, a.sortie, json.loads(a.fiche) if a.fiche else None, a.piege)
