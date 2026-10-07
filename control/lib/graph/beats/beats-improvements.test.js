import { describe, expect, it } from 'vitest';

import { emitBeatsKernel } from './beats-kernel.js';
import { beatsFeatures } from './beats-features.js';
import { INSTRUMENTS, auditInstruments } from './instruments.js';
import { normalizeBeatsManifest, validateBeatsManifest } from './beats-manifest.js';
import { renderBeatsOffline, renderWithKernel } from './beats-render.js';
import { expandBeatsManifest, SHAPE_DEFAULTS } from './beats-authoring.js';
import { decodeWav, rms, bandEnergy } from './audio-measure.js';

// Audio improvements — the machine gates. Section v3 (bodies) and phrase
// shaping are opt-in by name and field; beats-render.baseline.test.js pins that
// everything else renders byte-identical. None of this is an ears gate:
// nobody listened here.

const comp = (parts, extra = {}) => ({ kind: 'beats-composition', title: 'improvements probe', bpm: 60, seed: 7, parts, ...extra });
const db = (x) => 20 * Math.log10(x || 1e-12);
const SECTIONS = ['violin', 'viola', 'cello', 'contrabass', 'trumpet', 'french-horn', 'trombone', 'tuba'];

async function held(instrument, notes) {
  const m = normalizeBeatsManifest(comp([{ name: 'p', instrument, events: notes.map((n, i) => [i * 2, n, 1.8, 0.8]) }]));
  const { wav } = await renderBeatsOffline(m, { tail: 0.2 });
  const { sr, channels } = decodeWav(wav);
  return { sr, y: channels[0] };
}

describe('section v3: bodies', () => {
  it('every v3 section is on the shelf, voiced by a real patch, with its v2 range', () => {
    expect(auditInstruments()).toEqual([]);
    for (const s of SECTIONS) {
      const v3 = INSTRUMENTS[s + '-3'];
      expect(v3, s).toBeDefined();
      expect(v3.range, s).toEqual(INSTRUMENTS[s + '-2'].range);
      expect(v3.chain.some((f) => f.type === 'body' && Array.isArray(f.resonances)), s).toBe(true);
    }
  });

  it.each(SECTIONS)('%s: v3 is level-matched to v2 (RMS within 1.5 dB)', async (s) => {
    const notes = { violin: ['G3', 'A4'], viola: ['C3', 'D4'], cello: ['C2', 'D3'], contrabass: ['E1', 'D2'], trumpet: ['C4', 'G4'], 'french-horn': ['F3', 'C4'], trombone: ['Bb2', 'F3'], tuba: ['Bb1', 'F2'] }[s];
    const a = await held(s + '-2', notes), b = await held(s + '-3', notes);
    expect(Math.abs(db(rms(b.y)) - db(rms(a.y))), s).toBeLessThan(1.5);
  });

  it('the violin body barely radiates below its air mode: an open G loses its fundamental, the corpus band gains', async () => {
    const a = await held('violin-2', ['G3']), b = await held('violin-3', ['G3']);
    const at = Math.round(a.sr * 0.6), n = 16384;
    const sub = (r) => db(bandEnergy(r.y, r.sr, at, n, 150, 230)), corpus = (r) => db(bandEnergy(r.y, r.sr, at, n, 420, 600));
    expect(sub(a) - sub(b)).toBeGreaterThan(5);
    expect(corpus(b) - sub(b)).toBeGreaterThan(corpus(a) - sub(a) + 5);
  });

  it('a feature slice renders v3 sections exactly like the full kernel', async () => {
    const m = normalizeBeatsManifest(comp([
      { name: 'vln', instrument: 'violin-3', events: [[0, 'E5', 1, 0.7]] },
      { name: 'vc', instrument: 'cello-3', events: [[0, 'C3', 1, 0.6]] },
      { name: 'tpt', instrument: 'trumpet-3', events: [[0.5, 'G4', 0.5, 0.7]] },
    ]));
    const K = new Function('return (' + emitBeatsKernel(beatsFeatures(m)) + ')()')();
    const sliced = await renderWithKernel(K, m, { tail: 0.3 });
    const full = await renderBeatsOffline(m, { tail: 0.3 });
    expect(sliced.wav.equals(full.wav)).toBe(true);
  });
});

describe('phrase shaping', () => {
  // two four-bar phrases of quarter notes, one pitch, one velocity: only the arch and the end move them.
  const flat = Array.from({ length: 32 }, (_, i) => [i, 'C4', 1, 0.6]);
  const vels = (m, name = 'p') => expandBeatsManifest(m).parts.find((p) => p.name === name).events.map((e) => e[3]);

  it('a part without shape is untouched; shape: false only drops the field', () => {
    const m = comp([{ name: 'p', patch: 'pad', events: flat }]);
    expect(expandBeatsManifest(m)).toBe(m);
    const off = expandBeatsManifest(comp([{ name: 'p', patch: 'pad', events: flat, shape: false }]));
    expect(off.parts[0]).toEqual({ name: 'p', patch: 'pad', events: flat });
  });

  it('arches each phrase: louder toward 60% through it, the last note eased, the mean held', () => {
    const v = vels(comp([{ name: 'p', patch: 'pad', events: flat, shape: 'phrase' }]));
    for (const ph of [v.slice(0, 16), v.slice(16)]) {
      const peak = ph.indexOf(Math.max(...ph));
      expect(peak).toBeGreaterThanOrEqual(8);
      expect(peak).toBeLessThanOrEqual(11);
      expect(ph[15]).toBeLessThan(ph[14]);
      expect(ph[0]).toBeLessThan(ph[peak]);
      expect(ph.reduce((a, x) => a + x, 0) / ph.length).toBeCloseTo(0.6, 2);
    }
    expect(v.slice(0, 16)).toEqual(v.slice(16)); // phrase by phrase, no dice
  });

  it('higher notes a touch louder, long notes over short ones', () => {
    const contour = vels(comp([{ name: 'p', patch: 'pad', shape: { arch: 0, contrast: 0, end: 0 }, events: [[0, 'C4', 1, 0.6], [1, 'C5', 1, 0.6]] }]));
    expect(contour[1]).toBeGreaterThan(contour[0]);
    const contrast = vels(comp([{ name: 'p', patch: 'pad', shape: { arch: 0, contour: 0, end: 0 }, events: [[0, 'C4', 0.25, 0.6], [1, 'C4', 2, 0.6], [3, 'C4', 1, 0.6]] }]));
    expect(contrast[1]).toBeGreaterThan(contrast[2]);
    expect(contrast[2]).toBeGreaterThan(contrast[0]);
  });

  it('phrases follow bars in the meter and the `bars` option', () => {
    const v = vels(comp([{ name: 'p', patch: 'pad', shape: { bars: 2, contour: 0, contrast: 0 }, events: flat.slice(0, 16) }], { meter: '4/4' }));
    expect(v.slice(0, 8)).toEqual(v.slice(8));
  });

  it('string and object events: times through the score clock, object events left to their marks', () => {
    const ev = [['0:0:0', 'C4', '0:1:0', 0.6], ['0:2:0', 'D4', '0:1:0', 0.6], { at: '0:3:0', n: 'E4', d: '0:1:0', dyn: 'f' }];
    const out = expandBeatsManifest(comp([{ name: 'p', patch: 'pad', shape: 'phrase', events: ev }])).parts[0].events;
    expect(out[2]).toEqual(ev[2]);
    expect(out[0][3]).not.toBe(0.6);
  });

  it('validation teaches the shape', () => {
    const ok = validateBeatsManifest(comp([{ name: 'p', patch: 'pad', shape: { bars: 8, arch: 0.2 }, events: flat }]));
    expect(ok.errors || []).toEqual([]);
    for (const bad of ['loud', { bars: 0 }, { arch: 2 }, { lift: 0.1 }]) {
      const v = validateBeatsManifest(comp([{ name: 'p', patch: 'pad', shape: bad, events: flat }]));
      expect((v.errors || []).join(' '), JSON.stringify(bad)).toMatch(/shape must be/);
    }
    expect(Object.keys(SHAPE_DEFAULTS)).toEqual(['bars', 'arch', 'contour', 'contrast', 'end']);
  });
});
