/**
 * The scene solver's reads (scene-solver/reads.js) on the smallest scene that still has each: a flat ground map, a
 * straight walk, a tree or two, a hill, a landmark. Each read's concept: what closes over the walk, what blocks the sky,
 * what hides the landmark, what rises; the same scene reads the same twice.
 */
import { describe, expect, it } from 'vitest';

import { fingerprint, SAMPLING } from './reads.js';
import { FLORA_STRIDE } from '../form/flora-read.js';

// a ground map of n×n cells of 1 m, its height by h(x, y) (16 bits over [0, 20]), all of it grass, tall
function groundMap(n, h = () => 0) {
  const px = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = (j * n + i) * 4, v = Math.round((h(i, j) / 20) * 65535); px[q] = v >> 8; px[q + 1] = v & 255; px[q + 2] = 255; px[q + 3] = 0; }
  return { origin: [0, 0], cell: 1, size: [n, n], z: [0, 20], px: Buffer.from(px).toString('base64') };
}
// trees at [x, y] (height 10, crown radius 3), and a walk along y from 5 to 55 at x = 30
function scene({ trees = [], h, landmark = null } = {}) {
  const P = []; for (const [x, y] of trees) P.push(x, y, h ? h(x, y) : 0, 1, 0, 0.1, 0.3, 0.1, 0.3, 0.2, 0.1, 0, 0);
  const path = Array.from({ length: 51 }, (_, i) => [30, 5 + i, 0]);
  return {
    walkers: [{ path }], outTrail: { run: 12, beats: [{ s: 0 }, { s: 50 }] },
    anchors: landmark ? [{ beat: 'landmark', at: landmark, size: 2 }] : [],
    form: { land: { grass: groundMap(60, h) }, flora: { templates: [{ kind: 'tree', name: 'oak', height: 10, radius: 3 }], trees: Buffer.from(new Float32Array(P).buffer).toString('base64'), n: trees.length } },
  };
}

describe('scene reads', () => {
  it('canopy: the walk under crowns; openness: trees over it close the sky', () => {
    const bare = fingerprint(scene()), wood = fingerprint(scene({ trees: Array.from({ length: 12 }, (_, k) => [30 + (k % 2 ? 2 : -2), 8 + k * 4]) }));
    expect(bare.canopy).toBe(0);
    expect(bare.openness).toBeGreaterThan(0.99);
    expect(wood.canopy).toBeGreaterThan(0.5);
    expect(wood.openness).toBeLessThan(bare.openness);
    expect(wood.flora.trees).toBe(12);
    expect(wood.flora.species).toEqual({ oak: 1 });
  });

  it('verticality: a walk over a hill rises, a flat one does not', () => {
    const hill = (x, y) => Math.max(0, 6 - Math.abs(y - 30) / 3);
    expect(fingerprint(scene()).verticality.range).toBe(0);
    expect(fingerprint(scene({ h: hill })).verticality.range).toBeGreaterThan(4);
  });

  it('reveal: a landmark behind a ridge the walk crosses is hidden early and seen late', () => {
    // (a ridge across the walk at y = 30, a gap where the walk crosses it, the landmark beyond it off the gap's line; and
    // none at all reads null)
    const ridge = (x, y) => (Math.abs(y - 30) < 2 && Math.abs(x - 30) > 1.5 ? 12 : 0);
    const F = fingerprint(scene({ h: ridge, landmark: [44, 56, 0] }), { detail: true });
    expect(F.reveal).toBeGreaterThan(0.5);
    expect(F.detail.landmarkSeen[0]).toBe(false);
    expect(fingerprint(scene({ landmark: [30, 58, 0] })).reveal).toBe(0);
    expect(fingerprint(scene()).reveal).toBeNull();
  });

  it('the walk is its length out to the exit, sampled every few metres; the same scene reads the same twice', () => {
    const F = fingerprint(scene({ trees: [[28, 20]] }));
    expect(F.walk.metres).toBeCloseTo(50, 0);
    expect(SAMPLING.step).toBeGreaterThan(0);
    expect(JSON.stringify(fingerprint(scene({ trees: [[28, 20]] })))).toBe(JSON.stringify(F));
    expect(FLORA_STRIDE).toBe(13);
  });

  it('colour: a cube of one hue spreads none, of opposite hues spreads more', () => {
    const one = fingerprint(scene(), { colours: { a: '#cc3333', b: '#aa2222' } }).colour, two = fingerprint(scene(), { colours: { a: '#cc3333', b: '#33cccc' } }).colour;
    expect(one.hueSpread).toBeLessThan(0.05);
    expect(two.hueSpread).toBeGreaterThan(0.8);
  });
});
