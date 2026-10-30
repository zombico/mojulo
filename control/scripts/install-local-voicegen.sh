#!/usr/bin/env bash
#
# Optional install: the local voice backend for the voice-worker seam
# (docs/local-voice-worker.md, control/lib/graph/voice/voice-worker.plan.md V0).
#
# NOT part of any mojulo install path — run it only if your driving agent has
# no native speech synthesis and you want spoken renders served locally.
# Operators on natively voice-capable harnesses never need this. Nothing
# lands in this repo; the package and the Kokoro ONNX weights live under
# INSTALL_DIR (weights fetch lazily on first synthesis, ~92MB q8).
#
# Usage:
#   ./install-local-voicegen.sh [--dir <path>] [--warm] [--ja] [--timed]
#
#   --dir   install root (default: ~/mojulo-voicegen)
#   --warm  synthesize a test phrase after install (fetches the weights now
#           rather than on first real use)
#   --ja    also install the multilingual Python rung (speak.py): a venv with
#           kokoro-onnx + misaki[ja] and the full v1.0 model+voices files
#           (~340MB) — unlocks the Japanese voices (jf_alpha, jf_gongitsune,
#           jf_nezumi, jf_tebukuro, jm_kumo) and the rest of the non-English
#           voice bin. The JS rung (speak.mjs) stays the English fast path.
#   --timed the Python rung (kokoro-onnx, the v1.0 model and voices) with the
#           phonemes' timings: `speak.py --timings` writes when each phoneme is
#           spoken beside the WAV, the timeline a realistic hero's face speaks
#           the line on (a beat's `say: { phonemes, audio }`). Adds the `onnx`
#           package, which derives once the model with its durations exposed.
#           Needs only GitHub and PyPI (the JS rung's weights are on
#           HuggingFace).
#
# Safe to re-run: npm/pip installs are idempotent, model downloads resume
# (curl -C -), and the speak CLIs are refreshed from the checked-in
# templates on every run.

set -euo pipefail

INSTALL_DIR="$HOME/mojulo-voicegen"
WARM=0
JA=0
TIMED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --warm) WARM=1; shift ;;
    --ja) JA=1; shift ;;
    --timed) TIMED=1; shift ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== local voicegen backend -> $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

if [[ ! -f "$INSTALL_DIR/package.json" ]]; then
  cat > "$INSTALL_DIR/package.json" <<'EOF'
{
  "name": "mojulo-voicegen",
  "private": true,
  "type": "module",
  "description": "Local Kokoro TTS backend for the mojulo voice-worker seam. Weights live in ./models, fetched lazily.",
  "dependencies": {
    "kokoro-js": "1.2.1"
  }
}
EOF
else
  echo "package.json already present; keeping it"
fi

cp "$SCRIPT_DIR/voicegen-speak.mjs" "$INSTALL_DIR/speak.mjs"

cd "$INSTALL_DIR"
npm install

if [[ "$JA" -eq 1 || "$TIMED" -eq 1 ]]; then
  echo "== the Python rung (venv + kokoro-onnx; --ja: misaki[ja]; --timed: onnx and the timings)"
  cp "$SCRIPT_DIR/voicegen-speak.py" "$INSTALL_DIR/speak.py"
  if [[ ! -d venv ]]; then
    python3 -m venv venv
  fi
  venv/bin/pip install --upgrade pip
  # (kokoro-onnx 0.6.1 reports each phoneme's span when the model has a duration output: create_timed)
  venv/bin/pip install "kokoro-onnx>=0.6.1"
  # unidic-lite is fugashi's dictionary — misaki's ja extra assumes one is present.
  if [[ "$JA" -eq 1 ]]; then venv/bin/pip install "misaki[ja]" unidic-lite; fi
  if [[ "$TIMED" -eq 1 ]]; then venv/bin/pip install onnx; fi

  # Pinned model-file release from the kokoro-onnx project (the fp32 v1.0
  # model + the full 54-voice bin — the JS rung's q8 HF layout does not
  # carry the non-English voices). Resumes on re-run.
  mkdir -p models
  KOKORO_ONNX_RELEASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
  curl -L -C - -o models/kokoro-v1.0.onnx "$KOKORO_ONNX_RELEASE/kokoro-v1.0.onnx"
  curl -L -C - -o models/voices-v1.0.bin "$KOKORO_ONNX_RELEASE/voices-v1.0.bin"

  if [[ "$TIMED" -eq 1 ]]; then
    # (the first timed run derives models/kokoro-v1.0.timed.onnx: the release's model, its durations exposed)
    echo "== timed run"
    venv/bin/python speak.py --text "The local voice backend is speaking, and timing every phoneme." --voice af_heart --out warmup-timed.wav --timings
  fi
  if [[ "$WARM" -eq 1 && "$JA" -eq 1 ]]; then
    echo "== ja warm run"
    venv/bin/python speak.py --text "ローカル音声バックエンドが話しています。" --voice jf_alpha --out warmup-ja.wav
    echo "== listen: afplay $INSTALL_DIR/warmup-ja.wav (macOS)"
  fi
fi

if [[ "$WARM" -eq 1 ]]; then
  echo "== warm run (fetches ~92MB of Kokoro ONNX weights into ./models on first use)"
  node speak.mjs --text "The local voice backend is installed and speaking." --out warmup.wav
  echo "== listen: afplay $INSTALL_DIR/warmup.wav (macOS)"
fi

echo "== done. Synthesize with:"
echo "   cd $INSTALL_DIR && node speak.mjs --text \"Hello\" --out hello.wav"
echo "   node speak.mjs --list-voices"
if [[ "$TIMED" -eq 1 ]]; then
  echo "   venv/bin/python speak.py --text \"Hello\" --voice af_heart --out hello.wav --timings   (hello.timings.json beside it)"
fi
