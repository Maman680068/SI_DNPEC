"""Paquets de modèle (format « dnpec-modele/1 ») : contrôle du zip, cache disque, extraction.

Le zip est contrôlé AVANT toute extraction : taille, nombre d'entrées, taille décompressée,
chemins (ni absolus, ni « .. »), aucun lien symbolique. L'extraction se fait fichier par
fichier dans un dossier temporaire neuf, jamais par ``extractall``.
"""
from __future__ import annotations

import hashlib
import os
import stat
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

TAILLE_MAX = 50 * 1024 * 1024          # 50 Mo (zip reçu)
DECOMPRESSE_MAX = 300 * 1024 * 1024     # 300 Mo une fois décompressé (bombe zip)
ENTREES_MAX = 2000
FICHIERS_OBLIGATOIRES = ("modele.json", "modele.py")


class PaquetRefuse(Exception):
    """Zip refusé avant extraction (message en français, montré à l'administrateur)."""


def empreinte(contenu: bytes) -> str:
    return hashlib.sha256(contenu).hexdigest()


@dataclass
class Controle:
    racine: str  # préfixe commun (« » ou « dossier/ ») sous lequel se trouvent modele.json et modele.py
    fichiers: list[str]


def _chemin_sur(nom: str) -> PurePosixPath:
    if not nom or "\x00" in nom:
        raise PaquetRefuse("Nom de fichier vide ou invalide dans le paquet.")
    brut = nom.replace("\\", "/")
    if brut.startswith("/") or (len(brut) > 1 and brut[1] == ":"):
        raise PaquetRefuse(f"Chemin absolu refusé dans le paquet : « {nom} ».")
    p = PurePosixPath(brut)
    if any(part == ".." for part in p.parts):
        raise PaquetRefuse(f"Chemin remontant (« .. ») refusé dans le paquet : « {nom} ».")
    return p


def controler(contenu: bytes) -> Controle:
    """Contrôle complet du zip, sans rien écrire sur le disque."""
    if len(contenu) > TAILLE_MAX:
        raise PaquetRefuse("Le paquet dépasse 50 Mo.")
    try:
        import io

        zf = zipfile.ZipFile(io.BytesIO(contenu))
    except zipfile.BadZipFile:
        raise PaquetRefuse("Le fichier n'est pas un zip lisible.")
    with zf:
        infos = zf.infolist()
        if len(infos) > ENTREES_MAX:
            raise PaquetRefuse(f"Le paquet contient plus de {ENTREES_MAX} fichiers.")
        total = 0
        fichiers: list[str] = []
        for info in infos:
            p = _chemin_sur(info.filename)
            mode = (info.external_attr >> 16) & 0o170000
            if mode == stat.S_IFLNK:
                raise PaquetRefuse(f"Lien symbolique refusé dans le paquet : « {info.filename} ».")
            if info.flag_bits & 0x1:
                raise PaquetRefuse("Les paquets chiffrés ne sont pas acceptés.")
            total += info.file_size
            if total > DECOMPRESSE_MAX:
                raise PaquetRefuse("Le paquet décompressé dépasse 300 Mo.")
            if not info.is_dir():
                fichiers.append(str(p))
        racine = ""
        if "modele.json" not in fichiers:
            # Toléré : un seul dossier de premier niveau qui contient tout le paquet.
            tetes = {f.split("/", 1)[0] for f in fichiers if "/" in f}
            seuls = [f for f in fichiers if "/" not in f]
            if len(tetes) == 1 and not seuls:
                racine = tetes.pop() + "/"
        manquants = [f for f in FICHIERS_OBLIGATOIRES if racine + f not in fichiers]
        if manquants:
            raise PaquetRefuse("Fichier obligatoire absent du paquet : " + ", ".join(manquants) + ".")
        return Controle(racine=racine, fichiers=fichiers)


def extraire(contenu: bytes, controle: Controle, dossier_parent: str) -> str:
    """Extrait le paquet dans un dossier temporaire neuf ; renvoie le dossier du modèle."""
    import io

    cible = tempfile.mkdtemp(prefix="paquet-", dir=dossier_parent)
    base = Path(cible).resolve()
    with zipfile.ZipFile(io.BytesIO(contenu)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            p = _chemin_sur(info.filename)
            dest = (base / Path(*p.parts)).resolve()
            if base not in dest.parents:
                raise PaquetRefuse(f"Chemin hors du dossier refusé : « {info.filename} ».")
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(dest, "wb") as out:
                restant = DECOMPRESSE_MAX
                while True:
                    bloc = src.read(1 << 20)
                    if not bloc:
                        break
                    restant -= len(bloc)
                    if restant < 0:
                        raise PaquetRefuse("Le paquet décompressé dépasse 300 Mo.")
                    out.write(bloc)
            os.chmod(dest, 0o600)
    return str(base / controle.racine) if controle.racine else str(base)


class Cache:
    """Cache disque éphémère des paquets, rangés par empreinte (perdu au redémarrage : normal)."""

    def __init__(self, dossier: str, max_octets: int):
        self.dossier = Path(dossier)
        self.dossier.mkdir(parents=True, exist_ok=True)
        self.max_octets = max_octets

    def _chemin(self, emp: str) -> Path:
        if len(emp) != 64 or any(c not in "0123456789abcdef" for c in emp):
            raise PaquetRefuse("Empreinte invalide.")
        return self.dossier / f"{emp}.zip"

    def lire(self, emp: str) -> bytes | None:
        p = self._chemin(emp)
        if not p.exists():
            return None
        os.utime(p)
        return p.read_bytes()

    def ranger(self, emp: str, contenu: bytes) -> None:
        p = self._chemin(emp)
        tmp = p.with_suffix(".tmp")
        tmp.write_bytes(contenu)
        tmp.replace(p)
        self._elaguer(garder=p)

    def _elaguer(self, garder: Path) -> None:
        fichiers = sorted(self.dossier.glob("*.zip"), key=lambda f: f.stat().st_mtime)
        total = sum(f.stat().st_size for f in fichiers)
        for f in fichiers:
            if total <= self.max_octets:
                break
            if f == garder:
                continue
            total -= f.stat().st_size
            f.unlink(missing_ok=True)
