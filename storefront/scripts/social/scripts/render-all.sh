#!/usr/bin/env bash
# Re-render all static HTMLs in launch/ and mes-2/ that have a matching render path.
# Skips Reels (those use hyperframes).
set -euo pipefail
cd "$(dirname "$0")/.."

SCRIPT="scripts/render.sh"
count=0

# Launch post-01 single image
if [[ -f "launch/post-01-lanzamiento/source.html" ]]; then
  "$SCRIPT" launch/post-01-lanzamiento/source.html launch/post-01-lanzamiento/post.png 1080 1350
  count=$((count+1))
fi

# Launch post-02 catalog (8 slides)
for f in launch/post-02-catalogo/source/*.html; do
  name=$(basename "${f%.html}")
  "$SCRIPT" "$f" "launch/post-02-catalogo/slides/${name}.png" 1080 1350
  count=$((count+1))
done

# Launch highlights covers (4)
for f in launch/highlights/covers/source/*.html; do
  name=$(basename "${f%.html}")
  "$SCRIPT" "$f" "launch/highlights/covers/${name}.png" 1080 1920
  count=$((count+1))
done

# Launch highlights content (14 stories across 4 categories)
for cat in tienda productos comprar envios; do
  for f in launch/highlights/content/$cat/source/*.html; do
    name=$(basename "${f%.html}")
    "$SCRIPT" "$f" "launch/highlights/content/$cat/${name}.png" 1080 1920
    count=$((count+1))
  done
done

# Mes-2 single-image posts
for slug in 08-grinder-vs 12-dominguero; do
  src="mes-2/post-$slug/source.html"
  [[ -f "$src" ]] && { "$SCRIPT" "$src" "mes-2/post-$slug/post.png" 1080 1350; count=$((count+1)); }
done

# Mes-2 carousel posts
for slug in 06-sabores-alien 10-un-mes; do
  for f in mes-2/post-$slug/source/*.html; do
    name=$(basename "${f%.html}")
    "$SCRIPT" "$f" "mes-2/post-$slug/slides/${name}.png" 1080 1350
    count=$((count+1))
  done
done

echo ""
echo "✓ Rendered $count static files."
echo "Note: Reels (05, 07, 09, 11) use HyperFrames — see each post's source/hyperframes/."
