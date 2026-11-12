// The debris shelf (era/debris-shelf.js): what piles up when a place comes down, one row a thing. One row per shape is
// built (picked from the shelf, not listed by hand) and held to what a piece must be: its foot on the ground, its span
// what was asked, cheap, made and not a box.
import { describe, it, expect } from 'vitest';
import { DEBRIS, REPOSE, debrisPiece } from './debris-shelf.js';
import { skandartMatters } from './skandart.js';
import { STAGE_KITS } from './stage.js';

const SHAPES = [...new Set(Object.values(DEBRIS).map((R) => R.shape))];
const oneOf = (pred) => Object.keys(DEBRIS).find((id) => pred(DEBRIS[id]));

describe('the debris shelf', () => {
  it('names each thing in the words people say, made of a matter a kit can paint, at sizes it comes in, resting as it falls', () => {
    const words = Object.values(DEBRIS).flatMap((R) => R.words);
    expect(new Set(words).size).toBe(words.length);
    const matters = skandartMatters(STAGE_KITS['gothic-ashlar']);
    for (const [id, R] of Object.entries(DEBRIS)) {
      expect(matters[R.matter], `${id}: its matter`).toBeDefined();
      expect(R.size[0] < R.size[1], id).toBe(true);
      expect(['lies', 'rolls']).toContain(R.how);
    }
    // (a heap stands at its matter's angle of repose, read from rupa's matters)
    expect(REPOSE.stone).toBeGreaterThan(REPOSE.grit);
  });

  it('builds one row of each shape at its foot, as wide as asked, in a few dozen triangles at most, never a box', () => {
    const ids = [...SHAPES.map((sh) => oneOf((R) => R.shape === sh)), oneOf((R) => R.shape === 'plate' && R.bend)];
    for (const id of ids) {
      const R = DEBRIS[id], w = (R.size[0] + R.size[1]) / 2, P = debrisPiece(id, w, 7);
      const c = P.faces.flatMap((f) => f.corners), span = (k) => Math.max(...c.map((p) => p[k])) - Math.min(...c.map((p) => p[k]));
      expect(Math.min(...c.map((p) => p[2])), `${id}: its foot`).toBeCloseTo(0, 2);
      expect(Math.max(span(0), span(1)), `${id}: its span`).toBeGreaterThan(w * 0.6);
      expect(Math.max(span(0), span(1)), `${id}: its span`).toBeLessThan(w * 1.25);
      expect(P.faces.reduce((a, f) => a + f.corners.length - 2, 0), id).toBeLessThan(60);
      // (not a box: a block is broken at an arris, a plate has more than four sides or a bend, a stick a slanted end)
      expect(P.faces.some((f) => Math.abs(f.normal[0]) > 1e-3 && Math.abs(f.normal[0]) < 0.999 || Math.abs(f.normal[1]) > 1e-3 && Math.abs(f.normal[1]) < 0.999 || f.corners.length > 4), id).toBe(true);
      expect(P.faces.every((f) => f.matter === R.matter)).toBe(true);
    }
    expect(() => debrisPiece('anvil', 0.3, 1)).toThrow(/not on the shelf/);
  });
});
