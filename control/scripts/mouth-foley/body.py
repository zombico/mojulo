#!/usr/bin/env python3
"""body.py: mouth foley's second renderer: the sounds a word scores and a body performs (the mouth-foley spike's round
6, ported whole so the bake renders what passed the operator's ears).

warp.py's chains warp one spoken word. These build a sound from syllables cut once, held, pitched and layered, the way
a throat, a voice, a mouth and a diaphragm make it (`animal`, `roar`), or held under ~150 ms with a fast pitch arch,
an onset huff and a sub, where a voice stops being a voice and becomes motion (`strike`, `whop`), or from a word's
own consonants, its bursts and clicks, with a struck material's ring (the ch sounds).

    from body import BUILDS
    BUILDS[name](kokoro) → a stereo array, or a Split { full, dry, rings } for a sound with metal in it

A Split's rings are not traced: the tracer (sfx-shelf/trace.js) is a noise vocoder and would hear a ring as hiss. The
bake traces the dry part and lays the kernel's own `ring` gesture for each ring (its modes, decays, time and level).
Everything is seeded by its key (zlib.crc32): the same build makes the same samples on one machine.
"""
import zlib
import numpy as np
import warp as W

SR = W.SR
DB = lambda d: 10 ** (d / 20)


def rng(key):
    return np.random.default_rng(zlib.crc32(key.encode()) if isinstance(key, str) else key)


# ---------------- the cut ----------------
def syllable(kokoro, text, voice="jm_kumo", speed=1.0):
    """{attack, vowel, air} at SR: the consonant's onset (up to 30 ms into the voicing), the steady vowel (the middle
    of the voiced run), and the breath (the unvoiced part)."""
    a, sr = W.speak(kokoro, text, voice, speed)
    a = W.trim(a)
    v = W.voicing(a, sr)
    on = np.where(v > 0.6)[0]
    if len(on) < sr * 0.04:
        on = np.arange(len(a) // 4, 3 * len(a) // 4)
    s, e = on[0], on[-1]
    span = e - s
    vowel = a[s + int(span * 0.2): s + int(span * 0.8)]
    attack = a[: s + int(0.03 * sr)]
    air = W.trim(a * (1 - v), -36)
    to = lambda x: W.resample(x, sr) if len(x) > 1 else np.zeros(2, np.float32)
    return {"attack": to(attack), "vowel": to(vowel), "air": to(air)}


def air_from(s, fc):
    return W.trim(W.highpass(W.resample(s["air24"], s["sr"]), fc), -36)


def lowpass(x, fc):
    F, win, L = W.stft(x)
    f = np.fft.rfftfreq(1024, 1 / SR); f[0] = 1
    return W.istft(F / np.sqrt(1 + (f / fc) ** 4), win, L)


def lowshelf_cut(x, fc=6000):
    return lowpass(x, fc)


def env_decay(n, attack_ms=4, tau_ms=45):
    t = np.arange(n) / SR
    a = np.minimum(1, t / (attack_ms / 1000))
    return (a * np.exp(-np.maximum(0, t - attack_ms / 1000) / (tau_ms / 1000))).astype(np.float32)


def smooth_noise(n, hz, r, lo=0.0, hi=1.0):
    pts = max(2, int(n / SR * hz) + 2)
    return np.interp(np.arange(n), np.linspace(0, n, pts), r.uniform(lo, hi, pts)).astype(np.float32)


# ---------------- the body ----------------
def hold(src, n, key, grain=0.06, hop=0.015):
    """A granular hold: n samples from src's grains, read at random (seeded) and overlapped under Hann windows."""
    g, h = int(grain * SR), int(hop * SR)
    if len(src) <= g: src = np.tile(src, int(np.ceil((g + 1) / max(1, len(src)))) + 1)
    r = rng(key); win = np.hanning(g).astype(np.float32)
    out = np.zeros(n + g, np.float32); wsum = np.zeros_like(out)
    for i in range(0, n, h):
        p = r.integers(0, len(src) - g)
        out[i:i + g] += src[p:p + g] * win; wsum[i:i + g] += win
    return (out / np.maximum(wsum, 1e-3))[:n]


def varispeed(x, sr_in, semis, base):
    """x at base * 2^(semis/12), semis over output time: pitch and pace move together (a throat)."""
    n_max = int(len(x) * SR / sr_in / (base * 2 ** (min(-12, semis.min()) / 12))) + 1
    st = np.resize(semis, n_max) if len(semis) < n_max else semis[:n_max]
    pos = np.cumsum(base * 2 ** (st / 12) * sr_in / SR)
    pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x).astype(np.float32)


def pitched(src, n, semis, base, key):
    long = hold(src, int(n * base * 2 ** (max(0, semis.max()) / 12) * 1.1) + SR // 10, key)
    y = varispeed(long, SR, semis, base)
    return np.pad(y, (0, max(0, n - len(y))))[:n]


def band(x, fc, width_oct=0.9, floor=0.1):
    """A moving band: fc an array over x's samples (the mouth's formant)."""
    F, win, L = W.stft(x)
    f = np.fft.rfftfreq(1024, 1 / SR); f[0] = 1
    for k in range(len(F)):
        c = fc[min(len(fc) - 1, k * 256)]
        F[k] *= floor + (1 - floor) * np.exp(-0.5 * (np.log2(f / c) / width_oct) ** 2)
    return W.istft(F, win, L)


def rough_var(x, hz, depth, seed=1):
    """A rattle: amplitude flutter near hz, its rate wandering (seeded), then a soft clip."""
    r = rng(seed)
    wander = smooth_noise(len(x), 12 / max(1e-3, len(x) / SR), r, 0.8, 1.25)
    ph = np.cumsum(2 * np.pi * hz * wander / SR)
    return np.tanh(2.2 * x * (1 - depth * (0.5 + 0.5 * np.sin(ph)) ** 2)).astype(np.float32)


def surge(t, events, rise=0.04, fall=0.22):
    out = np.zeros_like(t)
    for at, size in events:
        d = t - at
        out += size * np.where(d < 0, 0, np.where(d < rise, d / rise, np.exp(-(d - rise) / fall)))
    return out


def pressure(n, key, push_hz=(2.0, 4.0), lo=0.45, shape=None):
    """The diaphragm: pushes at a wandering rate, 0..1, an attack and a release; `shape` scales it (a roar's arc)."""
    r = rng(key + "/p"); t = np.arange(n) / SR
    rate = np.interp(t, np.linspace(0, t[-1], 8), r.uniform(*push_hz, 8))
    ph = np.cumsum(2 * np.pi * rate / SR) + r.uniform(0, 6.3)
    p = lo + (1 - lo) * (0.5 + 0.5 * np.sin(ph)) ** 1.5
    p *= np.minimum(1, t / 0.06) * np.minimum(1, (t[-1] - t) / 0.15)
    return (p * (shape(t) if shape else 1)).astype(np.float32)


def animal(syl, breath, seconds, key, base=0.62, throat_db=0, voice_db=-3, mouth_db=-5, breath_db=-99,
           mouth_hz=(450, 950), mouth_rate=1.2, rattle_hz=30, push_hz=(2.0, 4.0), lift=2.5, shape=None,
           layers=("throat", "voice", "mouth", "diaphragm", "breath"), attack_db=-6):
    """One syllable held as a body: the throat (sub-octave and fifth, rattled), the voice, the mouth's moving band and
    the breath, one diaphragm's pressure behind all of them (the spike's rules 3-5)."""
    n = int(seconds * SR)
    P = pressure(n, key, push_hz, shape=shape) if "diaphragm" in layers else np.full(n, 0.8, np.float32)
    semis = lift * (P - P.mean())
    out = np.zeros(n, np.float32)
    if "throat" in layers:
        th = pitched(syl["vowel"], n, semis, base * 0.5, key + "/t") + 0.6 * pitched(syl["vowel"], n, semis, base * 0.667, key + "/t5")
        th = lowpass(th, 1500)
        th = rough_var(W.norm(th), rattle_hz * (0.85 + 0.3 * P), np.clip(0.45 + 0.45 * P, 0, 0.92), zlib.crc32(key.encode()) % 997)
        out += W.norm(th) * DB(throat_db)
    if "voice" in layers:
        vo = pitched(syl["vowel"], n, semis, base, key + "/v")
        vo = rough_var(W.norm(lowpass(vo, 3500)), rattle_hz * 0.9, 0.25 + 0.2 * P, 7)
        out += W.norm(vo) * DB(voice_db)
    if "mouth" in layers:
        r = rng(key + "/m"); t = np.arange(n) / SR
        open_ = 0.5 + 0.5 * np.sin(2 * np.pi * mouth_rate * r.uniform(0.8, 1.2) * t + r.uniform(0, 6.3))
        fc = mouth_hz[0] * (mouth_hz[1] / mouth_hz[0]) ** np.clip(0.6 * open_ + 0.4 * P, 0, 1)
        mo = band(pitched(syl["vowel"], n, semis + 0.3, base, key + "/mo"), fc)
        out += W.norm(mo) * DB(mouth_db)
    if "breath" in layers and breath_db > -90 and len(breath["air"]) > 64:
        br = W.highpass(hold(breath["air"], n, key + "/b"), 1500)
        out += W.norm(br) * (P ** 2) * DB(breath_db)
    out *= (0.25 + 0.75 * P)
    if attack_db > -90 and len(syl["attack"]) > 64:
        a = W.resample(syl["attack"], SR, rate=base); out[: len(a)] += W.norm(a)[:n] * DB(attack_db) * 0.8
    return W.center(W.fade(W.norm(out), 3, 120))


# ---------------- the roar: a first vowel opening into A ----------------
BAND = {"a": 1250, "o": 650, "u": 480, "e": 1500, "i": 2600}
ROARS = {  # the operator's rule: a roar rises, low to high (oa, ua, ea); ia starts high and ends higher
    "lion-oa": dict(v1=("o", "オ"), base=0.5, secs=2.6, share=[(0, 0), (0.12, 0), (0.32, 1), (1, 1)],
                    pitch=[(0, -3), (0.35, 1), (0.8, 4), (1, 3.5)], rasp=0.18, breath=-8),
    "bear-ea": dict(v1=("e", "エ"), base=0.58, secs=1.9, share=[(0, 0), (0.1, 0), (0.25, 1), (1, 1)],
                    pitch=[(0, -2), (0.3, 0.5), (0.8, 3), (1, 2.5)], rasp=0, breath=-8),   # 6h: no rattle, no gargle
    "monster-ia": dict(v1=("i", "イ"), base=0.75, secs=3.4, share=[(0, 0), (0.25, 0), (0.5, 1), (1, 1)],
                       pitch=[(0, 5), (0.3, 6.5), (0.8, 10), (1, 11)], rasp=0.12, breath=-10, screech=True, vibrato=0.6),
}


def curve(points, n):
    t = np.linspace(0, 1, n)
    return np.interp(t, [p[0] for p in points], [p[1] for p in points]).astype(np.float32)


def roar_body(src, n, semis, base, fc, rasp, key):
    voice = lowpass(pitched(src, n, semis, base, key + "/v"), 4500)
    voice = rough_var(W.norm(voice), 28, rasp, 5) if rasp > 0 else W.norm(voice)
    sub = np.tanh(1.5 * W.norm(lowpass(pitched(src, n, semis, base * 0.5, key + "/s"), 1200)))
    mouth = band(pitched(src, n, semis + 0.15, base, key + "/m"), fc, width_oct=0.8, floor=0.15)
    return W.norm(voice) + W.norm(sub) * DB(-6) + W.norm(mouth) * DB(-2)


def roar(syl, breath, name, spec):
    n = int(spec["secs"] * SR); t = np.arange(n) / SR
    v1, text = spec["v1"]
    share = curve(spec["share"], n)
    semis = curve(spec["pitch"], n)
    if spec.get("vibrato"): semis = semis + spec["vibrato"] * share * np.sin(2 * np.pi * 5.2 * t)
    semis = semis + surge(t, [(0.03, 4.0)], 0.03, 0.15)
    fc = BAND[v1] * (BAND["a"] / BAND[v1]) ** share
    P = pressure(n, f"roar-{name}", (1.5, 2.5), lo=0.78,
                 shape=lambda tt: np.interp(tt, [0, spec["secs"] * 0.3, spec["secs"] * 0.75, spec["secs"]], [0.6, 1.0, 0.85, 0.3]))
    out = roar_body(syl["ア"]["vowel"], n, semis, spec["base"], fc, spec["rasp"], f"roar-{name}/a") * np.sqrt(share)
    out = out + roar_body(syl[text]["vowel"], n, semis, spec["base"], fc, spec["rasp"], f"roar-{name}/1") * np.sqrt(1 - share)
    if spec.get("screech"):
        hi = band(pitched(syl[text]["vowel"], n, semis, spec["base"] * 1.5, f"roar-{name}/h"), np.full(n, 3200.0), 0.7, 0.1)
        out = out + W.norm(hi) * DB(-5) * (1 - share) ** 1.5
    br = band(hold(breath["air"], n, f"roar-{name}/b"), fc * 1.6, width_oct=1.2, floor=0.2)
    out = W.norm(out) + W.norm(br) * DB(spec["breath"]) * P ** 1.5
    out = out * (0.2 + 0.8 * P)
    return W.center(W.fade(W.norm(out), 4, 250))


# ---------------- the strike: a syllable under ~150 ms is motion, not a voice ----------------
ARCH = [(0, 1), (0.22, 5), (0.6, 1), (1, -3)]
KINDS = {
    "punch": dict(base=0.9, secs=0.13, arch=ARCH, voice=0, sub=-6, huff=-8, peak=None, sweep=None, pan=(0, 0)),
    "kick": dict(base=0.6, secs=0.22, arch=[(0, 0), (0.25, 4), (0.65, 0), (1, -4)], voice=0, sub=-3, huff=-6, peak=None, sweep=None, pan=(0, 0)),
    "staff": dict(base=1.1, secs=0.38, arch=[(0, -2), (0.45, 4), (1, -3)], voice=-4, sub=-14, huff=0, peak=0.45, sweep=(1200, 3200, 1400), pan=(-0.7, 0.7)),
    "nunchaku": dict(base=1.3, secs=0.12, arch=[(0, -1), (0.4, 3), (1, -2)], voice=-6, sub=-14, huff=-2, peak=0.4, sweep=(1600, 3800, 1800), pan=(0, 0)),
}


def strike(syl, breath, kind, key, pitch_off=0.0, gain_db=0.0, pan=None, secs_mul=1.0):
    k = KINDS[kind]; base, secs = k["base"], k["secs"] * secs_mul
    n = int(secs * SR); t = np.linspace(0, 1, n)
    semis = np.interp(t, [q[0] for q in k["arch"]], [q[1] for q in k["arch"]]).astype(np.float32) + pitch_off
    v = lowpass(pitched(syl["vowel"], n, semis, base, key + "/v"), 5000)
    v = rough_var(W.norm(v), 30, 0.22, 3)
    sub = np.tanh(1.5 * W.norm(lowpass(pitched(syl["vowel"], n, semis, base * 0.5, key + "/s"), 1000)))
    out = W.norm(v) * DB(k["voice"]) + W.norm(sub) * DB(k["sub"])
    air = syl["air"] if len(syl["air"]) > int(0.03 * SR) else breath["air"]
    if k["peak"] is None:
        env = np.minimum(1, t * secs / 0.004) * np.exp(-np.maximum(0, t - 0.18) * 3.2)
        huff = W.highpass(hold(air, n, key + "/b"), 1500) * np.exp(-t * secs / 0.05)
    else:
        env = W.passby_env(n, k["peak"], 1.5, 4.0)
        huff = W.highpass(hold(air, n, key + "/b"), 900) * env
    out = W.norm(out) * env + W.norm(huff) * DB(k["huff"])
    if k["sweep"]:
        f0, f1, f2 = k["sweep"]
        out = band(out, np.interp(t, [0, k["peak"], 1], [f0, f1, f2]), width_oct=1.1, floor=0.25)
    out = W.fade(W.norm(out) * DB(gain_db), 1, 25)
    a0, a1 = pan if pan is not None else k["pan"]
    return W.pan_sweep(out, a0, a1)


def place(events, secs):
    buf = np.zeros((2, int(secs * SR)), np.float32)
    for at, x in events:
        if x.ndim == 1: x = W.center(x)
        i = int(at * SR); m = min(x.shape[1], buf.shape[1] - i); buf[:, i:i + m] += x[:, :m]
    return buf


def pad(x, pre=0.1, post=0.3):
    return place([(pre, x)], x.shape[-1] / SR + pre + post)


def nunchaku(syl, breath, key, count=8):
    r = rng(key); ev, t = [], 0.15
    for i in range(count):
        s = 0.6 if i % 2 == 0 else -0.6
        ev.append((t, strike(syl, breath, "nunchaku", f"{key}/{i}", (1 if i % 2 else -1) * 0.8 + r.uniform(-0.4, 0.4),
                             -4 + 4 * min(1, i / 3) + r.uniform(-1, 0), (s * 0.6, s))))
        t += 0.115 * r.uniform(0.95, 1.05)
    return place(ev, t + 0.4)


# ---------------- the whop: a staff's end passing, round and low ----------------
def whop(syl, breath, key, secs=0.22, base=0.55, voice_db=-10, pitch_off=0.0, gain_db=0.0, pan=(-0.3, 0.3)):
    n = int(secs * SR); t = np.linspace(0, 1, n)
    semis = np.interp(t, [0, 0.6, 1], [-2, 2, -1]).astype(np.float32) + pitch_off
    env = W.passby_env(n, 0.62, 1.6, 9.0)
    air = syl["air"] if len(syl["air"]) > int(0.03 * SR) else breath["air"]
    a = hold(air, n, key + "/a")
    fc = np.interp(t, [0, 0.62, 1], [300, 650, 350]) * 2 ** (pitch_off / 12)
    a = lowpass(band(a, fc, width_oct=0.6, floor=0.02), 1200)
    out = W.norm(a)
    if voice_db > -60:
        v = lowpass(pitched(syl["vowel"], n, semis, base, key + "/v"), 500)
        out = out + W.norm(v) * DB(voice_db)
    sub = np.tanh(1.4 * W.norm(lowpass(pitched(syl["vowel"], n, semis, base * 0.5, key + "/s"), 250)))
    out = (W.norm(out) + W.norm(sub) * DB(-7)) * env
    return W.pan_sweep(W.fade(W.norm(out) * DB(gain_db), 2, 12), *pan)


def twirl(syl, breath, key, seconds=2.0, rate=(3.5, 3.5), **kw):
    r, ev, t, i = rng(key), [], 0.1, 0
    while t < seconds:
        prog = t / seconds; rt = rate[0] + (rate[1] - rate[0]) * prog
        side = (-0.4, 0.4) if i % 2 == 0 else (0.4, -0.4)
        secs = min(0.26, 0.8 / rt)
        ev.append((t, whop(syl, breath, f"{key}/{i}", secs, pitch_off=(0.6 if i % 2 else -0.6) + 2 * prog + r.uniform(-0.3, 0.3),
                           gain_db=r.uniform(-1.5, 0), pan=side, **kw)))
        t += 1 / rt * r.uniform(0.97, 1.03); i += 1
    return place(ev, t + 0.4)


# ---------------- the ch sounds: a word's own bursts and clicks, and a ring where it is metal ----------------
STEEL = ((2380, 0.05), (3910, 0.04), (5620, 0.03), (8030, 0.02))
LATCH = ((1800, 0.04), (3100, 0.03), (4700, 0.02))
HEAVY = ((700, 0.06), (1150, 0.05), (1900, 0.04), (2900, 0.03))
COIN = ((3150, 0.5), (4870, 0.35), (6900, 0.25), (9300, 0.15))
BLADE = ((5200, 0.03), (7600, 0.02))


class Ring:
    """A struck material's ring: the rendered ring (for the full mix) and what the kernel needs to strike it again."""
    def __init__(self, x, modes, scale, db):
        self.modes = tuple((f * scale, d) for f, d in modes)
        self.x = W.norm(W.modal_ring(x, self.modes)) * DB(db)


def burst(syl, ms, hp=2000, rate=1.0):
    """The consonant's onset: the unvoiced part of the attack (the ch, the k, the p), highpassed, cut to ms."""
    a = syl["attack"]; a = a[: max(64, len(a) - int(0.025 * SR))]
    if rate != 1.0: a = W.resample(a, SR, rate=rate)
    a = W.highpass(a, hp)[: int(ms / 1000 * SR)].copy()
    k = min(len(a) // 3, int(0.008 * SR)); a[-k:] *= np.linspace(1, 0, k)
    return W.norm(W.fade(a, 1, 1))


def click(syl, ms=12, hp=1500):
    return burst(syl, ms, hp)


def tick(syl, secs, base, semis=(0, 0), lp=3000, key="t"):
    n = int(secs * SR); s = np.linspace(semis[0], semis[1], n).astype(np.float32)
    v = lowpass(pitched(syl["vowel"], n, s, base, key), lp)
    env = np.minimum(1, np.arange(n) / (0.002 * SR)) * np.exp(-np.linspace(0, 6, n))
    return W.norm(v) * env


class Group:
    """A mono mix of events (an array, a Ring, or a nested Group), normalized and faded as one: the spike's `mono`,
    kept in parts so the dry sound and each ring come out at the scale they sound at in the whole."""
    def __init__(self, events, secs):
        n = int(secs * SR); parts = []
        for at, it in events:
            i = int(at * SR)
            if isinstance(it, Group): parts += [(kind, meta, i + s, x) for kind, meta, s, x in it.parts]
            elif isinstance(it, Ring): parts.append(("ring", it.modes, i, it.x))
            else: parts.append(("dry", None, i, it))
        total = np.zeros(n, np.float32)
        for _, _, s, x in parts:
            m = min(len(x), n - s); total[s:s + m] += x[:m]
        f = 0.89 / (np.abs(total).max() or 1)
        env = W.fade(np.ones(n, np.float32), 1, 20)
        self.parts = []
        for kind, meta, s, x in parts:
            m = min(len(x), n - s)
            self.parts.append((kind, meta, s, (x[:m] * f * env[s:s + m]).astype(np.float32)))
        self.n = n

    def mono(self, keep=("dry", "ring")):
        out = np.zeros(self.n, np.float32)
        for kind, _, s, x in self.parts:
            if kind in keep: out[s:s + len(x)] += x
        return out


class Split:
    """A sound whose rings the bake strikes with the kernel: the full mix, the dry part, and each ring (its modes, its
    time in the file, where the mix cut it, and its peak, at the file's scale)."""
    def __init__(self, g, pre=0.1, post=0.3):
        lead = int(pre * SR); n = g.n + lead + int(post * SR)
        place_ = lambda m: np.pad(m, (lead, n - lead - len(m))) * 0.7071
        full = place_(g.mono())
        k = 0.89 / (np.abs(full).max() or 1)
        self.full = np.stack([full, full]) * k
        dry = place_(g.mono(("dry",))) * k
        self.dry = np.stack([dry, dry])
        self.rings = [{"at": round((lead + s) / SR, 4), "end": round((lead + s + len(x)) / SR, 4),
                       "modes": [[round(f, 1), d] for f, d in meta], "peak": round(float(np.abs(x).max() * 0.7071 * k), 5)}
                      for kind, meta, s, x in g.parts if kind == "ring"]


def chaki(S, scale=1.0):
    ch = burst(S["チャ"], 40, 2500); k = click(S["キ"], 12, 2000)
    return Group([(0, ch * DB(-2)), (0, Ring(ch, STEEL, scale, -6)), (0.06, k), (0.06, Ring(k, STEEL, scale * 1.04, -2))], 0.45)


def kacha(S, scale=1.0):
    k = click(S["カ"], 12, 1500); ch = burst(S["チャ"], 50, 2000)
    return Group([(0, k), (0, Ring(k, LATCH, scale, -4)), (0.035, ch * DB(-3))], 0.35)


def gacha(S, key="gacha"):
    th = tick(S["ガ"], 0.09, 0.45, (2, -3), 400, key + "/t"); k = click(S["ガ"], 15, 800)
    ch = burst(S["チャ"], 70, 1500)
    return Group([(0, th), (0, k * DB(-4)), (0, Ring(k, HEAVY, 1, -8)), (0.05, ch * DB(-2)), (0.05, Ring(ch, HEAVY, 1.1, -10))], 0.5)


def charin(S, scale=1.0):
    ch = burst(S["チャ"], 25, 3000)
    return Group([(0, ch * DB(-6)), (0, Ring(ch, COIN, scale, 0)), (0.09, Ring(ch * 0.4, COIN, scale * 1.01, -7))], 1.2)


def chun(S, key="chun"):
    secs = 0.3; n = int(secs * SR); t = np.linspace(0, 1, n)
    ch = burst(S["チュ"], 30, 2500)
    v = pitched(S["チュ"]["vowel"], n, np.linspace(0, -12, n).astype(np.float32), 2.2, key + "/v")
    v = band(v, np.interp(t, [0, 1], [3500, 1800]), 0.7, 0.05) * W.passby_env(n, 0.15, 1.2, 4)
    a = W.highpass(hold(S["チュ"]["air"] if len(S["チュ"]["air"]) > 800 else ch, n, key + "/a"), 2500) * W.passby_env(n, 0.1, 1, 6)
    m = Group([(0, ch), (0.01, W.norm(v) * DB(-6)), (0.01, W.norm(a) * DB(-10))], 0.45).mono()
    return W.pan_sweep(m, -0.6, 0.7)


def pachi(S, rate=1.0):
    p = click(S["パ"], 8, 2500); ch = burst(S["チ"], 20, 3500, rate)
    return Group([(0, p), (0.012, ch * DB(-2))], 0.06).mono()


def scatter(grains, seconds, per_s=7.0, seed=11):
    """A Poisson crackle: grains at random rates, levels and places, no rhythm to hear."""
    r, n = rng(seed), int(seconds * SR)
    out = np.zeros((2, n + SR), np.float32)
    t = 0.05
    while t < seconds:
        g = W.resample(grains[r.integers(len(grains))], SR, rate=r.uniform(0.75, 1.5))
        g = g * 10 ** (r.uniform(-14, 0) / 20)
        th = (r.uniform(-0.7, 0.7) + 1) * np.pi / 4
        i = int(t * SR); out[0, i:i + len(g)] += g * np.cos(th); out[1, i:i + len(g)] += g * np.sin(th)
        t += r.exponential(1 / per_s)
    return out[:, :n]


def bachibachi(S, seconds=2.0, key="bachi"):
    r = rng(key)
    grains = [pachi(S, r.uniform(0.8, 1.4)) for _ in range(6)]
    crack = scatter(grains, seconds, per_s=16, seed=zlib.crc32(key.encode()) % 1000)
    n = crack.shape[1]
    hum = lowpass(pitched(S["チ"]["vowel"], n, np.zeros(n, np.float32), 0.45, key + "/h"), 300)
    hum = W.norm(hum) * (0.6 + 0.4 * smooth_noise(n, 9, r)) * DB(-16)
    hum[: int(0.1 * SR)] *= np.linspace(0, 1, int(0.1 * SR)); hum[-int(0.2 * SR):] *= np.linspace(1, 0, int(0.2 * SR))
    return W.norm(crack + W.center(hum))


def picha(S, key="picha", scale=1.0):
    bl = tick(S["ピ"], 0.05, 1.8 * scale, (0, 7), 3000, key + "/b")
    ch = lowpass(burst(S["チャ"], 30, 1200), 4000)
    return Group([(0, click(S["ピ"], 6, 2000) * DB(-6)), (0.003, bl), (0.02, W.norm(ch) * DB(-5))], 0.15).mono()


def chokin(S):
    sl = burst(S["チョ"], 90, 2000, rate=0.8)
    sl = band(np.pad(sl, (0, 64)), np.linspace(2500, 5000, len(sl) + 64), 0.8, 0.2)[: len(sl)]
    sl = W.norm(sl) * np.linspace(0.3, 1, len(sl))
    k = click(S["キ"], 10, 2500)
    return Group([(0, sl * DB(-3)), (len(sl) / SR, k), (len(sl) / SR, Ring(k, BLADE, 1, -6))], 0.3)


def kachikachi(S, seconds=2.6, period=0.4):
    ev, t, i = [], 0.05, 0
    k, ch = click(S["カ"], 10, 1800), burst(S["チ"], 15, 2500)
    while t < seconds:
        x = k if i % 2 == 0 else ch
        ev += [(t, x), (t, Ring(x, LATCH, 1.3 if i % 2 else 1.0, -8))]; t += period; i += 1
    return Group(ev, t + 0.2)


def coins(S):
    """Coins dropped: three チャリン at their own pitches (the spike's 'in use' take, the one the row voices)."""
    return Group([(0.0, charin(S, 1.0)), (0.4, charin(S, 0.9)), (0.65, charin(S, 1.12))], 2.0)


# ---------------- round 7: the game's everyday sounds, each a word's syllables struck, held or rung ----------------
BRIGHT = ((2900, 0.25), (4700, 0.18), (6900, 0.12), (9100, 0.08))   # a blade's kiin
WOOD = ((620, 0.03), (1500, 0.02), (2600, 0.012))
SPARK = ((5200, 0.12), (7400, 0.09), (9800, 0.06))


def arch_tick(syl, secs, base, points, lp=3000, key="a", decay=6.0):
    """A short voiced tick on a pitch curve (points [(t, semis)]): a boing, a squeak, a chirp, a gulp."""
    n = int(secs * SR); t = np.linspace(0, 1, n)
    semis = np.interp(t, [p[0] for p in points], [p[1] for p in points]).astype(np.float32)
    v = lowpass(pitched(syl["vowel"], n, semis, base, key), lp)
    env = np.minimum(1, np.arange(n) / (0.003 * SR)) * np.exp(-t * decay)
    return W.norm(v) * env


def held_air(s, secs, hp, lp, key, peak=0.15, rattle=None):
    """A word's breath held to secs (granular), banded, swelling to its peak and falling: a slide, a hiss."""
    n = int(secs * SR)
    a = hold(air_from(s, hp), n, key)
    a = lowpass(a, lp) * W.passby_env(n, peak, 1.2, 3.0)
    if rattle: a = rough_var(W.norm(a), rattle[0], rattle[1], 9)
    return W.norm(a)


def r7_land(S):
    return Group([(0, burst(S["ス"], 40, 2000) * DB(-6)), (0.02, click(S["タ"], 10, 800)),
                  (0.02, tick(S["タ"], 0.08, 0.5, (0, -4), 500, "land/t") * DB(-1))], 0.25).mono()


def r7_hit(S):
    return Group([(0, click(S["バ"], 8, 1200)), (0.004, tick(S["バ"], 0.06, 0.55, (0, -5), 600, "hit/t") * DB(-2)),
                  (0.008, burst(S["シ"], 35, 2500) * DB(-3))], 0.2).mono()


def r7_heavy_hit(S):
    return Group([(0, tick(S["ド"], 0.14, 0.4, (2, -6), 450, "heavy/t")), (0.008, click(S["カ"], 12, 1000) * DB(-2)),
                  (0.012, burst(S["カ"], 30, 1800) * DB(-6))], 0.32).mono()


def r7_body_fall(S):
    return Group([(0, tick(S["ド"], 0.12, 0.38, (0, -5), 400, "fall/t")), (0.02, lowpass(burst(S["サ"], 80, 800), 2500) * DB(-4))], 0.32).mono()


def r7_stab(S):
    return Group([(0, burst(S["ズ"], 40, 1500) * DB(-4)), (0.02, tick(S["ブ"], 0.09, 0.5, (0, -6), 700, "stab/t"))], 0.25).mono()


def r7_draw(S):
    sl = burst(S["シャ"], 120, 2000, rate=0.7)
    sl = band(np.pad(sl, (0, 64)), np.linspace(2000, 6000, len(sl) + 64), 0.8, 0.2)[: len(sl)] * np.linspace(0.2, 1, len(sl))
    k = click(S["キ"], 10, 2500)
    return Group([(0, W.norm(sl) * DB(-3)), (len(sl) / SR, k), (len(sl) / SR, Ring(k, BRIGHT, 1.0, 0))], 1.3)


def r7_sheathe(S):
    sl = W.norm(lowpass(burst(S["シャ"], 90, 1500, rate=0.8), 6000)); sl = sl * np.linspace(1, 0.3, len(sl))
    k = click(S["キ"], 10, 2000)
    return Group([(0, sl * DB(-6)), (0.1, k), (0.1, Ring(k, STEEL, 0.9, -6))], 0.45)


def r7_clash(S):
    k = click(S["ガ"], 12, 1500)
    return Group([(0, k), (0, Ring(k, BRIGHT, 1.1, 0)), (0.004, burst(S["キ"], 20, 3000) * DB(-6))], 0.9)


def r7_thunk(S):
    k = click(S["ト"], 10, 900)
    return Group([(0, k), (0, tick(S["ト"], 0.07, 0.6, (0, -3), 800, "thunk/t") * DB(-2)), (0, Ring(k, WOOD, 1, -4)),
                  (0.03, burst(S["ス"], 30, 2500) * DB(-10))], 0.3)


def r7_sparkle(S):
    ev = []
    for i in range(6):
        b = burst(S["キ"], 12, 4000)
        ev += [(i * 0.065, b * DB(-10 - i)), (i * 0.065, Ring(b, SPARK, 1 + 0.07 * ((i * 5) % 7), -i * 1.5))]
    return Group(ev, 0.9)


def r7_creak(S, hz=35, key="creak"):
    secs = 0.8; n = int(secs * SR); t = np.linspace(0, 1, n)
    semis = (2 * np.sin(2 * np.pi * 1.3 * t * secs) - 1).astype(np.float32)
    v = pitched(S["ギ"]["vowel"], n, semis, 0.7, key + "/v")
    v = rough_var(W.norm(v), hz, 0.85, 4)
    v = band(v, np.interp(t, [0, 1], [900, 1300]), 0.8, 0.1) * W.passby_env(n, 0.3, 1.0, 1.6)
    return W.norm(v)


def r7_button(S):
    k = click(S["カ"], 8, 2000)
    return Group([(0, k), (0, Ring(k, LATCH, 1.5, -10)), (0.03, burst(S["チ"], 12, 3000) * DB(-4))], 0.2)


def r7_lever(S):
    k = click(S["ガ"], 15, 800); ko = click(S["コ"], 10, 900)
    return Group([(0, k * DB(-2)), (0.05, tick(S["コ"], 0.12, 0.45, (0, -3), 500, "lever/t")), (0.05, ko), (0.05, Ring(ko, HEAVY, 0.8, -6))], 0.6)


def r7_squeak(S):
    return Group([(0, arch_tick(S["チュ"], 0.14, 2.6, [(0, 0), (0.3, 5), (1, 2)], 5000, "squeak/v", 3.0))], 0.2).mono()


def r7_eat(S):
    ev = []
    for i in range(2):
        ev += [(i * 0.36, tick(S["モ"], 0.09, 0.6, (0, -2), 700, f"eat/m{i}")), (i * 0.36 + 0.18, tick(S["グ"], 0.09, 0.55, (0, -2), 600, f"eat/g{i}") * DB(-2))]
    return Group(ev, 0.85).mono()


def r7_gulp(S):
    return Group([(0, arch_tick(S["ゴ"], 0.12, 0.5, [(0, 3), (1, -5)], 600, "gulp/v", 4.0)), (0.09, click(S["ク"], 8, 1200) * DB(-4))], 0.3).mono()


def r7_shuriken(K):
    a = strike(K.syl("シュッ"), K.syl("ハッ"), "nunchaku", "shuriken/1", 4, 0, (-0.7, 0.2))
    b = strike(K.syl("シュッ"), K.syl("ハッ"), "nunchaku", "shuriken/2", 5, -1, (-0.2, 0.7))
    return place([(0.1, a), (0.19, b)], 0.65)


def r7_dash(K):
    return place([(0.1, strike(K.syl("シュッ"), K.syl("ハッ"), "staff", "dash", 2, 0, (-0.6, 0.6), 0.5)), (0.3, W.center(click(K.syl("タ"), 10, 800)))], 0.7)


# ---------------- round 7b: the fails done again, the chirps as sequences, and more of the world ----------------
GLASS = ((2600, 0.15), (4300, 0.1), (6100, 0.07), (8800, 0.05))


def r7b_power_arp(S):
    """A power-up as a staircase: four short bright ticks rising (0, 4, 7, 12 semitones), a small ring on each."""
    ev = []
    for i, st in enumerate((0, 4, 7, 12)):
        tk = arch_tick(S["キュ"], 0.07, 1.6 * 2 ** (st / 12), [(0, 0), (1, 1)], 6000, f"parp/{i}", 5.0)
        ev += [(i * 0.075, tk), (i * 0.075, Ring(burst(S["キ"], 10, 4000), SPARK, 2 ** (st / 12) * 0.8, -6))]
    return Group(ev, 0.75)


def r7b_power_chime(S):
    """A power-up as rings alone: the sparkle's rings rising by a major arpeggio, struck by キ's burst."""
    ev = []
    for i, sc in enumerate((1.0, 1.26, 1.5, 2.0)):
        b = burst(S["キ"], 10, 4000)
        ev += [(i * 0.08, b * DB(-12)), (i * 0.08, Ring(b, SPARK, sc * 0.7, -i))]
    return Group(ev, 0.9)


def r7b_creak_pulses(S, key="creak-pulses"):
    """A door's creak as stick-slip: ギ's click repeated at a rate that rises and falls (35 → 110 → 50 a second),
    each through a wood's band: the hinge catching and letting go."""
    r = rng(key); k = click(S["ギ"], 4, 600)
    secs = 0.9; t, ev = 0.0, []
    while t < secs:
        rate = np.interp(t / secs, [0, 0.4, 1], [35, 110, 50])
        ev.append((t, k * DB(-r.uniform(0, 4)) * (0.5 + 0.5 * np.sin(np.pi * t / secs))))
        t += (1 / rate) * r.uniform(0.85, 1.15)
    g = Group(ev, secs + 0.05).mono()
    n = len(g); f = np.interp(np.linspace(0, 1, n), [0, 0.5, 1], [700, 1400, 900])
    return W.norm(band(g, f, 0.9, 0.15))


def r7b_creak_squeal(S, key="creak-squeal"):
    """A door's squeal: イ held high (a hinge's whine), wandering, rattled slowly (it catches)."""
    secs = 0.8; n = int(secs * SR); t = np.linspace(0, 1, n)
    v = pitched(S["キ"]["vowel"], n, (3 * np.sin(2 * np.pi * 0.9 * t * secs) + np.interp(t, [0, 1], [0, 4])).astype(np.float32), 1.9, key + "/v")
    v = rough_var(W.norm(lowpass(v, 4000)), 18, 0.7, 6)
    return W.norm(band(v, np.interp(t, [0, 1], [1600, 2400]), 0.8, 0.1) * W.passby_env(n, 0.35, 1.0, 1.4))


def r7b_bubbles_blip(S, key="bubbles-blip"):
    """Bubbles: ポ's lip pop and a very short rise (a bubble's resonance climbing as it closes), underwater-dark."""
    r = rng(key); ev, t = [], 0.02
    for i in range(6):
        sc = r.uniform(0.8, 1.3)
        ev += [(t, click(S["ポ"], 4, 300) * DB(-8)), (t, arch_tick(S["ポ"], 0.03, 2.0 * sc, [(0, 0), (1, 12)], 2200, f"{key}/{i}", 3.0) * DB(-r.uniform(0, 5)))]
        t += r.exponential(0.09) + 0.03
    return W.norm(lowpass(Group(ev, t + 0.1).mono(), 2500))


def r7b_bubbles_pops(K, key="bubbles-pops"):
    """Bubbles: the pops cut from ポコポコ's own breath, scattered, darkened."""
    grains = _pops(K.seed("ポコポコ", 1.2))
    return W.norm(lowpass(scatter(grains, 0.8, per_s=9, seed=21)[0], 2000))


def chirp_pair(S, key, gap=0.05):
    return Group([(0, arch_tick(S["ピ"], 0.06, 2.4, [(0, 0), (1, 7)], 6000, key + "/1", 3.0)),
                  (gap, arch_tick(S["ヨ"], 0.08, 2.2, [(0, 5), (1, -2)], 6000, key + "/2", 3.0))], gap + 0.1).mono()


def r7b_piyopiyo(S):
    """ピヨピヨ: the pair close (ピ then ヨ 50 ms on), three pairs 0.2 s apart."""
    return Group([(i * 0.2, chirp_pair(S, f"piyo/{i}") * DB(-i)) for i in range(3)], 0.6).mono()


def r7b_chunchun(S, key="chunchun"):
    """チュンチュン: a sparrow's quick arches, four at 0.1 s, each a little different."""
    r = rng(key)
    return Group([(i * 0.1, arch_tick(S["チュ"], 0.06, 2.8 * r.uniform(0.95, 1.08), [(0, 0), (0.4, 6), (1, 3)], 6500, f"{key}/{i}", 3.0) * DB(-r.uniform(0, 3)))
                  for i in range(4)], 0.5).mono()


def r7b_pipipi(S, key="pipipi"):
    """ピピピッ: a trill, five short rising ピ at 60 ms."""
    return Group([(i * 0.06, arch_tick(S["ピ"], 0.04, 2.6, [(0, 0), (1, 4)], 7000, f"{key}/{i}", 3.0)) for i in range(5)], 0.4).mono()


def r7b_whip(K):
    """ピシッ: a short swish, then the crack: ピ's click and シ's burst."""
    sw = strike(K.syl("シュッ"), K.syl("ハッ"), "nunchaku", "whip", 3, -6, (-0.4, 0.3))
    crack = Group([(0, click(K.syl("ピ"), 5, 3000)), (0.004, burst(K.syl("シ"), 25, 4000) * DB(-2))], 0.12).mono()
    return place([(0.1, sw), (0.19, W.center(crack))], 0.6)


def r7b_glass(S, key="glass"):
    """パリン: パ's click rung as glass, then the pieces: small glass rings scattered after it."""
    r = rng(key); k = click(S["パ"], 8, 2500)
    ev = [(0, k), (0, Ring(k, GLASS, 1, 0))]
    for i in range(5):
        b = burst(S["パ"], 6, 4000)
        ev += [(0.05 + i * 0.04 * r.uniform(0.7, 1.4), Ring(b, GLASS, r.uniform(1.3, 2.0), -6 - 2 * i))]
    return Group(ev, 0.9)


def r7b_step_wood(S):
    k = click(S["コ"], 8, 600)
    return Group([(0, k), (0, tick(S["コ"], 0.05, 0.7, (0, -3), 1500, "kotsu/t") * DB(-3)), (0, Ring(k, WOOD, 1, -6))], 0.2)


def r7b_step_metal(S):
    k = click(S["カ"], 8, 1500)
    return Group([(0, k), (0, Ring(k, STEEL, 0.8, -4)), (0, tick(S["カ"], 0.05, 0.6, (0, -3), 900, "kan/t") * DB(-6))], 0.35)


def r7b_cast(K, key="cast"):
    """シュワーン: シュ's burst, then its breath swept up through a band (1.5 → 5 kHz), swelling, a few sparks at its top."""
    S = K.S("シュ", "キ"); secs = 0.55; n = int(secs * SR); t = np.linspace(0, 1, n)
    a = hold(air_from(K.seed("シュワーン", 1.0), 800), n, key + "/a")
    a = W.norm(band(a, np.interp(t, [0, 1], [1500, 5000]), 0.7, 0.05)) * W.passby_env(n, 0.7, 1.2, 4)
    ev = [(0, burst(S["シュ"], 30, 2500) * DB(-6)), (0.02, a)]
    for i in range(3):
        b = burst(S["キ"], 8, 4000); ev.append((0.38 + i * 0.05, Ring(b, SPARK, 1.2 + 0.2 * i, -8)))
    return Group(ev, 0.8)


# ---------------- round 7c: a whip that cracks, steps that are steps ----------------
def r7c_step(S, click_syl, body_syl, modes, scale, ring_db, key):
    """A footstep: the heel then the toe 70 ms on, softer; a low soft thud (a shoe, not a stick), a scuff, and the
    floor's own ring kept short and far under it."""
    c = click(S[click_syl], 6, 500)
    short = tuple((f, d * 0.5) for f, d in modes)
    ev = []
    for k, (at, g) in enumerate(((0, 0), (0.07, -5))):
        th = tick(S[body_syl], 0.06, 0.42, (0, -3), 500, f"{key}/t{k}")
        sc = lowpass(burst(S[body_syl], 25, 900), 3500)
        ev += [(at, th * DB(g)), (at, c * DB(g - 8)), (at + 0.004, sc * DB(g - 12)), (at, Ring(c, short, scale, ring_db + g))]
    return Group(ev, 0.35)


# ---------------- round 8b: a whip as a whop and a cak; birds as a syrinx, not a person ----------------
def calls(items, secs):
    return Group([(at, x * DB(g)) for at, x, g in items], secs).mono()


def r8b_whip(K, rate=1.6, cak_ms=22):
    """A whip: the whop (the staff's round swish, air only), then カッ cut to its burst and the first of its vowel
    (`cak_ms`), sped up (`rate`), loud: the crack 12 dB over the whop."""
    S = K.S("カ")
    wh = whop(K.syl("ブン"), K.syl("ハッ"), "whip/whop", 0.2, voice_db=-99, pitch_off=2.0, pan=(-0.4, 0.2))
    a = S["カ"]["attack"]
    cak = W.resample(W.highpass(a, 900), SR, rate=rate)[: int(cak_ms / 1000 * SR)].copy()
    k = int(0.004 * SR); cak[-k:] *= np.linspace(1, 0, k)
    cak = np.tanh(2.5 * W.norm(cak)) * 1.0
    return place([(0.1, wh * DB(-12)), (0.1 + 0.19, W.center(W.norm(cak)))], 0.6)


def syrinx(n, f0, key, sub=0.0, jitter=0.03, am=None):
    """A bird's source: a buzz at f0 (an array over the samples), its period wandering (`jitter`), every other
    cycle weakened (`sub`: the doubled period that makes a caw harsh), its level rattled (`am`: rate, depth)."""
    r = rng(key + "/src")
    f = f0 * (1 + jitter * (2 * smooth_noise(n, 90, r) - 1))
    ph = np.cumsum(f / SR)
    saw = 2 * (ph % 1) - 1
    if sub: saw *= 1 - sub * (np.floor(ph) % 2)
    if am: saw *= 1 - am[1] * (0.5 + 0.5 * np.sin(2 * np.pi * am[0] * np.arange(n) / SR))
    return lowpass(saw.astype(np.float32), 9000)


def bird_call(K, word, secs, f0_pts, formants, key, sub=0.0, jitter=0.03, am=None, noise=0.2, decay=None):
    """One call: the syrinx along its pitch curve (`f0_pts` [(t, Hz)]), through the bird's resonances (`formants`
    [(Hz or [(t, Hz)], width in octaves)]), the word's breath (its air, held) mixed in as its noise."""
    n = int(secs * SR); t = np.linspace(0, 1, n)
    f0 = np.interp(t, [p[0] for p in f0_pts], [p[1] for p in f0_pts])
    src = syrinx(n, f0, key, sub, jitter, am)
    air = K.syl(word)["air"]
    if noise and len(air) > 64: src = W.norm(src) + W.norm(W.highpass(hold(air, n, key + "/air"), 600)) * noise
    out = np.zeros(n, np.float32)
    for fc, w in formants:
        fcs = np.interp(t, [p[0] for p in fc], [p[1] for p in fc]) if isinstance(fc, list) else np.full(n, float(fc))
        out += W.norm(band(src, fcs, w, 0.0))
    env = np.minimum(1, np.arange(n) / (0.01 * SR)) * (np.exp(-t * decay) if decay else np.minimum(1, (1 - t) / 0.3))
    return W.norm(out * env)


def r8b_crow(K):
    c = lambda k, d: bird_call(K, "カ", 0.3, [(0, 550 + d), (0.3, 610 + d), (1, 470 + d)], [(1400, 0.6), (2600, 0.5)], f"crow8/{k}", sub=0.5, jitter=0.06, noise=0.35)
    return calls([(0, c(0, 0), 0), (0.42, c(1, 15), -1.5), (0.84, c(2, -10), -3)], 1.25)


def r8b_raven(K):
    c = lambda k: bird_call(K, "グワ", 0.3, [(0, 320), (0.3, 360), (1, 260)], [(800, 0.6), (1500, 0.6)], f"raven8/{k}", sub=0.6, jitter=0.05, am=(35, 0.5), noise=0.25)
    return calls([(0, c(0), 0), (0.42, c(1), -2)], 0.8)


def r8b_eagle(K):
    return bird_call(K, "キ", 1.0, [(0, 2600), (0.15, 3200), (0.7, 2800), (1, 2200)], [(3000, 1.0)], "eagle8", jitter=0.04, am=(45, 0.4), noise=0.4)


def r8b_honk(K, k, d=0.0):
    return bird_call(K, "ガ", 0.2, [(0, 480 * 2 ** (d / 12)), (1, 520 * 2 ** (d / 12))], [(1000, 0.35), (2400, 0.4)], f"honk8/{k}", sub=0.2, noise=0.1)


def r8b_goose(K):
    return calls([(0, r8b_honk(K, 0), 0), (0.3, r8b_honk(K, 1, -0.5), -1.5)], 0.6)


def r8b_geese(K):
    r = rng("geese8"); items = []
    for g in range(3):
        for j in range(3):
            items.append((g * 0.13 + j * 0.34 + r.uniform(0, 0.05), r8b_honk(K, g * 3 + j, (g - 1) * 2.5 + r.uniform(-0.5, 0.5)), -3 * g - r.uniform(0, 2)))
    return calls(items, 1.5)


def r8b_duck(K):
    q = lambda k: bird_call(K, "グワ", 0.17, [(0, 380 - 8 * k), (0.3, 420 - 8 * k), (1, 330 - 8 * k)], [([(0, 800), (0.3, 1500), (1, 900)], 0.5), (2500, 0.3)], f"duck8/{k}", sub=0.35, noise=0.15)
    return calls([(0.22 * k, q(k), -2 * k) for k in range(3)], 0.8)


def r8b_chicken(K):
    r = rng("chicken8"); items, t = [], 0.0
    for k in range(5):
        items.append((t, bird_call(K, "コ", 0.06, [(0, 300), (1, 250)], [(800, 0.6), (1800, 0.6)], f"cluck8/{k}", sub=0.2, noise=0.15, decay=6.0), -r.uniform(0, 3)))
        t += r.uniform(0.11, 0.2)
    items.append((t + 0.05, bird_call(K, "ケ", 0.3, [(0, 400), (0.4, 650), (1, 550)], [(1000, 0.6), (2200, 0.6)], "bawk8", sub=0.3, noise=0.2, decay=2.5), 0))
    return calls(items, t + 0.45)


def r8b_rooster(K):
    p = lambda f0s, secs, key: bird_call(K, "コ", secs, f0s, [(1200, 0.7), (2600, 0.6)], key, sub=0.3, jitter=0.04, noise=0.2)
    return calls([(0, p([(0, 500), (1, 540)], 0.12, "roo8/1"), -2), (0.14, p([(0, 600), (1, 640)], 0.12, "roo8/2"), -1), (0.28, p([(0, 700), (1, 720)], 0.14, "roo8/3"), 0),
                  (0.45, p([(0, 750), (0.3, 900), (0.8, 850), (1, 500)], 0.6, "roo8/4"), 0)], 1.15)


# ---------------- round 10: footsteps on each ground; a raindrop ----------------
def crunch(grains, n, ms, key, lp=None, hp=None):
    """A crunch: n of a word's own pops (`_pops`) packed into ms, each at its own rate and level (gravel, snow, leaves)."""
    r = rng(key); out = np.zeros(int((ms / 1000 + 0.06) * SR), np.float32)
    for _ in range(n):
        g = W.resample(grains[r.integers(len(grains))], SR, rate=r.uniform(0.8, 1.6)) * DB(-r.uniform(0, 10))
        i = int(r.uniform(0, ms / 1000) * SR); m = min(len(g), len(out) - i); out[i:i + m] += g[:m]
    if lp: out = lowpass(out, lp)
    if hp: out = W.highpass(out, hp)
    return W.norm(out)


def surface_step(K, word, key, thud_db=-4, crunch=None, scuff=None, wet=False):
    """A footstep on a ground: the heel then the toe 70 ms on, 5 dB softer; each a low soft thud, the ground's own
    sound (`crunch`: (grains word, n, ms, lowpass, highpass, dB); `scuff`: (highpass, lowpass, ms, dB) of the word's air),
    and, `wet`, a small bloop as the foot lifts."""
    S = K.S("ド", word[0]); ev = []
    grains = _pops(K.seed(crunch[0], 1.2)) if crunch else None
    for k, (at, g) in enumerate(((0, 0), (0.07, -5))):
        ev.append((at, tick(S["ド"], 0.07, 0.4, (0, -3), 450, f"{key}/t{k}") * DB(thud_db + g)))
        if crunch:
            ev.append((at + 0.004, crunch_of(grains, crunch, f"{key}/c{k}") * DB(crunch[5] + g)))
        if scuff:
            a = air_from(K.seed(word, 1.3), scuff[0])[: int(scuff[2] / 1000 * SR)].copy()
            a = lowpass(a, scuff[1]) * np.linspace(1, 0, len(a)) ** 1.5
            ev.append((at, W.norm(a) * DB(scuff[3] + g)))
        if wet:
            ev.append((at + 0.05, arch_tick(S[word[0]], 0.04, 1.1, [(0, 0), (1, 8)], 1800, f"{key}/w{k}", 4.0) * DB(-10 + g)))
    return Group(ev, 0.32).mono()


def crunch_of(grains, spec, key):
    _, n, ms, lp, hp, _db = spec
    return crunch(grains, n, ms, key, lp, hp)


def r10_raindrop(K):
    S = K.S("ポ")
    return Group([(0, click(S["ポ"], 4, 1500) * DB(-8)), (0.002, arch_tick(S["ポ"], 0.03, 2.4, [(0, 0), (1, 9)], 5000, "raindrop", 5.0))], 0.08).mono()


# ---------------- the wolf's howl: a held vowel, as the roars are ----------------
def r10_howl(K):
    """A howl as a roar is made (one syllable a vowel, held and layered, one pressure behind it): ウ opening into オ,
    rising into a long held note and falling away, a light rasp, more breath: a wolf's, not a lion's."""
    spec = dict(v1=("u", "ウ"), base=1.0, secs=2.2, share=[(0, 0), (0.15, 0), (0.4, 1), (1, 1)],
                pitch=[(0, -4), (0.2, 4), (0.7, 5), (1, -2)], rasp=0.06, breath=-6)
    S = K.S("ウ", "オ"); S["ア"] = S["オ"]
    return roar(S, K.syl("ハッ"), "howl", spec)


def r10_wings(K, rate=11.0, count=7, key="wings"):
    """Wings: バサッ's air in short flaps (a swell, a stop), at `rate` a second, darkened, wandering left and right."""
    air = air_from(K.seed("バサッ", 1.3), 300); r = rng(key); n = int(0.06 * SR); ev, t = [], 0.0
    for i in range(count):
        f = lowpass(hold(air, n, f"{key}/{i}"), 2600) * W.passby_env(n, 0.55, 1.4, 6.0)
        ev.append((t, W.pan_sweep(W.norm(f) * DB(-r.uniform(0, 4)), *((-0.3, 0.1) if i % 2 else (0.1, -0.3)))))
        t += (1 / rate) * r.uniform(0.9, 1.1)
    return place(ev, t + 0.2)


# ---------------- the builds: one per shelf row the mouth voices with a body ----------------
class Kit:
    """The syllables a build cuts, each once per run (Kokoro renders the same text to the same samples)."""
    def __init__(self, kokoro):
        self.kokoro, self.cache = kokoro, {}

    def syl(self, text):
        if text not in self.cache: self.cache[text] = syllable(self.kokoro, text)
        return self.cache[text]

    def seed(self, text, speed):
        k = ("seed", text, speed)
        if k not in self.cache: self.cache[k] = W.seed(self.kokoro, text, "jm_kumo", speed)
        return self.cache[k]

    def S(self, *texts):
        return {t: self.syl(t) for t in texts}


def _step(K):
    a = air_from(K.seed("サッ", 1.3), 500)[: int(SR * 0.22)]
    a = lowshelf_cut(a, 7000) * env_decay(len(a), 3, 55)
    return W.center(W.fade(W.norm(a), 1, 20))


def _wade(K):
    a = air_from(K.seed("バシャッ", 1.3), 600)
    a = a * env_decay(len(a), 6, 120)
    return W.pan_sweep(W.fade(W.norm(a), 2, 60), -0.3, 0.3)


def _pops(s):
    a = air_from(s, 900)
    e = np.convolve(np.abs(a), np.ones(88) / 88, "same")
    peaks, last, thr = [], -10 ** 9, 0.3 * e.max()
    for i in range(1, len(e) - 1):
        if e[i] > thr and e[i] >= e[i - 1] and e[i] >= e[i + 1] and i - last > int(0.025 * SR):
            peaks.append(i); last = i
    grains = []
    for p in peaks:
        g = a[max(0, p - int(0.002 * SR)): p + int(0.030 * SR)].copy()
        g *= np.exp(-np.linspace(0, 5, len(g))); g[: 44] *= np.linspace(0, 1, min(44, len(g)))
        grains.append(W.norm(g))
    return grains


def _crackle(K):
    return scatter(_pops(K.seed("パチパチ", 1.3)), 2.0)


def _growl(K):
    return animal(K.syl("グ"), K.syl("ハッ"), 2.4, "growl-gu", layers=("throat", "voice", "mouth", "diaphragm"), attack_db=-99)


def _snarl(K):
    return animal(K.syl("ガ"), K.syl("ハッ"), 1.3, "snarl-ga", base=0.85, mouth_hz=(800, 2300), mouth_rate=3.0,
                  push_hz=(3.5, 6.0), breath_db=-7, throat_db=-3, voice_db=-1, lift=3.5, attack_db=-4)


def _roar(name):
    return lambda K: roar(K.S("オ", "ウ", "エ", "イ", "ア"), K.syl("ハッ"), name, ROARS[name])


def _strike(kind, word):
    return lambda K: pad(strike(K.syl(word), K.syl("ハッ"), kind, f"{kind}-word"))


BUILDS = {
    "step-grass": _step,
    "wade": _wade,
    "fire-crackle": _crackle,
    "growl": _growl,
    "snarl": _snarl,
    "roar-lion": _roar("lion-oa"),
    "roar-bear": _roar("bear-ea"),
    "roar-monster": _roar("monster-ia"),
    "punch": _strike("punch", "シュッ"),
    "kick": _strike("kick", "ブン"),
    "staff-swing": _strike("staff", "ヒュン"),
    "staff-twirl": lambda K: twirl(K.syl("ブン"), K.syl("ハッ"), "twirl-air", voice_db=-99),
    "nunchaku": lambda K: nunchaku(K.syl("ヒュン"), K.syl("ハッ"), "nunchaku-word"),
    "sword-guard": lambda K: Split(chaki(K.S("チャ", "キ"))),
    "latch": lambda K: Split(kacha(K.S("カ", "チャ"))),
    "armour-clank": lambda K: Split(gacha(K.S("ガ", "チャ"))),
    "coin-drop": lambda K: Split(coins(K.S("チャ"))),
    "ricochet": lambda K: pad(chun(K.S("チュ"))),
    "spark": lambda K: pad(W.center(pachi(K.S("パ", "チ")))),
    "electric-crackle": lambda K: pad(bachibachi(K.S("チ", "パ"))),
    "drip": lambda K: pad(W.center(picha(K.S("ピ", "チャ")))),
    "scissors": lambda K: Split(chokin(K.S("チョ", "キ"))),
    "ticking": lambda K: Split(kachikachi(K.S("カ", "チ"))),
    # round 7 (trials until the operator passes them by ear)
    "jump-pyon": lambda K: pad(W.center(Group([(0, click(K.syl("ピ"), 6, 2000) * DB(-6)), (0.004, arch_tick(K.syl("ピョ"), 0.16, 1.4, [(0, 0), (1, 9)], 4000, "pyon"))], 0.2).mono())),
    "jump-pyoon": lambda K: pad(W.center(Group([(0, click(K.syl("ピ"), 6, 2000) * DB(-6)), (0.004, arch_tick(K.syl("ピョ"), 0.28, 1.3, [(0, 0), (0.7, 12), (1, 11)], 4000, "pyoon", 4.0))], 0.32).mono())),
    "land-suta": lambda K: pad(W.center(r7_land(K.S("ス", "タ")))),
    "dash-shuta": r7_dash,
    "slide-zuza": lambda K: pad(W.pan_sweep(held_air(K.seed("ズザーッ", 1.0), 0.45, 300, 3500, "slide"), -0.3, 0.3)),
    "hit-bashi": lambda K: pad(W.center(r7_hit(K.S("バ", "シ")))),
    "heavy-hit-doka": lambda K: pad(W.center(r7_heavy_hit(K.S("ド", "カ")))),
    "body-fall-dosa": lambda K: pad(W.center(r7_body_fall(K.S("ド", "サ")))),
    "stab-zubu": lambda K: pad(W.center(r7_stab(K.S("ズ", "ブ")))),
    "sword-draw-shakiin": lambda K: Split(r7_draw(K.S("シャ", "キ"))),
    "sheathe-chakin": lambda K: Split(r7_sheathe(K.S("シャ", "キ"))),
    "clash-gakin": lambda K: Split(r7_clash(K.S("ガ", "キ"))),
    "arrow-thunk-tosu": lambda K: Split(r7_thunk(K.S("ト", "ス"))),
    "shuriken-shushu": r7_shuriken,
    "sparkle-kirakira": lambda K: Split(r7_sparkle(K.S("キ"))),
    "creak-gii": lambda K: pad(W.center(r7_creak(K.S("ギ"), 35, "creak"))),
    "creak-gii-fast": lambda K: pad(W.center(r7_creak(K.S("ギ"), 60, "creak-fast"))),
    "button-kachi": lambda K: Split(r7_button(K.S("カ", "チ"))),
    "lever-gakon": lambda K: Split(r7_lever(K.S("ガ", "コ"))),
    "hiss-shaa": lambda K: pad(W.center(held_air(K.seed("シャーッ", 0.9), 0.9, 2500, 12000, "hiss", 0.1, (45, 0.2)))),
    "squeak-chuu": lambda K: pad(W.center(r7_squeak(K.S("チュ")))),
    "eat-mogumogu": lambda K: pad(W.center(r7_eat(K.S("モ", "グ")))),
    "gulp-goku": lambda K: pad(W.center(r7_gulp(K.S("ゴ", "ク")))),
    # round 7b (trials)
    "power-up-arp": lambda K: Split(r7b_power_arp(K.S("キュ", "キ"))),
    "power-up-chime": lambda K: Split(r7b_power_chime(K.S("キ"))),
    "creak-pulses": lambda K: pad(W.center(r7b_creak_pulses(K.S("ギ")))),
    "creak-squeal": lambda K: pad(W.center(r7b_creak_squeal(K.S("キ")))),
    "bubbles-blip": lambda K: pad(W.center(r7b_bubbles_blip(K.S("ポ")))),
    "bubbles-pops": lambda K: pad(W.center(r7b_bubbles_pops(K))),
    "chirp-piyopiyo": lambda K: pad(W.center(r7b_piyopiyo(K.S("ピ", "ヨ")))),
    "chirp-chunchun": lambda K: pad(W.center(r7b_chunchun(K.S("チュ")))),
    "chirp-pipipi": lambda K: pad(W.center(r7b_pipipi(K.S("ピ")))),
    "whip-pishi": r7b_whip,
    "glass-break-parin": lambda K: Split(r7b_glass(K.S("パ"))),
    "step-wood-kotsu": lambda K: Split(r7b_step_wood(K.S("コ"))),
    "step-metal-kan": lambda K: Split(r7b_step_metal(K.S("カ"))),
    "magic-cast-shuwan": lambda K: Split(r7b_cast(K)),
    # round 7c (passed: the steps)
    "step-wood-heel": lambda K: Split(r7c_step(K.S("ト", "ン"), "ト", "ト", WOOD, 0.9, -16, "stepwood")),
    "step-metal-heel": lambda K: Split(r7c_step(K.S("ガ", "ン"), "ガ", "ガ", STEEL, 0.6, -18, "stepmetal")),
    # round 8b (trials)
    "whip-whop-cak": lambda K: r8b_whip(K),
    "whip-whop-cak-fast": lambda K: r8b_whip(K, rate=2.2, cak_ms=15),
    "crow-syrinx": lambda K: pad(W.center(r8b_crow(K))),
    "raven-syrinx": lambda K: pad(W.center(r8b_raven(K))),
    "eagle-syrinx": lambda K: pad(W.center(r8b_eagle(K))),
    "goose-syrinx": lambda K: pad(W.center(r8b_goose(K))),
    "geese-syrinx": lambda K: pad(W.center(r8b_geese(K))),
    "duck-syrinx": lambda K: pad(W.center(r8b_duck(K))),
    "chicken-syrinx": lambda K: pad(W.center(r8b_chicken(K))),
    "rooster-syrinx": lambda K: pad(W.center(r8b_rooster(K))),
    # round 10 (trials)
    "step-gravel-jari": lambda K: pad(W.center(surface_step(K, "ジャリッ", "gravel", -6, crunch=("ジャリジャリ", 10, 60, 7000, 600, -2), scuff=(1500, 7000, 40, -10)))),
    "step-snow-saku": lambda K: pad(W.center(surface_step(K, "サクッ", "snow", -8, crunch=("サクサク", 12, 90, 4500, 400, -2)))),
    "step-dirt-za": lambda K: pad(W.center(surface_step(K, "ザッ", "dirt", -3, crunch=("ザクザク", 3, 30, 4000, 500, -10), scuff=(400, 3000, 45, -4)))),
    "step-sand-sa": lambda K: pad(W.center(surface_step(K, "サッ", "sand", -10, scuff=(300, 2000, 100, -2)))),
    "step-mud-becha": lambda K: pad(W.center(surface_step(K, "ベチャ", "mud", -2, scuff=(200, 1800, 60, -6), wet=True))),
    "step-puddle-basha": lambda K: pad(W.center(surface_step(K, "バシャッ", "puddle", -6, scuff=(600, 6000, 110, 0)))),
    "step-leaves-gasa": lambda K: pad(W.center(surface_step(K, "ガサッ", "leaves", -8, crunch=("ガサガサ", 14, 120, 9000, 1500, -1), scuff=(1500, 8000, 80, -8)))),
    "raindrop-potsu": lambda K: pad(W.center(r10_raindrop(K))),
    "howl-voice": r10_howl,
    "bat-wings": lambda K: pad(r10_wings(K)),
}
