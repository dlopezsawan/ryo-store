#!/usr/bin/env bash
# Export final HTML templates as STANDALONE files (CSS inlined, Google Fonts)
# for Canva import. Walks launch/ and mes-2/ trees automatically.
set -euo pipefail

cd "$(dirname "$0")/.."       # social/ root
SHARED_CSS="lib/shared.css"
OUT="canva"
mkdir -p "$OUT"

# Inline shared.css with @font-face replaced by Google Fonts CDN.
SHARED_INLINE=$(cat <<'CSS_EOF'
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&display=swap');

CSS_EOF
)
SHARED_INLINE+=$(awk 'NR>=9' "$SHARED_CSS")

# Collect HTML source files from launch/ and mes-2/
# Output names are derived from path: replace / with - and drop source/ segment.
count=0
while IFS= read -r -d '' src; do
  # Skip hyperframes/index.html — those bundle differently
  if [[ "$src" == *hyperframes/* ]]; then continue; fi

  # Derive output name
  # Examples:
  # launch/post-01-lanzamiento/source.html        → launch-post-01-lanzamiento.html
  # launch/post-02-catalogo/source/01-cover.html   → launch-post-02-catalogo-01-cover.html
  # mes-2/post-08-grinder-vs/source.html           → mes-2-post-08-grinder-vs.html
  # mes-2/post-06-sabores-alien/source/02-frutos.html → mes-2-post-06-sabores-alien-02-frutos.html
  rel="${src%.html}"
  rel="${rel//\/source\//-}"
  rel="${rel//\/source/}"
  rel="${rel//\//-}"
  dst="$OUT/${rel}.html"

  python3 - "$src" "$dst" <<PY
import re, pathlib, sys
src_path = pathlib.Path(sys.argv[1])
dst_path = pathlib.Path(sys.argv[2])
text = src_path.read_text()
shared = """$SHARED_INLINE"""

# Replace any relative reference to shared.css with inline <style>
text = re.sub(
    r'<link rel="stylesheet" href="(?:\.\./)*(?:lib/)?(?:templates/)?_?shared\.css">',
    f'<style>\n{shared}\n</style>',
    text,
    count=1,
)
dst_path.write_text(text)
PY
  count=$((count+1))
done < <(find launch mes-2 -name "*.html" -print0 2>/dev/null | sort -z)

echo ""
echo "✓ Exported $count HTMLs to $OUT/"
echo "Import in Canva: Uploads tab → drag the HTMLs in."
