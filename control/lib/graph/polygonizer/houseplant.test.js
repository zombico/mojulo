import { describe, it, expect } from 'vitest';
import { houseplantToFaces, HOUSEPLANT_NAMES } from './houseplant.js';

const isHex = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
const finiteFace = (f) => Array.isArray(f.corners) && f.corners.length >= 3
  && f.corners.every((c) => Array.isArray(c) && c.length === 3 && c.every(Number.isFinite))
  && isHex(f.fill);

describe('houseplant', () => {
  it('every catalog kind bakes to a non-empty list of valid lit faces', () => {
    for (const kind of HOUSEPLANT_NAMES) {
      const faces = houseplantToFaces({ kind, base: { x: 0, y: 0, z: 0 } });
      expect(faces.length).toBeGreaterThan(0);
      expect(faces.every(finiteFace)).toBe(true);
    }
  });

  it('unknown kind falls back to a default (still renders)', () => {
    expect(houseplantToFaces({ kind: 'not-a-plant' }).length).toBeGreaterThan(0);
  });

  it('is deterministic — same spec yields byte-identical faces', () => {
    const spec = { kind: 'fiddle-leaf', base: { x: 1, y: 2, z: 0 }, scale: 1.2 };
    expect(JSON.stringify(houseplantToFaces(spec))).toBe(JSON.stringify(houseplantToFaces(spec)));
  });

  it('base offsets the whole plant (pot + foliage) into world space', () => {
    const at0 = houseplantToFaces({ kind: 'snake-plant', base: { x: 0, y: 0, z: 0 } });
    const at5 = houseplantToFaces({ kind: 'snake-plant', base: { x: 5, y: 0, z: 0 } });
    const minX = (fs) => Math.min(...fs.flatMap((f) => f.corners.map((c) => c[0])));
    expect(minX(at5) - minX(at0)).toBeCloseTo(5, 5);
  });

  it('scale grows the object; a floor plant stands taller than a tabletop one', () => {
    const small = houseplantToFaces({ kind: 'succulent', scale: 1 });
    const big = houseplantToFaces({ kind: 'succulent', scale: 2 });
    const maxZ = (fs) => Math.max(...fs.flatMap((f) => f.corners.map((c) => c[2])));
    expect(maxZ(big)).toBeGreaterThan(maxZ(small));
    // a fiddle-leaf (floor) is taller than a succulent (tabletop) at the same scale
    expect(maxZ(houseplantToFaces({ kind: 'fiddle-leaf' }))).toBeGreaterThan(maxZ(small));
  });

  it('potSides controls pot facet count without breaking faces', () => {
    const coarse = houseplantToFaces({ kind: 'succulent' }, { potSides: 8 });
    const fine = houseplantToFaces({ kind: 'succulent' }, { potSides: 32 });
    expect(fine.length).toBeGreaterThan(coarse.length);
    expect(fine.every(finiteFace)).toBe(true);
  });
});
