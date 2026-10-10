#!/bin/bash
set -e
cd "$(dirname "$0")"
case "$(uname -m)" in
 arm64) s2a_arch=arm64;;
 x86_64) s2a_arch=x64;;
 *) echo "Mac Intel ou Apple Silicon nécessaire."; read -r; exit 1;;
esac
s2a_runtime=$(mktemp -d "${TMPDIR:-/tmp/}s2a-pilot-copilot.XXXXXX")
trap 'rm -rf "$s2a_runtime"' EXIT
printf '\nPréparation du service local Pilot et Copilot…\n'
/usr/bin/unzip -p "companion/S2A-Pilot-Bridge-1.3.1-app.zip" "S2A Pilot Bridge.app/Contents/Resources/Copilot/runtime/node-runtime-$s2a_arch.tar.gz" > "$s2a_runtime/runtime.tar.gz"
/usr/bin/tar -xzf "$s2a_runtime/runtime.tar.gz" -C "$s2a_runtime"
PILOT_ROOT="$PWD" COPILOT_LOCAL_ONLY=1 "$s2a_runtime/bin/node" copilot-service/launcher.cjs "$s2a_runtime"
