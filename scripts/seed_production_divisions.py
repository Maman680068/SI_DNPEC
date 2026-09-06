#!/usr/bin/env python3
"""Crée les 5 Divisions officielles de la DNPEC et leurs 18 Sections, via
l'API réelle (POST /org/divisions, POST /org/divisions/:id/sections) —
jamais en accès direct à la base. Idempotent : relancer ce script ne
recrée rien qui existe déjà (recherche par code avant chaque création).

Identifiants demandés de façon interactive (email visible, mot de passe
masqué via getpass) — jamais en argument de ligne de commande ni codé en
dur, pour ne jamais atterrir dans l'historique du shell ou un log.

Aucune dépendance tierce (urllib de la bibliothèque standard) — seul
python3 est nécessaire, déjà présent sur toute machine de développement.

Usage :
    python3 scripts/seed_production_divisions.py
    BASE_URL=http://localhost:3000 python3 scripts/seed_production_divisions.py  # test local
"""

import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from typing import List, Optional

BASE_URL = os.environ.get("BASE_URL", "https://dnpec-api.onrender.com")

# (code division, nom complet, [(code section, nom complet), ...])
DIVISIONS = [
    (
        "DPE",
        "Division des Prévisions Économiques",
        [
            ("SSR", "Secteur Réel"),
            ("SFP", "Finances Publiques"),
            ("SSME", "Secteurs Monétaires et Extérieur"),
            ("SGOP", "Gestion des Outils de Prévision"),
        ],
    ),
    (
        "DEE",
        "Division Études Économiques",
        [
            ("SE", "Études"),
            ("SDP", "Documentation et Publications"),
            ("SME", "Modélisation Économique"),
        ],
    ),
    (
        "DSPS",
        "Division Suivi de Politiques Économiques",
        [
            ("SSSP", "Suivi du Secteur Primaire"),
            ("SSSS", "Suivi du Secteur Secondaire"),
            ("SSST", "Suivi du Secteur Tertiaire"),
            ("SSSQ", "Suivi du Secteur Quaternaire"),
        ],
    ),
    (
        "DAC",
        "Division Analyses Conjoncturelles",
        [
            ("SCI", "Conjoncture Internationale"),
            ("SCN", "Conjoncture Nationale"),
            ("SEC", "Enquête Conjoncturelle"),
            ("SGBD", "Gestion de la Base des Données"),
        ],
    ),
    (
        "DIPE",
        "Division Intégration et Partenariats Économiques",
        [
            ("SIRC", "Intégration Régionale et Convergence"),
            ("SPEN", "Partenariats Économiques et Négociations"),
            ("SAEVS", "Analyse, Études et Veille Stratégique"),
        ],
    ),
]


class ApiError(Exception):
    pass


def request(method: str, path: str, token: Optional[str] = None, body: Optional[dict] = None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8")
        raise ApiError(f"{method} {path} -> HTTP {e.code}: {payload}") from None


def login(email: str, password: str) -> str:
    result = request("POST", "/auth/login", body={"email": email, "password": password})
    if isinstance(result, dict) and result.get("status") in (
        "two_fa_challenge_required",
        "two_fa_setup_required",
    ):
        print(
            "Ce compte a la 2FA activée — ce script ne gère pas le challenge TOTP.\n"
            "Connectez-vous une fois via l'interface web, ou utilisez un compte\n"
            "ADMIN_SYSTEME sans 2FA (non obligatoire pour ce rôle).",
            file=sys.stderr,
        )
        sys.exit(1)
    return result["accessToken"]


def find_by_code(items: List[dict], code: str) -> Optional[dict]:
    return next((i for i in items if i["code"] == code), None)


def main() -> None:
    print(f"=== Cible : {BASE_URL} ===")
    email = input("Email administrateur : ").strip()
    password = getpass.getpass("Mot de passe : ")

    try:
        token = login(email, password)
    except (ApiError, KeyError) as e:
        print(f"Échec de connexion : {e}", file=sys.stderr)
        sys.exit(1)
    print("Connecté.")

    print("\n=== Divisions ===")
    existing_divisions = request("GET", "/org/divisions", token=token)

    for code, name, sections in DIVISIONS:
        division = find_by_code(existing_divisions, code)
        if division:
            print(f"  {code} — déjà présente (id={division['id']})")
        else:
            try:
                division = request("POST", "/org/divisions", token=token, body={"code": code, "name": name})
            except ApiError as e:
                print(f"  {code} — ÉCHEC : {e}", file=sys.stderr)
                sys.exit(1)
            print(f"  {code} — créée (id={division['id']})")

        existing_sections = request("GET", f"/org/divisions/{division['id']}/sections", token=token)
        for scode, sname in sections:
            if find_by_code(existing_sections, scode):
                print(f"    {scode} — déjà présente")
                continue
            try:
                request(
                    "POST",
                    f"/org/divisions/{division['id']}/sections",
                    token=token,
                    body={"code": scode, "name": sname},
                )
            except ApiError as e:
                print(f"    {scode} — ÉCHEC : {e}", file=sys.stderr)
                sys.exit(1)
            print(f"    {scode} — créée")

    print("\n=== Vérification (GET /org/divisions + GET /org/divisions/:id/sections) ===")
    final_divisions = request("GET", "/org/divisions", token=token)
    print(f"Divisions trouvées : {len(final_divisions)}")

    total_sections = 0
    for code, _name, expected_sections in DIVISIONS:
        division = find_by_code(final_divisions, code)
        if not division:
            print(f"  {code} — INTROUVABLE", file=sys.stderr)
            sys.exit(1)
        sections = request("GET", f"/org/divisions/{division['id']}/sections", token=token)
        print(f"  {code} — {len(sections)} section(s)")
        total_sections += len(sections)

    print(f"\nTotal sections : {total_sections}")
    if len(final_divisions) >= 5 and total_sections >= 18:
        print("OK — 5 divisions et 18 sections confirmées présentes.")
    else:
        print("ATTENTION — nombre inattendu (attendu : au moins 5 divisions, 18 sections).", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
