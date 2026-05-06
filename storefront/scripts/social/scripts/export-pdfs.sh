#!/usr/bin/env bash
# Export final post HTMLs to PDF for Canva import.
# Canva treats PDF text/images as editable layers.
set -euo pipefail

cd "$(dirname "$0")"
TEMPLATES=templates
OUT=out/canva-pdf
mkdir -p "$OUT"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Final post templates only (no bg/element splits used for Reel animation).
POSTS=(
  "post-01-announcement"
  "post-02-01-cover"
  "post-02-02-papers-marron"
  "post-02-03-papers-alien"
  "post-02-04-papers-celulosa"
  "post-02-05-conos"
  "post-02-06-grinders"
  "post-02-07-filtros-carbon"
  "post-02-08-cta"
  "post-03-cover"
  "post-03-frame-02-code"
  "post-03-frame-03-steps"
  "post-03-frame-04-countdown"
)

for name in "${POSTS[@]}"; do
  src="$TEMPLATES/$name.html"
  dst="$OUT/$name.pdf"
  if [[ ! -f "$src" ]]; then
    echo "skip (missing): $src"
    continue
  fi
  abs_src="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
  abs_dst="$(pwd)/$dst"
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$abs_dst" --print-to-pdf-no-header \
    "file://$abs_src" 2>/dev/null
  echo "✓ $dst"
done

echo ""
echo "PDFs ready at: $OUT/"
echo "Import in Canva: Uploads > drag the PDFs in."
