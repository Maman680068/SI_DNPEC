"""Sous-processus qui appelle le code du paquet (lancé par isolation.py, jamais directement).

Entrée (stdin, JSON) : {"op": "verifier" | "executer", "dossier": "...", "scenario": {...}}.
Sortie : un seul document JSON écrit sur le descripteur d'origine de la sortie standard.
Tout ce que le paquet imprime (Python ou bibliothèques C, ex. IPOPT) part sur la sortie
d'erreur : la réponse ne peut donc pas être polluée par le code du modèle.
"""
from __future__ import annotations

import json
import math
import os
import sys
import traceback


def _propre(v):
    """Convertit en JSON strict : nombres non finis → null, types numpy → natifs, clés en texte."""
    if isinstance(v, dict):
        return {str(k): _propre(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_propre(x) for x in v]
    if isinstance(v, bool) or v is None or isinstance(v, str):
        return v
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return v if math.isfinite(v) else None
    try:  # numpy et assimilés
        if hasattr(v, "item"):
            return _propre(v.item())
    except Exception:
        pass
    return str(v)


def _derniere_ligne(e: BaseException) -> str:
    texte = f"{type(e).__name__} : {e}"
    return texte if len(texte) <= 300 else texte[:297] + "…"


def main() -> int:
    sortie = os.fdopen(os.dup(1), "w", encoding="utf-8")
    os.dup2(2, 1)  # le paquet n'écrit jamais dans la réponse
    sys.stdout = sys.stderr
    try:
        ordre = json.loads(sys.stdin.read())
        dossier = ordre["dossier"]
        sys.path.insert(0, dossier)
        os.chdir(dossier)
        import modele  # noqa: E402  (code du paquet)

        if ordre["op"] == "verifier":
            info = modele.info()
            controles = modele.controles_depot(dossier)
            reponse = {"statut": "ok", "info": info, "controles": controles}
        elif ordre["op"] == "executer":
            reponse = {"statut": "ok", "resultat": modele.executer(ordre.get("scenario") or {}, dossier)}
        else:
            reponse = {"statut": "echec", "message": "Opération inconnue."}
    except MemoryError:
        reponse = {"statut": "echec", "message": "Mémoire insuffisante pour ce calcul."}
    except BaseException as e:  # le paquet a planté : seule la dernière ligne est renvoyée
        traceback.print_exc()
        reponse = {"statut": "echec", "message": "Le code du modèle a échoué : " + _derniere_ligne(e)}
    sortie.write(json.dumps(_propre(reponse), ensure_ascii=False, allow_nan=False))
    sortie.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
