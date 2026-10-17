#!/usr/bin/env bash
# Starts the session: the Python harness (port 8787) and the web app (port 5173). Ctrl+C stops both.
cd "$(dirname "$0")"

LUNA_EFFORT=medium uv run python server.py &
SERVER=$!
# Without this, Ctrl+C stops the web app but leaves the server running in the background.
trap 'kill $SERVER' EXIT

echo "Open http://localhost:5173/fighter/session.html"
cd app && GAME=fighter npm run dev
