import { describe, it, expect } from 'vitest';
import { MAP_FORMS, planMap, mapLaws, seeAt, validateMap, WARN_S, GRID } from './map.js';
import { CRAFT } from './eye.js';

// one form per backdrop procedure: water at the datum, a wall round the reach, a wall along one axis
const pick = (test) => Object.keys(MAP_FORMS).find((k) => test(MAP_FORMS[k]));
const seaForm = pick((f) => f.sea), wallForm = pick((f) => f.wall && !f.axis), axisForm = pick((f) => f.axis);
const fastest = Object.keys(CRAFT).sort((a, b) => CRAFT[b].max - CRAFT[a].max)[0];

describe('what a map is', () => {
  it('nests its rings: field inside reach inside root', () => {
    const m = planMap({ form: seaForm });
    expect(m.rings.reach.hx).toBeGreaterThan(m.rings.field.hx);
    expect(m.rings.root.hx).toBeGreaterThan(m.rings.reach.hx);
  });

  it('keeps every law on one form per backdrop procedure, and at the fastest craft', () => {
    for (const form of [seaForm, wallForm, axisForm]) {
      const bad = mapLaws(planMap({ form })).filter((l) => !l.ok);
      expect(bad, `${form}: ${bad.map((l) => l.note).join('; ')}`).toEqual([]);
    }
    const bad = mapLaws(planMap({ form: seaForm, craft: fastest })).filter((l) => !l.ok);
    expect(bad.map((l) => l.law)).toEqual([]);
  });

  it('hides the edge: from the reach at the ceiling the haze closes before the root ends', () => {
    const m = planMap({ form: seaForm, field: 9000, craft: fastest, ceiling: 8000 });
    expect(Math.max(m.rings.reach.hx, m.rings.reach.hy) + seeAt(m, m.ceiling)).toBeLessThanOrEqual(m.rings.root.hx);
  });

  it('thins the haze with height but never past the root', () => {
    const m = planMap({ form: wallForm });
    expect(seeAt(m, m.ceiling)).toBeGreaterThan(seeAt(m, m.craft.lowPass));
  });

  it('gives the craft room to turn back at top speed', () => {
    const m = planMap({ form: seaForm, craft: fastest });
    expect(m.rings.reach.hx - m.rings.field.hx).toBeGreaterThanOrEqual(m.craft.max * WARN_S + 2 * m.eye.turn.max - 1e-6);
  });

  it('builds the root from whole leaves', () => {
    const m = planMap({ form: axisForm });
    const leaves = (2 * m.rings.root.hx) / m.lod.minSize;
    expect(Math.log2(leaves) % 1).toBe(0);
  });

  it('caps the baked grid and lets the kernel carry detail below a cell', () => {
    const m = planMap({ form: seaForm, field: 30000, craft: fastest });
    expect(Math.max(m.grid.nx, m.grid.ny)).toBeLessThanOrEqual(GRID.maxN + 1);
    expect(m.grid.cell).toBeGreaterThanOrEqual(m.eye.spacing.lowPass);
  });

  it('teaches on a bad ask', () => {
    expect(validateMap({ form: 'globe' })[0]).toMatch(/map.form must be one of/);
    expect(() => planMap({ field: 10 })).toThrow(/map.field/);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(planMap({ form: wallForm, seed: 7 }))).toBe(JSON.stringify(planMap({ form: wallForm, seed: 7 })));
  });
});
