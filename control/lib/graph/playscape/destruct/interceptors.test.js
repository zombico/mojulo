/**
 * The slicing interceptors: what the cut looks like while it happens, grown on the cleave's own sites (its planes and
 * their score on the skin), seeded, each kind an aggressiveness from 0 to 1, and timed so the chunks part when the
 * last stroke is drawn.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from '../objects/index.js';
import { cleave } from './cleave.js';
import { collapse } from './collapse.js';
import { slicing, SLICE_KINDS, CUT_STYLE_IDS } from './interceptors.js';
import { V } from './polytope.js';

const door = () => resolveObject({ entry: 'door', variant: 'single', skin: 'plank', fit: { width: 1.4, height: 2.6 } });
const count = (s) => Object.fromEntries(SLICE_KINDS.map((k) => [k, s.elements.filter((e) => e.kind === k).length]));
const onSkin = (blocks, p) => blocks.some((b) => {
  const d = V.sub(p, b.c), o = [b.A, b.B, b.C].map((a, k) => Math.abs(V.dot(d, V.unit(a))) - b.h[k]);
  return o.every((x) => x <= 1e-3) && o.some((x) => x > -1e-3);
});

describe('the score and the strokes', () => {
  it('every cut face names its plane, and the score lies on the item\'s skin', () => {
    const o = door(), c = cleave(o, { pattern: 'grid', cell: 0.45 });
    expect(c.chunks.flatMap((k) => k.faces).filter((f) => f.cut).every((f) => /^g\d\.\d+$/.test(f.plane))).toBe(true);
    const s = slicing(c, o);
    const scores = s.elements.filter((e) => e.kind === 'score');
    expect(scores.length).toBeGreaterThan(0);
    for (const e of scores) for (const p of [e.from, e.to]) expect(onSkin(o.faces.boxes, p)).toBe(true);
  });

  it('a grid is drawn plane by plane, axis by axis: the # in order, the chunks parting after the last', () => {
    const s = slicing(cleave(door(), { pattern: 'grid', cell: 0.45 }), door());
    expect(s.strokes.map((x) => x.plane)).toEqual(['g0.0', 'g0.1', 'g2.0', 'g2.1', 'g2.2', 'g2.3', 'g2.4']);
    s.strokes.forEach((x, i) => i && expect(x.birth).toBeGreaterThan(s.strokes[i - 1].birth));
    expect(s.cutAt).toBeCloseTo(Math.max(...s.strokes.map((x) => x.birth + x.sweep)), 5);
    expect(s.strokes[0].dir).toEqual([0, 0, -1]);          // an upright plane swept down
    expect(s.strokes.at(-1).dir).toEqual([1, 0, 0]);       // a level one swept across
  });

  it('a shatter cracks out from the impact: nearer planes first, each swept across the item, not through it', () => {
    const o = door(), c = cleave(o, { pattern: 'voronoi', count: 12, seed: 7 });
    const s = slicing(c, o, { origin: [0.2, -0.6, 1.2], speed: 14 });
    expect(s.cutAt).toBeLessThan(0.3);
    for (const x of s.strokes) expect(Math.abs(x.dir[1])).toBeLessThan(0.2);   // the door's thickness is y
  });
});

describe('aggressiveness and the timeline', () => {
  it('0 grows nothing; each kind answers to its own dial', () => {
    const o = door(), c = cleave(o, { pattern: 'grid', cell: 0.45 });
    expect(slicing(c, o, { intensity: 0 }).elements).toEqual([]);
    const only = count(slicing(c, o, { intensity: 0, spark: 1 }));
    expect(only.spark).toBeGreaterThan(0);
    expect(only.score + only.blade + only.glint + only.dust).toBe(0);
    expect(count(slicing(c, o, { intensity: 0.3 })).spark).toBeLessThan(count(slicing(c, o)).spark);
    expect(() => slicing(c, o, { dust: 2 })).toThrow(/0 \(none\) to 1/);
  });

  it('nothing sparks before the blade reaches it; every glint is a cut face of its chunk', () => {
    const o = door(), c = cleave(o, { pattern: 'grid', cell: 0.45 }), s = slicing(c, o);
    const first = Math.min(...s.strokes.map((x) => x.birth));
    for (const e of s.elements.filter((x) => x.kind === 'spark')) expect(e.birth).toBeGreaterThanOrEqual(first);
    for (const g of s.elements.filter((x) => x.kind === 'glint')) expect(c.chunks.find((k) => k.id === g.chunk).faces[g.face].cut).toBe(true);
    for (const d of s.elements.filter((x) => x.kind === 'dust')) expect(d.birth).toBeGreaterThanOrEqual(s.cutAt);
  });

  it('the chunks stay whole until the cut is drawn: collapse waits `delay`', () => {
    const o = door(), c = cleave(o, { pattern: 'grid', cell: 0.45 }), s = slicing(c, o);
    const run = collapse(c.chunks, { delay: s.cutAt });
    run.tracks.forEach((t, i) => { for (const f of t.frames.filter((x) => x.t < s.cutAt - 1e-6)) expect(f.pos).toEqual(c.chunks[i].centroid); });
  });

  it('is seeded: the same in, the same out', () => {
    const o = door(), c = cleave(o, { pattern: 'voronoi', count: 10, seed: 3 });
    expect(JSON.stringify(slicing(c, o, { seed: 9 }))).toBe(JSON.stringify(slicing(c, o, { seed: 9 })));
  });
});

describe('the cut is a style', () => {
  const o = door(), slice = cleave(o, { pattern: 'slice', count: 2, seed: 5 });
  const kinds = (s) => new Set(s.elements.map((e) => e.kind));

  it('a slice cuts the item in clean planes: two cuts, four pieces, the whole volume', () => {
    expect(slice.chunks).toHaveLength(4);
    expect(slice.slices).toHaveLength(2);
    const whole = cleave(o, { pattern: 'grid', cell: 10 }).chunks.reduce((a, c) => a + c.volume, 0);
    expect(slice.chunks.reduce((a, c) => a + c.volume, 0)).toBeCloseTo(whole, 4);
    expect(cleave(o, { pattern: 'slice', planes: [{ at: [0, 0, 1.3], normal: [0, 0, 1] }] }).chunks).toHaveLength(2);
  });

  it('each style grows its own marks, in values only on fx groups (colour is the tone\'s)', () => {
    const by = Object.fromEntries(CUT_STYLE_IDS.map((st) => [st, slicing(slice, o, { style: st, origin: [0.2, -0.6, 1.2] })]));
    expect([...kinds(by.laser)]).toEqual(expect.arrayContaining(['beam', 'score', 'spark']));
    expect(kinds(by.laser).has('blade')).toBe(false);
    expect(by.anime.elements.filter((e) => e.kind === 'blade').every((e) => e.shape === 'crescent')).toBe(true);
    expect([...kinds(by.anime)]).toContain('flash');
    expect([...kinds(by.impact)]).toEqual(expect.arrayContaining(['ring', 'flash', 'spark', 'dust']));
    for (const s of Object.values(by)) for (const e of s.elements) {
      expect(e.group).toMatch(/^fx:/);
      for (const v of [e.value, e.peak, e.kind === 'glint' ? e.to : undefined].filter((x) => x !== undefined)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(JSON.stringify(e)).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
    expect(() => slicing(slice, o, { style: 'chainsaw' })).toThrow(/blade, laser, anime, impact/);
  });

  it('anime: the slash, then the beat with nothing on the item, then every score at once', () => {
    const s = slicing(slice, o, { style: 'anime', beat: 0.5 });
    const slashed = Math.max(...s.strokes.map((x) => x.birth + x.sweep));
    for (const e of s.elements.filter((x) => ['score', 'glint', 'spark'].includes(x.kind))) expect(e.birth).toBeGreaterThanOrEqual(slashed + 0.5 - 1e-9);
    expect(s.elements.find((e) => e.kind === 'flash').birth).toBeCloseTo(slashed + 0.5, 5);
  });

  it('anime: the halves slip along the cut, opposite ways', () => {
    const one = cleave(o, { pattern: 'slice', planes: [{ at: [0, 0, 1.3], normal: [0.6, 0, 0.8] }] }), s = slicing(one, o, { style: 'anime' });
    const [a, b] = one.chunks.map((c) => s.spread.offsets[c.id]);
    expect(V.len(V.add(a, b))).toBeLessThan(1e-6);
    expect(Math.abs(V.dot(a, [0.6, 0, 0.8]))).toBeLessThan(1e-6);      // along the plane, not apart from it
    const run = collapse(one.chunks, { mode: 'none', delay: s.cutAt, spread: s.spread });
    run.tracks.forEach((t, i) => expect(V.len(V.sub(t.frames.at(-1).pos, V.add(one.chunks[i].centroid, s.spread.offsets[one.chunks[i].id])))).toBeLessThan(0.05));
  });

  it('laser: one beam at a time, the score glowing long after; impact: the ring first, the pieces burst from the hit', () => {
    const l = slicing(slice, o, { style: 'laser' });
    l.strokes.forEach((x, i) => i && expect(x.birth).toBeGreaterThanOrEqual(l.strokes[i - 1].birth + l.strokes[i - 1].sweep));
    expect(l.elements.find((e) => e.kind === 'score').cool).toBeGreaterThan(1);
    const im = slicing(slice, o, { style: 'impact', origin: [0.3, -0.6, 1.6] });
    expect(im.elements.find((e) => e.kind === 'ring').birth).toBe(0);
    expect(im.origin[0]).toBeCloseTo(0.3, 5);
    expect(im.origin[2]).toBeCloseTo(1.6, 5);
  });

  it('a mark can be tuned or switched off on top of its style', () => {
    expect(slicing(slice, o, { style: 'laser', marks: { spark: { rate: 0 } } }).elements.some((e) => e.kind === 'spark')).toBe(false);
    expect(slicing(slice, o, { style: 'impact', ring: 0 }).elements.some((e) => e.kind === 'ring')).toBe(false);
  });
});
