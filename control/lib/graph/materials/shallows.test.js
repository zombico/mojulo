import { describe, expect, it } from 'vitest';

import { basinFaces, basinFootprint, bedDepth, normalizeShallows, waterAt } from './shallows.js';
import { shallowsChannelScript } from '../scene/channels/shallows.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const two = () => normalizeShallows([{ kind: 'pool', at: [-12, 0], size: [12, 6] }, { kind: 'pond', at: [10, 2], radius: 6, seed: 3 }]);

describe('shallow bodies (pools and ponds)', () => {
  it('normalises to the same bytes twice, and drops an unknown kind', () => {
    expect(JSON.stringify(two())).toBe(JSON.stringify(two()));
    expect(normalizeShallows([{ kind: 'lava' }, null])).toEqual([]);
  });

  it('gives a pool a shallow end and a deep end, and nothing outside its walls', () => {
    const [pool] = two();
    expect(bedDepth(pool, -17.5, 0)).toBeCloseTo(pool.shallow, 4);
    expect(bedDepth(pool, -6.5, 0)).toBeCloseTo(pool.deep, 4);
    expect(bedDepth(pool, -12, 3.5)).toBeLessThanOrEqual(0);
  });

  it('gives a pond a bowl that meets its bank at the shore', () => {
    const [, pond] = two();
    expect(bedDepth(pond, 10, 2)).toBeCloseTo(pond.deep, 4);
    expect(bedDepth(pond, 10 + pond.radii[0] * 1.4, 2)).toBeLessThan(0);           // the bank, above the level
    expect(bedDepth(pond, 10 + pond.radii[0] * 1.4, 2)).toBeGreaterThanOrEqual(-pond.freeboard);
  });

  it('answers waterAt with the body, its level and the depth; null on dry ground', () => {
    const bodies = two();
    expect(waterAt(bodies, -12, 0)).toMatchObject({ body: 'pool0', level: bodies[0].level });
    expect(waterAt(bodies, 10, 2).depth).toBeGreaterThan(1);
    expect(waterAt(bodies, 0, 0)).toBeNull();
  });

  it('builds a sim grid whose depths match the bed and stay under the size cap', () => {
    for (const b of two()) {
      const { nx, ny, depth, x0, y0, dx, dy } = b.grid;
      expect(nx).toBeLessThanOrEqual(161);
      expect(depth).toHaveLength(nx * ny);
      const i = Math.floor(nx / 2), j = Math.floor(ny / 2);
      expect(depth[j * nx + i]).toBeCloseTo(bedDepth(b, x0 + i * dx, y0 + j * dy), 2);
    }
  });

  it('builds a basin inside its footprint, rising to the ground at the rim', () => {
    for (const b of two()) {
      const [x0, y0, x1, y1] = basinFootprint(b), faces = basinFaces(b);
      expect(faces.length).toBeGreaterThan(4);
      for (const f of faces) for (const [x, y, z] of f.corners) {
        expect(x).toBeGreaterThanOrEqual(x0 - 1e-6); expect(x).toBeLessThanOrEqual(x1 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(y0 - 1e-6); expect(y).toBeLessThanOrEqual(y1 + 1e-6);
        expect(z).toBeLessThanOrEqual(b.ground + 1e-6);
      }
    }
  });
});

describe('the shallows channel', () => {
  it('emits the sim, the bus and the walk hooks only when asked', () => {
    const src = shallowsChannelScript({ bodies: two(), floaters: [{ at: [-12, 0], shape: 'duck' }], walk: true });
    expect(src).toMatch(/window\.__aqWater = \{/);
    expect(src).toMatch(/stepShallows = \(t\)/);
    expect(src).toMatch(/WALK\.speed = __shWalkBase/);
    expect(shallowsChannelScript({ bodies: two() })).not.toMatch(/WALK\.speed/);
  });

  it('adds nothing to a page without shallows, and steps the sim on a page with them', () => {
    const faces = [{ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888888' }];
    const plain = emitThreeWorld({ faces });
    expect(plain).not.toMatch(/__aqWater|stepShallows/);
    expect(emitThreeWorld({ faces, shallows: { bodies: [] } })).toBe(plain);
    const page = emitThreeWorld({ faces, shallows: { bodies: two() } });
    expect(page).toMatch(/stepShallows\(t\);/);
  });
});

describe('a pond sized to a plot', () => {
  it('fills a w × d plot: its basin is the plot, the bank meets the ground at the plot edge', () => {
    const [p] = normalizeShallows([{ kind: 'pond', at: [5, 5], size: [8, 4], seed: 2 }]);
    const [x0, y0, x1, y1] = basinFootprint(p);
    expect([x1 - x0, y1 - y0].map((v) => +v.toFixed(3))).toEqual([8, 4]);
    expect(bedDepth(p, 5, 5)).toBeGreaterThan(0);
    for (const [x, y] of [[x0, 5], [x1, 5], [5, y0], [5, y1]]) expect(bedDepth(p, x, y)).toBeCloseTo(-p.freeboard, 3);
  });
});
