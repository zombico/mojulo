// Fixtures at true size. The laws: each fixture builds at its catalogue size (its footprint to the inch, its height up
// to its tap or head); the same id gives the same manifest; nothing in a builder draws dice or reads a clock.

import { describe, it, expect } from 'vitest';
import { FIXTURES, fixtureManifest, fixtureSize } from './fixtures.js';
import { workbenchAssetFaces } from '../worlds/workbench.js';

const bbox = (faces) => {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const f of faces) for (const [x, y, z] of f.corners) { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); }
  return b;
};
const MM = 304.8, inch = 1 / 12;

describe('fixtures', () => {
  for (const id of Object.keys(FIXTURES)) {
    it(`${id} builds at its catalogue size`, () => {
      const s = fixtureSize(id, MM), b = bbox(workbenchAssetFaces(fixtureManifest(id, MM)));
      expect(b.x1 - b.x0, 'width').toBeGreaterThan(s.w * 0.9);
      expect(b.x1 - b.x0, 'width').toBeLessThan(s.w + 2 * inch);           // a top or rim may overhang an inch
      expect(b.y1 - b.y0, 'depth').toBeLessThan(s.d + 3 * inch);
      expect(b.z0, 'on the floor').toBeGreaterThanOrEqual(-1e-9);
      expect(b.z1, 'height').toBeLessThan(s.h + 12 * inch);                // a tap or filler stands above its rim
      expect(Math.abs(b.x0 + b.x1), 'centred').toBeLessThan(2 * inch);
    });
  }
  it('every fixture carries a mark and its clearances in mm', () => {
    for (const [id, f] of Object.entries(FIXTURES)) {
      expect(f.mark, id).toMatch(/^[A-Z]+$/);
      expect(f.front, id).toBeGreaterThanOrEqual(0);
    }
    expect(FIXTURES.wc.front).toBeCloseTo(21 * 25.4, 6);
    expect(FIXTURES.wc.side).toBeCloseTo(15 * 25.4, 6);
  });
  it('is the same manifest for the same id, and refuses an unknown one', () => {
    expect(fixtureManifest('wc', MM)).toBe(fixtureManifest('wc', MM));
    expect(JSON.stringify(fixtureManifest('bathtub', MM))).toBe(JSON.stringify(fixtureManifest('bathtub', MM)));
    expect(() => fixtureSize('bidet')).toThrow(/unknown 'bidet'/);
  });
});
