import { describe, expect, it } from 'vitest';

import { buildBeatsKernel } from './beats-kernel.js';
import { PATCHES, getPatch } from './audio-patches.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';

// ── DETERMINISM CONTRACT (beats.plan.md → doctrine) ─────────────────────────────
// The kernel's value in the substrate rests on one property: same recipe + same
// seed → the same performance, with any bar reproducible WITHOUT playing the bars
// before it. These tests are the muted-capture / replay guarantee in miniature.

const K = buildBeatsKernel();

const AMBIENT = {
  kind: 'beats-ambient',
  title: 'test loop',
  bpm: 84,
  swing: 0.12,
  seed: 20260704,
  progression: [
    { chord: ['D3', 'F3', 'A3', 'C4', 'E4'], root: 'D2' },
    { chord: ['Bb2', 'D3', 'F3', 'A3'], root: 'Bb1' },
    { chord: ['F3', 'A3', 'C4', 'E4'], root: 'F2' },
    { chord: ['G2', 'Bb2', 'D3', 'F3'], root: 'G1' },
  ],
  channels: [
    { name: 'pads', role: 'harmony', patch: 'pad', chain: [{ type: 'chorus' }, { type: 'reverb', decay: 8, wet: 0.55 }] },
    { name: 'bass', role: 'roots', patch: 'bassMono' },
    { name: 'arp', role: 'melody', patch: 'sinePluck', chain: [{ type: 'pingpong', time: 0.5, feedback: 0.35 }], sequence: { table: ['D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'A5'], gate: 0.7 } },
    { name: 'kick', role: 'pulse', patch: 'kick', note: 'C1', steps: [1, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 0, 0, 0] },
    { name: 'hats', role: 'pulse', patch: 'hat', note: 'C5', dropout: 0.15, steps: [0, 0.5, 0.9, 0.4, 0, 0.6, 0.9, 0.4, 0, 0.5, 0.9, 0.4, 0, 0.6, 0.9, 0.5] },
  ],
};

describe('mulberry32 / hashSeed', () => {
  it('same seed → same sequence; different seed → different sequence', () => {
    const a = K.mulberry32(42);
    const b = K.mulberry32(42);
    const c = K.mulberry32(43);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    const seqC = [c(), c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    seqA.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
  });

  it('hashSeed separates adjacent bars', () => {
    expect(K.hashSeed(1, 0)).not.toBe(K.hashSeed(1, 1));
    expect(K.hashSeed(1, 5)).toBe(K.hashSeed(1, 5));
    expect(K.hashSeed(2, 5)).not.toBe(K.hashSeed(1, 5));
  });
});

describe('note + time math', () => {
  it('parses note names to Hz', () => {
    expect(K.noteHz('A4')).toBeCloseTo(440, 6);
    expect(K.noteHz('C4')).toBeCloseTo(261.6256, 3);
    expect(K.noteHz('Bb1')).toBeCloseTo(58.2705, 3);
    expect(K.noteHz('F#3')).toBeCloseTo(184.9972, 3);
    expect(() => K.noteHz('H2')).toThrow(/bad note/);
  });

  it('parses bar:beat:sixteenth against bpm', () => {
    // at 120bpm a beat is 0.5s; '0:2:2' = 2.5 beats = 1.25s; one bar (4/4) = 2s.
    expect(K.timeToSeconds('0:2:2', 120)).toBeCloseTo(1.25, 9);
    expect(K.timeToSeconds('1:0:0', 120)).toBeCloseTo(2, 9);
    expect(K.timeToSeconds(3, 120)).toBeCloseTo(1.5, 9);
    expect(K.barSeconds(84)).toBeCloseTo((60 / 84) * 4, 9);
  });

  it('swing delays only the offbeat eighths', () => {
    expect(K.swungEighth(0, 120, 0.2)).toBeCloseTo(0, 9);
    expect(K.swungEighth(2, 120, 0.2)).toBeCloseTo(0.5, 9);
    expect(K.swungEighth(1, 120, 0.2)).toBeGreaterThan(0.25);
  });

  it('fxTimeSeconds resolves note fractions against bpm (B5.0)', () => {
    // '3/16' of a whole note = the dotted-eighth dub delay: 45/bpm seconds.
    expect(K.fxTimeSeconds('3/16', 132)).toBeCloseTo(45 / 132, 9);
    expect(K.fxTimeSeconds('3/16', 132)).toBeCloseTo((60 / 132 / 2) * 1.5, 9);
    expect(K.fxTimeSeconds('1/4', 120)).toBeCloseTo(0.5, 9); // one beat
    expect(K.fxTimeSeconds(0.375, 999)).toBe(0.375);          // seconds pass through
    expect(K.fxTimeSeconds(undefined, 120, 0.375)).toBe(0.375);
    expect(() => K.fxTimeSeconds('fast', 120)).toThrow(/note fraction/);
    expect(() => K.fxTimeSeconds('3/0', 120)).toThrow(/note fraction/);
  });
});

describe('ambientBarEvents — the determinism contract', () => {
  it('same (recipe, bar) → identical events on every call', () => {
    const a = K.ambientBarEvents(AMBIENT, 3);
    const b = K.ambientBarEvents(AMBIENT, 3);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('bars are independent of playback order (bar 7 without bars 0-6)', () => {
    const direct = K.ambientBarEvents(AMBIENT, 7);
    K.ambientBarEvents(AMBIENT, 0);
    K.ambientBarEvents(AMBIENT, 1);
    const afterOthers = K.ambientBarEvents(AMBIENT, 7);
    expect(afterOthers).toEqual(direct);
  });

  it('a different seed changes the generative channels but not the score', () => {
    const a = K.ambientBarEvents(AMBIENT, 2);
    const b = K.ambientBarEvents({ ...AMBIENT, seed: 999 }, 2);
    // harmony + roots are score, not dice: identical under any seed.
    const score = (evs) => evs.filter((e) => e.channel === 'pads' || e.channel === 'bass');
    expect(score(a)).toEqual(score(b));
    expect(a).not.toEqual(b);
  });

  it('the progression cycles by bar and the gate produces rests', () => {
    const bar0 = K.ambientBarEvents(AMBIENT, 0);
    const bar1 = K.ambientBarEvents(AMBIENT, 1);
    expect(bar0.find((e) => e.channel === 'bass').notes).toEqual(['D2']);
    expect(bar1.find((e) => e.channel === 'bass').notes).toEqual(['Bb1']);
    // gate 0.7 over 8 slots: strictly fewer arp events than slots, across many bars.
    let arpTotal = 0;
    for (let i = 0; i < 32; i++) arpTotal += K.ambientBarEvents(AMBIENT, i).filter((e) => e.channel === 'arp').length;
    expect(arpTotal).toBeGreaterThan(0);
    expect(arpTotal).toBeLessThan(32 * 8);
  });

  it('every event falls inside its bar and cites a real channel', () => {
    const bar = K.barSeconds(AMBIENT.bpm);
    const names = new Set(AMBIENT.channels.map((c) => c.name));
    for (let i = 0; i < 8; i++) {
      for (const ev of K.ambientBarEvents(AMBIENT, i)) {
        expect(ev.t).toBeGreaterThanOrEqual(0);
        expect(ev.t).toBeLessThan(bar + 1e-9);
        expect(names.has(ev.channel)).toBe(true);
        expect(ev.vel).toBeGreaterThan(0);
        ev.notes.forEach((n) => expect(() => K.noteHz(n)).not.toThrow());
      }
    }
  });
});

describe('compositionEvents', () => {
  const COMP = {
    kind: 'beats-composition',
    bpm: 120,
    parts: [
      { name: 'melody', patch: 'sinePluck', events: [['0:0:0', 'C4', '0:1:0', 0.8], ['0:1:0', ['E4', 'G4'], '0:1:0', 0.6]] },
      { name: 'bass', patch: 'bassMono', events: [['0:0:0', 'C2', '1:0:0', 0.9]] },
    ],
  };

  it('flattens, sorts, and reports duration', () => {
    const { events, duration } = K.compositionEvents(COMP);
    expect(events).toHaveLength(3);
    expect(events[0].t).toBe(0);
    expect(events.map((e) => e.t)).toEqual([...events.map((e) => e.t)].sort((x, y) => x - y));
    expect(duration).toBeCloseTo(2, 9); // the whole-bar bass note at 120bpm
    expect(events.find((e) => e.channel === 'melody' && e.notes.length === 2).notes).toEqual(['E4', 'G4']);
  });

  it('is deterministic — no dice anywhere', () => {
    expect(K.compositionEvents(COMP)).toEqual(K.compositionEvents(COMP));
  });

  it('applies swing to on-grid offbeat sixteenths and nothing else (B5.0)', () => {
    // at 120bpm a sixteenth is 0.125s; swing 0.3 delays offbeats by 0.3 × 0.125 × 2/3.
    const swung = {
      kind: 'beats-composition', bpm: 120, swing: 0.3,
      parts: [{ name: 'hat', patch: 'hat', events: [
        ['0:0:0', 'C5'],          // downbeat — never swings
        ['0:0:1', 'C5'],          // offbeat sixteenth — swings
        ['0:0:2', 'C5'],          // even sixteenth — straight
        [0.126, 'C5'],            // off-grid micro-timing (bare beats) — untouched
      ] }],
    };
    const { events } = K.compositionEvents(swung);
    const lateBy = 0.3 * 0.125 * (2 / 3);
    const times = events.map((e) => e.t);
    const at = (t) => times.some((x) => Math.abs(x - t) < 1e-9);
    expect(at(0)).toBe(true);                // downbeat — never swings
    expect(at(0.125 + lateBy)).toBe(true);   // offbeat sixteenth — swung late
    expect(at(0.125)).toBe(false);           //   …and gone from its straight slot
    expect(at(0.25)).toBe(true);             // even sixteenth — straight
    // bare-number times are beats: 0.126 beats = 0.063s, off-grid — untouched.
    expect(at(0.063)).toBe(true);
    // swing 0 (or absent) leaves everything exactly where it was written.
    const straight = K.compositionEvents({ ...swung, swing: 0 });
    expect(straight.events.some((e) => Math.abs(e.t - 0.125) < 1e-9)).toBe(true);
    // still deterministic with swing on.
    expect(K.compositionEvents(swung)).toEqual(K.compositionEvents(swung));
  });
});

describe('patternEvents — the groove-instrument kind (B5.1)', () => {
  // the Night Bus spike's core groove, reduced: 2 bars, swung, mixed instruments.
  const PATTERN = {
    kind: 'beats-pattern',
    title: 'night bus (test)',
    bpm: 132,
    swing: 0.34,
    steps: 32,
    tracks: [
      { name: 'kick', gesture: { type: 'thump', from: 'G2', to: 'G0', decay: 0.35 },
        mask: [1, 0, 0, 0, 0.9, 0, 0, 0, 1, 0, 0, 0, 0.9, 0, 0, 0, 1, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0.85, 0, 0.9, 0, 0, 0] },
      { name: 'clap', cue: [{ type: 'burst', decay: 0.05 }, { type: 'burst', at: 0.013, decay: 0.24 }],
        mask: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },   // 16 slots — wraps per bar
      { name: 'bass', patch: 'bassMono',
        mask: [1, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 0, 0.9, 0, 0, 0, 0.8, 0],
        notes: ['F1', 'F1', 'F1', 'F1', 'F1', 'F1', 'Ab1', 'Ab1', 'F1', 'F1', 'C2', 'C2', 'F1', 'F1', 'Eb2', 'Eb2'] },
      { name: 'hats', patch: 'hat', note: 'C5',
        mask: [0, 0, 1, 0, 0, 0, 1, 0.45, 0, 0, 1, 0, 0, 0, 1, 0.45] },
    ],
  };

  it('is deterministic and loops over its declared step count', () => {
    const a = K.patternEvents(PATTERN);
    expect(a).toEqual(K.patternEvents(PATTERN));
    expect(a.duration).toBeCloseTo(32 * (60 / 132 / 4), 9);
    for (const ev of a.events) {
      expect(ev.t).toBeGreaterThanOrEqual(0);
      expect(ev.t).toBeLessThan(a.duration + 1e-9);
    }
  });

  it('masks shorter than steps wrap — a 16-slot clap hits both bars', () => {
    const claps = K.patternEvents(PATTERN).events.filter((e) => e.channel === 'clap');
    expect(claps).toHaveLength(4);   // steps 4, 12, 20, 28
    const sixteenth = 60 / 132 / 4;
    expect(claps.map((e) => Math.round(e.t / sixteenth))).toEqual([4, 12, 20, 28]);
  });

  it('swing lands odd sixteenths late, straight steps stay put', () => {
    const sixteenth = 60 / 132 / 4;
    const events = K.patternEvents(PATTERN).events;
    const ghost = events.filter((e) => e.channel === 'hats' && e.vel === 0.45);
    ghost.forEach((e) => {
      const i = Math.round((e.t - 0.34 * sixteenth * (2 / 3)) / sixteenth);
      expect(i % 2).toBe(1);   // ghosts sit on odd sixteenths, swung late
    });
    const kick0 = events.find((e) => e.channel === 'kick');
    expect(kick0.t).toBeCloseTo(0, 9);   // downbeat never swings
  });

  it('note contours wrap and gesture tracks still carry velocity', () => {
    const events = K.patternEvents(PATTERN).events;
    const sixteenth = 60 / 132 / 4;
    const bassAt = (step) => events.find((e) => e.channel === 'bass' && Math.abs(e.t - step * sixteenth) < sixteenth / 2);
    expect(bassAt(6).notes).toEqual(['Ab1']);    // contour position 6
    expect(bassAt(22).notes).toEqual(['Ab1']);   // wrapped: 22 % 16 = 6
    const brokenKick = events.find((e) => e.channel === 'kick' && e.vel === 0.85);
    expect(Math.round(brokenKick.t / sixteenth)).toBe(26);   // bar-2 garage skip
  });

  it('a contour entry may be a chord — the garage stab', () => {
    const p = {
      kind: 'beats-pattern', bpm: 132, steps: 16,
      tracks: [{ name: 'stab', patch: 'sawStab', mask: [0, 0, 0, 0, 0, 0, 0, 0.9], notes: [['F3', 'Ab3', 'C4', 'G4']] }],
    };
    const { events } = K.patternEvents(p);
    expect(events).toHaveLength(2);   // step 7 + wrapped step 15
    expect(events[0].notes).toEqual(['F3', 'Ab3', 'C4', 'G4']);
  });

  it('velocity semantics match pulse: 0 rests, true → 0.9', () => {
    const p = { kind: 'beats-pattern', bpm: 120, steps: 8, tracks: [{ name: 'x', patch: 'hat', mask: [true, 0, 0.5, 0] }] };
    const { events } = K.patternEvents(p);
    expect(events).toHaveLength(4);   // 2 wraps of [true, 0, .5, 0]
    expect(events[0].vel).toBe(0.9);
    expect(events[1].vel).toBe(0.5);
  });
});

describe('gesturePlan / cuePlan — the foley vocabulary', () => {
  it('sweep lowers to one pitch-ramp op', () => {
    const ops = K.gesturePlan({ type: 'sweep', from: 'A5', to: 'A4', dur: 0.09 });
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('sweep');
    expect(ops[0].from).toBeCloseTo(880, 3);
    expect(ops[0].to).toBeCloseTo(440, 3);
  });

  it('flutter expands to rateHz ticks with tiered table swaps', () => {
    const ops = K.gesturePlan({
      type: 'flutter', rateHz: 30, hold: 1,
      tiers: [{ at: 0, table: ['E4'] }, { at: 0.5, table: ['E5'] }],
    });
    expect(ops).toHaveLength(30);
    const early = ops.filter((o) => o.at < 0.5);
    const late = ops.filter((o) => o.at >= 0.5);
    early.forEach((o) => expect(o.hz).toBeCloseTo(K.noteHz('E4'), 6));
    late.forEach((o) => expect(o.hz).toBeCloseTo(K.noteHz('E5'), 6));
  });

  it('burst and thump carry their envelopes; unknown gestures teach', () => {
    expect(K.gesturePlan({ type: 'burst' })[0]).toMatchObject({ kind: 'noise', decay: 0.15 });
    expect(K.gesturePlan({ type: 'thump' })[0].from).toBeGreaterThan(K.gesturePlan({ type: 'thump' })[0].to);
    expect(() => K.gesturePlan({ type: 'wobble' })).toThrow(/sweep \| flutter \| burst \| thump/);
  });

  it('cuePlan merges gestures sorted by onset — pure on repeated calls', () => {
    const cue = [{ type: 'burst', at: 0.1 }, { type: 'sweep', at: 0 }];
    const a = K.cuePlan(cue);
    expect(a.map((o) => o.kind)).toEqual(['sweep', 'noise']);
    expect(K.cuePlan(cue)).toEqual(a);
  });

  it('grain scatters seeded band-shaped noise ops — same seed same grit, new seed new grit', () => {
    const g = { type: 'grain', grains: 8, over: 0.2, decay: [0.01, 0.03], band: { lo: 800, hi: 4000 }, seed: 7 };
    const ops = K.gesturePlan(g);
    expect(ops).toHaveLength(8);
    ops.forEach((o) => {
      expect(o.kind).toBe('noise');
      expect(o.at).toBeGreaterThanOrEqual(0);
      expect(o.at).toBeLessThanOrEqual(0.2);
      expect(o.decay).toBeGreaterThanOrEqual(0.01);
      expect(o.decay).toBeLessThanOrEqual(0.03);
      expect(o.highpass).toBe(800);
      expect(o.lowpass).toBe(4000);
    });
    for (let i = 1; i < ops.length; i++) expect(ops[i].at).toBeGreaterThanOrEqual(ops[i - 1].at);
    expect(K.gesturePlan(g)).toEqual(ops);
    expect(K.gesturePlan({ ...g, seed: 8 })).not.toEqual(ops);
  });

  it('ring lowers material partials to flat thumps — brights die first', () => {
    const ops = K.gesturePlan({ type: 'ring', note: 'C7', material: 'glass' });
    expect(ops.length).toBeGreaterThanOrEqual(4);
    ops.forEach((o) => { expect(o.kind).toBe('thump'); expect(o.from).toBeCloseTo(o.to, 9); });
    expect(ops[0].from).toBeCloseTo(K.noteHz('C7'), 3);
    for (let i = 1; i < ops.length; i++) {
      expect(ops[i].from).toBeGreaterThan(ops[i - 1].from);
      expect(ops[i].decay).toBeLessThan(ops[i - 1].decay);
    }
    const custom = K.gesturePlan({ type: 'ring', hz: 1000, partials: [{ ratio: 1 }, { ratio: 3.1, gain: 0.5, decay: 0.4 }] });
    expect(custom).toHaveLength(2);
    expect(custom[1].from).toBeCloseTo(3100, 3);
  });

  it('flutter jitter wobbles timing and pitch, seeded; jitter 0 is the pre-spike path', () => {
    const base = { type: 'flutter', rateHz: 13, hold: 1, tiers: [{ at: 0, table: ['D3'] }] };
    const straight = K.gesturePlan(base);
    expect(K.gesturePlan({ ...base, jitter: 0 })).toEqual(straight);
    const creak = K.gesturePlan({ ...base, jitter: 0.8, seed: 3 });
    expect(creak).toHaveLength(straight.length);
    expect(creak).not.toEqual(straight);
    expect(K.gesturePlan({ ...base, jitter: 0.8, seed: 3 })).toEqual(creak);
    const hz = K.noteHz('D3');
    creak.forEach((o) => {
      expect(o.hz).toBeGreaterThan(hz * Math.pow(2, -80 / 1200) - 1e-9);
      expect(o.hz).toBeLessThan(hz * Math.pow(2, 80 / 1200) + 1e-9);
    });
  });
});

describe('audio-patches', () => {
  it('patches are pure param sets and getPatch never mutates the shelf', () => {
    const before = JSON.parse(JSON.stringify(PATCHES));
    const p = getPatch('pad', { volume: -20 });
    expect(p.volume).toBe(-20);
    expect(PATCHES).toEqual(before);
    expect(() => getPatch('nope')).toThrow(/Known patches/);
  });

  it('sawStab carries the B5.0 expressive fields (filterEnv + detuned unison)', () => {
    const p = getPatch('sawStab');
    expect(p.voice).toBe('osc');
    expect(p.wave).toBe('sawtooth');
    expect(p.unison).toBeGreaterThan(1);
    expect(p.detune).toBeGreaterThan(0);
    expect(p.filterEnv.from).toBeGreaterThan(p.filterEnv.to);
    expect(p.filterEnv.decay).toBeGreaterThan(0);
  });
});

describe('beats-manifest validation', () => {
  it('accepts the reference ambient recipe and normalizes defaults', () => {
    const { ok, errors } = validateBeatsManifest(AMBIENT);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
    const norm = normalizeBeatsManifest({ ...AMBIENT, channels: [{ name: 'pads', role: 'harmony' }] });
    expect(norm.channels[0].patch).toBe('pad');
  });

  it('teaches on the load-bearing mistakes', () => {
    expect(validateBeatsManifest({ kind: 'beats-ambient', title: 'x', bpm: 84, progression: AMBIENT.progression, channels: AMBIENT.channels }).errors.join(' ')).toMatch(/seed is required/);
    expect(validateBeatsManifest({ ...AMBIENT, channels: [{ name: 'a', role: 'melody', sequence: { table: ['H9'] } }] }).errors.join(' ')).toMatch(/not a note name/);
    expect(validateBeatsManifest({ kind: 'beats-sfx', title: 'x', cues: { zap: [{ type: 'wobble' }] } }).errors.join(' ')).toMatch(/sweep, flutter, burst, thump/);
    expect(validateBeatsManifest({ kind: 'beats-drone', title: 'x' }).errors.join(' ')).toMatch(/beats-ambient/);
  });

  it('validates compositions', () => {
    const good = { kind: 'beats-composition', title: 'x', bpm: 120, parts: [{ name: 'p', patch: 'fmBell', events: [['0:0:0', 'C4']] }] };
    expect(validateBeatsManifest(good).ok).toBe(true);
    const bad = { ...good, parts: [{ name: 'p', patch: 'nope', events: [['0:0:0', 'C4']] }] };
    expect(validateBeatsManifest(bad).errors.join(' ')).toMatch(/patch 'nope' is unknown/);
  });

  it('validates and normalizes beats-pattern (B5.1)', () => {
    const good = {
      kind: 'beats-pattern', title: 'x', bpm: 132, swing: 0.34,
      tracks: [
        { name: 'kick', gesture: { type: 'thump' }, mask: [1, 0, 0, 0] },
        { name: 'bass', patch: 'bassMono', mask: [1, 0, true, 0], notes: ['F1', 'Ab1'] },
      ],
    };
    expect(validateBeatsManifest(good).errors).toEqual([]);
    const norm = normalizeBeatsManifest(good);
    expect(norm.steps).toBe(32);
    expect(norm.tracks[0].mask).toHaveLength(32);            // expanded to full loop
    expect(norm.tracks[1].mask[2]).toBe(0.9);                // true → 0.9
    expect(norm.tracks[1].notes).toHaveLength(32);           // contour expanded too
    expect(norm.tracks[1].notes[3]).toBe('Ab1');             // wrapping preserved
  });

  it('teaches on beats-pattern mistakes', () => {
    const base = { kind: 'beats-pattern', title: 'x', bpm: 132 };
    expect(validateBeatsManifest({ ...base }).errors.join(' ')).toMatch(/tracks is required/);
    // zero instruments and two instruments both teach.
    expect(validateBeatsManifest({ ...base, tracks: [{ name: 'a', mask: [1] }] }).errors.join(' '))
      .toMatch(/exactly ONE voice/);
    expect(validateBeatsManifest({ ...base, tracks: [{ name: 'a', patch: 'hat', gesture: { type: 'burst' }, mask: [1] }] }).errors.join(' '))
      .toMatch(/got patch \+ gesture/);
    expect(validateBeatsManifest({ ...base, tracks: [{ name: 'a', patch: 'hat' }] }).errors.join(' '))
      .toMatch(/mask is required/);
    expect(validateBeatsManifest({ ...base, tracks: [{ name: 'a', patch: 'hat', mask: [2] }] }).errors.join(' '))
      .toMatch(/velocity in \[0, 1\]/);
    expect(validateBeatsManifest({ ...base, steps: 7, tracks: [{ name: 'a', patch: 'hat', mask: [1] }] }).errors.join(' '))
      .toMatch(/steps must be an integer in \[8, 64\]/);
    expect(validateBeatsManifest({ ...base, tracks: [{ name: 'a', patch: 'hat', mask: [1], notes: ['H9'] }] }).errors.join(' '))
      .toMatch(/not a note name/);
  });

  it('accepts note-fraction fx times and teaches on bad ones (B5.0)', () => {
    const part = (chain) => ({ kind: 'beats-composition', title: 'x', bpm: 132, parts: [{ name: 'p', patch: 'sawStab', chain, events: [['0:0:1', 'C4']] }] });
    expect(validateBeatsManifest(part([{ type: 'delay', time: '3/16', feedback: 0.34 }])).ok).toBe(true);
    expect(validateBeatsManifest(part([{ type: 'pingpong', time: 0.375 }])).ok).toBe(true);
    expect(validateBeatsManifest(part([{ type: 'delay', time: 'fast' }])).errors.join(' ')).toMatch(/note fraction like "3\/16"/);
    expect(validateBeatsManifest(part([{ type: 'delay', time: '3/0' }])).errors.join(' ')).toMatch(/note fraction/);
  });
});

describe('noteFeel — the anti-MIDI performance layer', () => {
  const FEEL = { strum: 0.02, jitterTime: 0.006, jitterVel: 0.1, jitterTimbre: 0.05 };

  it('a null feel is perfectly quantized (zero offset, unit velocity, no pluck drift)', () => {
    for (let ni = 0; ni < 4; ni++) {
      const f = K.noteFeel(undefined, 7, 3, ni, 4);
      expect(f.timeOffset).toBeCloseTo(0, 10);
      expect(f.velScale).toBe(1);
      expect(f.pluck).toBeCloseTo(0, 10);
    }
  });

  it('is deterministic in (seed, eventIndex, noteIndex) — same inputs, same feel', () => {
    const a = K.noteFeel(FEEL, 123, 5, 2, 4);
    const b = K.noteFeel(FEEL, 123, 5, 2, 4);
    expect(a).toEqual(b);
    // different note / event / seed → different feel
    expect(K.noteFeel(FEEL, 123, 5, 3, 4)).not.toEqual(a);
    expect(K.noteFeel(FEEL, 123, 6, 2, 4)).not.toEqual(a);
    expect(K.noteFeel(FEEL, 124, 5, 2, 4)).not.toEqual(a);
  });

  it('strum fans a chord out in note order, low string first (downstroke)', () => {
    const strumOnly = { strum: 0.02 };
    const offs = [0, 1, 2, 3].map((ni) => K.noteFeel(strumOnly, 1, 0, ni, 4).timeOffset);
    expect(offs[0]).toBe(0);                       // first note lands on the beat
    expect(offs[1]).toBeGreaterThan(offs[0]);      // each later string is progressively later
    expect(offs[2]).toBeGreaterThan(offs[1]);
    expect(offs[3]).toBeGreaterThan(offs[2]);
    expect(offs[3]).toBeLessThan(0.02 * 3 * 1.2);  // bounded by strum × (count-1) × humanize
  });

  it('strumUp reverses the fan (high string first)', () => {
    const down = K.noteFeel({ strum: 0.02 }, 1, 0, 0, 4).timeOffset;
    const up = K.noteFeel({ strum: 0.02, strumUp: true }, 1, 0, 0, 4).timeOffset;
    expect(down).toBe(0);       // downstroke: first note is earliest
    expect(up).toBeGreaterThan(0); // upstroke: first note is last, so it is offset
  });

  it('jitter stays within its declared bounds', () => {
    for (let ev = 0; ev < 40; ev++) {
      const f = K.noteFeel({ jitterVel: 0.1, jitterTimbre: 0.05 }, 99, ev, 0, 1);
      expect(f.velScale).toBeGreaterThanOrEqual(0.9);
      expect(f.velScale).toBeLessThanOrEqual(1.1);
      expect(Math.abs(f.pluck)).toBeLessThanOrEqual(0.05);
    }
  });
});

describe('harmony bus — chord-following tracks (B7)', () => {
  const CHORDS = { Fm: ['F3', 'Ab3', 'C4'], Bb: ['Bb3', 'D4', 'F4'] };

  it('chordVoiceNotes derives notes per mode', () => {
    const c = CHORDS.Fm;
    expect(K.chordVoiceNotes('chord', c, 0)).toEqual(['F3', 'Ab3', 'C4']); // whole chord
    expect(K.chordVoiceNotes(true, c, 0)).toEqual(['F3', 'Ab3', 'C4']);    // true = chord
    expect(K.chordVoiceNotes('root', c, 5)).toEqual(['F3']);               // lowest note
    expect(K.chordVoiceNotes('upper', c, 0)).toEqual(['Ab3', 'C4']);       // chord minus root (bass takes root)
    expect(K.chordVoiceNotes('arp', c, 0)).toEqual(['F3']);                // walks up by step
    expect(K.chordVoiceNotes('arp', c, 1)).toEqual(['Ab3']);
    expect(K.chordVoiceNotes('arp', c, 3)).toEqual(['F3']);                // wraps (3 % 3)
    expect(K.chordVoiceNotes('chord', [], 0)).toEqual([]);                 // no chord → nothing
  });

  it('a chordVoice track reads the shared progression, not its own notes', () => {
    const recipe = {
      kind: 'beats-pattern', bpm: 120, steps: 4,
      chords: CHORDS,
      progression: ['Fm', 'Fm', 'Bb', 'Bb'], // already per-step
      tracks: [
        { name: 'gtr', patch: 'guitarClean', chordVoice: 'chord', mask: [1, 0, 1, 0] },
        { name: 'bass', patch: 'bassMono', chordVoice: 'root', mask: [1, 1, 1, 1] },
      ],
    };
    const { events } = K.patternEvents(recipe);
    const gtr = events.filter((e) => e.channel === 'gtr');
    expect(gtr.map((e) => e.notes)).toEqual([['F3', 'Ab3', 'C4'], ['Bb3', 'D4', 'F4']]); // steps 0 & 2
    const bass = events.filter((e) => e.channel === 'bass');
    expect(bass.map((e) => e.notes[0])).toEqual(['F3', 'F3', 'Bb3', 'Bb3']); // root follows the chord
  });

  it('change the chord chart → every chord voice follows (one edit moves the band)', () => {
    const mk = (prog) => ({
      kind: 'beats-pattern', bpm: 120, steps: 2, chords: CHORDS, progression: prog,
      tracks: [{ name: 'g', patch: 'guitarClean', chordVoice: 'chord', mask: [1, 1] }],
    });
    const a = K.patternEvents(mk(['Fm', 'Fm'])).events.map((e) => e.notes);
    const b = K.patternEvents(mk(['Bb', 'Bb'])).events.map((e) => e.notes);
    expect(a).toEqual([['F3', 'Ab3', 'C4'], ['F3', 'Ab3', 'C4']]);
    expect(b).toEqual([['Bb3', 'D4', 'F4'], ['Bb3', 'D4', 'F4']]);
  });
});

describe('kernel emission contract', () => {
  it('buildBeatsKernel is a self-contained closure (emittable via .toString())', () => {
    const src = buildBeatsKernel.toString();
    // the page evals `(src)()` — it must not reference module imports.
    expect(src).not.toMatch(/require\(|import /);
    // eslint-disable-next-line no-new-func
    const rebuilt = new Function(`return (${src})()`)();
    expect(rebuilt.noteHz('A4')).toBeCloseTo(440, 6);
    expect(rebuilt.ambientBarEvents(AMBIENT, 3)).toEqual(K.ambientBarEvents(AMBIENT, 3));
  });
});

describe('performance macros — transpose + tone (B5.2)', () => {
  it('toneFreq maps [0,1] exponentially 120Hz → 18kHz, open by default', () => {
    expect(K.toneFreq(0)).toBeCloseTo(120, 6);
    expect(K.toneFreq(1)).toBeCloseTo(18000, 6);
    expect(K.toneFreq(undefined)).toBeCloseTo(18000, 6);   // null position = open
    expect(K.toneFreq(0.5)).toBeCloseTo(120 * Math.sqrt(150), 6);
    expect(K.toneFreq(2)).toBeCloseTo(18000, 6);           // clamped
    expect(K.toneFreq(-1)).toBeCloseTo(120, 6);
  });

  it('validation accepts macro fields on every musical kind and teaches on bad values', () => {
    const pattern = {
      kind: 'beats-pattern', title: 'macro grid', bpm: 132,
      tracks: [
        { name: 'kick', patch: 'kick', mask: [1, 0, 0, 0], transpose: -2, tone: 0.7 },
        { name: 'stab', patch: 'sawStab', mask: [0, 1], notes: ['A3'], tone: 0.4 },
      ],
    };
    expect(validateBeatsManifest(pattern).ok).toBe(true);

    const bad = validateBeatsManifest({
      ...pattern,
      tracks: [{ name: 'kick', patch: 'kick', mask: [1], transpose: 99, tone: 3 }],
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join('\n')).toMatch(/transpose must be a number in \[-24, 24\]/);
    expect(bad.errors.join('\n')).toMatch(/tone must be a number in \[0, 1\]/);
  });

  it('macro values round-trip through normalize on all three musical kinds', () => {
    const pattern = normalizeBeatsManifest({
      kind: 'beats-pattern', title: 't', bpm: 120,
      tracks: [{ name: 'kick', patch: 'kick', mask: [1, 0], transpose: 3, tone: 0.55 }],
    });
    expect(pattern.tracks[0].transpose).toBe(3);
    expect(pattern.tracks[0].tone).toBe(0.55);

    const comp = normalizeBeatsManifest({
      kind: 'beats-composition', title: 't', bpm: 100,
      parts: [{ name: 'lead', patch: 'sinePluck', events: [['0:0:0', 'A4']], transpose: -12 }],
    });
    expect(comp.parts[0].transpose).toBe(-12);
    expect(comp.parts[0].tone).toBeUndefined();   // absent stays absent (null path)

    const amb = normalizeBeatsManifest({ ...AMBIENT, channels: AMBIENT.channels.map((c) => ({ ...c, tone: 0.8 })) });
    for (const ch of amb.channels) expect(ch.tone).toBe(0.8);
  });

  it('engine macro surface exists in the emitted kernel (setTranspose/setTone/setLevel/getMacro)', () => {
    const src = buildBeatsKernel.toString();
    for (const name of ['setTranspose', 'setTone', 'setLevel', 'getMacro', 'toneFreq']) {
      expect(src).toContain(name);
    }
  });
});
