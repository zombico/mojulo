#!/usr/bin/env python3
"""warp.py: mouth foley's renderer. Kokoro says a sound word, a chain warps it into a sound effect.

Run by bake.mjs with the local voice worker's venv (install-local-voicegen.sh --ja: kokoro-onnx, misaki, numpy):

    <worker>/venv/bin/python warp.py --worker <worker dir> --recipes recipes.json --out <dir>

recipes.json is [{ id, text, voice, speed, chain, ring?: { text, voice, speed } }]; each becomes <dir>/<id>.wav,
44.1 kHz stereo, peak at 0.89. Kokoro renders the same text, voice and speed to the same samples, and every chain
below is plain arithmetic, so the same recipe makes the same WAV on one machine.

The chains (what a mouth needs to become a swish):
  air        the voiced frames gated out (the vowel gives a mouth away), then a 1.5 kHz high-pass: the breath alone
  swoosh     the air through a band gliding 5.2 to 1.1 kHz, swelling then falling, a 0.65x copy under it, panned
             across: a blade passing
  heavy      the voiced hum kept and pitched to 0.55x, swept low, the air laid over it: a heavy swing
  reverse    the air reversed into a short forward tail: a swell-in
  blade      a swoosh and the edge ringing, struck metal the swish excites
  blade-kiin a swoosh and the mouth's own キーン (the recipe's `ring`) pitched 2.6x into a whine
"""
import argparse, json, wave
from pathlib import Path
import numpy as np

SR = 44100
ESPEAK_LANG = {"a": "en-us", "b": "en-gb", "z": "cmn"}


def write_wav(path, st):
    st = np.clip(st, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st.T * 32767).astype("<i2").tobytes())


def resample(a, sr_in, sr_out=SR, rate=1.0):
    n = max(2, int(len(a) * sr_out / sr_in / rate))
    return np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)


def trim(a, db=-40):
    pk = np.abs(a).max() or 1
    idx = np.where(np.abs(a) > pk * 10 ** (db / 20))[0]
    return a[idx[0]: idx[-1] + 1] if len(idx) else a


def norm(x, level=0.89):
    pk = np.abs(x).max() or 1
    return (x / pk * level).astype(np.float32)


def fade(a, ms_in=2, ms_out=15):
    a = a.copy(); i, o = int(SR * ms_in / 1000), int(SR * ms_out / 1000)
    if i: a[:i] *= np.linspace(0, 1, i)
    if o: a[-o:] *= np.linspace(1, 0, o)
    return a


def voicing(a, sr):
    """Per-sample voiced weight 0..1: the normalized autocorrelation (70-400 Hz) of 40 ms frames, smoothed 25 ms."""
    fl, hop = int(0.040 * sr), int(0.005 * sr)
    lo, hi = int(sr / 400), int(sr / 70)
    n_fr = max(1, 1 + (len(a) - fl) // hop)
    v = np.zeros(n_fr)
    for k in range(n_fr):
        f = a[k * hop: k * hop + fl]
        if len(f) < fl: break
        f = f - f.mean()
        if np.dot(f, f) < 1e-7: continue
        ac = np.correlate(f, f, "full")[fl - 1:]
        c = np.cumsum(f * f)
        lags = np.arange(lo, hi)
        v[k] = np.max(ac[lags] / np.sqrt(c[fl - 1 - lags] * (c[-1] - c[lags - 1]) + 1e-12))
    voiced = np.convolve((v > 0.45).astype(float), np.ones(5) / 5, "same")
    return np.interp(np.arange(len(a)), np.arange(n_fr) * hop + fl // 2, voiced)


def stft(x, n=1024, hop=256):
    win = np.hanning(n).astype(np.float32)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    return np.array([np.fft.rfft(pad[i:i + n] * win) for i in range(0, len(pad) - n, hop)]), win, len(x)


def istft(F, win, length, n=1024, hop=256):
    out = np.zeros(hop * len(F) + n); wsum = np.zeros_like(out)
    for k, fr in enumerate(F):
        out[k * hop: k * hop + n] += np.fft.irfft(fr, n) * win
        wsum[k * hop: k * hop + n] += win * win
    return (out / np.maximum(wsum, 1e-6))[n: n + length].astype(np.float32)


def sweep_band(x, f0, f1, width_oct=0.8, floor=0.08):
    F, win, L = stft(x)
    freqs = np.fft.rfftfreq(1024, 1 / SR); freqs[0] = 1
    for k in range(len(F)):
        fc = f0 * (f1 / f0) ** (k / max(1, len(F) - 1))
        F[k] *= floor + (1 - floor) * np.exp(-0.5 * (np.log2(freqs / fc) / width_oct) ** 2)
    return istft(F, win, L)


def highpass(x, fc=1500, slope_oct=0.5):
    F, win, L = stft(x)
    freqs = np.fft.rfftfreq(1024, 1 / SR); freqs[0] = 1
    return istft(F / (1 + np.exp(-np.log2(freqs / fc) / (slope_oct / 4))), win, L)


def passby_env(n, peak_at=0.55, rise=2.0, fall=5.0):
    t = np.linspace(0, 1, n)
    return np.where(t < peak_at, (t / peak_at) ** rise, np.exp(-fall * (t - peak_at) / (1 - peak_at))).astype(np.float32)


def pan_sweep(m, a0=-0.8, a1=0.8):
    th = (np.linspace(a0, a1, len(m)) + 1) * np.pi / 4
    return np.stack([m * np.cos(th), m * np.sin(th)])


def center(m):
    return np.stack([m, m]) * 0.7071


def mix(*tracks):
    out = np.zeros((2, max(t.shape[-1] for t in tracks)), dtype=np.float32)
    for t in tracks: out[:, : t.shape[-1]] += t
    return out


def modal_ring(excite, modes=((2380, 0.12), (3910, 0.09), (5620, 0.07), (8030, 0.05))):
    out = np.zeros(len(excite) + int(SR * 0.5))
    x = np.concatenate([excite, np.zeros(len(out) - len(excite))]).astype(np.float64)
    for f, dec in modes:
        r = np.exp(-1 / (dec * SR)); w = 2 * np.pi * f / SR
        a1, a2 = -2 * r * np.cos(w), r * r
        y1 = y2 = 0.0; y = np.empty_like(x)
        for i in range(len(x)):
            y0 = x[i] - a1 * y1 - a2 * y2
            y[i] = y0; y2, y1 = y1, y0
        out += y * (1 - r)
    return out.astype(np.float32)


# ---- the chains ----
def ch_air(s):
    return center(fade(norm(s["air"])))


def ch_swoosh(s, f0=5200, f1=1100, body=0.5):
    a = s["air"]
    m = sweep_band(a, f0, f1) * passby_env(len(a))
    b = resample(a, SR, rate=0.65)
    b = sweep_band(b, f0 * 0.5, f1 * 0.5) * passby_env(len(b)) * body
    return pan_sweep(fade(norm(mix(center(m), center(b))[0])))


def ch_heavy(s):
    full = resample(s["raw24"], s["sr"], rate=0.55)
    full = sweep_band(full, 1400, 260, width_oct=1.2, floor=0.15) * passby_env(len(full), 0.5)
    air = highpass(resample(s["air24"], s["sr"], rate=0.8), 1100)
    air = sweep_band(air, 3500, 900) * passby_env(len(air), 0.5) * 0.6
    return pan_sweep(fade(norm(mix(center(full), center(air))[0])), -0.6, 0.6)


def ch_reverse(s):
    a = norm(s["air"])
    rev = a[::-1] * np.linspace(0.2, 1, len(a)) ** 2
    n = int(len(a) * 0.35)
    fwd = a[:n] * np.linspace(1, 0, n) ** 1.5
    return pan_sweep(fade(norm(np.concatenate([rev, fwd]))), -0.5, 0.6)


def ch_blade(s, ring_seed=None):
    sw = ch_swoosh(s)
    if ring_seed is None:
        ring = norm(modal_ring(s["air"] * np.linspace(0, 1, len(s["air"])) ** 3)) * 0.35
    else:
        ring = resample(ring_seed["raw"], SR, rate=2.6)
        ring = sweep_band(ring, 6000, 4200, width_oct=0.5, floor=0.02)
        ring = norm(ring) * np.exp(-np.linspace(0, 6, len(ring))) * 0.3
    padded = np.concatenate([np.zeros(int(sw.shape[1] * 0.45), np.float32), ring])
    return mix(sw, pan_sweep(padded, 0.1, 0.5))


def speak(kokoro, text, voice, speed):
    if voice.startswith("j"):
        from misaki import ja
        r = ja.JAG2P()(text)
        s, sr = kokoro.create(r if isinstance(r, str) else r[0], voice=voice, speed=speed, is_phonemes=True)
    else:
        s, sr = kokoro.create(text, voice=voice, speed=speed, lang=ESPEAK_LANG.get(voice[0], "en-us"))
    return np.array(s, dtype=np.float32), sr


def seed(kokoro, text, voice, speed):
    a, sr = speak(kokoro, text, voice, speed)
    raw24 = trim(a)
    air24 = trim(raw24 * (1 - voicing(raw24, sr)), -36)
    return {"sr": sr, "raw24": raw24, "air24": air24, "raw": resample(raw24, sr),
            "air": trim(highpass(resample(air24, sr)), -36)}


CHAINS = {"air": ch_air, "swoosh": ch_swoosh, "heavy": ch_heavy, "reverse": ch_reverse, "blade": ch_blade}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--worker", required=True, help="the voice worker's dir (its models/)")
    ap.add_argument("--recipes", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    from kokoro_onnx import Kokoro
    w = Path(a.worker)
    kokoro = Kokoro(str(w / "models" / "kokoro-v1.0.onnx"), str(w / "models" / "voices-v1.0.bin"))
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    done, kit = [], None
    for r in json.loads(Path(a.recipes).read_text()):
        if r.get("build"):
            # a body build (body.py): syllables cut once, held and layered; a Split's rings are written apart
            import body
            kit = kit or body.Kit(kokoro)
            st = body.BUILDS[r["build"]](kit)
            if isinstance(st, body.Split):
                write_wav(out / f"{r['id']}--dry.wav", st.dry)
                (out / f"{r['id']}.rings.json").write_text(json.dumps(st.rings))
                st = st.full
            write_wav(out / f"{r['id']}.wav", norm(st))
            done.append(r["id"])
            continue
        s = seed(kokoro, r["text"], r["voice"], r["speed"])
        if r["chain"] == "blade-kiin":
            ring = r["ring"]
            st = ch_blade(s, seed(kokoro, ring["text"], ring["voice"], ring["speed"]))
        else:
            st = CHAINS[r["chain"]](s)
        write_wav(out / f"{r['id']}.wav", norm(st))
        done.append(r["id"])
    print(json.dumps({"ok": True, "wrote": done}))


if __name__ == "__main__":
    main()
