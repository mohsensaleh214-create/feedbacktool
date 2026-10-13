#!/usr/bin/env bash
# Builds "Misk Scribe.app" and a zip of it, ready to share. Runs on a Mac (or on
# GitHub's Mac build machines via .github/workflows/build-misk-scribe.yml).
#
#   ./scripts/build-app.sh            # outputs build/Misk Scribe.app and build/Misk-Scribe.zip
#   VERSION=0.2.0 ./scripts/build-app.sh
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="Misk Scribe"
EXECUTABLE="MiskScribe"
ZIP_NAME="Misk-Scribe.zip"
VERSION="${VERSION:-0.1.0}"
BUILD_NUMBER="${BUILD_NUMBER:-1}"
OUT="build"
APP="$OUT/$APP_NAME.app"

echo "==> Compiling $APP_NAME $VERSION ($BUILD_NUMBER)"
swift build -c release --arch arm64
BIN_DIR="$(swift build -c release --arch arm64 --show-bin-path)"

echo "==> Assembling $APP"
rm -rf "$OUT"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/$EXECUTABLE" "$APP/Contents/MacOS/$EXECUTABLE"
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD_NUMBER/" \
    Support/Info.plist > "$APP/Contents/Info.plist"
# Copy any resource bundles produced by Swift packages.
for bundle in "$BIN_DIR"/*.bundle; do
    [ -e "$bundle" ] && cp -R "$bundle" "$APP/Contents/Resources/"
done

echo "==> Making the app icon"
ICONSET="$OUT/AppIcon.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
    sips -z "$size" "$size" Support/Branding/AppIcon-1024.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    double=$((size * 2))
    sips -z "$double" "$double" Support/Branding/AppIcon-1024.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
rm -rf "$ICONSET"

echo "==> Signing (ad-hoc: no Apple Developer account yet)"
codesign --force --sign - --entitlements Support/MiskScribe.entitlements "$APP"
codesign --verify --verbose "$APP"

echo "==> Zipping"
ditto -c -k --keepParent "$APP" "$OUT/$ZIP_NAME"

echo "==> Done: $OUT/$ZIP_NAME"
