#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 est nécessaire pour le serveur local."
  read -r answer
  exit 1
fi
python3 -m http.server 8092 --bind 127.0.0.1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT INT TERM
sleep 1
if ! kill -0 "$server_pid" 2>/dev/null; then
  echo "Impossible de démarrer. Vérifier si le port 8092 est déjà utilisé."
  exit 1
fi
open "http://localhost:8092/actualiser.html?version=1.4.21"
printf 'S2A Pilot : http://localhost:8092/index.html\nArrêter avec Ctrl+C.\n'
wait "$server_pid"
