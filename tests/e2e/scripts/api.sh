#!/usr/bin/env bash
# Démarre (ou redémarre) l'API compilée : port 3000, et 3001 avec l'horloge avancée d'un an
# (« annee ») pour les tests du changement d'année. Journaux dans $E2E_OUT/logs.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); RACINE=$(cd "$ICI/../.." && pwd)
OUT=${E2E_OUT:-$ICI/out}; mkdir -p "$OUT/logs"
bash "$ICI/scripts/garde-locale.sh"
mode=${1:-normal}; port=3000; req=""
if [ "$mode" = annee ]; then port=3001; req="-r $ICI/scripts/decalage-annee.js"; fi
pid="$OUT/logs/api-$mode.pid"
[ -f "$pid" ] && kill "$(cat "$pid")" 2>/dev/null || true
for p in $(lsof -t -i :$port 2>/dev/null || true); do kill "$p" 2>/dev/null || true; done
sleep 1
cd "$RACINE/apps/api"
NODE_ENV=production PORT=$port nohup node $req dist/main.js > "$OUT/logs/api-$mode.log" 2>&1 &
echo $! > "$pid"
for i in $(seq 1 60); do curl -sf "localhost:$port/health" >/dev/null && { echo "API ($mode) prête sur le port $port"; exit 0; }; sleep 1; done
echo "API ($mode) KO — voir $OUT/logs/api-$mode.log"; tail -30 "$OUT/logs/api-$mode.log"; exit 1
