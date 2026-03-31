#!/usr/bin/env bash
# Start the Q-Sys web UI backend (serves both the API and the built React app)
# Usage: ./start.sh
#        QSYS_HOST=10.0.0.50 ./start.sh   # optional — omit to connect from the UI
#
# Environment variables:
#   QSYS_HOST     — Q-Sys Core IP/hostname (optional)
#   QSYS_WS_PORT  — QRWC port (default: 443)
#   PORT          — HTTP port for the backend (default: 3001)

set -e
cd "$(dirname "$0")"

export QSYS_HOST="${QSYS_HOST:-}"

echo "Building frontend..."
(cd frontend && npm run build)

if [ -n "$QSYS_HOST" ]; then
  echo "Starting backend on http://localhost:${PORT:-3001} → Core $QSYS_HOST"
else
  echo "Starting backend on http://localhost:${PORT:-3001} (no QSYS_HOST — connect from the browser)"
fi
cd backend && node dist/server.js
