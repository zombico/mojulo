// THE SUBWAY UNDER A GEOCITY (`geocity.subway`, geocity/subway.js): a line under one of an evocation's arterials (by
// default the flatter spine over its span, turned to that street's axis), its stations under the carriageway at their
// own depth under the street over them, its tunnels graded between them, each station's way out a stair up to the
// sidewalk through a well cut in the walk; walked along each platform, from one platform to the next, and from a
// platform up to the sidewalk, and back.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';
import { designGeocity } from './design.js';
import { subwayStreet } from './subway.js';
import { walker } from '../network/walk-gate.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon' };

describe('a subway under an evocation\'s street', () => {
  const N = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', subway: true } }), U = N.geocity.subway;
  const of = (k) => N.anchors.filter((a) => a.kind === k);

  it('runs under the flatter spine, its stations under its carriageway at their depth, its tunnels within a rail\'s grade', () => {
    const d = designGeocity({ ...geocity, evoke: 'neighbourhood', subway: true }, { seed: 2 }), l = d.lines.find((x) => x.id === U.along);
    expect(l.rank).toBe('spine');
    expect(U.stations).toHaveLength(2);
    expect(of('rail-tunnel')).toHaveLength(2);
    for (const t of U.tunnels) { expect(t.grade).toBeLessThanOrEqual(1 / 30 + 1e-6); expect(t.findings).toBeUndefined(); }
    // (every platform lies under the street's carriageway, each its depth under it)
    const across = l.axis === 'ns' ? 0 : 1;
    for (const s of of('station')) for (const p of s.platforms.flat()) expect(Math.abs(p[across] - l.at)).toBeLessThan(l.road / 2);
    expect(U.z0.every((z, i) => z < U.z0[0] + 10 && Number.isFinite(z) && (i === 0 || Math.abs(z - U.z0[i - 1]) <= U.gap / 30))).toBe(true);
    for (const g of ['subway:tunnel-rail', 'station:platform', 'station:train', 'subway:entrance-stair', 'subway:entrance-railing']) expect(N.faces.some((f) => f.group === g), g).toBe(true);
  });

  it('opens a stairwell in the sidewalk for each way out, nothing of the street\'s standing in it', () => {
    const d = designGeocity({ ...geocity, evoke: 'neighbourhood', subway: true }, { seed: 2 }), l = d.lines.find((x) => x.id === U.along), across = l.axis === 'ns' ? 0 : 1;
    for (const e of of('entrance')) {
      // (its head on the walk: between the kerb and the street's edge)
      const off = Math.abs(e.door[across] - l.at);
      expect(off).toBeGreaterThan(l.road / 2);
      expect(off).toBeLessThan(l.half);
    }
    const wells = of('entrance').map((e) => e.walk.at(-2));
    for (const r of N.repeats ?? []) for (const t of r.transforms) for (const w of wells) expect(Math.hypot(t.pos[0] - w[0], t.pos[1] - w[1]) < 0.3).toBe(false);
  });

  it('stands a streetcar at its stop on each track of the streetcar line crossing over it, its pantograph to the wire', () => {
    const d = designGeocity({ ...geocity, evoke: 'neighbourhood', subway: true }, { seed: 2 }), l = d.lines.find((x) => x.id === U.along);
    const across = d.lines.filter((x) => x.axis !== l.axis && x.tracks.length);
    expect(across.length).toBeGreaterThan(0);
    expect(U.streetcars.length).toBeGreaterThan(0);
    for (const c of U.streetcars) { const x = d.lines.find((q) => q.id === c.line); expect(x.axis).not.toBe(l.axis); expect(Math.abs(c.at[x.axis === 'ns' ? 0 : 1] - x.at)).toBeLessThan(x.road / 2); }
    // (its collector bar just under the contact wire, 5.6 m over its street)
    for (const c of U.streetcars) {
      const near = N.faces.filter((f) => f.group === 'geocity:streetcar' && f.corners.every((p) => Math.hypot(p[0] - c.at[0], p[1] - c.at[1]) < 20)).flatMap((f) => f.corners.map((p) => p[2]));
      expect(Math.max(...near) - c.at[2]).toBeGreaterThan(5.2);
      // (over its lowest corner: the street falls along its 30 m)
      expect(Math.max(...near) - c.at[2]).toBeLessThan(7.2);
    }
    expect(N.colliders.some((c) => c.of.startsWith('streetcar:'))).toBe(true);
    expect(N.faces.some((f) => f.group === 'subway:entrance-kerb')).toBe(true);
  });

  it('is walked along its platforms, from one platform to the next, and up to the sidewalk, and back', () => {
    const walk = walker(N);
    const routes = [...of('station').flatMap((s) => s.platforms), ...of('rail-tunnel').map((t) => t.walk), ...of('station').flatMap((s) => s.up.map((u, i) => [...u, ...of('entrance').filter((e) => e.station === s.id)[i].walk.slice(1)]))];
    for (const r of routes) for (const pts of [r, r.slice().reverse()]) {
      const w = walk(pts);
      expect({ steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
    }
  });

  it('is absent unless asked, and refuses a street it cannot run under, by name', () => {
    const plain = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood' } });
    expect(plain.geocity.subway).toBeUndefined();
    expect(plain.faces.some((f) => String(f.group).startsWith('subway:'))).toBe(false);
    const d = designGeocity({ ...geocity, evoke: 'neighbourhood' }, { seed: 2 });
    expect(() => subwayStreet(d, 'ns-99')).toThrow(/is not one of its arterials/);
    expect(() => assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', subway: { lines: 2 } } })).toThrow(/subway.lines is not a setting/);
    expect(() => assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'metro', subway: true } })).toThrow(/subway is an evocation's/);
  });
});
