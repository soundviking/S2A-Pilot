#!/bin/bash
set -e
cd "$(dirname "$0")"
case "$(uname -m)" in
 arm64) s2a_arch=arm64;;
 x86_64) s2a_arch=x64;;
 *) echo "Mac Intel ou Apple Silicon nécessaire / required."; read -r; exit 1;;
esac
s2a_runtime=""
trap 'if [ -n "$s2a_runtime" ]; then rm -rf "$s2a_runtime"; fi' EXIT
s2a_node=$(command -v node || true)
if [ -n "$s2a_node" ] && ! "$s2a_node" -e 'process.exit(Number(process.versions.node.split(".")[0])>=18?0:1)' 2>/dev/null; then
 s2a_node=""
fi
if [ -z "$s2a_node" ]; then
 for s2a_app in "${S2A_BRIDGE_APP:-/Applications/S2A Pilot Bridge.app}" "$HOME/Applications/S2A Pilot Bridge.app"; do
  s2a_archive="$s2a_app/Contents/Resources/Copilot/runtime/node-runtime-$s2a_arch.tar.gz"
  if [ -f "$s2a_archive" ]; then
   s2a_runtime=$(mktemp -d "${TMPDIR:-/tmp/}s2a-pilot-copilot.XXXXXX")
   /usr/bin/tar -xzf "$s2a_archive" -C "$s2a_runtime"
   s2a_node="$s2a_runtime/bin/node"
   break
  fi
 done
fi
if [ -z "$s2a_node" ]; then
 printf '\nPour lancer Copilot, installez S2A Pilot Bridge depuis GitHub dans Applications.\nTo start Copilot, install S2A Pilot Bridge from GitHub in Applications.\nhttps://github.com/soundviking/S2A-Pilot\n\nPilot reste utilisable avec son lanceur habituel. / Pilot still works with its regular launcher.\n'
 /usr/bin/open 'https://github.com/soundviking/S2A-Pilot'
 read -r
 exit 1
fi
printf '\nPilot + Copilot : lancement local / local startup…\n'
PILOT_ROOT="$PWD" COPILOT_LOCAL_ONLY=1 "$s2a_node" copilot-service/launcher.cjs "${s2a_runtime:-${TMPDIR:-/tmp/}}"
