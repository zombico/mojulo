// PIECES SETTLED ON WHAT IS DRAWN (settle.js): paint lies on the drawn road a hair over it, along its slope end to end and
// across it; a standing piece's foot on the walk under it; a piece over no surface of its kind, or out of reach, is left;
// trees' feet on the ground under them. And the metro: its street's paint on its road wherever it runs.
import { describe, it, expect } from 'vitest';
import { drawnGround, settleStamps, settleTrees, SETTLE } from './settle.js';
import { assembleGeocityScene } from './scene.js';

// a road drawn as one quad 40 m square, its corners off a plane (a drape's cell on a hill's crown: two flat triangles)
const road = { group: 'geocity:road', normal: [0, 0, 1], corners: [[0, 0, 10], [40, 0, 12], [40, 40, 13.6], [0, 40, 10.4]] };
const walk = { group: 'geocity:walk', normal: [0, 0, 1], corners: [[40, 0, 12.15], [44, 0, 12.25], [44, 40, 13.85], [40, 40, 13.75]] };
const ground = { carriage: drawnGround([road, walk], SETTLE.carriage), walked: drawnGround([road, walk], SETTLE.walked) };
// the road's own height at (x, y): its fan triangles from its first corner
const roadZ = (x, y) => ground.carriage.at(x, y, 11, 5).z;

describe('settling on what is drawn', () => {
  it('reads the triangle the page draws, not a plane through the quad', () => {
    // (on the diagonal both triangles agree; off it each its own plane)
    expect(roadZ(20, 20)).toBeCloseTo(11.8, 6);
    expect(roadZ(30, 10)).toBeCloseTo(10 + 30 * 0.05 + 10 * 0.04, 6);
    expect(ground.carriage.at(30, 10, 30)).toBeNull();
  });
  it('paint lies on the road a lift over it, its start and its end both on it, its slope across the road\'s', () => {
    // (a dash put where the land said, a few centimetres off what is drawn)
    const stamps = new Map([['dash', [{ pos: [5, 20, 10.9], rotZ: 0 }]], ['bar', [{ pos: [20, 5, 11.4], rotZ: Math.PI / 2 }]]]);
    const r = settleStamps(stamps, ground);
    expect(r).toEqual({ seated: 2, left: 0 });
    for (const [k, len] of [['dash', SETTLE.paint.dash], ['bar', SETTLE.paint.bar]]) {
      const t = stamps.get(k)[0], a = t.rotZ, [x, y, z] = t.pos, s = t.slope ?? [0, 0];
      expect(z - roadZ(x, y)).toBeCloseTo(SETTLE.lift, 4);
      // (its end: the slope carries it to the road's height there, a lift over it)
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      expect(z + s[0] * (ex - x) + s[1] * (ey - y) - roadZ(ex, ey)).toBeCloseTo(SETTLE.lift, 3);
      // (and its side: the road's slope across it)
      const cx = x - Math.sin(a), cy = y + Math.cos(a);
      expect(z + s[0] * (cx - x) + s[1] * (cy - y) - roadZ(cx, cy)).toBeCloseTo(SETTLE.lift, 3);
    }
  });
  it('a standing piece\'s foot on the walk, never the road beside it; a piece over nothing of its kind is left', () => {
    const lamp = { pos: [42, 20, 12.9] }, lone = { pos: [100, 100, 0] }, high = { pos: [42, 20, 20] };
    const r = settleStamps(new Map([['lamp:e', [lamp, lone, high]], ['wire', [{ pos: [42, 20, 18] }]]]), ground);
    expect(r).toEqual({ seated: 1, left: 2 });
    expect(lamp.pos[2]).toBeCloseTo(ground.walked.at(42, 20, 12.9).z, 6);
    expect(ground.walked.at(42, 20, 12.9).group).toBe('geocity:walk');
    expect(lone.pos).toEqual([100, 100, 0]);
    expect(high.pos[2]).toBe(20);
  });
  it('a tree\'s foot on the ground under it', () => {
    const trees = new Map([['maple', [{ x: 42, y: 30, z0: 13 }]]]);
    expect(settleTrees(trees, ground.walked)).toEqual({ seated: 1, left: 0 });
    expect(trees.get('maple')[0].z0).toBeCloseTo(ground.walked.at(42, 30, 13).z, 4);
  });
});

describe('a metro\'s street settled', () => {
  it('its lane paint lies on its road a lift over it, end to end', () => {
    const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2], evoke: 'neighbourhood', at: 'B4' };
    const P = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity }), G = drawnGround(P.faces, SETTLE.carriage);
    expect(P.geocity.counts.settled.pieces).toBeGreaterThan(1000);
    // (one paint a kind: the concept, not the catalogue)
    for (const kind of ['dash', 'yellow']) {
      const R = P.repeats.find((r) => r.group === `geocity:${kind}`), len = SETTLE.paint[kind];
      let checked = 0;
      for (const t of R.transforms) {
        const a = t.rotZ ?? 0, s = t.slope ?? [0, 0], ex = t.pos[0] + Math.cos(a) * len, ey = t.pos[1] + Math.sin(a) * len;
        const h0 = G.at(t.pos[0], t.pos[1], t.pos[2]), h1 = G.at(ex, ey, t.pos[2]);
        if (!h0 || !h1) continue;
        expect(t.pos[2] - h0.z).toBeCloseTo(SETTLE.lift, 3);
        expect(Math.abs(t.pos[2] + s[0] * (ex - t.pos[0]) + s[1] * (ey - t.pos[1]) - h1.z - SETTLE.lift)).toBeLessThan(0.02);
        checked++;
      }
      expect(checked).toBeGreaterThan(50);
    }
  });
}, 300000);
