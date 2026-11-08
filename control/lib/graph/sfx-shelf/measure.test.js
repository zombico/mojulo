import { describe, it, expect } from 'vitest';
import { measureSound, renderSound, nearBaseline, meetsFloor } from './measure.js';
import { SETS, SET_NAMES, setManifest } from './sets.js';
import { BASELINE } from './baseline.js';

const SR = 44100;
const tone = (hz, secs, at = 0.05) => {
  const y = new Float32Array(Math.round((at + secs + 0.2) * SR));
  for (let i = 0; i < secs * SR; i++) y[Math.round(at * SR) + i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / SR);
  return y;
};

describe('the yardstick (pure)', () => {
  it('a low tone sits in the sub band, a bright one in the high band, and its centroid is its pitch', () => {
    const lo = measureSound(tone(60, 0.3), SR), hi = measureSound(tone(5000, 0.3), SR);
    expect(lo.bands.sub).toBeGreaterThan(0.9);
    expect(hi.bands.high).toBeGreaterThan(0.9);
    expect(Math.abs(hi.centroidHz - 5000)).toBeLessThan(200);
  });

  it('length runs from the onset, not the file\'s start; a steady tone has a crest of 3 dB', () => {
    const m = measureSound(tone(440, 0.2, 0.3), SR);
    expect(Math.abs(m.ms - 200)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.crestDb - 3.01)).toBeLessThan(0.1);
  });

  it('silence measures nothing', () => {
    expect(measureSound(new Float32Array(SR), SR, { layers: 0 })).toEqual({ layers: 0, ms: 0, centroidHz: 0, crestDb: 0, bands: { sub: 0, low: 0, mid: 0, high: 0 }, spread: 0, heard: 0, width: 0 });
  });

  it('two tones fill two bands; a sound in one channel is wide, the same in both is not', () => {
    const lo = tone(60, 0.3), hi = tone(5000, 0.3), both = lo.map((v, i) => v + hi[i]);   // equal energy in two bands
    expect(measureSound(both, SR).spread).toBeCloseTo(2, 1);
    expect(measureSound([both, both], SR).width).toBe(0);
    const side = both.map((v, i) => (i % 2 ? v : -v) * 0.3);
    expect(measureSound([both.map((v, i) => v + side[i]), both.map((v, i) => v - side[i])], SR).width).toBeGreaterThan(0.05);
  });
});

describe('a set cue on the yardstick, rendered as an export renders it', () => {
  // the cue that stacks the most kinds of gesture: the one render that reaches every lowering the set leans on
  const set = SET_NAMES[0], m = setManifest(set);
  const kinds = (c) => new Set(m.cues[c].map((g) => g.type)).size;
  const cue = Object.keys(m.cues).reduce((a, c) => (kinds(c) > kinds(a) ? c : a));

  it(`measures at its baseline (${set}: ${cue})`, async () => {
    const { wav, ...measured } = await renderSound(m, cue);
    expect(nearBaseline(measured, BASELINE[set][cue])).toEqual([]);
  });

  it('a per-hit variant is a sibling: a different render, the same sound on the yardstick', async () => {
    const a = await renderSound(m, cue), b = await renderSound(m, cue, { variant: 1 });
    expect(Buffer.compare(a.wav, b.wav)).not.toBe(0);
    expect(b.layers).toBe(a.layers);
    expect(Math.abs(b.ms - a.ms) / a.ms).toBeLessThan(0.15);
  });

  it('a layered voice meets its floor (the cue its set adds the most layers to)', async () => {
    const s = SET_NAMES.find((n) => SETS[n].floor), F = SETS[s].floor, L = setManifest(s);
    const added = (c) => L.cues[c].length - SETS[F].cues[c].length;
    const c = Object.keys(L.cues).reduce((a, b) => (added(b) > added(a) ? b : a));
    const { wav, ...m } = await renderSound(L, c);
    expect(meetsFloor(m, BASELINE[F][c]), `${s}:${c}`).toEqual([]);
    expect(nearBaseline(m, BASELINE[s][c])).toEqual([]);
  });

  it('the floor law says what a thinner, a dulled, a punchless or another sound lost', () => {
    const f = { layers: 4, ms: 300, centroidHz: 3000, crestDb: 15, bands: {}, spread: 2 };
    expect(meetsFloor({ ...f, layers: 6, spread: 2.2 }, f)).toEqual([]);
    const off = meetsFloor({ layers: 3, ms: 1500, centroidHz: 900, crestDb: 10, spread: 1.2 }, f).join(' | ');
    for (const w of ['layers', 'spread', 'crest', 'over 4', 'another sound']) expect(off).toContain(w);
    expect(meetsFloor({ ...f, layers: 5, spread: 2.6 }, { ...f, spread: 3.2 })).toEqual([]);   // full stays full
  });

  it('every set\'s every cue has a baseline row', () => {
    for (const s of SET_NAMES) expect(Object.keys(BASELINE[s] ?? {}).sort()).toEqual(Object.keys(SETS[s].cues).sort());
  });
});
