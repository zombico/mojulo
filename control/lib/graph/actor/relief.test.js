import { describe, it, expect } from 'vitest';
import { reliefOf, reliefFrom, heightAt, levelled, RISER } from './relief.js';
import { standingOf } from './ground.js';

// ground that is not flat, walked as a world's own walk walks it. Tested on faces built by hand the way every world
// resolves to them: a slope, a level stretch, a house on the slope, a cliff.
const UP = [0, 0, 1];
const quad = (a, b, c, d, normal) => ({ corners: [a, b, c, d], ...(normal ? { normal } : {}) });
/** ground from x0 to x1 rising along x from z0 to z1 */
const land = (x0, x1, z0, z1) => quad([x0, -20, z0], [x1, -20, z1], [x1, 20, z1], [x0, 20, z0], UP);
/** a closed box standing from z0 to z1 */
const box = (x0, y0, x1, y1, z0, z1) => [
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], UP),
  quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]), quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]),
  quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]),
];
// a hillside: level to x 0, then a rise of 1 in 5 to x 20 (4 m up), a house standing on it at x 8..11
// (the land in strips, as a world's terrain is in small faces: a face is laid level by its corners)
const HILL = [land(-20, 0, 0, 0), ...Array.from({ length: 10 }, (_, i) => land(i * 2, i * 2 + 2, i * 0.4, i * 0.4 + 0.4)), ...box(8, 2, 11, 5, 1.6, 5)];

describe('the ground a scene is played on', () => {
  it('follows a slope from where the scene stands, and does not climb a house', () => {
    const R = reliefOf(HILL, [[-2, 0, 0]]);
    expect(heightAt(R, -5, 0)).toBeCloseTo(0, 2);
    expect(heightAt(R, 5, 0)).toBeCloseTo(1, 1);
    expect(heightAt(R, 10, -3)).toBeCloseTo(2, 1);
    // under the house the ground is the slope's, not its roof
    expect(heightAt(R, 9.5, 3.5)).toBeLessThan(2.6);
    expect(R.hi - R.lo).toBeGreaterThan(2);
  });

  it('laid level, the hillside is clear ground and the house still stands on it', () => {
    const R = reliefOf(HILL, [[-2, 0, 0]]), flat = levelled(HILL, R);
    const { blocks } = standingOf(flat, { about: [[6, 0]] });
    const at = (p) => blocks.some((B) => p[0] > B.min[0] && p[0] < B.max[0] && p[1] > B.min[1] && p[1] < B.max[1]);
    for (const p of [[2, 0], [6, -3], [12, 0]]) expect(at(p)).toBe(false);
    // (its walls: a block lies across each)
    expect(blocks.some((B) => B.min[0] <= 8 && B.max[0] >= 8 && B.min[1] < 3.5 && B.max[1] > 3.5 && B.h > 1.2)).toBe(true);
    // read as it lies, the same hillside stands in the way
    expect(standingOf(HILL, { about: [[6, 0]] }).blocks.length).toBeGreaterThan(blocks.length);
  });

  it('stops at a cliff: what is past it keeps the height of the nearest ground walked', () => {
    const R = reliefOf([land(-20, 4, 0, 0), land(4, 20, 3, 3), quad([4, -20, 0], [4, 20, 0], [4, 20, 3], [4, -20, 3], [-1, 0, 0])], [[0, 0, 0]]);
    expect(RISER).toBeLessThan(3);
    expect(heightAt(R, 2, 0)).toBeCloseTo(0, 2);
    expect(heightAt(R, 8, 0)).toBeCloseTo(0, 2);
  });

  it('a place that names no height is stood on the ground under it; nothing under any seed is no relief', () => {
    expect(heightAt(reliefOf(HILL, [[5, 0, 40]]), 5, 0)).toBeCloseTo(1, 1);
    expect(reliefOf(HILL, [[500, 500, 0]])).toBe(null);
    expect(reliefOf([], [[0, 0, 0]])).toBe(null);
  });

  it('is measured from the set\'s floor for a film, and is deterministic', () => {
    const R = reliefOf(HILL, [[5, 0, 1]]), F = reliefFrom(R, 1);
    expect(heightAt(F, 5, 0)).toBeCloseTo(0, 1);
    expect(heightAt(F, 10, -3)).toBeCloseTo(1, 1);
    expect(JSON.stringify(reliefOf(HILL, [[5, 0, 1]]))).toBe(JSON.stringify(R));
  });
});
