#!/usr/bin/env bash
# Start the Q-Sys web UI backend (serves both the API and the built React app)
# Usage: QSYS_HOST=10.4.18.1 ./start.sh
#
# Environment variables:
#   QSYS_HOST     — Q-Sys Core IP/hostname (default: 10.4.18.1)
#   QSYS_WS_PORT  — QRWC port (default: 443)
#   PORT          — HTTP port for the backend (default: 3001)

set -e
cd "$(dirname "$0")"

QSYS_HOST="${QSYS_HOST:-10.4.18.1}"
export QSYS_HOST

echo "Building frontend..."
(cd frontend && npm run build)

echo "Starting backend on http://localhost:${PORT:-3001} → Core $QSYS_HOST"
cd backend && node dist/server.js
