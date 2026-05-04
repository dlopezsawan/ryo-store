#!/bin/bash
# Generate back sprites for all 150 creatures
# Each back sprite must match its front sprite exactly — same creature, colors, proportions

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTDIR="$SCRIPT_DIR/creatures/back"
PROMPTS="/tmp/all-prompts.txt"
GEN="python3 /Users/daniellopez/.claude/skills/openai-image-gen/scripts/gen.py"
S="Pokemon Crystal GBC sprite, 56x56 pixel art, 4 colors only, BACK VIEW from behind, 1px black outline, upper-left light, 2-tone shading, NO anti-aliasing, NO dithering, chibi proportions, transparent background, no text, no face visible"
LOG="$OUTDIR/generation.log"

mkdir -p "$OUTDIR"

generate_back() {
  local ID="$1"
  local FRONT_DESC="$2"

  # Skip if already exists
  if [ -f "$OUTDIR/${ID}.png" ]; then
    echo "  SKIP $ID (exists)" | tee -a "$LOG"
    return
  fi

  echo "GEN  $ID ..." | tee -a "$LOG"

  local TMPDIR="$OUTDIR/tmp-${ID}"
  local BACK_PROMPT="BACK VIEW from behind of this exact creature: ${FRONT_DESC}. Show the back/rear of this same creature with identical colors and body shape, just facing away from the viewer. ${S}"

  if $GEN --prompt "$BACK_PROMPT" \
    --count 1 --model gpt-image-1 --background transparent --output-format png --quality medium \
    --out-dir "$TMPDIR" >> "$LOG" 2>&1; then
    local SRC
    SRC=$(find "$TMPDIR" -name "*.png" -not -name "index*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      cp "$SRC" "$OUTDIR/${ID}.png"
      echo "  OK $ID" | tee -a "$LOG"
    else
      echo "  FAIL $ID (no png)" | tee -a "$LOG"
    fi
  else
    echo "  FAIL $ID (api error)" | tee -a "$LOG"
  fi
  rm -rf "$TMPDIR"
}

echo "=== BACK SPRITES GENERATION ===" | tee -a "$LOG"
echo "=== $(date) ===" | tee -a "$LOG"

# Process in batches of 3 (parallel)
BATCH=()
while IFS='|' read -r ID DESC; do
  BATCH+=("$ID|$DESC")

  if [ ${#BATCH[@]} -eq 3 ]; then
    for entry in "${BATCH[@]}"; do
      EID="${entry%%|*}"
      EDESC="${entry#*|}"
      generate_back "$EID" "$EDESC" &
    done
    wait
    BATCH=()
  fi
done < "$PROMPTS"

# Process remaining
for entry in "${BATCH[@]}"; do
  EID="${entry%%|*}"
  EDESC="${entry#*|}"
  generate_back "$EID" "$EDESC" &
done
wait

echo "=== DONE $(date) ===" | tee -a "$LOG"
echo "Generated: $(ls "$OUTDIR"/*.png 2>/dev/null | wc -l) back sprites"
