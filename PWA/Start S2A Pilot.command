#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required for the local server."
  read -r answer
  exit 1
fi
python3 -m http.server 8092 --bind 127.0.0.1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT INT TERM
sleep 1
if ! kill -0 "$server_pid" 2>/dev/null; then
  echo "Could not start. Check whether port 8092 is already in use."
  exit 1
fi
open "http://localhost:8092/actualiser.html?version=1.5.1"
printf 'S2A Pilot : http://localhost:8092/index.html\nStop with Ctrl+C.\n'
wait "$server_pid"
