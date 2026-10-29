# Local Voice Worker (optional)

An **optional** local text-to-speech backend for the voice-worker seam.
Design + build log:
voice-worker.plan.md.

**Who needs this:** nobody by default. The voice is a pluggable worker —
if the operator's driving agent has native speech synthesis (a
voice-capable Codex/ChatGPT harness), it will serve spoken renders
directly once the V1 seam lands, and this page is irrelevant. Install the
local backend only when the driving agent cannot speak. Both worker
shapes coexist; renders record their `source` (the image-worker
precedent, docs/local-image-worker.md).

**The shape (Ollama-like):** a sibling directory on the host (default
`~/mojulo-voicegen`) with its own `node_modules` and its own model store
(`./models`). Mojulo never starts it, probes it, or depends on it — the
driving agent is the only bridge. Unlike ComfyUI there is no server: the
backend is one CLI, `speak.mjs`, invoked per utterance (Kokoro-82M is
fast enough that a daemon earns nothing yet).

## Install

```bash
control/scripts/install-local-voicegen.sh          # package + CLI only (~few MB of npm deps)
control/scripts/install-local-voicegen.sh --warm   # + fetch the ~92MB Kokoro q8 ONNX weights now
```

Without `--warm`, the weights fetch lazily on the first synthesis — the
fetch-embed-model precedent (explicit/lazy, gitignored, no postinstall).
The model is pinned in the CLI template
([control/scripts/voicegen-speak.mjs](../control/scripts/voicegen-speak.mjs)):
`onnx-community/Kokoro-82M-v1.0-ONNX`, dtype `q8`, running on
onnxruntime via `kokoro-js`.

## Use

```bash
cd ~/mojulo-voicegen
node speak.mjs --text "Hello from the workshop." --out hello.wav
node speak.mjs --file script.txt --voice am_adam --speed 1.1 --out line.wav
node speak.mjs --list-voices
```

Output is mono 24kHz WAV. Success prints one JSON line the driving agent
parses as the handback:

```json
{"ok":true,"path":"…/hello.wav","bytes":123456,"seconds":2.56,"sample_rate":24000,"rms":0.06021,"voice":"af_heart","speed":1,"model":"onnx-community/Kokoro-82M-v1.0-ONNX"}
```

`rms` is the non-silence figure the V1 submit gate will check
deterministically; it is computed at the source so the worker audit can
carry it.

## Timed: a face that speaks the line

`./install-local-voicegen.sh --timed` installs the Python rung for English with the phonemes' timings (it needs only
GitHub and PyPI; the JS rung's weights are on HuggingFace). `speak.py --timings` then writes, beside the WAV,
`<out>.timings.json`: `{ ok, audio, seconds, sample_rate, voice, model, phonemes: [{ p, t, dur }] }`, each symbol as
Kokoro spoke it (its IPA, its stress marks, spaces and punctuation), seconds from the WAV's start:

```bash
cd ~/mojulo-voicegen
venv/bin/python speak.py --text "Hello, my name is Maya." --voice af_heart --out maya.wav --timings
```

Kokoro predicts every phoneme's length before it renders, but the release's model keeps that inside; the first timed
run derives `models/kokoro-v1.0.timed.onnx`, a copy that exposes it as a `duration` output, and `kokoro-onnx` (0.6.1 or
later) turns it into each phoneme's span. Hand the sidecar's `phonemes` and its `audio` to a realistic hero's beat,
`perform: { <take>: { beats: [{ at, face, say: { phonemes, audio } }] } }`: the face speaks on the recording's own
timeline (`control/lib/graph/face-acting/speech.js` reads the engine's symbols as written), the export names the
recording in the take's extras (`face.performances[].audio`: `{ at, file }`, not embedded), and `/hero-live` plays it
with the take.

## What rides on this

Today (V0): the CLI itself — text in, WAV out, driven ad hoc by the
agent. The durable handoff (`request_voice_render` → `pull` → `submit` →
`accept`, mirroring the image render bicycle) is V1 in the plan; the
capability ladder that lets a natively voice-capable agent serve the same
queue is V2.
