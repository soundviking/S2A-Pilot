#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"
APP="$BUILD/ShowCue for QLab.app"
MACOS="$APP/Contents/MacOS"
RESOURCES="$APP/Contents/Resources"

rm -rf "$BUILD"
mkdir -p "$MACOS" "$RESOURCES"

xcrun swiftc -parse-as-library \
  "$ROOT/Sources/ShowCueForQLab.swift" \
  -o "$MACOS/ShowCue for QLab" \
  -framework SwiftUI \
  -framework AppKit \
  -framework Foundation \
  -target arm64-apple-macos13.0

ICONSET="$BUILD/ShowCueIcon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

/usr/bin/sips -z 16 16 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_16x16.png" >/dev/null
/usr/bin/sips -z 32 32 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
/usr/bin/sips -z 32 32 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_32x32.png" >/dev/null
/usr/bin/sips -z 64 64 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
/usr/bin/sips -z 128 128 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_128x128.png" >/dev/null
/usr/bin/sips -z 256 256 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
/usr/bin/sips -z 256 256 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_256x256.png" >/dev/null
/usr/bin/sips -z 512 512 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
/usr/bin/sips -z 512 512 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_512x512.png" >/dev/null
/usr/bin/sips -z 1024 1024 "$ROOT/Resources/ShowCueIcon.png" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
/usr/bin/iconutil -c icns "$ICONSET" -o "$RESOURCES/ShowCueIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>ShowCue for QLab</string>
  <key>CFBundleDisplayName</key>
  <string>ShowCue for QLab</string>
  <key>CFBundleIdentifier</key>
  <string>fr.showcue.qlab.importer</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>CFBundleShortVersionString</key>
  <string>1.1</string>
  <key>CFBundleExecutable</key>
  <string>ShowCue for QLab</string>
  <key>CFBundleIconFile</key>
  <string>ShowCueIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSAppleEventsUsageDescription</key>
  <string>ShowCue for QLab doit contrôler QLab afin d’importer la conduite dans le workspace sélectionné.</string>
</dict>
</plist>
PLIST

chmod +x "$MACOS/ShowCue for QLab"

/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/codesign --verify --deep --strict "$APP"

echo ""
echo "Build terminé :"
echo "$APP"
echo ""
open "$APP"
