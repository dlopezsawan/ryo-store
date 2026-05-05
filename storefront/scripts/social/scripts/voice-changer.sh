#!/usr/bin/env bash
# Speech-to-Speech: Take YOUR recorded voice → transform it to Daniela Valentina via ElevenLabs.
# Keeps YOUR timing/rhythm/emotion — only changes the voice to feminine.
#
# Usage:
#   ./scripts/voice-changer.sh mes-2/post-07-pedido-bts/recording.mp3
#
# Input: <post-dir>/recording.mp3 (your voice memo / QuickTime recording)
# Output: <post-dir>/narration.mp3 (transformed voice)
#         <post-dir>/narration.meta.json (provenance)

set -euo pipefail
cd "$(dirname "$0")/.."  # social/ root

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-input-recording.mp3|m4a|wav>"
  echo ""
  echo "Example:"
  echo "  $0 mes-2/post-07-pedido-bts/recording.m4a"
  exit 1
fi

INPUT="$1"
if [[ ! -f "$INPUT" ]]; then
  echo "❌ File not found: $INPUT"
  exit 1
fi

# Output goes alongside input
POST_DIR="$(dirname "$INPUT")"
MP3_FILE="$POST_DIR/narration.mp3"
META_FILE="$POST_DIR/narration.meta.json"

# Load env
if [[ ! -f .env.local ]]; then
  echo "❌ .env.local not found"
  exit 1
fi
set -a; source .env.local; set +a

: "${ELEVENLABS_API_KEY:?missing}"
: "${ELEVENLABS_VOICE_ID:?missing}"
: "${ELEVENLABS_MODEL:=eleven_multilingual_sts_v2}"  # Speech-to-Speech model (different from TTS)
: "${ELEVENLABS_STABILITY:=0.50}"
: "${ELEVENLABS_SIMILARITY:=0.75}"
: "${ELEVENLABS_STYLE:=0.00}"

INPUT_SIZE=$(du -h "$INPUT" | cut -f1)
INPUT_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT" | awk '{printf "%.1f", $1}')

echo "→ Input:     $INPUT ($INPUT_SIZE · ${INPUT_DUR}s)"
echo "→ Voice:     $ELEVENLABS_VOICE_NAME ($ELEVENLABS_VOICE_ID)"
echo "→ Model:     $ELEVENLABS_MODEL"
echo "→ Config:    stability=$ELEVENLABS_STABILITY similarity=$ELEVENLABS_SIMILARITY style=$ELEVENLABS_STYLE"
echo ""
echo "→ Uploading + transforming..."

# voice_settings as a JSON string for the form field
VOICE_SETTINGS=$(python3 -c "
import json
print(json.dumps({
  'stability': float('$ELEVENLABS_STABILITY'),
  'similarity_boost': float('$ELEVENLABS_SIMILARITY'),
  'style': float('$ELEVENLABS_STYLE'),
  'use_speaker_boost': True,
}))
")

HTTP_CODE=$(curl -s -o "$MP3_FILE" -w "%{http_code}" -X POST \
  "https://api.elevenlabs.io/v1/speech-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F "audio=@$INPUT" \
  -F "model_id=$ELEVENLABS_MODEL" \
  -F "voice_settings=$VOICE_SETTINGS")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo ""
  echo "❌ ElevenLabs STS error ($HTTP_CODE):"
  cat "$MP3_FILE"
  echo ""
  rm -f "$MP3_FILE"
  exit 1
fi

OUT_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP3_FILE" | awk '{printf "%.2f", $1}')
OUT_SIZE=$(du -h "$MP3_FILE" | cut -f1)

python3 -c "
import json, datetime
meta = {
  'generated_at': datetime.datetime.now().isoformat(),
  'mode': 'speech-to-speech',
  'source_recording': '$INPUT',
  'voice_id': '$ELEVENLABS_VOICE_ID',
  'voice_name': '$ELEVENLABS_VOICE_NAME',
  'model': '$ELEVENLABS_MODEL',
  'settings': {
    'stability': float('$ELEVENLABS_STABILITY'),
    'similarity_boost': float('$ELEVENLABS_SIMILARITY'),
    'style': float('$ELEVENLABS_STYLE'),
  },
  'input_duration': float('$INPUT_DUR'),
  'output_duration': float('$OUT_DUR'),
}
import pathlib
pathlib.Path('$META_FILE').write_text(json.dumps(meta, indent=2, ensure_ascii=False))
"

echo ""
echo "✅ Voz transformada:"
echo "   Output:   $MP3_FILE"
echo "   Size:     $OUT_SIZE"
echo "   Duration: ${OUT_DUR}s (in: ${INPUT_DUR}s)"
echo "   Meta:     $META_FILE"
echo ""
echo "→ Next: copia a hyperframes dir y actualiza el composition:"
echo "   cp $MP3_FILE $POST_DIR/source/hyperframes/narration.mp3"
