#!/usr/bin/env bash
# Builds Murmur.app and a zip of it, ready to share. Runs on a Mac (or on
# GitHub's Mac build machines via .github/workflows/build-murmur.yml).
#
#   ./scripts/build-app.sh            # outputs build/Murmur.app and build/Murmur.zip
#   VERSION=0.2.0 ./scripts/build-app.sh
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="Murmur"
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
cp "$BIN_DIR/$APP_NAME" "$APP/Contents/MacOS/$APP_NAME"
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD_NUMBER/" \
    Support/Info.plist > "$APP/Contents/Info.plist"
# Copy any resource bundles produced by Swift packages.
for bundle in "$BIN_DIR"/*.bundle; do
    [ -e "$bundle" ] && cp -R "$bundle" "$APP/Contents/Resources/"
done

echo "==> Signing (ad-hoc: no Apple Developer account yet)"
codesign --force --sign - --entitlements Support/Murmur.entitlements "$APP"
codesign --verify --verbose "$APP"

echo "==> Zipping"
ditto -c -k --keepParent "$APP" "$OUT/$APP_NAME.zip"

echo "==> Done: $OUT/$APP_NAME.zip"
