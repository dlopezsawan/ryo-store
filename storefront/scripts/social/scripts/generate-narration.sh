#!/usr/bin/env bash
# Generate narration MP3 from a Reel's narration.txt using ElevenLabs API.
#
# Usage:
#   ./scripts/generate-narration.sh mes-2/post-05-carbon-activo
#
# Reads:
#   <post-dir>/narration.txt       (the script to narrate)
#   social/.env.local              (API key + voice config)
#
# Writes:
#   <post-dir>/narration.mp3
#   <post-dir>/narration.meta.json (duration, config used)

set -euo pipefail

cd "$(dirname "$0")/.."  # social/ root

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <post-dir>"
  echo "Example: $0 mes-2/post-05-carbon-activo"
  exit 1
fi

POST_DIR="$1"
TXT_FILE="$POST_DIR/narration.txt"
MP3_FILE="$POST_DIR/narration.mp3"
META_FILE="$POST_DIR/narration.meta.json"

if [[ ! -f "$TXT_FILE" ]]; then
  echo "❌ narration.txt not found at $TXT_FILE"
  echo "   Create it first with the script for this Reel."
  exit 1
fi

# Load env
if [[ ! -f .env.local ]]; then
  echo "❌ .env.local not found. Expected at social/.env.local"
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.local; set +a

: "${ELEVENLABS_API_KEY:?missing ELEVENLABS_API_KEY in .env.local}"
: "${ELEVENLABS_VOICE_ID:?missing ELEVENLABS_VOICE_ID}"
: "${ELEVENLABS_MODEL:=eleven_multilingual_v2}"
: "${ELEVENLABS_SPEED:=0.98}"
: "${ELEVENLABS_STABILITY:=0.50}"
: "${ELEVENLABS_SIMILARITY:=0.75}"
: "${ELEVENLABS_STYLE:=0.00}"

# Strip script comments (lines starting with [Escena ...]) and blank lines
TEXT=$(grep -vE '^\s*\[' "$TXT_FILE" | sed '/^\s*$/d' | tr '\n' ' ' | sed 's/  */ /g' | sed 's/^ //; s/ $//')

CHAR_COUNT=${#TEXT}
echo "→ Post: $POST_DIR"
echo "→ Voice: $ELEVENLABS_VOICE_NAME ($ELEVENLABS_VOICE_ID)"
echo "→ Model: $ELEVENLABS_MODEL"
echo "→ Config: speed=$ELEVENLABS_SPEED stability=$ELEVENLABS_STABILITY similarity=$ELEVENLABS_SIMILARITY style=$ELEVENLABS_STYLE"
echo "→ Script: $CHAR_COUNT chars"
echo ""

# Call ElevenLabs API
BODY=$(python3 -c "
import json, sys
print(json.dumps({
    'text': sys.argv[1],
    'model_id': sys.argv[2],
    'voice_settings': {
        'stability': float(sys.argv[3]),
        'similarity_boost': float(sys.argv[4]),
        'style': float(sys.argv[5]),
        'use_speaker_boost': True,
        'speed': float(sys.argv[6]),
    },
}))
" "$TEXT" "$ELEVENLABS_MODEL" "$ELEVENLABS_STABILITY" "$ELEVENLABS_SIMILARITY" "$ELEVENLABS_STYLE" "$ELEVENLABS_SPEED")

HTTP_CODE=$(curl -s -o "$MP3_FILE" -w "%{http_code}" -X POST \
  "https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary "$BODY")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "❌ ElevenLabs API error ($HTTP_CODE):"
  cat "$MP3_FILE"
  rm -f "$MP3_FILE"
  exit 1
fi

# Get duration + size
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP3_FILE" | awk '{printf "%.2f", $1}')
SIZE=$(du -h "$MP3_FILE" | cut -f1)

# Write metadata
python3 -c "
import json, datetime
meta = {
    'generated_at': datetime.datetime.now().isoformat(),
    'voice_id': '$ELEVENLABS_VOICE_ID',
    'voice_name': '$ELEVENLABS_VOICE_NAME',
    'model': '$ELEVENLABS_MODEL',
    'settings': {
        'speed': float('$ELEVENLABS_SPEED'),
        'stability': float('$ELEVENLABS_STABILITY'),
        'similarity_boost': float('$ELEVENLABS_SIMILARITY'),
        'style': float('$ELEVENLABS_STYLE'),
    },
    'char_count': $CHAR_COUNT,
    'duration_seconds': float('$DURATION'),
}
import pathlib
pathlib.Path('$META_FILE').write_text(json.dumps(meta, indent=2, ensure_ascii=False))
"

echo ""
echo "✅ Generated narration:"
echo "   File:      $MP3_FILE"
echo "   Size:      $SIZE"
echo "   Duration:  ${DURATION}s"
echo "   Metadata:  $META_FILE"
echo ""
echo "→ Next: ajusta data-duration en source/hyperframes/index.html a ≥ ${DURATION}s + buffer"
