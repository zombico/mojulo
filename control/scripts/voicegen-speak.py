#!/usr/bin/env python3
"""speak.py — the multilingual rung of the local voice backend
(voice-worker.plan.md V0). Installed by install-local-voicegen.sh --ja into
the sibling voicegen dir and run via its venv:

    venv/bin/python speak.py --text "こんにちは" --voice jf_alpha --out ja.wav
    venv/bin/python speak.py --list-voices

Same Kokoro-82M model as speak.mjs, still ONNX (kokoro-onnx runtime), but
with real language G2P: Japanese text goes through misaki's Japanese
tokenizer (what Kokoro was trained on), not the English-only phonemizer
that limits the JS rung. Non-j voices fall back to espeak-based G2P so one
CLI covers the whole voice bin.

Prints the same one-line JSON handback contract as speak.mjs:
  { ok, path, bytes, seconds, sample_rate, rms, voice, speed, model }
"""

import argparse
import json
import math
import sys
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_PATH = HERE / "models" / "kokoro-v1.0.onnx"
VOICES_PATH = HERE / "models" / "voices-v1.0.bin"
MODEL_TAG = "kokoro-v1.0.onnx"

# voice-id prefix -> espeak lang for the non-misaki path
ESPEAK_LANG = {
    "a": "en-us", "b": "en-gb", "e": "es", "f": "fr-fr",
    "h": "hi", "i": "it", "p": "pt-br", "z": "cmn",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text")
    ap.add_argument("--file")
    ap.add_argument(
        "--voice", default="jf_alpha",
        help="a stock voice id, or a blend 'id:w,id:w' (weights normalized; "
        "the voice-register primitive's voiceArg — control/lib/graph/voice/voice-register.js)",
    )
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--out")
    ap.add_argument("--list-voices", action="store_true")
    args = ap.parse_args()

    for p in (MODEL_PATH, VOICES_PATH):
        if not p.exists():
            sys.exit(f"missing {p} — re-run install-local-voicegen.sh --ja")

    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(MODEL_PATH), str(VOICES_PATH))

    if args.list_voices:
        print(json.dumps({"ok": True, "model": MODEL_TAG, "voices": sorted(kokoro.get_voices())}, indent=2))
        return

    text = args.text
    if text is None and args.file:
        text = Path(args.file).read_text(encoding="utf-8").strip()
    if not text or not args.out:
        sys.exit('speak.py requires --text "..." (or --file <path>) and --out <path.wav>, or --list-voices')
    if not args.speed > 0:
        sys.exit(f"invalid --speed: {args.speed}")

    # A blend 'id:w,id:w' resolves to a weighted sum of the stock embeddings —
    # the voices live in one learned space, so a convex mix is a valid new
    # voice (the voice-register primitive's whole mechanism). G2P routes by
    # the dominant voice's language prefix; embedding blends never cross
    # phonemizers.
    if ":" in args.voice:
        parts = []
        for chunk in args.voice.split(","):
            name, _, w = chunk.partition(":")
            parts.append((name.strip(), float(w)))
        total = sum(w for _, w in parts)
        if not total > 0:
            sys.exit(f"blend weights must sum > 0: {args.voice}")
        voice = sum((w / total) * kokoro.get_voice_style(n) for n, w in parts)
        routing_id = max(parts, key=lambda p: p[1])[0]
    else:
        voice = args.voice
        routing_id = args.voice

    if routing_id.startswith("j"):
        # Japanese: misaki's JA G2P emits the phoneme alphabet Kokoro was
        # trained on — espeak's ja tables do not.
        from misaki import ja

        # misaki 0.7 returns the phoneme string directly; older/other G2Ps
        # return (phonemes, tokens) — accept either.
        result = ja.JAG2P()(text)
        phonemes = result if isinstance(result, str) else result[0]
        samples, sample_rate = kokoro.create(
            phonemes, voice=voice, speed=args.speed, is_phonemes=True
        )
    else:
        lang = ESPEAK_LANG.get(routing_id[0], "en-us")
        samples, sample_rate = kokoro.create(text, voice=voice, speed=args.speed, lang=lang)

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        clipped = [max(-1.0, min(1.0, float(s))) for s in samples]
        w.writeframes(b"".join(int(s * 32767).to_bytes(2, "little", signed=True) for s in clipped))

    rms = math.sqrt(sum(s * s for s in clipped) / len(clipped)) if len(clipped) else 0.0
    print(json.dumps({
        "ok": True,
        "path": str(out_path),
        "bytes": out_path.stat().st_size,
        "seconds": round(len(clipped) / sample_rate, 3),
        "sample_rate": sample_rate,
        "rms": round(rms, 5),
        "voice": args.voice,
        "speed": args.speed,
        "model": MODEL_TAG,
    }))


if __name__ == "__main__":
    main()
