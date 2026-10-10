#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"
APP="$BUILD/S2A Pilot Bridge.app"
MACOS="$APP/Contents/MacOS"
RESOURCES="$APP/Contents/Resources"

rm -rf "$BUILD"
mkdir -p "$MACOS" "$RESOURCES"

# Recover the pinned, licensed runtime from the separate Bridge download when building a fresh checkout.
mkdir -p "$ROOT/Resources/CopilotRuntime"
for S2A_NODE_ARCH in arm64 x64; do
  if [[ ! -f "$ROOT/Resources/CopilotRuntime/node-runtime-$S2A_NODE_ARCH.tar.gz" ]]; then
    /usr/bin/unzip -p "$ROOT/../downloads/S2A-Pilot-Bridge-1.3.1-macOS-Universel.zip" "S2A Pilot Bridge.app/Contents/Resources/Copilot/runtime/node-runtime-$S2A_NODE_ARCH.tar.gz" > "$ROOT/Resources/CopilotRuntime/node-runtime-$S2A_NODE_ARCH.tar.gz"
  fi
done
if [[ ! -f "$ROOT/Resources/CopilotRuntime/LICENSE-Node.txt" ]]; then
  /usr/bin/unzip -p "$ROOT/../downloads/S2A-Pilot-Bridge-1.3.1-macOS-Universel.zip" "S2A Pilot Bridge.app/Contents/Resources/Copilot/runtime/LICENSE-Node.txt" > "$ROOT/Resources/CopilotRuntime/LICENSE-Node.txt"
fi

for S2A_ARCH in arm64 x86_64; do
  xcrun swiftc -parse-as-library \
    "$ROOT/Sources/S2ACopilot.swift" \
    -o "$BUILD/S2ACopilot-$S2A_ARCH" \
    -framework SwiftUI -framework AppKit -framework Foundation \
    -module-cache-path "$BUILD/module-cache" \
    -target "$S2A_ARCH-apple-macos13.0"
done
/usr/bin/lipo -create "$BUILD/S2ACopilot-arm64" "$BUILD/S2ACopilot-x86_64" -output "$MACOS/S2A Pilot Bridge"

ICONSET="$BUILD/S2APilotBridgeIcon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

/usr/bin/sips -z 16 16 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_16x16.png" >/dev/null
/usr/bin/sips -z 32 32 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
/usr/bin/sips -z 32 32 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_32x32.png" >/dev/null
/usr/bin/sips -z 64 64 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
/usr/bin/sips -z 128 128 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_128x128.png" >/dev/null
/usr/bin/sips -z 256 256 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
/usr/bin/sips -z 256 256 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_256x256.png" >/dev/null
/usr/bin/sips -z 512 512 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
/usr/bin/sips -z 512 512 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_512x512.png" >/dev/null
/usr/bin/sips -z 1024 1024 "$ROOT/Resources/S2APilotBridgeIcon.png" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
/usr/bin/iconutil -c icns "$ICONSET" -o "$RESOURCES/S2APilotBridgeIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>S2A Pilot Bridge</string>
  <key>CFBundleDisplayName</key>
  <string>S2A Pilot Bridge</string>
  <key>CFBundleIdentifier</key>
  <string>fr.s2aproduction.copilote</string>
  <key>CFBundleVersion</key>
  <string>15</string>
  <key>CFBundleShortVersionString</key>
  <string>1.3.1</string>
  <key>CFBundleExecutable</key>
  <string>S2A Pilot Bridge</string>
  <key>CFBundleIconFile</key>
  <string>S2APilotBridgeIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSAppleEventsUsageDescription</key>
  <string>S2A Pilot Bridge doit contrôler QLab afin d’importer la conduite S2A Pilot dans le workspace sélectionné.</string>
</dict>
</plist>
PLIST

mkdir -p "$RESOURCES/fr.lproj" "$RESOURCES/en.lproj"
printf '%s\n' '"NSAppleEventsUsageDescription" = "S2A Pilot Bridge doit contrôler QLab afin d’importer la conduite dans le workspace sélectionné.";' > "$RESOURCES/fr.lproj/InfoPlist.strings"
printf '%s\n' '"NSAppleEventsUsageDescription" = "S2A Pilot Bridge needs to control QLab to import the show into the selected workspace.";' > "$RESOURCES/en.lproj/InfoPlist.strings"
cp "$ROOT/LICENSE" "$RESOURCES/LICENSE"
chmod +x "$MACOS/S2A Pilot Bridge"

COPILOT="$RESOURCES/Copilot"
mkdir -p "$COPILOT/PWA/compat" "$COPILOT/PWA/copilot" "$COPILOT/PWA/icons" "$COPILOT/runtime"
cp "$ROOT/../copilot-service/"*.cjs "$COPILOT/"
for file in copilot.html copilot-ui.css bridge.html bridge-copilot.js startup.js startup.css; do cp "$ROOT/../PWA/$file" "$COPILOT/PWA/"; done
cp "$ROOT/../PWA/compat/copilot.es5.js" "$COPILOT/PWA/compat/"
cp "$ROOT/../PWA/copilot/"* "$COPILOT/PWA/copilot/"
cp "$ROOT/../PWA/icons/s2a-copilot-192.png" "$COPILOT/PWA/icons/"
cp "$ROOT/Resources/CopilotRuntime/"node-runtime-*.tar.gz "$COPILOT/runtime/"
cp "$ROOT/Resources/CopilotRuntime/LICENSE-Node.txt" "$COPILOT/runtime/"


/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/codesign --verify --deep --strict "$APP"

echo ""
echo "Build terminé :"
echo "$APP"
echo ""
if [[ "${S2A_OPEN_AFTER_BUILD:-0}" == "1" ]]; then open "$APP"; fi
