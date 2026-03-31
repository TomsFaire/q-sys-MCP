#!/usr/bin/env bash
# Dev mode — runs backend (ts-node-dev) and frontend (Vite) concurrently.
# Frontend proxies /ws → backend :3001 automatically.
#
# Usage: ./dev.sh
#        QSYS_HOST=10.0.0.50 ./dev.sh   # optional — omit to choose Core from the UI

set -e
cd "$(dirname "$0")"

export QSYS_HOST="${QSYS_HOST:-}"
export PORT=3001

# Install deps if needed
[ -d backend/node_modules ] || (cd backend && npm install)
[ -d frontend/node_modules ] || (cd frontend && npm install)

# Kill anything holding the ports we need (hard kill + wait for release)
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "Freeing port $port (pids: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    # Wait up to 2s for the port to be released
    local i=0
    while lsof -ti :"$port" &>/dev/null && [ $i -lt 20 ]; do
      sleep 0.1; i=$((i+1))
    done
  fi
}

free_port 3001
free_port 5173

trap 'kill %1 %2 2>/dev/null' EXIT

if [ -n "$QSYS_HOST" ]; then
  echo "Starting backend on :3001 → Core $QSYS_HOST"
else
  echo "Starting backend on :3001 (no QSYS_HOST — connect from the browser)"
fi
(cd backend && npx ts-node-dev --respawn --transpile-only src/server.ts) &

# Give the backend a moment to bind before Vite starts
sleep 1

echo "Starting frontend (Vite) on :5173"
(cd frontend && npx vite) &

wait
