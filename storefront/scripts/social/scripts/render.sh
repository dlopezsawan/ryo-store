#!/usr/bin/env bash
# Pipeline A — render an HTML template to PNG using headless Chrome (full-page mode)
# Renders the actual body box, not the viewport — so output exactly matches body width/height.
# Usage: ./render.sh templates/post-01-announcement.html out/post-01-announcement.png [width] [height]

set -euo pipefail

TEMPLATE="${1:-templates/post-01-announcement.html}"
OUTPUT="${2:-out/$(basename "${TEMPLATE%.html}").png}"
WIDTH="${3:-1080}"
HEIGHT="${4:-1350}"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [[ ! -x "$CHROME" ]]; then
  echo "Chrome not found at $CHROME" >&2
  exit 1
fi

# cd to social/ root (scripts/ is one level below)
cd "$(dirname "$0")/.."
mkdir -p "$(dirname "$OUTPUT")"

ABS_TEMPLATE="file://$(cd "$(dirname "$TEMPLATE")" && pwd)/$(basename "$TEMPLATE")"
OUT_ABS="$(pwd)/$OUTPUT"

# Render with a window taller than needed (no clipping at bottom),
# then crop to exact dimensions with sips (built into macOS).
BUFFER_HEIGHT=$((HEIGHT + 100))

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --no-sandbox \
  --allow-file-access-from-files \
  --force-device-scale-factor=2 \
  --window-size="${WIDTH},${BUFFER_HEIGHT}" \
  --screenshot="$OUT_ABS" \
  --default-background-color=00000000 \
  "$ABS_TEMPLATE" 2>/dev/null

# Crop to exact target dimensions @2x (PNG is at 2x scale)
TARGET_W=$((WIDTH * 2))
TARGET_H=$((HEIGHT * 2))
sips --cropToHeightWidth "$TARGET_H" "$TARGET_W" "$OUT_ABS" --padColor FFFFFF >/dev/null 2>&1

# Force crop from top-left (sips centers by default — we want top-aligned)
sips -c "$TARGET_H" "$TARGET_W" "$OUT_ABS" >/dev/null 2>&1

# Downscale @2x → @1x. We render at 2x for sharpness during composition,
# but ship at 1x because Buffer + Meta IG reject images wider than 1440px
# with "issue with the media" — even though they auto-resize on display,
# the upload validator checks raw dimensions.
sips -z "$HEIGHT" "$WIDTH" "$OUT_ABS" >/dev/null 2>&1

# Convert to JPEG if the output filename ends in .jpg/.jpeg.
# Meta's IG Graph API requires JPEG for Stories (PNG is rejected with
# "issue with the media") and JPEGs are 5-10x smaller than PNGs at the
# same visual quality. Posts/feed accept both, but JPEG is just safer.
case "${OUT_ABS##*.}" in
  jpg|jpeg|JPG|JPEG)
    sips -s format jpeg -s formatOptions 90 "$OUT_ABS" --out "$OUT_ABS" >/dev/null 2>&1
    ;;
esac

echo "✓ Rendered: $OUTPUT (${WIDTH}x${HEIGHT} px, downscaled from ${TARGET_W}x${TARGET_H})"
