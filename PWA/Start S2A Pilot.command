#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required for the local server."
  read -r answer
  exit 1
fi
printf 'Local IPv4 for Copilot (Enter for this Mac only): '
read -r lan_ip
if [ -n "$lan_ip" ]; then
  python3 pilot-local.py --lan "$lan_ip" &
else
  python3 pilot-local.py &
fi
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT INT TERM
sleep 1
if ! kill -0 "$server_pid" 2>/dev/null; then
  echo "Could not start. Check whether port 8092 is already in use."
  exit 1
fi
open "http://localhost:8092/actualiser.html?version=1.11.0"
printf 'S2A Pilot : http://localhost:8092/index.html\nStop with Ctrl+C.\n'
wait "$server_pid"
