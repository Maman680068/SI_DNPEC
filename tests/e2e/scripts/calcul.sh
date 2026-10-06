#!/usr/bin/env bash
# Démarre le service de calcul (apps/calcul, lot B1) sur le port 3302 et le relais de test sur 3301
# (l'API appelle le relais : CALCUL_URL=http://localhost:3301). Python : CALCUL_PYTHON ou python3
# (paquets de apps/calcul/requirements-ci.txt ; le paquet factice n'a besoin ni d'IPOPT ni de pyomo).
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); RACINE=$(cd "$ICI/../.." && pwd)
OUT=${E2E_OUT:-$ICI/out}; mkdir -p "$OUT/logs"
PY=${CALCUL_PYTHON:-python3}
for f in calcul relais-calcul; do [ -f "$OUT/logs/$f.pid" ] && kill "$(cat "$OUT/logs/$f.pid")" 2>/dev/null || true; done
for p in 3301 3302; do for x in $(lsof -t -i :$p 2>/dev/null || true); do kill "$x" 2>/dev/null || true; done; done
sleep 1
cd "$RACINE/apps/calcul"
CALCUL_CACHE_DIR="$OUT/calcul-cache" CALCUL_DELAI_VERIFICATION_S=60 CALCUL_DELAI_EXECUTION_S=60 \
  nohup "$PY" -m uvicorn calcul.app:app --host 127.0.0.1 --port 3302 > "$OUT/logs/calcul.log" 2>&1 &
echo $! > "$OUT/logs/calcul.pid"
nohup node "$ICI/outils/relais_calcul.js" 3301 3302 > "$OUT/logs/relais-calcul.log" 2>&1 &
echo $! > "$OUT/logs/relais-calcul.pid"
for i in $(seq 1 30); do curl -sf localhost:3301/sante >/dev/null && { echo "Service de calcul prêt (3302, relais 3301)"; exit 0; }; sleep 1; done
echo "Service de calcul KO — voir $OUT/logs/calcul.log"; tail -20 "$OUT/logs/calcul.log"; exit 1
