#!/bin/bash
# Retry failed sprites with safer prompts

set -euo pipefail

OUTDIR="/Users/daniellopez/Desktop/ryo store/game/sprites/creatures"
GEN="/Users/daniellopez/.claude/skills/openai-image-gen/scripts/gen.py"
STYLE="Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, front-facing, 1px black outline, upper-left light, 2-tone shading, NO anti-aliasing, NO dithering, chibi proportions, expressive eyes, transparent background, no text"
LOG="$OUTDIR/generation.log"

generate() {
  local NAME="$1"
  local PROMPT="$2"
  local FILE="$OUTDIR/${NAME}.png"
  if [ -f "$FILE" ]; then
    echo "SKIP $NAME" | tee -a "$LOG"
    return 0
  fi
  local TMPDIR="$OUTDIR/tmp-${NAME}"
  echo "RETRY $NAME ..." | tee -a "$LOG"
  if python3 "$GEN" --prompt "${PROMPT}. ${STYLE}" --count 1 --model gpt-image-1 --background transparent --output-format png --quality medium --out-dir "$TMPDIR" 2>>"$LOG"; then
    local SRC
    SRC=$(find "$TMPDIR" -name "*.png" -not -name "index*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      cp "$SRC" "$FILE"
      rm -rf "$TMPDIR"
      echo "  OK $NAME" | tee -a "$LOG"
    else
      rm -rf "$TMPDIR"
      echo "  FAIL $NAME (no png)" | tee -a "$LOG"
    fi
  else
    rm -rf "$TMPDIR"
    echo "  FAIL $NAME (api error)" | tee -a "$LOG"
  fi
  sleep 3
}

echo "=== RETRY BATCH $(date) ===" | tee -a "$LOG"

# 014-bonglass: was "crystal vessel" — avoid vessel context
generate "014-bonglass" "Elaborate iridescent glass tower creature with beautiful inner chambers, medium chibi, ice blue"

# 021-moledron: was "crushing robot" — soften
generate "021-moledron" "Giant metal gear robot creature with small flowers growing between cogs, noble powerful, steel gray"

# 027-dabmaster: rename concept entirely, avoid "dab"
generate "027-dabmaster" "Regal golden resin master creature surrounded by warm golden vapor, noble stance, amber gold"

# 037-percolin: was "crystal tower with bubbling" — simplify
generate "037-percolin" "Ornate glass column creature with water flowing inside chambers, medium chibi, blue tones"

# 039-cenicin: was "ash mound with ember" — simplify
generate "039-cenicin" "Small warm gray mound creature with a glowing orange core inside, baby chibi, orange gray"

# 042-pipalux: was "metal tube" — avoid pipe context
generate "042-pipalux" "Elegant engraved metal cylinder creature with crystal decorations, medium chibi, steel blue"

# 047-plantula: was "five-pointed leaves" — remove cannabis shape ref
generate "047-plantula" "Young green sprout creature with broad tropical leaves growing upward, medium chibi, green"

echo "=== RETRY DONE $(date) ===" | tee -a "$LOG"
