import { describe, expect, it } from 'vitest';

import { buildBeatsKernel } from './beats-kernel.js';
import { renderBeatsOffline, renderBeatsPlan } from './beats-render.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { decodeWav, rms, peak, bandpass, pitchHz, cents, centroid, magnitudeSpectrum, t60, lrCorrelation } from './audio-measure.js';
import { beatsFeatures } from './beats-features.js';

// Orchestra and era synthesis — the machine gates, phase by phase. Every
// behavior here is opt-in (a new field, patch or instrument name);
// beats-render.baseline.test.js pins that recipes without them render
// byte-identical. None of this is an ears gate: nobody listened here.

const K = buildBeatsKernel();
const SR = 44100;
const comp = (parts, extra = {}) => ({ kind: 'beats-composition', title: 'era probe', bpm: 120, seed: 7, parts, ...extra });
async function render(manifest, opts = {}) {
  const r = await renderBeatsOffline(normalizeBeatsManifest(manifest), { tail: 0.5, ...opts });
  return { ...decodeWav(r.wav), wav: r.wav };
}
// sample indices where the envelope rises through `th` after at least `gap` s below it.
function onsets(y, th = 0.02, gap = 0.05) {
  const out = [];
  let quiet = Math.round(gap * SR);
  for (let i = 0; i < y.length; i++) {
    if (Math.abs(y[i]) >= th) { if (quiet >= gap * SR) out.push(i); quiet = 0; } else quiet++;
  }
  return out;
}

describe('phase 0 — the score substrate', () => {
  it('gate: 3/4 downbeats are exactly 3 beats apart; a meter map changes bar length from its bar on', () => {
    const c = K.scoreClock({ bpm: 90, meter: '3/4' });
    const bars = c.barTimes(5);
    for (let i = 1; i < bars.length; i++) expect(bars[i] - bars[i - 1]).toBeCloseTo(3 * (60 / 90), 12);
    const m = K.scoreClock({ bpm: 120, meters: [{ at: 2, meter: '3/4' }, { at: 4, meter: '6/8' }, { at: 5, meter: '7/8' }] });
    expect(m.barTimes(7).map((t) => +(t / 0.5).toFixed(9))).toEqual([0, 4, 8, 11, 14, 17, 20.5]);
    expect(m.q('3:1:2')).toBe(11 + 1.5);
  });

  it('gate: a 3/4 score renders its downbeats 3 beats apart (onsets, ±1 sample)', async () => {
    const { channels } = await render(comp([{ name: 'click', patch: 'fmBell', events: [0, 1, 2, 3].map((b) => [`${b}:0:0`, 'A5', '0:0:1', 0.9]) }], { bpm: 90, meter: '3/4' }), { tail: 0.3 });
    const on = onsets(channels[0]);
    expect(on.length).toBe(4);
    for (let i = 1; i < on.length; i++) expect(Math.abs(on[i] - on[i - 1] - 2 * SR)).toBeLessThanOrEqual(1);
  });

  it('gate: a tempo ramp places onsets within 1 ms of the analytic integral (linear and exp)', () => {
    for (const ramp of ['linear', 'exp']) {
      const r = { bpm: 120, tempo: [{ at: '2:0:0', bpm: 120 }, { at: '4:0:0', bpm: 70, ramp }], parts: [{ name: 'q', patch: 'sinePluck', events: Array.from({ length: 24 }, (_, i) => [i, 'C4', 0.5]) }] };
      const got = K.compositionEvents(r).events.map((e) => e.t);
      // independent numeric integral of 60 / bpm(q) dq (Simpson, 2000 steps a beat).
      const bpm = (x) => (x <= 8 ? 120 : x >= 16 ? 70 : ramp === 'linear' ? 120 + (70 - 120) * (x - 8) / 8 : 120 * Math.pow(70 / 120, (x - 8) / 8));
      const secAt = (x) => { const n = Math.max(2, Math.round(x * 2000)) & ~1, h = x / n; let s = 60 / bpm(0) + 60 / bpm(x); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * 60 / bpm(i * h); return (s * h) / 3; };
      got.forEach((t, i) => expect(Math.abs(t - secAt(i))).toBeLessThan(0.001));
      // it really slowed down: the last beat is longer than the first.
      expect(got[23] - got[22]).toBeGreaterThan((got[1] - got[0]) * 1.6);
    }
  });

  const MOTIF = [['0:0:0', 'E4', '0:0:2', 0.7], ['0:0:2', 'G4', '0:0:2', 0.6], ['0:1:0', 'A4', '0:0:2', 0.7], ['0:1:2', 'B4', '0:0:2', 0.6], ['0:2:0', 'D5', '0:1:0', 0.8], ['0:3:0', 'B4', '0:1:0', 0.6]];
  const SHIFTS = [0, 5, -2, 7, 0, 3, 5, -5, 0, 2, 7, 12];
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const up = (n, s) => { const m = /^([A-G]#?)(\d)$/.exec(n); const midi = (Number(m[2]) + 1) * 12 + NAMES.indexOf(m[1]) + s; return NAMES[midi % 12] + (Math.floor(midi / 12) - 1); };
  const formed = comp([{ name: 'lead', patch: 'sinePluck', form: SHIFTS.map((s, i) => ({ phrase: 'A', at: `${i}:0:0`, transpose: s })) }], { phrases: { A: MOTIF } });
  const literal = comp([{ name: 'lead', patch: 'sinePluck', events: SHIFTS.flatMap((s, i) => MOTIF.map(([at, n, d, v]) => { const [, b, x] = at.split(':'); return [`${i}:${b}:${x}`, up(n, s), d, v]; })) }]);

  it('gate: a form-encoded score renders byte-identical to its literal expansion, from a manifest ≥ 60 % smaller', async () => {
    expect(validateBeatsManifest(formed).ok).toBe(true);
    const a = await render(formed);
    const b = await render(literal);
    expect(a.wav.equals(b.wav)).toBe(true);
    const size = (m) => JSON.stringify(normalizeBeatsManifest(m)).length;
    expect(size(formed)).toBeLessThan(0.4 * size(literal));
  });

  it('form transposes, inverts about the first note, reverses, and scales velocity', () => {
    const r = { bpm: 120, phrases: { A: [['0:0:0', 'C4', 1, 0.5], ['0:1:0', 'E4', 1, 0.5], ['0:2:0', 'G4', 2, 0.5]] }, parts: [{ name: 'p', form: [{ phrase: 'A', at: '1:0:0', transpose: 2, vel: 1.5 }, { phrase: 'A', at: '2:0:0', invert: true }, { phrase: 'A', at: '3:0:0', retro: true }] }] };
    const ev = K.compositionEvents(r).events.map((e) => [e.t / 0.5, e.notes[0], e.vel]);
    expect(ev.slice(0, 3)).toEqual([[4, 'D4', 0.75], [5, 'F#4', 0.75], [6, 'A4', 0.75]]);
    expect(ev.slice(3, 6).map((e) => e[1])).toEqual(['C4', 'G#3', 'F3']);
    expect(ev.slice(6).map((e) => [e[0], e[1]])).toEqual([[12, 'G4'], [14, 'E4'], [15, 'C4']]);
  });

  it('object events, dyn marks and the tuple fifth slot all read; dyn replaces v', () => {
    const r = { bpm: 120, parts: [{ name: 'p', events: [{ at: '0:0:0', n: 'C4', d: '0:1:0', dyn: 'pp' }, { at: 1, n: ['E4', 'G4'], v: 0.5 }, ['0:2:0', 'A4', '0:1:0', 0.9, 'tenuto']] }] };
    const ev = K.compositionEvents(r).events;
    expect(ev.map((e) => +e.vel.toFixed(6))).toEqual([0.28, 0.5, 0.945]); // tenuto leans in (× 1.05)
    expect(ev[1].notes).toEqual(['E4', 'G4']);
    expect(ev[0].dur).toBe(0.5);
  });

  it('hairpins lower to per-note velocity, and a held note through one gets a gain lane', () => {
    const r = { bpm: 120, parts: [{ name: 'p', dynamics: [{ at: '0:0:0', to: 'p' }, { at: '1:0:0', to: 'ff', over: '1:0:0' }], events: [...Array.from({ length: 12 }, (_, i) => [i, 'C4', 1]), ['3:0:0', 'C4', '0:1:0', 0.8, null], { at: '1:0:0', n: 'G3', d: '1:0:0' }] }] };
    const ev = K.compositionEvents(r).events.filter((e) => e.notes[0] === 'C4');
    const v = ev.map((e) => e.vel);
    for (let i = 0; i < 4; i++) expect(v[i]).toBeCloseTo(0.4, 9);
    for (let i = 5; i < 8; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
    expect(v[9]).toBeCloseTo(0.88, 9);
    const held = K.compositionEvents(r).events.find((e) => e.notes[0] === 'G3');
    expect(held.pp.amp[0]).toEqual([0, 1]);
    expect(held.pp.amp[4][1]).toBeCloseTo(0.88 / 0.4, 6);
  });

  it('the held note swells in the render (the lane reaches the audio)', async () => {
    const m = comp([{ name: 'p', patch: 'organ', dynamics: [{ at: '0:0:0', to: 'pp' }, { at: '0:0:0', to: 'ff', over: '2:0:0' }], events: [{ at: '0:0:0', n: 'A3', d: '2:0:0' }] }]);
    const { channels } = await render(m);
    const early = rms(channels[0], Math.round(1.6 * SR), Math.round(1.8 * SR));
    const late = rms(channels[0], Math.round(3.7 * SR), Math.round(3.9 * SR));
    expect(late / early).toBeGreaterThan(1.45); // lane 0.535 → 0.85 of pp→ff
  });

  it('plans stay plain: an event without score overrides carries no pp', () => {
    const plan = renderBeatsPlan(normalizeBeatsManifest(formed));
    expect(plan.entries.every((e) => e.pp === undefined)).toBe(true);
  });

  it('validation teaches the score fields; range is advice, never a refusal', () => {
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'violin', form: [{ phrase: 'B', at: 'soon', transpose: 0.5 }], dynamics: [{ at: 0, to: 'loud' }], events: [{ at: '0:0:0' }, { at: 0, n: 'C4', dyn: 'fffff' }] }], { meter: '3/5', tempo: [{ at: 0, bpm: 500, ramp: 'sine' }], phrases: { A: [] } }));
    expect(bad.ok).toBe(false);
    const msg = bad.errors.join('\n');
    for (const k of ["meter must be like '3/4'", 'tempo[0].bpm', "tempo[0].ramp must be 'linear' or 'exp'", 'phrases.A must be a non-empty', "phrase 'B' is not in the manifest's phrases", 'form[0].transpose', 'dynamics[0].to must be a mark', 'an object event needs n', '.dyn must be one of']) expect(msg).toContain(k);
    expect(validateBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, meter: '3/4', tracks: [{ name: 'k', patch: 'kick', mask: [1] }] }).errors.join()).toContain('meter is a beats-composition field');
    const low = validateBeatsManifest(comp([{ name: 'v', instrument: 'violin-2', events: [['0:0:0', 'C3'], ['0:1:0', 'A4']] }]));
    expect(low.ok).toBe(true);
    expect(low.warnings.join()).toMatch(/C3 outside the G3–E7 range of violin-2/);
    expect(validateBeatsManifest(literal)).toEqual({ ok: true, errors: [] }); // no advice → the pre-era shape
  });
});

describe('phase 1 — the orchestra shelf', () => {
  // the partial each instrument's written pitch is measured on (ratio × note).
  const MAIN = { 'tubular-bells': 2 };
  const NEW = ['flute', 'clarinet', 'oboe', 'bassoon', 'harp', 'glockenspiel', 'xylophone', 'marimba', 'vibraphone', 'tubular-bells', 'timpani'];
  it.each(NEW)('gate: %s holds pitch within 3 cents across its range', async (instrument) => {
    const { INSTRUMENTS } = await import('./instruments.js');
    const [lo, hi] = INSTRUMENTS[instrument].range;
    const midi = (n) => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
    const a = midi(lo), b = midi(hi);
    for (const m of [a + 2, Math.round((a + b) / 2), b - 2]) {
      const hz = 440 * Math.pow(2, (m - 69) / 12);
      // vibrato held still: the gate is the tuning, not the wobble.
      const { channels } = await render(comp([{ name: 'x', instrument, patchParams: { vibrato: { depth: 0 } }, events: [[0, hz, 2, 0.7]] }]), { tail: 0.2 });
      const f = hz * (MAIN[instrument] || 1);
      const y = bandpass(channels[0], SR, f, 4);
      const start = Math.round(0.12 * SR), win = Math.max(2048, Math.round((SR / f) * 30));
      expect(Math.abs(cents(pitchHz(y, SR, start, win, f), f)), `${instrument} midi ${m}`).toBeLessThan(3);
    }
  });

  it('the woodwinds have their harmonic signatures: clarinet odd-heavy, flute near-sine', async () => {
    const spec = async (instrument) => {
      const { channels } = await render(comp([{ name: 'x', patch: instrument, events: [[0, 'D4', 2, 0.7]] }]), { tail: 0.1 });
      const f = 293.66, mag = magnitudeSpectrum(channels[0], Math.round(0.3 * SR), 16384);
      const h = (k) => { const c = Math.round((k * f * 16384) / SR); return Math.max(mag[c - 1], mag[c], mag[c + 1]); };
      return [1, 2, 3, 4, 5].map(h);
    };
    const cl = await spec('clarinet');
    expect(cl[2] / cl[1]).toBeGreaterThan(5); // 3rd harmonic ≫ 2nd
    const fl = await spec('flute');
    expect(fl[1] / fl[0]).toBeLessThan(0.2);
  });

  it('gate: players 8 smears the onset (a slower rise than one player)', async () => {
    const rise = async (players) => {
      const { channels } = await render(comp([{ name: 's', patch: 'violin', ...(players ? { players } : {}), events: [[0, 'A4', 2, 0.7]] }]), { tail: 0.1 });
      const y = channels[0], w = Math.round(0.004 * SR), env = [];
      for (let i = 0; i + w < Math.round(0.6 * SR); i += w) env.push(rms(y, i, i + w));
      const pk = Math.max(...env), t10 = env.findIndex((v) => v >= 0.1 * pk), t90 = env.findIndex((v) => v >= 0.9 * pk);
      return (t90 - t10) * 0.004;
    };
    const one = await rise(1), eight = await rise(8);
    expect(eight).toBeGreaterThan(one * 1.15);
  });

  it('players lowers into patchParams at normalize (voices, de-locked vibrato, drift)', () => {
    const m = normalizeBeatsManifest(comp([{ name: 's', instrument: 'viola', players: 6, events: [[0, 'C4']] }]));
    expect(m.parts[0].players).toBeUndefined();
    expect(m.parts[0].patchParams).toEqual({ players: 6, vibrato: { rate: 5.4, depth: 12, spread: 1 }, drift: 3 });
  });

  it("gate: desk 'back' is darker and wetter than 'front'", async () => {
    const take = async (desk) => {
      const { channels } = await render(comp([{ name: 'h', patch: 'trumpet2', desk, events: [[0, 'C5', 1, 0.8]] }], { room: { decay: 2.2 } }), { tail: 2 });
      const y = channels[0];
      const direct = rms(y, 0, Math.round(0.5 * SR)), tail = rms(y, Math.round(0.9 * SR), Math.round(2.4 * SR));
      return { c: centroid(y, SR, Math.round(0.15 * SR), 8192), wet: tail / direct };
    };
    const front = await take('front'), back = await take('back');
    expect(back.c).toBeLessThan(front.c);
    expect(back.wet).toBeGreaterThan(front.wet * 1.5);
  });

  it('seating fills pan + desk per family where a row sets none; firsts and seconds split', () => {
    const m = normalizeBeatsManifest(comp([
      { name: 'v1', instrument: 'violin-2', events: [[0, 'A4']] }, { name: 'v2', instrument: 'violin-2', events: [[0, 'E4']] },
      { name: 'vc', instrument: 'cello-2', pan: 0.1, events: [[0, 'C3']] }, { name: 'hn', instrument: 'french-horn-2', events: [[0, 'F3']] },
      { name: 'synth', patch: 'pad', events: [[0, 'C4']] },
    ], { seating: 'american', room: { decay: 2 } }));
    expect(m.parts.map((p) => [p.pan, p.desk])).toEqual([[-0.55, 'front'], [-0.25, 'front'], [0.1, 'front'], [-0.3, 'back'], [undefined, undefined]]);
  });

  it('a4 retunes every pitched note (442 → +7.85 cents); fixed-pitch pieces stay put', async () => {
    const { channels } = await render(comp([{ name: 'x', patch: 'flute', patchParams: { vibrato: { depth: 0 } }, events: [[0, 'A4', 2, 0.7]] }], { a4: 442 }), { tail: 0.1 });
    expect(pitchHz(bandpass(channels[0], SR, 442, 4), SR, Math.round(0.12 * SR), 4096, 442)).toBeCloseTo(442, 0);
    expect(beatsFeatures(normalizeBeatsManifest(comp([{ name: 'x', patch: 'flute', events: [[0, 'A4']] }], { a4: 442 })))).toEqual(['voice', 'orch']);
  });

  it('the timpani pedal glides every mode; the vibraphone motor trembles', async () => {
    const { channels } = await render(comp([{ name: 't', instrument: 'timpani', glide: 0.4, events: [[0, 'G2', 1, 0.8], [1, 'C3', 2, 0.8]] }]), { tail: 0.1 });
    const y = bandpass(channels[0], SR, 130.8, 6);
    expect(Math.abs(cents(pitchHz(y, SR, Math.round(0.5 * 1.8 * SR), 4096, 130.8), 130.8))).toBeLessThan(10);
    const early = pitchHz(bandpass(channels[0], SR, 105, 3), SR, Math.round(0.52 * SR), 1024, 105);
    expect(early).toBeLessThan(125); // still on its way up from G2
    const vib = (await render(comp([{ name: 'v', patch: 'vibraphone', events: [[0, 'A4', 2, 0.8]] }]), { tail: 0.1 })).channels[0];
    const w = Math.round(0.02 * SR), env = [];
    for (let i = Math.round(0.3 * SR); i < Math.round(1.3 * SR); i += w) env.push(rms(vib, i, i + w));
    let turns = 0;
    for (let i = 2; i < env.length; i++) if ((env[i] - env[i - 1]) * (env[i - 1] - env[i - 2]) < 0) turns++;
    expect(turns).toBeGreaterThanOrEqual(8); // ~5.5 Hz × 1 s up-and-down
  });

  it('validation teaches players, desk, seating, a4', () => {
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'violin', players: 40, desk: 'side', patchParams: { harmonics: [2], tremolo: { rate: 99 } }, events: [[0, 'A4']] }], { seating: 'circus', a4: 500 }));
    const msg = bad.errors.join('\n');
    for (const k of ['players must be an integer in [1, 16]', "desk must be 'front' or 'back'", 'seating must be one of', 'a4 must be Hz in [415, 466]', 'patchParams.harmonics', 'patchParams.tremolo']) expect(msg).toContain(k);
  });
});

describe('phase 2 — articulations realized', () => {
  const evs = (art, extra = {}) => K.compositionEvents({ bpm: 120, seed: 3, parts: [{ name: 'p', patch: 'violin2', ...extra, events: [{ at: 0, n: 'A4', d: 2, art }] }] }).events;

  it('gate: a trill alternates at the rate asked, with the upper neighbour (interval 2 default, 1 on request)', () => {
    const e = evs({ type: 'trill', rate: 10 });
    expect(e.length).toBe(10);
    expect(e.map((x) => x.notes[0]).join(' ')).toBe('A4 B4 A4 B4 A4 B4 A4 B4 A4 B4');
    const gaps = e.slice(1).map((x, i) => x.t - e[i].t);
    expect(gaps.reduce((a, b) => a + b, 0) / gaps.length).toBeCloseTo(0.1, 2);
    for (const g of gaps) expect(Math.abs(g - 0.1)).toBeLessThan(0.025);
    expect(evs({ type: 'trill', interval: 1 })[1].notes[0]).toBe('A#4');
  });

  it('gate: the trill is heard — the pitch alternates in the render', async () => {
    const { channels } = await render(comp([{ name: 'p', patch: 'flute', patchParams: { vibrato: { depth: 0 } }, events: [{ at: 0, n: 'A4', d: 2, art: { type: 'trill', rate: 8 } }] }]), { tail: 0.1 });
    const at = (k) => Math.round((0.125 * k + 0.06) * SR);
    const a = pitchHz(channels[0], SR, at(2), 1024, 440), b = pitchHz(channels[0], SR, at(3), 1024, 493.9);
    expect(Math.abs(cents(a, 440))).toBeLessThan(15);
    expect(Math.abs(cents(b, 493.9))).toBeLessThan(15);
  });

  it('gate: pizz rings under 0.6 s (T60), arco sustains', async () => {
    // the patch alone: the instrument's hall reverb would be the tail measured.
    const { channels } = await render(comp([{ name: 'p', patch: 'violin2', events: [{ at: 0, n: 'A4', d: 2, art: 'pizz' }] }]), { tail: 0.5 });
    const T = t60(bandpass(channels[0], SR, 440, 8), SR);
    expect(T).toBeLessThan(0.6);
    expect(T).toBeGreaterThan(0.1);
  });

  it('gate: legato has no amplitude dip at note boundaries (one note, the pitch moves); detached notes dip', async () => {
    // one voice, no vibrato: the ensemble's own detune beating would read as dips.
    const line = (art) => comp([{ name: 'p', patch: 'violin2', patchParams: { vibrato: { depth: 0 }, drift: 0, unison: 1, detune: 0 }, events: ['A4', 'B4', 'C#5', 'D5'].map((n, i) => ({ at: i, n, d: 1, art })) }]);
    const dip = async (art) => {
      const y = (await render(line(art), { tail: 0.1 })).channels[0];
      const w = Math.round(0.01 * SR);
      let worst = Infinity;
      for (const b of [1, 2, 3]) {
        const c = Math.round(b * 0.5 * SR);
        const around = rms(y, c - 6 * w, c - 4 * w);
        for (let i = c - 2 * w; i < c + 6 * w; i += w) worst = Math.min(worst, rms(y, i, i + w) / around);
      }
      return worst;
    };
    expect(await dip('legato')).toBeGreaterThan(0.85);
    expect(await dip(undefined)).toBeLessThan(0.6);
    const e = K.compositionEvents({ bpm: 120, parts: [{ name: 'p', patch: 'violin2', events: ['A4', 'B4', 'C#5'].map((n, i) => ({ at: i, n, d: 1, art: 'legato' })) }] }).events;
    expect(e.length).toBe(1);
    expect(e[0].pp.path.map((x) => +x[1].toFixed(4))).toEqual([1, 1.1225, 1.2599]);
  });

  it('staccato shortens, sfz / fp / marcato / swell shape the note, col legno knocks', () => {
    expect(evs('staccato')[0].dur).toBeCloseTo(0.45, 9);
    expect(evs('staccatissimo')[0].dur).toBeCloseTo(0.25, 9);
    expect(evs('sfz')[0].pp.amp).toEqual([[0, 1.45], [0.2, 0.5]]);
    expect(evs('fp')[0].pp.amp[1][1]).toBeLessThan(0.3);
    expect(evs('marcato')[0].vel).toBeCloseTo(0.92, 9);
    expect(evs('swell')[0].pp.amp[1]).toEqual([0.5, 1.25]);
    const cl = evs('col-legno')[0];
    expect(cl.pp.voice).toBe('modal');
    expect(cl.dur).toBeLessThanOrEqual(0.2);
  });

  it('trem and roll retrigger (seeded, deterministic); trem lfo is an amplitude LFO', () => {
    const a = evs('trem'), b = evs('trem');
    expect(a.length).toBe(14); // 1 s at 14 strokes/s (± 5 % seeded rate)
    expect(a).toEqual(b);
    expect(evs({ type: 'roll', rate: 20 }).length).toBe(20);
    expect(evs({ type: 'trem', mode: 'lfo' })[0].pp.tremolo).toEqual({ rate: 14, depth: 0.85 });
  });

  it('gliss: a harp runs the scale; a bowed string slides; port slides in from the previous note', () => {
    const run = K.compositionEvents({ bpm: 120, parts: [{ name: 'h', patch: 'harp', events: [{ at: 0, n: 'C4', d: 1, art: { type: 'gliss', to: 'C5' } }] }] }).events;
    expect(run.map((e) => e.notes[0])).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
    const slide = K.compositionEvents({ bpm: 120, parts: [{ name: 'v', patch: 'violin2', events: [{ at: 0, n: 'A4', d: 1, art: 'gliss' }, { at: 1, n: 'A5', d: 1 }] }] }).events;
    expect(slide[0].pp.bend[1]).toBeCloseTo(2, 9);
    const port = K.compositionEvents({ bpm: 120, parts: [{ name: 'v', patch: 'violin2', events: [{ at: 0, n: 'A4', d: 1 }, { at: 1, n: 'E5', d: 1, art: 'port' }] }] }).events;
    expect(port[1].pp.bend[0]).toBeCloseTo(440 / 659.26, 4);
  });

  it('the slide is heard: a bowed gliss ends an octave up', async () => {
    const { channels } = await render(comp([{ name: 'v', patch: 'flute', patchParams: { vibrato: { depth: 0 } }, events: [{ at: 0, n: 'A4', d: 2, art: { type: 'gliss', to: 'A5' } }] }]), { tail: 0.1 });
    expect(Math.abs(cents(pitchHz(channels[0], SR, Math.round(0.97 * SR), 512, 870), 870))).toBeLessThan(40);
    expect(Math.abs(cents(pitchHz(channels[0], SR, Math.round(0.49 * SR), 1024, 622.3), 622.3))).toBeLessThan(40); // half way: 440 · 2^0.5
  });

  it('mute darkens strings and makes brass nasal; flutter-tongue buzzes', async () => {
    const c = async (patch, art) => centroid((await render(comp([{ name: 'x', patch, events: [{ at: 0, n: 'C5', d: 2, art }] }]), { tail: 0.1 })).channels[0], SR, Math.round(0.4 * SR), 8192);
    expect(await c('violin2', 'mute')).toBeLessThan(0.8 * (await c('violin2')));
    expect(evs('mute')[0].pp.mute).toBe('strings');
    expect(K.compositionEvents({ bpm: 120, parts: [{ name: 't', patch: 'trumpet2', events: [{ at: 0, n: 'C5', art: 'mute' }] }] }).events[0].pp.mute).toBe('brass');
    expect(evs('flutter-tongue')[0].pp.tremolo.rate).toBe(24);
  });

  it('validation teaches articulation names and params; detection adds orch (+ strings for pizz)', () => {
    const bad = validateBeatsManifest(comp([{ name: 'v', patch: 'violin2', events: [{ at: 0, n: 'A4', art: 'spiccato' }, { at: 1, n: 'A4', art: { type: 'trill', rate: 90, interval: 0 } }, ['0:2:0', 'A4', 1, 0.5, { type: 'gliss', to: 'H4' }]] }]));
    const msg = bad.errors.join('\n');
    for (const k of ['art must be one of: legato', 'art.rate must be Hz in [1, 40]', 'art.interval must be semitones', "art.to: 'H4' is not a note name"]) expect(msg).toContain(k);
    expect(beatsFeatures(normalizeBeatsManifest(comp([{ name: 'v', instrument: 'violin-2', events: [{ at: 0, n: 'A4', art: 'pizz' }] }])))).toEqual(['voice', 'strings', 'ev', 'score', 'orch']);
  });
});

describe('phase 3 — percussion: circuits and hands', () => {
  const hit = (instrument, notes, extra = {}) => comp([{ name: 'k', instrument, events: notes.map(([at, n, v]) => [at, n, '0:0:1', v == null ? 0.9 : v]), ...extra }]);
  // instantaneous frequency from successive zero crossings (a clean sine body).
  const zc = (y, from, to) => { const out = []; let last = null; for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) if (y[i - 1] < 0 && y[i] >= 0) { const x = i - y[i] / (y[i] - y[i - 1]); if (last != null) out.push([(x + last) / 2 / SR, SR / (x - last)]); last = x; } return out; };

  it('gate: the boom kick drops ≥ 1 octave within 60 ms, then rings long', async () => {
    const y = (await render(hit('drum-machine-88', [[0, 'C2']]), { tail: 1.5 })).channels[0];
    const f = zc(y, 0.0005, 0.2);
    expect(f[0][1] / f.find(([t]) => t > 0.06)[1]).toBeGreaterThanOrEqual(2);
    expect(f[0][0]).toBeLessThan(0.03);
    expect(rms(y, Math.round(0.3 * SR), Math.round(0.4 * SR))).toBeGreaterThan(0.01 * rms(y, 0, Math.round(0.1 * SR)));
  });

  it('gate: a clap is 3–4 bursts 8–12 ms apart, then a tail', async () => {
    for (const [instrument, n] of [['drum-machine-88', 4], ['drum-machine-909', 3]]) {
      const y = (await render(hit(instrument, [[0, 'D#2']]), { tail: 0.4 })).channels[0];
      // 2 ms windows at a 1 ms hop; a peak counts when the envelope dipped below
      // half of it since the last one (the bursts, not the noise's own flicker).
      const env = [];
      for (let i = 0; i < Math.round(0.06 * SR); i += Math.round(0.001 * SR)) env.push(rms(y, i, i + Math.round(0.002 * SR)));
      const peaks = [];
      let lo = Infinity;
      for (let i = 1; i < env.length - 1; i++) {
        lo = Math.min(lo, env[i]);
        if (env[i] > env[i - 1] && env[i] >= env[i + 1] && lo < 0.5 * env[i] && env[i] > 0.2 * Math.max(...env)) { peaks.push(i); lo = env[i]; }
      }
      expect(peaks.length, instrument).toBe(n);
      for (let i = 1; i < peaks.length; i++) { expect(peaks[i] - peaks[i - 1]).toBeGreaterThanOrEqual(7); expect(peaks[i] - peaks[i - 1]).toBeLessThanOrEqual(13); }
    }
  });

  it('gate: velMap — the snare centroid rises monotonically with velocity', async () => {
    const c = [];
    for (const v of [0.25, 0.5, 0.75, 1]) c.push(centroid((await render(hit('acoustic-kit', [[0, 'D2', v]]), { tail: 0.3 })).channels[0], SR, 0, 4096));
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]);
  });

  it('gate: an open hat is choked within 5 ms of the next closed hat', async () => {
    // what's left of the open hat once the closed one lands (both − closed alone),
    // against what the open hat alone would still be doing there.
    const both = (await render(hit('drum-machine-88', [[0, 'A#2'], [0.2, 'F#2']]), { tail: 0.5, bitDepth: 32 })).channels[0];
    const closed = (await render(hit('drum-machine-88', [[0.2, 'F#2']]), { tail: 0.5, bitDepth: 32 })).channels[0];
    const alone = (await render(hit('drum-machine-88', [[0, 'A#2']]), { tail: 0.5, bitDepth: 32 })).channels[0];
    // measured from the closed hat's audible onset (the master bus compressor
    // delays everything by its ~6 ms look-ahead).
    const at = closed.findIndex((v) => Math.abs(v) > 1e-3), open = both.map((v, i) => v - closed[i]);
    const span = [at + Math.round(0.005 * SR), at + Math.round(0.08 * SR)];
    expect(rms(open, ...span)).toBeLessThan(0.03 * rms(alone, ...span));
    expect(rms(open, at - Math.round(0.02 * SR), at)).toBeCloseTo(rms(alone, at - Math.round(0.02 * SR), at), 6);
    const ev = K.compositionEvents(normalizeBeatsManifest(hit('drum-machine-88', [[0, ['C2', 'A#2']], [0.5, 'F#2']]))).events;
    expect(ev.find((e) => e.notes[0] === 'A#2').pp.cut).toBeCloseTo(0.25, 9);
    expect(ev.find((e) => e.notes[0] === 'C2').pp).toBeUndefined(); // the chord split: the kick is not cut
  });

  it('a looping pattern wraps the choke into its next pass', () => {
    const p = normalizeBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, steps: 16, tracks: [{ name: 'hats', instrument: 'drum-machine-909', mask: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0], notes: ['A#2'] }, { name: 'x', patch: 'kick', mask: [1] }] });
    p.tracks[0].mask[0] = 0.9; p.tracks[0].notes[0] = 'F#2';
    const ev = K.patternEvents(p).events.filter((e) => e.channel === 'hats');
    expect(ev[1].pp.cut).toBeCloseTo(0.25, 9); // step 14 → the step-0 closed hat, one loop on
  });

  it('stadium kit gates: roomMix tracks the room-to-close ratio; the tom bends down; repeated snares differ', async () => {
    const ratio = async (roomMix) => {
      const y = (await render(hit('stadium-kit', [[0, 'D2']], { roomMix }), { tail: 2 })).channels[0];
      return rms(y, Math.round(0.45 * SR), Math.round(1.2 * SR)) / rms(y, 0, Math.round(0.12 * SR));
    };
    const r = [];
    for (const m of [0.1, 0.3, 0.6, 0.9]) r.push(await ratio(m));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
    expect(r[3] / r[0]).toBeGreaterThan(4);
    const tomY = (await render(comp([{ name: 't', patch: 'tomArenaMid', events: [[0, 'C1', 1, 0.9]] }]), { tail: 0.5 })).channels[0];
    const f = zc(tomY, 0.001, 0.5), early = f[1][1], late = f.find(([t]) => t > 0.3)[1];
    expect(cents(early, late)).toBeGreaterThan(250);
    expect(cents(late, 146.8)).toBeLessThan(40);
    const two = (await render(hit('stadium-kit', [[0, 'D2', 0.9], [1, 'D2', 0.9]]), { tail: 0.2 })).channels[0];
    const beat = Math.round(0.5 * SR);
    let d = 0, e = 0;
    for (let i = 0; i < 4000; i++) { d += Math.abs(two[i] - two[i + beat]); e += Math.abs(two[i]); }
    expect(d / e).toBeGreaterThan(0.3);
  });

  it('the rock drummer: snare laid back, hats accented by position, toms flam', () => {
    const m = normalizeBeatsManifest(comp([{ name: 'd', instrument: 'stadium-kit', events: [[0, ['C2', 'F#2']], [0.25, 'F#2'], [0.5, 'F#2'], [1, 'D2'], [2, 'A2']] }]));
    expect(m.parts[0].feel.laid[38]).toBe(0.012);
    const ev = K.compositionEvents({ ...m, parts: [{ ...m.parts[0], feel: { ...m.parts[0].feel, jitterTime: 0, jitterVel: 0 } }] }).events;
    const snare = ev.find((e) => e.notes[0] === 'D2');
    expect(snare.t).toBeCloseTo(0.5 + 0.012, 9);
    const hats = ev.filter((e) => e.notes[0] === 'F#2').map((e) => e.vel);
    expect(hats[0]).toBeGreaterThan(hats[1]);
    expect(ev.filter((e) => e.notes[0] === 'A2').length).toBe(2); // the flam grace + the stroke
  });

  it('a snare roll swells with cresc; the tam-tam blooms after the strike', async () => {
    const roll = K.compositionEvents({ bpm: 120, seed: 1, parts: [{ name: 's', patch: 'snareConcert', events: [{ at: 0, n: 'D2', d: 4, v: 0.4, art: { type: 'roll', cresc: 2.2 } }] }] }).events;
    expect(roll.length).toBeGreaterThan(30);
    expect(roll[roll.length - 1].vel).toBeGreaterThan(roll[0].vel * 1.6);
    const y = (await render(hit('orchestral-perc', [[0, 'E3']]), { tail: 3 })).channels[0];
    const band = bandpass(y, SR, 700, 1);
    expect(rms(band, Math.round(1.2 * SR), Math.round(1.4 * SR))).toBeGreaterThan(rms(band, Math.round(0.02 * SR), Math.round(0.12 * SR)));
  });

  it('kits resolve their GM notes; detection adds perc (and ev, mix) where used', () => {
    for (const [inst, notes] of [['drum-machine-88', ['C2', 'D2', 'D#2', 'F#2', 'A#2', 'G#3']], ['latin-perc', ['C4', 'D#4', 'D4', 'E4', 'F#3', 'A4', 'A#4', 'C#5', 'D5']], ['orchestral-perc', ['C2', 'D2', 'C#3', 'E3', 'A5']], ['stadium-kit', ['C2', 'D2', 'E2', 'F2', 'D3', 'C#3', 'E3', 'F3']]]) {
      const v = validateBeatsManifest(comp([{ name: 'k', instrument: inst, events: notes.map((n, i) => [i, n]) }]));
      expect(v.ok, `${inst}: ${v.errors}`).toBe(true);
    }
    expect(beatsFeatures(normalizeBeatsManifest(hit('drum-machine-88', [[0, 'C2']])))).toEqual(['voice', 'ev', 'perc']);
    expect(beatsFeatures(normalizeBeatsManifest(hit('stadium-kit', [[0, 'C2']])))).toEqual(['voice', 'mix', 'ev', 'perc']);
    const bad = validateBeatsManifest(comp([{ name: 'k', instrument: 'stadium-kit', roomMix: 3, choke: { hat: 42 }, feel: { laid: { 38: 1 } }, patchParams: { velMap: { decay: 1 } }, events: [[0, 'C2', 1, 0.5, { type: 'roll', cresc: 9 }]] }]));
    const msg = bad.errors.join('\n');
    for (const k of ['roomMix must be in [0, 1]', 'choke must be { <GM note number>: group }', 'feel.laid must be', 'patchParams.velMap', 'art.cresc']) expect(msg).toContain(k);
  });
});

describe('phase 4 — the virtual-analog and FM core', () => {
  const tone = (patchParams, note = 'A3', extra = {}) => comp([{ name: 's', patch: 'sinePluck', patchParams: { attack: 0.005, decay: 0.1, sustain: 1, release: 0.05, volume: -14, ...patchParams }, events: [[0, note, 4, 0.8]], ...extra }]);
  const harm = (y, f, k, start = Math.round(0.4 * SR)) => { const mag = magnitudeSpectrum(y, start, 32768); const c = Math.round((k * f * 32768) / SR); return Math.max(mag[c - 2], mag[c - 1], mag[c], mag[c + 1], mag[c + 2]); };

  it('gate: PWM — the second harmonic follows |sin 2πpw| / 2 sin πpw, and vanishes at 50 %', async () => {
    const f = 220;
    for (const pw of [0.5, 0.4, 0.3, 0.25]) {
      const y = (await render(tone({ wave: 'pulse', pw }), { tail: 0.1 })).channels[0];
      const r = harm(y, f, 2) / harm(y, f, 1), want = Math.abs(Math.sin(2 * Math.PI * pw)) / 2 / Math.sin(Math.PI * pw);
      if (pw === 0.5) expect(r).toBeLessThan(0.01);
      else expect(Math.abs(r - want) / want, `pw ${pw}: ${r} vs ${want}`).toBeLessThan(0.2);
    }
  });

  it('gate: ladder — a resonance peak ≥ 12 dB at the cutoff with q high; 24 dB/oct beyond', async () => {
    const y = (await render(comp([{ name: 'n', patch: 'hat', patchParams: { decay: 4, sustain: 1, release: 0.05, volume: -20, filter: { mode: 'ladder24', freq: 1000, q: 18, drive: 0 } }, events: [[0, 'C4', 4, 0.8]] }]), { tail: 0.1 })).channels[0];
    const avg = (f) => { let s = 0; for (let k = 0; k < 6; k++) { const mag = magnitudeSpectrum(y, Math.round((0.3 + 0.2 * k) * SR), 8192); const c = Math.round((f * 8192) / SR); s += mag[c - 1] ** 2 + mag[c] ** 2 + mag[c + 1] ** 2; } return Math.sqrt(s); };
    const db = (a, b) => 20 * Math.log10(avg(a) / avg(b));
    expect(db(1000, 250)).toBeGreaterThan(12);
    expect(db(250, 4000)).toBeGreaterThan(40); // two octaves past the cutoff: > 40 dB down
  });

  it('gate: an accented step opens the filter further (peak cutoff up); slide is one continuous note', async () => {
    const acid = (accent, slide) => ({ kind: 'beats-pattern', title: 'acid', bpm: 120, seed: 1, steps: 16, tracks: [{ name: 'a', instrument: 'acid-bass', chain: [], mask: [1, 0, 0, 0, 1, 0, 0, 0], notes: ['A2', 'A2', 'A2', 'A2', 'E3'], ...(accent ? { accent } : {}), ...(slide ? { slide } : {}) }] });
    const early = async (m, at) => centroid((await render(m, { loops: 1, tail: 0.1 })).channels[0], SR, Math.round(at * SR) + 400, 2048);
    const plain = await early(acid(null), 0), acc = await early(acid([1, 0, 0, 0, 0, 0, 0, 0]), 0);
    expect(acc).toBeGreaterThan(plain * 1.2);
    const ev = K.patternEvents(normalizeBeatsManifest(acid(null, [1, 0, 0, 0, 0, 0, 0, 0]))).events;
    expect(ev.length).toBe(2); // step 0 slid into step 4 (and 8 into 12, the mask wraps): one note each
    expect(ev[0].pp.path[1][1]).toBeCloseTo(1.4983, 3);
    const y = (await render(acid(null, [1, 0, 0, 0, 0, 0, 0, 0]), { loops: 1, tail: 0.1 })).channels[0];
    const w = Math.round(0.005 * SR);
    let dip = Infinity;
    for (let i = Math.round(0.47 * SR); i < Math.round(0.56 * SR); i += w) dip = Math.min(dip, rms(y, i, i + w));
    expect(dip / rms(y, Math.round(0.4 * SR), Math.round(0.45 * SR))).toBeGreaterThan(0.5); // no retrigger gap
    expect(Math.abs(cents(pitchHz(y, SR, Math.round(0.62 * SR), 2048, 164.8), 164.8))).toBeLessThan(25);
  });

  it('ratchet retriggers inside the step; prob keeps a seeded, repeatable subset per loop', () => {
    const m = normalizeBeatsManifest({ kind: 'beats-pattern', title: 'r', bpm: 120, seed: 4, steps: 16, tracks: [{ name: 'h', patch: 'hat', mask: [1], ratchet: [3, 1, 1, 1], prob: [1, 1, 0.5, 0.5] }] });
    const ev = K.patternEvents(m).events;
    expect(ev.filter((e) => e.t < 0.125 - 1e-9).length).toBe(3);
    const kept = (loop) => ev.map((e, i) => (e.prob == null || K.stepKeep(4, loop, i, e.prob) ? 1 : 0)).join('');
    expect(kept(0)).toBe(kept(0));
    expect(new Set([0, 1, 2, 3, 4, 5].map(kept)).size).toBeGreaterThan(1);
    expect(renderBeatsPlan(m, { loops: 1 }).entries.length).toBe(kept(0).split('').filter((c) => c === '1').length);
  });

  it('gate: fm4 algorithms put the sidebands where the analysis says', async () => {
    const f = 200;
    const fm = (algorithm, ops, fb) => tone({ voice: 'fm4', algorithm, ops, ...(fb ? { feedback: fb } : {}), attack: 0.002, sustain: 1 }, 'G3');
    const g3 = 195.998;
    // alg 1, only op 2 → op 1 (ratio 3.5, index 1.5): energy at |1 ± 3.5k|, none at 2 or 3.5 itself.
    const y1 = (await render(fm(1, [{ ratio: 1, level: 1, sustain: 1 }, { ratio: 3.5, level: 1.5, sustain: 1 }, { level: 0 }, { level: 0 }]), { tail: 0.1 })).channels[0];
    const at = (y, r) => harm(y, g3, r);
    for (const r of [1, 2.5, 4.5]) expect(at(y1, r), `sideband ${r}`).toBeGreaterThan(20 * at(y1, 2));
    expect(at(y1, 3.5)).toBeLessThan(0.05 * at(y1, 1));
    // alg 8: four carriers at ratios 1, 2, 3, 5 — exactly those partials.
    const y8 = (await render(fm(8, [1, 2, 3, 5].map((ratio) => ({ ratio, level: 1, sustain: 1 }))), { tail: 0.1 })).channels[0];
    for (const r of [1, 2, 3, 5]) expect(at(y8, r)).toBeGreaterThan(20 * at(y8, 4));
    // op-4 feedback turns its sine saw-like (a second harmonic appears).
    const pure = (await render(fm(8, [{ level: 0 }, { level: 0 }, { level: 0 }, { ratio: 1, level: 1, sustain: 1 }]), { tail: 0.1 })).channels[0];
    const fed = (await render(fm(8, [{ level: 0 }, { level: 0 }, { level: 0 }, { ratio: 1, level: 1, sustain: 1 }], 1), { tail: 0.1 })).channels[0];
    expect(at(pure, 2) / at(pure, 1)).toBeLessThan(0.01);
    expect(at(fed, 2) / at(fed, 1)).toBeGreaterThan(0.25);
    void f;
  });

  it('the supersaw spreads seven saws on the curve; its highpass sits at the pitch; a sub lands an octave down', async () => {
    const ss = (await render(tone({ voice: 'osc', wave: 'supersaw', supersaw: { detune: 0.6, mix: 0.8 } }, 'A3'), { tail: 0.1 })).channels[0];
    const mag = magnitudeSpectrum(ss, Math.round(0.5 * SR), 65536), bin = (hz) => Math.round((hz * 65536) / SR);
    let peaks = 0;
    for (let k = bin(200); k < bin(240); k++) if (mag[k] > mag[k - 1] && mag[k] > mag[k + 1] && mag[k] > 0.05 * Math.max(...mag.slice(bin(200), bin(240)))) peaks++;
    expect(peaks).toBeGreaterThanOrEqual(5);
    const sub = (await render(tone({ wave: 'sawtooth', sub: { level: 0, octave: 1 } }, 'A3'), { tail: 0.1 })).channels[0];
    expect(harm(sub, 110, 1)).toBeGreaterThan(0.3 * harm(sub, 220, 1));
  });

  it('a synced lfo resolves to Hz at normalize; the wobble moves the cutoff at that rate', async () => {
    const m = normalizeBeatsManifest(comp([{ name: 'w', instrument: 'wobble-bass', events: [[0, 'E1', 8, 0.8]] }], { bpm: 140 }));
    expect(m.parts[0].patchParams.lfo[0].rate).toBeCloseTo(140 / 30, 5);
    const y = (await render({ ...m, parts: [{ ...m.parts[0], chain: [] }] }, { tail: 0.1 })).channels[0];
    const c = [];
    for (let i = 0; i < 40; i++) c.push(centroid(y, SR, Math.round((0.2 + i * 0.025) * SR), 1024));
    const mean = c.reduce((a, b) => a + b) / c.length;
    let flips = 0;
    for (let i = 1; i < c.length; i++) if ((c[i] - mean) * (c[i - 1] - mean) < 0) flips++;
    expect(flips).toBeGreaterThanOrEqual(6); // 1 s at 4.67 Hz: ~9 crossings of the mean
    expect(flips).toBeLessThanOrEqual(14);
  });

  it('validation teaches the synth fields; normalize lowers table names and filter mode names', () => {
    const bad = validateBeatsManifest({ kind: 'beats-pattern', title: 'v', bpm: 120, tracks: [{ name: 'a', patch: 'acidBass', mask: [1], accent: [3], slide: [2], ratchet: [9], prob: 2, patchParams: { wave: 'pulse', pw: 1.2, lfo: [{ target: 'wah' }], filter: { mode: 'moog' }, algorithm: 9, ops: [{ ratio: 'x' }], table: 'nope' } }] });
    const msg = bad.errors.join('\n');
    for (const k of ['.accent must be', '.slide must be', '.ratchet must be', '.prob must be', 'patchParams.pw', 'patchParams.lfo', 'patchParams.filter', 'patchParams.algorithm', 'patchParams.ops', 'patchParams.table']) expect(msg).toContain(k);
    const n = normalizeBeatsManifest(comp([{ name: 'x', patch: 'pad', patchParams: { table: 'organStab', filter: { mode: 'ladder24', freq: 800, q: 12 } }, events: [[0, 'C4']] }]));
    expect(n.parts[0].patchParams.harmonics.length).toBeGreaterThan(4);
    expect(n.parts[0].patchParams.table).toBeUndefined();
    expect(n.parts[0].patchParams.filter).toEqual({ mode: 'lowpass', slope: 24, freq: 800, q: 12 });
    expect(beatsFeatures(n)).toEqual(['voice', 'ev', 'orch', 'va']);
  });
});

describe('phase 5 — the era effects rack', () => {
  const env = (y, w = 0.01) => { const n = Math.round(w * SR), out = []; for (let i = 0; i + n <= y.length; i += n) out.push(rms(y, i, i + n)); return out; };
  const pad = (chain, extra = {}, part = {}) => comp([{ name: 'p', patch: 'hat', patchParams: { decay: 6, sustain: 1, release: 0.05, volume: -18, filter: { mode: 'lowpass', freq: 12000 } }, chain, events: [[0, 'C4', 6, 0.8]], ...part }], extra);

  it('gate: the phaser moves its notches over time', async () => {
    const y = (await render(pad([{ type: 'phaser', rate: 0.5, depth: 2, freq: 600, stages: 6 }]), { tail: 0.1 })).channels[0];
    const notch = (t) => {
      let s = new Float64Array(2048);
      for (let k = 0; k < 4; k++) { const m = magnitudeSpectrum(y, Math.round((t + k * 0.02) * SR), 4096); for (let i = 0; i < 2048; i++) s[i] += m[i]; }
      let best = 0, bv = Infinity;
      for (let i = Math.round((150 * 4096) / SR); i < Math.round((5000 * 4096) / SR); i++) { const v = s[i - 2] + s[i - 1] + s[i] + s[i + 1] + s[i + 2]; if (v < bv) { bv = v; best = i; } }
      return (best * SR) / 4096;
    };
    const a = notch(0.3), b = notch(1.3);
    expect(Math.abs(Math.log2(b / a))).toBeGreaterThan(0.3); // the deepest notch moved by > 0.3 octave in 1 s
  });

  it('gate: duck — the gain minima sit on the by row\'s onsets (± 2 ms)', async () => {
    const kicks = [0, 1, 2, 3, 4, 5].map((b) => [b, 'C2', '0:0:2', 0.9]);
    const m = (kickVol) => comp([
      { name: 'k', patch: 'kick2', ...(kickVol != null ? { patchParams: { volume: kickVol } } : {}), events: kicks },
      { name: 'p', patch: 'organ', duck: { by: 'k', depth: 12, release: 0.2 }, events: [[0, ['C4', 'E4', 'G4'], 6, 0.7]] },
    ]);
    const lanes = K.compositionEvents(normalizeBeatsManifest(m())).events.find((e) => e.channel === 'p').pp.amp;
    const min = lanes.reduce((a, p) => (p[1] < a[1] ? p : a));
    expect(min[1]).toBeCloseTo(Math.pow(10, -12 / 20), 6);
    const both = (await render(m(null), { tail: 0.2, bitDepth: 32 })).channels[0];
    const kickOnly = (await render(comp([{ name: 'k', patch: 'kick2', events: kicks }]), { tail: 0.2, bitDepth: 32 })).channels[0];
    const padOnly = (await render(m(-120), { tail: 0.2, bitDepth: 32 })).channels[0];
    // the gain the duck applied: the ducked pad over the same pad undocked, in 0.5 ms windows.
    const plain = (await render(comp([{ name: 'k', patch: 'kick2', patchParams: { volume: -120 }, events: kicks }, { name: 'p', patch: 'organ', events: [[0, ['C4', 'E4', 'G4'], 6, 0.7]] }]), { tail: 0.2, bitDepth: 32 })).channels[0];
    const ed = env(padOnly, 0.0005), ep = env(plain, 0.0005), e = ed.map((v, i) => v / (ep[i] || 1)), on = [];
    // the first kick's true onset (first sample off silence — the bus look-ahead shifts
    // both renders alike); the rest follow on the beat, sample-exact.
    const first = plain.findIndex((v) => Math.abs(v) > 1e-6); // time zero as the renders hear it (the pad starts with the first kick)
    for (let k = 0; k < 6; k++) on.push(first + k * 0.5 * SR);
    expect(on.length).toBe(6);
    for (const o of on.slice(1)) {
      const w0 = Math.round(o / Math.round(0.0005 * SR)); // env() windows are whole samples (22)
      let mi = w0 - 40;
      for (let i = w0 - 40; i < w0 + 40; i++) if (e[i] < e[mi]) mi = i;
      // the gain bottoms out at the onset + the 1 ms attack: within ± 2 ms of the onset.
      expect(Math.abs(((mi - w0) * 22) / 44.1), `onset ${o}`).toBeLessThanOrEqual(2.5);
    }
    void both;
  });

  it('gate: the trance gate — on/off ≥ 20 dB', async () => {
    const y = (await render(pad([], {}, { gate: { mask: [1, 0, 1, 0, 1, 1, 0, 1], smooth: 0.003 } }), { tail: 0.1 })).channels[0];
    const six = 0.125, at = (k) => rms(y, Math.round((k * six + 0.03) * SR), Math.round((k * six + 0.09) * SR));
    expect(20 * Math.log10(at(8) / at(9))).toBeGreaterThan(20);
    expect(20 * Math.log10(at(12) / at(14))).toBeGreaterThan(20);
  });

  it('gate: crush quantizes to 2^(bits−1) steps per unit', async () => {
    // quiet enough that the bus compressor stays linear (its knee starts at −12 dBFS).
    const m = comp([{ name: 's', patch: 'sinePluck', patchParams: { attack: 0.005, decay: 0.05, sustain: 1, release: 0.05, volume: -14 }, chain: [{ type: 'crush', bits: 6 }], events: [[0, 'A2', 4, 0.8]] }]);
    const y = (await render(m, { tail: 0.1, bitDepth: 32 })).channels[0].subarray(Math.round(0.5 * SR), Math.round(1.5 * SR));
    // the occupied levels (a few samples land mid-step where the curve jumps).
    const hist = new Map();
    for (const v of y) { const k = Math.round(v * 1e4); hist.set(k, (hist.get(k) || 0) + 1); }
    const levels = [...hist].filter(([, c]) => c > y.length * 0.005).map(([k]) => k).sort((a, b) => a - b);
    expect(levels.length).toBeLessThanOrEqual(11); // |x| ≤ 0.16 at 1/32 steps: {0, ±1/32 … ±5/32}
    expect(levels.length).toBeGreaterThanOrEqual(9);
    const gaps = levels.slice(1).map((v, i) => v - levels[i]);
    for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(2);
  });

  it('gate: the vocoder\'s output follows the modulator\'s envelope (r > 0.7)', async () => {
    const words = Array.from({ length: 12 }, (_, i) => [i * 0.5 + (i % 3) * 0.25, ['C4', 'E4', 'G4'][i % 3], i % 2 ? '0:0:1' : '0:0:3', 0.9]);
    const m = comp([
      { name: 'mod', patch: 'chipLead', patchParams: { release: 0.02 }, events: words },
      { name: 'car', patch: 'sawStab', patchParams: { decay: 8, sustain: 1, release: 0.1, filterEnv: undefined, filter: { mode: 'lowpass', freq: 9000 } }, chain: [{ type: 'vocoder', modulator: 'mod', bands: 12, hide: true }], events: [[0, ['C3', 'G3'], 8, 0.8]] },
    ]);
    const out = env((await render(m, { tail: 0.2, bitDepth: 32 })).channels[0]);
    const mod = env((await render(comp([m.parts[0]]), { tail: 0.2, bitDepth: 32 })).channels[0]);
    const n = Math.min(out.length, mod.length, 380), mean = (a) => a.slice(0, n).reduce((x, y) => x + y) / n;
    const ma = mean(out), mb = mean(mod);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (out[i] - ma) * (mod[i] - mb); saa += (out[i] - ma) ** 2; sbb += (mod[i] - mb) ** 2; }
    expect(sab / Math.sqrt(saa * sbb)).toBeGreaterThan(0.7);
  });

  it('gate: a gated room falls ≥ 30 dB within its gate; an open room2 is still ringing', async () => {
    const tail = async (model) => {
      const y = (await render(comp([{ name: 'r', patch: 'rimAnalog', chain: [{ type: 'reverb', model, decay: 1.8, gate: 0.25, wet: 1 }], events: [[0, 'C4', '0:0:1', 1]] }]), { tail: 1 })).channels[0];
      return 20 * Math.log10(rms(y, Math.round(0.33 * SR), Math.round(0.45 * SR)) / rms(y, Math.round(0.12 * SR), Math.round(0.22 * SR)));
    };
    expect(await tail('gated')).toBeLessThan(-30);
    expect(await tail('room2')).toBeGreaterThan(-15);
  });

  it('the rest of the rack does what it says', async () => {
    // bbd chorus: a stereo ensemble (L/R decorrelate); tape: wow moves the pitch; autopan swings L/R.
    const bbd = (await render(comp([{ name: 'x', patch: 'organ', chain: [{ type: 'chorus', model: 'bbd', mode: 'II', mix: 0.6 }], events: [[0, 'A4', 4, 0.7]] }]), { tail: 0.1 })).channels;
    expect(lrCorrelation(...bbd)).toBeLessThan(0.97);
    const tp = (await render(comp([{ name: 'x', patch: 'sinePluck', patchParams: { decay: 0.05, sustain: 1 }, chain: [{ type: 'tape', wow: 1, flutter: 0, drive: 0.01, bump: 0, tone: 20000 }], events: [[0, 'A4', 6, 0.7]] }]), { tail: 0.1 })).channels[0];
    const ps = [0.5, 0.8, 1.1, 1.4].map((t) => pitchHz(tp, SR, Math.round(t * SR), 2048, 440));
    expect(Math.max(...ps) - Math.min(...ps)).toBeGreaterThan(0.5);
    const ap = (await render(comp([{ name: 'x', patch: 'organ', chain: [{ type: 'autopan', rate: 1, depth: 1 }], events: [[0, 'A4', 4, 0.7]] }]), { tail: 0.1 })).channels;
    const lr = (t) => rms(ap[0], Math.round(t * SR), Math.round((t + 0.05) * SR)) / rms(ap[1], Math.round(t * SR), Math.round((t + 0.05) * SR));
    expect(lr(0.25 + 0.5) / lr(0.25)).toBeGreaterThan(4); // opposite sides half a cycle apart
    // ringmod: a 440 Hz sine × 100 Hz → 340 + 540, no 440.
    const rm = (await render(comp([{ name: 'x', patch: 'sinePluck', patchParams: { decay: 0.05, sustain: 1 }, chain: [{ type: 'ringmod', hz: 100 }], events: [[0, 'A4', 4, 0.7]] }]), { tail: 0.1 })).channels[0];
    const mag = magnitudeSpectrum(rm, Math.round(0.5 * SR), 16384), at = (hz) => mag[Math.round((hz * 16384) / SR)];
    expect(at(340)).toBeGreaterThan(20 * at(440));
    expect(at(540)).toBeGreaterThan(20 * at(440));
    // drive models: tube adds even harmonics, fuzz stays odd.
    const h = async (model) => { const y = (await render(comp([{ name: 'x', patch: 'sinePluck', patchParams: { decay: 0.05, sustain: 1, volume: -10 }, chain: [{ type: 'drive', model, amount: 0.6, tone: null }], events: [[0, 'A3', 4, 0.8]] }]), { tail: 0.1 })).channels[0]; const mg = magnitudeSpectrum(y, Math.round(0.5 * SR), 16384), b = (k) => mg[Math.round((k * 220 * 16384) / SR)]; return b(2) / b(3); };
    expect(await h('tube')).toBeGreaterThan(0.2);
    expect(await h('fuzz')).toBeLessThan(0.05);
    // dub delay: each repeat darker than the last.
    const dub = (await render(comp([{ name: 'x', patch: 'hat', patchParams: { decay: 0.05 }, chain: [{ type: 'delay', model: 'dub', time: 0.25, feedback: 0.7, mix: 1, filter: 1500, drive: 0.4 }], events: [[0, 'C4', '0:0:1', 1]] }]), { tail: 1.5 })).channels[0];
    const c = [1, 2, 3].map((k) => centroid(dub, SR, Math.round((0.25 * k + 0.004) * SR), 1024));
    expect(c[1]).toBeLessThan(c[0]);
    expect(c[2]).toBeLessThan(c[1]);
  });

  it('stutter repeats a slice and drops what it covers; the lanes multiply with a hairpin', () => {
    const r = { bpm: 120, seed: 1, parts: [{ name: 'p', patch: 'sinePluck', stutter: [{ at: '1:0:0', len: '0:0:2', repeats: 4 }], events: Array.from({ length: 16 }, (_, i) => [i / 2, ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'][i % 8], 0.5]) }] };
    const ev = K.compositionEvents(r).events.filter((e) => e.t >= 2 - 1e-9 && e.t < 3 - 1e-9);
    expect(ev.map((e) => e.notes[0])).toEqual(['C4', 'C4', 'C4', 'C4']);
    const both = K.compositionEvents({ bpm: 120, parts: [{ name: 'p', patch: 'pad', gate: { mask: [1, 0] }, dynamics: [{ at: 0, to: 'p' }, { at: 0, to: 'ff', over: '1:0:0' }], events: [{ at: 0, n: 'C4', d: 4 }] }] }).events[0].pp.amp;
    expect(both.some((p) => p[1] === 0)).toBe(true); // the gate's zeros survive the product
    expect(Math.max(...both.map((p) => p[1]))).toBeGreaterThan(1.5); // and the crescendo's rise
  });

  it('validation teaches the rack; detection adds fx (and mix, ev)', () => {
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'pad', gate: { mask: [] }, duck: { by: 'nobody' }, stutter: [{ at: 'x' }], chain: [{ type: 'phaser', stages: 40 }, { type: 'chorus', model: 'dimension' }, { type: 'drive', model: 'laser' }, { type: 'crush', bits: 0 }, { type: 'vocoder' }, { type: 'reverb', model: 'plate2' }], events: [[0, 'C4']] }]));
    const msg = bad.errors.join('\n');
    for (const k of ['.gate must be', ".duck.by 'nobody'", '.stutter must be', '.stages must be in [2, 12]', ".model must be 'bbd'", "'tube' | 'fuzz' | 'fold'", '.bits must be in [1, 16]', '.modulator must name another row', "'gated'"]) expect(msg).toContain(k);
    expect(beatsFeatures(normalizeBeatsManifest(pad([{ type: 'phaser' }])))).toEqual(['voice', 'mix', 'ev', 'fx']);
  });
});

describe('shelf sanity — every era patch renders finite and sane over a long note', () => {
  const NEW = ['flute', 'clarinet', 'oboe', 'bassoon', 'flute2', 'clarinet2', 'oboe2', 'bassoon2', 'harp', 'glockenspiel', 'xylophone', 'marimba', 'vibraphone', 'tubularBells', 'timpani',
    'kickBoom', 'snareAnalog', 'clapAnalog', 'cowbellAnalog', 'rimAnalog', 'clavesAnalog', 'tomBoomLo', 'hatBright', 'hatBrightOpen', 'kickPunch', 'snarePunch', 'clapPunch', 'hatPunch', 'hatPunchOpen', 'tomPunchMid',
    'kickAcoustic', 'snareAcoustic', 'hatAcoustic', 'tomAcousticLo', 'crashAcoustic', 'congaOpen', 'congaMute', 'congaSlap', 'congaLow', 'bongoHi', 'bongoLo', 'shaker', 'tambourine', 'cabasa', 'guiroShort', 'guiroLong',
    'bassDrumConcert', 'snareConcert', 'susCymbal', 'tamTam', 'triangle', 'crotales', 'kickArena', 'snareArena', 'snareArenaRim', 'tomArenaFloor', 'tomArenaHi', 'crashArena', 'chinaArena', 'rideBellArena',
    'acidBass', 'acidSquare', 'reeseBass', 'hoover', 'polyStrings', 'stringMachine', 'trancePluck', 'supersawLead', 'raveStab', 'wobbleBass', 'fmBass', 'fmKeys', 'fmBrass', 'fmOrgan', 'fmBell4'];
  it.each(NEW)('%s', async (patch) => {
    const { channels } = await render(comp([{ name: 'a', patch, events: [['0:0:0', ['C4', 'G4'], '3:0:0', 0.9], ['3:0:0', 'C5', '0:1:0', 0.5]] }]), { bitDepth: 32 });
    for (const y of channels) {
      expect(y.every(Number.isFinite)).toBe(true);
      expect(peak(y)).toBeLessThan(1);
      expect(peak(y)).toBeGreaterThan(0.005);
    }
  });
});

describe('MIDI handoff for the era shelf', () => {
  it('scored events export at their scored times; era patches get GM programs; kits land on channel 10', async () => {
    const { renderBeatsMidi } = await import('./beats-midi.js');
    const m = normalizeBeatsManifest(comp([
      { name: 'fl', instrument: 'flute', events: [{ at: 0, n: 'A4', d: 1, art: { type: 'trill', rate: 8 } }] },
      { name: 'k', instrument: 'drum-machine-88', events: [[0, ['C2', 'A#2']], [1, 'F#2']] },
    ], { meter: '3/4' }));
    const { mid: bytes, meta } = renderBeatsMidi(m);
    expect(meta.notes).toBe(4 + 3); // the trill's four strokes (0.5 s at 8/s) + three drum hits
    expect([...bytes].some((b, i) => (b & 0xf0) === 0xc0 && bytes[i + 1] === 73)).toBe(true); // flute's program change
    expect([...bytes].some((b, i) => b === 0x99 && bytes[i + 1] === 46)).toBe(true); // open hat on channel 10
  });
});

describe('pages carry only what they use', () => {
  it('a fidelity-only page kernel is the pre-era kernel, byte for byte (sha256 of the fidelity-all slice of the source)', async () => {
    // pinned from the audio-fidelity kernel (every fidelity region on): the era
    // regions, all off, must leave that text exactly as it was.
    const { createHash } = await import('node:crypto');
    const { readFileSync } = await import('node:fs');
    const { sliceKernelText } = await import('./beats-kernel.js');
    const t = readFileSync(new URL('./beats-kernel.js', import.meta.url), 'utf8');
    const text = sliceKernelText(t.slice(t.indexOf('function buildBeatsKernel()'), t.lastIndexOf('}') + 1), (f) => ['x', 'voice', 'strings', 'mix', 'sfx'].includes(f));
    expect(createHash('sha256').update(text).digest('hex')).toBe('f203a600e8b6bda5bec00b6c8e2cf81363cbdf5b3f821a06df86dbff4d28abf0');
  });
});
