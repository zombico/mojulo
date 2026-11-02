// THE RECEPTACLES: each kind of the shelf drawn true to its size in the realistic register, and in the askew register
// its own drawing of the same thing, both standing on the ground. One case a group (the concept, not the catalogue).
import { describe, it, expect } from 'vitest';
import { RECEPTACLES, RECEPTACLE_IDS, RECEPTACLE_GROUPS, receptacleOf } from './receptacles.js';
import { proportions } from './doodads.js';
import { mulberry32 } from '../city/plan/dice.js';

const span = (fs, i) => { const v = fs.flatMap((f) => f.corners.map((c) => c[i])); return [Math.min(...v), Math.max(...v)]; };
// (a kind a group, chosen from the shelf: its first)
const CASES = RECEPTACLE_GROUPS.map((g) => RECEPTACLE_IDS.find((id) => RECEPTACLES[id].group === g));

describe('the receptacles', () => {
  it('files every kind in a group and refuses one off the shelf by name', () => {
    for (const id of RECEPTACLE_IDS) expect(RECEPTACLE_GROUPS).toContain(RECEPTACLES[id].group);
    expect(() => receptacleOf('skip-bin', proportions(mulberry32(1), false), mulberry32(1))).toThrow(/not a kind/);
  });

  it('draws a realistic one inside its footprint and its height, standing on the ground', () => {
    for (const id of CASES) {
      const K = RECEPTACLES[id], fs = receptacleOf(id, proportions(mulberry32(2), false), mulberry32(2));
      const [x0, x1] = span(fs, 0), [y0, y1] = span(fs, 1), [z0, z1] = span(fs, 2);
      expect(z0, id).toBeGreaterThanOrEqual(-1e-6);
      expect(x1 - x0, id).toBeLessThanOrEqual(K.w + 0.35);
      expect(y1 - y0, id).toBeLessThanOrEqual(K.d + 0.35);
      expect(z1, id).toBeLessThanOrEqual(K.h + 0.15);
    }
  });

  it('draws an askew one its own way: on the ground, not the realistic one, the same from the same dice', () => {
    for (const id of CASES) {
      const a = receptacleOf(id, proportions(mulberry32(5), true), mulberry32(5)), b = receptacleOf(id, proportions(mulberry32(5), true), mulberry32(5));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(receptacleOf(id, proportions(mulberry32(5), false), mulberry32(5))));
      expect(span(a, 2)[0], id).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});
