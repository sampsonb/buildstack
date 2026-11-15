#!/bin/sh
# Renders public/og.png (1200x630) from scripts/og.html with headless Chrome.
# Usage: sh scripts/build-og.sh [chrome-binary]
set -e
cd "$(dirname "$0")/.."
CHROME="${1:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=3000 --default-background-color=ffffffff \
  --screenshot="$PWD/public/og.png" "file://$PWD/scripts/og.html" >/dev/null 2>&1
echo "wrote public/og.png"
