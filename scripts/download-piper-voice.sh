#!/usr/bin/env bash
# Download a local Piper English voice. No API key.
# Usage:
#   bash scripts/download-piper-voice.sh                 # ryan, low (~60MB)
#   bash scripts/download-piper-voice.sh ryan medium     # male, medium (~60MB)
#   bash scripts/download-piper-voice.sh ryan high       # male, high (~115MB, en iyi kalite)
#   bash scripts/download-piper-voice.sh lessac medium   # female, medium
#   bash scripts/download-piper-voice.sh lessac high     # female, high
#   bash scripts/download-piper-voice.sh danny           # male alternative (yalnızca low)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/models/tts"
NAME="${1:-ryan}"
QUALITY="${2:-low}"

mkdir -p "$DIR"
cd "$DIR"

case "$NAME:$QUALITY" in
  ryan:low|ryan:medium|ryan:high|lessac:low|lessac:medium|lessac:high|danny:low) ;;
  *)
    echo "Unknown voice/quality: $NAME $QUALITY"
    echo "Options: ryan (low|medium|high), lessac (low|medium|high), danny (low)"
    exit 1
    ;;
esac

VOICE="en_US-${NAME}-${QUALITY}"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/${NAME}/${QUALITY}"

echo "Downloading $VOICE into $DIR ..."
curl -L --fail -o "${VOICE}.onnx" "${BASE}/${VOICE}.onnx?download=true"
curl -L --fail -o "${VOICE}.onnx.json" "${BASE}/${VOICE}.onnx.json?download=true"
ls -lh "${VOICE}.onnx" "${VOICE}.onnx.json"
echo "Done. Set in .env.local:"
echo "  TTS_PROVIDER=piper"
echo "  TTS_PIPER_MODEL=models/tts/${VOICE}.onnx"
