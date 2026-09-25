#!/usr/bin/env bash
# Démarre le frontend compilé (next start) sur le port 3100.
set -euo pipefail
ICI=$(cd "$(dirname "$0")/.." && pwd); RACINE=$(cd "$ICI/../.." && pwd)
OUT=${E2E_OUT:-$ICI/out}; mkdir -p "$OUT/logs"
pid="$OUT/logs/web.pid"
[ -f "$pid" ] && kill "$(cat "$pid")" 2>/dev/null || true
for p in $(lsof -t -i :3100 2>/dev/null || true); do kill "$p" 2>/dev/null || true; done
sleep 1
cd "$RACINE/apps/web"
nohup pnpm exec next start -p 3100 > "$OUT/logs/web.log" 2>&1 &
echo $! > "$pid"
for i in $(seq 1 60); do curl -sf -o /dev/null localhost:3100/login && { echo "Web prêt sur le port 3100"; exit 0; }; sleep 1; done
echo "Web KO — voir $OUT/logs/web.log"; tail -30 "$OUT/logs/web.log"; exit 1
