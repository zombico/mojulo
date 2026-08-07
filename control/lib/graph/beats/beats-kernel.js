/**
 * beats-kernel — the dependency-free synthesized-audio kernel (beats.plan.md).
 *
 * SINGLE SOURCE OF TRUTH, same discipline as physics-sim.js / event-bus.js: the whole
 * kernel lives inside `buildBeatsKernel()`, a self-contained closure referencing nothing
 * outside itself, so the browser (the /beats player page and the /world audio channel)
 * runs the SAME code by emitting `buildBeatsKernel.toString()` into the page. Node
 * imports the live instance for tests (beats-kernel.test.js).
 *
 * Two layers inside, deliberately split:
 *   PURE SCHEDULING — note/time math, the seeded PRNG, per-bar ambient event derivation,
 *     composition flattening (swing-aware: on-grid offbeat sixteenths land late, B5.0),
 *     fx-time resolution (seconds or note fractions like '3/16'), gesture planning.
 *     Pure functions of (recipe, seed, bar):
 *     no Date.now, no Math.random, no audio objects. This is the testable half and the
 *     determinism contract: same recipe + same seed → the same performance, and any bar
 *     is reproducible WITHOUT playing the bars before it (the PRNG is re-seeded per bar
 *     from hash(seed, barIndex), never threaded across bars).
 *   WEBAUDIO REALIZER — voices (osc/noise/membrane/fm + ADSR), effects chains
 *     (filter/delay/pingpong/chorus/reverb — the reverb impulse is COMPUTED from the
 *     seeded PRNG, never sampled), a lookahead transport, gestures, and wind. Only
 *     touches AudioContext APIs at call time, so importing the kernel in Node is safe.
 *
 * Doctrine (beats.plan.md): synthesized, never sampled — no media bytes, no network.
 * Audio is presentation, not simulation: nothing here feeds state back into a world.
 */

export function buildBeatsKernel() {
  // ── seeded PRNG — the only randomness in the substrate's audio ─────────────
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // fold (seed, n) into a fresh 32-bit seed — the per-bar reseed.
  function hashSeed(seed, n) {
    let h = (seed >>> 0) ^ 0x9E3779B9;
    h = Math.imul(h ^ (n >>> 0), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // ── note + time math ────────────────────────────────────────────────────────
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteHz(name) {
    if (typeof name === 'number') return name;
    const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
    if (!m) throw new Error('beats: bad note name "' + name + '" (expected e.g. "A4", "Bb1", "F#3")');
    let semi = SEMI[m[1].toUpperCase()];
    if (m[2] === '#') semi += 1;
    if (m[2] === 'b') semi -= 1;
    const midi = (parseInt(m[3], 10) + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // 'bar:beat:sixteenth' (4/4) → seconds at bpm. Bare numbers are beats.
  function timeToSeconds(t, bpm) {
    const beat = 60 / bpm;
    if (typeof t === 'number') return t * beat;
    const parts = String(t).split(':').map(Number);
    if (parts.some((p) => !isFinite(p))) throw new Error('beats: bad time "' + t + '" (expected "bar:beat:sixteenth")');
    const [bar = 0, b = 0, s = 0] = parts;
    return (bar * 4 + b + s / 4) * beat;
  }
  function barSeconds(bpm) { return (60 / bpm) * 4; }
  // fx time: seconds (number) or a note fraction of a 4/4 whole note at bpm —
  // '3/16' is the dotted-eighth dub delay, in the pocket at ANY tempo (B5.0).
  function fxTimeSeconds(time, bpm, fallback) {
    if (time == null) return fallback;
    if (typeof time === 'number' && isFinite(time)) return time;
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(time).trim());
    if (!m || !Number(m[2])) throw new Error('beats: bad fx time "' + time + '" (seconds, or a note fraction like "3/16")');
    return (Number(m[1]) / Number(m[2])) * (240 / bpm);
  }
  // swing: odd eighth positions land late by swing × (a third of an eighth).
  function swungEighth(i, bpm, swing) {
    const eighth = 60 / bpm / 2;
    return i * eighth + (i % 2 === 1 ? (swing || 0) * eighth * (2 / 3) : 0);
  }
  // tone macro (B5.2): [0,1] → low-pass cutoff, exponential 120Hz → 18kHz.
  // 1 ≈ open (the null position), 0 = rolled all the way down. Pure, so the
  // offline render and the live transport map a stored tone identically.
  function toneFreq(v) {
    return 120 * Math.pow(150, Math.max(0, Math.min(1, v == null ? 1 : v)));
  }

  // ── ambient scheduling: one bar of events, pure in (recipe, barIndex) ───────
  // Returns [{ t, channel, notes, dur, vel }] with t in seconds from bar start.
  // The rng is re-seeded from (recipe.seed, barIndex): bars are independent and
  // the whole performance replays exactly for the same recipe + seed.
  function ambientBarEvents(recipe, barIndex) {
    const bpm = recipe.bpm, swing = recipe.swing || 0;
    const rng = mulberry32(hashSeed(recipe.seed || 1, barIndex));
    const bar = barSeconds(bpm);
    const prog = recipe.progression || [];
    const step = prog.length ? prog[barIndex % prog.length] : null;
    const out = [];
    for (const ch of recipe.channels || []) {
      const role = ch.role;
      if (role === 'harmony' && step) {
        out.push({ t: 0, channel: ch.name, notes: step.chord.slice(), dur: bar, vel: 0.8 });
      } else if (role === 'roots' && step) {
        out.push({ t: 0, channel: ch.name, notes: [step.root], dur: bar * 0.72, vel: 0.9 });
        out.push({ t: timeToSeconds('0:2:2', bpm), channel: ch.name, notes: [step.root], dur: 60 / bpm / 2, vel: 0.6 });
      } else if (role === 'melody' && ch.sequence && Array.isArray(ch.sequence.table) && ch.sequence.table.length) {
        const seq = ch.sequence;
        const table = seq.table;
        const gate = seq.gate == null ? 0.7 : seq.gate;
        // random-walk start point derived from the bar's own rng — bars stay independent.
        let idx = Math.floor(rng() * table.length);
        for (let i = 0; i < 8; i++) {
          const stepDir = rng() < 0.5 ? -1 : 1;               // walk before gating so the
          idx = Math.min(table.length - 1, Math.max(0, idx + stepDir)); // contour survives rests
          const roll = rng();
          const vel = 0.35 + rng() * 0.4;
          if (roll > gate) continue;                           // probability gate = rests
          out.push({ t: swungEighth(i, bpm, swing), channel: ch.name, notes: [table[idx]], dur: 60 / bpm / 4, vel });
        }
      } else if (role === 'pulse' && Array.isArray(ch.steps)) {
        const jitter = ch.dropout == null ? 0 : ch.dropout;    // hat-style humanizing dropout
        for (let i = 0; i < 16; i++) {
          const v = ch.steps[i % ch.steps.length];
          if (!v) continue;
          if (jitter && rng() < jitter) continue;
          const sixteenth = 60 / bpm / 4;
          const t = i * sixteenth + (i % 2 === 1 ? (swing || 0) * sixteenth * (2 / 3) : 0);
          out.push({ t, channel: ch.name, notes: [ch.note || 'C1'], dur: sixteenth, vel: v === true ? 0.9 : v });
        }
      }
    }
    out.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
    return out;
  }

  // ── composition: flatten explicit parts to one sorted event list ────────────
  // Returns { events: [{ t, channel, notes, dur, vel }], duration }.
  // Swing (B5.0): events landing EXACTLY on an offbeat sixteenth are delayed by
  // swing × sixteenth × 2/3 — the same feel model as the pulse channel. Events
  // off the sixteenth grid are the author's own micro-timing and stay put.
  function compositionEvents(recipe) {
    const bpm = recipe.bpm;
    const swing = recipe.swing || 0;
    const sixteenth = 60 / bpm / 4;
    const events = [];
    let end = 0;
    for (const part of recipe.parts || []) {
      for (const ev of part.events || []) {
        const [at, notes, dur, vel] = ev;
        let t = timeToSeconds(at, bpm);
        if (swing) {
          const pos = t / sixteenth;
          const idx = Math.round(pos);
          if (Math.abs(pos - idx) < 1e-6 && idx % 2 === 1) t += swing * sixteenth * (2 / 3);
        }
        const d = dur == null ? 60 / bpm : timeToSeconds(dur, bpm);
        events.push({ t, channel: part.name, notes: Array.isArray(notes) ? notes.slice() : [notes], dur: d, vel: vel == null ? 0.8 : vel });
        if (t + d > end) end = t + d;
      }
    }
    events.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
    return { events, duration: end };
  }

  // ── performance feel: the anti-MIDI layer ───────────────────────────────────
  // Per-note micro-variation derived deterministically from (seed, eventIndex,
  // noteIndex) — so a chord is a strum (notes fanned across `strum` seconds, not
  // fired on one tick) and no two notes are byte-identical (timing/velocity/timbre
  // jitter). Pure and seeded → the whole humanized performance still replays
  // exactly. feel = { strum, strumUp, strumAlternate, jitterTime, jitterVel,
  // jitterTimbre }; all default to 0 (a null feel is a perfectly quantized part).
  function noteFeel(feel, seed, evIndex, noteIndex, noteCount) {
    const f = feel || {};
    const count = noteCount || 1;
    const rng = mulberry32(hashSeed(seed || 1, (((evIndex + 1) * 131 + noteIndex * 17) >>> 0)));
    let up = !!f.strumUp;
    if (f.strumAlternate && evIndex % 2 === 1) up = !up; // down/up alternation
    const dir = up ? (count - 1 - noteIndex) : noteIndex;
    const strum = (f.strum || 0) * dir * (0.8 + rng() * 0.4); // humanized spacing
    const jitterT = (f.jitterTime || 0) * (rng() * 2 - 1);
    const velScale = 1 + (f.jitterVel || 0) * (rng() * 2 - 1);
    const pluck = (f.jitterTimbre || 0) * (rng() * 2 - 1);
    return { timeOffset: strum + jitterT, velScale, pluck };
  }

  // ── pattern: tracks × sixteenth masks → one loop of events (B5.1) ───────────
  // The groove-instrument kind (Night Bus spike). Pure in (recipe): no dice.
  // Each track: mask[i] = velocity (0 = rest, true = 0.9), wrapping if shorter
  // than recipe.steps; notes[i] is an optional per-step contour (wraps too,
  // falls back to track.note) so any active step stays musical. Swing: odd
  // sixteenths land late by swing × sixteenth × 2/3 — the pulse-channel model.
  // Returns { events: [{ t, channel, notes, dur, vel }], duration }; the
  // transport loops the pattern (a pattern has no end by construction).
  // ── harmony bus: derive a chord-following track's notes at a step (B7) ───────
  // A chordVoice track ignores its note contour and instead READS the shared
  // progression's chord for this step, so many instruments follow one chord chart.
  // Modes: chord/strum/block = the whole chord (feel strums it); arp = one note
  // walking up the chord by step; root = the chord's lowest note (basslines).
  function chordVoiceNotes(mode, chord, step) {
    if (!chord || !chord.length) return [];
    if (mode === 'arp') return [chord[step % chord.length]];
    if (mode === 'root') return [chord[0]];
    if (mode === 'upper') return chord.length > 1 ? chord.slice(1) : chord.slice(); // chord minus root — harmony over a separate bass
    return chord.slice(); // 'chord' | 'strum' | 'block' | true
  }

  function patternEvents(recipe) {
    const bpm = recipe.bpm, swing = recipe.swing || 0;
    const sixteenth = 60 / bpm / 4;
    const N = recipe.steps || 32;
    const chords = recipe.chords || {};
    const prog = Array.isArray(recipe.progression) ? recipe.progression : [];
    const events = [];
    for (const tr of recipe.tracks || []) {
      const mask = Array.isArray(tr.mask) ? tr.mask : [];
      if (!mask.length) continue;
      for (let i = 0; i < N; i++) {
        const v = mask[i % mask.length];
        if (!v) continue;
        const t = i * sixteenth + (i % 2 === 1 ? swing * sixteenth * (2 / 3) : 0);
        let notes;
        if (tr.chordVoice && prog.length) {
          // harmony bus: notes come from the shared progression, not tr.notes.
          notes = chordVoiceNotes(tr.chordVoice, chords[prog[i % prog.length]], i);
          if (!notes.length) continue; // no chord assigned here → rest
        } else {
          // a contour entry is one note or an array (a chord — the garage stab).
          const entry = Array.isArray(tr.notes) && tr.notes.length ? tr.notes[i % tr.notes.length] : (tr.note || 'C3');
          notes = Array.isArray(entry) ? entry.slice() : [entry];
        }
        events.push({ t, channel: tr.name, notes, dur: sixteenth, vel: v === true ? 0.9 : v });
      }
    }
    events.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
    return { events, duration: N * sixteenth };
  }

  // ── gestures: the chiptune foley vocabulary (beats.plan.md) ─────────────────
  // A cue is a list of gestures; gesturePlan lowers one gesture to primitive ops
  // [{ at, kind, ... }] — pure, so the foley choreography is unit-testable.
  //   sweep   — pitch ramp: { wave?, from, to, dur?, vol? }
  //   flutter — pitch-table loop at rateHz with tiered table swaps over hold time:
  //             { rateHz?, hold?, tiers: [{ at, table }], wave?, vol?, jitter?, seed? }
  //             jitter (0..1) wobbles each retrigger's timing and pitch (seeded) —
  //             0 is the machine-gun chiptune flutter, ~0.8 is stick-slip (creaks).
  //   burst   — enveloped noise: { decay?, vol?, highpass?, lowpass? }
  //   thump   — pitch-swept sine: { from?, to?, decay?, vol? }
  //   grain   — seeded stochastic noise-grain train (gravel, crackle, rustle, rain):
  //             { grains?, over?, decay? (per-grain, number|[min,max]), band?: {lo,hi},
  //               vol?, spread?, seed? } — lowers to noise ops; same seed, same grit.
  //   ring    — modal strike (glass clink, metal tink, wood knock): { note?|hz?,
  //             material?: glass|metal|wood, partials?: [{ratio,gain,decay}], decay?,
  //             vol? } — lowers to flat thump ops (from == to), one per partial.
  function gesturePlan(gesture) {
    const g = gesture || {};
    if (g.type === 'sweep') {
      return [{ at: g.at || 0, kind: 'sweep', wave: g.wave || 'square', from: noteHz(g.from == null ? 'A5' : g.from), to: noteHz(g.to == null ? 'A4' : g.to), dur: g.dur == null ? 0.09 : g.dur, vol: g.vol == null ? 0.7 : g.vol }];
    }
    if (g.type === 'flutter') {
      const rate = g.rateHz == null ? 30 : g.rateHz;
      const hold = g.hold == null ? 0.5 : g.hold;
      const tiers = Array.isArray(g.tiers) && g.tiers.length ? g.tiers : [{ at: 0, table: ['E4', 'G4', 'A4', 'B4'] }];
      const jitter = g.jitter == null ? 0 : Math.max(0, Math.min(1, g.jitter));
      const rng = jitter ? mulberry32(hashSeed(g.seed == null ? 0xF107 : g.seed, Math.round(rate * 97))) : null;
      const ops = [];
      const n = Math.max(1, Math.round(rate * hold));
      for (let i = 0; i < n; i++) {
        // jitter wobbles timing (up to ±40% of the period) and pitch (up to ±80
        // cents) per retrigger — periodic buzz becomes stick-slip. Seeded: the
        // same creak groans identically every play.
        const at = (g.at || 0) + i / rate + (jitter ? (rng() * 2 - 1) * jitter * 0.4 / rate : 0);
        const nominal = (g.at || 0) + i / rate;
        let table = tiers[0].table;
        for (const tier of tiers) if (nominal - (g.at || 0) >= tier.at) table = tier.table;
        const cents = jitter ? (rng() * 2 - 1) * jitter * 80 : 0;
        const hz = noteHz(table[i % table.length]) * Math.pow(2, cents / 1200);
        ops.push({ at: Math.max(g.at || 0, at), kind: 'tone', wave: g.wave || 'square', hz, dur: 0.025, vol: g.vol == null ? 0.5 : g.vol });
      }
      return ops;
    }
    if (g.type === 'burst') {
      return [{ at: g.at || 0, kind: 'noise', decay: g.decay == null ? 0.15 : g.decay, vol: g.vol == null ? 0.6 : g.vol, highpass: g.highpass || 0, lowpass: g.lowpass || 0 }];
    }
    if (g.type === 'thump') {
      return [{ at: g.at || 0, kind: 'thump', from: noteHz(g.from == null ? 'G2' : g.from), to: noteHz(g.to == null ? 'G1' : g.to), decay: g.decay == null ? 0.25 : g.decay, vol: g.vol == null ? 0.9 : g.vol }];
    }
    if (g.type === 'grain') {
      // A cluster of tiny band-shaped noise grains scattered over `over` seconds —
      // the stochastic texture the hand-authored burst stack can't be (gravel
      // crunch, fire crackle, cloth rustle, rain). Seeded: same seed, same grit.
      const grains = Math.max(1, Math.round(g.grains == null ? 12 : g.grains));
      const over = g.over == null ? 0.25 : g.over;
      const dRange = Array.isArray(g.decay) ? g.decay : [g.decay == null ? 0.012 : g.decay, g.decay == null ? 0.035 : g.decay];
      const band = g.band || {};
      const vol = g.vol == null ? 0.5 : g.vol;
      const spread = g.spread == null ? 0.6 : Math.max(0, Math.min(1, g.spread));
      const rng = mulberry32(hashSeed(g.seed == null ? 0x64A17 : g.seed, grains));
      const ops = [];
      for (let i = 0; i < grains; i++) {
        ops.push({
          at: (g.at || 0) + rng() * over,
          kind: 'noise',
          decay: dRange[0] + rng() * Math.max(0, dRange[1] - dRange[0]),
          vol: vol * (1 - spread * rng()),
          highpass: band.lo || 0,
          lowpass: band.hi || 0,
        });
      }
      ops.sort(function (a, b) { return a.at - b.at; });
      return ops;
    }
    if (g.type === 'ring') {
      // Modal strike: a stack of flat decaying sine partials (thump with
      // from == to) — inharmonic ratios per material, brights dying first,
      // the fundamental singing on. Computed cousin of the modal voice.
      const RING_MATERIALS = {
        glass: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.32, gain: 0.55, decay: 0.55 }, { ratio: 4.25, gain: 0.35, decay: 0.3 }, { ratio: 6.63, gain: 0.2, decay: 0.15 }, { ratio: 9.38, gain: 0.1, decay: 0.08 }],
        metal: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.76, gain: 0.6, decay: 0.8 }, { ratio: 5.4, gain: 0.4, decay: 0.55 }, { ratio: 8.93, gain: 0.25, decay: 0.35 }],
        wood: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.8, gain: 0.5, decay: 0.5 }, { ratio: 5.2, gain: 0.25, decay: 0.25 }],
      };
      const partials = Array.isArray(g.partials) && g.partials.length ? g.partials : RING_MATERIALS[g.material || 'glass'] || RING_MATERIALS.glass;
      const hz = g.hz != null ? g.hz : noteHz(g.note == null ? 'C7' : g.note);
      const decay = g.decay == null ? (g.material === 'wood' ? 0.12 : 0.8) : g.decay;
      const vol = g.vol == null ? 0.5 : g.vol;
      return partials.map(function (p) {
        const f = hz * (p.ratio == null ? 1 : p.ratio);
        return { at: g.at || 0, kind: 'thump', from: f, to: f, decay: decay * (p.decay == null ? 1 : p.decay), vol: vol * (p.gain == null ? 1 : p.gain) };
      });
    }
    throw new Error('beats: unknown gesture type "' + g.type + '" (sweep | flutter | burst | thump | grain | ring)');
  }
  function cuePlan(gestures) {
    const ops = [];
    for (const g of gestures || []) for (const op of gesturePlan(g)) ops.push(op);
    ops.sort((a, b) => a.at - b.at);
    return ops;
  }

  // ── WebAudio realizer ───────────────────────────────────────────────────────
  // createEngine(ctx, opts?) → { master, channelGain, playEvent, playCue, wind,
  // startAmbient, startComposition, stop, setMuted }. Everything routes through
  // one master gain → compressor → destination; opts.analyser taps the master.
  function dbGain(db) { return Math.pow(10, (db || 0) / 20); }
  function createEngine(ctx, opts) {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 6;
    master.connect(comp);
    if (opts && opts.analyser) comp.connect(opts.analyser).connect(ctx.destination);
    else comp.connect(ctx.destination);

    // one shared, seeded noise buffer — computed, never sampled.
    let noiseBuf = null;
    function noiseBuffer() {
      if (noiseBuf) return noiseBuf;
      const rng = mulberry32(0xBEA75);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
      return noiseBuf;
    }
    // Karplus-Strong plucked string — computed, never sampled (the guitar voice).
    // A seeded noise burst fills a delay line one period long; recirculating it
    // through a one-pole averaging (lowpass) loop filter turns the broadband pluck
    // into a decaying harmonic series — high partials die first, the fundamental
    // rings on: the physics of a plucked string, ~20 lines. Params (namespaced so
    // they never collide with the ADSR): pluckDecay = per-period loop loss (ring
    // length), pluckDamping = loop-filter blend (0 bright/steel → 1 dark/nylon),
    // pick = excitation smoothing passes (rounds the attack), maxRing = buffer cap.
    // Deterministic: the burst is seeded from the (rounded) pitch, so a given note
    // plucks identically every time — which also makes the buffer safely cacheable.
    const stringCache = new Map();
    function stringBuffer(hz, patch) {
      const sr = ctx.sampleRate;
      const N = Math.max(2, Math.round(sr / hz));
      const loss = patch.pluckDecay == null ? 0.997 : Math.min(0.9999, patch.pluckDecay);
      const damp = patch.pluckDamping == null ? 0.5 : patch.pluckDamping;
      const pick = patch.pick == null ? 0 : patch.pick;
      const maxRing = patch.maxRing == null ? 3.5 : Math.min(8, patch.maxRing);
      const key = N + '|' + loss + '|' + damp + '|' + pick + '|' + maxRing;
      const hit = stringCache.get(key);
      if (hit) return hit;
      const line = new Float32Array(N);
      const rng = mulberry32(hashSeed(0x6511A4, N));
      for (let i = 0; i < N; i++) line[i] = rng() * 2 - 1;
      // pick smoothing: lowpass the burst — more passes ≈ softer, rounder attack.
      for (let p = 0, passes = Math.round(pick * 6); p < passes; p++) {
        let prev = line[N - 1];
        for (let i = 0; i < N; i++) { const cur = line[i]; line[i] = 0.5 * (cur + prev); prev = cur; }
      }
      const len = Math.floor(sr * maxRing);
      const buf = ctx.createBuffer(1, len, sr);
      const y = buf.getChannelData(0);
      let idx = 0;
      for (let i = 0; i < len; i++) {
        const cur = line[idx];
        y[i] = cur;
        const nxt = (idx + 1) % N;
        // loop lowpass: full averaging (dark) ↔ pass-through (bright) via damp,
        // then per-period loss. Each cell is rewritten once per period as idx laps.
        line[idx] = (damp * 0.5 * (cur + line[nxt]) + (1 - damp) * cur) * loss;
        idx = nxt;
      }
      stringCache.set(key, buf);
      return buf;
    }

    // computed impulse response: seeded noise under an exponential decay.
    function reverbImpulse(decay, seed) {
      const rng = mulberry32(hashSeed(seed || 7, 1));
      const len = Math.max(1, Math.floor(ctx.sampleRate * Math.min(decay || 3, 10)));
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
      return buf;
    }

    // soft-clip transfer curve for the `drive` effect (electric overdrive) —
    // computed, never sampled: the classic k-shaped waveshaper. amount 0→1 goes
    // from clean to fuzzy; k is the drive coefficient fed to a WaveShaperNode.
    function driveCurve(amount) {
      const n = 1024, c = new Float32Array(n);
      const a = Math.max(0, Math.min(0.99, amount == null ? 0.4 : amount));
      const k = (2 * a) / (1 - a);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      return c;
    }

    // asymmetric soft-clip for the `amp` effect: the same k-shape evaluated off
    // center (a bias term = tube stage bias), recentered so y(0) = 0. Asymmetry
    // is what puts even harmonics in the exhaust; the sign alternates per stage.
    function ampCurve(edge, bias) {
      const n = 2048, c = new Float32Array(n);
      const a = Math.max(0.05, Math.min(0.95, edge == null ? 0.55 : edge));
      const k = (2 * a) / (1 - a);
      const b = bias == null ? 0 : Math.max(-0.5, Math.min(0.5, bias));
      const f = (x) => ((1 + k) * x) / (1 + k * Math.abs(x));
      const f0 = f(b);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = f(x + b) - f0;
      }
      return c;
    }

    // effects chain: fx = [{ type: 'filter'|'delay'|'pingpong'|'chorus'|'reverb'|'body'|'drive', ... }]
    // Returns { input, output }; wet/dry mixed per node so chains compose linearly.
    // delay/pingpong `time` accepts note fractions ('3/16') resolved against bpm.
    function buildChain(fx, seed, bpm) {
      const input = ctx.createGain();
      let head = input;
      for (const f of fx || []) {
        const t = f.type;
        if (t === 'filter') {
          const bq = ctx.createBiquadFilter();
          bq.type = f.mode || 'lowpass'; bq.frequency.value = f.freq == null ? 1200 : f.freq; bq.Q.value = f.q == null ? 1 : f.q;
          head.connect(bq); head = bq;
        } else if (t === 'delay' || t === 'pingpong') {
          const time = fxTimeSeconds(f.time, bpm || 120, 0.375);
          const mix = ctx.createGain();
          const dry = ctx.createGain(); dry.gain.value = 1;
          head.connect(dry); dry.connect(mix);
          const dl = ctx.createDelay(2); dl.delayTime.value = Math.min(2, time);
          const fb = ctx.createGain(); fb.gain.value = Math.min(0.9, f.feedback == null ? 0.35 : f.feedback);
          const wet = ctx.createGain(); wet.gain.value = f.mix == null ? 0.35 : f.mix;
          head.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet);
          if (t === 'pingpong') {
            // approximate ping-pong: pan the wet tap and a half-period echo to opposite sides.
            const pl = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            const dl2 = ctx.createDelay(2); dl2.delayTime.value = Math.min(2, time / 2);
            const pr = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            if (pl && pr) {
              pl.pan.value = -0.7; pr.pan.value = 0.7;
              wet.disconnect && wet.disconnect();
              dl.connect(wet); wet.connect(pl); pl.connect(mix);
              dl.connect(dl2); dl2.connect(pr); pr.connect(mix);
            } else { wet.connect(mix); }
          } else {
            wet.connect(mix);
          }
          head = mix;
        } else if (t === 'chorus') {
          const mix = ctx.createGain();
          const dry = ctx.createGain(); head.connect(dry); dry.connect(mix);
          const dl = ctx.createDelay(0.06); dl.delayTime.value = 0.02;
          const lfo = ctx.createOscillator(); lfo.frequency.value = f.rate == null ? 0.6 : f.rate;
          const depth = ctx.createGain(); depth.gain.value = f.depth == null ? 0.004 : f.depth;
          lfo.connect(depth); depth.connect(dl.delayTime); lfo.start();
          const wet = ctx.createGain(); wet.gain.value = f.mix == null ? 0.4 : f.mix;
          head.connect(dl); dl.connect(wet); wet.connect(mix);
          head = mix;
        } else if (t === 'reverb') {
          const mix = ctx.createGain();
          const dry = ctx.createGain(); dry.gain.value = 1 - (f.wet == null ? 0.4 : f.wet) * 0.5;
          head.connect(dry); dry.connect(mix);
          const cv = ctx.createConvolver(); cv.buffer = reverbImpulse(f.decay == null ? 4 : f.decay, seed);
          const wet = ctx.createGain(); wet.gain.value = f.wet == null ? 0.4 : f.wet;
          head.connect(cv); cv.connect(wet); wet.connect(mix);
          head = mix;
        } else if (t === 'body') {
          // acoustic body resonance: parallel bandpass resonators (air / top plate /
          // box) summed UNDER the dry string — the hollow wooden warmth. Linear, so
          // filtering the summed part equals filtering each note (cheaper, identical).
          const mix = ctx.createGain();
          const dry = ctx.createGain(); dry.gain.value = 1; head.connect(dry); dry.connect(mix);
          const wetAmt = f.mix == null ? 0.32 : f.mix;
          const res = f.resonances || [{ freq: 110, q: 8, gain: 1 }, { freq: 200, q: 6, gain: 0.8 }, { freq: 420, q: 4, gain: 0.55 }];
          for (const r of res) {
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
            bp.frequency.value = r.freq == null ? 200 : r.freq; bp.Q.value = r.q == null ? 6 : r.q;
            const g = ctx.createGain(); g.gain.value = wetAmt * (r.gain == null ? 1 : r.gain);
            head.connect(bp); bp.connect(g); g.connect(mix);
          }
          head = mix;
        } else if (t === 'drive') {
          // electric overdrive: push the signal into a computed soft-clip curve, then
          // a "cabinet" low-pass rolls off the fizz. amount 0→1 clean→fuzzy; pre-gain
          // drives the curve, post makeup tames the level so patches keep dB meaning.
          const amount = f.amount == null ? 0.4 : f.amount;
          const pre = ctx.createGain(); pre.gain.value = 1 + amount * 6;
          const ws = ctx.createWaveShaper(); ws.curve = driveCurve(amount); ws.oversample = '4x';
          const post = ctx.createGain(); post.gain.value = f.level == null ? 1 / (1 + amount * 1.8) : dbGain(f.level);
          head.connect(pre); pre.connect(ws); ws.connect(post);
          if (f.tone === null) { head = post; }
          else {
            const cab = ctx.createBiquadFilter(); cab.type = 'lowpass';
            cab.frequency.value = f.tone == null ? 3000 : f.tone; cab.Q.value = f.q == null ? 0.7 : f.q;
            post.connect(cab); head = cab;
          }
        } else if (t === 'amp') {
          // amp voice (B6 spike): `drive` is one polite clip; an amp is gain
          // STAGING. Enough pre-gain that the clip stays saturated for most of the
          // note's life (the envelope decouples from the string — loudness holds,
          // brightness decays), split across cascaded asymmetric stages with
          // shaping between them, into a resonant cabinet (formants, not a lowpass).
          // gain (dB, default 32) is the identity knob; edge = per-stage curve
          // hardness; bias = asymmetry (even harmonics), sign alternating per stage.
          const gainDb = Math.max(0, Math.min(50, f.gain == null ? 32 : f.gain));
          const stages = Math.max(1, Math.min(4, Math.round(f.stages == null ? 3 : f.stages)));
          const bias = f.bias == null ? 0.18 : f.bias;
          // tighten: sub-lows out before any gain (flub becomes indistinct roar),
          // then pre-emphasis: the mids that survive clipping best get boosted
          // going in and carved back out after (the classic distortion voicing).
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85; hp.Q.value = 0.7;
          const emph = ctx.createBiquadFilter(); emph.type = 'peaking'; emph.frequency.value = 780; emph.Q.value = 0.7; emph.gain.value = 5;
          head.connect(hp); hp.connect(emph); head = emph;
          for (let s = 0; s < stages; s++) {
            const pre = ctx.createGain(); pre.gain.value = dbGain(gainDb / stages);
            const ws = ctx.createWaveShaper(); ws.curve = ampCurve(f.edge, (s % 2 ? -1 : 1) * bias); ws.oversample = '4x';
            // dc block (asymmetry pushes signal-dependent offset), then interstage
            // fizz control so each stage clips a shaped signal, not the last one's hash.
            const dc = ctx.createBiquadFilter(); dc.type = 'highpass'; dc.frequency.value = 25; dc.Q.value = 0.5;
            const il = ctx.createBiquadFilter(); il.type = 'lowpass'; il.frequency.value = 6500; il.Q.value = 0.6;
            head.connect(pre); pre.connect(ws); ws.connect(dc); dc.connect(il); head = il;
          }
          const deEmph = ctx.createBiquadFilter(); deEmph.type = 'peaking'; deEmph.frequency.value = 780; deEmph.Q.value = 0.7; deEmph.gain.value = -3;
          // cabinet: a formant bank, not a tone knob — low bump, presence peak,
          // then a steep cliff (two cascaded lowpasses ≈ 24dB/oct) above `cut`.
          const bump = ctx.createBiquadFilter(); bump.type = 'peaking'; bump.frequency.value = 105; bump.Q.value = 1; bump.gain.value = 4.5;
          const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 1.2; pres.gain.value = f.presence == null ? 4 : f.presence;
          const cut = f.cut == null ? 5200 : f.cut;
          const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = cut; lp1.Q.value = 0.8;
          const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = cut; lp2.Q.value = 0.6;
          // makeup: a saturated stage leaves ~unity amplitude regardless of input,
          // so makeup is a fixed level, not a function of gain.
          const post = ctx.createGain(); post.gain.value = dbGain(f.level == null ? -10 : f.level);
          head.connect(deEmph); deEmph.connect(bump); bump.connect(pres); pres.connect(lp1); lp1.connect(lp2); lp2.connect(post); head = post;
        }
      }
      return { input, output: head };
    }

    // ── voices: osc | noise | membrane | fm — one shot, ADSR-shaped ──────────
    function envGain(t, dur, patch, vel) {
      const g = ctx.createGain();
      const a = patch.attack == null ? 0.005 : patch.attack;
      const d = patch.decay == null ? 0.1 : patch.decay;
      const s = patch.sustain == null ? 0.6 : patch.sustain;
      const r = patch.release == null ? 0.2 : patch.release;
      const peak = dbGain(patch.volume) * (vel == null ? 0.8 : vel);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.linearRampToValueAtTime(peak * s, t + a + d);
      g.gain.setValueAtTime(peak * s, Math.max(t + a + d, t + dur));
      g.gain.linearRampToValueAtTime(0.0001, Math.max(t + a + d, t + dur) + r);
      return { node: g, end: Math.max(t + a + d, t + dur) + r + 0.05 };
    }
    function playVoice(patch, hz, t, dur, vel, dest) {
      const out = dest || master;
      const voice = patch.voice || 'osc';
      const { node: env, end } = envGain(t, dur, patch, vel);
      let post = env;
      // per-voice filter; filterEnv sweeps its cutoff from→to over decay (B5.0) —
      // the deep-house/garage stab is a 2200→420Hz sweep, not a static cutoff.
      if (patch.filter || patch.filterEnv) {
        const fl = patch.filter || {};
        const bq = ctx.createBiquadFilter();
        bq.type = fl.mode || 'lowpass';
        bq.Q.value = fl.q == null ? 1 : fl.q;
        if (patch.filterEnv) {
          const fe = patch.filterEnv;
          const from = fe.from == null ? (fl.freq == null ? 2200 : fl.freq) : fe.from;
          bq.frequency.setValueAtTime(Math.max(1, from), t);
          bq.frequency.exponentialRampToValueAtTime(Math.max(1, fe.to == null ? 420 : fe.to), t + (fe.decay == null ? 0.2 : fe.decay));
        } else {
          // velToFilter (B6.2b): velocity → brightness, the piano/keys expressive
          // axis — harder hits open the cutoff, soft hits darken (a pow curve
          // centered on the default vel 0.8, so patches without it and notes at
          // default velocity are byte-identical). k ≈ 1–2; osc/fm/string/modal alike.
          let fq = fl.freq == null ? 1800 : fl.freq;
          if (patch.velToFilter != null) {
            fq = Math.min(ctx.sampleRate * 0.45, Math.max(40, fq * Math.pow((vel == null ? 0.8 : vel) / 0.8, patch.velToFilter)));
          }
          bq.frequency.value = fq;
        }
        env.connect(bq); post = bq;
      }
      post.connect(out);
      // attack-transient layer (B7): a short filtered-noise burst at onset — the
      // PICK / bachi contact click for plucked strings (also bow scratch, breath
      // chiff). Runs PARALLEL to the voice with its own fast envelope, so it's an
      // additive onset, not shaped by the note's ADSR; sent to `out` so the part's
      // body/reverb catch it too (the bachi striking the skin excites the box).
      if (patch.attackNoise) {
        const an = patch.attackNoise;
        const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(); nz.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = an.mode || 'bandpass';
        bp.frequency.value = an.tone == null ? 2400 : an.tone;
        bp.Q.value = an.q == null ? 0.8 : an.q;
        const ng = ctx.createGain();
        const adec = an.decay == null ? 0.02 : an.decay;
        const apk = dbGain(an.level == null ? -12 : an.level) * (vel == null ? 0.8 : vel);
        ng.gain.setValueAtTime(Math.max(0.0001, apk), t);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + adec);
        nz.connect(bp); bp.connect(ng); ng.connect(out);
        nz.start(t); nz.stop(t + adec + 0.02);
      }
      if (voice === 'noise') {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
        src.connect(env); src.start(t); src.stop(end);
      } else if (voice === 'string') {
        // plucked string: play the KS-synthesized buffer once. Its own harmonic
        // decay carries the ring; the ADSR gates onset/note-off (hold sustain ≈ 1,
        // short release) so the string is damped when the note ends — like a hand.
        const src = ctx.createBufferSource(); src.buffer = stringBuffer(hz, patch);
        if (patch.pluckDetune) {
          // dual pluck (amp-voice spike): two strings a few cents apart. Alone the
          // beating is subtle; through a clip stage the difference tones become the
          // growl — a lone harmonic string gives intermodulation nothing to chew.
          const cents = patch.pluckDetune;
          const g1 = ctx.createGain(); g1.gain.value = 0.6;
          const src2 = ctx.createBufferSource(); src2.buffer = stringBuffer(hz * Math.pow(2, -cents / 2400), patch);
          src2.playbackRate.value = Math.pow(2, cents / 1200);
          const g2 = ctx.createGain(); g2.gain.value = 0.6;
          src.connect(g1); g1.connect(env); src2.connect(g2); g2.connect(env);
          src2.start(t); src2.stop(end);
        } else {
          src.connect(env);
        }
        src.start(t); src.stop(end);
      } else if (voice === 'membrane') {
        const osc = ctx.createOscillator(); osc.type = 'sine';
        const oct = patch.octaves == null ? 5 : patch.octaves;
        osc.frequency.setValueAtTime(hz * Math.pow(2, oct * 0.5), t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, hz), t + (patch.pitchDecay == null ? 0.05 : patch.pitchDecay));
        osc.connect(env); osc.start(t); osc.stop(end);
      } else if (voice === 'fm') {
        const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = hz;
        const mod = ctx.createOscillator(); mod.type = 'sine';
        mod.frequency.value = hz * (patch.ratio == null ? 2 : patch.ratio);
        const idx = ctx.createGain(); idx.gain.setValueAtTime(hz * (patch.index == null ? 2 : patch.index), t);
        idx.gain.exponentialRampToValueAtTime(Math.max(0.01, hz * 0.05), t + (patch.modDecay == null ? 0.5 : patch.modDecay));
        mod.connect(idx); idx.connect(car.frequency);
        car.connect(env); mod.start(t); car.start(t); mod.stop(end); car.stop(end);
      } else if (voice === 'modal') {
        // modal synthesis (B6.2): a struck object = a sum of decaying sine partials
        // (its resonant modes). Each partial has its own ratio (freq = hz×ratio),
        // gain, and decay time — higher modes ring shorter, so the strike is bright
        // then warms as it decays. THE voice for tuned struck metal/wood: steelpan,
        // bells, marimba, vibes, gongs. Bypasses the ADSR — each mode's own decay IS
        // the envelope — and rings for its own length regardless of note duration
        // (struck notes ring out; they don't sustain-then-release). Goes to `out` so
        // the part's chain (reverb) and the attackNoise mallet tick sit with it.
        const partials = Array.isArray(patch.partials) && patch.partials.length ? patch.partials : [{ ratio: 1, gain: 1, decay: 1 }];
        const base = dbGain(patch.volume) * (vel == null ? 0.8 : vel);
        const atk = patch.attack == null ? 0.002 : patch.attack;
        const nyq = ctx.sampleRate * 0.5;
        for (const p of partials) {
          const f = hz * (p.ratio == null ? 1 : p.ratio);
          if (f <= 0 || f >= nyq) continue; // skip DC / above Nyquist
          const dec = p.decay == null ? 1 : p.decay;
          const pk = Math.max(0.0001, base * (p.gain == null ? 1 : p.gain));
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(pk, t + atk);       // fast strike (no click)
          g.gain.exponentialRampToValueAtTime(0.0001, t + dec);   // per-mode ring-down
          o.connect(g); g.connect(out);
          o.start(t); o.stop(t + dec + 0.02);
        }
      } else {
        // osc voice; detune/unison (B5.0) spreads N copies across ±detune cents —
        // the supersaw stab. Loudness is normalized by 1/√N so patches keep their
        // dB meaning whether or not they stack.
        const cents = patch.detune || 0;
        const n = Math.max(1, Math.round(patch.unison || (cents ? 2 : 1)));
        const mix = ctx.createGain(); mix.gain.value = 1 / Math.sqrt(n);
        mix.connect(env);
        // vibrato (B7): a sine LFO on each osc's detune (cents) — the pitch wobble
        // that makes a sustained saw read as BOWED (violin/cello). depth ramps in
        // over `delay` so the bow onset is steady before the vibrato blooms.
        let vib = null;
        if (patch.vibrato) {
          const vr = patch.vibrato.rate == null ? 5.5 : patch.vibrato.rate;
          const vd = patch.vibrato.depth == null ? 14 : patch.vibrato.depth;
          const vdel = patch.vibrato.delay == null ? 0.25 : patch.vibrato.delay;
          const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = vr;
          vib = ctx.createGain();
          vib.gain.setValueAtTime(0, t);
          vib.gain.linearRampToValueAtTime(vd, t + vdel);
          lfo.connect(vib); lfo.start(t); lfo.stop(end);
        }
        for (let u = 0; u < n; u++) {
          const osc = ctx.createOscillator(); osc.type = patch.wave || 'sine';
          const spread = n === 1 ? 0 : (u / (n - 1)) * 2 - 1;
          osc.frequency.value = hz * Math.pow(2, (cents * spread) / 1200);
          if (vib) vib.connect(osc.detune);
          osc.connect(mix); osc.start(t); osc.stop(end);
        }
      }
    }

    // gesture ops (cuePlan output) at absolute context time `when`; velScale
    // lets a pattern step's velocity shape a gesture instrument (B5.1).
    function playOps(ops, when, dest, velScale) {
      const out = dest || master;
      const vs = velScale == null ? 1 : velScale;
      for (const op of ops) {
        const t = when + op.at;
        if (op.kind === 'tone') {
          playVoice({ voice: 'osc', wave: op.wave, attack: 0.001, decay: 0.02, sustain: 0.4, release: 0.01, volume: -14 }, op.hz, t, op.dur, op.vol * vs, out);
        } else if (op.kind === 'sweep') {
          const osc = ctx.createOscillator(); osc.type = op.wave;
          osc.frequency.setValueAtTime(op.from, t);
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, op.to), t + op.dur);
          const g = ctx.createGain();
          g.gain.setValueAtTime(dbGain(-10) * op.vol * vs, t);
          g.gain.linearRampToValueAtTime(0.0001, t + op.dur + 0.05);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + op.dur + 0.1);
        } else if (op.kind === 'noise') {
          const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
          const g = ctx.createGain();
          g.gain.setValueAtTime(dbGain(-12) * op.vol * vs, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + op.decay);
          let node = g;
          if (op.highpass) { const bq = ctx.createBiquadFilter(); bq.type = 'highpass'; bq.frequency.value = op.highpass; node.connect(bq); node = bq; }
          if (op.lowpass) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = op.lowpass; node.connect(lp); node = lp; }
          src.connect(g); node.connect(out); src.start(t); src.stop(t + op.decay + 0.05);
        } else if (op.kind === 'thump') {
          const osc = ctx.createOscillator(); osc.type = 'sine';
          osc.frequency.setValueAtTime(op.from, t);
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, op.to), t + op.decay * 0.6);
          const g = ctx.createGain();
          g.gain.setValueAtTime(dbGain(-6) * op.vol * vs, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + op.decay);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + op.decay + 0.05);
        }
      }
    }

    // per-channel gain (mutes) + patch/chain routing, built per recipe.
    const channels = {};
    function channelGain(name) {
      if (!channels[name]) { channels[name] = ctx.createGain(); channels[name].connect(master); }
      return channels[name];
    }

    // ── performance macros (B5.2): transpose + tone per channel ──────────────
    // The two knobs that turn playback into performance (Night Bus finding):
    // transpose (semitones) is applied at SCHEDULE time so it can move mid-
    // performance; tone is a low-pass at the chain HEAD, so fx sends tap after
    // it and delay tails darken with their source. Macros are performance
    // state, not recipe state — setters mutate the live engine and never write
    // back to the manifest (the recipe stays the only author). State survives
    // stop/start (a retuned kick stays retuned); the recipe's own transpose /
    // tone fields seed the initial position on first play.
    const macroState = {};
    function macro(name) {
      if (!macroState[name]) macroState[name] = { transpose: 0, tone: 1, toneNode: null, level: 1 };
      return macroState[name];
    }
    function setTranspose(name, semis) {
      macro(name).transpose = Number.isFinite(semis) ? semis : 0;
    }
    function setTone(name, v) {
      const m = macro(name);
      m.tone = Math.max(0, Math.min(1, v == null ? 1 : v));
      if (m.toneNode) m.toneNode.frequency.setTargetAtTime(toneFreq(m.tone), ctx.currentTime, 0.03);
    }
    function setLevel(name, v) {
      const m = macro(name);
      m.level = Math.max(0, Math.min(1, v == null ? 1 : v));
      channelGain(name).gain.setTargetAtTime(m.level, ctx.currentTime, 0.03);
    }
    // transposed pitch for a channel's note, read at schedule time.
    function chHz(name, note) {
      const semis = macro(name).transpose || 0;
      return noteHz(note) * (semis ? Math.pow(2, semis / 12) : 1);
    }

    // ── transport: lookahead scheduler over pure event derivation ────────────
    // Every 25ms, schedule everything inside the next 120ms window. Ambient
    // derives bars on demand from ambientBarEvents; composition pre-flattens.
    let timer = null;
    function stopTransport() { if (timer) { clearInterval(timer); timer = null; } }
    function startTransport(recipe, patches, mode) {
      stopTransport();
      const chains = {};
      for (const ch of recipe.channels || recipe.parts || recipe.tracks || []) {
        const built = buildChain(ch.chain, recipe.seed, recipe.bpm);
        built.output.connect(channelGain(ch.name));
        // macro seed: the recipe's own transpose/tone set the initial position,
        // but only on FIRST play — a live macro survives stop/start.
        if (!macroState[ch.name]) {
          macroState[ch.name] = { transpose: ch.transpose || 0, tone: ch.tone == null ? 1 : ch.tone, toneNode: null, level: 1 };
        }
        const m = macroState[ch.name];
        // tone macro at the chain head: voices → low-pass → chain, so delay/
        // reverb tails darken with their source. Always present live (so a
        // slider/binding can move any channel); at the open position it sits
        // at 18kHz and is inaudible.
        const tn = ctx.createBiquadFilter();
        tn.type = 'lowpass'; tn.Q.value = 0.5;
        tn.frequency.value = toneFreq(m.tone);
        tn.connect(built.input);
        m.toneNode = tn;
        chains[ch.name] = tn;
      }
      const flat = mode === 'composition' ? compositionEvents(recipe) : null;
      const pat = mode === 'pattern' ? patternEvents(recipe) : null;
      const bar = barSeconds(recipe.bpm);
      const t0 = ctx.currentTime + 0.08;
      let cursor = 0;    // ambient: next bar index; composition: next event index; pattern: next loop index
      timer = setInterval(() => {
        const horizon = ctx.currentTime + 0.12 - t0;
        if (mode === 'pattern') {
          // pattern loops by construction; a track's instrument is a patch OR a
          // gesture/cue (B5.1 move 1 — the foley vocabulary doubles as the drum kit).
          while (cursor * pat.duration <= horizon) {
            pat.events.forEach((ev, ei) => {
              const tr = (recipe.tracks || []).find((c) => c.name === ev.channel);
              const when = t0 + cursor * pat.duration + ev.t;
              if (tr && (tr.cue || tr.gesture)) {
                playOps(cuePlan(tr.cue || [tr.gesture]), when, chains[ev.channel], ev.vel);
              } else {
                const patch = patches[(tr && tr.patch) || 'sinePluck'] || {};
                const feel = tr && tr.feel;
                // per-loop evolving feel: the loop index folds into the seed so the
                // groove humanizes without repeating identically each bar (B6.1).
                ev.notes.forEach((n, ni) => {
                  const fl = noteFeel(feel, recipe.seed, cursor * 1000 + ei, ni, ev.notes.length);
                  const p = fl.pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + fl.pluck)) }) : patch;
                  playVoice(p, chHz(ev.channel, n), when + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel]);
                });
              }
            });
            cursor += 1;
          }
          return;
        }
        if (mode === 'composition') {
          while (cursor < flat.events.length && flat.events[cursor].t <= horizon) {
            const evIndex = cursor;
            const ev = flat.events[cursor++];
            const part = (recipe.parts || []).find((p) => p.name === ev.channel);
            const patch = patches[(part && part.patch) || 'sinePluck'] || {};
            const feel = (part && part.feel) || recipe.feel;
            ev.notes.forEach((n, ni) => {
              const fl = noteFeel(feel, recipe.seed, evIndex, ni, ev.notes.length);
              // pluck jitter nudges the excitation brightness per note (pluck-position drift)
              const p = fl.pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + fl.pluck)) }) : patch;
              playVoice(p, chHz(ev.channel, n), t0 + ev.t + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel]);
            });
          }
          if (cursor >= flat.events.length && !recipe.loop) stopTransport();
          return;
        }
        while (cursor * bar <= horizon) {
          const events = ambientBarEvents(recipe, cursor);
          events.forEach((ev, ei) => {
            const ch = (recipe.channels || []).find((c) => c.name === ev.channel);
            const patch = patches[(ch && ch.patch) || 'sinePluck'] || {};
            // B6: channels carry feel too (an `instrument` channel expands to one at
            // normalize time) — the bar index folds into the seed like pattern mode,
            // so the humanization evolves per bar yet replays identically. A channel
            // with no feel gets offset 0 / velScale 1: the pre-B6 path, unchanged.
            const feel = ch && ch.feel;
            ev.notes.forEach((n, ni) => {
              const fl = noteFeel(feel, recipe.seed, cursor * 1000 + ei, ni, ev.notes.length);
              const p = fl.pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + fl.pluck)) }) : patch;
              playVoice(p, chHz(ev.channel, n), t0 + cursor * bar + ev.t + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel]);
            });
          });
          cursor += 1;
        }
      }, 25);
    }

    // ── wind/ambience: filtered seeded noise, two incommensurate LFO drifts ──
    function wind(params) {
      const p = params || {};
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
      const bq = ctx.createBiquadFilter(); bq.type = 'bandpass';
      bq.frequency.value = p.freq == null ? 320 : p.freq; bq.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = dbGain(p.level == null ? -30 : p.level);
      const lfo1 = ctx.createOscillator(); lfo1.frequency.value = 0.11;
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.043;
      const d1 = ctx.createGain(); d1.gain.value = g.gain.value * 0.5;
      const d2 = ctx.createGain(); d2.gain.value = bq.frequency.value * 0.35;
      lfo1.connect(d1); d1.connect(g.gain);
      lfo2.connect(d2); d2.connect(bq.frequency);
      src.connect(bq); bq.connect(g); g.connect(master);
      src.start(); lfo1.start(); lfo2.start();
      return { stop() { try { src.stop(); lfo1.stop(); lfo2.stop(); } catch (e) { /* already stopped */ } } };
    }

    return {
      master,
      channelGain,
      buildChain,
      playVoice,
      playCue(gestures, when, dest, velScale) { playOps(cuePlan(gestures), when == null ? ctx.currentTime : when, dest, velScale); },
      startAmbient(recipe, patches) { startTransport(recipe, patches, 'ambient'); },
      startComposition(recipe, patches) { startTransport(recipe, patches, 'composition'); },
      startPattern(recipe, patches) { startTransport(recipe, patches, 'pattern'); },
      stop: stopTransport,
      wind,
      setMuted(m) { master.gain.value = m ? 0 : 0.9; },
      setTranspose,
      setTone,
      setLevel,
      getMacro(name) { const m = macro(name); return { transpose: m.transpose, tone: m.tone, level: m.level }; },
    };
  }

  return {
    mulberry32,
    hashSeed,
    noteHz,
    timeToSeconds,
    barSeconds,
    fxTimeSeconds,
    swungEighth,
    toneFreq,
    ambientBarEvents,
    compositionEvents,
    noteFeel,
    chordVoiceNotes,
    patternEvents,
    gesturePlan,
    cuePlan,
    createEngine,
  };
}
