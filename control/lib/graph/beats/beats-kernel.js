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

import { buildBeatsKernel as buildBeatsKernel21 } from './beats-kernel-2.1.js';

// ── feature-sliced emission (audio fidelity) ──────────────────────────────────
// Pages pay only for what their recipe uses. Every post-2.1 change inside the
// closure below sits in a region tagged with the feature it belongs to:
//   /*@<feature>{*/ …new lines… /*| …the 2.1 lines… @*/
// Node runs the closure as written: the markers are comments, so every feature
// is live and the 2.1 lines sit inert inside a comment. A page embeds
// emitBeatsKernel(features): each region keeps its new lines when its feature
// is on and its 2.1 lines when it is off. Features:
//   x       shared helpers (long noise buffer, panner); implied by the rest
//   voice   patchParams, per-note keys, vary/width/curve, keyTrack, breath,
//           drift, vibrato spread, glide, fixed pitch, modal wave/filter, kits
//   strings the tuned Karplus-Strong loop (tune / ringT60 / stiffness)
//   mix     pan, the shared room + sends, master limiter, reverb room2
//   sfx     gesture additions (tone, materials, excite, filterEnv, mass/size,
//           burst band) and per-hit cue variants
// Orchestra and era synthesis added six more (their hooks sit inside voice
// or mix regions, see below):
//   ev      per-event patch overrides (an event's `pp`) and the per-note
//           gain lane they ride on — what the next four lower to
//   score   meter, tempo map, phrases + form, object events, dynamics and
//           hairpins lowered to plain events
//   orch    articulations, woodwind/harp/mallet/timpani voice clauses,
//           players, desk, a4 tuning
//   perc    velMap, choke, clap bursts, piece drive, noise-excited modal
//           pieces, drummer feel, the kit room and bus
//   va      pulse/PWM, harmonic tables, supersaw, sub, patch LFOs, ladder
//           filters, 4-op FM, pattern accent/slide/ratchet/prob
//   fx      the era rack: phaser, flanger, bbd chorus, tape, autopan, crush,
//           ringmod, drive models, dub delay, gated/reverse reverb, vocoder,
//           and the scheduled gate/duck/stutter transforms
// Regions nest: a region inside another region's new lines is resolved
// first (innermost out), so a hook for a newer feature can sit inside an
// older feature's lines. A nested feature implies its host (IMPLIES).
// beats-features.js decides which a recipe needs. With none, the page gets the
// frozen 2.1 function (beats-kernel-2.1.js), not a slice of this one: a bundler
// may transform the code it serializes, and only real code goes through the
// same transform a 2.1 page's did. A slice is syntax-checked once; if a
// transform disturbed the markers (a minifier drops comments), the page gets
// this whole function, whose markers are inert.
export const BEATS_KERNEL_FEATURES = ['x', 'voice', 'strings', 'mix', 'sfx', 'ev', 'score', 'orch', 'perc', 'va', 'fx'];
export const IMPLIES = { ev: ['voice'], score: ['voice', 'ev'], orch: ['voice'], perc: ['voice', 'ev'], va: ['voice', 'ev'], fx: ['voice', 'ev', 'mix'] };
// an innermost region: no region marker inside either half.
const REGION = /\/\*@(\w+)\{\*\/\n((?:(?!\/\*@)[\s\S])*?)\/\*\|\n((?:(?!\/\*@)[\s\S])*?)@\*\/\n/g;
export function sliceKernelText(text, keep) {
  for (let prev = null; prev !== text;) { prev = text; text = text.replace(REGION, (m, f, nu, old) => (keep(f) ? nu : old)); }
  return text;
}
const emitted = new Map();
export function emitBeatsKernel(features) {
  const on = new Set((features || []).filter((f) => BEATS_KERNEL_FEATURES.includes(f)));
  if (!on.size) return buildBeatsKernel21.toString();
  on.add('x');
  for (const f of [...on]) for (const g of IMPLIES[f] || []) on.add(g);
  const key = BEATS_KERNEL_FEATURES.filter((f) => on.has(f)).join(',');
  if (!emitted.has(key)) {
    const whole = buildBeatsKernel.toString();
    let text = sliceKernelText(whole, (f) => on.has(f));
    try { new Function('return (' + text + ')'); } catch (e) { text = whole; }
    emitted.set(key, text);
  }
  return emitted.get(key);
}

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
/*@score{*/
    if (scored(recipe)) return scoreEvents(recipe);
/*|
@*/
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
/*@fx{*/
    fxPass(events, recipe, recipe.parts, 0);
/*|
@*/
    events.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
/*@perc{*/
    return percPass({ events, duration: end }, recipe, recipe.parts, 0);
/*|
    return { events, duration: end };
@*/
  }

/*@score{*/
  // ── score substrate (orchestra and era): meter, tempo map, phrases + form,
  // object events, dynamics and hairpins, lowered to plain events. Pure in
  // (recipe): the transport and the export read the same score. Addresses
  // stay 'bar:beat:sixteenth' with the beat a quarter note; a meter only sets
  // a bar's length in quarters (3/4 = 3, 6/8 = 3, 7/8 = 3.5). bpm is quarters.
  const DYN = { ppp: 0.18, pp: 0.28, p: 0.4, mp: 0.52, mf: 0.64, f: 0.76, ff: 0.88, fff: 1 };
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function scored(r) {
    return !!(r && (r.meter || r.meters || r.tempo || r.phrases || (r.parts || []).some((p) => p.form || p.dynamics || (p.events || []).some((e) => !Array.isArray(e) || e.length > 4))));
  }
  function meterQ(m) { const r = /^(\d+)\/(\d+)$/.exec(String(m || '4/4')); return r ? (4 * r[1]) / r[2] : 4; }
  // the clock: an address → a quarter position (the meter map), a quarter
  // position → seconds (the tempo map, integrated: a linear or exponential
  // ramp arrives at its point's bpm, a point without ramp is a step).
  function scoreClock(recipe) {
    const bpm = recipe.bpm, beat = 60 / bpm;
    const meters = (recipe.meters || []).slice().sort((a, b) => a.at - b.at);
    const m0 = meterQ(recipe.meter);
    function bar(n) { // [quarter position of bar n, its length]
      let q = 0, b = 0, len = m0;
      for (const m of meters) { if (m.at > n) break; q += (m.at - b) * len; b = m.at; len = meterQ(m.meter); }
      return [q + (n - b) * len, len];
    }
    function parse(at) {
      const p = String(at).split(':').map(Number);
      if (p.some((x) => !isFinite(x))) throw new Error('beats: bad time "' + at + '" (expected "bar:beat:sixteenth")');
      return p;
    }
    function q(at) { if (typeof at === 'number') return at; const [n = 0, b = 0, s = 0] = parse(at); return bar(n)[0] + b + s / 4; }
    // a length: bars count in the meter at `from` (a quarter position).
    function len(d, from, len0) {
      if (typeof d === 'number') return d;
      const [n = 0, b = 0, s = 0] = parse(d);
      let L = len0;
      if (L == null) { L = m0; for (const m of meters) if (bar(m.at)[0] <= from) L = meterQ(m.meter); }
      return n * L + b + s / 4;
    }
    const pts = (recipe.tempo || []).map((p) => ({ q: q(p.at), bpm: p.bpm, ramp: p.ramp })).sort((a, b) => a.q - b.q);
    const seg = [];
    let cq = 0, cb = bpm, cs = 0;
    const within = (g, x) => {
      const d = x - g.q0;
      if (!g.ramp || g.b0 === g.b1) return d * (60 / g.b0);
      const L = g.q1 - g.q0;
      if (g.ramp === 'exp') { const r = Math.log(g.b1 / g.b0) / L; return (60 / g.b0) * (1 - Math.exp(-r * d)) / r; }
      const k = (g.b1 - g.b0) / L;
      return (60 / k) * Math.log(1 + (k * d) / g.b0);
    };
    for (const p of pts) {
      if (p.q > cq) { const g = { q0: cq, q1: p.q, b0: cb, b1: p.ramp ? p.bpm : cb, ramp: p.ramp, s0: cs }; seg.push(g); cs += within(g, p.q); }
      cq = Math.max(cq, p.q); cb = p.bpm;
    }
    seg.push({ q0: cq, q1: Infinity, b0: cb, b1: cb, s0: cs });
    const at = (x) => { let i = seg.length - 1; while (i > 0 && x < seg[i].q0) i--; return seg[i]; };
    const sec = (x) => { const g = at(x); return g.s0 + within(g, x); };
    const bpmAt = (x) => { const g = at(x); if (!g.ramp || g.b0 === g.b1) return g.b0; const u = (x - g.q0) / (g.q1 - g.q0); return g.ramp === 'exp' ? g.b0 * Math.pow(g.b1 / g.b0, u) : g.b0 + (g.b1 - g.b0) * u; };
    // the bar lines in seconds (a meter/tempo gate reads these).
    const barTimes = (n) => Array.from({ length: n }, (_, i) => sec(bar(i)[0]));
    return { q, len, sec, bpmAt, bar, barTimes, tempo: pts.length > 0, beat };
  }
  function midiOf(n) { return typeof n === 'number' ? 69 + 12 * Math.log2(n / 440) : Math.round(12 * Math.log2(noteHz(n) / 440)) + 69; }
  function nameOf(m) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
  function shiftNote(n, semis, pivot) {
    if (typeof n === 'number') { const x = pivot == null ? n : (pivot * pivot) / n; return semis ? x * Math.pow(2, semis / 12) : x; }
    const m = midiOf(n);
    if (pivot == null && !semis) return n;
    return nameOf((pivot == null ? m : 2 * pivot - m) + (semis || 0));
  }
  // one event (tuple or object) → { at, notes, dur, vel, art, dyn }.
  function readEvent(ev) {
    if (Array.isArray(ev)) return { at: ev[0], notes: ev[1], dur: ev[2], vel: ev[3], art: ev[4] };
    return { at: ev.at, notes: ev.n, dur: ev.d, vel: ev.v, art: ev.art, dyn: ev.dyn };
  }
  // a part's events in quarters: its own events, then each form entry's phrase
  // (transposed, inverted about its first note, retrograde, velocity-scaled).
  function partQuarters(part, recipe, clock) {
    const out = [];
    const push = (e, q0, dq, extra) => out.push(Object.assign({ q: q0, dq: dq, notes: Array.isArray(e.notes) ? e.notes.slice() : [e.notes], vel: e.dyn ? DYN[e.dyn] : e.vel == null ? 0.8 : e.vel, art: e.art, dyn: e.dyn }, extra));
    for (const ev of part.events || []) { const e = readEvent(ev); const q0 = clock.q(e.at); push(e, q0, e.dur == null ? 1 : clock.len(e.dur, q0)); }
    for (const f of part.form || []) {
      const ph = (recipe.phrases || {})[f.phrase] || [];
      const base = clock.q(f.at), L = clock.len('1:0:0', base);
      const evs = ph.map(readEvent).map((e) => ({ e: e, rq: typeof e.at === 'number' ? e.at : clock.len(e.at, 0, L) }));
      evs.forEach((x) => { x.dq = x.e.dur == null ? 1 : clock.len(x.e.dur, 0, L); });
      const span = evs.reduce((m, x) => Math.max(m, x.rq + x.dq), 0);
      const first = evs.length ? [].concat(evs[0].e.notes)[0] : null;
      const pivot = f.invert && first != null ? (typeof first === 'number' ? first : midiOf(first)) : null;
      for (const x of evs) {
        const notes = [].concat(x.e.notes).map((n) => shiftNote(n, f.transpose || 0, pivot));
        const rq = f.retro ? span - (x.rq + x.dq) : x.rq;
        const v = (x.e.dyn ? DYN[x.e.dyn] : x.e.vel == null ? 0.8 : x.e.vel) * (f.vel == null ? 1 : f.vel);
        push(Object.assign({}, x.e, { notes: notes, vel: Math.min(1, v), dyn: x.e.dyn }), base + rq, x.dq);
      }
    }
    return out;
  }
  // part.dynamics: [{ at, to, over?, from? }] — a level lane (marks and
  // hairpins). A note without its own `dyn` plays at lane × (vel / 0.8); a
  // note that sustains through a hairpin also gets a gain lane (`amp`).
  function dynamicsLane(part, clock) {
    const L = (part.dynamics || []).map((d) => { const qs = clock.q(d.at); return { qs: qs, qe: qs + (d.over == null ? 0 : clock.len(d.over, qs)), from: d.from, to: d.to }; }).sort((a, b) => a.qs - b.qs);
    const lv = (x) => (typeof x === 'string' ? DYN[x] : x);
    let prev = DYN.mf;
    for (const d of L) { d.a = d.from == null ? prev : lv(d.from); d.b = lv(d.to); prev = d.b; }
    return function level(x) {
      let v = null;
      for (const d of L) {
        if (x < d.qs) break;
        v = x >= d.qe ? d.b : d.a + (d.b - d.a) * ((x - d.qs) / (d.qe - d.qs));
      }
      return v;
    };
  }
/*@orch{*/
  // ── articulations (orchestra and era): an event's `art` lowers here to patch
  // overrides (pp), a per-note gain lane (pp.amp), a pitch path, or several
  // events — all pure, seeded per (recipe seed, part, event). A string or
  // { type, …params }. An articulation's lane replaces a hairpin's on its note.
  const STRINGS = /^(violin|viola|cello|contrabass|erhu)/, BRASS = /^(trumpet|frenchHorn|trombone|tuba)/;
  const STRUCK = /^(harp|piano|guitar|celesta|glockenspiel|xylophone|marimba|vibraphone|harpsichord|musicBox|steelpan|clav)/;
  const PIZZ = { voice: 'string', tune: 'exact', ringT60: [0.55, 0.22], pluckDamping: 0.5, pick: 0.35, attack: 0.002, decay: 0.05, sustain: 1, release: 0.1, curve: 'exp', breath: null, attackNoise: { level: -26, decay: 0.006, tone: 1800, q: 0.7 } };
  const LEGNO = { voice: 'modal', attack: 0.001, breath: null, filterEnv: null, partials: [{ ratio: 1, gain: 1, decay: 0.1 }, { ratio: 2.32, gain: 0.5, decay: 0.05 }, { ratio: 4.1, gain: 0.3, decay: 0.025 }], attackNoise: { level: -12, decay: 0.01, tone: 2800, q: 0.7 } };
  const artOf = (a) => (typeof a === 'string' ? { type: a } : a);
  function articulate(evs, part, recipe) {
    if (!evs.some((e) => e.art)) return evs;
    const pn = String(part.patch || '');
    const seed = hashSeed(recipe.seed || 1, [...String(part.name)].reduce((h, c) => hashSeed(h, c.charCodeAt(0)), 0xA47));
    const ordered = evs.slice().sort((a, b) => a.t - b.t);
    const out = [];
    const shape = (e, pts) => { e.pp = Object.assign({}, e.pp, { amp: pts }); };
    ordered.forEach((e, i) => {
      if (!e.art) { out.push(e); return; }
      const a = artOf(e.art), ty = a.type, next = ordered[i + 1], prev = ordered[i - 1];
      const rng = mulberry32(hashSeed(seed, i + 1));
      const retrig = (rate, pp, alt) => {
        const n = Math.max(1, Math.floor(e.dur * rate)), step = e.dur / n;
        for (let k = 0; k < n; k++) {
          const notes = alt && k % 2 ? alt : e.notes;
          const jt = k ? (rng() * 2 - 1) * 0.12 * step : 0;
          out.push({ t: e.t + k * step + jt, channel: e.channel, notes: notes, dur: step * 0.92, vel: Math.min(1, e.vel * (k % 2 ? 0.86 : 1) * (1 + (rng() * 2 - 1) * 0.06)), pp: Object.assign({}, e.pp, pp) });
        }
      };
      if (ty === 'staccato') { e.dur *= 0.45; e.pp = Object.assign({}, e.pp, { release: 0.07 }); }
      else if (ty === 'staccatissimo') { e.dur *= 0.25; e.vel = Math.min(1, e.vel * 1.05); e.pp = Object.assign({}, e.pp, { release: 0.04 }); }
      else if (ty === 'tenuto') { if (next && next.t > e.t) e.dur = Math.max(e.dur, next.t - e.t); e.vel = Math.min(1, e.vel * 1.05); }
      else if (ty === 'marcato' || ty === 'accent') { e.vel = Math.min(1, e.vel * 1.15); shape(e, [[0, 1.3], [0.12, 0.78]]); }
      else if (ty === 'sfz') { e.vel = Math.min(1, e.vel * 1.3); shape(e, [[0, 1.45], [0.2, 0.5]]); }
      else if (ty === 'fp') { e.vel = Math.max(e.vel, 0.85); shape(e, [[0, 1], [0.1, 0.28]]); }
      else if (ty === 'swell') { shape(e, [[0, 0.3], [e.dur / 2, 1.25], [e.dur, 0.3]]); }
      else if (ty === 'pizz') { e.pp = Object.assign({}, e.pp, PIZZ); }
      else if (ty === 'col-legno') { e.pp = Object.assign({}, e.pp, LEGNO); e.dur = Math.min(e.dur, 0.2); }
      else if (ty === 'mute') { e.pp = Object.assign({}, e.pp, { mute: BRASS.test(pn) ? 'brass' : 'strings' }); }
      else if (ty === 'flutter-tongue') { e.pp = Object.assign({}, e.pp, { tremolo: { rate: a.rate || 24, depth: 0.75 }, breath: { level: -20, tone: 2200, q: 0.8 } }); }
      else if (ty === 'trem' && a.mode === 'lfo') { e.pp = Object.assign({}, e.pp, { tremolo: { rate: a.rate || 14, depth: 0.85 } }); }
      else if (ty === 'trem' || ty === 'roll') {
        // bowed tremolo / a roll: seeded retriggers (rate ±, alternate strokes softer).
        const rate = (a.rate || (ty === 'roll' ? 18 : 14)) * (1 + (rng() * 2 - 1) * 0.05);
        retrig(rate, { attack: 0.006, release: ty === 'roll' ? 0.2 : 0.03 });
        // cresc: the strokes swell from the first to the last (a snare roll's crescendo).
        if (a.cresc) { const k0 = out.length - Math.max(1, Math.floor(e.dur * rate)), n = out.length - k0; for (let k = 0; k < n; k++) out[k0 + k].vel = Math.min(1, out[k0 + k].vel * (1 + (a.cresc - 1) * (n > 1 ? k / (n - 1) : 1))); }
        return;
      }
      else if (ty === 'trill') {
        const iv = a.interval == null ? 2 : a.interval;
        retrig(a.rate || 12, { attack: 0.006, release: 0.03 }, e.notes.map((n) => shiftNote(n, iv)));
        return;
      }
      else if (ty === 'port') {
        if (prev) e.pp = Object.assign({}, e.pp, { bend: [noteHz(prev.notes[prev.notes.length - 1]) / noteHz(e.notes[0]), 1, 0, a.time || 0.12] });
      }
      else if (ty === 'gliss') {
        const to = a.to != null ? a.to : next ? next.notes[0] : shiftNote(e.notes[0], 12);
        if (STRUCK.test(pn) || a.run) {
          // a plucked/struck gliss is a run: every scale step between, ringing.
          const sc = a.scale || [0, 2, 4, 5, 7, 9, 11], m0 = midiOf(e.notes[0]), m1 = midiOf(to), dir = m1 >= m0 ? 1 : -1;
          const steps = [];
          for (let m = Math.round(m0); dir > 0 ? m < m1 : m > m1; m += dir) if (m === Math.round(m0) || sc.indexOf(((m % 12) + 12) % 12) >= 0) steps.push(m);
          steps.forEach((m, k) => out.push({ t: e.t + (k * e.dur) / steps.length, channel: e.channel, notes: [nameOf(m)], dur: e.dur - (k * e.dur) / steps.length, vel: e.vel * (0.85 + 0.15 * rng()), pp: e.pp }));
          return;
        }
        e.pp = Object.assign({}, e.pp, { bend: [1, noteHz(to) / noteHz(e.notes[0]), 0, e.dur] });
      }
      else if (ty === 'legato') {
        // a run of legato notes (single-note events) is ONE note with a pitch
        // path: no retrigger, no envelope dip — the row's glide or 60 ms per step.
        const run = [e];
        while (ordered[i + run.length] && artOf(ordered[i + run.length].art || {}).type === 'legato' && e.notes.length === 1) run.push(ordered[i + run.length]);
        if (run.length > 1) {
          const last = run[run.length - 1], g = part.glide || 0.06, f0 = noteHz(e.notes[0]);
          const path = run.map((x) => [x.t - e.t, noteHz(x.notes[0]) / f0]);
          e.dur = last.t + last.dur - e.t;
          e.pp = Object.assign({}, e.pp, { path: path, pathGlide: g });
          for (const x of run.slice(1)) x.art = '__merged';
        } else if (next && next.t > e.t) e.dur = Math.max(e.dur, next.t - e.t + 0.03);
      }
      else if (ty === '__merged') return;
      out.push(e);
    });
    return out;
  }
/*|
@*/
  function scoreEvents(recipe) {
    const clock = scoreClock(recipe);
    const bpm = recipe.bpm, swing = recipe.swing || 0, sixteenth = 60 / bpm / 4;
    const events = [];
    let end = 0;
    for (const part of recipe.parts || []) {
      const level = part.dynamics ? dynamicsLane(part, clock) : null;
      let evs = [];
      for (const e of partQuarters(part, recipe, clock)) {
        let t = clock.sec(e.q);
        if (swing) {
          if (!clock.tempo) { const pos = t / sixteenth, idx = Math.round(pos); if (Math.abs(pos - idx) < 1e-6 && idx % 2 === 1) t += swing * sixteenth * (2 / 3); }
          else { const pos = e.q * 4, idx = Math.round(pos); if (Math.abs(pos - idx) < 1e-6 && idx % 2 === 1) t += swing * (60 / clock.bpmAt(e.q) / 4) * (2 / 3); }
        }
        const d = clock.tempo ? clock.sec(e.q + e.dq) - clock.sec(e.q) : e.dq * clock.beat;
        const ev = { t: t, channel: part.name, notes: e.notes, dur: d, vel: e.vel };
        const lv = level && !e.dyn ? level(e.q) : null;
        if (lv != null) {
          ev.vel = Math.min(1, lv * (e.vel / 0.8));
          const lEnd = level(e.q + e.dq);
          if (lEnd != null && Math.abs(lEnd - lv) > 1e-6) {
            // the level moves under a held note: a gain lane from 1 at the onset.
            const pts = [[0, 1]];
            for (let k = 1; k <= 4; k++) { const x = e.q + (e.dq * k) / 4; pts.push([clock.sec(x) - clock.sec(e.q), Math.max(0.02, level(x) / lv)]); }
            ev.pp = { amp: pts };
          }
        }
        if (e.art) ev.art = e.art;
        evs.push(ev);
      }
/*@orch{*/
      evs = articulate(evs, part, recipe);
/*|
@*/
      for (const ev of evs) {
        delete ev.art;
        events.push(ev);
        if (ev.t + ev.dur > end) end = ev.t + ev.dur;
      }
    }
/*@fx{*/
    fxPass(events, recipe, recipe.parts, 0);
/*|
@*/
    events.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
/*@perc{*/
    return percPass({ events, duration: end }, recipe, recipe.parts, 0);
/*|
    return { events, duration: end };
@*/
  }
/*|
@*/
/*@fx{*/
  // ── scheduled transforms (orchestra and era, the era rack): pure over a
  // row's events once their times are known. stutter [{ at, len, repeats }]
  // (a manifest-wide list or a row's) repeats a slice and drops what the
  // repeats cover; a row's `gate` { mask: levels per sixteenth, smooth?,
  // depth? } and `duck` { by: row, depth? dB, attack?, release? } become
  // per-note gain lanes (pp.amp, multiplied into any hairpin/articulation
  // lane) — the trance gate and the sidechain pump, aligned by construction.
  function laneAt(L, x) {
    if (x <= L[0][0]) return L[0][1];
    for (let i = 1; i < L.length; i++) if (x <= L[i][0]) return L[i - 1][1] + (L[i][1] - L[i - 1][1]) * ((x - L[i - 1][0]) / (L[i][0] - L[i - 1][0] || 1));
    return L[L.length - 1][1];
  }
  function mulLane(A, B) {
    if (!A) return B;
    if (!B) return A;
    const xs = [...new Set(A.map((p) => p[0]).concat(B.map((p) => p[0])))].sort((a, b) => a - b);
    return xs.map((x) => [x, laneAt(A, x) * laneAt(B, x)]);
  }
  function gateLane(G, t, span, six) {
    const m = G.mask || [1, 0], sm = G.smooth == null ? 0.004 : G.smooth, d = G.depth == null ? 1 : G.depth;
    const lv = (k) => { const v = m[((k % m.length) + m.length) % m.length]; return 1 - d * (1 - (v === true ? 1 : v === false ? 0 : v)); };
    const k0 = Math.floor(t / six + 1e-9), out = [[0, lv(k0)]];
    for (let k = k0 + 1; k * six < t + span; k++) {
      const rel = k * six - t;
      if (lv(k) === lv(k - 1)) continue;
      if (rel > out[out.length - 1][0] + 1e-6) out.push([rel, lv(k - 1)]);
      out.push([rel + sm, lv(k)]);
    }
    return out;
  }
  function duckLane(D, onsets, t, span) {
    const a = D.attack == null ? 0.001 : D.attack, r = D.release == null ? 0.18 : D.release, g = Math.pow(10, -(D.depth == null ? 9 : D.depth) / 20);
    const v = (x) => { let m = 1; for (const o of onsets) { const u = x - o; if (u >= 0 && u < a + r) m = Math.min(m, u < a ? 1 - (1 - g) * (u / a) : g + (1 - g) * ((u - a) / r)); } return m; };
    const xs = [0, span];
    for (const o of onsets) if (o > t - a - r && o < t + span) for (const x of [o - t, o + a - t, o + a + r - t]) if (x > 0 && x < span) xs.push(x);
    return [...new Set(xs)].sort((p, q) => p - q).map((x) => [x, v(t + x)]);
  }
  function fxPass(events, recipe, rows, loop) {
    const six = 60 / recipe.bpm / 4, list = rows || [];
    if (!recipe.stutter && !list.some((r) => r && (r.stutter || r.gate || r.duck))) return;
    for (const r of list) {
      if (!r) continue;
      for (const st of [].concat(recipe.stutter || [], r.stutter || [])) {
        const A = timeToSeconds(st.at, recipe.bpm), L = timeToSeconds(st.len, recipe.bpm), n = Math.max(2, st.repeats || 4);
        const slice = events.filter((e) => e.channel === r.name && e.t >= A - 1e-9 && e.t < A + L - 1e-9);
        for (let k = events.length - 1; k >= 0; k--) { const e = events[k]; if (e.channel === r.name && e.t >= A + L - 1e-9 && e.t < A + L * n - 1e-9) events.splice(k, 1); }
        for (let q = 1; q < n; q++) for (const e of slice) events.push(Object.assign({}, e, { t: e.t + q * L, dur: Math.min(e.dur, L) }));
      }
    }
    for (const r of list) {
      if (!r || !(r.gate || r.duck)) continue;
      let onsets = null;
      if (r.duck) {
        onsets = [...new Set(events.filter((e) => e.channel === r.duck.by).map((e) => e.t))];
        if (loop) onsets = onsets.concat(onsets.map((o) => o - loop), onsets.map((o) => o + loop));
      }
      for (const e of events) {
        if (e.channel !== r.name) continue;
        const span = e.dur + (r.gate && r.gate.tail != null ? r.gate.tail : 1.5);
        const lane = mulLane(r.gate ? gateLane(r.gate, e.t, span, six) : null, onsets ? duckLane(r.duck, onsets, e.t, span) : null);
        e.pp = Object.assign({}, e.pp, { amp: e.pp && e.pp.amp ? mulLane(e.pp.amp, lane) : lane });
      }
    }
    events.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
  }
/*|
@*/
/*@va{*/
  // ── step fields (orchestra and era, the acid line): per-track masks beside
  // `mask`, wrapping like it. accent (0/1 or a level) deepens the filter sweep
  // and lifts the level — consecutive accents stack; slide holds a step into
  // the row's next note with a 60 ms glide (one note, no retrigger); ratchet
  // (n) retriggers inside the step; prob (0..1) keeps the step on a seeded
  // coin per loop (stepKeep, the same in the transport and the export).
  function stepFields(events, recipe, six, N) {
    for (const tr of recipe.tracks || []) {
      if (!tr || !(tr.accent || tr.slide || tr.ratchet || tr.prob != null)) continue;
      const at = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);
      const mine = events.filter((e) => e.channel === tr.name);
      let run = 0;
      mine.forEach(function (e) {
        const i = Math.round(e.t / six) % N, acc = at(tr.accent, i), p = at(tr.prob, i), r = at(tr.ratchet, i);
        if (acc) { run++; e.pp = Object.assign({}, e.pp, { accent: Math.min(2, (acc === true ? 1 : acc) * (1 + 0.5 * (run - 1))) }); e.vel = Math.min(1, e.vel * 1.2); } else run = 0;
        if (p != null && p < 1) e.prob = p;
        if (r > 1) { const d = e.dur / r; e.dur = d * 0.9; for (let q = 1; q < r; q++) events.push(Object.assign({}, e, { t: e.t + q * d, vel: e.vel * (1 - 0.08 * q) })); }
      });
      if (!tr.slide) continue;
      for (let k = 0; k < mine.length - 1; k++) {
        const e = mine[k];
        if (!at(tr.slide, Math.round(e.t / six) % N) || e.gone) continue;
        const f0 = noteHz(e.notes[0]), path = [[0, 1]];
        let j = k;
        while (j < mine.length - 1 && at(tr.slide, Math.round(mine[j].t / six) % N)) { const nx = mine[j + 1]; path.push([nx.t - e.t, noteHz(nx.notes[0]) / f0]); nx.gone = true; j++; }
        e.dur = mine[j].t + mine[j].dur - e.t;
        e.pp = Object.assign({}, e.pp, { path: path, pathGlide: 0.06 });
      }
      for (let k = events.length - 1; k >= 0; k--) if (events[k].gone) events.splice(k, 1);
    }
  }
  function stepKeep(seed, loop, ei, p) { return mulberry32(hashSeed(hashSeed(seed || 1, loop + 0x5EB), ei))() < p; }
/*|
@*/
/*@perc{*/
  // ── the drummer and the choke (orchestra and era, percussion): a pure pass
  // over a row's events once their times are known. A row whose feel has
  // `laid` ({ midi: seconds late }), `accent` ({ notes, pattern: vel scale per
  // sixteenth of the beat }) or `flam` ({ notes, gap, vel }: a grace hit
  // before) is split to one note per event and shifted/scaled; a row with
  // `choke` ({ midi: group }) cuts each grouped note at the next onset of its
  // group on that row (pp.cut, seconds) — a loop wraps to its next pass. Such
  // rows split chords to one note per event, so a cut lands on its note alone.
  function percPass(res, recipe, rows, loop) {
    const byName = {};
    for (const r of rows || []) if (r && (r.choke || (r.feel && (r.feel.laid || r.feel.accent || r.feel.flam)))) byName[r.name] = r;
    if (!Object.keys(byName).length) return res;
    const six = 60 / recipe.bpm / 4;
    const midi = (n) => Math.round(12 * Math.log2(noteHz(n) / 440)) + 69;
    let out = [];
    for (const ev of res.events) {
      const r = byName[ev.channel];
      if (!r) { out.push(ev); continue; }
      const f = r.feel || {};
      const split = ev.notes.length > 1 ? ev.notes.map((n) => Object.assign({}, ev, { notes: [n] })) : [ev];
      for (const e of split) {
        const m = midi(e.notes[0]);
        if (f.laid && f.laid[m]) e.t += f.laid[m];
        if (f.accent && f.accent.notes.indexOf(m) >= 0) e.vel = Math.min(1, e.vel * f.accent.pattern[Math.round(ev.t / six) % f.accent.pattern.length]);
        if (f.flam && f.flam.notes.indexOf(m) >= 0) out.push(Object.assign({}, e, { t: Math.max(0, e.t - (f.flam.gap || 0.018)), vel: e.vel * (f.flam.vel || 0.45) }));
        out.push(e);
      }
    }
    out.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
    for (const name in byName) {
      const ch = byName[name].choke;
      if (!ch) continue;
      const mine = out.filter((e) => e.channel === name && ch[midi(e.notes[0])] != null);
      mine.forEach((e, i) => {
        const g = ch[midi(e.notes[0])];
        let nx = null;
        for (let k = i + 1; k < mine.length && nx == null; k++) if (ch[midi(mine[k].notes[0])] === g && mine[k].t > e.t) nx = mine[k].t;
        if (nx == null && loop) for (let k = 0; k < mine.length && nx == null; k++) if (ch[midi(mine[k].notes[0])] === g) nx = mine[k].t + loop;
        if (nx != null) Object.assign(e, { pp: Object.assign({}, e.pp, { cut: nx - e.t }) });
      });
    }
    return { events: out, duration: res.duration };
  }
/*|
@*/
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
/*@voice{*/
  // per-note key: a seed for the opt-in per-hit variation (noise offset, drift,
  // vibrato spread), folded from (seed, channel, relative onset, pitch) so the
  // live transport and the offline export derive the same key for the same note.
  function noteKey(seed, channel, rel, hz) {
    let h = hashSeed(hashSeed(seed || 1, Math.round(rel * 1e4)), Math.round(hz * 16));
    const s = String(channel == null ? '' : channel);
    for (let i = 0; i < s.length; i++) h = hashSeed(h, s.charCodeAt(i));
    return h;
  }
  // glide: each event's previous note on its own row, in schedule order — pure,
  // so the transport and the export slide from the same pitch. wrap seeds every
  // row with its last note (a looping pattern's second pass onward).
  function glideNotes(events, wrap) {
    const last = {};
    if (wrap) for (const ev of events) last[ev.channel] = ev.notes[ev.notes.length - 1];
    return events.map(function (ev) {
      const p = last[ev.channel];
      last[ev.channel] = ev.notes[ev.notes.length - 1];
      return p == null ? null : p;
    });
  }
  // a note's patch: the row's named shelf entry — or, for a kit patch
  // ({ kit: { <midi>: patchName } }, the drum kit), the piece its note selects
  // (null = unmapped, the note is skipped) — with the row's `patchParams`
  // merged over it (a copy — the shelf is never mutated). Absent params and
  // no kit → the shelf object itself, the pre-fidelity path.
  function resolvePatch(patches, row, note) {
    let p = patches[(row && row.patch) || 'sinePluck'] || {};
    if (p.kit) {
      p = patches[p.kit[Math.round(12 * Math.log2(noteHz(note) / 440)) + 69]];
      if (!p) return null;
    }
    return row && row.patchParams ? Object.assign({}, p, row.patchParams) : p;
  }
/*|
@*/

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
/*@va{*/
    stepFields(events, recipe, sixteenth, N);
/*|
@*/
/*@fx{*/
    fxPass(events, recipe, recipe.tracks, N * sixteenth);
/*|
@*/
    events.sort((a, b) => a.t - b.t || (a.channel < b.channel ? -1 : 1));
/*@perc{*/
    return percPass({ events, duration: N * sixteenth }, recipe, recipe.tracks, N * sixteenth);
/*|
    return { events, duration: N * sixteenth };
@*/
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
/*@sfx{*/
      const op = { at: g.at || 0, kind: 'noise', decay: g.decay == null ? 0.15 : g.decay, vol: g.vol == null ? 0.6 : g.vol, highpass: g.highpass || 0, lowpass: g.lowpass || 0 };
      if (g.bandpass) { op.bandpass = g.bandpass; op.q = g.q || 1; } // opt-in band (a snare's wires)
      // filterEnv (opt-in): a lowpass sweeping from→to — the explosion darkening as it decays.
      if (g.filterEnv) op.sweep = { from: g.filterEnv.from == null ? 8000 : g.filterEnv.from, to: g.filterEnv.to == null ? 300 : g.filterEnv.to, decay: g.filterEnv.decay == null ? op.decay : g.filterEnv.decay };
      return [op];
/*|
      return [{ at: g.at || 0, kind: 'noise', decay: g.decay == null ? 0.15 : g.decay, vol: g.vol == null ? 0.6 : g.vol, highpass: g.highpass || 0, lowpass: g.lowpass || 0 }];
@*/
    }
    if (g.type === 'thump') {
/*@sfx{*/
      // mass (kg, opt-in) sets whatever from/to/decay leave out: heavier is
      // lower and longer (pitch ∝ mass^−1/3, the size of a same-density body).
      const base = g.mass ? 110 * Math.pow(1 / g.mass, 1 / 3) : 0;
      return [{ at: g.at || 0, kind: 'thump', from: g.from == null && base ? base * 2 : noteHz(g.from == null ? 'G2' : g.from), to: g.to == null && base ? Math.max(30, base * 0.55) : noteHz(g.to == null ? 'G1' : g.to), decay: g.decay == null ? (base ? Math.max(0.05, Math.min(1.2, 0.1 * Math.cbrt(g.mass))) : 0.25) : g.decay, vol: g.vol == null ? 0.9 : g.vol }];
    }
    if (g.type === 'tone') {
      // a held voice (audio fidelity): beams, hums, engines, machinery — a
      // sustained osc with an optional slow bend (`to`), tremolo and vibrato.
      const from = g.hz != null ? g.hz : noteHz(g.note == null ? 'A3' : g.note);
      return [{ at: g.at || 0, kind: 'hum', wave: g.wave || 'sawtooth', from: from, to: g.to == null ? from : noteHz(g.to), dur: g.dur == null ? 1 : g.dur, attack: g.attack == null ? 0.05 : g.attack, release: g.release == null ? 0.2 : g.release, vol: g.vol == null ? 0.5 : g.vol, tremolo: g.tremolo || null, vibrato: g.vibrato || null, lowpass: g.lowpass || 0 }];
/*|
      return [{ at: g.at || 0, kind: 'thump', from: noteHz(g.from == null ? 'G2' : g.from), to: noteHz(g.to == null ? 'G1' : g.to), decay: g.decay == null ? 0.25 : g.decay, vol: g.vol == null ? 0.9 : g.vol }];
@*/
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
/*@sfx{*/
      const P = (r, gn, d) => r.map(function (x, i) { return { ratio: x, gain: gn[i], decay: d[i] }; });
/*|
@*/
      const RING_MATERIALS = {
        glass: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.32, gain: 0.55, decay: 0.55 }, { ratio: 4.25, gain: 0.35, decay: 0.3 }, { ratio: 6.63, gain: 0.2, decay: 0.15 }, { ratio: 9.38, gain: 0.1, decay: 0.08 }],
        metal: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.76, gain: 0.6, decay: 0.8 }, { ratio: 5.4, gain: 0.4, decay: 0.55 }, { ratio: 8.93, gain: 0.25, decay: 0.35 }],
        wood: [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.8, gain: 0.5, decay: 0.5 }, { ratio: 5.2, gain: 0.25, decay: 0.25 }],
/*@sfx{*/
        // dense sets (audio fidelity): { partials, note, decay, wave?, highpass? }.
        // cymbal = the 808's six squares at inharmonic ratios, highpassed;
        // plate = free square-plate modes; bell = hum/prime/tierce/quint/nominal.
        cymbal: { note: 'C6', decay: 1.2, wave: 'square', highpass: 2500, partials: P([1, 1.4827, 1.8003, 2.546, 2.6303, 3.8967], [0.5, 0.45, 0.45, 0.4, 0.4, 0.35], [1, 0.9, 0.85, 0.8, 0.75, 0.7]) },
        plate: { note: 'A4', decay: 1.5, partials: P([1, 1.47, 1.81, 2.61, 3.13, 3.87, 4.73, 5.9], [1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2], [1, 0.85, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2]) },
        bell: { note: 'C5', decay: 3, partials: P([0.5, 1, 1.2, 1.5, 2, 2.5, 2.67, 3, 4], [0.5, 0.8, 0.6, 0.3, 0.7, 0.25, 0.2, 0.25, 0.15], [1, 0.75, 0.6, 0.4, 0.5, 0.3, 0.25, 0.2, 0.15]) },
/*|
@*/
      };
/*@sfx{*/
      const M = RING_MATERIALS[g.material || 'glass'] || RING_MATERIALS.glass;
      const mat = Array.isArray(M) ? {} : M;
      const partials = Array.isArray(g.partials) && g.partials.length ? g.partials : mat.partials || M;
      // size (metres, opt-in): pitch from the material's constant, hz = K / size.
      const K = { glass: 63, metal: 105, wood: 80, cymbal: 420, plate: 132, bell: 157 };
      const hz = g.hz != null ? g.hz : g.note == null && g.size ? (K[g.material || 'glass'] || 63) / g.size : noteHz(g.note == null ? mat.note || 'C7' : g.note);
      const decay = g.decay == null ? (g.material === 'wood' ? 0.12 : mat.decay || 0.8) : g.decay;
/*|
      const partials = Array.isArray(g.partials) && g.partials.length ? g.partials : RING_MATERIALS[g.material || 'glass'] || RING_MATERIALS.glass;
      const hz = g.hz != null ? g.hz : noteHz(g.note == null ? 'C7' : g.note);
      const decay = g.decay == null ? (g.material === 'wood' ? 0.12 : 0.8) : g.decay;
@*/
      const vol = g.vol == null ? 0.5 : g.vol;
/*@sfx{*/
      const wave = g.wave || mat.wave, hp = g.highpass == null ? mat.highpass : g.highpass;
/*|
@*/
      return partials.map(function (p) {
        const f = hz * (p.ratio == null ? 1 : p.ratio);
/*@sfx{*/
        const d = decay * (p.decay == null ? 1 : p.decay), v = vol * (p.gain == null ? 1 : p.gain);
        // excite:'noise' — a resonator bank struck by noise: each mode is band
        // noise at its frequency (level-matched to a sine mode of the same vol).
        if (g.excite === 'noise') {
          const q = g.q || 30;
          return { at: g.at || 0, kind: 'noise', decay: d, vol: v * 2.45 * Math.sqrt(q * 22050 / f), highpass: 0, lowpass: 0, bandpass: f, q: q };
        }
        const op = { at: g.at || 0, kind: 'thump', from: f, to: f, decay: d, vol: v };
        if (wave) op.wave = wave;
        if (hp) op.highpass = hp;
        return op;
/*|
        return { at: g.at || 0, kind: 'thump', from: f, to: f, decay: decay * (p.decay == null ? 1 : p.decay), vol: vol * (p.gain == null ? 1 : p.gain) };
@*/
      });
    }
/*@sfx{*/
    throw new Error('beats: unknown gesture type "' + g.type + '" (sweep | flutter | burst | thump | grain | ring | tone)');
/*|
    throw new Error('beats: unknown gesture type "' + g.type + '" (sweep | flutter | burst | thump | grain | ring)');
@*/
  }
/*@sfx{*/
  // variant (opt-in, a positive integer — a hit counter): folds into every
  // gesture's seed and nudges each gesture by a seeded ±15 cents / ±10 %
  // decay, and noise ops enter the long buffer at a per-hit offset. Variant 0
  // or absent is the plain path, op for op.
  function cuePlan(gestures, variant) {
/*|
  function cuePlan(gestures) {
@*/
    const ops = [];
/*@sfx{*/
    (gestures || []).forEach(function (g, gi) {
      if (!variant) { for (const op of gesturePlan(g)) ops.push(op); return; }
      const rng = mulberry32(hashSeed(variant >>> 0, 0x5EED + gi));
      const pf = Math.pow(2, (rng() * 2 - 1) * 15 / 1200), df = 1 + (rng() * 2 - 1) * 0.1;
      for (const o of gesturePlan(Object.assign({}, g, { seed: hashSeed(g.seed == null ? 0x64A17 : g.seed, variant >>> 0) }))) {
        const op = Object.assign({}, o);
        for (const k of ['hz', 'from', 'to', 'bandpass']) if (op[k]) op[k] *= pf;
        for (const k of ['decay', 'dur']) if (op[k]) op[k] *= df;
        if (op.kind === 'noise') op.offset = rng();
        ops.push(op);
      }
    });
/*|
    for (const g of gestures || []) for (const op of gesturePlan(g)) ops.push(op);
@*/
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
/*@x{*/
    // the opt-in variation buffer: 4.37 s (no short period under a long bed),
    // entered at a per-hit offset so no two noise hits share a waveform. The
    // 1 s buffer above stays for every recipe that doesn't ask for this.
    let noiseBuf2 = null;
    function longNoise() {
      if (noiseBuf2) return noiseBuf2;
      const rng = mulberry32(0xBEA76);
      noiseBuf2 = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 4.37), ctx.sampleRate);
      const d = noiseBuf2.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
      return noiseBuf2;
    }
    // start a looping noise source: the shared 1 s buffer at offset 0, or (u in
    // [0,1) given) the long buffer entered at u of its length.
    function noiseSrc(t, u) {
      const src = ctx.createBufferSource(); src.loop = true;
      if (u == null) { src.buffer = noiseBuffer(); src.start(t); }
      else { src.buffer = longNoise(); src.start(t, u * src.buffer.duration); }
      return src;
    }
    function unit(k) { return mulberry32(k)(); }
/*|
@*/
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
/*@strings{*/
      if (patch.tune === 'exact' || patch.ringT60 != null || patch.stiffness) return tunedString(hz, patch);
/*|
@*/
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

/*@strings{*/
    // the tuned string (opt-in: tune:'exact' | ringT60 | stiffness). The loop
    // above rounds the period to whole samples and its averaging filter shortens
    // it further, so upper notes run sharp (+10..+42 cents). Here the loop is
    // line(L) → lowpass → [stiffness allpasses] → fractional-delay allpass, with
    // L and the allpass coefficient solved so the loop's phase delay at the
    // fundamental is exactly sr/hz (Jaffe-Smith). ringT60 = seconds to −60 dB
    // (a number, or [at C2, at C7] log-interpolated by pitch) replaces the
    // per-period pluckDecay; maxRing defaults to 1.1 × T60 (≤ 8 s) and the
    // buffer end fades over 30 ms so a cap never cuts a live string. stiffness
    // (0..1) adds dispersion: upper partials run sharp, the piano's stretch.
    function tunedString(hz, patch) {
      const sr = ctx.sampleRate, D = sr / hz, w = 2 * Math.PI * hz / sr;
      const damp = patch.pluckDamping == null ? 0.5 : patch.pluckDamping;
      const pick = patch.pick == null ? 0 : patch.pick;
      const a = 1 - damp / 2, b = damp / 2;
      const apDelay = (c) => (Math.atan2(Math.sin(w), c + Math.cos(w)) - Math.atan2(c * Math.sin(w), 1 + c * Math.cos(w))) / w;
      const dLp = Math.atan2(b * Math.sin(w), a + b * Math.cos(w)) / w;
      // stiffness → up to 8 negative-coefficient allpasses, stronger in the
      // bass (a first-order allpass disperses little at low digital freqs).
      const cs = -Math.max(0, Math.min(1, patch.stiffness || 0)) * (0.5 + 0.4 * Math.max(0, Math.min(1, Math.log2(880 / hz) / 3)));
      let K = cs ? 8 : 0;
      while (K && D - dLp - K * apDelay(cs) < 3) K--;
      const rest = D - dLp - K * (K ? apDelay(cs) : 0);
      const L = Math.max(2, Math.floor(rest - 0.1));
      const fr = rest - L;
      const C = Math.sin(w * (1 - fr) / 2) / Math.sin(w * (1 + fr) / 2);
      const rt = patch.ringT60;
      const T = Array.isArray(rt) ? rt[0] * Math.pow(rt[1] / rt[0], Math.max(0, Math.min(1, Math.log2(hz / 65.41) / 5))) : rt;
      const loss = T ? Math.min(0.99999, Math.pow(10, -3 / (hz * T)) / Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(w)))
        : (patch.pluckDecay == null ? 0.997 : Math.min(0.9999, patch.pluckDecay));
      const maxRing = Math.min(8, patch.maxRing != null ? patch.maxRing : T ? T * 1.1 : 3.5);
      const key = 'x' + hz + '|' + damp + '|' + pick + '|' + loss + '|' + maxRing + '|' + cs;
      const hit = stringCache.get(key);
      if (hit) return hit;
      const line = new Float32Array(L);
      const rng = mulberry32(hashSeed(0x6511A4, L));
      for (let i = 0; i < L; i++) line[i] = rng() * 2 - 1;
      for (let p = 0, passes = Math.round(pick * 6); p < passes; p++) {
        let prev = line[L - 1];
        for (let i = 0; i < L; i++) { const cur = line[i]; line[i] = 0.5 * (cur + prev); prev = cur; }
      }
      // no DC in the burst: the loop filter passes DC at unity, so a DC offset
      // would outlive the tuned ring.
      let mean = 0;
      for (let i = 0; i < L; i++) mean += line[i] / L;
      for (let i = 0; i < L; i++) line[i] -= mean;
      const len = Math.floor(sr * maxRing);
      const buf = ctx.createBuffer(1, len, sr);
      const y = buf.getChannelData(0);
      const sx = new Float64Array(K), sy = new Float64Array(K);
      let idx = 0, prev = 0, fx = 0, fy = 0;
      for (let i = 0; i < len; i++) {
        const u = line[idx];
        y[i] = u;
        let v = a * u + b * prev; prev = u;
        for (let k = 0; k < K; k++) { const o = cs * v + sx[k] - cs * sy[k]; sx[k] = v; sy[k] = o; v = o; }
        const f = C * v + fx - C * fy; fx = v; fy = f;
        line[idx] = f * loss;
        idx = idx + 1 === L ? 0 : idx + 1;
      }
      const nf = Math.min(len, Math.round(sr * 0.03));
      for (let j = 0; j < nf; j++) y[len - nf + j] *= 1 - (j + 1) / nf;
      stringCache.set(key, buf);
      return buf;
    }

/*|
@*/
    // computed impulse response: seeded noise under an exponential decay.
    function reverbImpulse(decay, seed) {
      const rng = mulberry32(hashSeed(seed || 7, 1));
      const len = Math.max(1, Math.floor(ctx.sampleRate * Math.min(decay || 3, 10)));
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, 2.5);
/*@mix{*/
      }
      return buf;
    }

    // room2 impulse (opt-in: reverb model 'room2', or the shared `room`):
    // pre-delay, seeded early-reflection taps, then noise under a −60 dB-at-
    // `decay` envelope through a one-pole lowpass whose cutoff falls over the
    // tail (damp 0..1: how fast the highs die first). L/R from independent
    // seeds. The convolver normalizes IR power, as for the classic impulse.
    function roomImpulse(r, seed) {
      const sr = ctx.sampleRate, T = Math.min(r.decay == null ? 2 : r.decay, 10);
      const pre = Math.round(sr * (r.predelay == null ? 0.015 : r.predelay));
      const fLo = 9000 * Math.pow(10, -2 * (r.damp == null ? 0.5 : r.damp));
      const len = pre + Math.max(1, Math.floor(sr * T));
      const buf = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const rng = mulberry32(hashSeed(seed || 7, 11 + c));
        const d = buf.getChannelData(c);
        for (let k = 0; k < 8; k++) {
          const at = pre + Math.floor(sr * (0.002 + rng() * 0.045));
          if (at < len) d[at] += (0.7 - k * 0.06) * (rng() < 0.5 ? -1 : 1);
        }
        let lp = 0, lp2 = 0;
        for (let i = 0; i < len - pre; i++) {
          const u = i / sr / T, k = 1 - Math.exp(-2 * Math.PI * 9000 * Math.pow(fLo / 9000, Math.sqrt(u)) / sr);
          lp += k * ((rng() * 2 - 1) - lp); lp2 += k * (lp - lp2); // two poles: 12 dB/oct
          d[pre + i] += lp2 * Math.exp(-6.9078 * u) * 0.5;
        }
/*|
@*/
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

/*@fx{*/
    // drive models: tube = the soft clip off centre (even harmonics), fuzz =
    // a hard clip, fold = a wavefolder (sin of the driven input).
    function modelCurve(model, amount) {
      if (model === 'tube') return ampCurve(0.3 + amount * 0.6, 0.2);
      const n = 2048, c = new Float32Array(n), k = 1 + Math.max(0, Math.min(0.99, amount)) * 12;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = model === 'fold' ? Math.sin((Math.PI / 2) * x * k * 0.4) : Math.max(-1, Math.min(1, x * k));
      }
      return c;
    }
    // gated: a room2 impulse cut by a steep gate at `gate` s (a 12 ms fade) —
    // the huge-then-gone room; reverse: the impulse played backwards (a swell
    // into the silence after the hit).
    function fxImpulse(r, seed) {
      const buf = roomImpulse(Object.assign({ decay: r.model === 'gated' ? 1.6 : 2 }, r), seed), sr = ctx.sampleRate;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        if (r.model === 'gated') {
          const g0 = Math.round(sr * (r.gate == null ? 0.3 : r.gate)), fade = Math.round(sr * 0.012);
          for (let i = g0; i < d.length; i++) d[i] *= i < g0 + fade ? 1 - (i - g0) / fade : 0;
        } else d.reverse();
      }
      return buf;
    }
    // a modulator row's pre-fader tap (the vocoder's analysis input).
    const taps = {};
    function tapOf(name) { return taps[name] || (taps[name] = ctx.createGain()); }
    // '3/16' → 0.1875 (a note fraction of a whole note).
    function eval1(fr) { const m = /^(\d+)\/(\d+)([t.]?)$/.exec(String(fr)); return m ? (m[1] / m[2]) * (m[3] === 't' ? 2 / 3 : m[3] === '.' ? 1.5 : 1) : 0.25; }
/*|
@*/
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
/*@fx{*/
          // model 'dub': a filter and a clip INSIDE the feedback loop — each repeat darker and dirtier.
          if (f.model === 'dub') {
            const lf = ctx.createBiquadFilter(); lf.type = 'bandpass'; lf.frequency.value = f.filter == null ? 1200 : f.filter; lf.Q.value = 0.7;
            const ws = ctx.createWaveShaper(); ws.curve = driveCurve(f.drive == null ? 0.3 : f.drive);
            head.connect(dl); dl.connect(fb); fb.connect(lf); lf.connect(ws); ws.connect(dl); dl.connect(wet);
          } else { head.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); }
/*|
          head.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet);
@*/
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
/*@fx{*/
        } else if (t === 'chorus' && f.model === 'bbd') {
          // the bucket-brigade ensemble: a triangle LFO (mode I 0.513 Hz, II
          // 0.863 Hz, I+II a fast shallow wobble) moving two delays in
          // opposite phase, hard left and right, over a darkened wet path.
          const M = { I: [0.513, 0.00185], II: [0.863, 0.00185], 'I+II': [9.75, 0.0003] }[f.mode || 'I'] || [0.513, 0.00185];
          const mix = ctx.createGain(), dry = ctx.createGain(); head.connect(dry); dry.connect(mix);
          const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = f.rate || M[0]; lfo.start();
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500; lp.Q.value = 0.5; head.connect(lp);
          for (const sg of [1, -1]) {
            const dl = ctx.createDelay(0.03); dl.delayTime.value = 0.0035;
            const dg = ctx.createGain(); dg.gain.value = sg * (f.depth || M[1]); lfo.connect(dg); dg.connect(dl.delayTime);
            const w = ctx.createGain(); w.gain.value = f.mix == null ? 0.5 : f.mix;
            lp.connect(dl); dl.connect(w); w.connect(panned(mix, -sg));
          }
          head = mix;
        } else if (t === 'chorus') {
/*|
        } else if (t === 'chorus') {
@*/
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
/*@mix{*/
/*@fx{*/
          const cv = ctx.createConvolver(); cv.buffer = f.model === 'gated' || f.model === 'reverse' ? fxImpulse(f, seed) : f.model === 'room2' ? roomImpulse(Object.assign({ decay: 4 }, f), seed) : reverbImpulse(f.decay == null ? 4 : f.decay, seed);
/*|
          const cv = ctx.createConvolver(); cv.buffer = f.model === 'room2' ? roomImpulse(Object.assign({ decay: 4 }, f), seed) : reverbImpulse(f.decay == null ? 4 : f.decay, seed);
@*/
/*|
          const cv = ctx.createConvolver(); cv.buffer = reverbImpulse(f.decay == null ? 4 : f.decay, seed);
@*/
          const wet = ctx.createGain(); wet.gain.value = f.wet == null ? 0.4 : f.wet;
/*@perc{*/
          // drive (0..1) on the wet return: the room roars (the arena kit).
          if (f.drive) { const ws = ctx.createWaveShaper(); ws.curve = driveCurve(f.drive); head.connect(cv); cv.connect(ws); ws.connect(wet); wet.connect(mix); }
          else { head.connect(cv); cv.connect(wet); wet.connect(mix); }
/*|
          head.connect(cv); cv.connect(wet); wet.connect(mix);
@*/
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
/*@fx{*/
          // model: 'tube' (asymmetric, even harmonics), 'fuzz' (hard clip), 'fold' (a wavefolder).
          const ws = ctx.createWaveShaper(); ws.curve = f.model ? modelCurve(f.model, amount) : driveCurve(amount); ws.oversample = '4x';
/*|
          const ws = ctx.createWaveShaper(); ws.curve = driveCurve(amount); ws.oversample = '4x';
@*/
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
/*@perc{*/
        else if (t === 'compress') {
          // a compressor; `parallel` (0..1) blends a crushed copy UNDER the dry
          // (New York compression — the kit bus that makes drums big, not loud).
          const c = ctx.createDynamicsCompressor();
          c.threshold.value = f.threshold == null ? -30 : f.threshold; c.ratio.value = f.ratio == null ? 8 : f.ratio;
          c.attack.value = f.attack == null ? 0.003 : f.attack; c.release.value = f.release == null ? 0.12 : f.release; c.knee.value = 4;
          const mix = ctx.createGain();
          if (f.parallel != null) {
            const dry = ctx.createGain(); head.connect(dry); dry.connect(mix);
            const wet = ctx.createGain(); wet.gain.value = f.parallel;
            head.connect(c); c.connect(wet); wet.connect(mix);
          } else { head.connect(c); c.connect(mix); }
          const mk = ctx.createGain(); mk.gain.value = dbGain(f.level || 0); mix.connect(mk);
          head = mk;
        }
/*|
@*/
/*@fx{*/
        // ── the era rack (orchestra and era): modulation, destruction, a vocoder.
        else if (t === 'phaser') {
          // 2–12 allpass stages swept by one LFO (their detune, so the sweep is in
          // octaves), summed with the dry: the moving notches.
          const mix = ctx.createGain(), dry = ctx.createGain(); head.connect(dry); dry.connect(mix);
          const lfo = ctx.createOscillator(); lfo.frequency.value = f.rate == null ? 0.4 : f.rate;
          const dg = ctx.createGain(); dg.gain.value = 1200 * (f.depth == null ? 1.5 : f.depth); lfo.connect(dg); lfo.start();
          let n = head;
          for (let k = 0; k < Math.max(2, Math.min(12, f.stages || 6)); k++) {
            const ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.frequency.value = f.freq == null ? 700 : f.freq; ap.Q.value = 0.6;
            dg.connect(ap.detune); n.connect(ap); n = ap;
          }
          const wet = ctx.createGain(); wet.gain.value = f.mix == null ? 1 : f.mix; n.connect(wet); wet.connect(mix);
          head = mix;
        } else if (t === 'flanger') {
          // a short swept delay fed back on itself (≥ one 128-sample quantum inside the loop).
          const mix = ctx.createGain(), dry = ctx.createGain(); head.connect(dry); dry.connect(mix);
          const dl = ctx.createDelay(0.05); dl.delayTime.value = (f.delay == null ? 5 : f.delay) / 1000;
          const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = f.rate == null ? 0.25 : f.rate;
          const dg = ctx.createGain(); dg.gain.value = (f.depth == null ? 2 : f.depth) / 1000; lfo.connect(dg); dg.connect(dl.delayTime); lfo.start();
          const fb = ctx.createGain(); fb.gain.value = Math.min(0.95, f.feedback == null ? 0.5 : f.feedback);
          const wet = ctx.createGain(); wet.gain.value = f.mix == null ? 0.5 : f.mix;
          head.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(mix);
          head = mix;
        } else if (t === 'tape') {
          // wow (slow) and flutter (fast) on a short delay, a saturating head, the
          // low head bump and the tape's top end rolling off.
          const dl = ctx.createDelay(0.05); dl.delayTime.value = 0.01;
          for (const [rate, amt] of [[0.8, 0.0015 * (f.wow == null ? 0.4 : f.wow)], [6.5, 0.00015 * (f.flutter == null ? 0.3 : f.flutter)]]) {
            const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = amt; o.connect(g); g.connect(dl.delayTime); o.start();
          }
          const ws = ctx.createWaveShaper(); ws.curve = driveCurve(f.drive == null ? 0.25 : f.drive);
          const bump = ctx.createBiquadFilter(); bump.type = 'peaking'; bump.frequency.value = 90; bump.Q.value = 0.9; bump.gain.value = f.bump == null ? 3 : f.bump;
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f.tone == null ? 11000 : f.tone; lp.Q.value = 0.5;
          head.connect(dl); dl.connect(ws); ws.connect(bump); bump.connect(lp); head = lp;
        } else if (t === 'autopan') {
          const pn = ctx.createStereoPanner(), o = ctx.createOscillator();
          o.frequency.value = f.sync ? (bpm || 120) / (240 * eval1(f.sync)) : f.rate == null ? 0.5 : f.rate;
          const g = ctx.createGain(); g.gain.value = f.depth == null ? 0.8 : f.depth; o.connect(g); g.connect(pn.pan); o.start();
          head.connect(pn); head = pn;
        } else if (t === 'crush') {
          // bits: a quantizing curve (rate reduction would need a worklet: not built).
          const ws = ctx.createWaveShaper(), bits = Math.max(1, Math.min(16, f.bits == null ? 8 : f.bits)), L = Math.pow(2, bits - 1);
          const n = 65536, c = new Float32Array(n);
          for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.max(-1, Math.min(1, Math.round(x * L) / L)); }
          ws.curve = c;
          const mix = ctx.createGain();
          if (f.mix != null && f.mix < 1) { const dry = ctx.createGain(); dry.gain.value = 1 - f.mix; head.connect(dry); dry.connect(mix); const wet = ctx.createGain(); wet.gain.value = f.mix; head.connect(ws); ws.connect(wet); wet.connect(mix); } else { head.connect(ws); ws.connect(mix); }
          head = mix;
        } else if (t === 'ringmod') {
          const rg = ctx.createGain(); rg.gain.value = 0;
          const o = ctx.createOscillator(); o.frequency.value = f.hz == null ? 440 : f.hz; o.connect(rg.gain); o.start();
          const mix = ctx.createGain(), wet = ctx.createGain(); wet.gain.value = f.mix == null ? 1 : f.mix;
          if (f.mix != null && f.mix < 1) { const dry = ctx.createGain(); dry.gain.value = 1 - f.mix; head.connect(dry); dry.connect(mix); }
          head.connect(rg); rg.connect(wet); wet.connect(mix); head = mix;
        } else if (t === 'vocoder') {
          // a channel vocoder, native: the modulator row (tapped before its fader)
          // and this row through the same bandpass bank; each modulator band's
          // |x| → lowpass follower drives the matching carrier band's gain.
          const mod = tapOf(f.modulator), bands = Math.max(4, Math.min(24, f.bands || 12)), out = ctx.createGain();
          out.gain.value = f.gain == null ? 6 : f.gain;
          const abs = new Float32Array(1025);
          for (let i = 0; i < 1025; i++) abs[i] = Math.abs((i / 1024) * 2 - 1);
          for (let b = 0; b < bands; b++) {
            const fc = 110 * Math.pow(8000 / 110, bands > 1 ? b / (bands - 1) : 0), q = 0.5 * bands / 4;
            const ma = ctx.createBiquadFilter(); ma.type = 'bandpass'; ma.frequency.value = fc; ma.Q.value = q;
            const rect = ctx.createWaveShaper(); rect.curve = abs;
            const sm = ctx.createBiquadFilter(); sm.type = 'lowpass'; sm.frequency.value = f.smooth == null ? 40 : f.smooth; sm.Q.value = 0.5;
            const ca = ctx.createBiquadFilter(); ca.type = 'bandpass'; ca.frequency.value = fc; ca.Q.value = q;
            const vca = ctx.createGain(); vca.gain.value = 0;
            mod.connect(ma); ma.connect(rect); rect.connect(sm); sm.connect(vca.gain);
            head.connect(ca); ca.connect(vca); vca.connect(out);
          }
          if (f.hide) channelGain(f.modulator).gain.value = 0;
          head = out;
        }
/*|
@*/
      }
      return { input, output: head };
    }

/*@x{*/
    // a StereoPanner at `pan` feeding `dest`; returns its input.
    function panned(dest, pan) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(dest);
      return p;
    }

/*|
@*/
/*@orch{*/
    // a PeriodicWave from sine amplitudes [h1, h2, …], cached per table.
    const waves = new Map();
    function harmonicWave(h) {
      const k = h.join(',');
      if (!waves.has(k)) waves.set(k, ctx.createPeriodicWave(new Float32Array(h.length + 1), new Float32Array([0].concat(h))));
      return waves.get(k);
    }
/*|
@*/
/*@va{*/
    // ── the virtual-analog / FM core (orchestra and era) — all native WebAudio.
    // an LFO slot → a gain carrying depth (ramping in over `delay`), started at the note.
    function lfoNode(l, t, stop) {
      const o = ctx.createOscillator();
      o.type = l.shape === 'ramp' || l.shape === 'saw' ? 'sawtooth' : l.shape || 'sine';
      o.frequency.value = l.rate || 1;
      const g = ctx.createGain(), d = l.depth == null ? 1 : l.depth;
      if (l.delay) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(d, t + l.delay); } else g.gain.value = d;
      o.connect(g); o.start(t); o.stop(stop);
      return g;
    }
    // the voice filter's cutoff schedule (as the voice code sets it), for the stages added after it.
    function cutoffOf(patch, fl, hz, vel) {
      const cf = (f) => Math.min(ctx.sampleRate * 0.45, Math.max(40, f * (patch.keyTrack ? Math.pow(hz / 261.6, patch.keyTrack) : 1)));
      const fe = patch.filterEnv, v = vel == null ? 0.8 : vel;
      if (fe) {
        let from = fe.from == null ? (fl.freq == null ? 2200 : fl.freq) : fe.from, to = fe.to == null ? 420 : fe.to;
        if (patch.keyTrack || patch.velToFilter != null) { from = cf(from); to = cf(to * (patch.velToFilter != null ? Math.pow(v / 0.8, patch.velToFilter) : 1)); }
        return { from, to, decay: fe.decay == null ? 0.2 : fe.decay };
      }
      let fq = fl.freq == null ? 1800 : fl.freq;
      if (patch.velToFilter != null) fq = Math.min(ctx.sampleRate * 0.45, Math.max(40, fq * Math.pow(v / 0.8, patch.velToFilter)));
      return { freq: patch.keyTrack ? cf(fq) : fq };
    }
    // pulse = saw − the same saw delayed pw of a period; PWM moves the delay.
    function pulseComb(hz, patch, lfoTo) {
      const dl = ctx.createDelay(1); dl.delayTime.value = (patch.pw == null ? 0.5 : patch.pw) / hz;
      const inv = ctx.createGain(); inv.gain.value = -1;
      const sum = ctx.createGain(); sum.gain.value = 0.5;
      const inp = ctx.createGain();
      inp.connect(sum); inp.connect(dl); dl.connect(inv); inv.connect(sum);
      if (lfoTo) { const sc = ctx.createGain(); sc.gain.value = 1 / hz; sc.connect(dl.delayTime); lfoTo(sc, 'pw'); }
      return [inp, sum];
    }
    // the supersaw: 7 saws on the classic detune curve (amount 0..1 → spread),
    // the mix law (centre vs sides), a highpass at the played pitch. Its own
    // branch: glide / bend / path / pitch lfo / width follow; unison, players
    // and drift don't apply.
    const SS_OFF = [-0.11002313, -0.06288439, -0.01952356, 0, 0.01991221, 0.06216538, 0.10745242];
    function supersaw(patch, hz, t, end, env, lfoTo) {
      const S = patch.supersaw || {}, d = S.detune == null ? 0.5 : S.detune, m = S.mix == null ? 0.7 : S.mix;
      const curve = ((((((((((10028.7312891634 * d - 50818.8652045924) * d + 111363.4808729368) * d - 138150.6761080548) * d + 106649.6679158292) * d - 53046.9642751875) * d + 17019.9518580080) * d - 3425.0836591318) * d + 404.2703938388) * d - 24.1878824391) * d + 0.6717417634) * d + 0.0030115596;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hz; hp.Q.value = 0.5;
      const bus = ctx.createGain(); bus.gain.value = 1 / Math.sqrt(7);
      bus.connect(hp); hp.connect(env);
      SS_OFF.forEach(function (off, u) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        const f = hz * (1 + off * curve);
        if (patch.glideFrom) { o.frequency.setValueAtTime(f * patch.glideFrom / hz, t); o.frequency.exponentialRampToValueAtTime(f, t + (patch.glide || 0.08)); } else o.frequency.value = f;
        if (patch.bend) { const b = patch.bend; o.frequency.setValueAtTime(f * b[0], t + b[2]); o.frequency.exponentialRampToValueAtTime(f * b[1], t + Math.max(b[2] + 0.005, b[3])); }
        if (patch.path) { let r = 1; for (const [dt, q] of patch.path) { if (!dt) continue; const g = Math.min(patch.pathGlide || 0.06, dt * 0.5); o.frequency.setValueAtTime(f * r, t + dt - g); o.frequency.exponentialRampToValueAtTime(f * q, t + dt); r = q; } }
        if (lfoTo) lfoTo(o.detune, 'pitch');
        const g = ctx.createGain(); g.gain.value = u === 3 ? -0.55366 * m + 0.99785 : -0.73764 * m * m + 1.2841 * m + 0.044372;
        o.connect(g);
        g.connect(patch.width ? panned(bus, patch.width * (u / 3 - 1)) : bus);
        o.start(t); o.stop(end);
      });
    }
    // op-4 self-feedback, computed: y = sin(θ + β·y) solved over one period and
    // taken to its harmonics — a PeriodicWave, no delay loop (a WebAudio
    // feedback loop can't be shorter than one 128-sample quantum).
    const fbWaves = new Map();
    function feedbackWave(fb) {
      const beta = Math.max(0, Math.min(1, fb)) * 1.5, key = beta.toFixed(4);
      if (fbWaves.has(key)) return fbWaves.get(key);
      const N = 512, H = 40, y = new Float64Array(N), re = new Float32Array(H + 1), im = new Float32Array(H + 1);
      for (let k = 0; k < N; k++) {
        const th = (2 * Math.PI * k) / N;
        let v = Math.sin(th);
        for (let it = 0; it < 60; it++) v = 0.5 * v + 0.5 * Math.sin(th + beta * v);
        y[k] = v;
      }
      for (let h = 1; h <= H; h++) {
        let a = 0, b = 0;
        for (let k = 0; k < N; k++) { const th = (2 * Math.PI * h * k) / N; a += y[k] * Math.cos(th); b += y[k] * Math.sin(th); }
        re[h] = (2 * a) / N; im[h] = (2 * b) / N;
      }
      const w = ctx.createPeriodicWave(re, im);
      fbWaves.set(key, w);
      return w;
    }
    // fm4: four operators, the eight classic 4-op algorithms ([modulator,
    // modulated] links + carriers), per-op ratio / level (a modulator's level is
    // its index, radians) / ADSR / velSens / detune, op 4 self-feedback. Built
    // as PHASE modulation: each modulated op runs through a DelayNode whose
    // delay the modulators move (index / 2πf seconds per radian) — measured
    // against ideal FM in node-web-audio-api, a modulated delay matches it and
    // a modulated oscillator frequency does not (−8 dB error). The op starts up
    // to its base delay early, so the note still lands at t.
    const ALGS = { 1: [[[4, 3], [3, 2], [2, 1]], [1]], 2: [[[4, 2], [3, 2], [2, 1]], [1]], 3: [[[4, 1], [3, 2], [2, 1]], [1]], 4: [[[4, 3], [3, 1], [2, 1]], [1]], 5: [[[4, 3], [2, 1]], [1, 3]], 6: [[[4, 1], [4, 2], [4, 3]], [1, 2, 3]], 7: [[[4, 3]], [1, 2, 3]], 8: [[], [1, 2, 3, 4]] };
    function fm4(patch, hz, t, dur, vel, env, end) {
      const [links, cars] = ALGS[patch.algorithm] || ALGS[1];
      const opOf = (i) => (patch.ops || [])[i - 1] || {};
      const fOf = (i) => { const op = opOf(i); return hz * (op.ratio == null ? 1 : op.ratio) * (op.detune ? Math.pow(2, op.detune / 1200) : 1); };
      const lvOf = (i) => { const op = opOf(i); return (op.level == null ? (cars.indexOf(i) >= 0 ? 1 : 0) : op.level) * Math.pow((vel == null ? 0.8 : vel) / 0.8, op.velSens || 0); };
      const O = {};
      for (let i = 1; i <= 4; i++) {
        const op = opOf(i), car = cars.indexOf(i) >= 0, f = fOf(i), lv = lvOf(i);
        let depth = 0;
        for (const [m, c] of links) if (c === i) depth += lvOf(m) / (2 * Math.PI * f);
        const D0 = depth ? Math.min(0.05, depth + 0.0005) : 0;
        const o = ctx.createOscillator(); o.frequency.value = f;
        if (i === 4 && patch.feedback) o.setPeriodicWave(feedbackWave(patch.feedback));
        let src = o;
        if (D0) { const dl = ctx.createDelay(0.1); dl.delayTime.value = D0; o.connect(dl); src = dl; O[i] = { dl: dl }; } else O[i] = {};
        const pk = Math.max(1e-5, car ? lv / Math.sqrt(cars.length) : lv);
        const a = op.attack == null ? 0.002 : op.attack, d = op.decay == null ? 0.3 : op.decay, s = op.sustain == null ? 0.7 : op.sustain, r = op.release == null ? 0.2 : op.release;
        const g = ctx.createGain(), off = Math.max(t + a + d, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a);
        g.gain.exponentialRampToValueAtTime(Math.max(pk * s, 1e-5), t + a + d);
        g.gain.setValueAtTime(Math.max(pk * s, 1e-5), off); g.gain.exponentialRampToValueAtTime(1e-5, Math.min(end, off + r));
        src.connect(g); o.start(Math.max(0, t - D0)); o.stop(end);
        O[i].g = g; O[i].f = f;
        if (car) g.connect(env);
      }
      for (const [m, c] of links) {
        if (!O[c].dl) continue;
        const k = ctx.createGain(); k.gain.value = -1 / (2 * Math.PI * O[c].f);
        O[m].g.connect(k); k.connect(O[c].dl.delayTime);
      }
    }
/*|
@*/
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
/*@voice{*/
      if (patch.curve === 'exp') {
        // exponential (straight-in-dB) decay and release: a −60 dB release
        // instead of a linear ramp that drops off a cliff at the end. Ramps,
        // not setTargetAtTime (node-web-audio-api's diverges once converged).
        const lv = Math.max(peak * s, peak * 1e-4, 1e-6);
        g.gain.exponentialRampToValueAtTime(lv, t + a + d);
        g.gain.setValueAtTime(lv, Math.max(t + a + d, t + dur));
        g.gain.exponentialRampToValueAtTime(lv * 1e-3, Math.max(t + a + d, t + dur) + r);
      } else {
        g.gain.linearRampToValueAtTime(peak * s, t + a + d);
        g.gain.setValueAtTime(peak * s, Math.max(t + a + d, t + dur));
        g.gain.linearRampToValueAtTime(0.0001, Math.max(t + a + d, t + dur) + r);
      }
/*|
      g.gain.linearRampToValueAtTime(peak * s, t + a + d);
      g.gain.setValueAtTime(peak * s, Math.max(t + a + d, t + dur));
      g.gain.linearRampToValueAtTime(0.0001, Math.max(t + a + d, t + dur) + r);
@*/
      return { node: g, end: Math.max(t + a + d, t + dur) + r + 0.05 };
    }
/*@voice{*/
    // key (optional): the noteKey seed behind the opt-in per-hit variation.
    function playVoice(patch, hz, t, dur, vel, dest, key) {
      if (patch.pitch) hz = patch.pitch; // a fixed-pitch piece (a drum) ignores the note
/*@perc{*/
      // velMap { param | 'group.param': [at vel 0, at vel 1] }: velocity moves
      // timbre, not just level — a harder hit is brighter, shorter, higher.
      if (patch.velMap) {
        const v = Math.max(0, Math.min(1, vel == null ? 0.8 : vel));
        patch = Object.assign({}, patch);
        for (const k in patch.velMap) {
          const r = patch.velMap[k], x = r[0] + (r[1] - r[0]) * v, ks = k.split('.');
          if (ks.length === 2) patch[ks[0]] = Object.assign({}, patch[ks[0]], { [ks[1]]: x }); else patch[k] = x;
        }
      }
      // cut (seconds, from a choke group): the voice closes in 4 ms there.
      if (patch.cut != null) {
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(1, t); cg.gain.setValueAtTime(1, t + patch.cut); cg.gain.linearRampToValueAtTime(0, t + patch.cut + 0.004);
        cg.connect(dest || master);
        dest = cg;
      }
/*|
@*/
/*@ev{*/
      // amp: a per-note gain lane [[seconds after onset, gain], …] after the
      // whole voice — a hairpin under a held note, an articulation's shape, a choke.
      if (patch.amp) {
        const lane = ctx.createGain();
        lane.gain.setValueAtTime(patch.amp[0][1], t);
        for (let i = 1; i < patch.amp.length; i++) lane.gain.linearRampToValueAtTime(patch.amp[i][1], t + patch.amp[i][0]);
        lane.connect(dest || master);
        dest = lane;
      }
/*|
@*/
/*@orch{*/
      // tremolo { rate, depth }: an amplitude LFO on the whole voice — the
      // vibraphone's motor, a flutter-tongue's buzz.
      if (patch.tremolo) {
        const dp = Math.max(0, Math.min(1, patch.tremolo.depth == null ? 0.4 : patch.tremolo.depth));
        const tg = ctx.createGain(); tg.gain.value = 1 - dp / 2;
        const lf = ctx.createOscillator(); lf.frequency.value = patch.tremolo.rate || 5.5;
        const ld = ctx.createGain(); ld.gain.value = dp / 2;
        lf.connect(ld); ld.connect(tg.gain); lf.start(t); lf.stop(t + dur + (patch.release || 0.2) + 6);
        tg.connect(dest || master);
        dest = tg;
      }
      // mute (con sordino): strings darker and softer; brass nasal (a formant
      // peak, the lows thinned) — the straight mute.
      if (patch.mute) {
        const br = patch.mute === 'brass';
        const f1 = ctx.createBiquadFilter(); f1.type = br ? 'peaking' : 'lowpass'; f1.frequency.value = br ? 1600 : 1900; f1.Q.value = br ? 2.2 : 0.5;
        if (br) f1.gain.value = 9;
        const f2 = ctx.createBiquadFilter(); f2.type = br ? 'highpass' : 'lowpass'; f2.frequency.value = br ? 500 : 3200; f2.Q.value = 0.6;
        const mg = ctx.createGain(); mg.gain.value = dbGain(br ? -6 : -4);
        f1.connect(f2); f2.connect(mg); mg.connect(dest || master);
        dest = f1;
      }
/*|
@*/
/*@va{*/
      // lfo slots aimed at amp (a gated/tremolo level) or pan (an auto-pan) wrap the whole voice.
      if (patch.lfo) for (const l of [].concat(patch.lfo)) {
        const stop = t + dur + (patch.release || 0.2) + 2;
        if (l.target === 'amp') { const d = Math.max(0, Math.min(1, l.depth == null ? 1 : l.depth)), ag = ctx.createGain(); ag.gain.value = 1 - d / 2; lfoNode(Object.assign({}, l, { depth: d / 2 }), t, stop).connect(ag.gain); ag.connect(dest || master); dest = ag; }
        else if (l.target === 'pan') { const pn = ctx.createStereoPanner(); lfoNode(l, t, stop).connect(pn.pan); pn.connect(dest || master); dest = pn; }
      }
/*|
@*/
/*|
    function playVoice(patch, hz, t, dur, vel, dest) {
@*/
      const out = dest || master;
      const voice = patch.voice || 'osc';
/*@voice{*/
      const nk = key == null ? hashSeed(Math.round(hz * 16), Math.round(t * 1e4)) : key;
      // vary (opt-in): noise layers enter the long buffer at a per-hit offset.
      const vu = patch.vary ? unit(hashSeed(nk, 0x4015E)) : null;
/*|
@*/
      const { node: env, end } = envGain(t, dur, patch, vel);
/*@va{*/
      // lfo (≤ 2 slots) { rate, shape, target: pitch | filter | pw | amp | pan, depth, delay }:
      // lfoTo(param, target) wires each slot aimed at that target. amp/pan sit at the head.
      const lfoTo = patch.lfo ? (param, target) => { for (const l of [].concat(patch.lfo)) if (l.target === target) lfoNode(l, t, end).connect(param); } : null;
/*|
@*/
      let post = env;
      // per-voice filter; filterEnv sweeps its cutoff from→to over decay (B5.0) —
      // the deep-house/garage stab is a 2200→420Hz sweep, not a static cutoff.
      if (patch.filter || patch.filterEnv) {
        const fl = patch.filter || {};
        const bq = ctx.createBiquadFilter();
        bq.type = fl.mode || 'lowpass';
        bq.Q.value = fl.q == null ? 1 : fl.q;
/*@voice{*/
        // keyTrack (opt-in, 0..1): cutoff × (hz / C4)^k, so brightness follows
        // register instead of a fixed Hz that starves the treble.
        const cf = (f) => Math.min(ctx.sampleRate * 0.45, Math.max(40, f * (patch.keyTrack ? Math.pow(hz / 261.6, patch.keyTrack) : 1)));
/*|
@*/
        if (patch.filterEnv) {
          const fe = patch.filterEnv;
/*@voice{*/
          let from = fe.from == null ? (fl.freq == null ? 2200 : fl.freq) : fe.from;
          let to = fe.to == null ? 420 : fe.to;
          // velToFilter reaches the sweep's target too (opt-in: no shelf patch
          // pairs it with a filterEnv) — blown harder, brass opens brighter.
          if (patch.keyTrack || patch.velToFilter != null) {
            from = cf(from);
            to = cf(to * (patch.velToFilter != null ? Math.pow((vel == null ? 0.8 : vel) / 0.8, patch.velToFilter) : 1));
          }
/*|
          const from = fe.from == null ? (fl.freq == null ? 2200 : fl.freq) : fe.from;
@*/
          bq.frequency.setValueAtTime(Math.max(1, from), t);
/*@voice{*/
          bq.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + (fe.decay == null ? 0.2 : fe.decay));
/*|
          bq.frequency.exponentialRampToValueAtTime(Math.max(1, fe.to == null ? 420 : fe.to), t + (fe.decay == null ? 0.2 : fe.decay));
@*/
        } else {
          // velToFilter (B6.2b): velocity → brightness, the piano/keys expressive
          // axis — harder hits open the cutoff, soft hits darken (a pow curve
          // centered on the default vel 0.8, so patches without it and notes at
          // default velocity are byte-identical). k ≈ 1–2; osc/fm/string/modal alike.
          let fq = fl.freq == null ? 1800 : fl.freq;
          if (patch.velToFilter != null) {
            fq = Math.min(ctx.sampleRate * 0.45, Math.max(40, fq * Math.pow((vel == null ? 0.8 : vel) / 0.8, patch.velToFilter)));
          }
/*@voice{*/
          bq.frequency.value = patch.keyTrack ? cf(fq) : fq;
/*|
          bq.frequency.value = fq;
@*/
        }
        env.connect(bq); post = bq;
      }
/*@va{*/
      // filter `slope: 24` = two stages (lowpass: the ladder — stage one flat,
      // a drive between, the resonance q (dB) on stage two); filterEnv
      // `amount` / `velAmount` / an accented step deepen the sweep (a detune
      // ramp: an exponential sweep is linear in cents); lfo slots aimed at
      // 'filter' ride every stage's detune.
      if (post !== env && (patch.filter || patch.filterEnv)) {
        const fl = patch.filter || {}, stages = [post], cut = cutoffOf(patch, fl, hz, vel);
        if (fl.slope === 24) {
          const b1 = post, b2 = ctx.createBiquadFilter(); b2.type = b1.type; b2.Q.value = fl.q == null ? 1 : fl.q;
          if (b1.type === 'lowpass') b1.Q.value = -3;
          if (cut.to != null) { b2.frequency.setValueAtTime(Math.max(1, cut.from), t); b2.frequency.exponentialRampToValueAtTime(Math.max(1, cut.to), t + cut.decay); } else b2.frequency.value = cut.freq;
          if (b1.type === 'lowpass' && fl.drive !== 0) { const ws = ctx.createWaveShaper(); ws.curve = driveCurve(fl.drive == null ? 0.2 : fl.drive); b1.connect(ws); ws.connect(b2); } else b1.connect(b2);
          stages.push(b2); post = b2;
        }
        const fe = patch.filterEnv;
        if (fe && (fe.amount != null || fe.velAmount || patch.accent)) {
          const A = (fe.amount == null ? 1 : fe.amount) * (1 + (fe.velAmount || 0) * (((vel == null ? 0.8 : vel) - 0.8) / 0.8)) * (1 + 0.35 * (patch.accent || 0));
          // the deepened peak stays under 0.4 × the sample rate.
          const c0 = Math.min(1200 * Math.log2((ctx.sampleRate * 0.4) / cut.from), 1200 * (Math.max(0, A) - 1) * Math.log2(cut.from / cut.to));
          for (const b of stages) { b.detune.setValueAtTime(c0, t); b.detune.linearRampToValueAtTime(0, t + cut.decay); }
        }
        if (lfoTo) for (const b of stages) lfoTo(b.detune, 'filter');
      }
/*|
@*/
/*@perc{*/
      // drive (a piece's own clip stage, the punchy kick's grit).
      if (patch.drive) {
        const pg = ctx.createGain(); pg.gain.value = 1 + patch.drive * 6;
        const ws = ctx.createWaveShaper(); ws.curve = driveCurve(patch.drive); ws.oversample = '2x';
        const mk = ctx.createGain(); mk.gain.value = 1 / (1 + patch.drive * 1.8);
        post.connect(pg); pg.connect(ws); ws.connect(mk); mk.connect(out);
      } else post.connect(out);
/*|
      post.connect(out);
@*/
/*@voice{*/
      // breath (opt-in): filtered noise UNDER the envelope for the note's whole
      // life — bow hair, breath, air; the sustained cousin of attackNoise.
      if (patch.breath) {
        const br = patch.breath;
        const nz = noiseSrc(t, unit(hashSeed(nk, 0xB4EA7)));
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = br.tone == null ? 1800 : br.tone; bp.Q.value = br.q == null ? 0.7 : br.q;
        const bg = ctx.createGain(); bg.gain.value = dbGain(br.level == null ? -24 : br.level);
        nz.connect(bp); bp.connect(bg); bg.connect(env); nz.stop(end);
      }
/*|
@*/
      // attack-transient layer (B7): a short filtered-noise burst at onset — the
      // PICK / bachi contact click for plucked strings (also bow scratch, breath
      // chiff). Runs PARALLEL to the voice with its own fast envelope, so it's an
      // additive onset, not shaped by the note's ADSR; sent to `out` so the part's
      // body/reverb catch it too (the bachi striking the skin excites the box).
      if (patch.attackNoise) {
        const an = patch.attackNoise;
/*@voice{*/
        const nz = noiseSrc(t, vu);
/*|
        const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(); nz.loop = true;
@*/
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
/*@voice{*/
        nz.stop(t + adec + 0.02);
/*|
        nz.start(t); nz.stop(t + adec + 0.02);
@*/
      }
      if (voice === 'noise') {
/*@voice{*/
        const src = noiseSrc(t, vu);
/*@perc{*/
        if (patch.claps) {
          // a clap: `claps` short bursts ~8–12 ms apart (seeded), then the tail
          // the envelope shapes. clapGap stretches the spacing (a guiro scrape).
          const cb = ctx.createGain(), rng = mulberry32(hashSeed(nk, 0xC1A9));
          let at = t;
          cb.gain.setValueAtTime(0, t);
          for (let k = 0; k < patch.claps; k++) {
            cb.gain.setValueAtTime(1, at);
            // the last burst stays open: it IS the tail the envelope decays.
            if (k < patch.claps - 1) { cb.gain.exponentialRampToValueAtTime(0.08, at + 0.007); at += (patch.clapGap || 0.01) * (0.8 + 0.4 * rng()); }
          }
          src.connect(cb); cb.connect(env);
        } else src.connect(env);
        src.stop(end);
/*|
        src.connect(env); src.stop(end);
@*/
/*|
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
        src.connect(env); src.start(t); src.stop(end);
@*/
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
/*@va{*/
      } else if (voice === 'fm4') {
        fm4(patch, hz, t, dur, vel, env, end);
      } else if (voice === 'osc' && patch.wave === 'supersaw') {
        supersaw(patch, hz, t, end, env, lfoTo);
/*|
@*/
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
/*@voice{*/
        // a modal patch with a filter plays its partials through it (opt-in:
        // no shelf modal had one) — the 808 hat's square cluster → highpass.
        const mout = post === env ? out : post;
/*|
@*/
        const base = dbGain(patch.volume) * (vel == null ? 0.8 : vel);
        const atk = patch.attack == null ? 0.002 : patch.attack;
        const nyq = ctx.sampleRate * 0.5;
/*@voice{*/
        partials.forEach(function (p, i) {
/*|
        for (const p of partials) {
@*/
          const f = hz * (p.ratio == null ? 1 : p.ratio);
/*@voice{*/
          if (f <= 0 || f >= nyq) return; // skip DC / above Nyquist
          // decayTrack (opt-in): higher notes ring shorter, × (C4 / hz)^k.
          const dec = (p.decay == null ? 1 : p.decay) * (patch.decayTrack ? Math.pow(261.6 / hz, patch.decayTrack) : 1);
/*|
          if (f <= 0 || f >= nyq) continue; // skip DC / above Nyquist
          const dec = p.decay == null ? 1 : p.decay;
@*/
          const pk = Math.max(0.0001, base * (p.gain == null ? 1 : p.gain));
/*@voice{*/
/*@orch{*/
          const o = ctx.createOscillator(); o.type = p.wave || 'sine';
          // a pedal modal patch on a gliding row (the timpani): every mode slides with the note.
          if (patch.glideFrom && patch.pedal) { o.frequency.setValueAtTime(f * patch.glideFrom / hz, t); o.frequency.exponentialRampToValueAtTime(f, t + (patch.glide || 0.08)); } else o.frequency.value = f;
/*|
          const o = ctx.createOscillator(); o.type = p.wave || 'sine'; o.frequency.value = f;
@*/
/*|
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
@*/
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
/*@perc{*/
          // rise (per mode, seconds): energy that blooms after the strike (the tam-tam).
          g.gain.exponentialRampToValueAtTime(pk, t + (p.rise || atk));
/*|
          g.gain.exponentialRampToValueAtTime(pk, t + atk);       // fast strike (no click)
@*/
          g.gain.exponentialRampToValueAtTime(0.0001, t + dec);   // per-mode ring-down
/*@voice{*/
/*@perc{*/
          if (patch.excite === 'noise') {
            // excite:'noise' — each mode is band noise at its frequency (a
            // cymbal, gong or shaker body), RMS-matched to a sine mode.
            const q = patch.q || 20, nz = noiseSrc(t, unit(hashSeed(nk, 0xE7C + i)));
            const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
            const ng = ctx.createGain(); ng.gain.value = 1.2247 * Math.sqrt((q * ctx.sampleRate * 0.5) / f);
            nz.connect(bp); bp.connect(ng); ng.connect(g); nz.stop(t + dec + 0.02);
          } else o.connect(g);
/*|
          o.connect(g);
@*/
          // width (opt-in): the fundamental stays centred, upper modes fan
          // out alternately left/right.
          if (patch.width) g.connect(panned(mout, i ? patch.width * (i % 2 ? -1 : 1) * Math.min(1, 0.4 + i / partials.length) : 0));
          else g.connect(mout);
/*|
          o.connect(g); g.connect(out);
@*/
          o.start(t); o.stop(t + dec + 0.02);
/*@voice{*/
        });
/*|
        }
@*/
      } else {
        // osc voice; detune/unison (B5.0) spreads N copies across ±detune cents —
        // the supersaw stab. Loudness is normalized by 1/√N so patches keep their
        // dB meaning whether or not they stack.
        const cents = patch.detune || 0;
/*@orch{*/
        // players (a section size): one voice per player, capped at 8.
        const n = Math.max(1, Math.round(patch.players ? Math.min(8, patch.players) : patch.unison || (cents ? 2 : 1)));
/*|
        const n = Math.max(1, Math.round(patch.unison || (cents ? 2 : 1)));
@*/
        const mix = ctx.createGain(); mix.gain.value = 1 / Math.sqrt(n);
/*@va{*/
        // pulse: the saws minus themselves delayed pw of a period (a comb after
        // the unison mix; PWM = an lfo aimed at 'pw' moving that delay).
        if (patch.wave === 'pulse') { const pc = pulseComb(hz, patch, lfoTo); mix.connect(pc[0]); pc[1].connect(env); } else mix.connect(env);
/*|
        mix.connect(env);
@*/
        // vibrato (B7): a sine LFO on each osc's detune (cents) — the pitch wobble
        // that makes a sustained saw read as BOWED (violin/cello). depth ramps in
        // over `delay` so the bow onset is steady before the vibrato blooms.
        let vib = null;
/*@voice{*/
        const V = patch.vibrato || null;
        const vr = V && V.rate != null ? V.rate : 5.5, vd = V && V.depth != null ? V.depth : 14, vdel = V && V.delay != null ? V.delay : 0.25;
        // one LFO → gain (depth, ramping in over `delay`) → detune.
        const vibLfo = (rate, ph) => {
          const lfo = ctx.createOscillator();
          if (ph == null) lfo.type = 'sine';
          else lfo.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, Math.sin(ph)]), new Float32Array([0, Math.cos(ph)])));
          lfo.frequency.value = rate;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(vd, t + vdel);
          lfo.connect(g); lfo.start(t); lfo.stop(end);
          return g;
        };
        if (V && !V.spread) vib = vibLfo(vr);
/*|
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
@*/
        for (let u = 0; u < n; u++) {
/*@va{*/
          // a 'pulse' is built from saws (the comb after the mix).
          const osc = ctx.createOscillator(); osc.type = patch.wave === 'pulse' ? 'sawtooth' : patch.wave || 'sine';
/*|
          const osc = ctx.createOscillator(); osc.type = patch.wave || 'sine';
@*/
          const spread = n === 1 ? 0 : (u / (n - 1)) * 2 - 1;
/*@orch{*/
          // harmonics: a computed PeriodicWave (sine amplitudes 1..N) — the
          // flute's near-sine, the clarinet's odd series, the reeds' narrow pulse.
          if (patch.harmonics) osc.setPeriodicWave(harmonicWave(patch.harmonics));
/*|
@*/
/*@voice{*/
          const f = hz * Math.pow(2, (cents * spread) / 1200);
          // glide (opt-in, set per note by the scheduler): slide in from the
          // row's previous pitch instead of starting on this one.
          if (patch.glideFrom) {
            osc.frequency.setValueAtTime(f * patch.glideFrom / hz, t);
            osc.frequency.exponentialRampToValueAtTime(f, t + (patch.glide || 0.08));
          } else osc.frequency.value = f;
/*@orch{*/
          // bend [fromRatio, toRatio, startS, endS] (port, gliss) and path
          // [[s, ratio], …] (a legato run: one note, the pitch moves, no retrigger).
          if (patch.bend) { const b = patch.bend; osc.frequency.setValueAtTime(f * b[0], t + b[2]); osc.frequency.exponentialRampToValueAtTime(f * b[1], t + Math.max(b[2] + 0.005, b[3])); }
          if (patch.path) {
            let r = 1;
            for (const [dt, q] of patch.path) {
              if (!dt) continue;
              const g = Math.min(patch.pathGlide || 0.06, dt * 0.5);
              osc.frequency.setValueAtTime(f * r, t + dt - g); osc.frequency.exponentialRampToValueAtTime(f * q, t + dt); r = q;
            }
          }
/*|
@*/
/*|
          osc.frequency.value = hz * Math.pow(2, (cents * spread) / 1200);
@*/
          if (vib) vib.connect(osc.detune);
/*@voice{*/
          const rng = V && V.spread || patch.drift ? mulberry32(hashSeed(nk, 0x71B + u)) : null;
          // vibrato.spread (0..1): one LFO per unison voice, seeded rate ±8% and
          // phase — a section that doesn't wobble in lockstep.
          if (V && V.spread) vibLfo(vr * (1 + (rng() * 2 - 1) * 0.08 * V.spread), rng() * 2 * Math.PI * V.spread).connect(osc.detune);
          // drift (cents): a slow seeded random walk on this voice's detune.
          if (patch.drift) {
            let dv = 0;
            osc.detune.setValueAtTime(0, t);
            for (let k = 1; k * 0.2 < end - t; k++) {
              dv = Math.max(-patch.drift, Math.min(patch.drift, dv + (rng() * 2 - 1) * patch.drift * 0.5));
              osc.detune.linearRampToValueAtTime(dv, t + k * 0.2);
            }
          }
/*@va{*/
          if (lfoTo) lfoTo(osc.detune, 'pitch');
/*|
@*/
          // width (opt-in): unison voices spread across the stereo field.
/*@orch{*/
          const vdst = patch.width && n > 1 ? panned(mix, spread * patch.width) : mix;
          if (patch.players > 1) {
            // each player enters on its own seeded offset (≤ 45 ms) and bow/breath
            // ramp: a section's onset is a smear, not one edge (the choir lesson).
            const off = unit(hashSeed(nk, 0x91A + u)) * 0.045, pg = ctx.createGain();
            pg.gain.setValueAtTime(0, t); pg.gain.setValueAtTime(0, t + off);
            pg.gain.linearRampToValueAtTime(1, t + off + 0.02 + (patch.attack || 0) * 0.5);
            osc.connect(pg); pg.connect(vdst);
          } else osc.connect(vdst);
/*|
          osc.connect(patch.width && n > 1 ? panned(mix, spread * patch.width) : mix);
@*/
          osc.start(t); osc.stop(end);
/*|
          osc.connect(mix); osc.start(t); osc.stop(end);
@*/
        }
/*@va{*/
        // sub { level dB, octave 1|2 }: a square an octave or two down; noise { level dB }: white noise in the mix.
        if (patch.sub) {
          const so = ctx.createOscillator(); so.type = 'square'; so.frequency.value = hz / Math.pow(2, patch.sub.octave || 1);
          const sg = ctx.createGain(); sg.gain.value = dbGain(patch.sub.level == null ? -6 : patch.sub.level);
          so.connect(sg); sg.connect(env); so.start(t); so.stop(end);
        }
        if (patch.noise) {
          const nz = noiseSrc(t, unit(hashSeed(nk, 0x5E1)));
          const ng = ctx.createGain(); ng.gain.value = dbGain(patch.noise.level == null ? -18 : patch.noise.level);
          nz.connect(ng); ng.connect(env); nz.stop(end);
        }
/*|
@*/
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
/*@sfx{*/
          const src = noiseSrc(t, op.offset);
/*|
          const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
@*/
          const g = ctx.createGain();
          g.gain.setValueAtTime(dbGain(-12) * op.vol * vs, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + op.decay);
          let node = g;
          if (op.highpass) { const bq = ctx.createBiquadFilter(); bq.type = 'highpass'; bq.frequency.value = op.highpass; node.connect(bq); node = bq; }
          if (op.lowpass) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = op.lowpass; node.connect(lp); node = lp; }
/*@sfx{*/
          if (op.bandpass) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = op.bandpass; bp.Q.value = op.q || 1; node.connect(bp); node = bp; }
          if (op.sweep) {
            const sw = ctx.createBiquadFilter(); sw.type = 'lowpass';
            sw.frequency.setValueAtTime(op.sweep.from, t); sw.frequency.exponentialRampToValueAtTime(Math.max(20, op.sweep.to), t + op.sweep.decay);
            node.connect(sw); node = sw;
          }
          src.connect(g); node.connect(out); src.stop(t + op.decay + 0.05);
        } else if (op.kind === 'hum') {
          const osc = ctx.createOscillator(); osc.type = op.wave;
          osc.frequency.setValueAtTime(op.from, t);
          if (op.to !== op.from) osc.frequency.exponentialRampToValueAtTime(op.to, t + op.dur);
          const end = t + op.dur + op.release, pk = dbGain(-10) * op.vol * vs;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(pk, t + op.attack);
          g.gain.setValueAtTime(pk, Math.max(t + op.attack, t + op.dur));
          g.gain.linearRampToValueAtTime(0.0001, end);
          osc.connect(g);
          let node = g;
          const lfo = (spec, param, amt) => {
            const o = ctx.createOscillator(); o.frequency.value = spec.rate == null ? 6 : spec.rate;
            const d = ctx.createGain(); d.gain.value = amt;
            o.connect(d); d.connect(param); o.start(t); o.stop(end + 0.05);
          };
          if (op.vibrato) lfo(op.vibrato, osc.detune, op.vibrato.depth == null ? 15 : op.vibrato.depth);
          if (op.tremolo) {
            const depth = Math.max(0, Math.min(1, op.tremolo.depth == null ? 0.5 : op.tremolo.depth));
            const am = ctx.createGain(); am.gain.value = 1 - depth / 2;
            lfo(op.tremolo, am.gain, depth / 2);
            node.connect(am); node = am;
          }
          if (op.lowpass) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = op.lowpass; node.connect(lp); node = lp; }
          node.connect(out); osc.start(t); osc.stop(end + 0.05);
/*|
          src.connect(g); node.connect(out); src.start(t); src.stop(t + op.decay + 0.05);
@*/
        } else if (op.kind === 'thump') {
/*@sfx{*/
          const osc = ctx.createOscillator(); osc.type = op.wave || 'sine';
/*|
          const osc = ctx.createOscillator(); osc.type = 'sine';
@*/
          osc.frequency.setValueAtTime(op.from, t);
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, op.to), t + op.decay * 0.6);
          const g = ctx.createGain();
          g.gain.setValueAtTime(dbGain(-6) * op.vol * vs, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + op.decay);
/*@sfx{*/
          if (op.highpass) { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = op.highpass; g.connect(hp); hp.connect(out); } else g.connect(out);
          osc.connect(g); osc.start(t); osc.stop(t + op.decay + 0.05);
/*|
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + op.decay + 0.05);
@*/
        }
      }
    }

    // per-channel gain (mutes) + patch/chain routing, built per recipe.
    const channels = {};
    function channelGain(name) {
      if (!channels[name]) { channels[name] = ctx.createGain(); channels[name].connect(master); }
      return channels[name];
/*@mix{*/
    }
    // one row's route, shared by the live transport and the offline export:
    // chain → [pan] → channel gain → master. `pan` (−1..1) is opt-in; absent,
    // no panner node exists. With a recipe `room`, `send` (0..1) taps the
    // channel post-fader into ONE shared room convolver (mono in, stereo out)
    // — one space for the mix instead of a reverb per row. Returns the chain input.
    let roomBus = null;
    const sends = {};
    function routeChannel(ch, recipe) {
      const built = buildChain(ch.chain, recipe.seed, recipe.bpm);
/*@fx{*/
      // a row some vocoder names as its modulator is tapped before its fader.
      if ((recipe.channels || recipe.parts || recipe.tracks || []).some((r) => r && (r.chain || []).some((x) => x && x.type === 'vocoder' && x.modulator === ch.name))) built.output.connect(tapOf(ch.name));
/*|
@*/
      const gain = channelGain(ch.name);
/*@orch{*/
      // desk (depth): 'back' rolls off the highs, arrives ~12 ms late and sends
      // more to the room; 'front' is close and bright. A desk implies a send.
      let out = built.output;
      if (ch.desk === 'back') {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800; lp.Q.value = 0.5;
        const dl = ctx.createDelay(0.05); dl.delayTime.value = 0.012;
        out.connect(lp); lp.connect(dl); out = dl;
      }
      out.connect(ch.pan != null ? panned(gain, ch.pan) : gain);
      const snd = ch.desk ? (ch.send == null ? (ch.desk === 'back' ? 0.32 : 0.12) : Math.min(1, ch.send * (ch.desk === 'back' ? 1.6 : 1))) : ch.send;
      if (recipe.room && snd) {
/*|
      built.output.connect(ch.pan != null ? panned(gain, ch.pan) : gain);
      if (recipe.room && ch.send) {
@*/
        if (!roomBus) {
          const r = recipe.room;
          const cv = ctx.createConvolver();
/*@fx{*/
          cv.buffer = r.model === 'gated' || r.model === 'reverse' ? fxImpulse(r, recipe.seed) : r.model === 'noise' ? reverbImpulse(r.decay == null ? 2 : r.decay, recipe.seed) : roomImpulse(r, recipe.seed);
/*|
          cv.buffer = r.model === 'noise' ? reverbImpulse(r.decay == null ? 2 : r.decay, recipe.seed) : roomImpulse(r, recipe.seed);
@*/
          const ret = ctx.createGain(); ret.gain.value = dbGain(r.level);
          roomBus = ctx.createGain(); roomBus.channelCount = 1; roomBus.channelCountMode = 'explicit';
          roomBus.connect(cv); cv.connect(ret); ret.connect(master);
        }
        if (!sends[ch.name]) { sends[ch.name] = ctx.createGain(); gain.connect(sends[ch.name]); sends[ch.name].connect(roomBus); }
/*@orch{*/
        sends[ch.name].gain.value = snd;
/*|
        sends[ch.name].gain.value = ch.send;
@*/
      }
      return built.input;
    }
    // recipe `master` (opt-in): glue-compressor overrides and a limiter stage
    // (a fast, hard-ratio compressor at `limit` dBFS) after it. Absent: the stock bus.
    let limiter = null;
    function setMaster(m) {
      if (!m) return;
      const gl = m.glue || {};
      for (const k of ['threshold', 'ratio', 'knee', 'attack', 'release']) if (gl[k] != null) comp[k].value = gl[k];
      if (m.limit != null && !limiter) {
        limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = m.limit; limiter.ratio.value = 20; limiter.knee.value = 0;
        limiter.attack.value = 0.001; limiter.release.value = 0.08;
        // undo the compressor's automatic makeup gain, (1 / full-range gain)^0.6,
        // so the stage only ever turns peaks down.
        const trim = ctx.createGain(); trim.gain.value = dbGain(0.6 * m.limit * 0.95);
        comp.disconnect(); comp.connect(limiter); limiter.connect(trim); trim.connect((opts && opts.analyser) || ctx.destination);
      }
/*|
@*/
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
/*@orch{*/
    // a4 (orchestral 442): the recipe's reference pitch, set per transport start.
    let a4r = 1;
    function chHz(name, note) {
      const semis = macro(name).transpose || 0;
      return noteHz(note) * a4r * (semis ? Math.pow(2, semis / 12) : 1);
    }
/*|
    function chHz(name, note) {
      const semis = macro(name).transpose || 0;
      return noteHz(note) * (semis ? Math.pow(2, semis / 12) : 1);
    }
@*/
/*@voice{*/
    // the per-note patch: pluck jitter nudges the excitation brightness
    // (pluck-position drift); a gliding row slides in from its previous note.
    function notePatch(patch, pluck, row, prev) {
      const p = pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + pluck)) }) : patch;
      return row && row.glide && prev != null ? Object.assign({}, p, { glide: row.glide, glideFrom: chHz(row.name, prev) }) : p;
    }
/*|
@*/

    // ── transport: lookahead scheduler over pure event derivation ────────────
    // Every 25ms, schedule everything inside the next 120ms window. Ambient
    // derives bars on demand from ambientBarEvents; composition pre-flattens.
    let timer = null;
    function stopTransport() { if (timer) { clearInterval(timer); timer = null; } }
    function startTransport(recipe, patches, mode) {
      stopTransport();
/*@orch{*/
      a4r = recipe.a4 ? recipe.a4 / 440 : 1;
/*|
@*/
/*@mix{*/
      setMaster(recipe.master);
/*|
@*/
      const chains = {};
      for (const ch of recipe.channels || recipe.parts || recipe.tracks || []) {
/*@mix{*/
        const input = routeChannel(ch, recipe);
/*|
        const built = buildChain(ch.chain, recipe.seed, recipe.bpm);
        built.output.connect(channelGain(ch.name));
@*/
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
/*@mix{*/
        tn.connect(input);
/*|
        tn.connect(built.input);
@*/
        m.toneNode = tn;
        chains[ch.name] = tn;
      }
      const flat = mode === 'composition' ? compositionEvents(recipe) : null;
      const pat = mode === 'pattern' ? patternEvents(recipe) : null;
/*@voice{*/
      const glide = flat ? glideNotes(flat.events) : pat ? [glideNotes(pat.events), glideNotes(pat.events, true)] : null;
/*|
@*/
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
/*@va{*/
              if (ev.prob != null && !stepKeep(recipe.seed, cursor, ei, ev.prob)) return;
/*|
@*/
              const tr = (recipe.tracks || []).find((c) => c.name === ev.channel);
              const when = t0 + cursor * pat.duration + ev.t;
              if (tr && (tr.cue || tr.gesture)) {
/*@sfx{*/
                // vary (opt-in): each hit is a variant, (loop, event) → a counter.
                playOps(cuePlan(tr.cue || [tr.gesture], tr.vary ? cursor * 1000 + ei + 1 : 0), when, chains[ev.channel], ev.vel);
/*|
                playOps(cuePlan(tr.cue || [tr.gesture]), when, chains[ev.channel], ev.vel);
@*/
              } else {
/*@voice{*/
/*|
                const patch = patches[(tr && tr.patch) || 'sinePluck'] || {};
@*/
                const feel = tr && tr.feel;
                // per-loop evolving feel: the loop index folds into the seed so the
                // groove humanizes without repeating identically each bar (B6.1).
                ev.notes.forEach((n, ni) => {
                  const fl = noteFeel(feel, recipe.seed, cursor * 1000 + ei, ni, ev.notes.length);
/*@voice{*/
                  const patch = resolvePatch(patches, tr, n);
                  if (!patch) return;
/*@ev{*/
                  const p = notePatch(ev.pp ? Object.assign({}, patch, ev.pp) : patch, fl.pluck, tr, glide[cursor ? 1 : 0][ei]);
/*|
                  const p = notePatch(patch, fl.pluck, tr, glide[cursor ? 1 : 0][ei]);
@*/
                  const hz = chHz(ev.channel, n);
                  playVoice(p, hz, when + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel], noteKey(recipe.seed, ev.channel, cursor * pat.duration + ev.t + fl.timeOffset, hz));
/*|
                  const p = fl.pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + fl.pluck)) }) : patch;
                  playVoice(p, chHz(ev.channel, n), when + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel]);
@*/
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
/*@voice{*/
/*|
            const patch = patches[(part && part.patch) || 'sinePluck'] || {};
@*/
            const feel = (part && part.feel) || recipe.feel;
            ev.notes.forEach((n, ni) => {
              const fl = noteFeel(feel, recipe.seed, evIndex, ni, ev.notes.length);
/*@voice{*/
              const patch = resolvePatch(patches, part, n);
              if (!patch) return;
/*@ev{*/
              // per-event overrides (articulations, hairpin lanes, choke) over the row's patch.
              const p = notePatch(ev.pp ? Object.assign({}, patch, ev.pp) : patch, fl.pluck, part, glide[evIndex]);
/*|
              const p = notePatch(patch, fl.pluck, part, glide[evIndex]);
@*/
              const hz = chHz(ev.channel, n);
              playVoice(p, hz, t0 + ev.t + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel], noteKey(recipe.seed, ev.channel, ev.t + fl.timeOffset, hz));
/*|
              // pluck jitter nudges the excitation brightness per note (pluck-position drift)
              const p = fl.pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + fl.pluck)) }) : patch;
              playVoice(p, chHz(ev.channel, n), t0 + ev.t + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel]);
@*/
            });
          }
          if (cursor >= flat.events.length && !recipe.loop) stopTransport();
          return;
        }
        while (cursor * bar <= horizon) {
          const events = ambientBarEvents(recipe, cursor);
/*@voice{*/
          const gl = glideNotes(events); // within the bar: bars stay independent
/*|
@*/
          events.forEach((ev, ei) => {
            const ch = (recipe.channels || []).find((c) => c.name === ev.channel);
/*@voice{*/
/*|
            const patch = patches[(ch && ch.patch) || 'sinePluck'] || {};
@*/
            // B6: channels carry feel too (an `instrument` channel expands to one at
            // normalize time) — the bar index folds into the seed like pattern mode,
            // so the humanization evolves per bar yet replays identically. A channel
            // with no feel gets offset 0 / velScale 1: the pre-B6 path, unchanged.
            const feel = ch && ch.feel;
            ev.notes.forEach((n, ni) => {
              const fl = noteFeel(feel, recipe.seed, cursor * 1000 + ei, ni, ev.notes.length);
/*@voice{*/
              const patch = resolvePatch(patches, ch, n);
              if (!patch) return;
              const p = notePatch(patch, fl.pluck, ch, gl[ei]);
              const hz = chHz(ev.channel, n);
              playVoice(p, hz, t0 + cursor * bar + ev.t + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel], noteKey(recipe.seed, ev.channel, cursor * bar + ev.t + fl.timeOffset, hz));
/*|
              const p = fl.pluck ? Object.assign({}, patch, { pick: Math.max(0, Math.min(1, (patch.pick || 0) + fl.pluck)) }) : patch;
              playVoice(p, chHz(ev.channel, n), t0 + cursor * bar + ev.t + fl.timeOffset, ev.dur, ev.vel * fl.velScale, chains[ev.channel]);
@*/
            });
          });
          cursor += 1;
        }
      }, 25);
    }

    // ── wind/ambience: filtered seeded noise, two incommensurate LFO drifts ──
    function wind(params) {
      const p = params || {};
/*@x{*/
      // vary: the 4.37 s buffer, so the bed has no audible 1 s period.
      const src = ctx.createBufferSource(); src.buffer = p.vary ? longNoise() : noiseBuffer(); src.loop = true;
/*|
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
@*/
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
/*@mix{*/
      routeChannel,
      setMaster,
/*|
@*/
      playVoice,
/*@strings{*/
      stringBuffer,
/*|
@*/
/*@mix{*/
      impulse(r, seed) { return r && r.model === 'room2' ? roomImpulse(r, seed) : reverbImpulse(r && r.decay, seed); },
/*|
@*/
/*@sfx{*/
      playCue(gestures, when, dest, velScale, variant) { playOps(cuePlan(gestures, variant), when == null ? ctx.currentTime : when, dest, velScale); },
/*|
      playCue(gestures, when, dest, velScale) { playOps(cuePlan(gestures), when == null ? ctx.currentTime : when, dest, velScale); },
@*/
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
/*@va{*/
    stepKeep,
/*|
@*/
/*@score{*/
    scored,
    scoreClock,
    scoreEvents,
/*|
@*/
/*@voice{*/
    noteKey,
    glideNotes,
    resolvePatch,
/*|
@*/
    chordVoiceNotes,
    patternEvents,
    gesturePlan,
    cuePlan,
    createEngine,
  };
}
