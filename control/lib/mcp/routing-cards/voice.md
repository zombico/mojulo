---
{
  "id": "voice",
  "name": "Mint a voice — how a voice sounds",
  "summary": "Voice registers: deterministic axis→blend recipes over stock TTS embeddings; an external worker speaks them.",
  "when": "\"make / design / tune a voice\", \"a deeper / more confident / meeker / softer voice\", \"a Japanese female narrator voice\", \"give the character a voice\", \"text to speech with a specific character\"",
  "entry": "create_voice",
  "form": "voice"
}
---
→ `create_voice` — mint a voice REGISTER (Mojulo Voice, the speech sibling of beats): two operator-framed axes — `confidence` (meek → authoritative) and `depth` (native timbre → darker via a bounded cross-gender anchor) — over a calibrated BANK of stock Kokoro embeddings, resolved to blend weights by a pure lerp. Same manifest → same waveform; no dice. Banks are language-agnostic (`jp-female` ships first; en/zh planned). Mojulo designs the voice and NEVER speaks — the returned `resolved.voiceArg` is the handoff an external speech worker renders: native TTS in your harness, or the optional local Kokoro backend (docs/local-voice-worker.md). Read a register back with `get_voice`; recipe shape + calibration workflow + the worker ladder → `get_voice_vocab`. Full family → `get_creative_toolset({ form: 'voice' })`. NOT this: music / soundtracks / sfx → `create_beats` (form `audio`).
