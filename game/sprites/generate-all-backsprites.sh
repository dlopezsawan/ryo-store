#!/bin/bash
# Generate all 150 back sprites using front sprites as image reference
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONT="$SCRIPT_DIR/creatures"
BACK="$FRONT/back"
GEN="python3 $SCRIPT_DIR/gen-backsprite.py"
PROMPTS="/tmp/all-prompts.txt"
LOG="$BACK/generation.log"

mkdir -p "$BACK"

echo "=== BACK SPRITES GENERATION ===" | tee -a "$LOG"
echo "=== $(date) ===" | tee -a "$LOG"

generate_one() {
  local ID="$1"
  local DESC="$2"
  local FRONT_FILE="$FRONT/${ID}.png"
  local BACK_FILE="$BACK/${ID}.png"

  if [ -f "$BACK_FILE" ]; then
    echo "  SKIP $ID" | tee -a "$LOG"
    return
  fi

  if [ ! -f "$FRONT_FILE" ]; then
    echo "  MISS $ID (no front)" | tee -a "$LOG"
    return
  fi

  echo "GEN  $ID ..." | tee -a "$LOG"
  if python3 "$SCRIPT_DIR/gen-backsprite.py" "$FRONT_FILE" "$BACK_FILE" "$DESC" >> "$LOG" 2>&1; then
    if [ -f "$BACK_FILE" ]; then
      echo "  OK $ID" | tee -a "$LOG"
    else
      echo "  FAIL $ID (no output)" | tee -a "$LOG"
    fi
  else
    echo "  FAIL $ID (api error)" | tee -a "$LOG"
  fi
}

# Process in batches of 3 parallel
BATCH_IDS=()
BATCH_DESCS=()

while IFS='|' read -r ID DESC; do
  BATCH_IDS+=("$ID")
  BATCH_DESCS+=("$DESC")

  if [ ${#BATCH_IDS[@]} -eq 3 ]; then
    for i in 0 1 2; do
      generate_one "${BATCH_IDS[$i]}" "${BATCH_DESCS[$i]}" &
    done
    wait
    BATCH_IDS=()
    BATCH_DESCS=()
  fi
done < "$PROMPTS"

# Remaining
for i in $(seq 0 $((${#BATCH_IDS[@]} - 1))); do
  generate_one "${BATCH_IDS[$i]}" "${BATCH_DESCS[$i]}" &
done
wait

TOTAL=$(ls "$BACK"/*.png 2>/dev/null | wc -l)
echo "=== DONE $(date) ===" | tee -a "$LOG"
echo "Total back sprites: $TOTAL / 150" | tee -a "$LOG"
