import { describe, expect, it } from 'vitest';

import { emitBeatsKernel } from './beats-kernel.js';
import { beatsFeatures } from './beats-features.js';
import { INSTRUMENTS, auditInstruments } from './instruments.js';
import { normalizeBeatsManifest, validateBeatsManifest } from './beats-manifest.js';
import { renderBeatsOffline, renderWithKernel } from './beats-render.js';
import { expandBeatsManifest, SHAPE_DEFAULTS, TOUCH_DEFAULTS } from './beats-authoring.js';
import { PATCHES } from './audio-patches.js';
import { decodeWav, rms, bandEnergy, centroid, lrCorrelation } from './audio-measure.js';

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

describe('timbre: the kernel feature these add', () => {
  it('with timbre off, every older feature on is byte for byte the kernel before it', async () => {
    // pinned from e296535f's kernel with every feature on: the timbre regions, all off, leave that text as it was.
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const { sliceKernelText } = await import('./beats-kernel.js');
    const t = readFileSync(new URL('./beats-kernel.js', import.meta.url), 'utf8');
    const text = sliceKernelText(t.slice(t.indexOf('function buildBeatsKernel()'), t.lastIndexOf('}') + 1), (f) => f !== 'timbre');
    expect(createHash('sha256').update(text).digest('hex')).toBe('2efd454af14c0a921ea31989d267f93b0b1f39bfcb072ecfa4cfaba4ab8d41f3');
  });

  it('a feature slice renders the v3 winds and the modal bodies exactly like the full kernel', async () => {
    const m = normalizeBeatsManifest(comp([
      { name: 'fl', instrument: 'flute-3', events: [[0, 'A5', 1, 0.4], [1, 'B5', 1, 0.95]] },
      { name: 'gtr', instrument: 'acoustic-guitar-2', events: [[0, ['E2', 'B2', 'E3'], 1.5, 0.7]] },
      { name: 'pno', instrument: 'grand-piano-2', events: [[0.5, ['A3', 'C#4', 'E4'], 1, 0.6]] },
    ]));
    expect(beatsFeatures(m)).toContain('timbre');
    const K = new Function('return (' + emitBeatsKernel(beatsFeatures(m)) + ')()')();
    const sliced = await renderWithKernel(K, m, { tail: 0.3 });
    const full = await renderBeatsOffline(m, { tail: 0.3 });
    expect(sliced.wav.equals(full.wav)).toBe(true);
  });
});

describe('woodwinds v3: the spectrum follows force', () => {
  async function note(instrument, n, vel) {
    const m = normalizeBeatsManifest(comp([{ name: 'p', instrument, chain: [], events: [[0, n, 1.5, vel]] }]));
    const { wav } = await renderBeatsOffline(m, { tail: 0.1 });
    const { sr, channels: [y] } = decodeWav(wav);
    const a = Math.round(sr * 0.5);
    return { level: db(rms(y, a, a + 16384)), bright: centroid(y, sr, a, 16384) };
  }
  it.each([['flute', 'A5'], ['clarinet', 'G4'], ['oboe', 'A4'], ['bassoon', 'D3']])('%s-3: brighter and wider in range when played harder, level-matched at mf', async (w, n) => {
    const [s0, f0, s3, m3, f3, m0] = await Promise.all([note(w, n, 0.35), note(w, n, 1), note(w + '-3', n, 0.35), note(w + '-3', n, 0.8), note(w + '-3', n, 1), note(w, n, 0.8)]);
    expect(Math.abs(f0.bright - s0.bright) / s0.bright).toBeLessThan(0.05); // the solo wind: one table
    expect(f3.bright / s3.bright).toBeGreaterThan(1.3);
    expect(f3.level - s3.level).toBeGreaterThan(f0.level - s0.level + 0.3); // the flute least: its loud tone adds few partials
    expect(Math.abs(m3.level - m0.level)).toBeLessThan(1);
  });
});

describe('wooden bodies v2: the modal body', () => {
  const ARP = ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'];
  async function arp(instrument) {
    const m = normalizeBeatsManifest({ kind: 'beats-composition', title: 'p', bpm: 90, seed: 7, parts: [{ name: 'p', instrument, events: ARP.map((n, i) => [i * 0.5, n, 1.5, 0.75]) }] });
    const { wav } = await renderBeatsOffline(m, { tail: 1 });
    return decodeWav(wav).channels;
  }
  it.each(['acoustic-guitar', 'nylon-guitar', 'classical-guitar', 'harp', 'grand-piano'])('%s-2: level-matched, and the body gives it width', async (name) => {
    const [[aL, aR], [bL, bR]] = await Promise.all([arp(name), arp(name + '-2')]);
    expect(Math.abs(db(rms(bL)) - db(rms(aL)))).toBeLessThan(1.5);
    expect(lrCorrelation(bL, bR)).toBeLessThan(lrCorrelation(aL, aR) - 0.02);
  });
  it('validation teaches the modal body', () => {
    const bad = validateBeatsManifest(comp([{ name: 'p', patch: 'guitarClean', chain: [{ type: 'body', model: 'dense', modes: 999 }], events: [[0, 'E3']] }]));
    expect((bad.errors || []).join(' ')).toMatch(/model must be 'modal'/);
    expect((bad.errors || []).join(' ')).toMatch(/modes must be in \[4, 160\]/);
  });
});

describe('phrase shaping reaches form phrases', () => {
  it('a shaped part plays a shaped copy of each phrase; the phrase itself and other parts are untouched', () => {
    const line = Array.from({ length: 16 }, (_, i) => [i, 'C4', 1, 0.6]);
    const m = comp([
      { name: 'a', patch: 'pad', shape: 'phrase', form: [{ phrase: 'P', at: '0:0:0' }] },
      { name: 'b', patch: 'pad', form: [{ phrase: 'P', at: '4:0:0' }] },
    ], { phrases: { P: line } });
    const x = expandBeatsManifest(m);
    const a = x.parts.find((p) => p.name === 'a'), b = x.parts.find((p) => p.name === 'b');
    expect(b.form[0].phrase).toBe('P');
    expect(x.phrases.P).toEqual(line);
    const shaped = x.phrases[a.form[0].phrase];
    expect(a.form[0].phrase).not.toBe('P');
    expect(Math.max(...shaped.map((e) => e[3]))).toBeGreaterThan(0.6);
    expect(shaped[15][3]).toBeLessThan(shaped[14][3]);
  });
});

describe('life: a held note breathes', () => {
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  async function held4(instrument, extra = {}) {
    const m = normalizeBeatsManifest(comp([{ name: 'p', instrument, chain: [], events: [[0, 'G4', 4, 0.7]], ...extra }]));
    const { wav } = await renderBeatsOffline(m, { tail: 0.1 });
    const { sr, channels: [y] } = decodeWav(wav);
    const w = Math.round(sr * 0.1), L = [], C = [];
    for (let a = Math.round(sr * 1); a + 4096 < sr * 3.8; a += w) { L.push(db(rms(y, a, a + w))); C.push(centroid(y, sr, a, 4096)); }
    return { level: sd(L), bright: sd(C) / (C.reduce((x, c) => x + c, 0) / C.length), wav };
  }
  it('a held clarinet wanders in level and brightness together; the solo clarinet holds still', async () => {
    const [still, alive] = await Promise.all([held4('clarinet'), held4('clarinet-3')]);
    expect(still.level).toBeLessThan(0.05);
    expect(alive.level).toBeGreaterThan(0.3);
    expect(alive.bright).toBeGreaterThan(still.bright + 0.015);
  });
  it('is seeded: the same note breathes the same way every render', async () => {
    const [a, b] = await Promise.all([held4('oboe-3'), held4('oboe-3')]);
    expect(a.wav.equals(b.wav)).toBe(true);
  });
  it('life: false on a row turns it off (patchParams), and the slice still matches the full kernel', async () => {
    const off = await held4('clarinet-3', { patchParams: { life: false } });
    expect(off.level).toBeLessThan(0.05);
    const m = normalizeBeatsManifest(comp([{ name: 'p', instrument: 'clarinet-3', events: [[0, 'G4', 2, 0.6]], dynamics: [{ at: '0:0:0', to: 'p' }, { at: '0:1:0', to: 'f', over: '0:2:0' }] }]));
    expect(beatsFeatures(m)).toContain('timbre');
    const K = new Function('return (' + emitBeatsKernel(beatsFeatures(m)) + ')()')();
    expect((await renderWithKernel(K, m, { tail: 0.3 })).wav.equals((await renderBeatsOffline(m, { tail: 0.3 })).wav)).toBe(true);
  });
});

describe('life, the natural dial', () => {
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  async function wander(recipe) {
    const { wav } = await renderBeatsOffline(normalizeBeatsManifest(recipe), { tail: 0.1 });
    const { sr, channels: [y] } = decodeWav(wav);
    const w = Math.round(sr * 0.1), L = [];
    for (let a = Math.round(sr * 1); a + w < sr * 3.8; a += w) L.push(db(rms(y, a, a + w)));
    return { level: sd(L), wav };
  }
  const held = (instrument, extra = {}, row = {}) => comp([{ name: 'p', instrument, chain: [], events: [[0, 'G4', 4, 0.7]], ...row }], extra);

  it('scales the breathing: 0 is mechanical (the same bytes as life: false), 1 the default, 2 more', async () => {
    const [zero, off, half, one, two] = await Promise.all([
      wander(held('clarinet-3', { life: 0 })), wander(held('clarinet-3', {}, { patchParams: { life: false } })),
      wander(held('clarinet-3', { life: 0.5 })), wander(held('clarinet-3')), wander(held('clarinet-3', { life: 2 })),
    ]);
    expect(zero.wav.equals(off.wav)).toBe(true);
    expect(zero.level).toBeLessThan(0.05);
    expect(half.level).toBeGreaterThan(zero.level + 0.1);
    expect(one.level).toBeGreaterThan(half.level);
    expect(two.level).toBeGreaterThan(one.level);
  });

  it('a recipe dial leaves non-breathing instruments alone; a row dial wakes any instrument and overrides the recipe', () => {
    const x = expandBeatsManifest(comp([
      { name: 'a', instrument: 'flute', events: [[0, 'C5', 1]] },
      { name: 'b', instrument: 'flute', life: 1, events: [[0, 'C5', 1]] },
      { name: 'c', instrument: 'oboe-3', life: 0, events: [[0, 'A4', 1]] },
      { name: 'd', instrument: 'oboe-3', patchParams: { life: { depth: 3 } }, events: [[0, 'A4', 1]] },
    ], { life: 0.5 }));
    const by = Object.fromEntries(x.parts.map((p) => [p.name, p]));
    expect(x.life).toBeUndefined();
    expect(by.a.patchParams).toBeUndefined();
    expect(by.b.patchParams.life).toEqual({ depth: 1.5, bright: 4, vib: 0.25, follow: 0.5, amount: 1 });
    expect(by.c.patchParams.life).toBe(false);
    expect(by.d.patchParams.life).toEqual({ depth: 3 }); // an explicit patchParams.life is the writer's word
    expect(by.b.life).toBeUndefined();
  });

  it('validation teaches the dial', () => {
    for (const bad of [{ life: 3 }, { life: 'more' }]) expect((validateBeatsManifest(held('clarinet-3', bad)).errors || []).join(' ')).toMatch(/life must be in \[0, 2\]/);
    expect((validateBeatsManifest(held('clarinet-3', {}, { life: -1 })).errors || []).join(' ')).toMatch(/parts\[0\]\.life must be in \[0, 2\]/);
    expect(validateBeatsManifest(held('clarinet-3', { life: 1.5 })).errors || []).toEqual([]);
  });
});

describe('piano v3: keys tuned their own way, the pedal halo', () => {
  const chord = (extra = {}, inst = 'grand-piano-3') => comp([{ name: 'p', instrument: inst, events: [[0, ['C3', 'E3', 'G3', 'C4'], 0.3, 0.7]] }], extra);
  async function render(m) { const { wav } = await renderBeatsOffline(normalizeBeatsManifest(m), { tail: 2 }); return { wav, ...decodeWav(wav) }; }
  const win = (r, a, b) => db(rms(r.channels[0], Math.round(r.sr * a), Math.round(r.sr * b)));

  it('life: 0 is the mechanical grand: byte for byte grand-piano-2 with the same dampers and treble', async () => {
    const damped = comp([{ name: 'p', instrument: 'grand-piano-2', patchParams: { damper: PATCHES.pianoGrand3.damper, ringExact: true }, events: [[0, ['C3', 'E3', 'G3', 'C4'], 0.3, 0.7]] }]);
    const [mech, two] = await Promise.all([render(chord({ life: 0 })), render(damped)]);
    expect(mech.wav.equals(two.wav)).toBe(true);
  });

  it('the pedal halo rings on after the keys are released, well under the played chord, and grows with the dial', async () => {
    const [two, three, more] = await Promise.all([render(chord({}, 'grand-piano-2')), render(chord()), render(chord({ life: 2 }))]);
    expect(win(three, 0.8, 1.8) - win(two, 0.8, 1.8)).toBeGreaterThan(12);
    expect(win(three, 0, 0.3) - win(three, 0.8, 1.8)).toBeGreaterThan(12);
    expect(win(more, 0.8, 1.8)).toBeGreaterThan(win(three, 0.8, 1.8) + 3);
  });

  it('each key is its own: the per-key unison changes the sound; a key struck twice is the same key', async () => {
    const one = (k, patchParams) => comp([{ name: 'p', patch: 'pianoGrand3', ...(patchParams ? { patchParams } : {}), events: [[0, k, 1.5, 0.7]] }]);
    const [a, b, flat] = await Promise.all([render(one('A3')), render(one('A3')), render(one('A3', { life: false }))]);
    expect(a.wav.equals(b.wav)).toBe(true);
    expect(a.wav.equals(flat.wav)).toBe(false);
  });

  it('a feature slice renders the grand and its halo exactly like the full kernel', async () => {
    const m = normalizeBeatsManifest(chord());
    expect(beatsFeatures(m)).toEqual(expect.arrayContaining(['timbre', 'anthem']));
    const K = new Function('return (' + emitBeatsKernel(beatsFeatures(m)) + ')()')();
    expect((await renderWithKernel(K, m, { tail: 0.5 })).wav.equals((await renderBeatsOffline(m, { tail: 0.5 })).wav)).toBe(true);
  });

  it('validation teaches the halo', () => {
    const v = validateBeatsManifest(comp([{ name: 'p', patch: 'pianoGrand', chain: [{ type: 'sympathetic', mix: 3, decay: 0.1 }], events: [[0, 'C4']] }]));
    expect((v.errors || []).join(' ')).toMatch(/mix must be in \[0, 1\]/);
    expect((v.errors || []).join(' ')).toMatch(/decay must be in \[0.5, 20\]/);
  });
});

describe('piano: dampers', () => {
  const one = (k, damper, extra = { ringExact: true }) => comp([{ name: 'p', patch: 'pianoGrand', patchParams: { ...extra, ...(damper !== undefined ? { damper } : {}) }, events: [[0, k, 0.4, 0.8]] }]);
  async function render(m) { const { wav } = await renderBeatsOffline(normalizeBeatsManifest(m), { tail: 2 }); return decodeWav(wav); }
  const win = (r, a, b) => db(rms(r.channels[0], Math.round(r.sr * a), Math.round(r.sr * b)));
  const D = { above: 88, bass: 2, thud: -34, tone: 260, ring: 2.5 };

  it('ringExact: the treble rings its ringT60 instead of dying in the loop filter', async () => {
    const long = (x) => comp([{ name: 'p', patch: 'pianoGrand', patchParams: x, events: [[0, 'C7', 2, 0.8]] }]);
    const [loose, exact] = await Promise.all([render(long({ pluckDetune: 0 })), render(long({ pluckDetune: 0, ringExact: true }))]);
    const slope = (r) => win(r, 0.1, 0.15) - win(r, 0.6, 0.65); // dB lost over half a second
    expect(slope(loose)).toBeGreaterThan(50);
    expect(slope(exact)).toBeLessThan(30);
  });

  it('the top keys have no damper: released, they ring on', async () => {
    const [plain, free] = await Promise.all([render(one('C7')), render(one('C7', D))]);
    expect(win(free, 0.55, 0.7) - win(plain, 0.55, 0.7)).toBeGreaterThan(15);
  });

  it('a damped key lands a low thud at key-off and lets go slower in the bass', async () => {
    const [quiet, thud] = await Promise.all([render(one('C2', { ...D, thud: false, bass: 1 })), render(one('C2', { ...D, bass: 1 }))]);
    const e = (r) => bandEnergy(r.channels[0], r.sr, Math.round(r.sr * 0.4), 2048, 40, 400);
    expect(e(thud)).toBeGreaterThan(e(quiet));
    const [short, long] = await Promise.all([render(one('C2', { ...D, thud: false, bass: 1 })), render(one('C2', { ...D, thud: false, bass: 3 }))]);
    expect(win(long, 0.6, 0.9)).toBeGreaterThan(win(short, 0.6, 0.9) + 3);
  });

  it('absent, nothing changes; validation teaches it', async () => {
    expect(beatsFeatures(normalizeBeatsManifest(one('C4', undefined, {})))).not.toContain('timbre');
    expect(beatsFeatures(normalizeBeatsManifest(one('C4', D)))).toContain('timbre');
    const v = validateBeatsManifest(one('C4', { above: 200, thud: 0 }));
    expect((v.errors || []).join(' ')).toMatch(/a piano's dampers/);
  });
});

describe("piano: a pianist's touch", () => {
  const part = (touch, events = [[0, ['G4', 'C4', 'E4', 'C3'], 1, 0.6]]) => comp([{ name: 'p', instrument: 'grand-piano-3', touch, events }]);
  const evs = (m) => expandBeatsManifest(m).parts[0].events;

  it('a chord becomes one note per key: top out, inner under, rolled up from the bass, level-neutral', () => {
    const e = evs(part('pianist'));
    expect(e.map((x) => x[1])).toEqual(['C3', 'C4', 'E4', 'G4']);
    expect(e[0][0]).toBe(0);
    for (let i = 1; i < e.length; i++) expect(e[i][0]).toBeGreaterThan(e[i - 1][0]);
    expect(e[3][0]).toBeLessThan(TOUCH_DEFAULTS.roll * 3 * 1.4 + 1e-9); // bpm 60: a quarter is a second
    expect(e[3][3]).toBeGreaterThan(e[0][3]);
    expect(e[0][3]).toBeGreaterThan(e[1][3]);
    expect(e[1][3]).toBe(e[2][3]);
    expect(e.reduce((a, x) => a + x[3], 0) / e.length).toBeCloseTo(0.6, 2);
  });

  it('single notes, articulated chords and touch: false pass through; seeded, so it replays', () => {
    const ev = [[0, 'C4', 1, 0.6], [1, ['C4', 'E4'], 1, 0.6, 'staccato']];
    expect(evs(part('pianist', ev))).toEqual(ev);
    expect(evs(part(false))).toEqual([[0, ['G4', 'C4', 'E4', 'C3'], 1, 0.6]]);
    expect(evs(part('pianist'))).toEqual(evs(part('pianist')));
  });

  it('reaches form phrases through a touched copy', () => {
    const m = comp([{ name: 'p', instrument: 'grand-piano-3', touch: 'pianist', form: [{ phrase: 'a', at: 0 }] }], { phrases: { a: [[0, ['C4', 'E4', 'G4'], 1, 0.6]] } });
    const x = expandBeatsManifest(m);
    const id = x.parts[0].form[0].phrase;
    expect(id).toMatch(/^a~touch-/);
    expect(x.phrases[id]).toHaveLength(3);
    expect(x.phrases.a).toHaveLength(1);
  });

  it('validation teaches it', () => {
    expect((validateBeatsManifest(part({ top: 2 })).errors || []).join(' ')).toMatch(/touch must be 'pianist'/);
    expect(validateBeatsManifest(part({ roll: 0.01 })).errors || []).toEqual([]);
  });
});
