#!/bin/bash
# Regenerates every native splash screen from public/assets/icon.svg.
#
# Same trick as `make-icons.sh`, and for the same reason — see the note there
# about there being no SVG rasteriser on a stock macOS box.
#
# It exists because the splashes were once made from a 1254px painting scaled
# up to 2732px: no detail was gained, and the faint noise across its background
# defeated PNG's row filters so completely that thirteen splash screens weighed
# 16MB. The same mark drawn as vector on a clean vertical gradient is under
# 200KB for the lot, because each row of a gradient is nearly its predecessor
# and that is exactly what PNG is good at.
#
# Usage: npm run splash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVG="$ROOT/public/assets/icon.svg"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$SVG" ] || { echo "missing $SVG" >&2; exit 1; }
[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }

# How much of the shorter edge the mark takes up. A splash is a held breath,
# not a poster: big enough to read at a glance, small enough that the crop
# Android applies on an unusual aspect ratio can never bite into it.
MARK_FRACTION=0.40

# $1 width, $2 height, $3 output path
render() {
  local w=$1 h=$2 out=$3
  local page="$WORK/splash-$w-$h.html"
  local short=$(( w < h ? w : h ))
  local mark
  mark=$(awk -v s="$short" -v f="$MARK_FRACTION" 'BEGIN { printf "%d", s * f }')

  {
    echo "<!doctype html><meta charset=utf-8><style>"
    echo "html,body{margin:0;padding:0}"
    # The icon's own plate is switched off below, so this paints the same
    # gradient full-bleed instead of leaving it as a square in the middle.
    echo ".sheet{width:${w}px;height:${h}px;display:grid;place-items:center;"
    echo "  background:linear-gradient(180deg,#6b3f20,#3a2718)}"
    echo "svg{display:block;width:${mark}px;height:${mark}px}"
    echo "#plate{display:none}"
    echo "</style><div class=sheet>"
    cat "$SVG"
    echo "</div>"
  } > "$page"

  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size="$w,$h" \
    --screenshot="$out" "file://$page" 2>/dev/null

  echo "  $(basename "$(dirname "$out")")/$(basename "$out")  ${w}×${h}  $(du -h "$out" | cut -f1)"
}

echo "ios"
# Capacitor's imageset points its 1x, 2x and 3x slots at the same square, and
# 2732 is the long edge of the largest device Xcode still asks to cover.
IOS="$ROOT/ios/App/App/Assets.xcassets/Splash.imageset"
render 2732 2732 "$IOS/splash-2732x2732.png"
cp "$IOS/splash-2732x2732.png" "$IOS/splash-2732x2732-1.png"
cp "$IOS/splash-2732x2732.png" "$IOS/splash-2732x2732-2.png"
echo "  splash-2732x2732-1.png, -2.png  copies"

echo "android"
# mdpi→xxxhdpi, both ways up. `drawable/` is the density-less fallback an old
# WebView reaches for, and Capacitor generates it at the landscape mdpi size.
densities=(mdpi hdpi xhdpi xxhdpi xxxhdpi)
port_w=(320 480 720 960 1280)
port_h=(480 800 1280 1600 1920)

for i in "${!densities[@]}"; do
  d="${densities[$i]}"
  w="${port_w[$i]}"
  h="${port_h[$i]}"

  port="$ROOT/android/app/src/main/res/drawable-port-$d"
  land="$ROOT/android/app/src/main/res/drawable-land-$d"
  [ -d "$port" ] && render "$w" "$h" "$port/splash.png"
  [ -d "$land" ] && render "$h" "$w" "$land/splash.png"
done

FALLBACK="$ROOT/android/app/src/main/res/drawable/splash.png"
[ -d "$(dirname "$FALLBACK")" ] && render 480 320 "$FALLBACK"

echo "done"
