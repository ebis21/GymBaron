#!/bin/bash
# Regenerates every raster app icon from public/assets/icon.svg.
#
# There is no SVG rasteriser on a stock macOS box and none of the usual ones
# (librsvg, ImageMagick, Inkscape) is a dependency worth adding for a file that
# changes once a year — so this drives headless Chrome, which every machine
# that can run the dev server already has.
#
# Usage: npm run icons
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVG="$ROOT/public/assets/icon.svg"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$SVG" ] || { echo "missing $SVG" >&2; exit 1; }
[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }

# $1 width, $2 height, $3 variant (plate|round|foreground), $4 source svg,
# $5 output path
render_at() {
  local w=$1 h=$2 variant=$3 src=$4 out=$5
  local page="$WORK/$variant-$w-$h-$(basename "$src").html"
  local extra=""

  case "$variant" in
    # Android's launcher masks this itself; a pre-rounded PNG under the mask
    # would show a dark ring, so `plate` stays square.
    round)      extra=".frame { border-radius: 50%; overflow: hidden; }" ;;
    # The adaptive foreground draws over the system's own background layer and
    # is cropped to roughly the middle two thirds, so the plate comes off and
    # the mark shrinks into the safe zone.
    foreground) extra="#plate { display: none; } svg { transform: scale(0.66); }" ;;
  esac

  {
    echo "<!doctype html><meta charset=utf-8><style>"
    echo "html,body{margin:0;padding:0;background:transparent}"
    echo ".frame{width:${w}px;height:${h}px}"
    echo "svg{display:block;width:100%;height:100%}"
    echo "$extra"
    echo "</style><div class=frame>"
    cat "$src"
    echo "</div>"
  } > "$page"

  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --default-background-color=00000000 \
    --window-size="$w,$h" --screenshot="$out" "file://$page" 2>/dev/null

  echo "  $(basename "$out")  ${w}×${h}  ${variant}"
}

# Square render from the app icon — the common case.
render() {
  render_at "$1" "$1" "$2" "$SVG" "$3"
}

echo "web + pwa"
render 192  plate "$ROOT/public/assets/icon-192.png"
render 512  plate "$ROOT/public/assets/icon-512.png"
render 512  plate "$ROOT/public/assets/logo.png"
render_at 1200 630 plate "$ROOT/public/assets/og.svg" "$ROOT/public/assets/og.png"

echo "ios"
render 1024 plate "$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

echo "android"
# mdpi→xxxhdpi. Launcher icons are 48dp, adaptive foregrounds 108dp.
densities=(mdpi hdpi xhdpi xxhdpi xxxhdpi)
launcher=(48 72 96 144 192)
foreground=(108 162 216 324 432)

for i in "${!densities[@]}"; do
  dir="$ROOT/android/app/src/main/res/mipmap-${densities[$i]}"
  [ -d "$dir" ] || continue
  render "${launcher[$i]}"   plate      "$dir/ic_launcher.png"
  render "${launcher[$i]}"   round      "$dir/ic_launcher_round.png"
  render "${foreground[$i]}" foreground "$dir/ic_launcher_foreground.png"
done

echo "done"
