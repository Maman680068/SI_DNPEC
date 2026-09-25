#!/usr/bin/env bash
# Refuse toute base qui n'est pas locale : la suite VIDE la base avant de la remplir.
# Seuls localhost et 127.0.0.1 sont acceptés, jamais une adresse Render ou distante.
set -euo pipefail
url="${DATABASE_URL:-}"
if [ -z "$url" ]; then echo "REFUS : DATABASE_URL absente." >&2; exit 1; fi
hote=$(printf '%s' "$url" | sed -E 's#^[a-z]+://([^@/]*@)?\[?([^]:/?]+)\]?.*#\2#')
case "$hote" in
  localhost|127.0.0.1) ;;
  *) echo "REFUS : DATABASE_URL pointe vers « $hote », pas vers une base locale." >&2; exit 1 ;;
esac
case "$url" in *render.com*|*amazonaws*|*supabase*|*neon.tech*) echo "REFUS : adresse de base hébergée." >&2; exit 1 ;; esac
